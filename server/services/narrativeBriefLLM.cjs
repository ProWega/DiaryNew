"use strict";

/**
 * LLM enrichment for the curator narrative brief.
 *
 * Phase 5+ (methodology v4): Haiku 4.5 turns the structured brief data into a
 * 3-5 sentence «вечерняя записка» in the methodology language. Detection rules
 * stay deterministic — the LLM only writes prose around them.
 *
 * Soft fallback by design:
 *  - if ANTHROPIC_API_KEY is unset → returns the brief unchanged + source: "fallback"
 *  - if the API call errors / times out → same fallback path
 *  - if the API call succeeds → adds narrative.text + source: "llm"
 *
 * Prompt caching: the system prompt (methodology glossary + ban-list + format
 * spec) is stable across requests and gets cache_control: ephemeral. After the
 * first warm-up call, subsequent calls within ~5 min serve the prefix from
 * cache at ~10% of base price.
 */

const Anthropic = require("@anthropic-ai/sdk");
const crypto = require("node:crypto");
const briefCacheRepo = require("../db/repositories/narrativeBriefCache.cjs");
const { callLlm } = require("./llmClient.cjs");
const { buildProxyDispatcher: _sharedBuildProxyDispatcher } = require("../lib/proxyDispatcher.cjs");

const DEFAULT_MODEL = "claude-haiku-4-5";
const DEFAULT_MAX_TOKENS = 500;
const REQUEST_TIMEOUT_MS = 12_000;
const CACHE_TTL_MS = 5 * 60_000;

// Версия системного промпта. Бамп при любой правке SYSTEM_PROMPT инвалидирует
// весь DB-кеш одним релизом, т.к. участвует в fingerprint'е.
const PROMPT_VERSION = "2026-05-12-v1";

// Re-export для обратной совместимости (старые тесты импортируют отсюда).
// Реализация переехала в server/lib/proxyDispatcher.cjs.
const buildProxyDispatcher = _sharedBuildProxyDispatcher;

// In-memory cache by (groupId, dayId, fingerprint of brief data) so a curator
// hitting refresh inside a 5-minute window doesn't re-bill the API.
const briefCache = new Map();

/** Methodology glossary (working terms) — see docs/architecture/methodology-mapping.md §1. */
const ALLOWED_TERMS = [
  "путь",
  "тетрадь",
  "запись",
  "заметка",
  "отозвалось",
  "подвинулся",
  "понимаю",
  "целостность",
  "собирание",
  "лад",
  "тишина",
  "настройка",
  "подъём",
  "сбой",
  "рядом",
  "в стороне",
  "опора",
  "передача",
  "поиск",
  "проверка",
  "бережно",
  "бережение",
  "свои",
  "спутник",
  "дорога",
];

const BANNED_TERMS = [
  "уровень",
  "стадия",
  "прогресс",
  "стрик",
  "метрика",
  "оценка",
  "диагноз",
  "скилл",
  "статус",
  "ментор",
  "эксперт",
  "коммьюнити",
  "холизм",
  "харизма",
  "провал",
  "регресс",
  "риск",
  "кейс",
];

const SYSTEM_PROMPT = `Ты пишешь «записку к вечерней рефлексии» для куратора группы — короткое (3–5 предложений) сопроводительное эссе к структурированной сводке дня.

Контекст. Это методика «Дневник пути» (программа «Истоки»). Куратор завтра поговорит с группой; записка задаёт ему интонацию и фокус разговора. Тон бережный, конкретный, без давления.

Что нельзя нарушать:
1. Никаких диагностических ярлыков. Не используй слова: ${BANNED_TERMS.join(", ")}.
2. Используй только методические термины: ${ALLOWED_TERMS.join(", ")}.
3. Не пиши имён — куратор знает группу, имена в структурированной части записки. В нарративе говори «один из участников», «несколько человек», «в группе».
4. Не повторяй слово в слово данные из JSON. Синтезируй: что задаёт тон дня, кому стоит подойти, какая дуга у группы.
5. Не давай советов «что делать» императивом. Говори «можно подойти», «стоит обратить внимание», «возможно, важно побыть рядом».
6. Без эмодзи, без markdown, только обычные предложения. Минимум 3, максимум 5 предложений. Без вступлений типа «Сегодня в группе...» — начинай сразу с сути.

Формат вывода: только текст записки. Без префиксов, без объяснений.`;

