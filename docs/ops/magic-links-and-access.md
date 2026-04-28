# Magic links и доступы

## Первый администратор

Если первый админ ещё не создан:

1. убедитесь, что задан `SETUP_TOKEN`;
2. откройте `/setup/admin`;
3. создайте пользователя с ролью `admin`.

## Login magic link для существующего админа

На сервере:

```bash
cd /opt/newdiary

sudo docker compose --env-file .env.docker exec -T app node - <<'NODE'
const { query } = require('./server/db/postgres.cjs');
const { createMagicLink } = require('./server/db/repositories/authStore.cjs');

(async () => {
  const result = await query(`
    select id, full_name, email
    from users
    where role = 'admin' and status = 'active'
    order by created_at
    limit 1
  `);

  const admin = result.rows[0];
  if (!admin) {
    throw new Error('No active admin found');
  }

  const link = await createMagicLink({
    creatorId: admin.id,
    purpose: 'login',
    targetUserId: admin.id,
    ttlMinutes: 30,
    meta: { source: 'manual-server-login' },
  });

  console.log(`Admin: ${admin.full_name} <${admin.email || 'no-email'}>`);
  console.log(link.url);
  process.exit(0);
})().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
NODE
```

## Invite links для участников и кураторов

Логика проекта:

- `invite` link создаёт аккаунт при первом входе;
- участник и куратор привязываются к `sessionId` / `groupId`;
- куратор привязывается к группе session-scoped.

Для массовых рассылок лучше готовить batch-скрипт под конкретный заезд и группы, а не вручную копировать десятки one-liner команд.

## Базовые правила безопасности

- magic link одноразовый;
- указывайте разумный TTL;
- не пересылайте admin login links в общие чаты;
- используйте корректный `APP_BASE_URL`, иначе ссылка может собраться на `localhost`.
