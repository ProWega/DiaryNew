"use strict";

/**
 * Сборка контекста для чата куратора. Cacheable preamble — большой блок,
 * который меняется редко (в течение сессии) и под `cache_control: ephemeral`
 * даёт 90% скидку SDK на повторных вопросах.
 *
 * Структура:
 *   system: методология + правила «отвечай куратору как методолог-наставник,
 *           ссылайся на данные ниже, не давай императивных советов».
 *   Затем три cacheable blocks:
 *     - members группы (имя + этап пути + careful_mode)
 *     - feedback: сырые комментарии участников по мероприятиям +
 *       рефлексии на день (с именами для не-анонимных, метка «анонимно»
 *       для анонимных, скрытые от куратора отбрасываются)
 *     - extracted_text всех концепций мероприятий
 *
 * Privacy: записи перед инъекцией проходят через `applyToList(..., "curator")`
 * — `is_hidden_from_curator` отбрасывается, `is_anonymous` обнуляет имя.
 */

const { query } = require("../db/postgres.cjs");
const { applyToList } = require("../lib/privacy.cjs");
const eventConceptsStore = require("../db/repositories/eventConceptsStore.cjs");
const { normalizeFilter } = require("./chatContextFilter.cjs");

const MAX_PREAMBLE_CHARS = 200_000; // ~50k токенов; защита от переполнения контекста
const TOKEN_ESTIMATE_RATIO = 3.5; // средняя длина токена в char'ах (RU+EN)

const SYSTEM_PROMPT = `Ты — методолог-наставник, помогаешь куратору группы на программе «Дневник пути».

Контекст: куратор работает с группой 6–10 человек на 5–7-дневной смене. У каждого участника свой «этап пути» (поиск / проверка / опора / передача / бережно), участники ежедневно отмечают своё состояние (тишина / настройка / лад / подъём / сбой) и оставляют комментарии о мероприятиях, а в конце дня — пишут рефлексию. Концепции мероприятий — задумки авторов программы; они объясняют, ЧТО событие должно вызвать у участников.

Источник данных:
- «Состав группы» — список участников с их этапом пути.
- «Обратная связь участников» — реальные комментарии и рефлексии: имена не-анонимных авторов указаны прямо в записях, анонимные помечены словом «анонимно».
- «Концепции мероприятий» — выгруженные авторами тексты-задумки.

Твой стиль:
1. Отвечай ёмко: 2-4 предложения, если только куратор явно не попросил развёрнуто.
2. Опирайся ТОЛЬКО на данные из блоков выше. Не выдумывай комментарии, имена, статистику.
3. Когда отвечаешь на конкретный вопрос — цитируй короткими фрагментами (1-2 фразы) из комментариев, не пересказывай их своими словами без нужды.
4. При упоминании участника используй его имя из комментариев. Для анонимных — пиши «один участник (анонимно)» или «несколько участников».
5. Если в выбранном контексте мало данных или подходящих записей нет — так и скажи, не додумывай.
6. Не используй диагностические ярлыки (уровень, стадия, прогресс, оценка, метрика, диагноз, скилл, статус, ментор).
7. Используй методические термины: путь, тетрадь, запись, заметка, отозвалось, целостность, лад, тишина, настройка, подъём, сбой, рядом, в стороне, опора, передача, поиск, проверка, бережно, спутник, дорога.
8. Не давай советов императивом. Говори «можно подойти», «стоит обратить внимание», «возможно, важно побыть рядом».
9. Без эмодзи, без markdown-разметки заголовков. Обычные предложения. Списки в столбик — только если куратор явно попросил «по пунктам».`;

/**
 * Собирает preamble для chat LLM по правилам, заданным filter'ом.
 *
 * Filter (см. chatContextFilter.cjs):
 *  - includeMembers + memberIds[] — какие участники группы попадают в состав
 *  - includeDays + dayIds[]       — какие дни покажем в блоке обратной связи
 *  - includeConcepts + eventIds[] — какие события (по их концепциям);
 *                                    eventIds также фильтрует комментарии в feedback
 *
 * Пустой filter / `{}` нормализуется к "всё включено" (ALL_INCLUDED) —
 * backward-compat с v2.0.
 */
