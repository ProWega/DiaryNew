"use strict";

/**
 * Repository for the istoki_events analytics table.
 *
 * Insert API is intentionally minimal — events come in batched from the
 * public site and we don't need to read individual rows back; only
 * aggregates power the admin dashboard.
 *
 * Aggregates are kept as plain SQL queries (no SUMing in JS): the indexes
 * on (event_type, created_at) and (region_code, created_at) keep them
 * cheap even at 100k+ events.
 */

const { query } = require("../postgres.cjs");

const ALLOWED_EVENT_TYPES = new Set([
  "region.opened",
  "podcast.played",
  "podcast.progress",
  "story.viewed",
  "chronicle.viewed",
]);

function truncate(s, max = 200) {
  if (!s) return null;
  return String(s).slice(0, max);
}

async function insertEvents({ events, ipHash, userAgent }) {
  if (!Array.isArray(events) || events.length === 0) return 0;

  const rows = events.filter((e) => ALLOWED_EVENT_TYPES.has(e?.type));
  if (!rows.length) return 0;

  // Build a single multi-row INSERT to amortise round-trip cost.
  const values = [];
  const params = [];
  rows.forEach((event, i) => {
    const base = i * 6;
    values.push(
      `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}::jsonb, $${base + 5}, $${base + 6})`,
    );
    params.push(
      event.type,
      event.regionCode || null,
      event.entityId || null,
      JSON.stringify(event.payload || {}),
      ipHash,
      truncate(userAgent),
    );
  });

  const sql = `
    insert into istoki_events
      (event_type, region_code, entity_id, payload, ip_hash, user_agent)
    values ${values.join(", ")}
  `;
  const result = await query(sql, params);
  return result.rowCount;
}

// Range helper — inclusive start, exclusive end. `days` ago to now.
function rangeStart(days) {
  return `now() - interval '${Number(days) || 7} days'`;
}

async function getKpi({ days = 30 } = {}) {
  const result = await query(
    `
      select
        count(*) filter (where event_type = 'region.opened')                       as region_opens,
        count(distinct ip_hash) filter (where event_type = 'region.opened')        as unique_visitors,
        coalesce(sum((payload->>'listenedSec')::int) filter
          (where event_type = 'podcast.progress'), 0)                              as listened_sec_total,
        count(*) filter (where event_type = 'podcast.played')                      as podcast_plays,
        count(*) filter (where event_type = 'story.viewed')                        as story_views
      from istoki_events
      where created_at >= ${rangeStart(days)}
    `,
  );
  const r = result.rows[0] || {};
  return {
    days,
    regionOpens: Number(r.region_opens || 0),
    uniqueVisitors: Number(r.unique_visitors || 0),
    listenedSecTotal: Number(r.listened_sec_total || 0),
    podcastPlays: Number(r.podcast_plays || 0),
    storyViews: Number(r.story_views || 0),
  };
}

async function getTopRegions({ days = 30, limit = 5 } = {}) {
  const result = await query(
    `
      select
        e.region_code,
        coalesce(r.name, e.region_code) as name,
        count(*) as opens,
        count(distinct e.ip_hash) as unique_visitors
      from istoki_events e
      left join istoki_regions r on r.code = e.region_code
      where e.event_type = 'region.opened'
        and e.region_code is not null
        and e.created_at >= ${rangeStart(days)}
      group by e.region_code, r.name
      order by opens desc
      limit $1
    `,
    [limit],
  );
  return result.rows.map((row) => ({
    regionCode: row.region_code,
    name: row.name,
    opens: Number(row.opens),
    uniqueVisitors: Number(row.unique_visitors),
  }));
}

async function getTopPodcasts({ days = 30, limit = 5 } = {}) {
  // A "completion" = a podcast.progress event whose listenedSec is at least
  // 80% of the podcast's duration_sec. Counted once per (podcast, ip_hash).
  const result = await query(
    `
      with completions as (
        select distinct
          e.entity_id as podcast_id,
          e.ip_hash
        from istoki_events e
        join istoki_podcasts p on p.id = e.entity_id
        where e.event_type = 'podcast.progress'
          and e.entity_id is not null
          and e.created_at >= ${rangeStart(days)}
          and (e.payload->>'listenedSec')::int >= 0.8 * coalesce(nullif(p.duration_sec, 0), 60)
      )
      select
        p.id,
        p.region_code,
        p.title,
        count(c.ip_hash) as completions
      from istoki_podcasts p
      left join completions c on c.podcast_id = p.id
      group by p.id, p.region_code, p.title
      order by completions desc, p.title asc
      limit $1
    `,
    [limit],
  );
  return result.rows.map((row) => ({
    id: row.id,
    regionCode: row.region_code,
    title: row.title,
    completions: Number(row.completions),
  }));
}

async function getTopStories({ days = 30, limit = 5 } = {}) {
  const result = await query(
    `
      select
        e.entity_id as story_id,
        s.region_code,
        coalesce(s.participant_name, e.entity_id) as participant_name,
        count(*) as views
      from istoki_events e
      left join istoki_stories s on s.id = e.entity_id
      where e.event_type = 'story.viewed'
        and e.entity_id is not null
        and e.created_at >= ${rangeStart(days)}
      group by e.entity_id, s.region_code, s.participant_name
      order by views desc
      limit $1
    `,
    [limit],
  );
  return result.rows.map((row) => ({
    id: row.story_id,
    regionCode: row.region_code,
    participantName: row.participant_name,
    views: Number(row.views),
  }));
}

async function getDailyTimeSeries({ days = 30, eventType } = {}) {
  const params = [];
  let typeClause = "";
  if (eventType) {
    params.push(eventType);
    typeClause = `and event_type = $${params.length}`;
  }
  const result = await query(
    `
      select
        date_trunc('day', created_at) as day,
        count(*) as count
      from istoki_events
      where created_at >= ${rangeStart(days)}
      ${typeClause}
      group by 1
      order by 1
    `,
    params,
  );
  return result.rows.map((row) => ({
    day: row.day instanceof Date ? row.day.toISOString().slice(0, 10) : row.day,
    count: Number(row.count),
  }));
}

module.exports = {
  ALLOWED_EVENT_TYPES,
  insertEvents,
  getKpi,
  getTopRegions,
  getTopPodcasts,
  getTopStories,
  getDailyTimeSeries,
};
