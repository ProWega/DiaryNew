"use strict";

/**
 * Repository for the «Истоки · Голоса регионов» content store.
 * Public reads only in Phase A; create/update/delete will be wired up
 * by the admin CMS in Phase B.
 */

const { query } = require("../postgres.cjs");
const { createId } = require("./common.cjs");

function rowToRegionSummary(row) {
  return {
    code: row.code,
    isoCode: row.iso_code,
    name: row.name,
    geographicHint: row.geographic_hint,
    orderIdx: row.order_idx,
    isPublished: row.is_published,
    hasContent: Boolean(
      Number(row.podcasts_count || 0) ||
      Number(row.stories_count || 0) ||
      Number(row.chronicle_count || 0),
    ),
    counts: {
      podcasts: Number(row.podcasts_count || 0),
      stories: Number(row.stories_count || 0),
      chronicle: Number(row.chronicle_count || 0),
    },
  };
}

function rowToRegion(row) {
  return {
    code: row.code,
    isoCode: row.iso_code,
    name: row.name,
    geographicHint: row.geographic_hint,
    orderIdx: row.order_idx,
    isPublished: row.is_published,
  };
}

function rowToPodcast(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description || "",
    audioUrl: row.audio_url,
    durationSec: row.duration_sec,
    recordedAt: row.recorded_at ? row.recorded_at.toISOString().slice(0, 10) : null,
    speakerName: row.speaker_name || undefined,
  };
}

function rowToStory(row) {
  return {
    id: row.id,
    participantName: row.participant_name,
    ageOrRole: row.age_or_role,
    beforeText: row.before_text,
    afterText: row.after_text,
    manifestoQuote: row.manifesto_quote,
    photoUrl: row.photo_url,
    regionContextHint: row.region_context_hint || undefined,
  };
}

function rowToChronicle(row) {
  return {
    id: row.id,
    eventDate:
      row.event_date instanceof Date ? row.event_date.toISOString().slice(0, 10) : row.event_date,
    eventTitle: row.event_title,
    participantsCount: row.participants_count,
    keyInsights: Array.isArray(row.key_insights) ? row.key_insights : [],
  };
}

async function listRegions({ publishedOnly = true } = {}) {
  const result = await query(
    `
      select
        r.code, r.iso_code, r.name, r.geographic_hint, r.order_idx, r.is_published,
        (select count(*) from istoki_podcasts p where p.region_code = r.code)  as podcasts_count,
        (select count(*) from istoki_stories s where s.region_code = r.code)   as stories_count,
        (select count(*) from istoki_chronicle c where c.region_code = r.code) as chronicle_count
      from istoki_regions r
      where ($1 = false) or r.is_published = true
      order by r.order_idx asc, r.name asc
    `,
    [publishedOnly],
  );

  return result.rows.map(rowToRegionSummary);
}

async function getRegionByCode(code, { publishedOnly = true } = {}) {
  const regionResult = await query(
    `select * from istoki_regions where code = $1 ${publishedOnly ? "and is_published = true" : ""} limit 1`,
    [code],
  );

  if (!regionResult.rows.length) {
    return null;
  }

  const region = rowToRegion(regionResult.rows[0]);

  const [podcasts, stories, chronicle] = await Promise.all([
    query(
      `select * from istoki_podcasts where region_code = $1 order by order_idx asc, recorded_at desc nulls last, id asc`,
      [code],
    ),
    query(`select * from istoki_stories where region_code = $1 order by order_idx asc, id asc`, [
      code,
    ]),
    query(
      `select * from istoki_chronicle where region_code = $1 order by event_date desc, order_idx asc, id asc`,
      [code],
    ),
  ]);

  return {
    ...region,
    podcasts: podcasts.rows.map(rowToPodcast),
    stories: stories.rows.map(rowToStory),
    chronicle: chronicle.rows.map(rowToChronicle),
  };
}