async function buildPreamble({ sessionId, groupId, filter } = {}) {
  const f = normalizeFilter(filter);

  // Параллельно: участники, комментарии к мероприятиям, рефлексии, концепции.
  // Если секция отключена — соответствующий запрос не делаем, block = "".
  const [members, commentsRaw, reflectionsRaw, conceptsRaw, stateLevels] = await Promise.all([
    f.includeMembers ? fetchMembers(sessionId, groupId, f.memberIds) : Promise.resolve([]),
    f.includeDays
      ? fetchEventComments({
          sessionId,
          groupId,
          dayIds: f.dayIds,
          eventIds: f.eventIds,
          memberIds: f.memberIds,
        })
      : Promise.resolve([]),
    f.includeDays
      ? fetchDayReflections({
          sessionId,
          groupId,
          dayIds: f.dayIds,
          memberIds: f.memberIds,
        })
      : Promise.resolve([]),
    f.includeConcepts ? eventConceptsStore.listBySession(sessionId) : Promise.resolve([]),
    f.includeDays ? fetchStateLevels(sessionId) : Promise.resolve([]),
  ]);

  // Фильтрация концепций по eventIds на JS-уровне (массив маленький).
  const concepts =
    f.includeConcepts && f.eventIds.length
      ? conceptsRaw.filter((c) => f.eventIds.includes(c.eventId))
      : conceptsRaw;

  // Privacy: применяем applyToList с ролью "curator". Это:
  //  - отбросит is_hidden_from_curator = true (даже если anonymous);
  //  - обнулит user_id/full_name для is_anonymous = true.
  const comments = applyToList(commentsRaw, "curator");
  const reflections = applyToList(reflectionsRaw, "curator");

  const stateLabelById = new Map(stateLevels.map((s) => [s.id, s.label]));

  const membersBlock = f.includeMembers ? formatMembers(members) : "";
  const feedbackBlock = f.includeDays
    ? formatFeedback({ comments, reflections, stateLabelById })
    : "";
  const conceptsBlock = f.includeConcepts ? formatConcepts(concepts) : "";

  // Если совокупно вышли за лимит — обрезаем концепции (самое длинное).
  let estimated = membersBlock.length + feedbackBlock.length + conceptsBlock.length;
  let trimmedConceptsBlock = conceptsBlock;
  let conceptsTruncated = false;
  if (estimated > MAX_PREAMBLE_CHARS) {
    const available = MAX_PREAMBLE_CHARS - membersBlock.length - feedbackBlock.length;
    trimmedConceptsBlock =
      available > 1000 ? conceptsBlock.slice(0, available) + "\n\n[...концепции обрезаны]" : "";
    conceptsTruncated = true;
    estimated = membersBlock.length + feedbackBlock.length + trimmedConceptsBlock.length;
  }

  return {
    systemText: SYSTEM_PROMPT,
    membersBlock,
    feedbackBlock,
    conceptsBlock: trimmedConceptsBlock,
    estimatedChars: estimated,
    estimatedTokens: Math.ceil(estimated / TOKEN_ESTIMATE_RATIO),
    contextTruncated: conceptsTruncated,
    filter: f,
  };
}

async function fetchMembers(sessionId, groupId, memberIds = []) {
  const filterById = memberIds.length > 0;
  const sql = filterById
    ? `select u.id, u.full_name, su.journey_stage, su.is_careful_mode
       from session_users su
       join users u on u.id = su.user_id
       where su.session_id = $1 and su.group_id = $2
         and su.role = 'participant' and su.status = 'active'
         and u.id = ANY($3)
       order by u.full_name`
    : `select u.id, u.full_name, su.journey_stage, su.is_careful_mode
       from session_users su
       join users u on u.id = su.user_id
       where su.session_id = $1 and su.group_id = $2
         and su.role = 'participant' and su.status = 'active'
       order by u.full_name`;
  const params = filterById ? [sessionId, groupId, memberIds] : [sessionId, groupId];
  const result = await query(sql, params);
  return result.rows.map((row) => ({
    id: row.id,
    fullName: row.full_name || "",
    journeyStage: row.journey_stage || null,
    isCarefulMode: Boolean(row.is_careful_mode),
  }));
}

