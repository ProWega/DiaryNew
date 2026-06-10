"use strict";

/**
 * Многоразовые magic-link.
 *
 * Изначально `auth_magic_links` поддерживал ровно одно использование:
 * `consumeMagicLink` ставил `consumed_at = now()` и любые последующие попытки
 * по тому же токену → 401.
 *
 * Эта миграция добавляет:
 *   - `max_uses int` — максимум потреблений. NULL = безлимит. Дефолт 1
 *     (сохраняет старое поведение для всех существующих ссылок).
 *   - `uses_count int not null default 0` — текущий счётчик потреблений.
 *
 * Логика на стороне приложения (`consumeMagicLink`):
 *   - ссылка валидна, если `(max_uses IS NULL OR uses_count < max_uses)
 *      AND expires_at > now()`;
 *   - на каждое успешное consume — `uses_count := uses_count + 1`;
 *   - `consumed_at` оставлен и продолжает заполняться при ПЕРВОМ consume
 *     для backward-compat (есть legacy-код, который смотрит на `consumed_at`).
 *
 * Backfill: всем существующим ссылкам ставим max_uses=1; для тех, у кого уже
 * было `consumed_at IS NOT NULL`, ставим uses_count=1 (они уже потреблены —
 * семантика сохранена).
 *
 * Use case: organizer создаёт «многоразовый QR» для уже существующего
 * участника группы — что-то вроде бейджа, который участник сканирует
 * многократно в течение смены.
 */

exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE auth_magic_links
      ADD COLUMN IF NOT EXISTS max_uses int DEFAULT 1,
      ADD COLUMN IF NOT EXISTS uses_count int NOT NULL DEFAULT 0;
  `);

  // Backfill: уже потреблённые ссылки получают uses_count=1.
  pgm.sql(`
    UPDATE auth_magic_links
    SET uses_count = 1
    WHERE consumed_at IS NOT NULL AND uses_count = 0;
  `);
};

exports.down = async (pgm) => {
  pgm.sql(`ALTER TABLE auth_magic_links DROP COLUMN IF EXISTS uses_count;`);
  pgm.sql(`ALTER TABLE auth_magic_links DROP COLUMN IF EXISTS max_uses;`);
};
