# NewDiary

NewDiary — платформа для сопровождения заезда по четырём ролям: участник, куратор, организатор и администратор. Проект уже работает как production-like веб-прототип на React + Express + PostgreSQL, с Docker-контуром для Ubuntu и отдельным docs-site для эксплуатации, QA и рабочих процессов команды.

## Что реально работает сейчас

- role-based маршруты и RBAC для `participant`, `curator`, `organizer`, `admin`;
- публичная регистрация участников через `/register`;
- auth-контур: cookie sessions, magic links, setup первого администратора;
- organizer workspace с заездами, регистрацией, программой, днями, событиями, настраиваемыми вопросами рефлексии, группами и аналитическими блоками;
- mobile-first participant diary с выбором дня, оценкой состояния, вопросами/комментарием по событиям и дневной рефлексией;
- curator routed-dashboard `Пульс дня` на реальных PostgreSQL/API-агрегатах;
- admin-контур для пользователей, назначений и базовой security-операционки;
- Storybook для UI-состояний и VitePress docs-site для процессов и runbooks.

## Куда смотреть дальше

- [Документация проекта](docs/index.md)
- [TODO / roadmap](TODO.md)
- [Ubuntu + Docker deploy](docs/deploy/ubuntu-docker.md)
- [QA Playbook](docs/qa/playbook.md)
- [Маршруты и API верхнего уровня](docs/reference/routes-and-api.md)
- [Storybook workflow](docs/architecture/documentation-workflow.md)

## Быстрый старт для разработки

```bash
npm install
cp .env.example .env
npm run db:schema
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
npm run build
npm run build-storybook
npm run docs:check
npm run docs:build
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
