"use strict";

/**
 * Чат «Разговор с ИИ» для куратора. Один активный thread на (curator, group),
 * полная история сообщений в DB. Контекст собирается через
 * `curatorChatContext.buildPreamble` и кладётся под `cache_control: ephemeral`
 * для скидки на повторных вопросах в том же thread.
 *
 * Soft-fail: при недоступном LLM/ошибке SDK — выбрасываем ошибку наружу
 * (route отдаёт 503 через global handler). Bookkeeping токенов идёт через
 * curatorLlmGuard.recordUsage.
 */

const { query } = require("../db/postgres.cjs");
const { createId } = require("../db/repositories/common.cjs");
const { ensureCuratorAccess } = require("../db/repositories/analyticsStore.cjs");
const { getSessionLlmSettings } = require("../db/repositories/sessionStore.cjs");
const presetsStore = require("../db/repositories/curatorChatPresetsStore.cjs");
const guard = require("./curatorLlmGuard.cjs");
const { buildPreamble } = require("./curatorChatContext.cjs");
const { normalizeFilter, ALL_INCLUDED } = require("./chatContextFilter.cjs");
const { callLlm, isProviderConfigured, detectProvider } = require("./llmClient.cjs");

const MAX_HISTORY_MESSAGES = 20;

async function getOrCreateActiveThread({ sessionId, groupId, curatorId }) {
  const existing = await query(
    `select id, status, created_at, last_message_at
       from curator_chat_threads
       where session_id = $1 and group_id = $2 and curator_id = $3 and status = 'active'
       limit 1`,
    [sessionId, groupId, curatorId],
  );
  if (existing.rows.length) return mapThread(existing.rows[0]);

  const id = createId("chat-thread");
  await query(
    `insert into curator_chat_threads (id, session_id, group_id, curator_id, status)
     values ($1, $2, $3, $4, 'active')`,
    [id, sessionId, groupId, curatorId],
  );
  return {
    id,
    status: "active",
    createdAt: new Date().toISOString(),
    lastMessageAt: null,
  };
}

async function listMessages(threadId, { limit = 100 } = {}) {
  const result = await query(
    `select id, role, content, model, usage, created_at
       from curator_chat_messages
       where thread_id = $1
       order by created_at asc
       limit $2`,
    [threadId, limit],
  );
  return result.rows.map(mapMessage);
}

async function archiveThread(threadId) {
  await query(`update curator_chat_threads set status = 'archived' where id = $1`, [threadId]);
}

async function listChatThread({ viewerId, sessionId, groupId }) {
  await ensureCuratorAccess(viewerId, sessionId, groupId);
  const settings = await getSessionLlmSettings(sessionId);
  if (!settings.curatorChatEnabled) {
    throwHttp(403, "Чат с ИИ отключён организатором");
  }

  const thread = await getOrCreateActiveThread({ sessionId, groupId, curatorId: viewerId });
  const messages = await listMessages(thread.id, { limit: 200 });
  return { ...thread, messages };
}

