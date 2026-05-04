"use strict";

/**
 * Idempotent seeder for the «Истоки · Голоса регионов» content store.
 * Reads server/seed/data/istoki-regions-seed.json and inserts into
 * istoki_regions / istoki_podcasts / istoki_stories / istoki_chronicle.
 *
 * Safe to run multiple times — uses ON CONFLICT DO UPDATE everywhere
 * so re-runs refresh the seed content without duplicating rows.
 */

const path = require("node:path");
const fs = require("node:fs");
const {
  upsertRegion,
  upsertPodcast,
  upsertStory,
  upsertChronicleEntry,
} = require("../db/repositories/istokiStore.cjs");

const ISO_BY_CODE = {
  sevastopol: "RU-SEV",
  pskov: "RU-PSK",
  moscow: "RU-MOW",
  spb: "RU-SPE",
  ekaterinburg: "RU-SVE",
  vladivostok: "RU-PRI",
};

function loadSeedData() {
  const filePath = path.join(__dirname, "data", "istoki-regions-seed.json");
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

async function seedIstokiRegions() {
  const regions = loadSeedData();

  for (const [index, region] of regions.entries()) {
    await upsertRegion({
      code: region.code,
      isoCode: ISO_BY_CODE[region.code] ?? null,
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

  console.log(`[db:seed:istoki] Seeded ${regions.length} region(s).`);
}

module.exports = { seedIstokiRegions };
