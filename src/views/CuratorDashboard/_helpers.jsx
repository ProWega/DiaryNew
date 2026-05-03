import { stateScale } from "../../data/mockData";
import { formatNumber, formatPercent } from "../../lib/format";

export const stateByLevel = Object.fromEntries(stateScale.map((state) => [state.level, state]));
export const PULSE_DOMAIN = [0, 6];

export const DATA_STATE_COPY = {
  unpublished: {
    title: "Программа еще не опубликована",
    description: "Пульс группы появится после публикации программы организатором.",
  },
  published_empty: {
    title: "В опубликованной программе нет событий",
    description: "Кураторский бриф начнет собираться после появления событий в программе.",
  },
  no_members: {
    title: "В группе пока нет активных участников",
    description: "Данные для кураторской аналитики появятся после назначения участников в группу.",
  },
  no_responses: {
    title: "Ответов пока нет",
    description: "События уже есть, но участники еще не заполнили дневник или дневную рефлексию.",
  },
};

export const STATUS_COPY = {
  risk: { label: "Нужно внимание", className: "tone-risk" },
  watch: { label: "Под наблюдением", className: "tone-watch" },
  silent: { label: "Нет ответов", className: "tone-silent" },
  ok: { label: "Стабильно", className: "tone-ok" },
};

export function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function clamp(value, min, max) {
  if (!Number.isFinite(Number(value))) {
    return min;
  }

  return Math.max(min, Math.min(Number(value), max));
}

export function getStateByLevel(value) {
  if (!Number.isFinite(Number(value))) {
    return null;
  }

  return stateByLevel[Math.round(clamp(Number(value), PULSE_DOMAIN[0], PULSE_DOMAIN[1]))] || null;
}

export function getStateLabel(value, fallback = "Нет данных") {
  const state = getStateByLevel(value);
  return state?.shortLabel || state?.label || fallback;
}

export function formatAverageState(value) {
  if (!Number.isFinite(Number(value))) {
    return "Нет данных";
  }

  return `${getStateLabel(value)} · ${formatNumber(value)}`;
}

export function getEventShortLabel(event) {
  const title = event?.title || "Событие";
  return title.length > 18 ? `${title.slice(0, 18)}…` : title;
}

export function formatCuratorText(value) {
  return String(value ?? "").replace(
    /уровень\s+([0-6])\b/gi,
    (_, level) => `состояние «${getStateLabel(Number(level))}»`,
  );
}

export function getStatusCopy(status) {
  return STATUS_COPY[status] || STATUS_COPY.ok;
}

export function getSeverityClass(severity) {
  if (severity === "high") {
    return "is-high";
  }

  if (severity === "low") {
    return "is-low";
  }

  return "is-medium";
}

export function getConfidenceLabel(confidence) {
  if (confidence === "high") {
    return "уверенно";
  }
  if (confidence === "low") {
    return "проверить";
  }
  return "рабочая гипотеза";
}

export function getCoverageSummary(brief, dashboard) {
  const coverage = brief?.coverage;
  if (coverage) {
    return coverage;
  }

  return {
    confidence:
      Number(dashboard.completion || 0) >= 75
        ? "high"
        : Number(dashboard.completion || 0) >= 50
          ? "medium"
          : "low",
    completion: Number(dashboard.completion || 0),
    answeredEvents: Number(dashboard.progress?.answeredEvents || 0),
    totalEvents: Number(dashboard.progress?.totalEvents || 0),
    participantsCount: Number(dashboard.participantsCount || 0),
    openRisksCount: asArray(dashboard.reflectionPrep?.openRisks).length,
    summary:
      Number(dashboard.completion || 0) >= 50
        ? "Данных достаточно для рабочего разговора, но выводы стоит проверять с группой."
        : "Данных пока мало: лучше формулировать вопросы, а не выводы.",
  };
}

export function buildReflectionBriefFallback({
  focusEvents,
  participantRows,
  openRisks,
  dashboard,
}) {
  return {
    coverage: getCoverageSummary(null, dashboard),
    talkingPoints: asArray(focusEvents)
      .slice(0, 5)
      .map((event) => ({
        id: event.id,
        title: event.title,
        prompt:
          event.confidence === "low"
            ? `Уточнить, что происходило в точке «${event.title}».`
            : `Обсудить точку «${event.title}» и проверить, что повлияло на состояние группы.`,
        confidence: event.confidence || "medium",
        severity: event.severity || "medium",
        evidence: asArray(event.evidence),
      })),
    participantsToCheckIn: asArray(participantRows)
      .filter(
        (participant) =>
          ["risk", "watch", "silent"].includes(participant.status) ||
          Number(participant.openRiskSignalsCount || 0) > 0,
      )
      .slice(0, 6)
      .map((participant) => ({
        id: participant.id,
        name: participant.name,
        status: participant.status,
        confidence: participant.status === "silent" ? "medium" : "high",
        evidence: [
          getStatusCopy(participant.status).label,
          Number(participant.openRiskSignalsCount || 0) > 0
            ? `${participant.openRiskSignalsCount} открытых сигналов риска`
            : "",
          Number.isFinite(Number(participant.amplitude))
            ? `амплитуда ${formatNumber(participant.amplitude)}`
            : "",
          `заполнение ${formatPercent(participant.completion)}`,
        ].filter(Boolean),
      })),
    blindSpots:
      Number(dashboard.completion || 0) < 50
        ? [
            {
              id: "low-coverage",
              title: "Мало данных",
              detail: "Заполнение низкое, поэтому факты лучше использовать как вопросы к группе.",
              confidence: "high",
            },
          ]
        : [],
  };
}

export function getReportScopeLabel(scope) {
  if (!scope?.dayId) {
    return "Все дни";
  }

  return scope.dateLabel || scope.label || "День программы";
}

export function DataStateBanner({ state }) {
  const copy = DATA_STATE_COPY[state];

  if (!copy) {
    return null;
  }

  return (
    <article className="curator-state-banner">
      <div>
        <p className="eyebrow">Состояние данных</p>
        <h3>{copy.title}</h3>
      </div>
      <p>{copy.description}</p>
    </article>
  );
}
