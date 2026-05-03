"use strict";

const { normalizeList } = require("./programNormalizers.cjs");

function matchAudience(participant, filters) {
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
}

function normalizeSurveyFilters(body = {}) {
  return {
    ageMin:
      body.ageMin === "" || body.ageMin === undefined || body.ageMin === null
        ? null
        : Number(body.ageMin),
    ageMax:
      body.ageMax === "" || body.ageMax === undefined || body.ageMax === null
        ? null
        : Number(body.ageMax),
    genders: normalizeList(body.genders),
    emotionalProfiles: normalizeList(body.emotionalProfiles),
    groupIds: normalizeList(body.groupIds),
    identityStatuses: normalizeList(body.identityStatuses),
  };
}

function buildAudienceSummary(workspace, filters, recipientsCount) {
  const parts = [
    workspace.sessionLabel || workspace.sessionId,
    filters.ageMin || filters.ageMax
      ? `${filters.ageMin ?? "?"}-${filters.ageMax ?? "?"} лет`
      : "все возраста",
    filters.genders.length ? filters.genders.join(", ") : "все гендеры",
    filters.groupIds.length ? filters.groupIds.join(", ") : "все группы",
    filters.emotionalProfiles.length
      ? filters.emotionalProfiles.join(", ")
      : "все эмоциональные профили",
    filters.identityStatuses.length
      ? filters.identityStatuses.join(", ")
      : "все статусы идентичности",
    `${recipientsCount} получателей`,
  ];

  return parts.join(" · ");
}

module.exports = {
  matchAudience,
  normalizeSurveyFilters,
  buildAudienceSummary,
};
