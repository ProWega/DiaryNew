"use strict";

const { createHttpError } = require("../lib/routeHelpers.cjs");

function normalizeFlowOrder(value) {
  const source = Array.isArray(value) ? value : [];
  return Array.from(
    new Set(
      source
        .map((item) =>
          typeof item === "string" ? item : item?.id || item?.value || item?.parallelGroup || "",
        )
        .map((item) => String(item).trim())
        .filter(Boolean),
    ),
  );
}

function normalizeFlowId(value, fallback = "A") {
  const id = String(value || "").trim();
  return id || fallback;
}

function normalizeFlowMeta(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([rawId, rawMeta]) => {
        const id = normalizeFlowId(rawId, "");
        if (!id) {
          return null;
        }

        const meta =
          rawMeta && typeof rawMeta === "object" && !Array.isArray(rawMeta)
            ? rawMeta
            : { label: rawMeta };
        return [
          id,
          {
            label: String(meta.label || meta.title || id).trim() || id,
            track: String(meta.track || "").trim(),
          },
        ];
      })
      .filter(Boolean),
  );
}

function getFlowEventIds(day) {
  return normalizeFlowOrder((day?.events || []).map((event) => event?.parallelGroup || "A"));
}

function normalizeFlowDefinitions(day, nextFlows = null) {
  const flowMeta = normalizeFlowMeta(day?.flowMeta || day?.flow_meta);
  const flowMap = new Map();
  const pushFlow = (rawFlow, fallbackIndex = 0) => {
    const id = normalizeFlowId(
      typeof rawFlow === "string"
        ? rawFlow
        : rawFlow?.id || rawFlow?.value || rawFlow?.parallelGroup,
      "",
    );

    if (!id || flowMap.has(id)) {
      return;
    }

    const firstEvent = (day?.events || []).find(
      (event) => normalizeFlowId(event?.parallelGroup) === id,
    );
    const meta = flowMeta[id] || {};
    const label =
      typeof rawFlow === "string"
        ? meta.label || rawFlow
        : rawFlow?.label || rawFlow?.title || meta.label || id;
    const track =
      typeof rawFlow === "string"
        ? meta.track || firstEvent?.track || ""
        : rawFlow?.track || meta.track || firstEvent?.track || "";

    flowMap.set(id, {
      id,
      label: String(label || id).trim() || id,
      track: String(track || "").trim(),
      _index: fallbackIndex,
    });
  };

  if (Array.isArray(nextFlows)) {
    nextFlows.forEach(pushFlow);
  } else {
    (day?.flows || []).forEach(pushFlow);
    normalizeFlowOrder(day?.flowOrder).forEach(pushFlow);
  }

  getFlowEventIds(day).forEach(pushFlow);

  if (!flowMap.size) {
    pushFlow("A");
  }

  return Array.from(flowMap.values()).map(({ _index, ...flow }) => flow);
}

function validateFlowDefinitions(flows) {
  const seenLabels = new Set();
  for (const flow of flows) {
    const label = String(flow?.label || "").trim();
    if (!flow?.id || !label) {
      throw createHttpError(400, "Flow name is required.");
    }

    const labelKey = label.toLowerCase();
    if (seenLabels.has(labelKey)) {
      throw createHttpError(400, "Flow names must be unique within the day.");
    }
    seenLabels.add(labelKey);
  }
}

function syncDayFlows(day, nextFlows = null) {
  const flows = normalizeFlowDefinitions(day, nextFlows);
  const flowMeta = normalizeFlowMeta(day?.flowMeta || day?.flow_meta);
  const nextMeta = {};

  for (const flow of flows) {
    nextMeta[flow.id] = {
      label: flow.label || flowMeta[flow.id]?.label || flow.id,
      track: flow.track || flowMeta[flow.id]?.track || "",
    };
  }

  day.flows = flows.map((flow) => ({
    id: flow.id,
    label: nextMeta[flow.id].label,
    track: nextMeta[flow.id].track,
  }));
  day.flowOrder = day.flows.map((flow) => flow.id);
  day.flowMeta = nextMeta;
  return day.flows;
}

function parseTimeToMinutes(value) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
}

function getEventStartMinutes(event) {
  return parseTimeToMinutes(event?.start) ?? 9 * 60;
}

function getEventEndMinutes(event) {
  const start = getEventStartMinutes(event);
  const end = parseTimeToMinutes(event?.end);
  return end !== null && end > start ? end : start + 60;
}

function rangesOverlap(firstStart, firstEnd, secondStart, secondEnd) {
  return firstStart < secondEnd && secondStart < firstEnd;
}

function mergeDayFlowOrder(day, nextOrder = day?.flowOrder) {
  const ordered = normalizeFlowOrder(nextOrder);
  for (const event of day?.events || []) {
    const parallelGroup = String(event?.parallelGroup || "A").trim() || "A";
    if (!ordered.includes(parallelGroup)) {
      ordered.push(parallelGroup);
    }
  }

  return ordered.length ? ordered : ["A"];
}

function ensureFlowInDay(day, parallelGroup, flowPatch = {}) {
  const nextGroup = String(parallelGroup || "A").trim() || "A";
  const flows = normalizeFlowDefinitions(day);
  const existingFlow = flows.find((flow) => flow.id === nextGroup);
  if (existingFlow) {
    existingFlow.label = flowPatch.label || existingFlow.label || nextGroup;
    existingFlow.track = flowPatch.track || existingFlow.track || "";
  } else {
    flows.push({
      id: nextGroup,
      label: flowPatch.label || nextGroup,
      track: flowPatch.track || "",
    });
  }
  syncDayFlows(day, flows);
}

function compactDayFlowOrder(day) {
  const existingFlows = normalizeFlowDefinitions(day);
  syncDayFlows(day, existingFlows.length ? existingFlows : [{ id: "A", label: "A", track: "" }]);
}

function validateEventSchedule(day, candidate, excludedEventId = null) {
  const start = parseTimeToMinutes(candidate?.start);
  const end = parseTimeToMinutes(candidate?.end);

  if (start === null || end === null) {
    throw createHttpError(400, "Укажите время в формате ЧЧ:ММ.");
  }

  if (end <= start) {
    throw createHttpError(400, "Окончание должно быть позже начала.");
  }

  const candidateGroup = candidate.parallelGroup || "A";
  const conflict = (day?.events || []).find((event) => {
    if (event.id === excludedEventId || (event.parallelGroup || "A") !== candidateGroup) {
      return false;
    }

    return rangesOverlap(start, end, getEventStartMinutes(event), getEventEndMinutes(event));
  });

  if (conflict) {
    throw createHttpError(
      409,
      `Конфликт с мероприятием "${conflict.title || "Без названия"}" в этом потоке.`,
    );
  }
}

module.exports = {
  normalizeFlowOrder,
  normalizeFlowId,
  normalizeFlowMeta,
  getFlowEventIds,
  normalizeFlowDefinitions,
  validateFlowDefinitions,
  syncDayFlows,
  mergeDayFlowOrder,
  ensureFlowInDay,
  compactDayFlowOrder,
  parseTimeToMinutes,
  getEventStartMinutes,
  getEventEndMinutes,
  rangesOverlap,
  validateEventSchedule,
};
