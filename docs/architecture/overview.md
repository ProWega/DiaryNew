# Обзор архитектуры

Глубже по слоям:

- [Backend и сервисы](./backend-services.md) — структура `routes/` → `services/` → `repositories/`, audit log;
- [Frontend stack](./frontend-stack.md) — TypeScript, React Query, MSW, тёмная тема, декомпозиция view;
- [Миграции БД](./migrations.md) — workflow `node-pg-migrate`;
- [Безопасность](./security.md) — helmet, CORS, rate-limit, zod-валидация, CSRF, audit log.

## Контуры приложения

### Frontend

- `src/main.jsx` — точка входа (QueryClientProvider, ToastProvider, AuthProvider, BrowserRouter, MSW boot)
- `src/AppRouter.jsx` — routed-контур и page titles
- `src/pages/` — routed pages
- `src/views/` — screen-level представления; крупные view декомпозированы в feature-папки (`OrganizerCabinet/`, `CuratorDashboard/`)
- `src/components/` — переиспользуемые UI-компоненты; `components/ui/` — базовый kit (`Button`, `EmptyState`, `Modal`, `Toast`, `Tabs`, `Field`, `Pills`)
- `src/components/organizer/` — 17 файлов программных компонентов + barrel `index.js`
- `src/api/` — `jsonApi.ts`, `hooks.js` (React Query)
- `src/auth/` — auth/bootstrap state
- `src/lib/` — `format.ts`, `programDays.ts`, `csrfToken.ts`
- `src/rbac/permissions.ts` — RBAC матрица
- `src/types/domain.ts` — общие TS-типы домена
- `src/styles/` — модульный CSS (tokens, base, layout, navigation, components, participant, organizer, curator, admin)
- `src/mocks/` — MSW handlers + fixtures + in-memory db (`VITE_USE_MOCK=true`)
- `src/hooks/useTheme.js` — переключение светлой/тёмной темы

### Backend

- `server/index.cjs` — Express app: middleware, монтирование роутеров, CSRF guard, error handler (~165 строк)
- `server/config.cjs` — env-чтение, cookie/CORS/rate-limit конфиг
- `server/lib/routeHelpers.cjs` — `asyncHandler`, cookie-хелперы, viewer resolution, `requireAdmin`/`requireOrganizer`
- `server/lib/csrf.cjs` — Double Submit Cookie: token gen, cookie set/clear, `csrfGuard` middleware
- `server/routes/` — тонкие хендлеры по доменам: `auth`, `public`, `participant`, `curator`, `organizer`, `admin`
- `server/services/` — бизнес-логика: `auditLog`, `magicLinkService`, `programFlowService`, `programNormalizers`, `programWorkspaceService`, `surveyAudienceService`
- `server/db/postgres.cjs` — подключение и legacy `ensureSchema`/`resetSchema`
- `server/db/repositories/` — domain-oriented SQL data access (12 файлов)
- `server/db/organizerWorkspaceStore.cjs` — workspace JSON storage
- `server/migrations/` — `node-pg-migrate` миграции
- `server/sql/schema.sql` — стартовая схема PostgreSQL (применяется initial-миграцией)
- `server/validation/` — zod-схемы (`schemas.cjs`, `organizerSchemas.cjs`) + `validateBody` middleware
- `server/auth/demoUsers.cjs` — dev-режим
- `server/scripts/` — `migrate.cjs`, `applySchema.cjs` (legacy), `resetDatabase.cjs`, `checkDatabase.cjs`
- `server/seed/` — демо-данные
- `server/logger.cjs` — pino structured logging

## Границы runtime

- runtime source of truth — PostgreSQL + Express API;
- frontend не должен изобретать бизнес-смысл поверх отсутствующих данных;
- Storybook и mock-представления используются для UI и review, но не подменяют runtime-контракты.

## Ключевые продуктовые потоки

- public registration;
- auth через cookie sessions и magic links;
- organizer program management, включая вопросы рефлексии на уровне дня и мероприятия;
- participant daily diary, event-level reflection и day-level reflection;
- curator pulse dashboard;
- admin security / access management.

## Данные и режимы

- production-like режим работает с PostgreSQL;
- часть legacy fallback-механик ещё существует, но целевой путь — реальные API-агрегаты;
- Docker-контур запускает `npm run prod:init` перед стартом сервера.

Основные таблицы для программы и дневника:

- `program_days` — дни программы, порядок потоков и вопросы итоговой рефлексии дня;
- `program_events` — мероприятия программы, метаданные события и вопросы рефлексии мероприятия;
- `diary_entries` — отметки состояния, комментарии и ответы участника по мероприятию;
- `daily_reflections` — ответы участника на итоговую рефлексию дня.

## Контракт рефлексии

- единая структура вопроса: `reflectionQuestions: [{ id, text, required }]`;
- вопросы мероприятия хранятся в `program_events.meta.reflectionQuestions`;
- вопросы итогов дня хранятся в `program_days.reflection_prompts`;
- ответы на вопросы мероприятия хранятся в `diary_entries.meta.reflectionAnswers`;
- ответы на вопросы дня хранятся в `daily_reflections.answers`;
- пустой список вопросов мероприятия означает legacy UX с обычным комментарием.

## Что считать Definition of Done

Изменение считается доведённым, когда:

1. обновлён runtime-код;
2. обновлены README / TODO / docs при изменении поведения;
3. добавлены или обновлены Storybook-сценарии для UI-поведения;
4. проходят build- и docs-проверки.
