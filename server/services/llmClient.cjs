"use strict";

/**
 * Унифицированный клиент LLM: за одним фасадом — Anthropic и OpenAI.
 *
 * Провайдер выбирается по префиксу model id:
 *  • `claude-…` → Anthropic
 *  • `gpt-…` / `o3*` / `o4*` → OpenAI
 *
 * Унифицированный input:
 *   {
 *     model: string,
 *     maxTokens: number,
 *     systemBlocks: [{ text: string, cacheable?: boolean }],
 *     messages: [{ role: "user" | "assistant", content: string }]
 *   }
 *
 * Унифицированный output:
 *   {
 *     text: string,
 *     model: string,
 *     usage: { inputTokens, outputTokens, cacheCreationTokens, cacheReadTokens }
 *   }
 *
 * Прокси: оба провайдера ходят через единый `fetch` с `undici.ProxyAgent`
 * или `socks-proxy-agent`. Env-vars:
 *   - ANTHROPIC_API_KEY / ANTHROPIC_BASE_URL / ANTHROPIC_PROXY_URL
 *   - OPENAI_API_KEY     / OPENAI_BASE_URL     / OPENAI_PROXY_URL
 * Если OPENAI_PROXY_URL пуст — fallback на ANTHROPIC_PROXY_URL (тот же
 * прокси-провайдер обычно работает для обоих).
 */

const Anthropic = require("@anthropic-ai/sdk");
const OpenAI = require("openai");
const { buildProxyDispatcher } = require("../lib/proxyDispatcher.cjs");

// Default request timeout. Поднят с 30→120s т.к. парсинг больших расписаний
// Opus-моделями может занимать минуту. Per-call можно переопределить через
// `callLlm({ timeoutMs })`.
const REQUEST_TIMEOUT_MS = 120_000;

function detectProvider(model) {
  if (!model) return "anthropic";
  const m = String(model).toLowerCase();
  if (m.startsWith("gpt-") || /^o\d/.test(m)) return "openai";
  if (m.startsWith("claude-")) return "anthropic";
  return "anthropic";
}

function isProviderConfigured(provider) {
  if (provider === "openai") return Boolean(process.env.OPENAI_API_KEY);
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

async function callLlm({ model, maxTokens, systemBlocks = [], messages = [], timeoutMs }) {
  const provider = detectProvider(model);
  if (provider === "openai") {
    return callOpenAI({ model, maxTokens, systemBlocks, messages, timeoutMs });
  }
  return callAnthropic({ model, maxTokens, systemBlocks, messages, timeoutMs });
}

// ── Anthropic adapter ──────────────────────────────────────────────────────

let anthropicClient = null;
function getAnthropicClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (anthropicClient) return anthropicClient;

  const dispatcher = buildProxyDispatcher(process.env.ANTHROPIC_PROXY_URL || "");
  const baseURL = process.env.ANTHROPIC_BASE_URL || undefined;
  const fetchImpl = dispatcher
    ? (input, init) => {
        const { fetch: undiciFetch } = require("undici");
        return undiciFetch(input, { ...init, dispatcher });
      }
    : undefined;

  anthropicClient = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: REQUEST_TIMEOUT_MS,
    ...(baseURL ? { baseURL } : {}),
    ...(fetchImpl ? { fetch: fetchImpl } : {}),
  });
  return anthropicClient;
}

async function callAnthropic({ model, maxTokens, systemBlocks, messages, timeoutMs }) {
  const client = getAnthropicClient();
  if (!client) throwHttp(503, "Anthropic API не настроен (нет ANTHROPIC_API_KEY)");

  // Каждый system-блок → отдельный element с опциональным cache_control.
  const system = systemBlocks.map((block) => ({
    type: "text",
    text: block.text,
    ...(block.cacheable ? { cache_control: { type: "ephemeral" } } : {}),
  }));

  const response = await client.messages.create(
    {
      model,
      max_tokens: maxTokens,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    },
    timeoutMs ? { timeout: timeoutMs } : undefined,
  );

  const textBlock = response.content.find((b) => b.type === "text");
  return {
    text: textBlock ? textBlock.text.trim() : "",
    model,
    usage: {
      inputTokens: response.usage?.input_tokens || 0,
      outputTokens: response.usage?.output_tokens || 0,
      cacheCreationTokens: response.usage?.cache_creation_input_tokens || 0,
      cacheReadTokens: response.usage?.cache_read_input_tokens || 0,
    },
  };
}

// ── OpenAI adapter ─────────────────────────────────────────────────────────

let openaiClient = null;
function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) return null;
  if (openaiClient) return openaiClient;

  // OPENAI_PROXY_URL приоритетнее, но если пуст — используем ANTHROPIC_PROXY_URL
  // (один и тот же провайдер прокси обычно работает для обоих API).
  const proxyUrl = process.env.OPENAI_PROXY_URL || process.env.ANTHROPIC_PROXY_URL || "";
  const dispatcher = buildProxyDispatcher(proxyUrl);
  const baseURL = process.env.OPENAI_BASE_URL || undefined;
  const fetchImpl = dispatcher
    ? (input, init) => {
        const { fetch: undiciFetch } = require("undici");
        return undiciFetch(input, { ...init, dispatcher });
      }
    : undefined;

  openaiClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: REQUEST_TIMEOUT_MS,
    ...(baseURL ? { baseURL } : {}),
    ...(fetchImpl ? { fetch: fetchImpl } : {}),
  });
  return openaiClient;
}

async function callOpenAI({ model, maxTokens, systemBlocks, messages, timeoutMs }) {
  const client = getOpenAIClient();
  if (!client) throwHttp(503, "OpenAI API не настроен (нет OPENAI_API_KEY)");

  // OpenAI Chat Completions: system-блоки объединяются в одно сообщение
  // role:"system" (cache_control нет — OpenAI кеширует prefix автоматически
  // от 1024 токенов, отдельный header не нужен).
  const systemText = systemBlocks
    .map((b) => b.text)
    .filter(Boolean)
    .join("\n\n");

  const openAiMessages = [];
  if (systemText) openAiMessages.push({ role: "system", content: systemText });
  for (const m of messages) {
    openAiMessages.push({ role: m.role, content: m.content });
  }

  // gpt-5*/o-series требуют max_completion_tokens; gpt-4* умеют и старый max_tokens.
  // Берём max_completion_tokens — современный путь, совместим с обоими.
  const response = await client.chat.completions.create(
    {
      model,
      max_completion_tokens: maxTokens,
      messages: openAiMessages,
    },
    timeoutMs ? { timeout: timeoutMs } : undefined,
  );

  const choice = response.choices?.[0];
  const text = choice?.message?.content?.trim() || "";

  // OpenAI usage shape: prompt_tokens / completion_tokens + детализация
  // cached_tokens в prompt_tokens_details (для prompt-cache stat).
  const usage = response.usage || {};
  return {
    text,
    model,
    usage: {
      inputTokens: usage.prompt_tokens || 0,
      outputTokens: usage.completion_tokens || 0,
      cacheCreationTokens: 0, // OpenAI не разделяет creation/read; общую экономию пишем в cacheRead
      cacheReadTokens: usage.prompt_tokens_details?.cached_tokens || 0,
    },
  };
}

function throwHttp(status, message) {
  const err = new Error(message);
  err.status = status;
  throw err;
}

module.exports = {
  callLlm,
  detectProvider,
  isProviderConfigured,
  // Test seam
  __resetClients: () => {
    anthropicClient = null;
    openaiClient = null;
  },
};
