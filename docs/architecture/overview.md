# Обзор архитектуры

## Контуры приложения

### Frontend

- `src/main.jsx` — точка входа
- `src/AppRouter.jsx` — routed-контур и page titles
- `src/pages/` — routed pages
- `src/views/` — screen-level представления
- `src/components/` — переиспользуемые UI-компоненты
- `src/api/` — jsonApi и hooks
- `src/auth/` — auth/bootstrap state

### Backend

- `server/index.cjs` — Express app и API routes
- `server/config.cjs` — env и auth helpers
- `server/db/postgres.cjs` — подключение и schema lifecycle
- `server/db/repositories/` — domain-oriented data access
- `server/sql/schema.sql` — PostgreSQL schema
- `server/scripts/` — schema/reset/check utilities

## Границы runtime

- runtime source of truth — PostgreSQL + Express API;
- frontend не должен изобретать бизнес-смысл поверх отсутствующих данных;
- Storybook и mock-представления используются для UI и review, но не подменяют runtime-контракты.

## Ключевые продуктовые потоки

- public registration;
- auth через cookie sessions и magic links;
- organizer program management;
- participant daily diary и reflection;
- curator pulse dashboard;
- admin security / access management.

## Данные и режимы

- production-like режим работает с PostgreSQL;
- часть legacy fallback-механик ещё существует, но целевой путь — реальные API-агрегаты;
- Docker-контур запускает `npm run prod:init` перед стартом сервера.

## Что считать Definition of Done

Изменение считается доведённым, когда:

1. обновлён runtime-код;
2. обновлены README / TODO / docs при изменении поведения;
3. добавлены или обновлены Storybook-сценарии для UI-поведения;
4. проходят build- и docs-проверки.
