# newdiary — server-bundle

Минимальный набор файлов для развёртывания на одной VM:
docker-compose поднимает **app** (Express + статика SPA) + **postgres**

- **caddy** (reverse-proxy с автоматическим Let's Encrypt). Образ `app`
  тянется из Docker Hub — никакой сборки на VM не требуется.

## Что внутри

- `docker-compose.yml` — три сервиса (app, postgres, caddy)
- `Caddyfile` — TLS + reverse-proxy
- `.env.example` — шаблон секретов (скопировать в `.env`)

## Развёртывание с нуля

### 1. Подготовить VM

```bash
# Ubuntu 22.04+, минимум 1 vCPU / 2 GB RAM / 20 GB SSD
sudo apt-get update && sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list
sudo apt-get update && sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker $USER  # перелогиньтесь после этого
```

Проверьте: `docker version` и `docker compose version` отвечают.

### 2. Скопировать bundle на VM

```bash
ssh user@your-vm
mkdir -p ~/newdiary && cd ~/newdiary
# скопируйте сюда docker-compose.yml, Caddyfile, .env.example
```

Удобнее всего — `scp deploy/server-bundle/* user@your-vm:~/newdiary/`
с локальной машины.

### 3. Настроить .env и Caddyfile

```bash
cp .env.example .env
nano .env
# впишите APP_BASE_URL=https://ваш-домен
# сгенерируйте секреты (см. комментарии в .env.example)

nano Caddyfile
# замените example.com на ваш реальный домен
```

### 4. Указать DNS

A-запись `ваш-домен` → IP вашей VM. Дождитесь распространения
(обычно 1-15 минут). Caddy при первом старте сам получит сертификат
от Let's Encrypt — только после того, как DNS уже резолвится.

### 5. Запустить

```bash
docker compose pull           # тянет prowega/newdiary:latest и postgres:16
docker compose up -d          # стартует все три сервиса
docker compose ps             # должно быть "Up"; postgres "(healthy)"
docker compose logs -f app    # смотреть логи бэка
docker compose logs -f caddy  # смотреть как Caddy получает сертификат
```

Миграции БД выполняются автоматически при старте app (`npm run prod:init`
в CMD Dockerfile'а — это `npm run db:migrate`).

### 6. Создать первого администратора

```bash
curl -X POST https://ваш-домен/api/setup/admin \
  -H 'Content-Type: application/json' \
  -d '{
    "setupToken": "значение_SETUP_TOKEN_из_env",
    "fullName": "Имя Фамилия",
    "email": "admin@example.com"
  }'
```

После успешного ответа можно (и нужно) обнулить `SETUP_TOKEN=` в `.env`
и сделать `docker compose up -d` для применения.

## Обновление до новой версии

### Через `:latest`

```bash
docker compose pull app
docker compose up -d app
```

### Через pinned git-sha (рекомендуется для prod)

```bash
nano .env  # обновите APP_IMAGE=prowega/newdiary:<новый-sha>
docker compose pull app
docker compose up -d app
```

Откат — обратно поменять APP_IMAGE на предыдущий sha, повторить `pull` + `up -d`.

## Бэкап Postgres

```bash
docker compose exec -T postgres pg_dump -U $POSTGRES_USER $POSTGRES_DB \
  | gzip > backup-$(date +%Y%m%d-%H%M).sql.gz
```

Поставьте в cron (раз в день, хранить 7 дней).

## Restore

```bash
gunzip -c backup-20260508-0300.sql.gz \
  | docker compose exec -T postgres psql -U $POSTGRES_USER $POSTGRES_DB
```

## Troubleshooting

| Симптом                                                                    | Причина / что делать                                                                                        |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `docker compose up` падает на постгресе с "password authentication failed" | Postgres volume сохранил старые credentials. Если БД пустая — `docker compose down -v` (⚠ удалит данные)    |
| Caddy не получает сертификат                                               | Проверьте что A-запись DNS резолвится в IP VM, и что 80/443 открыты в файрволе/security group VM            |
| 503 от Caddy на app                                                        | `docker compose logs app` — скорее всего падает миграция (Postgres не успел подняться или env не выставлен) |
| 403 CSRF token mismatch на PATCH/POST                                      | Сделайте hard-refresh страницы — `/api/auth/me` ротирует CSRF cookie                                        |
