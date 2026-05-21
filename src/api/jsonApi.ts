import { getCsrfToken } from "../lib/csrfToken";

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
}

const MUTATING_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

async function requestJson(
  path: string,
  options: RequestOptions = {},
  retryOnCsrfFail = true,
): Promise<unknown> {
  const method = (options.method ?? "GET").toUpperCase();
  const isMutating = MUTATING_METHODS.has(method);
  const csrfHeader: Record<string, string> = isMutating
    ? { "X-CSRF-Token": getCsrfToken() ?? "" }
    : {};

  const response = await fetch(path, {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...csrfHeader,
      ...(options.headers ?? {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    let message = "API request failed";
    let payload: { message?: string; error?: string } = {};
    try {
      payload = (await response.json()) as { message?: string; error?: string };
      message = payload.message ?? message;
    } catch {
      message = response.statusText || message;
    }

    // Auto-recovery: 403 CSRF mismatch на mutating-запросе обычно означает
    // что cookie newdiary_csrf потерян (logout в соседней вкладке, чистка
    // браузером, dev-restart). Дёргаем /me — он минтит свежий CSRF cookie —
    // и повторяем запрос ровно один раз. Это спасает большинство случаев
    // «Ошибка сохранения: CSRF token mismatch» без ручного hard-refresh.
    if (isMutating && response.status === 403 && /csrf/i.test(message) && retryOnCsrfFail) {
      try {
        await fetch("/api/auth/me", { credentials: "include" });
      } catch {
        // если /me тоже упал — продолжаем выбрасывать оригинальную ошибку
      }
      return requestJson(path, options, false);
    }

    throw new ApiError(message, response.status);
  }

  return response.json();
}

function viewerHeaders(viewerId: string | number): Record<string, string> {
  return {
    "x-viewer-id": String(viewerId),
  };
}

export const jsonApi = {
  getAuthMe() {
    return requestJson("/api/auth/me");
  },

  logout() {
    return requestJson("/api/auth/logout", { method: "POST" });
  },

  createMagicLink(viewerId: string | number, payload: Record<string, unknown>) {
    return requestJson("/api/auth/magic-links", {
      method: "POST",
      headers: viewerHeaders(viewerId),
      body: payload,
    });
  },

  consumeMagicLink(token: string) {
    return requestJson("/api/auth/magic-links/consume", {
      method: "POST",
      body: { token },
    });
  },

  setupAdmin(payload: Record<string, unknown>) {
    return requestJson("/api/setup/admin", { method: "POST", body: payload });
  },

  listUsers() {
    return requestJson("/api/users");
  },

  listPublicEvents() {
    return requestJson("/api/public/events");
  },

  registerParticipant(payload: Record<string, unknown>) {
    return requestJson("/api/participants/register", {
      method: "POST",
      body: payload,
    });
  },

  getBootstrap(viewerId: string | number) {
    return requestJson("/api/bootstrap", { headers: viewerHeaders(viewerId) });
  },

  getParticipantDiary(viewerId: string | number, sessionId: string | number) {
    return requestJson(`/api/participant/sessions/${sessionId}/diary`, {
      headers: viewerHeaders(viewerId),
    });
  },

  updateParticipantEntry(
    viewerId: string | number,
    sessionId: string | number,
    dayId: string | number,
    entryId: string | number,
    patch: Record<string, unknown>,
  ) {
    return requestJson(`/api/participant/sessions/${sessionId}/diary/${entryId}`, {
      method: "PATCH",
      headers: viewerHeaders(viewerId),
      body: { dayId, ...patch },
    });
  },

  updateParticipantReflection(
    viewerId: string | number,
    sessionId: string | number,
    dayId: string | number,
    patch: Record<string, unknown>,
  ) {
    return requestJson(`/api/participant/sessions/${sessionId}/reflections/${dayId}`, {
      method: "PATCH",
      headers: viewerHeaders(viewerId),
      body: patch,
    });
  },

  updateJourneyStage(
    viewerId: string | number,
    sessionId: string | number,
    patch: { journeyStage?: string | null; isCarefulMode?: boolean },
  ) {
    return requestJson(`/api/participant/sessions/${sessionId}/journey-stage`, {
      method: "PATCH",
      headers: viewerHeaders(viewerId),
      body: patch,
    });
  },

  setParallelSelection(
    viewerId: string | number,
    sessionId: string | number,
    payload: { dayId: string; slotKey: string; eventId: string },
  ) {
    return requestJson(`/api/participant/sessions/${sessionId}/parallel-selection`, {
      method: "POST",
      headers: viewerHeaders(viewerId),
      body: payload,
    });
  },

  getReturnPoints(viewerId: string | number) {
    return requestJson(`/api/participant/diary/return-points`, {
      headers: viewerHeaders(viewerId),
    });
  },

  submitReturnEntry(
    viewerId: string | number,
    sessionId: string | number,
    touchpointIndex: number,
    patch: { content: string; isAnonymous?: boolean; isHiddenFromCurator?: boolean },
  ) {
    return requestJson(`/api/participant/diary/return-points/${sessionId}/${touchpointIndex}`, {
      method: "POST",
      headers: viewerHeaders(viewerId),
      body: patch,
    });
  },

  getCuratorDashboard(
    viewerId: string | number,
    sessionId: string | number,
    groupId: string | number,
  ) {
    return requestJson(`/api/curator/sessions/${sessionId}/groups/${groupId}/dashboard`, {
      headers: viewerHeaders(viewerId),
    });
  },

  getCuratorBrief(
    viewerId: string | number,
    sessionId: string | number,
    groupId: string | number,
    dayId?: string | null,
  ) {
    const search = dayId ? `?dayId=${encodeURIComponent(dayId)}` : "";
    return requestJson(`/api/curator/sessions/${sessionId}/groups/${groupId}/brief${search}`, {
      headers: viewerHeaders(viewerId),
    });
  },

  getCuratorSessionDays(
    viewerId: string | number,
    sessionId: string | number,
    groupId: string | number,
  ) {
    return requestJson(`/api/curator/sessions/${sessionId}/groups/${groupId}/days`, {
      headers: viewerHeaders(viewerId),
    });
  },

  getCuratorUsage(viewerId: string | number, sessionId: string | number) {
    return requestJson(`/api/curator/sessions/${sessionId}/usage/me`, {
      headers: viewerHeaders(viewerId),
    });
  },

  getCuratorChatThread(
    viewerId: string | number,
    sessionId: string | number,
    groupId: string | number,
  ) {
    return requestJson(`/api/curator/sessions/${sessionId}/groups/${groupId}/chat/thread`, {
      headers: viewerHeaders(viewerId),
    });
  },

  sendCuratorChatMessage(
    viewerId: string | number,
    sessionId: string | number,
    groupId: string | number,
    payload: { text: string; model?: string; filter?: unknown },
  ) {
    return requestJson(`/api/curator/sessions/${sessionId}/groups/${groupId}/chat/messages`, {
      method: "POST",
      headers: viewerHeaders(viewerId),
      body: payload,
    });
  },

  resetCuratorChatThread(
    viewerId: string | number,
    sessionId: string | number,
    groupId: string | number,
  ) {
    return requestJson(`/api/curator/sessions/${sessionId}/groups/${groupId}/chat/reset`, {
      method: "POST",
      headers: viewerHeaders(viewerId),
      body: {},
    });
  },

  previewCuratorChatContext(
    viewerId: string | number,
    sessionId: string | number,
    groupId: string | number,
    filter?: unknown,
  ) {
    return requestJson(`/api/curator/sessions/${sessionId}/groups/${groupId}/chat/preview`, {
      method: "POST",
      headers: viewerHeaders(viewerId),
      body: { filter },
    });
  },

  getCuratorChatContextOptions(
    viewerId: string | number,
    sessionId: string | number,
    groupId: string | number,
  ) {
    return requestJson(
      `/api/curator/sessions/${sessionId}/groups/${groupId}/chat/context-options`,
      { headers: viewerHeaders(viewerId) },
    );
  },

  getOrganizerChatContextOptions(
    viewerId: string | number,
    sessionId: string | number,
    groupId: string | number,
  ) {
    return requestJson(
      `/api/organizer/sessions/${sessionId}/groups/${groupId}/chat/context-options`,
      { headers: viewerHeaders(viewerId) },
    );
  },

  listCuratorChatPresets(
    viewerId: string | number,
    sessionId: string | number,
    groupId: string | number,
  ) {
    return requestJson(`/api/curator/sessions/${sessionId}/groups/${groupId}/chat/presets`, {
      headers: viewerHeaders(viewerId),
    });
  },

  createCuratorChatPreset(
    viewerId: string | number,
    sessionId: string | number,
    groupId: string | number,
    payload: { label: string; filter?: unknown; isDefault?: boolean },
  ) {
    return requestJson(`/api/curator/sessions/${sessionId}/groups/${groupId}/chat/presets`, {
      method: "POST",
      headers: viewerHeaders(viewerId),
      body: payload,
    });
  },

  updateCuratorChatPreset(
    viewerId: string | number,
    sessionId: string | number,
    groupId: string | number,
    presetId: string | number,
    payload: { label?: string; filter?: unknown; isDefault?: boolean },
  ) {
    return requestJson(
      `/api/curator/sessions/${sessionId}/groups/${groupId}/chat/presets/${presetId}`,
      {
        method: "PATCH",
        headers: viewerHeaders(viewerId),
        body: payload,
      },
    );
  },

  deleteCuratorChatPreset(
    viewerId: string | number,
    sessionId: string | number,
    groupId: string | number,
    presetId: string | number,
  ) {
    return requestJson(
      `/api/curator/sessions/${sessionId}/groups/${groupId}/chat/presets/${presetId}`,
      {
        method: "DELETE",
        headers: viewerHeaders(viewerId),
      },
    );
  },

  listOrganizerCuratorsForGroup(
    viewerId: string | number,
    sessionId: string | number,
    groupId: string | number,
  ) {
    return requestJson(`/api/organizer/sessions/${sessionId}/groups/${groupId}/curators`, {
      headers: viewerHeaders(viewerId),
    });
  },

  listOrganizerCuratorChatPresets(
    viewerId: string | number,
    sessionId: string | number,
    groupId: string | number,
    curatorId: string | number,
  ) {
    return requestJson(
      `/api/organizer/sessions/${sessionId}/groups/${groupId}/curators/${curatorId}/chat/presets`,
      { headers: viewerHeaders(viewerId) },
    );
  },

  createOrganizerCuratorChatPreset(
    viewerId: string | number,
    sessionId: string | number,
    groupId: string | number,
    curatorId: string | number,
    payload: { label: string; filter?: unknown; isDefault?: boolean },
  ) {
    return requestJson(
      `/api/organizer/sessions/${sessionId}/groups/${groupId}/curators/${curatorId}/chat/presets`,
      {
        method: "POST",
        headers: viewerHeaders(viewerId),
        body: payload,
      },
    );
  },

  updateOrganizerCuratorChatPreset(
    viewerId: string | number,
    sessionId: string | number,
    groupId: string | number,
    curatorId: string | number,
    presetId: string | number,
    payload: { label?: string; filter?: unknown; isDefault?: boolean },
  ) {
    return requestJson(
      `/api/organizer/sessions/${sessionId}/groups/${groupId}/curators/${curatorId}/chat/presets/${presetId}`,
      {
        method: "PATCH",
        headers: viewerHeaders(viewerId),
        body: payload,
      },
    );
  },

  deleteOrganizerCuratorChatPreset(
    viewerId: string | number,
    sessionId: string | number,
    groupId: string | number,
    curatorId: string | number,
    presetId: string | number,
  ) {
    return requestJson(
      `/api/organizer/sessions/${sessionId}/groups/${groupId}/curators/${curatorId}/chat/presets/${presetId}`,
      {
        method: "DELETE",
        headers: viewerHeaders(viewerId),
      },
    );
  },

  previewOrganizerCuratorChatContext(
    viewerId: string | number,
    sessionId: string | number,
    groupId: string | number,
    curatorId: string | number,
    filter?: unknown,
  ) {
    return requestJson(
      `/api/organizer/sessions/${sessionId}/groups/${groupId}/curators/${curatorId}/chat/preview`,
      {
        method: "POST",
        headers: viewerHeaders(viewerId),
        body: { filter },
      },
    );
  },

  getOrganizerUsage(viewerId: string | number, sessionId: string | number) {
    return requestJson(`/api/organizer/sessions/${sessionId}/usage`, {
      headers: viewerHeaders(viewerId),
    });
  },

  regenerateCuratorBrief(
    viewerId: string | number,
    sessionId: string | number,
    groupId: string | number,
    payload: { dayId?: string | null; model?: string },
  ) {
    return requestJson(`/api/curator/sessions/${sessionId}/groups/${groupId}/brief/regenerate`, {
      method: "POST",
      headers: viewerHeaders(viewerId),
      body: payload || {},
    });
  },

  async importProgramPreview(
    viewerId: string | number,
    sessionId: string | number,
    file: File,
    options: {
      mode: "heuristic" | "llm";
      model?: string;
      stopWords?: string[];
      sheetName?: string;
    },
  ) {
    const buildFormData = () => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mode", options.mode);
      if (options.model) fd.append("model", options.model);
      if (Array.isArray(options.stopWords)) {
        fd.append("stopWords", JSON.stringify(options.stopWords));
      }
      if (options.sheetName) fd.append("sheetName", options.sheetName);
      return fd;
    };
    const path = `/api/organizer/sessions/${sessionId}/programs/import-preview`;
    const send = () =>
      fetch(path, {
        method: "POST",
        credentials: "include",
        headers: {
          "X-CSRF-Token": getCsrfToken() ?? "",
          ...viewerHeaders(viewerId),
        },
        body: buildFormData(),
      });

    let response = await send();
    // Auto-recovery от 403 CSRF mismatch — миним свежий CSRF cookie через
    // /api/auth/me и retry. Тот же паттерн, что в requestJson выше.
    if (response.status === 403) {
      let payload: { message?: string } = {};
      try {
        payload = (await response.clone().json()) as { message?: string };
      } catch {
        // ignore
      }
      if (payload.message && /csrf/i.test(payload.message)) {
        try {
          await fetch("/api/auth/me", { credentials: "include" });
        } catch {
          // продолжаем
        }
        response = await send();
      }
    }
    if (!response.ok) {
      let message = "Не удалось разобрать файл";
      try {
        const payload = (await response.json()) as { message?: string };
        message = payload.message ?? message;
      } catch {
        message = response.statusText || message;
      }
      throw new ApiError(message, response.status);
    }
    return response.json();
  },

  importProgramCommit(
    viewerId: string | number,
    sessionId: string | number,
    payload: {
      draft: unknown;
      fileName?: string | null;
      mode?: "heuristic" | "llm";
      model?: string;
      conflictResolution: "create_new" | "replace_draft";
    },
  ) {
    return requestJson(`/api/organizer/sessions/${sessionId}/programs/import-commit`, {
      method: "POST",
      headers: viewerHeaders(viewerId),
      body: payload,
    });
  },

  async downloadInvitesTemplate(
    viewerId: string | number,
    sessionId: string | number,
  ): Promise<Blob> {
    // GET через fetch с x-viewer-id (просто <a href> не передаёт viewer-header
    // → backend вернёт 401 HTML, файл будет битым).
    const response = await fetch(`/api/organizer/sessions/${sessionId}/invites/template.xlsx`, {
      method: "GET",
      credentials: "include",
      headers: viewerHeaders(viewerId),
    });
    if (!response.ok) {
      let message = "Не удалось скачать шаблон";
      try {
        const payload = (await response.json()) as { message?: string };
        message = payload.message ?? message;
      } catch {
        message = response.statusText || message;
      }
      throw new ApiError(message, response.status);
    }
    return response.blob();
  },

  async previewBulkInvites(viewerId: string | number, sessionId: string | number, file: File) {
    const path = `/api/organizer/sessions/${sessionId}/invites/preview`;
    const send = () => {
      const fd = new FormData();
      fd.append("file", file);
      return fetch(path, {
        method: "POST",
        credentials: "include",
        headers: {
          "X-CSRF-Token": getCsrfToken() ?? "",
          ...viewerHeaders(viewerId),
        },
        body: fd,
      });
    };
    let response = await send();
    if (response.status === 403) {
      try {
        await fetch("/api/auth/me", { credentials: "include" });
      } catch {
        // ignore
      }
      response = await send();
    }
    if (!response.ok) {
      let message = "Не удалось разобрать шаблон";
      try {
        const payload = (await response.json()) as { message?: string };
        message = payload.message ?? message;
      } catch {
        message = response.statusText || message;
      }
      throw new ApiError(message, response.status);
    }
    return response.json();
  },

  async generateBulkInvitesPdf(
    viewerId: string | number,
    sessionId: string | number,
    payload: {
      file: File;
      letterhead?: File | null;
      layout: "card" | "table";
      title?: string;
      footer?: string;
      ttlMinutes?: number;
    },
  ): Promise<Blob> {
    const path = `/api/organizer/sessions/${sessionId}/invites/generate`;
    const send = () => {
      const fd = new FormData();
      fd.append("file", payload.file);
      if (payload.letterhead) fd.append("letterhead", payload.letterhead);
      fd.append("layout", payload.layout);
      if (payload.title) fd.append("title", payload.title);
      if (payload.footer) fd.append("footer", payload.footer);
      if (payload.ttlMinutes) fd.append("ttlMinutes", String(payload.ttlMinutes));
      return fetch(path, {
        method: "POST",
        credentials: "include",
        headers: {
          "X-CSRF-Token": getCsrfToken() ?? "",
          ...viewerHeaders(viewerId),
        },
        body: fd,
      });
    };
    let response = await send();
    if (response.status === 403) {
      try {
        await fetch("/api/auth/me", { credentials: "include" });
      } catch {
        // ignore
      }
      response = await send();
    }
    if (!response.ok) {
      let message = "Не удалось сгенерировать PDF";
      try {
        const payloadJson = (await response.json()) as { message?: string };
        message = payloadJson.message ?? message;
      } catch {
        message = response.statusText || message;
      }
      throw new ApiError(message, response.status);
    }
    return response.blob();
  },

  async uploadEventConcept(
    viewerId: string | number,
    sessionId: string | number,
    eventId: string | number,
    file: File,
  ) {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(
      `/api/organizer/sessions/${sessionId}/events/${eventId}/concepts`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "X-CSRF-Token": getCsrfToken() ?? "",
          ...viewerHeaders(viewerId),
        },
        body: formData,
      },
    );
    if (!response.ok) {
      let message = "Не удалось загрузить файл";
      try {
        const payload = (await response.json()) as { message?: string };
        message = payload.message ?? message;
      } catch {
        message = response.statusText || message;
      }
      throw new ApiError(message, response.status);
    }
    return response.json();
  },

  listEventConcepts(
    viewerId: string | number,
    sessionId: string | number,
    eventId: string | number,
  ) {
    return requestJson(`/api/organizer/sessions/${sessionId}/events/${eventId}/concepts`, {
      headers: viewerHeaders(viewerId),
    });
  },

  deleteEventConcept(
    viewerId: string | number,
    sessionId: string | number,
    eventId: string | number,
    conceptId: string | number,
  ) {
    return requestJson(
      `/api/organizer/sessions/${sessionId}/events/${eventId}/concepts/${conceptId}`,
      {
        method: "DELETE",
        headers: viewerHeaders(viewerId),
      },
    );
  },

  getOrganizerWorkspace(viewerId: string | number, sessionId: string | number) {
    return requestJson(`/api/organizer/sessions/${sessionId}/workspace`, {
      headers: viewerHeaders(viewerId),
    });
  },

  getOrganizerAnalytics(viewerId: string | number, sessionId: string | number) {
    return requestJson(`/api/organizer/sessions/${sessionId}/analytics`, {
      headers: viewerHeaders(viewerId),
    });
  },

  createOrganizerGroup(
    viewerId: string | number,
    sessionId: string | number,
    payload: Record<string, unknown>,
  ) {
    return requestJson(`/api/organizer/sessions/${sessionId}/groups`, {
      method: "POST",
      headers: viewerHeaders(viewerId),
      body: payload,
    });
  },

  updateOrganizerGroup(
    viewerId: string | number,
    sessionId: string | number,
    groupId: string | number,
    payload: Record<string, unknown>,
  ) {
    return requestJson(`/api/organizer/sessions/${sessionId}/groups/${groupId}`, {
      method: "PATCH",
      headers: viewerHeaders(viewerId),
      body: payload,
    });
  },

  deleteOrganizerGroup(
    viewerId: string | number,
    sessionId: string | number,
    groupId: string | number,
  ) {
    return requestJson(`/api/organizer/sessions/${sessionId}/groups/${groupId}`, {
      method: "DELETE",
      headers: viewerHeaders(viewerId),
    });
  },

  assignOrganizerGroupCurator(
    viewerId: string | number,
    sessionId: string | number,
    groupId: string | number,
    curatorId: string | number,
  ) {
    return requestJson(`/api/organizer/sessions/${sessionId}/groups/${groupId}/curator`, {
      method: "PATCH",
      headers: viewerHeaders(viewerId),
      body: { curatorId },
    });
  },

  assignOrganizerGroupParticipants(
    viewerId: string | number,
    sessionId: string | number,
    groupId: string | number,
    participantIds: (string | number)[],
  ) {
    return requestJson(`/api/organizer/sessions/${sessionId}/groups/${groupId}/participants`, {
      method: "POST",
      headers: viewerHeaders(viewerId),
      body: { participantIds },
    });
  },

  getOrganizerSessionOverview(viewerId: string | number) {
    return requestJson("/api/organizer/workspace", {
      headers: viewerHeaders(viewerId),
    });
  },

  createOrganizerSession(viewerId: string | number, payload: Record<string, unknown>) {
    return requestJson("/api/organizer/sessions", {
      method: "POST",
      headers: viewerHeaders(viewerId),
      body: payload,
    });
  },

  updateOrganizerSession(
    viewerId: string | number,
    sessionId: string | number,
    payload: Record<string, unknown>,
  ) {
    return requestJson(`/api/organizer/sessions/${sessionId}`, {
      method: "PATCH",
      headers: viewerHeaders(viewerId),
      body: payload,
    });
  },

  updateOrganizerRegistration(
    viewerId: string | number,
    sessionId: string | number,
    payload: Record<string, unknown>,
  ) {
    return requestJson(`/api/organizer/sessions/${sessionId}/registration`, {
      method: "PATCH",
      headers: viewerHeaders(viewerId),
      body: payload,
    });
  },

  updateOrganizerSessionSettings(
    viewerId: string | number,
    sessionId: string | number,
    payload: Record<string, unknown>,
  ) {
    return requestJson(`/api/organizer/sessions/${sessionId}/settings`, {
      method: "PATCH",
      headers: viewerHeaders(viewerId),
      body: payload,
    });
  },

  createOrganizerProgram(
    viewerId: string | number,
    sessionId: string | number,
    payload: Record<string, unknown>,
  ) {
    return requestJson(`/api/organizer/sessions/${sessionId}/programs`, {
      method: "POST",
      headers: viewerHeaders(viewerId),
      body: payload,
    });
  },

  updateOrganizerProgram(
    viewerId: string | number,
    sessionId: string | number,
    programId: string | number,
    payload: Record<string, unknown>,
  ) {
    return requestJson(`/api/organizer/sessions/${sessionId}/programs/${programId}`, {
      method: "PATCH",
      headers: viewerHeaders(viewerId),
      body: payload,
    });
  },

  publishOrganizerProgram(
    viewerId: string | number,
    sessionId: string | number,
    programId: string | number,
  ) {
    return requestJson(`/api/organizer/sessions/${sessionId}/programs/${programId}/publish`, {
      method: "POST",
      headers: viewerHeaders(viewerId),
    });
  },

  draftOrganizerProgram(
    viewerId: string | number,
    sessionId: string | number,
    programId: string | number,
  ) {
    return requestJson(`/api/organizer/sessions/${sessionId}/programs/${programId}/draft`, {
      method: "POST",
      headers: viewerHeaders(viewerId),
    });
  },

  selectOrganizerProgram(
    viewerId: string | number,
    sessionId: string | number,
    programId: string | number,
  ) {
    return requestJson(`/api/organizer/sessions/${sessionId}/programs/${programId}/select`, {
      method: "POST",
      headers: viewerHeaders(viewerId),
    });
  },

  createOrganizerProgramDay(
    viewerId: string | number,
    sessionId: string | number,
    programId: string | number,
    payload: Record<string, unknown>,
  ) {
    return requestJson(`/api/organizer/sessions/${sessionId}/programs/${programId}/days`, {
      method: "POST",
      headers: viewerHeaders(viewerId),
      body: payload,
    });
  },

  updateOrganizerProgramDay(
    viewerId: string | number,
    sessionId: string | number,
    programId: string | number,
    dayId: string | number,
    payload: Record<string, unknown>,
  ) {
    return requestJson(`/api/organizer/sessions/${sessionId}/programs/${programId}/days/${dayId}`, {
      method: "PATCH",
      headers: viewerHeaders(viewerId),
      body: payload,
    });
  },

  deleteOrganizerProgramDay(
    viewerId: string | number,
    sessionId: string | number,
    programId: string | number,
    dayId: string | number,
  ) {
    return requestJson(`/api/organizer/sessions/${sessionId}/programs/${programId}/days/${dayId}`, {
      method: "DELETE",
      headers: viewerHeaders(viewerId),
    });
  },

  updateOrganizerProgramDayFlowOrder(
    viewerId: string | number,
    sessionId: string | number,
    programId: string | number,
    dayId: string | number,
    flowOrder: unknown,
  ) {
    return requestJson(
      `/api/organizer/sessions/${sessionId}/programs/${programId}/days/${dayId}/flow-order`,
      {
        method: "PATCH",
        headers: viewerHeaders(viewerId),
        body: { flowOrder },
      },
    );
  },

  updateOrganizerProgramDayFlows(
    viewerId: string | number,
    sessionId: string | number,
    programId: string | number,
    dayId: string | number,
    flows: unknown,
  ) {
    return requestJson(
      `/api/organizer/sessions/${sessionId}/programs/${programId}/days/${dayId}/flows`,
      { method: "PATCH", headers: viewerHeaders(viewerId), body: { flows } },
    );
  },

  updateOrganizerEvent(
    viewerId: string | number,
    sessionId: string | number,
    programId: string | number,
    dayId: string | number,
    eventId: string | number,
    patch: Record<string, unknown>,
  ) {
    return requestJson(
      `/api/organizer/sessions/${sessionId}/programs/${programId}/days/${dayId}/events/${eventId}`,
      { method: "PATCH", headers: viewerHeaders(viewerId), body: patch },
    );
  },

  addOrganizerParallelEvent(
    viewerId: string | number,
    sessionId: string | number,
    programId: string | number,
    dayId: string | number,
    payload: Record<string, unknown>,
  ) {
    return requestJson(
      `/api/organizer/sessions/${sessionId}/programs/${programId}/days/${dayId}/events/parallel`,
      { method: "POST", headers: viewerHeaders(viewerId), body: payload },
    );
  },

  deleteOrganizerEvent(
    viewerId: string | number,
    sessionId: string | number,
    programId: string | number,
    dayId: string | number,
    eventId: string | number,
  ) {
    return requestJson(
      `/api/organizer/sessions/${sessionId}/programs/${programId}/days/${dayId}/events/${eventId}`,
      { method: "DELETE", headers: viewerHeaders(viewerId) },
    );
  },

  activateOrganizerEvent(
    viewerId: string | number,
    sessionId: string | number,
    programId: string | number,
    dayId: string | number,
    eventId: string | number,
  ) {
    return requestJson(
      `/api/organizer/sessions/${sessionId}/programs/${programId}/days/${dayId}/events/${eventId}/activate`,
      { method: "POST", headers: viewerHeaders(viewerId) },
    );
  },

  createOrganizerSurvey(
    viewerId: string | number,
    sessionId: string | number,
    payload: Record<string, unknown>,
  ) {
    return requestJson(`/api/organizer/sessions/${sessionId}/surveys`, {
      method: "POST",
      headers: viewerHeaders(viewerId),
      body: payload,
    });
  },

  updateOrganizerSurvey(
    viewerId: string | number,
    sessionId: string | number,
    surveyId: string | number,
    payload: Record<string, unknown>,
  ) {
    return requestJson(`/api/organizer/sessions/${sessionId}/surveys/${surveyId}`, {
      method: "PATCH",
      headers: viewerHeaders(viewerId),
      body: payload,
    });
  },

  addOrganizerSurveyQuestion(
    viewerId: string | number,
    sessionId: string | number,
    surveyId: string | number,
    payload: Record<string, unknown>,
  ) {
    return requestJson(`/api/organizer/sessions/${sessionId}/surveys/${surveyId}/questions`, {
      method: "POST",
      headers: viewerHeaders(viewerId),
      body: payload,
    });
  },

  updateOrganizerSurveyQuestion(
    viewerId: string | number,
    sessionId: string | number,
    surveyId: string | number,
    questionId: string | number,
    payload: Record<string, unknown>,
  ) {
    return requestJson(
      `/api/organizer/sessions/${sessionId}/surveys/${surveyId}/questions/${questionId}`,
      { method: "PATCH", headers: viewerHeaders(viewerId), body: payload },
    );
  },

  publishOrganizerSurvey(
    viewerId: string | number,
    sessionId: string | number,
    surveyId: string | number,
    filters: Record<string, unknown>,
  ) {
    return requestJson(`/api/organizer/sessions/${sessionId}/surveys/${surveyId}/publish`, {
      method: "POST",
      headers: viewerHeaders(viewerId),
      body: filters,
    });
  },

  getOrganizerDashboard(viewerId: string | number, sessionId: string | number) {
    return this.getOrganizerWorkspace(viewerId, sessionId);
  },

  getAdminDashboard(viewerId: string | number) {
    return requestJson("/api/admin/dashboard", {
      headers: viewerHeaders(viewerId),
    });
  },

  getAdminWorkspace(viewerId: string | number) {
    return requestJson("/api/admin/workspace", {
      headers: viewerHeaders(viewerId),
    });
  },

  createAdminUser(viewerId: string | number, payload: Record<string, unknown>) {
    return requestJson("/api/admin/users", {
      method: "POST",
      headers: viewerHeaders(viewerId),
      body: payload,
    });
  },

  updateAdminUser(
    viewerId: string | number,
    userId: string | number,
    payload: Record<string, unknown>,
  ) {
    return requestJson(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: viewerHeaders(viewerId),
      body: payload,
    });
  },

  updateAdminUserStatus(viewerId: string | number, userId: string | number, status: string) {
    return requestJson(`/api/admin/users/${userId}/status`, {
      method: "PATCH",
      headers: viewerHeaders(viewerId),
      body: { status },
    });
  },

  upsertAdminAssignment(
    viewerId: string | number,
    userId: string | number,
    payload: Record<string, unknown> & { sessionId?: string | number },
  ) {
    const path = payload.sessionId
      ? `/api/admin/users/${userId}/assignments/${payload.sessionId}`
      : `/api/admin/users/${userId}/assignments`;
    return requestJson(path, {
      method: payload.sessionId ? "PATCH" : "POST",
      headers: viewerHeaders(viewerId),
      body: payload,
    });
  },

  createAdminSession(viewerId: string | number, payload: Record<string, unknown>) {
    return requestJson("/api/admin/sessions", {
      method: "POST",
      headers: viewerHeaders(viewerId),
      body: payload,
    });
  },

  updateAdminSession(
    viewerId: string | number,
    sessionId: string | number,
    payload: Record<string, unknown>,
  ) {
    return requestJson(`/api/admin/sessions/${sessionId}`, {
      method: "PATCH",
      headers: viewerHeaders(viewerId),
      body: payload,
    });
  },

  updateAdminRegistration(
    viewerId: string | number,
    sessionId: string | number,
    payload: Record<string, unknown>,
  ) {
    return requestJson(`/api/admin/sessions/${sessionId}/registration`, {
      method: "PATCH",
      headers: viewerHeaders(viewerId),
      body: payload,
    });
  },

  // ── Admin: AI agent prompts ──────────────────────────────────────────────

  listAgentPrompts(viewerId: string | number) {
    return requestJson("/api/admin/agent-prompts", {
      headers: viewerHeaders(viewerId),
    });
  },

  getAgentPromptHistory(viewerId: string | number, agentType: string) {
    return requestJson(`/api/admin/agent-prompts/${agentType}/history`, {
      headers: viewerHeaders(viewerId),
    });
  },

  saveAgentPrompt(viewerId: string | number, agentType: string, payload: Record<string, unknown>) {
    return requestJson(`/api/admin/agent-prompts/${agentType}`, {
      method: "POST",
      headers: viewerHeaders(viewerId),
      body: payload,
    });
  },

  restoreAgentPrompt(viewerId: string | number, versionId: string) {
    return requestJson(`/api/admin/agent-prompts/restore/${versionId}`, {
      method: "POST",
      headers: viewerHeaders(viewerId),
      body: {},
    });
  },

  previewAgentPrompt(
    viewerId: string | number,
    agentType: string,
    payload: Record<string, unknown>,
  ) {
    return requestJson(`/api/admin/agent-prompts/${agentType}/preview`, {
      method: "POST",
      headers: viewerHeaders(viewerId),
      body: payload,
    });
  },

  // ── Admin: AI reports ────────────────────────────────────────────────────

  generateProgramAnalyticsReport(viewerId: string | number, payload: Record<string, unknown>) {
    return requestJson("/api/admin/ai-reports/program-analytics/generate", {
      method: "POST",
      headers: viewerHeaders(viewerId),
      body: payload,
    });
  },

  listAiReports(
    viewerId: string | number,
    params: { sessionId?: string; scope?: string; groupId?: string; limit?: number } = {},
  ) {
    const search = new URLSearchParams();
    if (params.sessionId) search.set("sessionId", params.sessionId);
    if (params.scope) search.set("scope", params.scope);
    if (params.groupId) search.set("groupId", params.groupId);
    if (params.limit) search.set("limit", String(params.limit));
    const qs = search.toString();
    return requestJson(`/api/admin/ai-reports${qs ? `?${qs}` : ""}`, {
      headers: viewerHeaders(viewerId),
    });
  },

  getAiReport(viewerId: string | number, reportId: string) {
    return requestJson(`/api/admin/ai-reports/${reportId}`, {
      headers: viewerHeaders(viewerId),
    });
  },
};
