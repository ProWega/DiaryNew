# Маршруты и API верхнего уровня

Эта страница — curated inventory. Она не заменяет OpenAPI и не претендует на посимвольную спецификацию payload-ов.

## Web routes

| Маршрут                                      | Назначение                      |
| -------------------------------------------- | ------------------------------- |
| `/register`                                  | публичная регистрация участника |
| `/magic`                                     | вход по magic link              |
| `/setup/admin`                               | создание первого администратора |
| `/participant/session/:sessionId/today`      | дневник состояния участника     |
| `/participant/session/:sessionId/self`       | раздел самопознания             |
| `/participant/session/:sessionId/dynamics`   | динамика участника              |
| `/curator/session/:sessionId/group/:groupId` | кабинет куратора                |
| `/organizer/session/:sessionId`              | кабинет организатора            |
| `/admin/security`                            | админский кабинет               |

## API: public / auth

- `GET /api/health`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `POST /api/auth/magic-links`
- `POST /api/auth/magic-links/consume`
- `POST /api/setup/admin`
- `GET /api/public/events`
- `POST /api/participants/register`
- `GET /api/bootstrap`

Participant diary payload включает опубликованные дни и мероприятия программы. Для настроенной рефлексии:

- `day.reflectionQuestions: [{ id, text, required }]` — вопросы итогов дня;
- `event.reflectionQuestions: [{ id, text, required }]` — вопросы конкретного мероприятия;
- `event.reflectionAnswers` — ответы участника на вопросы мероприятия;
- `day.reflection.answers` — ответы участника на вопросы дня.

`PATCH /diary/:entryId` принимает обычные поля отметки (`stateId`, `comment`, `confidence`) и `reflectionAnswers`. Обязательные event-вопросы валидируются при финальном сохранении карточки. Быстрый автосейв выбора состояния может передавать служебный `allowIncompleteReflection: true`, чтобы сохранить шкалу до заполнения текстовых ответов.

`PATCH /reflections/:dayId` принимает legacy `q1`/`q2`/`q3` или `answers` для day-level вопросов. Если обязательный day-вопрос пустой, черновик сохраняется, но `responded_at` не выставляется и рефлексия не засчитывается в прогресс.

