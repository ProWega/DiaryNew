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