/**
 * Сырые комментарии к мероприятиям (diary_entries.comment != '').
 * Фильтры: dayIds / eventIds / memberIds. Анонимные (`is_anonymous = true`)
 * не подчиняются memberIds — они всегда видны куратору.
 * `is_hidden_from_curator` обрабатывается postfetch через applyToList.
 */
async function fetchEventComments({ sessionId, groupId, dayIds, eventIds, memberIds }) {
  const params = [sessionId, groupId];
  const conditions = [
    "de.session_id = $1",
    "su.group_id = $2",
    "su.role = 'participant'",
    "su.status = 'active'",
    "de.responded_at is not null",
    "coalesce(trim(de.comment), '') <> ''",
  ];

  if (dayIds && dayIds.length) {
    params.push(dayIds);
    conditions.push(`de.day_id = ANY($${params.length})`);
  }
  if (eventIds && eventIds.length) {
    params.push(eventIds);
    conditions.push(`de.event_id = ANY($${params.length})`);
  }
  if (memberIds && memberIds.length) {
    params.push(memberIds);
    // Анонимные показываются всегда (их участник не идентифицируется именем).
    conditions.push(`(de.user_id = ANY($${params.length}) OR de.is_anonymous = true)`);
  }

  const sql = `
    select de.id, de.user_id, de.event_id, de.day_id, de.state_id, de.state_level,
           de.comment, de.responded_at, de.is_anonymous, de.is_hidden_from_curator,
           u.full_name,
           e.title as event_title, e.start_time, e.end_time,
           d.label as day_label, d.date_label, d.day_number
      from diary_entries de
      join session_users su on su.user_id = de.user_id and su.session_id = de.session_id
      left join users u on u.id = de.user_id
      left join program_events e on e.id = de.event_id
      left join program_days d on d.id = de.day_id
     where ${conditions.join(" and ")}
     order by d.day_number asc nulls last,
              e.start_time asc nulls last,
              de.responded_at asc`;

  const result = await query(sql, params);
  return result.rows.map((row) => ({
    id: row.id,
    // Поля для applyToList (snake_case + camelCase варианты — privacy.cjs смотрит на оба):
    user_id: row.user_id,
    userId: row.user_id,
    full_name: row.full_name || "",
    fullName: row.full_name || "",
    is_anonymous: Boolean(row.is_anonymous),
    is_hidden_from_curator: Boolean(row.is_hidden_from_curator),
    // Остальные поля:
    eventId: row.event_id || null,
    eventTitle: row.event_title || "",
    eventStart: row.start_time || null,
    eventEnd: row.end_time || null,
    dayId: row.day_id || null,
    dayLabel: row.day_label || (row.day_number ? `День ${row.day_number}` : ""),
    dateLabel: row.date_label || "",
    dayNumber: row.day_number || null,
    stateId: row.state_id || null,
    stateLevel: row.state_level || null,
    comment: row.comment,
    respondedAt: row.responded_at,
  }));
}

/**
 * Рефлексии на день (free_text + ответы на методические оси).
 * Не привязаны к мероприятию, поэтому фильтр eventIds на них не действует.
 * memberIds: анонимные всегда видны.
 */
