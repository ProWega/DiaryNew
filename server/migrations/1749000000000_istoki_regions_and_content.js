"use strict";

/**
 * Phase A of «Истоки v2» migration.
 *
 * Promotes the static JSON content store of the public regional voices map
 * (src/features/istoki/data/regions.json) into Postgres, so the editorial team
 * can manage regions, podcasts, stories and chronicle entries from a CMS.
 *
 * Tables (all idempotent):
 *  - istoki_regions      — Russian Federation subjects featured on the map
 *  - istoki_podcasts     — audio episodes scoped to a region
 *  - istoki_stories      — before/after testimonies scoped to a region
 *  - istoki_chronicle    — dated event entries scoped to a region
 *
 * See docs/architecture/methodology-mapping.md and the Plan v2 (Phase A).
 */

exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS istoki_regions (
      code             text PRIMARY KEY,
      iso_code         text UNIQUE,
      name             text NOT NULL,
      geographic_hint  text,
      order_idx        int NOT NULL DEFAULT 0,
      is_published     boolean NOT NULL DEFAULT true,
      created_at       timestamptz NOT NULL DEFAULT now(),
      updated_at       timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS istoki_podcasts (
      id            text PRIMARY KEY,
      region_code   text NOT NULL REFERENCES istoki_regions(code) ON DELETE CASCADE,
      title         text NOT NULL,
      description   text NOT NULL DEFAULT '',
      audio_url     text NOT NULL,
      duration_sec  int NOT NULL DEFAULT 0,
      recorded_at   date,
      speaker_name  text,
      order_idx     int NOT NULL DEFAULT 0,
      created_at    timestamptz NOT NULL DEFAULT now(),
      updated_at    timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS istoki_stories (
      id                   text PRIMARY KEY,
      region_code          text NOT NULL REFERENCES istoki_regions(code) ON DELETE CASCADE,
      participant_name     text NOT NULL,
      age_or_role          text NOT NULL,
      before_text          text NOT NULL,
      after_text           text NOT NULL,
      manifesto_quote      text NOT NULL,
      photo_url            text NOT NULL,
      region_context_hint  text,
      order_idx            int NOT NULL DEFAULT 0,
      created_at           timestamptz NOT NULL DEFAULT now(),
      updated_at           timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS istoki_chronicle (
      id                  text PRIMARY KEY,
      region_code         text NOT NULL REFERENCES istoki_regions(code) ON DELETE CASCADE,
      event_date          date NOT NULL,
      event_title         text NOT NULL,
      participants_count  int NOT NULL DEFAULT 0,
      key_insights        jsonb NOT NULL DEFAULT '[]'::jsonb,
      order_idx           int NOT NULL DEFAULT 0,
      created_at          timestamptz NOT NULL DEFAULT now(),
      updated_at          timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_istoki_podcasts_region  ON istoki_podcasts(region_code);
    CREATE INDEX IF NOT EXISTS idx_istoki_stories_region   ON istoki_stories(region_code);
    CREATE INDEX IF NOT EXISTS idx_istoki_chronicle_region ON istoki_chronicle(region_code);
  `);
};

exports.down = async (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS istoki_chronicle;
    DROP TABLE IF EXISTS istoki_stories;
    DROP TABLE IF EXISTS istoki_podcasts;
    DROP TABLE IF EXISTS istoki_regions;
  `);
};
