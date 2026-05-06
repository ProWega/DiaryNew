"use strict";

/**
 * Phase 2.5 of «Дневник пути» migration — v4 update.
 *
 * v4 redefines two concepts (see docs/architecture/methodology-mapping.md):
 *  1. «Настрой» (mood) → «Этап пути» (journey_stage) — semantic shift from
 *     "mood at this session" to "where I am on my life path".
 *  2. «Тишина» — больше НЕ один из этапов. Стала отдельным флагом
 *     `is_careful_mode`, который ставится поверх любого этапа.
 *     Обоснование v4 §I.5: острая нагрузка почти всегда сопрягается
 *     с этапом пути (мама особого ребёнка одновременно в Передаче
 *     и в нагрузке). Заставлять выбирать = терять правду.
 *
 * Старые значения mood:        crossroads, support, transmission, silence
 * Новые значения journey_stage: search,     verification, support, transmission
 *
 * Backfill при наличии данных:
 *  - mood='silence'      → journey_stage=NULL,         is_careful_mode=true
 *  - mood='crossroads'   → journey_stage='search',     is_careful_mode=false
 *  - mood='support'      → journey_stage='support'     (имя совпадает)
 *  - mood='transmission' → journey_stage='transmission'(имя совпадает)
 *
 * Сейчас прод пуст, backfill тривиален.
 */

exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE session_users
      ADD COLUMN IF NOT EXISTS is_careful_mode boolean NOT NULL DEFAULT false;
  `);

  // Convert legacy mood='silence' rows BEFORE rename, so we can read mood column.
  pgm.sql(`
    UPDATE session_users
    SET is_careful_mode = true, mood = NULL
    WHERE mood = 'silence';
  `);

  // Map crossroads → search (other values keep their names).
  pgm.sql(`
    UPDATE session_users
    SET mood = 'search'
    WHERE mood = 'crossroads';
  `);

  // Now rename mood → journey_stage.
  pgm.sql(`
    ALTER TABLE session_users RENAME COLUMN mood TO journey_stage;
  `);
};

exports.down = async (pgm) => {
  pgm.sql(`
    ALTER TABLE session_users RENAME COLUMN journey_stage TO mood;
  `);

  // Reverse data conversion: search → crossroads, careful_mode=true (with NULL mood) → silence.
  pgm.sql(`
    UPDATE session_users
    SET mood = 'crossroads'
    WHERE mood = 'search';
  `);

  pgm.sql(`
    UPDATE session_users
    SET mood = 'silence', is_careful_mode = false
    WHERE is_careful_mode = true AND mood IS NULL;
  `);

  pgm.sql(`
    ALTER TABLE session_users DROP COLUMN IF EXISTS is_careful_mode;
  `);
};