/**
 * Стабильный отпечаток входов: любые изменения members/entries/events/concepts
 * дают новый fingerprint и, как следствие, cache-miss в DB.
 *
 * Стабильная сериализация: ключи отсортированы, массивы — отсортированы по id.
 * Версия промпта тоже в hash'е — правка SYSTEM_PROMPT даёт массовую
 * инвалидацию всего кеша за релиз.
 */
function fingerprint(signals) {
  const safe = signals || {};
  const compact = {
    promptVersion: PROMPT_VERSION,
    sessionId: safe.sessionId || null,
    groupId: safe.groupId || null,
    dayId: safe.dayId || null,
    members: stableArray(safe.members, (m) => ({
      id: m.id,
      stage: m.journeyStage || null,
      careful: Boolean(m.isCarefulMode),
    })),
    entries: stableArray(safe.entries, (e) => ({
      id: e.id,
      userId: e.userId,
      eventId: e.eventId,
      stateId: e.stateId || null,
      anon: Boolean(e.isAnonymous),
      hidden: Boolean(e.isHiddenFromCurator),
      commentHash: e.comment ? hashShort(e.comment) : null,
    })),
    events: stableArray(safe.events, (e) => ({ id: e.id, sortOrder: e.sortOrder ?? 0 })),
    concepts: stableArray(safe.concepts, (c) => ({
      eventId: c.eventId,
      storage: c.storageFilename,
    })),
  };
  return crypto.createHash("sha256").update(JSON.stringify(compact)).digest("hex");
}

function stableArray(input, projector) {
  if (!Array.isArray(input) || !input.length) return [];
  return input
    .map(projector)
    .filter(Boolean)
    .sort((a, b) => (a.id || "").localeCompare(b.id || ""));
}

function hashShort(text) {
  return crypto.createHash("sha256").update(String(text)).digest("hex").slice(0, 16);
}

function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  if (getClient._instance) return getClient._instance;

  const proxyUrl = process.env.ANTHROPIC_PROXY_URL || "";
  const dispatcher = buildProxyDispatcher(proxyUrl);

  // Wrap fetch so the proxy dispatcher is attached on every request without
  // polluting the global fetch (other code paths shouldn't be tunneled).
  const fetchImpl = dispatcher
    ? (input, init) => {
        const { fetch: undiciFetch } = require("undici");
        return undiciFetch(input, { ...init, dispatcher });
      }
    : undefined;

  // ANTHROPIC_BASE_URL разрешает направить SDK на альтернативный endpoint
  // (oneprovider.dev и аналогичные релеи, доступные из РФ без VPN). Когда
  // используется такой релей, ANTHROPIC_PROXY_URL обычно не нужен.
  const baseURL = process.env.ANTHROPIC_BASE_URL || undefined;

  getClient._instance = new Anthropic({
    apiKey,
    timeout: REQUEST_TIMEOUT_MS,
    ...(baseURL ? { baseURL } : {}),
    ...(fetchImpl ? { fetch: fetchImpl } : {}),
  });
  return getClient._instance;
}

function buildUserMessage(brief) {
  // Strip personally-identifying details before sending — names already pass
  // through privacy.cjs upstream, but we double-down here: the prompt explicitly
  // forbids names, so don't even tempt the model with them.
  const sanitized = {
    dayLabel: brief.dayLabel,
    picture: brief.picture,
    stageResonance: brief.stageResonance,
    conversationReasons: (brief.conversationPoints || []).map((p) => p.reason),
    eventTitles: (brief.events || []).map((e) => ({
      title: e.title,
      responseCount: e.responseCount,
    })),
  };

  return [
    "Структурированная сводка дня (JSON):",
    "```json",
    JSON.stringify(sanitized, null, 2),
    "```",
    "",
    "Напиши записку к вечерней рефлексии.",
  ].join("\n");
}

