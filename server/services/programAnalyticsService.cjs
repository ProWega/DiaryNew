"use strict";

/**
 * «Анализ программы» — третий LLM-агент системы.
 *
 * Собирает preamble из четырёх блоков (см. agentPromptsService.BLOCK_CATALOG.program_analytics):
 *  - sessionMeta:       метаданные заезда
 *  - programDays:       структура программы (дни и мероприятия)
 *  - aggregatedFeedback: сводка по обратной связи (без имён)
 *  - eventConcepts:     extracted_text концепций мероприятий
 *
 * Прогоняет всё через LLM с админ-настраиваемым system_prompt (agent_prompts,
 * agent_type = "program_analytics") и сохраняет результат в `ai_reports`
 * (scope = "program-analytics"). Версия отчёта автоинкрементируется per
 * (session, scope).
 */

const { query } = require("../db/postgres.cjs");
const { callLlm } = require("./llmClient.cjs");
const agentPromptsService = require("./agentPromptsService.cjs");
const aiReportsStore = require("../db/repositories/aiReportsStore.cjs");

const DEFAULT_MODEL = "claude-sonnet-4-6";
const DEFAULT_MAX_TOKENS = 1500;
const MAX_PREAMBLE_CHARS = 200_000;

// ── Block builders ────────────────────────────────────────────────────────

async function buildSessionMetaBlock(sessionId) {
  const result = await query(
    `select id, name, cycle, date_label, location, start_date, end_date, description
       from sessions
      where id = $1
      limit 1`,
    [sessionId],
  );
  const row = result.rows[0];
  if (!row) return "";
  const lines = [
    `Название: ${row.name}`,
    row.cycle ? `Цикл: ${row.cycle}` : null,
    row.date_label ? `Даты: ${row.date_label}` : null,
    row.location ? `Место: ${row.location}` : null,
    row.description ? `Описание: ${row.description}` : null,
  ].filter(Boolean);
  return `## Метаданные сессии\n${lines.join("\n")}`;
}

async function buildProgramDaysBlock(sessionId) {
  const daysResult = await query(
    `select id, label, day_number, date_label
       from program_days
      where session_id = $1
      order by day_number nulls last, date_label nulls last`,
    [sessionId],
  );
  const days = daysResult.rows;
  if (!days.length) return "## Структура программы\n(программа не задана)";

  const eventsResult = await query(
    `select id, day_id, title, start_time, end_time, parallel_group
       from program_events
      where session_id = $1
      order by day_id, start_time nulls last, title`,
    [sessionId],
  );
  const eventsByDay = new Map();
  for (const e of eventsResult.rows) {
    const list = eventsByDay.get(e.day_id) || [];
    list.push(e);
    eventsByDay.set(e.day_id, list);
  }

  const sections = days.map((d) => {
    const dayHeader = `### ${d.label || `День ${d.day_number}`}${
      d.date_label ? ` (${d.date_label})` : ""
    }`;
    const events = eventsByDay.get(d.id) || [];
    if (!events.length) return `${dayHeader}\n(мероприятий нет)`;
    const evtLines = events.map((e) => {
      const time = e.start_time
        ? `${formatTime(e.start_time)}${e.end_time ? `–${formatTime(e.end_time)}` : ""} `
        : "";
      const parallel = e.parallel_group ? ` [параллель ${e.parallel_group}]` : "";
      return `- ${time}${e.title}${parallel}`;
    });
    return `${dayHeader}\n${evtLines.join("\n")}`;
  });
  return `## Структура программы\n${sections.join("\n\n")}`;
}

async function buildAggregatedFeedbackBlock(sessionId) {
  // Анонимизированная сводка: count'ы и средние, без имён и без конкретных
  // цитат (это agent_type program_analytics, не curator chat).
  const dayStats = await query(
    `select d.id, d.label, d.day_number,
            count(distinct de.user_id) filter (where de.responded_at is not null) as participants_responded,
            count(de.id) filter (where coalesce(trim(de.comment), '') <> '') as comments_count,
            count(dr.id) filter (where dr.responded_at is not null) as reflections_count
       from program_days d
       left join diary_entries de on de.day_id = d.id
       left join daily_reflections dr on dr.day_id = d.id
       where d.session_id = $1
       group by d.id, d.label, d.day_number
       order by d.day_number nulls last`,
    [sessionId],
  );
  if (!dayStats.rows.length) return "## Агрегированная обратная связь\n(данных нет)";

  const lines = dayStats.rows.map((r) => {
    const parts = [
      `участников ответило: ${r.participants_responded}`,
      `комментариев: ${r.comments_count}`,
      `рефлексий: ${r.reflections_count}`,
    ];
    return `- ${r.label || `День ${r.day_number}`}: ${parts.join(", ")}`;
  });

  // Топ-5 событий по числу комментариев — даёт LLM ощущение, что отозвалось.
  const topEvents = await query(
    `select e.id, e.title, count(de.id) as comment_count
       from program_events e
       left join diary_entries de on de.event_id = e.id and coalesce(trim(de.comment), '') <> ''
       where e.session_id = $1
       group by e.id, e.title
       order by comment_count desc
       limit 5`,
    [sessionId],
  );
  const topLines = topEvents.rows
    .filter((r) => Number(r.comment_count) > 0)
    .map((r) => `- «${r.title}» — ${r.comment_count} комментариев`);

  const sections = [
    `### По дням\n${lines.join("\n")}`,
    topLines.length ? `### Топ мероприятий по числу комментариев\n${topLines.join("\n")}` : "",
  ].filter(Boolean);

  return `## Агрегированная обратная связь\n${sections.join("\n\n")}`;
}