async function fetchDayReflections({ sessionId, groupId, dayIds, memberIds }) {
  const params = [sessionId, groupId];
  const conditions = [
    "dr.session_id = $1",
    "su.group_id = $2",
    "su.role = 'participant'",
    "su.status = 'active'",
    "dr.responded_at is not null",
    "(coalesce(trim(dr.free_text), '') <> '' OR dr.answers <> '{}'::jsonb)",
  ];

  if (dayIds && dayIds.length) {
    params.push(dayIds);
    conditions.push(`dr.day_id = ANY($${params.length})`);
  }
  if (memberIds && memberIds.length) {
    params.push(memberIds);
    conditions.push(`(dr.user_id = ANY($${params.length}) OR dr.is_anonymous = true)`);
  }

  const sql = `
    select dr.id, dr.user_id, dr.day_id, dr.free_text, dr.answers,
           dr.responded_at, dr.is_anonymous, dr.is_hidden_from_curator,
           u.full_name,
           d.label as day_label, d.date_label, d.day_number
      from daily_reflections dr
      join session_users su on su.user_id = dr.user_id and su.session_id = dr.session_id
      left join users u on u.id = dr.user_id
      left join program_days d on d.id = dr.day_id
     where ${conditions.join(" and ")}
     order by d.day_number asc nulls last, dr.responded_at asc`;

  const result = await query(sql, params);
  return result.rows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    userId: row.user_id,
    full_name: row.full_name || "",
    fullName: row.full_name || "",
    is_anonymous: Boolean(row.is_anonymous),
    is_hidden_from_curator: Boolean(row.is_hidden_from_curator),
    dayId: row.day_id || null,
    dayLabel: row.day_label || (row.day_number ? `День ${row.day_number}` : ""),
    dateLabel: row.date_label || "",
    dayNumber: row.day_number || null,
    freeText: (row.free_text || "").trim(),
    answers: row.answers || {},
    respondedAt: row.responded_at,
  }));
}

async function fetchStateLevels(sessionId) {
  const result = await query(
    `select id, level, label, short_label
       from state_scale_levels
       where session_id = $1 and enabled = true
       order by level`,
    [sessionId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    level: row.level,
    label: row.short_label || row.label,
  }));
}

function formatMembers(members) {
  if (!members.length) return "## Состав группы\n(данных нет)";
  const lines = members.map((m) => {
    const name = m.fullName || "(имя не указано)";
    const stage = m.journeyStage ? `этап: ${m.journeyStage}` : "этап не выбран";
    const careful = m.isCarefulMode ? "; режим «бережно»" : "";
    return `- ${name} — ${stage}${careful}`;
  });
  return `## Состав группы (${members.length} участников)\n${lines.join("\n")}`;
}

/**
 * Форматирует «Обратная связь участников» как иерархию День → Мероприятие
 * → комментарий. Рефлексии — отдельные подблоки внутри дня.
 */
function formatFeedback({ comments, reflections, stateLabelById }) {
  if (!comments.length && !reflections.length) {
    return "## Обратная связь участников\n(в выбранном контексте нет комментариев и рефлексий)";
  }

  // Группируем по dayId. dayId === null собираем в «без привязки к дню».
  const dayMap = new Map();
  const ensureDay = (dayId, meta) => {
    if (!dayMap.has(dayId)) {
      dayMap.set(dayId, {
        dayId,
        label: meta?.dayLabel || (dayId ? "" : "(без привязки к дню)"),
        dateLabel: meta?.dateLabel || "",
        dayNumber: meta?.dayNumber || null,
        eventGroups: new Map(),
        reflections: [],
      });
    }
    return dayMap.get(dayId);
  };

  for (const c of comments) {
    const day = ensureDay(c.dayId, c);
    const eventKey = c.eventId || "__no_event__";
    if (!day.eventGroups.has(eventKey)) {
      day.eventGroups.set(eventKey, {
        eventId: c.eventId,
        title: c.eventTitle || (c.eventId ? "(без названия)" : "(без привязки к мероприятию)"),
        startTime: c.eventStart || null,
        endTime: c.eventEnd || null,
        comments: [],
      });
    }
    day.eventGroups.get(eventKey).comments.push(c);
  }

  for (const r of reflections) {
    const day = ensureDay(r.dayId, r);
    day.reflections.push(r);
  }

  // Сортируем дни: с заданным dayNumber по возрастанию, без — в конец.
  const days = Array.from(dayMap.values()).sort((a, b) => {
    if (a.dayNumber && b.dayNumber) return a.dayNumber - b.dayNumber;
    if (a.dayNumber) return -1;
    if (b.dayNumber) return 1;
    return 0;
  });

  const sections = days.map((day) => formatDay(day, stateLabelById));
  return `## Обратная связь участников\n\n${sections.join("\n\n")}`;
}

