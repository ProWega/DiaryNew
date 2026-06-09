"use strict";

/**
 * История пакетов приглашений организатора (bulk invites).
 *
 * Каждый раз, когда организатор жмёт «Сгенерировать PDF», сюда пишется одна
 * строка со списком всех приглашений (имена/группы/роли/URL/expiresAt) и
 * параметрами рендера (layout/title/footer/ttlMinutes). Это даёт «историю
 * пакетов» в UI и кнопку «Перевыпустить PDF» — backend читает invites из
 * jsonb и рендерит PDF заново тем же набором magic-link'ов.
 *
 * Почему храним URL целиком в jsonb, а не только magic_link_ids:
 * — в `auth_magic_links` от токена остаётся только хеш, raw-URL восстановить
 *   нельзя; чтобы перевыпустить PDF без выпуска новых ссылок, мы должны
 *   сохранить готовые URL'ы;
 * — данные ограничены ttl_minutes (после истечения magic-link не сработает,
 *   даже если PDF будет перевыпущен);
 * — доступ к endpoint'ам идёт через requireOrganizer.
 */

exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS invite_batches (
      id              text PRIMARY KEY,
      session_id      text NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      created_by      text REFERENCES users(id) ON DELETE SET NULL,
      layout          text NOT NULL DEFAULT 'card',
      title           text,
      footer          text,
      ttl_minutes     integer,
      invites         jsonb NOT NULL DEFAULT '[]'::jsonb,
      groups_count    integer NOT NULL DEFAULT 0,
      invites_count   integer NOT NULL DEFAULT 0,
      created_at      timestamptz NOT NULL DEFAULT now()
    );
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS invite_batches_session_created_idx
      ON invite_batches(session_id, created_at DESC);
  `);
};

exports.down = async (pgm) => {
  pgm.sql(`DROP INDEX IF EXISTS invite_batches_session_created_idx;`);
  pgm.sql(`DROP TABLE IF EXISTS invite_batches;`);
};
