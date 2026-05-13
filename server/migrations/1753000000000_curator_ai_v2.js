"use strict";

/**
 * Curator AI v2 — инфраструктура для:
 *  • persistent DB-cache narrative-brief'ов (раньше был только in-memory 5 мин);
 *  • аудит расхода токенов LLM и бюджетов на куратора;
 *  • концепции мероприятий (PDF/DOCX/TXT/MD) — извлечённый текст для LLM;
 *  • чат «Разговор с ИИ» (треды на curator+group + история сообщений);
 *  • settings.llm на уровне сессии (модель, лимиты, бюджет, флаги).
 *
 * Все таблицы зависят от sessions/groups/program_days/program_events/users
 * через ON DELETE CASCADE — при удалении заезда вся AI-история уходит сама.
 *
 * См. план реализации: C:\Users\techg\.claude\plans\dazzling-popping-charm.md
 */

exports.up = async (pgm) => {
  // ── DB-кеш narrative-brief ────────────────────────────────────────────
  // PK на (session, group, day, fingerprint, model) даёт «один narrative
  // на уникальное сочетание входов». is_current помечает последнюю версию;
  // при regenerate вставляется новый row + старые is_current=false.
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS narrative_brief_cache (
      id                   text PRIMARY KEY,
      session_id           text NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      group_id             text NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      day_id               text NOT NULL REFERENCES program_days(id) ON DELETE CASCADE,
      fingerprint          text NOT NULL,
      model                text NOT NULL,
      narrative_text       text NOT NULL,
      input_tokens         integer NOT NULL DEFAULT 0,
      output_tokens        integer NOT NULL DEFAULT 0,
      cache_read_tokens    integer NOT NULL DEFAULT 0,
      generated_by         text NOT NULL REFERENCES users(id),
      generated_at         timestamptz NOT NULL DEFAULT now(),
      is_current           boolean NOT NULL DEFAULT true,
      UNIQUE (session_id, group_id, day_id, fingerprint, model)
    );
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS narrative_brief_cache_current_idx
      ON narrative_brief_cache (session_id, group_id, day_id, is_current);
  `);

  // ── Учёт расхода токенов LLM ──────────────────────────────────────────
  // Ведётся per-вызов; агрегация (бюджет per-day) считается SELECT'ом.
  // kind различает источник: brief-generate / brief-regen / chat.
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS llm_usage_ledger (
      id                     text PRIMARY KEY,
      session_id             text NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      curator_id             text NOT NULL REFERENCES users(id),
      group_id               text REFERENCES groups(id),
      kind                   text NOT NULL,
      model                  text NOT NULL,
      input_tokens           integer NOT NULL DEFAULT 0,
      output_tokens          integer NOT NULL DEFAULT 0,
      cache_creation_tokens  integer NOT NULL DEFAULT 0,
      cache_read_tokens      integer NOT NULL DEFAULT 0,
      cost_estimate_micros   bigint NOT NULL DEFAULT 0,
      ref_id                 text,
      occurred_at            timestamptz NOT NULL DEFAULT now()
    );
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS llm_usage_ledger_curator_day_idx
      ON llm_usage_ledger (session_id, curator_id, occurred_at DESC);
  `);
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS llm_usage_ledger_session_day_idx
      ON llm_usage_ledger (session_id, occurred_at DESC);
  `);

  // ── Концепции мероприятий ─────────────────────────────────────────────
  // Хранит и оригинал (на диске под /uploads/documents/), и извлечённый
  // текст для быстрой инъекции в LLM. UNIQUE (event_id, storage_filename)
  // позволяет загрузить несколько разных файлов на одно событие, но не
  // дублировать тот же контент (storage_filename = sha256-prefix).
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS program_event_concepts (
      id                text PRIMARY KEY,
      session_id        text NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      event_id          text NOT NULL REFERENCES program_events(id) ON DELETE CASCADE,
      source_filename   text NOT NULL,
      storage_filename  text NOT NULL,
      mime              text NOT NULL,
      size_bytes        integer NOT NULL,
      extracted_text    text NOT NULL,
      extracted_chars   integer NOT NULL,
      uploaded_by       text NOT NULL REFERENCES users(id),
      uploaded_at       timestamptz NOT NULL DEFAULT now(),
      UNIQUE (event_id, storage_filename)
    );
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS program_event_concepts_session_idx
      ON program_event_concepts (session_id);
  `);
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS program_event_concepts_event_idx
      ON program_event_concepts (event_id);
  `);

  // ── Чат «Разговор с ИИ» ───────────────────────────────────────────────
  // Один активный thread на (session, group, curator) — UNIQUE INDEX
  // partial по status='active'. Archived треды живут для аудита.
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS curator_chat_threads (
      id               text PRIMARY KEY,
      session_id       text NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      group_id         text NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      curator_id       text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status           text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
      created_at       timestamptz NOT NULL DEFAULT now(),
      last_message_at  timestamptz
    );
  `);

  pgm.sql(`
    CREATE UNIQUE INDEX IF NOT EXISTS curator_chat_threads_active_idx
      ON curator_chat_threads (session_id, group_id, curator_id)
      WHERE status = 'active';
  `);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS curator_chat_messages (
      id          text PRIMARY KEY,
      thread_id   text NOT NULL REFERENCES curator_chat_threads(id) ON DELETE CASCADE,
      role        text NOT NULL CHECK (role IN ('user','assistant','system')),
      content     text NOT NULL,
      model       text,
      usage       jsonb,
      created_at  timestamptz NOT NULL DEFAULT now()
    );
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS curator_chat_messages_thread_idx
      ON curator_chat_messages (thread_id, created_at);
  `);

  // ── LLM-настройки на уровне сессии ────────────────────────────────────
  // Отдельная JSONB-колонка (не реюзаем sessions.settings, у которого другой
  // жизненный цикл — там настройки участника, тут админ-параметры).
  pgm.sql(`
    ALTER TABLE sessions
      ADD COLUMN IF NOT EXISTS llm_settings jsonb NOT NULL DEFAULT '{}'::jsonb;
  `);
};

exports.down = async (pgm) => {
  pgm.sql(`ALTER TABLE sessions DROP COLUMN IF EXISTS llm_settings;`);
  pgm.sql(`DROP INDEX IF EXISTS curator_chat_messages_thread_idx;`);
  pgm.sql(`DROP TABLE IF EXISTS curator_chat_messages;`);
  pgm.sql(`DROP INDEX IF EXISTS curator_chat_threads_active_idx;`);
  pgm.sql(`DROP TABLE IF EXISTS curator_chat_threads;`);
  pgm.sql(`DROP INDEX IF EXISTS program_event_concepts_event_idx;`);
  pgm.sql(`DROP INDEX IF EXISTS program_event_concepts_session_idx;`);
  pgm.sql(`DROP TABLE IF EXISTS program_event_concepts;`);
  pgm.sql(`DROP INDEX IF EXISTS llm_usage_ledger_session_day_idx;`);
  pgm.sql(`DROP INDEX IF EXISTS llm_usage_ledger_curator_day_idx;`);
  pgm.sql(`DROP TABLE IF EXISTS llm_usage_ledger;`);
  pgm.sql(`DROP INDEX IF EXISTS narrative_brief_cache_current_idx;`);
  pgm.sql(`DROP TABLE IF EXISTS narrative_brief_cache;`);
};