function formatDay(day, stateLabelById) {
  const headParts = [];
  if (day.label) headParts.push(day.label);
  if (day.dateLabel) headParts.push(day.dateLabel);
  const header = headParts.length ? headParts.join(" · ") : "День без названия";

  const totalComments = Array.from(day.eventGroups.values()).reduce(
    (sum, e) => sum + e.comments.length,
    0,
  );
  const stats = [];
  if (totalComments)
    stats.push(
      `${totalComments} ${plural(totalComments, "комментарий", "комментария", "комментариев")}`,
    );
  if (day.reflections.length) {
    stats.push(
      `${day.reflections.length} ${plural(day.reflections.length, "рефлексия", "рефлексии", "рефлексий")}`,
    );
  }
  const statsLine = stats.length ? `  (${stats.join(" · ")})` : "";

  const eventBlocks = Array.from(day.eventGroups.values())
    .sort((a, b) => {
      if (a.startTime && b.startTime) {
        return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      }
      if (a.startTime) return -1;
      if (b.startTime) return 1;
      return (a.title || "").localeCompare(b.title || "");
    })
    .map((evt) => formatEventBlock(evt, stateLabelById));

  const reflectionFreeText = day.reflections.filter((r) => r.freeText);
  const reflectionStructured = day.reflections.filter(
    (r) => Object.keys(r.answers || {}).length > 0,
  );

  const reflectionBlocks = [];
  if (reflectionFreeText.length) {
    const lines = reflectionFreeText.map((r) => {
      const author = r.is_anonymous ? "анонимно" : r.full_name || "(без имени)";
      return `- ${author}: «${sanitizeQuote(r.freeText)}»`;
    });
    reflectionBlocks.push(`#### Рефлексия дня (свободный текст)\n${lines.join("\n")}`);
  }
  if (reflectionStructured.length) {
    const lines = reflectionStructured.map((r) => {
      const author = r.is_anonymous ? "анонимно" : r.full_name || "(без имени)";
      const parts = formatReflectionAnswers(r.answers);
      return parts ? `- ${author} — ${parts}` : `- ${author}: (структурированных ответов нет)`;
    });
    reflectionBlocks.push(`#### Рефлексия дня (методические оси)\n${lines.join("\n")}`);
  }

  const bodyParts = [];
  if (eventBlocks.length) bodyParts.push(eventBlocks.join("\n\n"));
  if (reflectionBlocks.length) bodyParts.push(reflectionBlocks.join("\n\n"));
  if (!bodyParts.length) bodyParts.push("(нет данных за день)");

  return `### ${header}${statsLine}\n\n${bodyParts.join("\n\n")}`;
}

function formatEventBlock(evt, stateLabelById) {
  const timeBits = [];
  if (evt.startTime) timeBits.push(formatTime(evt.startTime));
  if (evt.endTime) timeBits.push(formatTime(evt.endTime));
  const timeStr = timeBits.length ? ` (${timeBits.join("–")})` : "";
  const title = `#### Мероприятие: «${evt.title}»${timeStr}`;
  const lines = evt.comments.map((c) => formatCommentLine(c, stateLabelById));
  return `${title}\n${lines.join("\n")}`;
}

function formatCommentLine(c, stateLabelById) {
  const author = c.is_anonymous ? "анонимно" : c.full_name || "(без имени)";
  const stateLabel = c.stateId ? stateLabelById.get(c.stateId) : null;
  const statePart = stateLabel ? ` · отметил «${stateLabel.toLowerCase()}»` : "";
  return `- ${author}${statePart}: «${sanitizeQuote(c.comment)}»`;
}

