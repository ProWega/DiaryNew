# Переменные окружения

> Этот файл собирается командой `npm run docs:generate`. Правьте `.env.example`, `deploy/app.env.example` или генератор в `scripts/docs/generateReference.cjs`.

## Локальная разработка

Источник: `.env.example`

| Переменная                   | Пример / default            | Назначение                                                                                                                        |
| ---------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`                       | `4000`                      | Порт локального backend-сервера.                                                                                                  |
| `HOST`                       | `0.0.0.0`                   | Интерфейс, на котором слушает Express.                                                                                            |
| `APP_MODE`                   | `development`               | Режим приложения: development или production.                                                                                     |
| `APP_BASE_URL`               | `http://localhost:5173`     | Публичный базовый URL, по которому собираются magic links и cookie-политика.                                                      |
| `CORS_ALLOWED_ORIGINS`       | -                           | Whitelist origin'ов для CORS. Через запятую. Пусто в prod = все cross-origin запросы режутся.                                     |
| `AUTH_RATE_LIMIT_WINDOW_MIN` | `15`                        | Окно rate-limit на /api/auth/\* в минутах.                                                                                        |
| `AUTH_RATE_LIMIT_MAX`        | `50`                        | Лимит запросов на /api/auth/\* в окне.                                                                                            |
| `LOG_LEVEL`                  | -                           | Уровень pino логов: trace \| debug \| info \| warn \| error \| fatal \| silent. Default: debug в dev, info в prod, silent в test. |
| `AUTH_SESSION_SECRET`        | `change-me-in-production`   | Секрет для подписи auth session и magic link token hash.                                                                          |
| `AUTH_SESSION_TTL_DAYS`      | `14`                        | Срок жизни cookie-сессии в днях.                                                                                                  |
| `AUTH_COOKIE_NAME`           | `newdiary_session`          | Имя auth-cookie.                                                                                                                  |
| `AUTH_COOKIE_SECURE`         | `false`                     | Флаг secure-cookie. Для production должен быть true под HTTPS.                                                                    |
| `AUTH_COOKIE_SAMESITE`       | `lax`                       | Политика SameSite для auth-cookie.                                                                                                |
| `SETUP_TOKEN`                | `change-me-for-first-admin` | Токен для первого администратора на /setup/admin.                                                                                 |
| `MAGIC_LINK_TTL_MINUTES`     | `60`                        | Срок жизни magic link в минутах.                                                                                                  |
| `ALLOW_DEMO_SEED`            | `false`                     | Разрешение на seed демо-данных. В production должен оставаться false.                                                             |
| `PGHOST`                     | `localhost`                 | Хост PostgreSQL.                                                                                                                  |
| `PGPORT`                     | `5432`                      | Порт PostgreSQL.                                                                                                                  |
| `PGDATABASE`                 | `newdiary`                  | Имя базы PostgreSQL.                                                                                                              |
| `PGUSER`                     | `postgres`                  | Пользователь PostgreSQL.                                                                                                          |
| `PGPASSWORD`                 | `postgres`                  | Пароль пользователя PostgreSQL.                                                                                                   |
| `PGSSL`                      | `false`                     | Использовать ли SSL при подключении к PostgreSQL.                                                                                 |

## Ubuntu / Docker deploy

Источник: `deploy/app.env.example`

| Переменная               | Пример / default                             | Назначение                                                                                |
| ------------------------ | -------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `APP_IMAGE`              | `prowega/newdiary:latest`                    | Docker image, который будет pulled на сервере. Для релизов рекомендуем pin на точный tag. |
| `APP_PORT`               | `4000`                                       | Внешний порт сервиса app на сервере.                                                      |
| `APP_BASE_URL`           | `https://example.com`                        | Публичный базовый URL, по которому собираются magic links и cookie-политика.              |
| `POSTGRES_DB`            | `newdiary`                                   | Имя production-базы внутри docker compose.                                                |
| `POSTGRES_USER`          | `newdiary`                                   | Пользователь production-базы внутри docker compose.                                       |
| `POSTGRES_PASSWORD`      | `replace-with-strong-db-password`            | Пароль production-базы внутри docker compose.                                             |
| `AUTH_SESSION_SECRET`    | `replace-with-at-least-32-random-characters` | Секрет для подписи auth session и magic link token hash.                                  |
| `AUTH_SESSION_TTL_DAYS`  | `14`                                         | Срок жизни cookie-сессии в днях.                                                          |
| `AUTH_COOKIE_NAME`       | `newdiary_session`                           | Имя auth-cookie.                                                                          |
| `AUTH_COOKIE_SECURE`     | `true`                                       | Флаг secure-cookie. Для production должен быть true под HTTPS.                            |
| `AUTH_COOKIE_SAMESITE`   | `lax`                                        | Политика SameSite для auth-cookie.                                                        |
| `SETUP_TOKEN`            | `replace-with-first-admin-setup-token`       | Токен для первого администратора на /setup/admin.                                         |
| `MAGIC_LINK_TTL_MINUTES` | `60`                                         | Срок жизни magic link в минутах.                                                          |
| `ALLOW_DEMO_SEED`        | `false`                                      | Разрешение на seed демо-данных. В production должен оставаться false.                     |
