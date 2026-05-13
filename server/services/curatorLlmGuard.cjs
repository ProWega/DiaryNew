"use strict";

/**
 * Curator LLM-guard: единая тропа для всех LLM-вызовов куратора (brief, regen,
 * chat). Делает три вещи:
 *
 *  1. `resolveModel({sessionId, requestedModel})` — учитывает sessions.llm_settings:
 *     если requested не в allowedModels — fallback на defaultModel. Возвращает
 *     `{model, maxTokens}`.
 *
 *  2. `ensureBudget({sessionId, curatorId})` — считает per-day per-curator
 *     spent (input+output из ledger), сравнивает с curatorDailyTokenBudget из
 *     settings. Если превышен — throws createHttpError(402, {error, ...}).
 *     Бюджет 0 = unlimited (поведение «как было»).
 *
 *  3. `recordUsage({sessionId, curatorId, groupId, kind, model, usage, refId})`
 *     — INSERT в llm_usage_ledger. Soft-fail при ошибке записи: лог в stderr,
 *     не пробрасываем — основной LLM-вызов уже прошёл, нет смысла его убивать.
 */

const { query } = require("../db/postgres.cjs");
const { createId } = require("../db/repositories/common.cjs");
const { getSessionLlmSettings } = require("../db/repositories/sessionStore.cjs");
const { createHttpError } = require("../lib/routeHelpers.cjs");

async function resolveModel({ sessionId, requestedModel = null }) {
  const settings = await getSessionLlmSettings(sessionId);
  const model =
    requestedModel && settings.allowedModels.includes(requestedModel)
      ? requestedModel
      : settings.defaultModel;
  return { model, maxTokens: settings.maxTokensPerCall, settings };
}

async function ensureBudget({ sessionId, curatorId }) {
  if (!curatorId) return { spent: 0, budget: 0, resetsAt: null };
  const settings = await getSessionLlmSettings(sessionId);
  const budget = settings.curatorDailyTokenBudget || 0;
  if (budget <= 0) return { spent: 0, budget: 0, resetsAt: null }; // unlimited

  const spent = await getCuratorSpentToday({ sessionId, curatorId });
  const resetsAt = nextUtcMidnight();

  if (spent >= budget) {
    throw createHttpError(402, "Дневной лимит токенов исчерпан", {
      error: "budget_exceeded",
      budget,
      spent,
      resetsAt,
    });
  }
  return { spent, budget, resetsAt };
}

async function recordUsage({
  sessionId,
  curatorId,
  groupId = null,
  kind,
  model,
  usage = {},
  refId = null,
}) {
  if (!sessionId || !curatorId || !kind || !model) return;
  try {
    await query(
      `insert into llm_usage_ledger
        (id, session_id, curator_id, group_id, kind, model,
         input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens,
         cost_estimate_micros, ref_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        createId("usage"),
        sessionId,
        curatorId,
        groupId,
        kind,
        model,
        usage.inputTokens || 0,
        usage.outputTokens || 0,
        usage.cacheCreationTokens || 0,
        usage.cacheReadTokens || 0,
        estimateCostMicros(model, usage),
        refId,
      ],
    );
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.warn("[curatorLlmGuard] failed to record usage:", error?.message || error);
    }
  }
}

async function getCuratorSpentToday({ sessionId, curatorId }) {
  const result = await query(
    `select coalesce(sum(input_tokens + output_tokens), 0)::bigint as total
       from llm_usage_ledger
       where session_id = $1
         and curator_id = $2
         and occurred_at >= (current_date at time zone 'UTC')`,
    [sessionId, curatorId],
  );
  return Number(result.rows[0]?.total || 0);
}

/**
 * Дневной отчёт куратора — для GET /usage/me. Возвращает spentToday + разбивку
 * по kind, budget из settings, resetsAt.
 */
async function getCuratorUsageReport({ sessionId, curatorId }) {
  const settings = await getSessionLlmSettings(sessionId);
  const budget = settings.curatorDailyTokenBudget || 0;
  const result = await query(
    `select kind,
            coalesce(sum(input_tokens), 0)::bigint as input_tokens,
            coalesce(sum(output_tokens), 0)::bigint as output_tokens
       from llm_usage_ledger
       where session_id = $1
         and curator_id = $2
         and occurred_at >= (current_date at time zone 'UTC')
       group by kind`,
    [sessionId, curatorId],
  );
  const byKind = {};
  let total = 0;
  for (const row of result.rows) {
    const input = Number(row.input_tokens);
    const output = Number(row.output_tokens);
    byKind[row.kind] = { inputTokens: input, outputTokens: output };
    total += input + output;
  }
  return {
    spentToday: total,
    budget,
    resetsAt: nextUtcMidnight(),
    byKind,
    settings: {
      defaultModel: settings.defaultModel,
      allowedModels: settings.allowedModels,
      maxTokensPerCall: settings.maxTokensPerCall,
      curatorChatEnabled: settings.curatorChatEnabled,
    },
  };
}

/**
 * Агрегат расхода по всем кураторам сессии — для организатора.
 */
async function getSessionUsageReport({ sessionId }) {
  const result = await query(
    `select curator_id,
            coalesce(sum(input_tokens), 0)::bigint as input_tokens,
            coalesce(sum(output_tokens), 0)::bigint as output_tokens,
            count(*)::int as calls,
            max(occurred_at) as last_at
       from llm_usage_ledger
       where session_id = $1
         and occurred_at >= (current_date at time zone 'UTC')
       group by curator_id
       order by (sum(input_tokens) + sum(output_tokens)) desc`,
    [sessionId],
  );
  return result.rows.map((row) => ({
    curatorId: row.curator_id,
    inputTokens: Number(row.input_tokens),
    outputTokens: Number(row.output_tokens),
    totalTokens: Number(row.input_tokens) + Number(row.output_tokens),
    calls: row.calls,
    lastAt: row.last_at,
  }));
}

function nextUtcMidnight() {
  const now = new Date();
  const tomorrow = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0),
  );
  return tomorrow.toISOString();
}

/**
 * Грубая оценка стоимости в микроцентах. Цены актуальны на 2026 (см.
 * docs.anthropic.com), при изменении — править здесь. Используется только
 * для отчётности; не блокирует вызовы.
 */
function estimateCostMicros(model, usage) {
  // Микроцентов за 1k токенов. Cached input ниже — но в Anthropic cache_read
  // считается отдельным полем (cacheReadTokens), для OpenAI — кеш автоматический,
  // отражён в prompt_tokens_details. Здесь упрощённо считаем по input/output.
  const PRICES = {
    // Anthropic
    "claude-haiku-4-5": { input: 100, output: 500 },
    "claude-sonnet-4-5": { input: 300, output: 1500 },
    "claude-opus-4-7": { input: 1500, output: 7500 },
    // OpenAI (приблизительно; уточнить по openai.com/pricing при ревью)
    "gpt-5-mini": { input: 25, output: 200 },
    "gpt-5": { input: 125, output: 1000 },
    "gpt-4o-mini": { input: 15, output: 60 },
    "gpt-4o": { input: 250, output: 1000 },
  };
  const p = PRICES[model] || PRICES["claude-haiku-4-5"];
  const inputMicros = Math.round(((usage.inputTokens || 0) * p.input) / 1000);
  const outputMicros = Math.round(((usage.outputTokens || 0) * p.output) / 1000);
  return inputMicros + outputMicros;
}

module.exports = {
  resolveModel,
  ensureBudget,
  recordUsage,
  getCuratorUsageReport,
  getSessionUsageReport,
};
