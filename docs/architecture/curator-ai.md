# Curator AI v2

LLM-обогащение кабинета куратора: narrative-brief по дням, persistent кеш, кнопка «Перегенерировать», загрузка концепций мероприятий, чат «Разговор с ИИ», бюджет токенов, выбор провайдера (Anthropic / OpenAI).

## Высокоуровневая схема

```
┌────────────────────────────────────────────────────────────────────────┐
│                          Curator UI (React)                            │
│  ┌────────────┐  ┌──────────────────┐  ┌──────────────────────────┐    │
│  │  Записка   │  │  Разговор с ИИ   │  │      Старый дашборд      │    │
│  │            │  │                  │  │      (legacy view)       │    │
│  │  DayPicker │  │   ChatPanel      │  │                          │    │
│  │  Regenerate│  │   Threads + msgs │  │                          │    │
│  │  ModelSel  │  │                  │  │                          │    │
│  └─────┬──────┘  └────────┬─────────┘  └──────────────────────────┘    │
│        │                  │                                            │
└────────┼──────────────────┼────────────────────────────────────────────┘
         │                  │
         ▼                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│              server/routes/curator.cjs (8 endpoints)                   │
│   /brief    /brief/regenerate    /days    /usage/me                    │
│   /chat/thread    /chat/messages    /chat/reset                        │
└────────┬──────────────────────────────────────────┬────────────────────┘
         │                                          │
         ▼                                          ▼
┌─────────────────────────────────┐    ┌───────────────────────────────┐
│  narrativeBriefService.cjs      │    │   curatorChatService.cjs      │
│  - сбор signals                 │    │   - getOrCreate thread        │
│  - buildNarrativeBrief          │    │   - sendMessage               │
│  - enrichWithNarrative          │    │   - reset                     │
└──────────┬──────────────────────┘    └─────────────┬─────────────────┘
           │                                         │
           ▼                                         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    curatorLlmGuard.cjs                                  │
│  ensureBudget  •  resolveModel  •  recordUsage                          │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         llmClient.cjs                                   │
│  detectProvider(model) → Anthropic SDK / OpenAI SDK                     │
│  ┌──────────────────────┐                  ┌──────────────────────┐     │
│  │  Anthropic adapter   │                  │   OpenAI adapter     │     │
│  │  cache_control:      │                  │   max_completion_    │     │
│  │  ephemeral на        │                  │   tokens, auto       │     │
│  │  каждый system block │                  │   prompt cache       │     │
│  └──────────────────────┘                  └──────────────────────┘     │
│                                                                         │
│  Прокси через fetch + undici dispatcher (proxyDispatcher.cjs):          │
│    http(s):// → undici.ProxyAgent                                       │
│    socks(5):// → SocksProxyAgent bridge                                 │
└─────────────────────────────────────────────────────────────────────────┘
```

## Таблицы (миграция `1753000000000_curator_ai_v2.js`)

| Таблица                         | Назначение                                                                                                                                                      |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `narrative_brief_cache`         | Версии записок по `(session,group,day,fingerprint,model)`. Флаг `is_current` помечает актуальную; force-regenerate помечает старые stale и INSERT'ит новую.     |
| `llm_usage_ledger`              | Расход токенов per-вызов: `kind` (brief / regen / chat), input/output/cache, `cost_estimate_micros`. Агрегация для бюджета через SELECT sum by curator + today. |
| `program_event_concepts`        | PDF/DOCX/TXT/MD-концепции мероприятий: оригинал на диске + `extracted_text` в БД. UNIQUE `(event_id, storage_filename)` для dedup.                              |
| `curator_chat_threads`          | По одному активному thread на `(curator,group)` — UNIQUE PARTIAL INDEX `WHERE status='active'`. Archived треды живут для аудита.                                |
| `curator_chat_messages`         | История сообщений: role / content / model / usage JSON.                                                                                                         |
| `sessions.llm_settings` (jsonb) | Настройки LLM на уровень заезда. Дефолты — `services/llmSettings.cjs`.                                                                                          |

## Что собирается в LLM-запрос

### Narrative brief

```
system (1 cacheable block)
  ↑ методологический промпт куратора:
    - правила стиля (2-4 предложения, без диагност. ярлыков)
    - запрещённые/разрешённые методические термины
    - запрет на имена

messages
  ↑ структурированная сводка дня (JSON sanitized):
    - dayLabel, picture, stageResonance, conversationReasons, eventTitles
```

