# Безопасность

Слои защиты — в порядке прохождения запроса.

## 1. Helmet

`server/index.cjs:44`:

```js
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
```

Стандартные security-заголовки (X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security в production за TLS-прокси и т.д.).

CSP временно отключён: SPA использует inline-стили и server-injected runtime-значения. Конфигурация CSP — отдельный PR (Phase 4).

## 2. CORS whitelist

`server/index.cjs:46-72`. Origin'ы читаются из `CORS_ALLOWED_ORIGINS` (через запятую). В dev — fallback на `localhost:5173`/`127.0.0.1:5173`. В production пустой список = все cross-origin запросы режутся, при пустом списке pino пишет warn на старте.

```bash
# .env.production
CORS_ALLOWED_ORIGINS=https://newdiary.example.com,https://www.newdiary.example.com
```

Запросы без `Origin` (curl, server-to-server) пропускаются.

## 3. Rate limiting

`server/index.cjs:74-84` — `express-rate-limit` на префикс `/api/auth/*`:

```
window: AUTH_RATE_LIMIT_WINDOW_MIN (default 15 минут)
max:    AUTH_RATE_LIMIT_MAX (default 50 запросов в окно на IP)
```

Покрывает попытки брутфорса magic-link consume и создания magic-link. Не применяется к остальным endpoint'ам (для них достаточно auth + CSRF).

## 4. Auth

Сессии живут как HMAC-хешированные токены в таблице `auth_sessions`. Cookie `newdiary_session` — `HttpOnly`, `SameSite=Lax`, `Secure` в prod. TTL по умолчанию 14 дней (`AUTH_SESSION_TTL_DAYS`).

Magic links — таблица `auth_magic_links`. TTL — `MAGIC_LINK_TTL_MINUTES` (default 60 минут). Создание magic-link для логина — только админ; для invite — админ или организатор сессии. Логика — в `server/services/magicLinkService.cjs`.

Первый администратор создаётся через `POST /api/setup/admin` с `SETUP_TOKEN`. Endpoint доступен только пока БД пустая.

## 5. CSRF: Double Submit Cookie

`server/lib/csrf.cjs` + `csrfGuard` middleware в `server/index.cjs`.

### Принцип

При логине сервер ставит **две** cookie:

- `newdiary_session` — `HttpOnly` (JS не читает) — токен сессии;
- `newdiary_csrf` — НЕ `HttpOnly` (читаемая JS) — случайные 32 байта hex.

Клиент при каждом mutating-запросе:

- Читает `newdiary_csrf` через `getCsrfToken()` из `src/lib/csrfToken.ts`;
- Кладёт значение в заголовок `X-CSRF-Token`. Этот шаг централизован в `requestJson()` (`src/api/jsonApi.ts`) — все методы клиента (`POST`/`PATCH`/`DELETE`) автоматически получают заголовок.

Сервер на любом `POST`/`PATCH`/`DELETE`:

- Сравнивает cookie и заголовок;
- Mismatch (или пусто) → `403 CSRF token mismatch`.

### Почему работает

Атакующий со стороннего домена **не может** прочитать cookie твоего домена (Same-Origin Policy) → не может выставить заголовок. Браузер при cross-site запросе автоматически прицепит cookie, но не поставит заголовок — токены не совпадут, сервер отбросит.

Это **второй слой** поверх `SameSite=Lax`: если SameSite где-то перестанет работать (старый браузер, скомпрометированный subdomain) — CSRF guard всё равно остановит атаку.

### Allow-list

Три endpoint'а пропускают CSRF guard, потому что они САМИ устанавливают cookie:

- `POST /api/auth/magic-links/consume` — magic-link логин (защищён rate-limit);
- `POST /api/setup/admin` — первый админ (защищён `SETUP_TOKEN`);
- `POST /api/participants/register` — публичная регистрация (защищена rate-limit + zod).

Все три после успешного выполнения вызывают `setAuthCookie` + `setCsrfCookie`. Cookie приходят в Set-Cookie заголовке, браузер сохраняет, дальше клиент работает как обычно.

### Logout

`POST /api/auth/logout` дополнительно вызывает `clearCsrfCookie(res)`, чтобы не оставлять «мёртвый» CSRF-токен в браузере после выхода.

### Что НЕ сделано (осознанно)

- **Signed Double Submit (HMAC к session-id)** — текущая plain-версия достаточна для прототипа. Усиление — отдельный пункт production-hardening.
- **Token rotation на каждый запрос** — фиксированный токен на сессию проще и достаточен.

## 6. Валидация входов: zod

Все mutating endpoint'ы оборачиваются `validateBody(schema)` из `server/validation/middleware.cjs`. Схемы — в `server/validation/`:

- `schemas.cjs` — общие (auth, admin users, participant diary)
- `organizerSchemas.cjs` — организатор (sessions, programs, days, events, surveys)

При невалидном теле → `400` с zod error message.

Покрытие на сейчас:

- Auth, admin, participant, public — 100%;
- Organizer — 21 из 31 (10 без body — `GET`/`DELETE`/params-only `POST`).

## 7. Audit log

См. [Backend и сервисы → Audit log](./backend-services.md#audit-log).

## 8. Логирование

`pino` + `pino-http` — структурный JSON-лог запросов. Лог-уровень настраивается через `LOG_LEVEL` (default `info`). В production — JSON в stdout, агрегатор должен вытаскивать.

В коде:

```js
req.log.info({ userId }, "magic link issued");
req.log.warn({ origin }, "CORS request rejected");
req.log.error({ err }, "Unhandled error");
```