`POST /api/participant/sessions/:sessionId/parallel-selection` — выбор параллельного блока. Body: `{ dayId, slotKey, eventId }` где `slotKey` = `start_time` события («09:00»). UNIQUE на `(user, session, day, slot_key)` гарантирует один выбор на слот. Audit-event `participant.parallel_choice.changed` пишется только при изменении (не при первичном). См. [методологию §3](../architecture/methodology-mapping.md#§3-параллельные-блоки).

## API: curator

### Дашборд и записка

- `GET /api/curator/sessions/:sessionId/groups/:groupId/dashboard` — legacy dashboard (вкладка «Старый дашборд»)
- `GET /api/curator/sessions/:sessionId/groups/:groupId/brief` — narrative-brief дня (вкладка «Записка»). Query `?dayId=` для конкретного дня; без параметра — последний день.
- `GET /api/curator/sessions/:sessionId/groups/:groupId/days` — список дней с флагом `hasEntries` для day-picker'а
- `POST /api/curator/sessions/:sessionId/groups/:groupId/brief/regenerate` — форс-регенерация записки (обходит DB-кеш). Body: `{ dayId, model? }`. 201 при успехе.

### Чат «Разговор с ИИ»

- `GET /api/curator/sessions/:sessionId/groups/:groupId/chat/thread` — активный thread + история сообщений. 403 если `llm_settings.curatorChatEnabled = false`.
- `POST /api/curator/sessions/:sessionId/groups/:groupId/chat/messages` — отправить вопрос. Body: `{ text, model? }`. Возвращает `{ userMessage, assistantMessage, usage }`.
- `POST /api/curator/sessions/:sessionId/groups/:groupId/chat/reset` — архивировать текущий thread, создать пустой.

### Бюджет LLM

- `GET /api/curator/sessions/:sessionId/usage/me` — расход токенов куратора за сегодня + бюджет, разбивка по `kind` (brief/regen/chat).

Контекст ответа собирается в [server/services/curatorChatContext.cjs](https://github.com) → preamble: methodology system prompt + члены группы + brief всех дней (из `narrative_brief_cache.is_current`) + extracted_text всех концепций мероприятий сессии. Прогоняется через `applyToList(...,"curator")` для фильтрации анонимных / hidden-from-curator. Превышение бюджета → 402 `budget_exceeded`.

## API: admin

- `GET /api/admin/dashboard`
- `GET /api/admin/workspace`
- `POST /api/admin/users`
- `PATCH /api/admin/users/:userId`
- `PATCH /api/admin/users/:userId/status`
- `POST /api/admin/users/:userId/assignments`
- `PATCH /api/admin/users/:userId/assignments/:sessionId`
- `POST /api/admin/sessions`
- `PATCH /api/admin/sessions/:sessionId`
- `PATCH /api/admin/sessions/:sessionId/registration`

### AI agent prompts (admin)

- `GET /api/admin/agent-prompts` — список current версий всех агентов + `BLOCK_CATALOG` + `knownModels` (список моделей для select'ов в UI).
- `GET /api/admin/agent-prompts/:agentType` — current версия одного агента (`curator_chat`, `narrative_brief`, `program_analytics`, custom).
- `GET /api/admin/agent-prompts/:agentType/history?limit=50` — все версии (DESC).
- `POST /api/admin/agent-prompts/:agentType` — body `{ name, systemText, blocksConfig: [{key,enabled}], model?, maxTokens?, notes? }`. Создаёт новую версию (auto-bump `version`), помечает её `is_current`, инвалидирует кеш. Audit: `admin.agent_prompts.created`.
- `POST /api/admin/agent-prompts/restore/:versionId` — откат: создаёт новую версию на основе указанной. Audit: `admin.agent_prompts.restored`.
- `POST /api/admin/agent-prompts/:agentType/preview` — body `{ systemText, blocksConfig?, model?, maxTokens?, sessionId?, groupId?, userQuestion?, previewOnly? }`. Прогоняет LLM с draft'ом, **не сохраняет**. Для `curator_chat` собирает реальный preamble (members/feedback/concepts) из sessionId+groupId. С `previewOnly: true` возвращает только собранный preamble без вызова LLM. Audit: `admin.agent_prompts.preview`. Response: `{ preamble, output, usage, durationMs, model, previewOnly, error? }`.

Подробнее в [docs/architecture/backend-services.md](../architecture/backend-services.md), раздел «Настройка ИИ-агентов».

### AI reports (admin)

- `POST /api/admin/ai-reports/program-analytics/generate` — body `{ sessionId, model?, maxTokens?, title? }`. Запускает `programAnalyticsService.generateReport`: собирает preamble (sessionMeta + programDays + aggregatedFeedback + eventConcepts), прогоняет LLM с current `program_analytics` промптом, сохраняет в `ai_reports.scope = "program-analytics"`. Audit: `admin.ai_report.generated`.
- `GET /api/admin/ai-reports?sessionId=...&scope=program-analytics&limit=50` — список отчётов.
- `GET /api/admin/ai-reports/:reportId` — просмотр отчёта.

## API: organizer

### Workspace и аналитика

- `GET /api/organizer/workspace`
- `POST /api/organizer/sessions`
- `PATCH /api/organizer/sessions/:sessionId`
- `PATCH /api/organizer/sessions/:sessionId/registration`
- `PATCH /api/organizer/sessions/:sessionId/settings`
- `GET /api/organizer/sessions/:sessionId/workspace`
- `GET /api/organizer/sessions/:sessionId/analytics`

### Groups

- `POST /api/organizer/sessions/:sessionId/groups`
- `PATCH /api/organizer/sessions/:sessionId/groups/:groupId`
- `DELETE /api/organizer/sessions/:sessionId/groups/:groupId`
- `PATCH /api/organizer/sessions/:sessionId/groups/:groupId/curator`
- `POST /api/organizer/sessions/:sessionId/groups/:groupId/participants`

### Programs, days, events

- `POST /api/organizer/sessions/:sessionId/programs`
- `PATCH /api/organizer/sessions/:sessionId/programs/:programId`
- `POST /api/organizer/sessions/:sessionId/programs/:programId/publish`
- `POST /api/organizer/sessions/:sessionId/programs/:programId/draft`
- `POST /api/organizer/sessions/:sessionId/programs/:programId/select`
- `POST /api/organizer/sessions/:sessionId/programs/:programId/days`
- `PATCH /api/organizer/sessions/:sessionId/programs/:programId/days/:dayId`
- `DELETE /api/organizer/sessions/:sessionId/programs/:programId/days/:dayId`
- `PATCH /api/organizer/sessions/:sessionId/programs/:programId/days/:dayId/flows`
- `PATCH /api/organizer/sessions/:sessionId/programs/:programId/days/:dayId/flow-order`
- `PATCH /api/organizer/sessions/:sessionId/programs/:programId/days/:dayId/events/:eventId`
- `POST /api/organizer/sessions/:sessionId/programs/:programId/days/:dayId/events/parallel`
- `DELETE /api/organizer/sessions/:sessionId/programs/:programId/days/:dayId/events/:eventId`
- `POST /api/organizer/sessions/:sessionId/programs/:programId/days/:dayId/events/:eventId/activate`
- `POST /api/organizer/sessions/:sessionId/programs/import-preview` — multipart `file` + form fields `mode` (`heuristic`/`llm`), `model?`, `stopWords?` (JSON-массив), `sheetName?`. Возвращает `{ draft, fileName }` где `draft` содержит `days[]`, `availableSheets`, `selectedSheet`, `stats`, `warnings`. Не пишет в БД.
- `POST /api/organizer/sessions/:sessionId/programs/import-commit` — body `{ draft, fileName?, mode?, model?, conflictResolution }`. Сохраняет draft как program (status=`draft`) в workspace. Audit: `organizer.program.imported.commit`.

### Bulk invites

- `GET /api/organizer/sessions/:sessionId/invites/template.xlsx` — пустой xlsx-шаблон (3 колонки: Группа / Куратор / Участник).
- `POST /api/organizer/sessions/:sessionId/invites/preview` — multipart `file` (xlsx). Возвращает `{ groups, warnings, stats, fileName }`. Не пишет в БД.
- `POST /api/organizer/sessions/:sessionId/invites/generate` — multipart `file` (xlsx) + optional `letterhead` (PDF/PNG/JPEG) + form fields `{ layout: "card"|"table", title?, footer?, ttlMinutes? }`. Создаёт magic-link'и в `auth_magic_links` (auto-create отсутствующих групп) и возвращает PDF (`application/pdf`, 201). Audit: `organizer.invite.batch.generated`. Response headers: `X-Invites-Created`, `X-Invites-Groups`.

Program day и event payload поддерживают `reflectionQuestions: [{ id, text, required }]`.

- Для дней вопросы сохраняются в `program_days.reflection_prompts` и отображаются в participant-блоке «Итог дня».
- Для мероприятий вопросы сохраняются в `program_events.meta.reflectionQuestions` и отображаются внутри карточки события.
- Если список вопросов мероприятия пустой, participant view показывает старое поле комментария.

### Surveys

- `POST /api/organizer/sessions/:sessionId/surveys`
- `PATCH /api/organizer/sessions/:sessionId/surveys/:surveyId`
- `POST /api/organizer/sessions/:sessionId/surveys/:surveyId/questions`
- `PATCH /api/organizer/sessions/:sessionId/surveys/:surveyId/questions/:questionId`
- `POST /api/organizer/sessions/:sessionId/surveys/:surveyId/publish`

### Event concepts (Curator AI v2)

PDF/DOCX/TXT/MD-концепции мероприятий. Текст извлекается на сервере (pdfjs / mammoth) и идёт в контекст LLM при генерации narrative-brief и в chat «Разговор с ИИ».

- `POST /api/organizer/sessions/:sessionId/events/:eventId/concepts` (multipart/form-data, поле `file`) → 201 `{id, sourceFilename, downloadUrl, extractedChars, truncated, …}`
- `GET /api/organizer/sessions/:sessionId/events/:eventId/concepts` → список
- `DELETE /api/organizer/sessions/:sessionId/events/:eventId/concepts/:conceptId`

Лимит файла 10 МБ, лимит извлечённого текста — `llm_settings.conceptExtractionLimit` (default 12000 chars).

### LLM-настройки сессии

Сохраняются вместе с другими настройками через PATCH `/api/organizer/sessions/:sessionId/settings`. Поле `llm`:

```ts
{
  defaultModel: "claude-haiku-4-5" | "claude-sonnet-4-5" | "claude-opus-4-7"
              | "gpt-5-mini" | "gpt-5" | "gpt-4o-mini" | "gpt-4o",
  allowedModels: string[],
  maxTokensPerCall: number,         // 64..8000
  curatorDailyTokenBudget: number,  // 0 = безлимит
  curatorChatEnabled: boolean,
  conceptExtractionLimit: number    // 1000..50000
}
```

Хранится в колонке `sessions.llm_settings jsonb` (отдельно от `sessions.settings`). UI — карточка «ИИ-помощник куратора» в SessionsTab кабинета организатора.

### Usage report

- `GET /api/organizer/sessions/:sessionId/usage` → агрегат расхода токенов за сегодня по всем кураторам сессии (для оценки расхода организатором).

## Что не делаем в первом шаге

- не генерируем OpenAPI автоматически из `server/index.cjs`;
- не документируем каждый request/response schema как контракт-генерацию;
- не обещаем стабильный public API вне текущего внутреннего продукта.