`signals` для fingerprint (sha256 от sorted JSON):

- `{sessionId, groupId, dayId}`
- members группы: `[{id, journeyStage, isCarefulMode}]`
- entries сегодня+вчера: `[{id, userId, eventId, stateId, isAnonymous, isHiddenFromCurator, commentHash}]`
- events дня: `[{id, sortOrder}]`
- concepts: `[{eventId, storageFilename}]` (storage_filename = sha256 контента → замена файла = новый отпечаток)
- `PROMPT_VERSION` (константа в коде, бамп = массовая инвалидация)

### Chat

```
system block 1 (cacheable)
  ↑ методологический системник + правила «отвечай как методолог-наставник»,
    цитируй короткими фрагментами, имена бери из комментариев

system block 2 (cacheable)
  ↑ ## Состав группы (N участников)
    - Иван Петров — этап: поиск; режим «бережно»
    - Анна Кузнецова — этап: опора
    ...
  ↑ ## Обратная связь участников                — НОВОЕ (v2.2, март 2026)
    ### День 1 · 24 апреля  (8 комментариев к 3 мероприятиям · 4 рефлексии)
    #### Мероприятие: «Утренний круг» (09:00–10:30)
    - Иван Петров · отметил «лад»: «Хорошо настроился сегодня…»
    - анонимно · отметил «сбой»: «Было душно, не смог сосредоточиться»
    ...
    #### Рефлексия дня (свободный текст)
    - Иван Петров: «День оказался насыщенным…»
    #### Рефлексия дня (методические оси)
    - Иван Петров — Ум: «…»; Сердце: «…»; Воля: «…»
  ↑ ## Концепции мероприятий
    ### Событие event-123
    <extracted_text PDF>
    ...

messages
  - последние 20 сообщений thread'а (curator_chat_messages ASC)
  - новый user-вопрос
```

Источник «Обратной связи» — `diary_entries.comment` (по мероприятиям) + `daily_reflections.free_text/answers` (на день). Раньше тут был сжатый narrative-brief из `narrative_brief_cache` — это была двойная компрессия (участник → LLM → бриф → LLM). Теперь LLM видит сырые комментарии участников и может цитировать. `narrative_brief_cache` остаётся для endpoint'а `/brief` (страница «записка дня» куратора), но чат его не читает.

Privacy в `formatFeedback`: перед инъекцией прогон через `applyToList(items, "curator")` из [server/lib/privacy.cjs](../../server/lib/privacy.cjs) — `is_hidden_from_curator=true` отбрасывается, `is_anonymous=true` обнуляет имя (отображается как «анонимно»). Фильтр `memberIds` не отсеивает анонимных — они всегда видны куратору.

Защита context window: суммарно > 200 000 chars → concepts обрезаются первыми, в response `contextTruncated: true`.

### Context filter (v2.1)

Куратор может ограничить, ЧТО уходит в каждый блок: какие участники, какие дни, какие события. Filter передаётся при каждом chat-message и в `/chat/preview`.

```jsonc
// нормализованная форма (см. server/services/chatContextFilter.cjs)
{
  "includeMembers": true,
  "memberIds": [], // пусто = все участники группы
  // для блока feedback: непустой = ограничить именованных,
  //   но анонимные ВСЕГДА показываются вне зависимости от фильтра
  "includeDays": true, // toggle блока «Обратная связь участников»
  "dayIds": [], // пусто = все дни сессии
  "includeConcepts": true,
  "eventIds": [], // пусто = все события сессии; применяется и к концепциям,
  //   и к комментариям в feedback-блоке
}
```

Пустой `{}` нормализуется к ALL_INCLUDED (backward-compat с v2.0). Если `includeX = false` — секция вообще не строится (`membersBlock = ""`).

Cascade выбора filter'а в `sendChatMessage` ([curatorChatService.cjs](../../server/services/curatorChatService.cjs)):

1. Явный `filter` в теле запроса (inline picker через `ChatContextDrawer`).
2. `is_default = true` preset из `curator_chat_presets` для `(session, group, curator)`.
3. ALL_INCLUDED (полный preamble — поведение v2.0).

