"use strict";

/**
 * Idempotent seeder for the «Истоки · Голоса регионов» content store.
 *
 * Two-pass strategy (Phase C onward):
 *   Pass 1: insert all RF subjects from istoki-rf-subjects.json as bare
 *           regions (code + iso + display name, no content). This makes
 *           the full map clickable in the public showcase.
 *   Pass 2: read istoki-regions-seed.json and ON CONFLICT DO UPDATE
 *           overwrite the matching regions with their featured display
 *           name + cascade insert their podcasts/stories/chronicle.
 *
 * Both passes use upsert semantics, so re-runs refresh content without
 * duplicating rows.
 */

const path = require("node:path");
const fs = require("node:fs");
const {
  upsertRegion,
  upsertPodcast,
  upsertStory,
  upsertChronicleEntry,
} = require("../db/repositories/istokiStore.cjs");

function loadJson(filename) {
  const filePath = path.join(__dirname, "data", filename);
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

async function seedRfSubjectStubs() {
  const subjects = loadJson("istoki-rf-subjects.json");

  for (const [index, subject] of subjects.entries()) {
    await upsertRegion({
      code: subject.code,
      isoCode: subject.iso,
      name: subject.name,
      geographicHint: null,
      orderIdx: 1000 + index,
      isPublished: true,
    });
  }

  return subjects.length;
}

async function seedFeaturedRegions() {
  const regions = loadJson("istoki-regions-seed.json");

  for (const [index, region] of regions.entries()) {
    await upsertRegion({
      code: region.code,
      isoCode: region.isoCode ?? null,
      name: region.name,
      geographicHint: region.geographicHint,
      orderIdx: index,
      isPublished: true,
    });

    for (const [podcastIndex, podcast] of (region.podcasts || []).entries()) {
      await upsertPodcast({
        id: podcast.id,
        regionCode: region.code,
        title: podcast.title,
        description: podcast.description,
        audioUrl: podcast.audioUrl,
        durationSec: podcast.durationSec,
        recordedAt: podcast.recordedAt,
        speakerName: podcast.speakerName,
        orderIdx: podcastIndex,
      });
    }

    for (const [storyIndex, story] of (region.stories || []).entries()) {
      await upsertStory({
        id: story.id,
        regionCode: region.code,
        participantName: story.participantName,
        ageOrRole: story.ageOrRole,
        beforeText: story.beforeText,
        afterText: story.afterText,
        manifestoQuote: story.manifestoQuote,
        photoUrl: story.photoUrl,
        regionContextHint: story.regionContextHint,
        orderIdx: storyIndex,
      });
    }

    for (const [entryIndex, entry] of (region.chronicle || []).entries()) {
      await upsertChronicleEntry({
        id: entry.id,
        regionCode: region.code,
        eventDate: entry.eventDate,
        eventTitle: entry.eventTitle,
        participantsCount: entry.participantsCount,
        keyInsights: entry.keyInsights,
        orderIdx: entryIndex,
      });
    }
  }

  return regions.length;
}

async function seedIstokiRegions() {
  const stubsCount = await seedRfSubjectStubs();
  const featuredCount = await seedFeaturedRegions();
  console.log(
    `[db:seed:istoki] Seeded ${stubsCount} RF subject stub(s) + ${featuredCount} featured region(s).`,
  );
}

module.exports = { seedIstokiRegions };
