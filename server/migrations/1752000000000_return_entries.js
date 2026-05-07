"use strict";

/**
 * Phase 5.1 of «Дневник пути» — точки возврата (life after smena).
 *
 * Methodology methodology-mapping.md §2.6: 1/4/12/26/52 weeks after a session
 * ends, the participant gets a soft invitation to «дополнить запись». The
 * touchpoints themselves are computed lazily from sessions.end_date — no
 * scheduled-jobs table. This migration only persists the actual return
 * entries the participant writes back.
 *
 * Each row is one written reflection at one touchpoint. The touchpoint is
 * identified by an integer index 1..5 corresponding to weeks (1, 4, 12, 26, 52)
 * — keeping it as an int rather than the week number lets us tweak the
 * intervals later without a schema change.
 *
 * Privacy parity with diary_entries: is_anonymous + is_hidden_from_curator
 * follow the same semantics through server/lib/privacy.cjs.
 */

exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS return_entries (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      session_id text NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      touchpoint_index integer NOT NULL CHECK (touchpoint_index BETWEEN 1 AND 5),
      content text NOT NULL,
      is_anonymous boolean NOT NULL DEFAULT false,
      is_hidden_from_curator boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (user_id, session_id, touchpoint_index)
    );
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS return_entries_user_session_idx
      ON return_entries (user_id, session_id);
  `);
};

exports.down = async (pgm) => {
  pgm.sql(`DROP INDEX IF EXISTS return_entries_user_session_idx;`);
  pgm.sql(`DROP TABLE IF EXISTS return_entries;`);
};