**Preset'ы** (`curator_chat_presets`) — именованные шаблоны контекста. CRUD доступен куратору (`/api/curator/.../chat/presets`) и организатору (`/api/organizer/.../curators/:curatorId/chat/presets`, с audit-log `curator_ai.preset.{create,update,delete,set_default}`). UNIQUE PARTIAL INDEX гарантирует не больше одного default'а per `(session, group, curator)`.

**Live preview** (`/chat/preview` POST с filter в body) возвращает тот же preamble, что увидит ИИ, плюс `estimatedChars` / `estimatedTokens` / `contextTruncated`. Без LLM-вызова, без расхода токенов.

Cache implication: смена filter'а инвалидирует ephemeral prompt-cache (system-блоки меняются → cold-cache hit на следующем сообщении). Это ожидаемо.

## Prompt caching

| Провайдер     | Стратегия                                                                                                                                          |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Anthropic** | Явный `cache_control: {type: "ephemeral"}` на каждом system-блоке. TTL 5 мин. После прогрева prefix идёт по ~10% цене.                             |
| **OpenAI**    | Автоматический cache от 1024+ токенов prefix. SDK возвращает `prompt_tokens_details.cached_tokens` — пишем в `llm_usage_ledger.cache_read_tokens`. |

llmClient.cjs ставит правильный путь по флагу `cacheable: true` в `systemBlocks`.

## Cache-стратегия для brief

```
Read path (GET /brief):
  L1 in-memory (5 мин TTL, ключ groupId:dayId:model:fingerprint)
   └─ miss → L2 narrative_brief_cache WHERE is_current=true
       └─ miss → LLM call → INSERT row → write L1
                 source: "llm" + usage
       └─ hit  → source: "db-cache" + cachedAt
   └─ hit  → source: "llm" (data still LLM-сгенерирована)

Write path (POST /brief/regenerate):
  ensureBudget → UPDATE all rows for (session,group,day) SET is_current=false
   → LLM call → INSERT new row with is_current=true
   → recordUsage(kind="regen") → response 201
```

История версий хранится для аудита и потенциального A/B на одинаковых signals между моделями.

## Бюджет токенов

`curatorDailyTokenBudget` (per-curator-per-day, 0 = безлимит) проверяется перед force-regenerate и перед каждым chat-сообщением:

```sql
SELECT sum(input_tokens + output_tokens)
  FROM llm_usage_ledger
  WHERE session_id = $ AND curator_id = $
    AND occurred_at >= (current_date at time zone 'UTC')
```

При превышении endpoint возвращает 402 `{error: "budget_exceeded", spent, budget, resetsAt}`. Фронт ловит и показывает `<UsageBadge>` с прогрессом.

GET `/brief` (без force) **не** проверяет бюджет — на cache-hit куратор должен видеть записку даже при исчерпанном лимите.

## Soft-fail и degradation

Все LLM-вызовы внутри try/catch:

- Нет API-ключа провайдера → `narrative: { text: null, source: "fallback" }` (structured brief всё равно отдаётся)
- Connection error / timeout → `[narrativeBriefLLM] fallback: ...` в pino warn, source: "fallback"
- 402 budget_exceeded → проброс наверх (фронт показывает UsageBadge)
- 403 на chat при `curatorChatEnabled=false` → фронт показывает FeedbackState «Чат с ИИ выключен»

## Privacy

Brief: feedback-комментарии перед инъекцией в `buildNarrativeBrief` проходят через `server/lib/privacy.cjs:applyToList(rows, "curator")` — анонимные и hidden-from-curator не попадают в LLM-prompt.

Chat: preamble использует уже отфильтрованные `narrative_brief_cache.narrative_text`. Сырые `diary_entries` напрямую в чат не идут.

## Прокси

`server/lib/proxyDispatcher.cjs` строит undici-совместимый dispatcher из URL:

- `http(s)://...` → `undici.ProxyAgent` (стандарт, рекомендуется)
- `socks(5)://...` → bridge `SocksProxyAgent → undici.Agent` через кастомный `connect`

Env-vars (опционально):

- `ANTHROPIC_PROXY_URL`, `ANTHROPIC_BASE_URL` — для Anthropic-провайдера
- `OPENAI_PROXY_URL`, `OPENAI_BASE_URL` — для OpenAI; если `OPENAI_PROXY_URL` пуст, fallback на `ANTHROPIC_PROXY_URL`

HTTP-proxy предпочтительнее SOCKS5 — стабильнее работает с fetch-based SDK.

