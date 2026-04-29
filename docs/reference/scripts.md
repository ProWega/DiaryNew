# NPM Scripts

> Этот файл собирается командой `npm run docs:generate`. Источник правды — `package.json` и генератор в `scripts/docs/generateReference.cjs`.

## Локальная разработка

| Script | Команда | Назначение |
| --- | --- | --- |
| `dev` | `concurrently "npm run dev:server" "npm run dev:client"` | Поднимает frontend и backend локально одной командой. |
| `dev:client` | `vite --host 0.0.0.0` | Стартует Vite dev server. |
| `dev:server` | `nodemon server/index.cjs` | Стартует Express через nodemon. |
| `start:server` | `node server/index.cjs` | Запускает Express без nodemon. |
| `preview` | `vite preview` | Локально показывает production build frontend. |

## База данных и production init

| Script | Команда | Назначение |
| --- | --- | --- |
| `db:schema` | `node server/scripts/applySchema.cjs` | Применяет server/sql/schema.sql к текущей PostgreSQL. |
| `db:seed` | `node server/seed/seedDatabase.cjs` | Заполняет базу демо-данными. |
| `db:reset` | `node server/scripts/resetDatabase.cjs` | Сбрасывает схему базы и создаёт её заново. |
| `db:check` | `node server/scripts/checkDatabase.cjs` | Проверяет состояние таблиц и подключения. |
| `prod:init` | `npm run db:schema` | Production init перед стартом контейнера: сейчас это применение схемы. |

## Сборка и UI

| Script | Команда | Назначение |
| --- | --- | --- |
| `build` | `vite build` | Собирает production frontend через Vite. |
| `storybook` | `storybook dev -p 6006 --disable-telemetry` | Запускает Storybook в dev-режиме. |
| `build-storybook` | `storybook build --disable-telemetry` | Собирает статический Storybook. |

## Документация

| Script | Команда | Назначение |
| --- | --- | --- |
| `docs:dev` | `vitepress dev docs` | Запускает VitePress docs-site локально. |
| `docs:generate` | `node scripts/docs/generateReference.cjs` | Пересобирает generated reference-страницы документации. |
| `docs:build` | `vitepress build docs` | Собирает статический docs-site. |
| `docs:preview` | `vitepress preview docs` | Показывает локально собранный docs-site. |
| `docs:check` | `node scripts/docs/generateReference.cjs --check` | Проверяет, что generated docs не устарели относительно исходников. |

## LLM prototypes

| Script | Команда | Назначение |
| --- | --- | --- |
| `llm:pull:qwen25` | `ollama pull qwen2.5:3b-instruct-q4_K_M` | Скачивает локальную модель qwen2.5:3b-instruct-q4_K_M для Ollama-прототипа. |