function readCache(key) {
  const entry = briefCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    briefCache.delete(key);
    return null;
  }
  return entry.text;
}

function writeCache(key, text) {
  briefCache.set(key, { text, at: Date.now() });
  // Trim if it grows; not a hot path so simple eviction is fine.
  if (briefCache.size > 200) {
    const oldest = briefCache.keys().next().value;
    briefCache.delete(oldest);
  }
}

async function callLLM(brief, { model, maxTokens } = {}) {
  // Унифицированный путь: llmClient выбирает Anthropic/OpenAI по prefix модели.
  // SYSTEM_PROMPT помечается cacheable — для Anthropic ставит cache_control:ephemeral,
  // для OpenAI cache_control не нужен (prompt-cache автоматический от 1024+ токенов).
  try {
    const result = await callLlm({
      model: model || DEFAULT_MODEL,
      maxTokens: maxTokens || DEFAULT_MAX_TOKENS,
      systemBlocks: [{ text: SYSTEM_PROMPT, cacheable: true }],
      messages: [{ role: "user", content: buildUserMessage(brief) }],
    });
    if (!result || !result.text) return null;
    return { text: result.text, usage: result.usage };
  } catch (error) {
    // 503 от llmClient = "API не настроен" → возвращаем null, выше уйдём в fallback.
    if (error?.status === 503) return null;
    throw error;
  }
}

/**
 * Soft-fail обогащение narrative для куратор-brief. Двухуровневый кеш:
 *   L1: in-memory (5 мин TTL) — экономит SELECT на hot path.
 *   L2: persistent DB — переживает рестарт, ключ `(session,group,day,fingerprint,model)`.
 *
 * Behaviour:
 *  - Без ANTHROPIC_API_KEY или при ошибке/таймауте → fallback с `text:null`.
 *  - L1 hit → source: "llm" (data still LLM-сгенерирована).
 *  - L2 hit → source: "db-cache" + `cachedAt`.
 *  - Miss → LLM-вызов, запись в L2 + L1.
 *  - `force=true` → пропустить оба кеша, markStale предыдущие is_current=true,
 *    INSERT новой версии. Используется кнопкой «Перегенерировать».
 *
 * Параметры:
 *  brief — структурированный brief как было.
 *  ctx.sessionId / ctx.groupId / ctx.dayId — для ключей DB-cache.
 *  ctx.viewerId — кто запросил (для `generated_by`).
 *  ctx.model — какой моделью генерить; дефолт DEFAULT_MODEL.
 *  ctx.maxTokens — лимит ответа; дефолт DEFAULT_MAX_TOKENS.
 *  ctx.force — пропустить кеш и сгенерить заново.
 *  ctx.signals — расширенные inputs для fingerprint (members/entries/events/concepts).
 *                Если не передан — собираем минимальный набор из самого brief.
 */