## Поддерживаемые модели

| ID                  | Провайдер | Контекст       |
| ------------------- | --------- | -------------- |
| `claude-haiku-4-5`  | Anthropic | дефолт, дёшево |
| `claude-sonnet-4-5` | Anthropic | баланс         |
| `claude-opus-4-7`   | Anthropic | премиум        |
| `gpt-5-mini`        | OpenAI    | дёшево         |
| `gpt-5`             | OpenAI    | баланс         |
| `gpt-4o-mini`       | OpenAI    | legacy lite    |
| `gpt-4o`            | OpenAI    | legacy         |

Список в [`server/services/llmSettings.cjs:KNOWN_MODELS`](../../server/services/llmSettings.cjs). Расширение — добавить в этот массив + цены в `curatorLlmGuard.estimateCostMicros` + label в `SessionLlmSettingsCard.ALL_MODELS` и `MODEL_LABEL` на фронте.

## Аудит и логирование

| Событие                            | Кем пишется                            |
| ---------------------------------- | -------------------------------------- |
| `program_event.concept.upload`     | POST /events/:id/concepts после INSERT |
| `program_event.concept.delete`     | DELETE /events/:id/concepts/:cid       |
| `methodology.journey_stage.update` | PATCH /participant/.../journey-stage   |

LLM-вызовы пишутся не в audit_log (поток слишком частый), а в `llm_usage_ledger` — отдельная таблица с разбивкой по `kind`. Организатор смотрит агрегат через `GET /api/organizer/sessions/:sid/usage`.

## Auto-retry на 403 CSRF

`src/api/jsonApi.ts:requestJson` ловит 403 с message содержащим `csrf`, дёргает `/api/auth/me` (минтит свежий CSRF cookie) и повторяет запрос один раз. Это закрывает cross-tab logout и cookie drift без ручного hard-refresh.

## Что НЕ сделано (отложено)

- **Anthropic Message Batches API** — ночной precompute brief'ов всех дней. Делается отдельной фазой когда нагрузка оправдает сложность.
- **OCR для отсканированных PDF** — нужны Tesseract или другой движок, ~80MB зависимостей. Сейчас pdfjs возвращает пустой текст для image-only PDF.
- **Multi-thread в чате** — сейчас один активный thread на (curator, group). Расширение требует UI thread list.
- **Streaming-ответы в чате** — SDK поддерживает, но требует SSE/WebSocket.
- **Версионирование промпта в БД** — сейчас единственная константа `PROMPT_VERSION` в коде; для A/B экспериментов нужна таблица.

## Critical files

- [server/migrations/1753000000000_curator_ai_v2.js](../../server/migrations/1753000000000_curator_ai_v2.js)
- [server/services/llmClient.cjs](../../server/services/llmClient.cjs)
- [server/services/narrativeBriefLLM.cjs](../../server/services/narrativeBriefLLM.cjs)
- [server/services/narrativeBriefService.cjs](../../server/services/narrativeBriefService.cjs)
- [server/services/curatorChatService.cjs](../../server/services/curatorChatService.cjs)
- [server/services/curatorChatContext.cjs](../../server/services/curatorChatContext.cjs)
- [server/services/curatorLlmGuard.cjs](../../server/services/curatorLlmGuard.cjs)
- [server/services/llmSettings.cjs](../../server/services/llmSettings.cjs)
- [server/services/documentExtraction.cjs](../../server/services/documentExtraction.cjs)
- [server/lib/proxyDispatcher.cjs](../../server/lib/proxyDispatcher.cjs)
- [server/db/repositories/narrativeBriefCache.cjs](../../server/db/repositories/narrativeBriefCache.cjs)
- [server/db/repositories/eventConceptsStore.cjs](../../server/db/repositories/eventConceptsStore.cjs)
- [server/routes/curator.cjs](../../server/routes/curator.cjs)
- [src/pages/CuratorBriefPage.jsx](../../src/pages/CuratorBriefPage.jsx)
- [src/views/CuratorBrief/ChatPanel.jsx](../../src/views/CuratorBrief/ChatPanel.jsx)
- [src/components/organizer/SessionLlmSettingsCard.jsx](../../src/components/organizer/SessionLlmSettingsCard.jsx)
- [src/components/organizer/EventConceptsPanel.jsx](../../src/components/organizer/EventConceptsPanel.jsx)
