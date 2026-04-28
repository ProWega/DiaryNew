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

function getAnsweredStateEvents(events = []) {
  return events.filter((event) => {
    const hasExplicitAnswer =
      event?.answered === true || Boolean(event?.respondedAt) || event?.answered === undefined;
    return hasExplicitAnswer && event?.stateId && stateById[event.stateId];
  });
}

function getStateByLevel(level) {
  return stateScale.find((state) => Number(state.level) === Number(level)) || stateById.balance || stateScale[0];
}

function getStateLabelByLevel(level) {
  const state = getStateByLevel(level);
  return state?.label || "Баланс";
}

function formatAverageRhythm(average) {
  if (!Number.isFinite(Number(average))) {
    return "пока не определён";
  }

  const clampedAverage = Math.max(0, Math.min(Number(average), stateScale.length - 1));
  const lowerLevel = Math.floor(clampedAverage);
  const upperLevel = Math.ceil(clampedAverage);

  if (lowerLevel === upperLevel || Math.abs(clampedAverage - Math.round(clampedAverage)) < 0.15) {
    return `около «${getStateLabelByLevel(Math.round(clampedAverage))}»`;
  }

  return `между «${getStateLabelByLevel(lowerLevel)}» и «${getStateLabelByLevel(upperLevel)}»`;
}

function getTransitionWord(count) {
  const normalized = Math.abs(Number(count));
  const lastTwoDigits = normalized % 100;
  const lastDigit = normalized % 10;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return "перепадов";
  }

  if (lastDigit === 1) {
    return "перепад";
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return "перепада";
  }

  return "перепадов";
}

export function calculateMetrics(events = [], progress) {
  const marked = getAnsweredStateEvents(events);
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
  const marked = getAnsweredStateEvents(events);

  if (marked.length === 0) {
    return [
      "Пока нет отметок состояния, поэтому автосводка ещё не собирается.",
      "Отметьте хотя бы несколько событий, и здесь появится более точная картина дня.",
    ];
  }

  if (marked.length === 1) {
    const onlyEvent = marked[0];
    return [
      "Пока мало отметок для вывода: видна только первая точка дня.",
      `Сейчас зафиксировано: «${onlyEvent.title}» (${getStateInfo(onlyEvent.stateId).label}).`,
      "После нескольких отметок сводка покажет ритм, устойчивость и возможные перепады.",
    ];
  }

  const highestEvent = marked.reduce((best, event) =>
    getStateLevel(event.stateId) > getStateLevel(best.stateId)
      ? event
      : best,
  marked[0]);
  const lowestEvent = marked.reduce((worst, event) =>
    getStateLevel(event.stateId) < getStateLevel(worst.stateId)
      ? event
      : worst,
  marked[0]);
  const highestLevel = getStateLevel(highestEvent.stateId);
  const lowestLevel = getStateLevel(lowestEvent.stateId);
  const allStable = marked.every((event) => {
    const level = getStateLevel(event.stateId);
    return level >= 2 && level <= 4;
  });

  const bullets = [
    `Средний ритм дня: ${formatAverageRhythm(metrics.average)}.`,
  ];

  if (highestLevel >= 5) {
    bullets.push(`Точка перенапряжения: «${highestEvent.title}» (${getStateInfo(highestEvent.stateId).label}).`);
  } else if (highestLevel >= 4) {
    bullets.push(`Самая включенная точка: «${highestEvent.title}» (${getStateInfo(highestEvent.stateId).label}).`);
  } else if (highestLevel >= 2) {
    bullets.push(`Самая ресурсная точка: «${highestEvent.title}» (${getStateInfo(highestEvent.stateId).label}).`);
  } else {
    bullets.push("По отметкам день скорее прошёл в зоне низкого ресурса, без выраженной ресурсной точки.");
  }

  if (allStable) {
    bullets.push("Критичных просадок или перенапряжения по отметкам не видно.");
  } else if (lowestLevel <= 1) {
    bullets.push(`Точка низкого ресурса: «${lowestEvent.title}» (${getStateInfo(lowestEvent.stateId).label}).`);
  } else if (highestLevel >= 5) {
    bullets.push(`Самая напряженная точка: «${highestEvent.title}» (${getStateInfo(highestEvent.stateId).label}).`);
  } else {
    bullets.push("Крайних зон по отметкам почти не видно, но ритм дня мог ощущаться неровным.");
  }

  if (metrics.sharpTransitions > 0) {
    const transitionWord = getTransitionWord(metrics.sharpTransitions);
    bullets.push(`Есть ${metrics.sharpTransitions} заметных ${transitionWord}: возможно, день ощущался неровным.`);
  } else {
    bullets.push("Траектория ровная: заметных скачков по дню почти нет.");
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