function formatReflectionAnswers(answers) {
  if (!answers || typeof answers !== "object") return "";
  const entries = Object.entries(answers).filter(([, v]) => {
    if (v === null || v === undefined) return false;
    if (typeof v === "string") return v.trim().length > 0;
    return true;
  });
  if (!entries.length) return "";
  return entries
    .map(([key, value]) => {
      const label = humanizeAnswerKey(key);
      const text = typeof value === "string" ? value.trim() : JSON.stringify(value);
      return `${label}: «${sanitizeQuote(text)}»`;
    })
    .join("; ");
}

function humanizeAnswerKey(key) {
  // Канонические ключи методологии v4.
  const map = {
    mind: "Ум",
    heart: "Сердце",
    will: "Воля",
    body: "Тело",
    soul: "Душа",
    spirit: "Дух",
  };
  if (map[key]) return map[key];
  // Иначе пытаемся снейк-кейс превратить в человекочитаемое.
  return key.replace(/_/g, " ");
}

function sanitizeQuote(text) {
  // Убираем переводы строк внутри цитаты — markdown-список потерял бы строку.
  // Длинные цитаты не обрезаем — LLM сам решит, что важно.
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/«/g, "‹")
    .replace(/»/g, "›");
}

function formatTime(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  } catch {
    return "";
  }
}

function plural(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function formatConcepts(concepts) {
  if (!concepts.length) return "## Концепции мероприятий\n(концепции не загружены)";
  const sections = concepts.map((c) => {
    return `### Событие ${c.eventId}\n${c.extractedText}`;
  });
  return `## Концепции мероприятий\n${sections.join("\n\n---\n\n")}`;
}

/**
 * Перечень того, ЧТО куратор может включить в filter: список участников группы,
 * список дней сессии, список событий с признаком наличия концепции. Используется
 * picker'ами в ChatContextDrawer (куратор) и CuratorContextBuilder (организатор).
 *
 * Privacy: участники возвращаются с полным именем (куратор всё равно их видит на
 * dashboard); events — только из этой сессии. Не показывает persona/диагнозы.
 */
async function listContextOptions({ sessionId, groupId }) {
  const [members, days, events] = await Promise.all([
    query(
      `select u.id, u.full_name
         from session_users su
         join users u on u.id = su.user_id
         where su.session_id = $1 and su.group_id = $2
           and su.role = 'participant' and su.status = 'active'
         order by u.full_name`,
      [sessionId, groupId],
    ),
    query(
      `select id, label, date_label, day_number
         from program_days
         where session_id = $1
         order by day_number nulls last, date_label nulls last`,
      [sessionId],
    ),
    query(
      `select e.id, e.title, e.day_id, d.label as day_label, d.day_number,
              (count(c.id) > 0) as has_concept
         from program_events e
         left join program_days d on d.id = e.day_id
         left join program_event_concepts c on c.event_id = e.id
         where e.session_id = $1
         group by e.id, e.title, e.day_id, d.label, d.day_number
         order by d.day_number nulls last, e.title`,
      [sessionId],
    ),
  ]);
  return {
    members: members.rows.map((r) => ({ id: r.id, fullName: r.full_name })),
    days: days.rows.map((r) => ({
      id: r.id,
      label: r.label || (r.day_number ? `День ${r.day_number}` : ""),
      dateLabel: r.date_label || null,
      dayNumber: r.day_number || null,
    })),
    events: events.rows.map((r) => ({
      id: r.id,
      title: r.title,
      dayId: r.day_id || null,
      dayLabel: r.day_label || (r.day_number ? `День ${r.day_number}` : ""),
      hasConcept: Boolean(r.has_concept),
    })),
  };
}

module.exports = {
  buildPreamble,
  listContextOptions,
  SYSTEM_PROMPT,
};
