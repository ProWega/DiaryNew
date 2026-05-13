# Backend и сервисы

## Слои

```
HTTP request
    │
    ▼
server/index.cjs           ← middleware (helmet, cors, rate-limit, json, auth, CSRF)
    │
    ▼
server/routes/*.cjs        ← тонкие хендлеры: parse → call service → respond
    │
    ▼
server/services/*.cjs      ← бизнес-логика, оркестрация, валидация
    │
    ▼
server/db/repositories/*   ← SQL и нормализация результата
    │
    ▼
PostgreSQL
```

Принцип: route-handler не должен содержать ни SQL, ни бизнес-правил. Он парсит `req.params`/`req.body`, вызывает сервис, возвращает результат.

## Routes

| Файл              | Префикс            | Что внутри                                                                              |
| ----------------- | ------------------ | --------------------------------------------------------------------------------------- |
| `auth.cjs`        | `/api/auth`        | `me`, `logout`, magic-link create/consume                                               |
| `public.cjs`      | `/api`             | `setup/admin`, `health`, `users`, `public/events`, `participants/register`, `bootstrap` |
| `participant.cjs` | `/api/participant` | дневник участника + рефлексия                                                           |
| `curator.cjs`     | `/api/curator`     | dashboard куратора                                                                      |
| `organizer.cjs`   | `/api/organizer`   | сессии, программы, дни, события, опросы (~30 endpoint'ов)                               |
| `admin.cjs`       | `/api/admin`       | пользователи, назначения, сессии, audit log wiring                                      |

Каждый file экспортирует `Router`, `server/index.cjs` монтирует под нужным префиксом.

## Services

| Сервис                        | Назначение                                                                                                                                                               |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `auditLog.cjs`                | Запись событий админ-действий в `audit_log`. Non-blocking — ошибка записи логируется в pino, но не пробрасывается.                                                       |
| `magicLinkService.cjs`        | Авторизация и выпуск magic-link для логина/инвайта. Проверяет права viewer'а на `purpose=login` (только админ) и `purpose=invite` (админ или организатор сессии).        |
| `programFlowService.cjs`      | Параллельные потоки в дне (`flowOrder`, `flowMeta`), валидация расписания событий, нормализация `flow definitions`.                                                      |
| `programNormalizers.cjs`      | Нормализация патчей: события, программы, дня, настроек сессии. Slug helpers, дефолтные типы событий, `pickOrganizerSessionPayload`.                                      |
| `programWorkspaceService.cjs` | Lookup'ы (`findProgram`, `findDay`, `findEvent`), сортировка, full-sync workspace организатора (`syncWorkspace`, `ensureProgramWorkspaceDefaults`, `syncSummary`).       |
| `surveyAudienceService.cjs`   | Матчинг аудитории, нормализация фильтров, генерация audience summary для опросов.                                                                                        |
| `narrativeBriefService.cjs`   | Сбор brief для куратора: members + entries + events + concepts → `buildNarrativeBrief` + `enrichWithNarrative`. Вызывает guard.ensureBudget на force-path и recordUsage. |
| `narrativeBriefLLM.cjs`       | LLM-обогащение narrative. Двухуровневый кеш (in-memory 5 мин + `narrative_brief_cache`), fingerprint от signals, force-regenerate path, soft-fail.                       |
| `curatorChatService.cjs`      | Чат «Разговор с ИИ»: getOrCreateActiveThread / sendChatMessage / resetChatThread. Один активный thread на (curator, group), история в DB.                                |
| `curatorChatContext.cjs`      | Сборка preamble чата: system prompt + members + brief всех дней + extracted_text концепций. Cacheable blocks для prompt-cache.                                           |
| `curatorLlmGuard.cjs`         | LLM-бюджет per-curator-per-day: `ensureBudget` (throws 402 при превышении), `recordUsage`, `resolveModel` (sessions.llm_settings → model/maxTokens).                     |
| `llmClient.cjs`               | Унифицированный фасад LLM: `claude-*` → Anthropic SDK, `gpt-*`/`o3*`/`o4*` → OpenAI SDK. Прокси через единый `fetch` с undici dispatcher.                                |
| `llmSettings.cjs`             | Normalize / merge `sessions.llm_settings` JSONB. Дефолты, кламп значений, валидация моделей.                                                                             |
| `documentExtraction.cjs`      | Извлечение plain text из PDF (pdfjs-dist), DOCX (mammoth), TXT/MD. Лимит длины через `conceptExtractionLimit`.                                                           |

## Когда добавлять новый сервис

✅ **Да**:

- Логика выходит за пределы одного route-handler'а (multi-step, оркестрация репо).
- Бизнес-правило, которое надо переиспользовать (валидация переходов, расчёт аналитики).
- Обработка failure-mode которая не должна валить request (audit log, fire-and-forget).

❌ **Нет**:

- Один SQL-запрос → пиши прямо в `repositories/`.
- Простая трансформация request → response без правил → оставляй в роуте.

## Audit log

Таблица `audit_log` (см. `server/sql/schema.sql:338-347`):

```sql
id, actor_id, session_id, action, entity_type, entity_id, payload, created_at
```

Логируется в `server/routes/admin.cjs` после успешной мутации. Семантика — non-blocking:

```js
const result = await updateUser({ ... });
logAuditEvent({ actorId, action: "user.update", entityType: "user", entityId, payload: req.body });
res.json(result);
```

Если `logAuditEvent` упадёт (БД недоступна) — pino warn, response успешен. Это намеренно: audit-failure не должен блокировать operational path.

Текущий список `action`:

- `user.create`, `user.update`, `user.status_change`, `user.assignment`
- `session.create`, `session.update`, `session.registration_update`
- `methodology.journey_stage.update` — выбор этапа пути / careful_mode участником
- `program_event.concept.upload`, `program_event.concept.delete` — концепции мероприятий (Curator AI v2)

Расширение — по мере появления новых compliance-требований.

## Middleware-цепочка `/api`

В `server/index.cjs`:

1. `pinoHttp` — структурный лог запроса
2. `helmet` — security headers
3. `cors` (whitelist из `CORS_ALLOWED_ORIGINS`)
4. `express-rate-limit` на `/api/auth/*`
5. `express.json({ limit: "1mb" })`
6. **auth resolution** — читает session-cookie, ставит `req.authUser`
7. **`csrfGuard`** — Double Submit, см. [Безопасность](./security.md)
8. routers
9. SPA fallback (только GET)
10. error handler
