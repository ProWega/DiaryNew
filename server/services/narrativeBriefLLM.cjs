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

const MODEL = "claude-haiku-4-5";
const REQUEST_TIMEOUT_MS = 12_000;
const CACHE_TTL_MS = 5 * 60_000;

// Lazy proxy module loading — undici / socks-proxy-agent are only required
// when ANTHROPIC_PROXY_URL is set. Keeps the cold-path require cost zero
// for users who don't proxy.
function buildProxyDispatcher(proxyUrl) {
  if (!proxyUrl) return null;
  const isSocks = /^socks[45]?:\/\//i.test(proxyUrl);

  if (isSocks) {
    const { Agent } = require("undici");
    const { SocksProxyAgent } = require("socks-proxy-agent");
    const socksAgent = new SocksProxyAgent(proxyUrl);

    // Bridge socks-proxy-agent → undici Agent via custom `connect`.
    // socks-proxy-agent's `connect` returns a duplex socket that undici
    // wraps for HTTPS via its built-in TLS layer when `protocol === "https:"`.
    return new Agent({
      connect: (opts, callback) => {
        socksAgent
          .connect({ host: opts.hostname, port: opts.port, ...opts }, opts)
          .then((socket) => callback(null, socket))
          .catch((error) => callback(error));
      },
    });
  }

  // HTTP/HTTPS proxy via undici's first-class ProxyAgent.
  const { ProxyAgent } = require("undici");
  return new ProxyAgent(proxyUrl);
}

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

function fingerprint(brief) {
  // Stable shape — keys sorted, only fields that affect narrative content.
  const compact = {
    dayId: brief.dayId || null,
    picture: brief.picture,
    stageResonance: brief.stageResonance,
    points: (brief.conversationPoints || []).map((p) => p.reason),
    eventsCount: (brief.events || []).length,
  };
  return JSON.stringify(compact);
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

  getClient._instance = new Anthropic({
    apiKey,
    timeout: REQUEST_TIMEOUT_MS,
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

async function callLLM(brief) {
  const client = getClient();
  if (!client) return null;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: buildUserMessage(brief) }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  return textBlock ? textBlock.text.trim() : null;
}

/**
 * Enriches the structured brief with a 3-5 sentence narrative paragraph.
 * Always returns a brief — soft-fails to source: "fallback" on missing key,
 * timeout, or API error.
 */
async function enrichWithNarrative(brief, { groupId } = {}) {
  if (!brief) return brief;

  const fingerprintKey = `${groupId || "unknown"}:${brief.dayId || "no-day"}:${fingerprint(brief)}`;
  const cached = readCache(fingerprintKey);
  if (cached) {
    return { ...brief, narrative: { text: cached, source: "llm" } };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return { ...brief, narrative: { text: null, source: "fallback" } };
  }

  try {
    const text = await callLLM(brief);
    if (!text) {
      return { ...brief, narrative: { text: null, source: "fallback" } };
    }
    writeCache(fingerprintKey, text);
    return { ...brief, narrative: { text, source: "llm" } };
  } catch (error) {
    // Silent fallback — endpoint MUST stay functional even if LLM is down.
    // Log to stderr so prod observability picks it up.
    if (process.env.NODE_ENV !== "test") {
      console.warn("[narrativeBriefLLM] fallback:", error?.message || error);
    }
    return { ...brief, narrative: { text: null, source: "fallback" } };
  }
}

module.exports = {
  enrichWithNarrative,
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
