# Сервисные команды

## Проверка контейнеров

```bash
cd /opt/newdiary
sudo docker compose --env-file .env.docker ps
```

## Логи приложения

```bash
cd /opt/newdiary
sudo docker compose --env-file .env.docker logs -f app
```

## Health-check

```bash
curl http://127.0.0.1:4000/api/health
curl -I http://127.0.0.1:4000
```

## Применить схему ещё раз

```bash
cd /opt/newdiary
sudo docker compose --env-file .env.docker exec app npm run db:schema
```

## Открыть shell внутри app

```bash
cd /opt/newdiary
sudo docker compose --env-file .env.docker exec app sh
```

## Посмотреть админов в базе

```bash
cd /opt/newdiary

sudo docker compose --env-file .env.docker exec -T app node - <<'NODE'
const { query } = require('./server/db/postgres.cjs');

(async () => {
  const result = await query(`
    select id, full_name, email, status
    from users
    where role = 'admin'
    order by created_at
  `);
  console.table(result.rows);
  process.exit(0);
})().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
NODE
```

## Посмотреть sessionId и groups

```bash
cd /opt/newdiary

sudo docker compose --env-file .env.docker exec -T app node - <<'NODE'
const { query } = require('./server/db/postgres.cjs');

(async () => {
  const sessions = await query(`
    select id, name, start_date, end_date
    from sessions
    order by created_at desc
  `);
  console.log('\\nSESSIONS');
  console.table(sessions.rows);

  const groups = await query(`
    select g.id, g.name, g.session_id, g.curator_id
    from groups g
    order by g.session_id, g.name
  `);
  console.log('\\nGROUPS');
  console.table(groups.rows);
  process.exit(0);
})().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
NODE
```
