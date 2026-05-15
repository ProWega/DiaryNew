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

## Импорт программы из Excel

Организатор может загрузить .xlsx-файл с расписанием заезда и получить автоматически собранный черновик программы. Файлы реальных заездов обычно содержат лист «Программа» (плюс варианты: «!!!!Программа», «Программа (копия)»), где первая колонка — время `"08:00 - 13:30"`, вторая — описание мероприятия в одну multiline-ячейку (заголовок + спикеры в CAPS LOCK).

### Pipeline

```
xlsx (multipart) → extractRowsFromXlsx (SheetJS)
                 → pickProgramSheets (выбирает один лист; можно override через sheetName)
                 → parseHeuristic | parseWithLlm
                 → DraftProgram { days[], events[], warnings, stats, availableSheets, selectedSheet }
                 → POST /import-preview (просмотр + правки в UI)
                 → POST /import-commit
                 → workspace.programWorkspace.programs[0] (status=draft)
```

Сервис: [`server/services/programExcelImporter.cjs`](../../server/services/programExcelImporter.cjs). Чистые функции (`parseTimeRange`, `parseRussianDate`, `matchStopWord`, `applyEventTypeMapping`, `extractTitle`, `parseHeuristic`) покрыты unit-тестами через программно-собранные xlsx-fixtures (без реальных файлов в репо).

### Структура строки в эвристике

`inspectRow` строго требует время в **первой** непустой ячейке. Это критично — иначе случайные «14:00» в описании события («сбор в 14:00 о памяти…») затирали бы реальное время из соседней колонки. Если первая ячейка не матчится регексом времени:

- содержит дату («4 ИЮНЯ») → строка-заголовок дня;
- иначе → пропускается (шапка, мусор).

### Параллельные мероприятия (колонки B/C/D/E…)

В стандартных шаблонах организаторов параллельные события на один временной слот стоят в **разных столбцах одной строки времени**:

```
A: 11:30-13:30 | B: «Подготовка к закрытию» | E: «Мастер-класс по финно-угорским»
```

Парсер генерирует **отдельный event на каждую непустую ячейку** после столбца времени. Параллельный поток (`program_events.parallel_group`) присваивается по логическому индексу колонки: первая непустая → `A`, вторая → `B`, и т.д. Если в строке только одна непустая колонка — `parallelGroup: "A"` (обычное событие).

В UI участника эти события автоматически становятся параллельным слотом ([методология §3](./methodology-mapping.md#§3-параллельные-блоки)): участник видит picker и явно выбирает один из блоков. Куратор-аналитика учитывает разделение в `completion`.

### Picker листов

`extractRowsFromXlsx` отдаёт все листы файла. `listProgramSheetCandidates` возвращает имена листов, в названии которых есть «программ» (за вычетом «спикеры», «бриф», «не брать»). В файле «Истоки 2026 9-13 июня» это `!!!Программа` (детальная) и `Программа (для бейджей)` (сокращённая). `pickProgramSheets` выбирает дефолтный лист по эвристике (приоритет — короткое имя без префикса `!`).

В ответе preview-эндпоинта поля:

- `availableSheets: string[]` — все кандидаты, для UI-dropdown'а;
- `selectedSheet: string` — какой использовался.

Если у файла >1 кандидата — UI показывает `<select>` «Лист с расписанием», и при смене делает повторный preview с параметром `sheetName`.

### Режимы

| Режим                 | Когда                                                                                                                                                     |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `heuristic` (default) | Стандартные xlsx-шаблоны заездов «Истоков». Бесплатно, мгновенно. Парсит time-regex, ловит дни по дат-заголовкам, маппит тип через `EVENT_TYPE_KEYWORDS`. |
| `llm`                 | Нестандартный формат / эвристика выдала `low_confidence` warning. Сериализует таблицу как text/`№ строки                                                  | ячейки`, отдаёт в `callLlm` ([llmClient.cjs](../../server/services/llmClient.cjs)) с строгим JSON-промптом. При невалидном JSON — soft-fallback на эвристику + warning «llm_failed». |

### Стоп-слова

`DEFAULT_STOP_WORDS` в коде сервиса: завтрак/обед/ужин/перерыв/трансфер/заселение/отбой/зарядка/итоги дня/подготовка ко сну и т.д. Организатор видит их CSV-полем в модалке импорта и может править перед анализом. Применяются и в эвристическом, и в LLM-режиме (LLM получает список в system prompt).

### Mapping типов событий

`EVENT_TYPE_KEYWORDS` (массив `[type, keywords[]]`) — substring match по lowercased title:

- «торжеств / церемония / открыти / закрыти» → **Торжественное мероприятие**
- «панель / дискусс / круглый стол» → **Панельная дискуссия**
- «мастер-класс / практикум / семинар» → **Мастер-класс**
- «экскурсия / погружение / посещение» → **Экскурсия**
- «работа в группах» → **Групповая работа**
- «рефлексия / разбор дня» → **Рефлексия**
- «лекция / выступление / доклад» → **Лекция**
- иначе fallback **«Лекция» + confidence: «low»** (в UI помечается badge).

### Routes (`server/routes/organizer.cjs`)

- `POST /api/organizer/sessions/:sid/programs/import-preview` — multipart `file` + form fields `mode`, `model?`, `stopWords?`. Возвращает `{ draft, fileName }`. **Не пишет в БД** (кроме audit на LLM-режим).
- `POST /api/organizer/sessions/:sid/programs/import-commit` — body `{ draft, fileName, mode, model?, conflictResolution: "replace_draft" | "create_new" }`. Сохраняет в `workspace.programWorkspace.programs[0]` со status=draft. Audit: `organizer.program.imported.commit`.

### UI

- [`src/components/organizer/ProgramImportModal.jsx`](../../src/components/organizer/ProgramImportModal.jsx) — модалка с двумя экранами:
  1. Setup: file picker + toggle режима + textarea стоп-слов.
  2. Preview: редактируемый список дней/событий с чекбоксами «включить» (по умолчанию выключены те, что попали под стоп-слова, но видны с пометкой «отфильтровано» — можно вернуть).
- Подключена в [`ProgramTabPanel.jsx`](../../src/views/OrganizerCabinet/ProgramTabPanel.jsx) кнопкой «📋 Загрузить программу из Excel» в шапке.

### Что НЕ делает в v1

- Не парсит CSV / Google Sheets URL.
- Не дедупит спикеров через справочник `speakers` — пишет имя в `speakerName` текстом.
- Не назначает `reflectionQuestions` импортированным событиям.
- Не лимитирует токенный бюджет organizer'а — разовый импорт.

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
