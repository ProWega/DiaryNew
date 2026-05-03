# NPM Scripts

> Этот файл собирается командой `npm run docs:generate`. Источник правды — `package.json` и генератор в `scripts/docs/generateReference.cjs`.

## Локальная разработка

| Script         | Команда                                                  | Назначение                                            |
| -------------- | -------------------------------------------------------- | ----------------------------------------------------- |
| `dev`          | `concurrently "npm run dev:server" "npm run dev:client"` | Поднимает frontend и backend локально одной командой. |
| `dev:client`   | `vite --host 0.0.0.0`                                    | Стартует Vite dev server.                             |
| `dev:server`   | `nodemon server/index.cjs`                               | Стартует Express через nodemon.                       |
| `start:server` | `node server/index.cjs`                                  | Запускает Express без nodemon.                        |
| `preview`      | `vite preview`                                           | Локально показывает production build frontend.        |

## База данных и production init

| Script              | Команда                                  | Назначение                                                                                  |
| ------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------- |
| `db:migrate`        | `node server/scripts/migrate.cjs up`     | Применяет миграции (node-pg-migrate up). Основной путь обновления схемы.                    |
| `db:migrate:down`   | `node server/scripts/migrate.cjs down`   | Откатывает последнюю миграцию (node-pg-migrate down).                                       |
| `db:migrate:create` | `node server/scripts/migrate.cjs create` | Создаёт новую пустую миграцию в server/migrations.                                          |
| `db:schema`         | `node server/scripts/applySchema.cjs`    | Legacy: применяет server/sql/schema.sql напрямую. Используй db:migrate для новых установок. |
| `db:seed`           | `node server/seed/seedDatabase.cjs`      | Заполняет базу демо-данными.                                                                |
| `db:reset`          | `node server/scripts/resetDatabase.cjs`  | Сбрасывает схему базы и создаёт её заново.                                                  |
| `db:check`          | `node server/scripts/checkDatabase.cjs`  | Проверяет состояние таблиц и подключения.                                                   |
| `prod:init`         | `npm run db:migrate`                     | Production init перед стартом контейнера: запускает миграции (db:migrate).                  |

## Сборка и UI

| Script            | Команда                                     | Назначение                               |
| ----------------- | ------------------------------------------- | ---------------------------------------- |
| `build`           | `vite build`                                | Собирает production frontend через Vite. |
| `storybook`       | `storybook dev -p 6006 --disable-telemetry` | Запускает Storybook в dev-режиме.        |
| `build-storybook` | `storybook build --disable-telemetry`       | Собирает статический Storybook.          |

## Документация

| Script          | Команда                                           | Назначение                                                         |
| --------------- | ------------------------------------------------- | ------------------------------------------------------------------ |
| `docs:dev`      | `vitepress dev docs`                              | Запускает VitePress docs-site локально.                            |
| `docs:generate` | `node scripts/docs/generateReference.cjs`         | Пересобирает generated reference-страницы документации.            |
| `docs:build`    | `vitepress build docs`                            | Собирает статический docs-site.                                    |
| `docs:preview`  | `vitepress preview docs`                          | Показывает локально собранный docs-site.                           |
| `docs:check`    | `node scripts/docs/generateReference.cjs --check` | Проверяет, что generated docs не устарели относительно исходников. |

## Прочее

| Script              | Команда                                                                                                                                                                        | Назначение                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `typecheck`         | `tsc --noEmit`                                                                                                                                                                 | Проверка TypeScript --noEmit. Запускается в pre-commit и CI.                                 |
| `test`              | `vitest run`                                                                                                                                                                   | Vitest run: unit-тесты фронта + supertest-интеграция бэка. NODE_ENV=test глушит pino и OTel. |
| `test:watch`        | `vitest`                                                                                                                                                                       | Vitest в режиме watch — на время локальной разработки.                                       |
| `test:ui`           | `vitest --ui`                                                                                                                                                                  | Vitest UI — браузерный runner с deep inspection падений.                                     |
| `test:storybook`    | `test-storybook`                                                                                                                                                               | Storybook play-тесты против запущенного Storybook (по умолчанию :6006).                      |
| `test:storybook:ci` | `concurrently -k -s first -n "sb,test" -c "magenta,blue" "http-server storybook-static --port 6006 --silent" "wait-on tcp:6006 && test-storybook --url http://127.0.0.1:6006"` | Сборка статического Storybook + http-server + test-storybook. Используется в CI.             |
| `test:e2e`          | `playwright test`                                                                                                                                                              | Playwright E2E против MSW мок-режима, Vite авто-стартует на :5173.                           |
| `test:e2e:ui`       | `playwright test --ui`                                                                                                                                                         | Playwright в interactive UI mode для отладки сценариев.                                      |
| `test:e2e:debug`    | `playwright test --debug`                                                                                                                                                      | Playwright в step-through дебаге (открывает inspector).                                      |
| `lint`              | `eslint .`                                                                                                                                                                     | ESLint по всему проекту. Включает react-hooks и jsx-a11y правила.                            |
| `lint:fix`          | `eslint . --fix`                                                                                                                                                               | ESLint с авто-фиксом исправимых правил.                                                      |
| `format`            | `prettier --write .`                                                                                                                                                           | Prettier --write по всему проекту.                                                           |
| `format:check`      | `prettier --check .`                                                                                                                                                           | Prettier --check без правок (CI guard).                                                      |
| `prepare`           | `husky`                                                                                                                                                                        | Пользовательский script проекта.                                                             |
