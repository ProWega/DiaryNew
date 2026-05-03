# Миграции БД

Управляются через [`node-pg-migrate`](https://github.com/salsita/node-pg-migrate). Стартовая схема (`server/sql/schema.sql`) переехала в первую миграцию; все будущие изменения схемы — через миграции с откатом.

## Workflow

```bash
# Применить все pending-миграции (главное действие)
npm run db:migrate

# Откатить последнюю миграцию
npm run db:migrate:down

# Создать новую пустую миграцию (timestamped)
npm run db:migrate:create -- add_user_avatar_column
```

Все три команды — обёртка над `node server/scripts/migrate.cjs`, который грузит `dotenv` и вызывает программный API node-pg-migrate с правильными путями.

## Файл миграции

В `server/migrations/` лежат `<timestamp>_<name>.js`:

```js
"use strict";

exports.up = async (pgm) => {
  await pgm.db.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url text;
  `);
};

exports.down = async (pgm) => {
  await pgm.db.query(`
    ALTER TABLE users DROP COLUMN IF EXISTS avatar_url;
  `);
};
```

Доступен и SQL-формат файлов (`.sql`), но JS даёт условную логику и вызовы хелперов — стартовая миграция (`1746000000000_initial.js`) использует именно JS, читая `server/sql/schema.sql` целиком.

## Учёт применённых миграций

Таблица `pgmigrations` создаётся автоматически при первом `db:migrate up`:

```sql
SELECT * FROM pgmigrations ORDER BY run_on;
```

Каждая успешная миграция получает строку. Откат удаляет строку.

## Production deploy

`prod:init` теперь = `npm run db:migrate`. Docker entrypoint поднимает контейнер так:

```
prod:init  →  start:server
```

Если миграция упадёт — старт сервера прерывается, контейнер не поднимается, балансер остаётся на старой версии. Это нужное поведение.

## Стратегия rollback

1. Если новый release сломал прод и БД-схему трогать НЕ надо — деплой откатывается на предыдущий image, миграции остаются применёнными. Большинство rollback'ов попадает сюда.
2. Если БД-схема несовместима — `npm run db:migrate:down` ОТКАТЫВАЕТ последнюю миграцию ВРУЧНУЮ перед откатом образа.
3. Никогда не делайте destructive миграции (DROP COLUMN с данными) без backup и без forward-compatible deploy в две фазы:
   - Phase A: код работает БЕЗ удаляемой колонки + миграция-no-op
   - Phase B (после soak): миграция на реальный DROP

## Связь со старым `db:schema`

`npm run db:schema` (legacy) применяет `server/sql/schema.sql` напрямую через `query(schema)`. Файл идемпотентен (везде `IF NOT EXISTS`), но не учитывает версии. Используется только для:

- свежей dev-БД (когда быстрее, чем миграции)
- emergency repair

Для продакшена — только `db:migrate`. Со временем `db:schema` будет помечен deprecated.

## Troubleshooting

**Миграция повисла**: проверь `select * from pg_locks where granted = false;` и `select * from pg_stat_activity where state = 'idle in transaction';` — наверняка есть зависший lock от прерванного миграционного процесса.

**Несовпадение state vs DB**: если таблица `pgmigrations` потеряна (например, после `db:reset`), при следующем `db:migrate` все миграции применятся повторно. Стартовая миграция идемпотентна (`CREATE TABLE IF NOT EXISTS`), но кастомные миграции могут не быть. Решение — `INSERT INTO pgmigrations` вручную для уже применённых.

**Создать миграцию без БД под рукой**: `npm run db:migrate:create -- name` создаёт файл локально, не подключаясь к БД.
