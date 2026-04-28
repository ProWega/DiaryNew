# Ubuntu + Docker deploy

Это канонический production-like путь для проекта: **сборка образа вне сервера -> push в Docker Hub -> на сервере только pull + up -d**.

## 1. Что нужно на сервере

- Ubuntu Server
- Docker Engine
- Docker Compose plugin
- доступ в Docker Hub
- открытые порты под reverse proxy / TLS
- каталог проекта, например `/opt/newdiary`

Проверки:

```bash
docker --version
docker compose version
sudo systemctl status docker
```

Если Docker daemon не запущен:

```bash
sudo systemctl start docker
sudo systemctl enable docker
```

## 2. Подготовка каталога

На сервере должны лежать:

- `docker-compose.yml`
- `.env.docker`

Пример:

```bash
mkdir -p /opt/newdiary
cd /opt/newdiary
```

Скопируйте `deploy/app.env.example` в `.env.docker` и заполните секреты:

```bash
cp deploy/app.env.example .env.docker
nano .env.docker
```

Критично проверить:

- `APP_IMAGE=prowega/newdiary:<точный-tag>`
- `APP_BASE_URL=https://ваш-домен`
- `AUTH_SESSION_SECRET=<сильный секрет>`
- `SETUP_TOKEN=<setup token>`
- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- `AUTH_COOKIE_SECURE=true`

Не используйте `latest` как единственный источник истины для production-релиза. В `.env.docker` лучше pin на точный tag образа.

## 3. Первый запуск

```bash
cd /opt/newdiary
sudo docker compose --env-file .env.docker pull
sudo docker compose --env-file .env.docker up -d
sudo docker compose --env-file .env.docker ps
sudo docker compose --env-file .env.docker logs -f app
```

Что происходит:

- `postgres` поднимается с persistent volume;
- `app` ждёт healthy PostgreSQL;
- `npm run prod:init` применяет схему;
- Express стартует на порту `4000`.

Health-check:

```bash
curl http://127.0.0.1:4000/api/health
```

Ожидаем:

- `ok: true`
- `postgresConfigured: true`
- `postgresOk: true`
- `dataMode: "postgres"`

## 4. Настройка домена и reverse proxy

Приложение внутри контейнера слушает `4000`, а внешний HTTPS должен терминироваться reverse proxy.

Минимальные требования:

- домен указывает на сервер;
- внешний `443` проксируется на `127.0.0.1:4000`;
- `APP_BASE_URL` совпадает с публичным доменом;
- secure-cookie включены.

Если reverse proxy не стартует из-за порта `80`, сначала проверьте, кто уже слушает этот порт:

```bash
sudo ss -ltnp | grep ':80'
```

## 5. Release/update

Локально или в CI соберите и запушьте новый образ в Docker Hub, например:

```bash
docker build -t prowega/newdiary:20260428-123456 -t prowega/newdiary:latest .
docker push prowega/newdiary:20260428-123456
docker push prowega/newdiary:latest
```

На сервере обновление выглядит так:

```bash
cd /opt/newdiary
sudo sed -i 's#^APP_IMAGE=.*#APP_IMAGE=prowega/newdiary:20260428-123456#' .env.docker
sudo docker compose --env-file .env.docker pull
sudo docker compose --env-file .env.docker up -d
sudo docker compose --env-file .env.docker logs -f app
```

После старта — обязательный smoke-check по ролям. См. [Smoke checklist](/qa/smoke-checklist).

## 6. Rollback

Rollback — это возврат `APP_IMAGE` на предыдущий tag:

```bash
cd /opt/newdiary
sudo sed -i 's#^APP_IMAGE=.*#APP_IMAGE=prowega/newdiary:20260427-221500#' .env.docker
sudo docker compose --env-file .env.docker pull
sudo docker compose --env-file .env.docker up -d
```

Никакого редактирования кода на сервере для rollback не требуется.

## 7. Backup и restore PostgreSQL

Backup:

```bash
cd /opt/newdiary
sudo docker compose --env-file .env.docker exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > backup.sql
```

Restore:

```bash
cd /opt/newdiary
cat backup.sql | sudo docker compose --env-file .env.docker exec -T postgres psql -U "$POSTGRES_USER" "$POSTGRES_DB"
```

Для production заведите внешний график резервного копирования, а не держите единственный backup на том же сервере.

## 8. Типовые сбои

### `unknown flag: --env-file`

Обычно это означает, что вы вызываете старый Docker CLI без Compose plugin. Проверьте:

```bash
docker compose version
```

### `Cannot connect to the Docker daemon`

Проверьте daemon:

```bash
sudo systemctl status docker
sudo systemctl start docker
```

### `postgres unavailable` или `dataMode: memory`

- проверьте env переменные PostgreSQL;
- проверьте health контейнера `postgres`;
- посмотрите `app` logs;
- при необходимости заново выполните:

```bash
sudo docker compose --env-file .env.docker exec app npm run db:schema
```

### Ошибки cookie / magic links

Проверьте:

- `APP_BASE_URL`
- `AUTH_COOKIE_SECURE`
- HTTPS на внешнем домене

### Ошибки по `state_scale_levels`

Если база поднялась без сидирования дефолтной шкалы, выполните:

```bash
sudo docker compose --env-file .env.docker exec app npm run db:schema
```

## 9. Post-deploy smoke

Минимум после выката:

1. `/api/health`
2. открывается публичный root
3. login/admin доступен
4. organizer видит workspace
5. participant diary загружается
6. curator dashboard загружается

Подробный чек-лист — в [QA smoke checklist](/qa/smoke-checklist).
