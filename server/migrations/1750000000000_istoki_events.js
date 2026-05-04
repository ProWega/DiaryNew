"use strict";

/**
 * Phase E of «Истоки v2» migration: analytics events.
 *
 * Captures user-side interactions on the public regional voices map so
 * the editorial team can see which regions/podcasts/stories actually
 * resonate. Privacy-conscious by design:
 *
 *  - `ip_hash` is sha256(ip + per-day salt). Cannot link two events of
 *    the same person across more than 24h.
 *  - `user_agent` is truncated to 200 chars and only used for debugging.
 *  - No cookies, no fingerprint. A `localStorage['istoki:no-track']` opt-out
 *    on the client suppresses the event POST entirely.
 *
 * `bigserial` PK because we expect frequent appends.
 */

exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS istoki_events (
      id           bigserial PRIMARY KEY,
      event_type   text NOT NULL,
      region_code  text REFERENCES istoki_regions(code) ON DELETE SET NULL,
      entity_id    text,
      payload      jsonb NOT NULL DEFAULT '{}'::jsonb,
      ip_hash      text,
      user_agent   text,
      created_at   timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_istoki_events_type_date
      ON istoki_events(event_type, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_istoki_events_region_date
      ON istoki_events(region_code, created_at DESC);
  `);
};

exports.down = async (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS istoki_events;`);
};