async function sendChatMessage({ viewerId, sessionId, groupId, text, requestedModel, filter }) {
  await ensureCuratorAccess(viewerId, sessionId, groupId);

  const settings = await getSessionLlmSettings(sessionId);
  if (!settings.curatorChatEnabled) {
    throwHttp(403, "Чат с ИИ отключён организатором");
  }
  if (!text || !text.trim()) {
    throwHttp(400, "Текст сообщения не должен быть пустым");
  }

  await guard.ensureBudget({ sessionId, curatorId: viewerId });

  const { model } = await guard.resolveModel({ sessionId, requestedModel });
  const maxTokens = settings.maxTokensPerCall;

  const thread = await getOrCreateActiveThread({ sessionId, groupId, curatorId: viewerId });
  const history = await listMessages(thread.id, { limit: MAX_HISTORY_MESSAGES * 2 });
  const historyTrimmed = history.slice(-MAX_HISTORY_MESSAGES);

  // Filter selection priority:
  //   1. Явный filter в body запроса (inline mode, picker в drawer'е).
  //   2. Default preset куратора в этой группе (если задан организатором или
  //      самим куратором через preset manager).
  //   3. ALL_INCLUDED (backward-compat — текущее поведение v2.0).
  const effectiveFilter = await resolveEffectiveFilter({
    sessionId,
    groupId,
    curatorId: viewerId,
    explicit: filter,
  });

  const preamble = await buildPreamble({ sessionId, groupId, filter: effectiveFilter });

  // Провайдер выбираем по prefix модели; если нужный ключ не настроен — 503.
  const provider = detectProvider(model);
  if (!isProviderConfigured(provider)) {
    throwHttp(
      503,
      provider === "openai"
        ? "OpenAI API не настроен (нет OPENAI_API_KEY)"
        : "Anthropic API не настроен (нет ANTHROPIC_API_KEY)",
    );
  }

  // Сначала записываем user-message, чтобы он сохранился даже если LLM
  // упадёт (куратор увидит свой вопрос и сможет ретрайнуть).
  const userMessageId = createId("chat-msg");
  await query(
    `insert into curator_chat_messages (id, thread_id, role, content)
     values ($1, $2, 'user', $3)`,
    [userMessageId, thread.id, text],
  );

  const llmResult = await callLlm({
    model,
    maxTokens,
    systemBlocks: [
      { text: preamble.systemText, cacheable: true },
      {
        text: `${preamble.membersBlock}\n\n${preamble.feedbackBlock}\n\n${preamble.conceptsBlock}`,
        cacheable: true,
      },
    ],
    messages: [
      ...historyTrimmed.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })),
      { role: "user", content: text },
    ],
  });
  const assistantText = llmResult.text || "";
  const usage = llmResult.usage;

  const assistantMessageId = createId("chat-msg");
  await query(
    `insert into curator_chat_messages (id, thread_id, role, content, model, usage)
     values ($1, $2, 'assistant', $3, $4, $5::jsonb)`,
    [assistantMessageId, thread.id, assistantText, model, JSON.stringify(usage)],
  );
  await query(`update curator_chat_threads set last_message_at = now() where id = $1`, [thread.id]);

  await guard.recordUsage({
    sessionId,
    curatorId: viewerId,
    groupId,
    kind: "chat",
    model,
    usage,
    refId: assistantMessageId,
  });

  return {
    threadId: thread.id,
    userMessage: {
      id: userMessageId,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    },
    assistantMessage: {
      id: assistantMessageId,
      role: "assistant",
      content: assistantText,
      model,
      usage,
      createdAt: new Date().toISOString(),
    },
    usage,
    contextTruncated: preamble.contextTruncated,
  };
}

async function resetChatThread({ viewerId, sessionId, groupId }) {
  await ensureCuratorAccess(viewerId, sessionId, groupId);
  const thread = await getOrCreateActiveThread({ sessionId, groupId, curatorId: viewerId });
  await archiveThread(thread.id);
  const fresh = await getOrCreateActiveThread({ sessionId, groupId, curatorId: viewerId });
  return { ...fresh, messages: [] };
}

/**
 * Preview собранного preamble без LLM-вызова. Куратор видит «что увидит ИИ»
 * до отправки сообщения; организатор — то же для конкретного куратора.
 */
async function previewChatContext({ viewerId, sessionId, groupId, filter, skipAccess = false }) {
  if (!skipAccess) {
    await ensureCuratorAccess(viewerId, sessionId, groupId);
  }
  const effectiveFilter = await resolveEffectiveFilter({
    sessionId,
    groupId,
    curatorId: viewerId,
    explicit: filter,
  });
  return await buildPreamble({ sessionId, groupId, filter: effectiveFilter });
}

/**
 * Применяет каскад: explicit filter → default preset → ALL_INCLUDED.
 * Используется и в sendChatMessage, и в previewChatContext.
 */
async function resolveEffectiveFilter({ sessionId, groupId, curatorId, explicit }) {
  if (explicit !== undefined && explicit !== null) {
    return normalizeFilter(explicit);
  }
  try {
    const def = await presetsStore.getDefault({ sessionId, groupId, curatorId });
    if (def) return def.filter;
  } catch (error) {
    // 42P01 = таблица ещё не создана (миграция не накатилась). Молча fallback.
    if (error?.code !== "42P01" && process.env.NODE_ENV !== "test") {
      console.warn("[curatorChatService] preset lookup failed:", error?.message || error);
    }
  }
  return { ...ALL_INCLUDED };
}

function mapThread(row) {
  return {
    id: row.id,
    status: row.status,
    createdAt: row.created_at,
    lastMessageAt: row.last_message_at,
  };
}

function mapMessage(row) {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    model: row.model || null,
    usage: row.usage || null,
    createdAt: row.created_at,
  };
}

function throwHttp(status, message) {
  const err = new Error(message);
  err.status = status;
  throw err;
}

module.exports = {
  listChatThread,
  sendChatMessage,
  resetChatThread,
  previewChatContext,
};
