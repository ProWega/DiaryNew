"use strict";

/**
 * Curator AI v2.1 — кастомизация контекста чата «Разговор с ИИ».
 *
 * Куратор может выбирать ЧТО включать в LLM-preamble: конкретные дни, конкретные
 * участники, конкретные мероприятия с концепциями. Выбор сохраняется как
 * именованный preset (`label` + `filter` JSONB). Один из preset'ов может быть
 * помечен `is_default = true` — он применяется автоматически если куратор не
 * выбрал ничего вручную.
 *
 * UNIQUE partial index гарантирует один is_default per (session, group, curator).
 * Структура filter:
 *   { includeMembers, memberIds[], includeDays, dayIds[], includeConcepts, eventIds[] }
 * Нормализуется в `server/services/chatContextFilter.cjs`.
 */

exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS curator_chat_presets (
      id          text PRIMARY KEY,
      session_id  text NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      group_id    text NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      curator_id  text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      label       text NOT NULL,
      filter      jsonb NOT NULL DEFAULT '{}'::jsonb,
      is_default  boolean NOT NULL DEFAULT false,
      created_by  text REFERENCES users(id),
      created_at  timestamptz NOT NULL DEFAULT now(),
      updated_at  timestamptz NOT NULL DEFAULT now()
    );
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS curator_chat_presets_owner_idx
      ON curator_chat_presets (session_id, group_id, curator_id);
  `);

  pgm.sql(`
    CREATE UNIQUE INDEX IF NOT EXISTS curator_chat_presets_default_idx
      ON curator_chat_presets (session_id, group_id, curator_id)
      WHERE is_default = true;
  `);
};

exports.down = async (pgm) => {
  pgm.sql(`DROP INDEX IF EXISTS curator_chat_presets_default_idx;`);
  pgm.sql(`DROP INDEX IF EXISTS curator_chat_presets_owner_idx;`);
  pgm.sql(`DROP TABLE IF EXISTS curator_chat_presets;`);
};
