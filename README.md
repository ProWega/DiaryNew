# NewDiary

NewDiary — платформа для сопровождения заезда по четырём ролям: участник, куратор, организатор и администратор. Проект уже работает как production-like веб-прототип на React + Express + PostgreSQL, с Docker-контуром для Ubuntu и отдельным docs-site для эксплуатации, QA и рабочих процессов команды.

## Что реально работает сейчас

- role-based маршруты и RBAC для `participant`, `curator`, `organizer`, `admin`;
- публичная регистрация участников через `/register`;
- auth-контур: cookie sessions, magic links, setup первого администратора, **Double Submit Cookie CSRF**;
- organizer workspace с заездами, регистрацией, программой, днями, событиями, настраиваемыми вопросами рефлексии, группами и аналитическими блоками;
- mobile-first participant diary с выбором дня, оценкой состояния, вопросами/комментарием по событиям и дневной рефлексией;
- curator routed-dashboard `Пульс дня` на реальных PostgreSQL/API-агрегатах;
- admin-контур для пользователей, назначений и базовой security-операционки;
- backend-структура: тонкие роуты в `server/routes/`, бизнес-логика в `server/services/`, SQL в `server/db/repositories/`, zod-валидация в `server/validation/`;
- audit log для админ-действий (`audit_log`) — non-blocking, через `server/services/auditLog.cjs`;
- инкрементальный TypeScript для библиотек и API-слоя; React Query + MSW для клиента;
- тёмная тема + CSS-токены + раздельные style-модули (`src/styles/*`);
- миграции БД через `node-pg-migrate` (`server/migrations/`);
- многоуровневые тесты: Vitest (unit + supertest), Storybook play-тесты, Playwright E2E против MSW;
- ErrorBoundary на корне + opt-in observability (OpenTelemetry на бэке, Sentry на фронте);
- Storybook для UI-состояний и VitePress docs-site для процессов и runbooks.

## Куда смотреть дальше

- [Документация проекта](docs/index.md)
- [TODO / roadmap](TODO.md)
- [Архитектура: обзор](docs/architecture/overview.md)
- [Backend и сервисы](docs/architecture/backend-services.md)
- [Frontend stack](docs/architecture/frontend-stack.md)
- [Миграции БД](docs/architecture/migrations.md)
- [Безопасность](docs/architecture/security.md)
- [Тестирование](docs/architecture/testing.md)
- [Ubuntu + Docker deploy](docs/deploy/ubuntu-docker.md)
- [QA Playbook](docs/qa/playbook.md)
- [Маршруты и API верхнего уровня](docs/reference/routes-and-api.md)
- [Storybook workflow](docs/architecture/documentation-workflow.md)

## Быстрый старт для разработки

```bash
npm install
cp .env.example .env
npm run db:migrate
npm run dev
```

По умолчанию:

- frontend: `http://localhost:5173`
- backend: `http://localhost:4000`

Если нужны демо-данные:

```bash
npm run db:seed
```

Полный локальный setup — в [docs/getting-started/local-setup.md](docs/getting-started/local-setup.md).

## Полезные команды

```bash
npm run build              # production-сборка фронта
npm run build-storybook    # Storybook
npm run typecheck          # TypeScript --noEmit
npm run lint               # ESLint
npm run db:migrate         # применить миграции (node-pg-migrate up)
npm run db:migrate:down    # откатить последнюю миграцию
npm run db:migrate:create  # создать новую миграцию
npm run db:seed            # сидирование демо-данных
npm test                   # Vitest: unit + integration (supertest)
npm run test:storybook:ci  # Storybook play-тесты (Playwright + http-server)
npm run test:e2e           # Playwright E2E против MSW мок-режима
npm run docs:check         # CI-guard для generated reference
npm run docs:build         # production-сборка VitePress
```

Для frontend-only режима без бэкенда работает MSW мок-слой:

```bash
VITE_USE_MOCK=true npm run dev:client
```

Полный список scripts собирается автоматически в [docs/reference/scripts.md](docs/reference/scripts.md).

## Канонический production deploy

Основной путь для сервера: **собрать образ вне сервера -> запушить в Docker Hub -> на Ubuntu сделать `pull` и `up -d`**.

Короткая последовательность:

```bash
docker build -t prowega/newdiary:<tag> -t prowega/newdiary:latest .
docker push prowega/newdiary:<tag>
docker push prowega/newdiary:latest
```

На сервере:

```bash
cd /opt/newdiary
sudo sed -i 's#^APP_IMAGE=.*#APP_IMAGE=prowega/newdiary:<tag>#' .env.docker
sudo docker compose --env-file .env.docker pull
sudo docker compose --env-file .env.docker up -d
sudo docker compose --env-file .env.docker logs -f app
curl http://127.0.0.1:4000/api/health
```

Подробный runbook, первый запуск, rollback, backup и troubleshooting — в [docs/deploy/ubuntu-docker.md](docs/deploy/ubuntu-docker.md).

## Production readiness сейчас

Проект уже годится для controlled rollout и рабочих тестовых заездов, но требует дисциплины вокруг:

- smoke после каждого server deploy;
- точечных Docker tags вместо безусловного `latest`;
- reverse proxy / TLS и корректного `APP_BASE_URL`;
- регулярного backup PostgreSQL;
- обновления docs и QA-чеклистов вместе с изменениями поведения.

## Как устроена документация

- `README.md` — короткий вход в проект;
- `TODO.md` — статус и ближайший roadmap;
- `docs/` — подробные инструкции по запуску, деплою, QA, доступам и архитектуре;
- generated reference-страницы собираются командой `npm run docs:generate`;
- CI валидирует `build`, `build-storybook`, `docs:check` и `docs:build`.

Подробнее — в [docs/architecture/documentation-workflow.md](docs/architecture/documentation-workflow.md).
