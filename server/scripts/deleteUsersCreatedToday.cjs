"use strict";

/**
 * Удалить всех пользователей, созданных сегодня (по серверному timezone PG).
 *
 * Защита от случайного запуска:
 *  - По умолчанию работает в dry-run и только показывает кого удалит.
 *  - Реальный DELETE — только если передан флаг `--apply` или env `APPLY=1`.
 *  - Не трогает пользователей с ролью admin (на всякий случай).
 *
 * FK-каскад из schema.sql:
 *  - session_users, diary_entries, daily_reflections, return_entries и др. —
 *    ON DELETE CASCADE → автоматически удаляются.
 *  - groups.curator_id, auth_magic_links.created_by/consumed_by →
 *    ON DELETE SET NULL → группы остаются без куратора, но не падают.
 *  - target_user_id в magic-links — CASCADE, ссылка тоже удалится.
 *
 * Запуск (на dev):
 *   node server/scripts/deleteUsersCreatedToday.cjs           # dry-run
 *   node server/scripts/deleteUsersCreatedToday.cjs --apply   # реально удалить
 *
 * На сервере (docker compose):
 *   docker compose exec app node server/scripts/deleteUsersCreatedToday.cjs
 *   docker compose exec app node server/scripts/deleteUsersCreatedToday.cjs --apply
 */

const { query, hasPostgresConfig } = require("../db/postgres.cjs");

function logHeader() {
  console.log("=".repeat(70));
  console.log(" Удаление пользователей, созданных сегодня (TZ сервера PG)");
  console.log("=".repeat(70));
}

async function main() {
  const apply = process.argv.includes("--apply") || process.env.APPLY === "1";

  logHeader();
  if (!hasPostgresConfig()) {
    console.error("❌ PG-конфигурация не найдена (нет PGHOST/PGUSER/PGDATABASE).");
    process.exit(2);
  }

  // 1. Кандидаты на удаление (созданные сегодня, не admin)
  const candidatesResult = await query(
    `select
       u.id, u.full_name, u.role, u.created_at,
       coalesce((select count(*) from diary_entries de where de.user_id = u.id and de.responded_at is not null)::int, 0) as answered_entries,
       coalesce((select count(*) from session_users su where su.user_id = u.id)::int, 0) as session_assignments
     from users u
     where u.created_at::date = (now() at time zone 'UTC')::date
       and u.role <> 'admin'
     order by u.created_at`,
  );

  const rows = candidatesResult.rows;
  if (rows.length === 0) {
    console.log("\nСегодня новых пользователей (не admin) не было. Нечего удалять.");
    return;
  }

  console.log(`\nНайдено ${rows.length} пользователей для удаления:\n`);
  for (const u of rows) {
    const ts = new Date(u.created_at).toISOString();
    console.log(
      `  ${u.id.padEnd(28)} | ${ts} | role=${u.role.padEnd(11)} | ` +
        `answers=${String(u.answered_entries).padStart(3)} | ` +
        `assignments=${u.session_assignments} | ${u.full_name}`,
    );
  }

  const withAnswers = rows.filter((u) => u.answered_entries > 0).length;
  if (withAnswers > 0) {
    console.log(
      `\n⚠ ${withAnswers} из них имеют ответы в дневнике (answered_entries > 0). ` +
        `Их diary_entries удалятся каскадом. Если это нежелательно — отмените!`,
    );
  }

  if (!apply) {
    console.log("\n--- DRY RUN ---");
    console.log(
      `Для реального удаления повторите команду с флагом --apply, например:\n` +
        `  node server/scripts/deleteUsersCreatedToday.cjs --apply`,
    );
    return;
  }

  // 2. Удаление
  console.log("\n→ Удаляю...");
  const ids = rows.map((r) => r.id);
  const result = await query(`delete from users where id = any($1::text[]) returning id`, [ids]);
  console.log(`✓ Удалено пользователей: ${result.rowCount}`);

  // 3. Audit
  await query(
    `insert into audit_log (id, actor_id, action, entity_type, entity_id, payload, created_at)
     values ($1, null, 'admin.users.batch_deleted_today', 'users', null, $2::jsonb, now())`,
    [
      `audit-${Date.now()}`,
      JSON.stringify({
        deletedCount: result.rowCount,
        userIds: ids,
        deletedNames: rows.map((r) => r.full_name),
        runFrom: "deleteUsersCreatedToday script",
      }),
    ],
  );
  console.log("✓ Audit-event записан");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Ошибка:", error?.message || error);
    process.exit(1);
  });
