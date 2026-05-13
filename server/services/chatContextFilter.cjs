"use strict";

/**
 * Нормализация filter'а для контекста чата куратора.
 *
 * Filter определяет ЧТО включается в LLM-preamble:
 *  - includeMembers + memberIds[] (пустой = все участники группы)
 *  - includeDays + dayIds[]      (пустой = все дни сессии)
 *  - includeConcepts + eventIds[] (пустой = все события сессии)
 *
 * Пустой объект `{}` → ALL_INCLUDED (backward-compat: текущее поведение
 * до v2.1 — все три блока, без фильтрации). Это и есть "Полный контекст".
 *
 * Backend проверяет, что переданные id принадлежат группе/сессии (на стороне
 * SQL — фильтрация WHERE group_id = $; невалидные id молча отбрасываются).
 */

const ALL_INCLUDED = Object.freeze({
  includeMembers: true,
  memberIds: [],
  includeDays: true,
  dayIds: [],
  includeConcepts: true,
  eventIds: [],
});

function normalizeStringArray(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  const out = [];
  for (const value of input) {
    const trimmed = typeof value === "string" ? value.trim() : "";
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

/**
 * Нормализует partial filter → полную, гарантированно валидную форму.
 * Принимает на вход то, что пришло из БД (может быть `{}`) или из request body.
 */
function normalizeFilter(raw) {
  if (!raw || typeof raw !== "object") return { ...ALL_INCLUDED };
  return {
    includeMembers: raw.includeMembers === undefined ? true : Boolean(raw.includeMembers),
    memberIds: normalizeStringArray(raw.memberIds),
    includeDays: raw.includeDays === undefined ? true : Boolean(raw.includeDays),
    dayIds: normalizeStringArray(raw.dayIds),
    includeConcepts: raw.includeConcepts === undefined ? true : Boolean(raw.includeConcepts),
    eventIds: normalizeStringArray(raw.eventIds),
  };
}

/**
 * Описывает filter короткой строкой для UI («3 дня, 5 участников, концепции
 * выключены»). Используется в кнопке «Контекст: ...» и в pill'е preset'а.
 */
function describeFilter(filter) {
  const f = normalizeFilter(filter);
  const parts = [];

  if (!f.includeMembers) {
    parts.push("без состава группы");
  } else if (f.memberIds.length) {
    parts.push(
      `${f.memberIds.length} ${pluralize(f.memberIds.length, "участник", "участника", "участников")}`,
    );
  }

  if (!f.includeDays) {
    parts.push("без записок");
  } else if (f.dayIds.length) {
    parts.push(`${f.dayIds.length} ${pluralize(f.dayIds.length, "день", "дня", "дней")}`);
  }

  if (!f.includeConcepts) {
    parts.push("без концепций");
  } else if (f.eventIds.length) {
    parts.push(
      `${f.eventIds.length} ${pluralize(f.eventIds.length, "концепция", "концепции", "концепций")}`,
    );
  }

  if (!parts.length) return "Полный контекст";
  return parts.join(", ");
}

function pluralize(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

/**
 * Является ли filter "full context" (всё включено, без ID-фильтров).
 */
function isAllIncluded(filter) {
  const f = normalizeFilter(filter);
  return (
    f.includeMembers &&
    f.includeDays &&
    f.includeConcepts &&
    !f.memberIds.length &&
    !f.dayIds.length &&
    !f.eventIds.length
  );
}

module.exports = {
  ALL_INCLUDED,
  normalizeFilter,
  describeFilter,
  isAllIncluded,
};
