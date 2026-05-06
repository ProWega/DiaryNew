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

async function requestJson(path: string, options: RequestOptions = {}): Promise<unknown> {
  const method = (options.method ?? "GET").toUpperCase();
  const csrfHeader: Record<string, string> = MUTATING_METHODS.has(method)
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

    try {
      const payload = (await response.json()) as { message?: string };
      message = payload.message ?? message;
    } catch {
      message = response.statusText || message;
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

  getCuratorDashboard(
    viewerId: string | number,
    sessionId: string | number,
    groupId: string | number,
  ) {
    return requestJson(`/api/curator/sessions/${sessionId}/groups/${groupId}/dashboard`, {
      headers: viewerHeaders(viewerId),
    });
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
};
