import { stateScale } from "../data/mockData";

export const stateById = Object.fromEntries(
  stateScale.map((item) => [item.id, item]),
);

export function formatAverage(value) {
  return value.toFixed(1).replace(".", ",");
}

export function getStateInfo(stateId, fallbackId = "balance") {
  return stateById[stateId] || stateById[fallbackId] || stateScale[0];
}

export function getStateLevel(stateId, fallbackLevel = 3) {
  const state = stateById[stateId];
  return Number.isFinite(Number(state?.level)) ? state.level : fallbackLevel;
}

export function calculateMetrics(events = [], progress) {
  const marked = events.filter((event) => {
    const hasExplicitAnswer =
      event?.answered === true || Boolean(event?.respondedAt) || event?.answered === undefined;
    return hasExplicitAnswer && event?.stateId && stateById[event.stateId];
  });
  const levels = marked.map((event) => stateById[event.stateId].level);

  if (!levels.length) {
    return {
      average: 0,
      amplitude: 0,
      peaks: 0,
      drops: 0,
      sharpTransitions: 0,
      completion: progress?.completion ?? 0,
      distribution: stateScale.map((state) => ({
        id: state.id,
        label: state.label,
        color: state.color,
        count: 0,
      })),
    };
  }

  const average = levels.reduce((sum, level) => sum + level, 0) / levels.length;
  const amplitude = Math.max(...levels) - Math.min(...levels);
  const peaks = levels.filter((level) => level >= 5).length;
  const drops = levels.filter((level) => level <= 1).length;
  const sharpTransitions = levels.reduce((count, level, index) => {
    if (index === 0) {
      return count;
    }

    return Math.abs(level - levels[index - 1]) >= 2 ? count + 1 : count;
  }, 0);

  const distribution = stateScale.map((state) => ({
    id: state.id,
    label: state.label,
    color: state.color,
    count: marked.filter((event) => event.stateId === state.id).length,
  }));

  return {
    average,
    amplitude,
    peaks,
    drops,
    sharpTransitions,
    completion: progress?.completion ?? Math.round((marked.length / Math.max(events.length, 1)) * 100),
    distribution,
  };
}

export function buildPortrait(events, metrics) {
  const bestEvent = events.reduce((best, event) => {
    if (!event.stateId) {
      return best;
    }

    if (!best) {
      return event;
    }

    return getStateLevel(event.stateId) > getStateLevel(best.stateId)
      ? event
      : best;
  }, null);

  const lowestEvent = events.reduce((worst, event) => {
    if (!event.stateId) {
      return worst;
    }

    if (!worst) {
      return event;
    }

    return getStateLevel(event.stateId) < getStateLevel(worst.stateId)
      ? event
      : worst;
  }, null);

  const bullets = [
    `Средний ритм дня: ${metrics.average >= 3.5 ? "между Балансом и Вовлечённостью" : "ближе к спокойному восстановлению"}.`,
    bestEvent
      ? `Пик включённости: «${bestEvent.title}» (${getStateInfo(bestEvent.stateId).label}).`
      : "Пик включённости пока не определён.",
    lowestEvent
      ? `Самая уязвимая точка: «${lowestEvent.title}» (${getStateInfo(lowestEvent.stateId).label}).`
      : "Просадок пока нет.",
  ];

  if (metrics.sharpTransitions > 0) {
    bullets.push(
      `Есть ${metrics.sharpTransitions} резких перехода, значит куратору стоит проверить плотность дня и логистику.`,
    );
  } else {
    bullets.push("Траектория ровная: резких скачков по дню почти нет.");
  }

  return bullets;
}

export function getStatusTone(status) {
  if (status === "risk") {
    return { label: "Нужно внимание", className: "tone-risk" };
  }

  if (status === "watch") {
    return { label: "Под наблюдением", className: "tone-watch" };
  }

  return { label: "Стабильно", className: "tone-ok" };
}
