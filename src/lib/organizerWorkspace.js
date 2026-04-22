export function normalizeList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

export function countAudienceMatches(audiencePool, filters) {
  return audiencePool.filter((participant) => {
    if (filters.ageMin !== null && filters.ageMin !== undefined && participant.age < filters.ageMin) {
      return false;
    }

    if (filters.ageMax !== null && filters.ageMax !== undefined && participant.age > filters.ageMax) {
      return false;
    }

    if (filters.genders?.length && !filters.genders.includes(participant.gender)) {
      return false;
    }

    if (
      filters.emotionalProfiles?.length &&
      !filters.emotionalProfiles.includes(participant.emotionalProfile)
    ) {
      return false;
    }

    if (filters.groupIds?.length && !filters.groupIds.includes(participant.groupId)) {
      return false;
    }

    if (
      filters.identityStatuses?.length &&
      !filters.identityStatuses.includes(participant.identityStatus)
    ) {
      return false;
    }

    return true;
  }).length;
}

export function formatPublicationDate(value) {
  if (!value) {
    return "Не опубликовано";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function getEventStatusLabel(status) {
  switch (status) {
    case "active":
      return "Актуально сейчас";
    case "completed":
      return "Завершено";
    default:
      return "Запланировано";
  }
}

export function getEventStatusTone(status) {
  switch (status) {
    case "active":
      return "tone-ok";
    case "completed":
      return "tone-watch";
    default:
      return "";
  }
}

export function getProgramStatusLabel(status) {
  switch (status) {
    case "published":
      return "Опубликована";
    case "archived":
      return "Архив";
    default:
      return "Черновик";
  }
}

export function getProgramStatusTone(status) {
  switch (status) {
    case "published":
      return "tone-ok";
    case "archived":
      return "tone-watch";
    default:
      return "";
  }
}

export function getSeverityTone(severity) {
  switch (severity) {
    case "high":
      return "severity-high";
    case "medium":
      return "severity-medium";
    default:
      return "";
  }
}
