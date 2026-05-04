"use strict";

/**
 * Phase 2 of «Дневник пути» migration.
 *
 * Adds methodology-mandated columns:
 *  - diary_entries.is_anonymous, is_hidden_from_curator (правило 3 — авторство)
 *  - diary_entries.group_lad (методический «лад с группой» — второе измерение)
 *  - daily_reflections.is_anonymous, is_hidden_from_curator
 *  - session_users.mood (настрой участника на смену)
 *
 * All columns are nullable / default-false — backwards-compatible. Old code
 * continues to work; new code can opt into the fields.
 *
 * See docs/architecture/methodology-mapping.md (sections 2.3, 2.4).
 */

exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE diary_entries
      ADD COLUMN IF NOT EXISTS is_anonymous boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS is_hidden_from_curator boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS group_lad text;

    ALTER TABLE daily_reflections
      ADD COLUMN IF NOT EXISTS is_anonymous boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS is_hidden_from_curator boolean NOT NULL DEFAULT false;

    ALTER TABLE session_users
      ADD COLUMN IF NOT EXISTS mood text;
  `);
};

exports.down = async (pgm) => {
  pgm.sql(`
    ALTER TABLE diary_entries
      DROP COLUMN IF EXISTS is_anonymous,
      DROP COLUMN IF EXISTS is_hidden_from_curator,
      DROP COLUMN IF EXISTS group_lad;

    ALTER TABLE daily_reflections
      DROP COLUMN IF EXISTS is_anonymous,
      DROP COLUMN IF EXISTS is_hidden_from_curator;

    ALTER TABLE session_users
      DROP COLUMN IF EXISTS mood;
  `);
};