async function enrichWithNarrative(brief, ctx = {}) {
  if (!brief) return brief;

  const sessionId = ctx.sessionId || null;
  const groupId = ctx.groupId || null;
  const dayId = brief.dayId || ctx.dayId || null;
  const viewerId = ctx.viewerId || null;
  const force = Boolean(ctx.force);
  const model = ctx.model || DEFAULT_MODEL;
  const maxTokens = ctx.maxTokens || DEFAULT_MAX_TOKENS;

  // Базовый signals: явно переданный набор имеет приоритет, иначе reconstruct
  // из самого brief (для backward-compat и unit-тестов без DB).
  const signals = ctx.signals || {
    sessionId,
    groupId,
    dayId,
    members: [],
    entries: (brief.conversationPoints || []).map((p) => ({
      id: p.participantId,
      userId: p.participantId,
      eventId: null,
      stateId: null,
      isAnonymous: false,
      isHiddenFromCurator: false,
      comment: p.note,
    })),
    events: (brief.events || []).map((e, idx) => ({ id: e.id, sortOrder: idx })),
    concepts: [],
  };
  const fp = fingerprint(signals);
  const l1Key = `${groupId || "unknown"}:${dayId || "no-day"}:${model}:${fp}`;

  // Force-path: пропускаем кеш, markStale, генерим и сохраняем.
  if (force) {
    return await runLlmAndPersist({
      brief,
      ctx: { sessionId, groupId, dayId, viewerId, model, maxTokens },
      fp,
      l1Key,
      markStaleFirst: true,
    });
  }

  // L1 in-memory cache.
  const memoryHit = readCache(l1Key);
  if (memoryHit) {
    return { ...brief, narrative: { text: memoryHit.text, source: "llm" } };
  }

  // L2 persistent DB cache (только если есть полный ключ).
  if (sessionId && groupId && dayId) {
    try {
      const dbHit = await briefCacheRepo.findCurrent({
        sessionId,
        groupId,
        dayId,
        fingerprint: fp,
        model,
      });
      if (dbHit) {
        writeCache(l1Key, { text: dbHit.narrativeText });
        return {
          ...brief,
          narrative: {
            text: dbHit.narrativeText,
            source: "db-cache",
            cachedAt: dbHit.generatedAt,
            model: dbHit.model,
          },
        };
      }
    } catch (error) {
      // Cache lookup отвалился (DB недоступен) — продолжаем, попробуем LLM.
      if (process.env.NODE_ENV !== "test") {
        console.warn("[narrativeBriefLLM] DB cache lookup failed:", error?.message || error);
      }
    }
  }

  return await runLlmAndPersist({
    brief,
    ctx: { sessionId, groupId, dayId, viewerId, model, maxTokens },
    fp,
    l1Key,
    markStaleFirst: false,
  });
}

async function runLlmAndPersist({ brief, ctx, fp, l1Key, markStaleFirst }) {
  // Раньше тут было `if (!ANTHROPIC_API_KEY) → fallback`. Теперь провайдер
  // выбирается llmClient'ом по prefix модели: для gpt-* нужен OPENAI_API_KEY,
  // для claude-* — ANTHROPIC_API_KEY. callLLM возвращает null при отсутствии
  // нужного ключа → попадаем в обычный fallback ниже.
  try {
    const result = await callLLM(brief, { model: ctx.model, maxTokens: ctx.maxTokens });
    if (!result || !result.text) {
      return { ...brief, narrative: { text: null, source: "fallback" } };
    }
    const { text, usage } = result;
    writeCache(l1Key, { text });

    // Persist в DB только когда есть полный ключ + viewerId (без него
    // generated_by был бы NULL и нарушил бы NOT NULL constraint).
    if (ctx.sessionId && ctx.groupId && ctx.dayId && ctx.viewerId) {
      try {
        if (markStaleFirst) {
          await briefCacheRepo.markStale({
            sessionId: ctx.sessionId,
            groupId: ctx.groupId,
            dayId: ctx.dayId,
          });
        }
        await briefCacheRepo.insertNarrative({
          sessionId: ctx.sessionId,
          groupId: ctx.groupId,
          dayId: ctx.dayId,
          fingerprint: fp,
          model: ctx.model,
          narrativeText: text,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          cacheReadTokens: usage.cacheReadTokens,
          generatedBy: ctx.viewerId,
        });
      } catch (persistError) {
        // Persist отвалился (DB недоступен или constraint) — отдаём narrative
        // всё равно, в следующий раз попробуем сохранить.
        if (process.env.NODE_ENV !== "test") {
          console.warn(
            "[narrativeBriefLLM] DB cache persist failed:",
            persistError?.message || persistError,
          );
        }
      }
    }

    return {
      ...brief,
      narrative: { text, source: "llm", model: ctx.model, usage },
    };
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.warn("[narrativeBriefLLM] fallback:", error?.message || error);
    }
    return { ...brief, narrative: { text: null, source: "fallback" } };
  }
}

module.exports = {
  enrichWithNarrative,
  DEFAULT_MODEL,
  DEFAULT_MAX_TOKENS,
  PROMPT_VERSION,
  // Exported for tests:
  SYSTEM_PROMPT,
  BANNED_TERMS,
  fingerprint,
  buildProxyDispatcher,
  // Test seam: lets tests reset the in-memory cache between cases.
  __resetCache: () => briefCache.clear(),
  __resetClient: () => {
    getClient._instance = null;
  },
};