async function upsertRegion(input) {
  const code = String(input.code).trim();
  if (!code) {
    const error = new Error("istoki_regions.code is required");
    error.status = 400;
    throw error;
  }

  await query(
    `
      insert into istoki_regions (code, iso_code, name, geographic_hint, order_idx, is_published, updated_at)
      values ($1, $2, $3, $4, $5, $6, now())
      on conflict (code) do update set
        iso_code = excluded.iso_code,
        name = excluded.name,
        geographic_hint = excluded.geographic_hint,
        order_idx = excluded.order_idx,
        is_published = excluded.is_published,
        updated_at = now()
    `,
    [
      code,
      input.isoCode ?? null,
      input.name,
      input.geographicHint ?? null,
      Number.isFinite(input.orderIdx) ? input.orderIdx : 0,
      input.isPublished !== false,
    ],
  );

  return code;
}

async function upsertPodcast(input) {
  const id = input.id || createId("pod");
  await query(
    `
      insert into istoki_podcasts
        (id, region_code, title, description, audio_url, duration_sec, recorded_at, speaker_name, order_idx, updated_at)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
      on conflict (id) do update set
        region_code = excluded.region_code,
        title = excluded.title,
        description = excluded.description,
        audio_url = excluded.audio_url,
        duration_sec = excluded.duration_sec,
        recorded_at = excluded.recorded_at,
        speaker_name = excluded.speaker_name,
        order_idx = excluded.order_idx,
        updated_at = now()
    `,
    [
      id,
      input.regionCode,
      input.title,
      input.description || "",
      input.audioUrl,
      Number.isFinite(input.durationSec) ? input.durationSec : 0,
      input.recordedAt || null,
      input.speakerName || null,
      Number.isFinite(input.orderIdx) ? input.orderIdx : 0,
    ],
  );
  return id;
}

async function upsertStory(input) {
  const id = input.id || createId("sty");
  await query(
    `
      insert into istoki_stories
        (id, region_code, participant_name, age_or_role, before_text, after_text,
         manifesto_quote, photo_url, region_context_hint, order_idx, updated_at)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
      on conflict (id) do update set
        region_code = excluded.region_code,
        participant_name = excluded.participant_name,
        age_or_role = excluded.age_or_role,
        before_text = excluded.before_text,
        after_text = excluded.after_text,
        manifesto_quote = excluded.manifesto_quote,
        photo_url = excluded.photo_url,
        region_context_hint = excluded.region_context_hint,
        order_idx = excluded.order_idx,
        updated_at = now()
    `,
    [
      id,
      input.regionCode,
      input.participantName,
      input.ageOrRole,
      input.beforeText,
      input.afterText,
      input.manifestoQuote,
      input.photoUrl,
      input.regionContextHint || null,
      Number.isFinite(input.orderIdx) ? input.orderIdx : 0,
    ],
  );
  return id;
}

async function upsertChronicleEntry(input) {
  const id = input.id || createId("chr");
  await query(
    `
      insert into istoki_chronicle
        (id, region_code, event_date, event_title, participants_count, key_insights, order_idx, updated_at)
      values ($1, $2, $3, $4, $5, $6::jsonb, $7, now())
      on conflict (id) do update set
        region_code = excluded.region_code,
        event_date = excluded.event_date,
        event_title = excluded.event_title,
        participants_count = excluded.participants_count,
        key_insights = excluded.key_insights,
        order_idx = excluded.order_idx,
        updated_at = now()
    `,
    [
      id,
      input.regionCode,
      input.eventDate,
      input.eventTitle,
      Number.isFinite(input.participantsCount) ? input.participantsCount : 0,
      JSON.stringify(Array.isArray(input.keyInsights) ? input.keyInsights : []),
      Number.isFinite(input.orderIdx) ? input.orderIdx : 0,
    ],
  );
  return id;
}

module.exports = {
  listRegions,
  getRegionByCode,
  upsertRegion,
  upsertPodcast,
  upsertStory,
  upsertChronicleEntry,
};
