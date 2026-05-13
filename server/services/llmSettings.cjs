"use strict";

/**
 * LLM-настройки на уровне заезда. Хранятся в `sessions.llm_settings jsonb`,
 * редактируются организатором/админом через PATCH сессии. Все поля
 * опциональны — недостающие подменяются дефолтами этого модуля.
 *
 * Дефолты выбраны так, чтобы система работала даже на пустом llm_settings:
 *  • defaultModel: haiku — самая дешёвая, для обычной записки достаточно.
 *  • allowedModels: только haiku — куратор не может «случайно» поднять
 *    Opus без явного разрешения организатора.
 *  • maxTokensPerCall: 500 — записка из 5-7 предложений умещается с запасом.
 *  • curatorDailyTokenBudget: 0 — безлимит (поведение «как было», пока
 *    организатор не задал явный лимит).
 *  • curatorChatEnabled: false — чат включается опт-ин: чтобы не запустить
 *    дорогой канал по умолчанию, организатор должен включить осознанно.
 *  • conceptExtractionLimit: 12000 — ~3к токенов на концепцию, разумный
 *    компромисс между полнотой и стоимостью контекста.
 */

const KNOWN_MODELS = Object.freeze([
  // Anthropic
  "claude-haiku-4-5",
  "claude-sonnet-4-5",
  "claude-opus-4-7",
  // OpenAI
  "gpt-5-mini",
  "gpt-5",
  "gpt-4o-mini",
  "gpt-4o",
]);

const DEFAULTS = Object.freeze({
  defaultModel: "claude-haiku-4-5",
  allowedModels: ["claude-haiku-4-5"],
  maxTokensPerCall: 500,
  curatorDailyTokenBudget: 0,
  curatorChatEnabled: false,
  conceptExtractionLimit: 12000,
});

const MAX_TOKENS_HARD_CAP = 8000;
const MAX_BUDGET_HARD_CAP = 10_000_000;
const MIN_EXTRACTION_LIMIT = 1000;
const MAX_EXTRACTION_LIMIT = 50000;

function clampInt(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  const floored = Math.floor(num);
  if (floored < min) return min;
  if (floored > max) return max;
  return floored;
}

function pickAllowedModels(input) {
  if (!Array.isArray(input)) return [...DEFAULTS.allowedModels];
  const filtered = input.filter((m) => KNOWN_MODELS.includes(m));
  return filtered.length ? Array.from(new Set(filtered)) : [...DEFAULTS.allowedModels];
}

function pickDefaultModel(input, allowedModels) {
  if (KNOWN_MODELS.includes(input) && allowedModels.includes(input)) return input;
  return allowedModels[0] || DEFAULTS.defaultModel;
}

/**
 * Нормализует partial llm_settings к полной, гарантированно валидной форме.
 * Принимает на вход то, что лежит в БД (может быть `{}`), или patch с PATCH-запроса.
 */
function normalizeLlmSettings(raw) {
  const safe = raw && typeof raw === "object" ? raw : {};

  const allowedModels = pickAllowedModels(safe.allowedModels);
  const defaultModel = pickDefaultModel(safe.defaultModel, allowedModels);

  return {
    defaultModel,
    allowedModels,
    maxTokensPerCall: clampInt(
      safe.maxTokensPerCall,
      64,
      MAX_TOKENS_HARD_CAP,
      DEFAULTS.maxTokensPerCall,
    ),
    curatorDailyTokenBudget: clampInt(
      safe.curatorDailyTokenBudget,
      0,
      MAX_BUDGET_HARD_CAP,
      DEFAULTS.curatorDailyTokenBudget,
    ),
    curatorChatEnabled: Boolean(safe.curatorChatEnabled),
    conceptExtractionLimit: clampInt(
      safe.conceptExtractionLimit,
      MIN_EXTRACTION_LIMIT,
      MAX_EXTRACTION_LIMIT,
      DEFAULTS.conceptExtractionLimit,
    ),
  };
}

/**
 * Слияние существующих настроек с patch'ем. Полей которых нет в patch — не
 * трогаем, остальные кламируются. Возвращает полностью валидную форму.
 */
function mergeLlmSettings(current, patch) {
  const base = normalizeLlmSettings(current);
  if (!patch || typeof patch !== "object") return base;

  const next = { ...base };
  if (Array.isArray(patch.allowedModels)) {
    next.allowedModels = pickAllowedModels(patch.allowedModels);
    // defaultModel должен оставаться в allowedModels
    if (!next.allowedModels.includes(next.defaultModel)) {
      next.defaultModel = next.allowedModels[0] || DEFAULTS.defaultModel;
    }
  }
  if (typeof patch.defaultModel === "string") {
    next.defaultModel = pickDefaultModel(patch.defaultModel, next.allowedModels);
  }
  if (patch.maxTokensPerCall !== undefined) {
    next.maxTokensPerCall = clampInt(
      patch.maxTokensPerCall,
      64,
      MAX_TOKENS_HARD_CAP,
      next.maxTokensPerCall,
    );
  }
  if (patch.curatorDailyTokenBudget !== undefined) {
    next.curatorDailyTokenBudget = clampInt(
      patch.curatorDailyTokenBudget,
      0,
      MAX_BUDGET_HARD_CAP,
      next.curatorDailyTokenBudget,
    );
  }
  if (patch.curatorChatEnabled !== undefined) {
    next.curatorChatEnabled = Boolean(patch.curatorChatEnabled);
  }
  if (patch.conceptExtractionLimit !== undefined) {
    next.conceptExtractionLimit = clampInt(
      patch.conceptExtractionLimit,
      MIN_EXTRACTION_LIMIT,
      MAX_EXTRACTION_LIMIT,
      next.conceptExtractionLimit,
    );
  }
  return next;
}

module.exports = {
  KNOWN_MODELS,
  DEFAULTS,
  normalizeLlmSettings,
  mergeLlmSettings,
};