async function buildEventConceptsBlock(sessionId) {
  const result = await query(
    `select c.event_id, e.title, c.extracted_text
       from program_event_concepts c
       left join program_events e on e.id = c.event_id
       where c.session_id = $1
       order by e.title`,
    [sessionId],
  );
  if (!result.rows.length) return "## Концепции мероприятий\n(концепции не загружены)";
  const sections = result.rows.map((r) => {
    const title = r.title || `Событие ${r.event_id}`;
    return `### ${title}\n${(r.extracted_text || "").slice(0, 6000)}`;
  });
  return `## Концепции мероприятий\n${sections.join("\n\n---\n\n")}`;
}

const BUILDERS = {
  sessionMeta: buildSessionMetaBlock,
  programDays: buildProgramDaysBlock,
  aggregatedFeedback: buildAggregatedFeedbackBlock,
  eventConcepts: buildEventConceptsBlock,
};

function formatTime(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso).slice(0, 5);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  } catch {
    return "";
  }
}

// ── Compose preamble ──────────────────────────────────────────────────────

/**
 * Собирает preamble в порядке, заданном blocksConfig (или дефолтным из service).
 * Неизвестные ключи игнорируются (toleration на удалённые builders).
 */
async function composePreamble({ sessionId, blocksConfig }) {
  const blocks = Array.isArray(blocksConfig) ? blocksConfig : [];
  const parts = [];
  for (const block of blocks) {
    if (!block || block.enabled === false) continue;
    const builder = BUILDERS[block.key];
    if (!builder) continue;
    const text = await builder(sessionId);
    if (text) parts.push(text);
  }
  let preamble = parts.join("\n\n");
  if (preamble.length > MAX_PREAMBLE_CHARS) {
    preamble = preamble.slice(0, MAX_PREAMBLE_CHARS) + "\n\n[...preamble обрезан]";
  }
  return preamble;
}

// ── Generate + persist report ──────────────────────────────────────────────

async function generateReport({ sessionId, actorId, model, maxTokens, title } = {}) {
  if (!sessionId) throw new Error("sessionId is required");

  const resolved = await agentPromptsService.resolvePrompt("program_analytics");
  const systemText = resolved.systemText;
  const blocksConfig = resolved.blocksConfig;

  const preamble = await composePreamble({ sessionId, blocksConfig });

  const useModel = model || resolved.model || DEFAULT_MODEL;
  const useMaxTokens = maxTokens || resolved.maxTokens || DEFAULT_MAX_TOKENS;

  let llmText = "";
  let llmUsage = null;
  let llmError = null;
  const startedAt = Date.now();
  try {
    const result = await callLlm({
      model: useModel,
      maxTokens: useMaxTokens,
      systemBlocks: [{ text: systemText, cacheable: true }],
      messages: [
        {
          role: "user",
          content: preamble
            ? `Контекст программы (структурированно):\n\n${preamble}\n\nНапиши отчёт по структуре, описанной в инструкции.`
            : `Контекста программы нет. Напиши краткую заглушку, что данные не собраны.`,
        },
      ],
    });
    llmText = result.text || "";
    llmUsage = result.usage || null;
  } catch (err) {
    llmError = err?.message || String(err);
  }
  const durationMs = Date.now() - startedAt;

  // Если LLM упал — всё равно сохраняем отчёт с placeholder'ом, чтобы admin
  // видел, что попытка была. Confidence = "low" сигнализирует «авто-генерация
  // не удалась».
  const content = {
    sections: llmText ? splitIntoSections(llmText) : [],
    rawText: llmText,
    preambleLength: preamble.length,
    promptId: resolved.id,
    promptVersion: resolved.version,
    model: useModel,
    usage: llmUsage,
    durationMs,
    error: llmError,
    generatedAt: new Date().toISOString(),
  };

  const report = await aiReportsStore.insertReport({
    sessionId,
    scope: "program-analytics",
    title: title || `Анализ программы (v${resolved.version || 0})`,
    confidence: llmError ? "low" : "medium",
    content,
    createdBy: actorId,
  });

  return { report, preamble, llmError };
}

/**
 * Грубо режет текст ответа на три раздела по якорным заголовкам, чтобы UI
 * мог отобразить структурированно. Если LLM не следовал формату — отдаём
 * один раздел rawText.
 */
function splitIntoSections(text) {
  const headerRegex = /(что задумано\.?|что получилось\.?|гипотезы для следующей смены\.?)/gi;
  const positions = [];
  let m;
  while ((m = headerRegex.exec(text))) {
    positions.push({ index: m.index, header: m[1].replace(/[.\s]+$/, "") });
  }
  if (positions.length < 2) {
    return [{ heading: "Отчёт", body: text.trim() }];
  }
  const sections = [];
  for (let i = 0; i < positions.length; i += 1) {
    const start = positions[i].index;
    const end = i + 1 < positions.length ? positions[i + 1].index : text.length;
    const slice = text.slice(start, end).trim();
    const colonIdx = slice.indexOf("\n");
    const heading = positions[i].header;
    const body = slice.slice(slice.indexOf(heading) + heading.length).replace(/^[\s.:]+/, "");
    sections.push({ heading, body });
    void colonIdx;
  }
  return sections;
}

module.exports = {
  generateReport,
  composePreamble,
  // Exported for tests / introspection
  BUILDERS,
  __splitIntoSections: splitIntoSections,
};
