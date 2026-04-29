async function requestJson(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    let message = "API request failed";

    try {
      const payload = await response.json();
      message = payload.message || message;
    } catch {
      message = response.statusText || message;
    }

    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return response.json();
}

function viewerHeaders(viewerId) {
  return {
    "x-viewer-id": viewerId,
  };
}

export const jsonApi = {
  getAuthMe() {
    return requestJson("/api/auth/me");
  },

  logout() {
    return requestJson("/api/auth/logout", {
      method: "POST",
    });
  },

  createMagicLink(viewerId, payload) {
    return requestJson("/api/auth/magic-links", {
      method: "POST",
      headers: viewerHeaders(viewerId),
      body: payload,
    });
  },

  consumeMagicLink(token) {
    return requestJson("/api/auth/magic-links/consume", {
      method: "POST",
      body: { token },
    });
  },

  setupAdmin(payload) {
    return requestJson("/api/setup/admin", {
      method: "POST",
      body: payload,
    });
  },

  listUsers() {
    return requestJson("/api/users");
  },

  listPublicEvents() {
    return requestJson("/api/public/events");
  },

  registerParticipant(payload) {
    return requestJson("/api/participants/register", {
      method: "POST",
      body: payload,
    });
  },

  getBootstrap(viewerId) {
    return requestJson("/api/bootstrap", {
      headers: viewerHeaders(viewerId),
    });
  },

  getParticipantDiary(viewerId, sessionId) {
    return requestJson(`/api/participant/sessions/${sessionId}/diary`, {
      headers: viewerHeaders(viewerId),
    });
  },

  updateParticipantEntry(viewerId, sessionId, dayId, entryId, patch) {
    return requestJson(`/api/participant/sessions/${sessionId}/diary/${entryId}`, {
      method: "PATCH",
      headers: viewerHeaders(viewerId),
      body: {
        dayId,
        ...patch,
      },
    });
  },

  updateParticipantReflection(viewerId, sessionId, dayId, patch) {
    return requestJson(`/api/participant/sessions/${sessionId}/reflections/${dayId}`, {
      method: "PATCH",
      headers: viewerHeaders(viewerId),
      body: patch,
    });
  },

  getCuratorDashboard(viewerId, sessionId, groupId) {
    return requestJson(`/api/curator/sessions/${sessionId}/groups/${groupId}/dashboard`, {
      headers: viewerHeaders(viewerId),
    });
  },

  analyzeCuratorComments(viewerId, sessionId, groupId, payload = {}) {
    return requestJson(`/api/prototype/llm/sessions/${sessionId}/groups/${groupId}/comment-analysis`, {
      method: "POST",
      headers: viewerHeaders(viewerId),
      body: payload,
    });
  },

  updateCuratorLlmSettings(viewerId, sessionId, groupId, payload = {}) {
    return requestJson(`/api/prototype/llm/sessions/${sessionId}/groups/${groupId}/settings`, {
      method: "PATCH",
      headers: viewerHeaders(viewerId),
      body: payload,
    });
  },

  getOrganizerWorkspace(viewerId, sessionId) {
    return requestJson(`/api/organizer/sessions/${sessionId}/workspace`, {
      headers: viewerHeaders(viewerId),
    });
  },

  getOrganizerAnalytics(viewerId, sessionId) {
    return requestJson(`/api/organizer/sessions/${sessionId}/analytics`, {
      headers: viewerHeaders(viewerId),
    });
  },

  createOrganizerGroup(viewerId, sessionId, payload) {
    return requestJson(`/api/organizer/sessions/${sessionId}/groups`, {
      method: "POST",
      headers: viewerHeaders(viewerId),
      body: payload,
    });
  },

  updateOrganizerGroup(viewerId, sessionId, groupId, payload) {
    return requestJson(`/api/organizer/sessions/${sessionId}/groups/${groupId}`, {
      method: "PATCH",
      headers: viewerHeaders(viewerId),
      body: payload,
    });
  },

  deleteOrganizerGroup(viewerId, sessionId, groupId) {
    return requestJson(`/api/organizer/sessions/${sessionId}/groups/${groupId}`, {
      method: "DELETE",
      headers: viewerHeaders(viewerId),
    });
  },

  assignOrganizerGroupCurator(viewerId, sessionId, groupId, curatorId) {
    return requestJson(`/api/organizer/sessions/${sessionId}/groups/${groupId}/curator`, {
      method: "PATCH",
      headers: viewerHeaders(viewerId),
      body: { curatorId },
    });
  },

  assignOrganizerGroupParticipants(viewerId, sessionId, groupId, participantIds) {
    return requestJson(`/api/organizer/sessions/${sessionId}/groups/${groupId}/participants`, {
      method: "POST",
      headers: viewerHeaders(viewerId),
      body: { participantIds },
    });
  },

  getOrganizerSessionOverview(viewerId) {
    return requestJson("/api/organizer/workspace", {
      headers: viewerHeaders(viewerId),
    });
  },

  createOrganizerSession(viewerId, payload) {
    return requestJson("/api/organizer/sessions", {
      method: "POST",
      headers: viewerHeaders(viewerId),
      body: payload,
    });
  },

  updateOrganizerSession(viewerId, sessionId, payload) {
    return requestJson(`/api/organizer/sessions/${sessionId}`, {
      method: "PATCH",
      headers: viewerHeaders(viewerId),
      body: payload,
    });
  },

  updateOrganizerRegistration(viewerId, sessionId, payload) {
    return requestJson(`/api/organizer/sessions/${sessionId}/registration`, {
      method: "PATCH",
      headers: viewerHeaders(viewerId),
      body: payload,
    });
  },

  updateOrganizerSessionSettings(viewerId, sessionId, payload) {
    return requestJson(`/api/organizer/sessions/${sessionId}/settings`, {
      method: "PATCH",
      headers: viewerHeaders(viewerId),
      body: payload,
    });
  },

  createOrganizerProgram(viewerId, sessionId, payload) {
    return requestJson(`/api/organizer/sessions/${sessionId}/programs`, {
      method: "POST",
      headers: viewerHeaders(viewerId),
      body: payload,
    });
  },

  updateOrganizerProgram(viewerId, sessionId, programId, payload) {
    return requestJson(`/api/organizer/sessions/${sessionId}/programs/${programId}`, {
      method: "PATCH",
      headers: viewerHeaders(viewerId),
      body: payload,
    });
  },

  publishOrganizerProgram(viewerId, sessionId, programId) {
    return requestJson(`/api/organizer/sessions/${sessionId}/programs/${programId}/publish`, {
      method: "POST",
      headers: viewerHeaders(viewerId),
    });
  },

  draftOrganizerProgram(viewerId, sessionId, programId) {
    return requestJson(`/api/organizer/sessions/${sessionId}/programs/${programId}/draft`, {
      method: "POST",
      headers: viewerHeaders(viewerId),
    });
  },

  selectOrganizerProgram(viewerId, sessionId, programId) {
    return requestJson(`/api/organizer/sessions/${sessionId}/programs/${programId}/select`, {
      method: "POST",
      headers: viewerHeaders(viewerId),
    });
  },

  createOrganizerProgramDay(viewerId, sessionId, programId, payload) {
    return requestJson(`/api/organizer/sessions/${sessionId}/programs/${programId}/days`, {
      method: "POST",
      headers: viewerHeaders(viewerId),
      body: payload,
    });
  },

  updateOrganizerProgramDay(viewerId, sessionId, programId, dayId, payload) {
    return requestJson(`/api/organizer/sessions/${sessionId}/programs/${programId}/days/${dayId}`, {
      method: "PATCH",
      headers: viewerHeaders(viewerId),
      body: payload,
    });
  },

  deleteOrganizerProgramDay(viewerId, sessionId, programId, dayId) {
    return requestJson(`/api/organizer/sessions/${sessionId}/programs/${programId}/days/${dayId}`, {
      method: "DELETE",
      headers: viewerHeaders(viewerId),
    });
  },

  updateOrganizerProgramDayFlowOrder(viewerId, sessionId, programId, dayId, flowOrder) {
    return requestJson(
      `/api/organizer/sessions/${sessionId}/programs/${programId}/days/${dayId}/flow-order`,
      {
        method: "PATCH",
        headers: viewerHeaders(viewerId),
        body: { flowOrder },
      },
    );
  },

  updateOrganizerProgramDayFlows(viewerId, sessionId, programId, dayId, flows) {
    return requestJson(
      `/api/organizer/sessions/${sessionId}/programs/${programId}/days/${dayId}/flows`,
      {
        method: "PATCH",
        headers: viewerHeaders(viewerId),
        body: { flows },
      },
    );
  },

  updateOrganizerEvent(viewerId, sessionId, programId, dayId, eventId, patch) {
    return requestJson(
      `/api/organizer/sessions/${sessionId}/programs/${programId}/days/${dayId}/events/${eventId}`,
      {
        method: "PATCH",
        headers: viewerHeaders(viewerId),
        body: patch,
      },
    );
  },

  addOrganizerParallelEvent(viewerId, sessionId, programId, dayId, payload) {
    return requestJson(
      `/api/organizer/sessions/${sessionId}/programs/${programId}/days/${dayId}/events/parallel`,
      {
        method: "POST",
        headers: viewerHeaders(viewerId),
        body: payload,
      },
    );
  },

  deleteOrganizerEvent(viewerId, sessionId, programId, dayId, eventId) {
    return requestJson(
      `/api/organizer/sessions/${sessionId}/programs/${programId}/days/${dayId}/events/${eventId}`,
      {
        method: "DELETE",
        headers: viewerHeaders(viewerId),
      },
    );
  },

  activateOrganizerEvent(viewerId, sessionId, programId, dayId, eventId) {
    return requestJson(
      `/api/organizer/sessions/${sessionId}/programs/${programId}/days/${dayId}/events/${eventId}/activate`,
      {
        method: "POST",
        headers: viewerHeaders(viewerId),
      },
    );
  },

  createOrganizerSurvey(viewerId, sessionId, payload) {
    return requestJson(`/api/organizer/sessions/${sessionId}/surveys`, {
      method: "POST",
      headers: viewerHeaders(viewerId),
      body: payload,
    });
  },

  updateOrganizerSurvey(viewerId, sessionId, surveyId, payload) {
    return requestJson(`/api/organizer/sessions/${sessionId}/surveys/${surveyId}`, {
      method: "PATCH",
      headers: viewerHeaders(viewerId),
      body: payload,
    });
  },

  addOrganizerSurveyQuestion(viewerId, sessionId, surveyId, payload) {
    return requestJson(`/api/organizer/sessions/${sessionId}/surveys/${surveyId}/questions`, {
      method: "POST",
      headers: viewerHeaders(viewerId),
      body: payload,
    });
  },

  updateOrganizerSurveyQuestion(viewerId, sessionId, surveyId, questionId, payload) {
    return requestJson(
      `/api/organizer/sessions/${sessionId}/surveys/${surveyId}/questions/${questionId}`,
      {
        method: "PATCH",
        headers: viewerHeaders(viewerId),
        body: payload,
      },
    );
  },

  publishOrganizerSurvey(viewerId, sessionId, surveyId, filters) {
    return requestJson(`/api/organizer/sessions/${sessionId}/surveys/${surveyId}/publish`, {
      method: "POST",
      headers: viewerHeaders(viewerId),
      body: filters,
    });
  },

  getOrganizerDashboard(viewerId, sessionId) {
    return this.getOrganizerWorkspace(viewerId, sessionId);
  },

  getAdminDashboard(viewerId) {
    return requestJson("/api/admin/dashboard", {
      headers: viewerHeaders(viewerId),
    });
  },

  getAdminWorkspace(viewerId) {
    return requestJson("/api/admin/workspace", {
      headers: viewerHeaders(viewerId),
    });
  },

  createAdminUser(viewerId, payload) {
    return requestJson("/api/admin/users", {
      method: "POST",
      headers: viewerHeaders(viewerId),
      body: payload,
    });
  },

  updateAdminUser(viewerId, userId, payload) {
    return requestJson(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: viewerHeaders(viewerId),
      body: payload,
    });
  },

  updateAdminUserStatus(viewerId, userId, status) {
    return requestJson(`/api/admin/users/${userId}/status`, {
      method: "PATCH",
      headers: viewerHeaders(viewerId),
      body: { status },
    });
  },

  upsertAdminAssignment(viewerId, userId, payload) {
    const path = payload.sessionId
      ? `/api/admin/users/${userId}/assignments/${payload.sessionId}`
      : `/api/admin/users/${userId}/assignments`;
    return requestJson(path, {
      method: payload.sessionId ? "PATCH" : "POST",
      headers: viewerHeaders(viewerId),
      body: payload,
    });
  },

  createAdminSession(viewerId, payload) {
    return requestJson("/api/admin/sessions", {
      method: "POST",
      headers: viewerHeaders(viewerId),
      body: payload,
    });
  },

  updateAdminSession(viewerId, sessionId, payload) {
    return requestJson(`/api/admin/sessions/${sessionId}`, {
      method: "PATCH",
      headers: viewerHeaders(viewerId),
      body: payload,
    });
  },

  updateAdminRegistration(viewerId, sessionId, payload) {
    return requestJson(`/api/admin/sessions/${sessionId}/registration`, {
      method: "PATCH",
      headers: viewerHeaders(viewerId),
      body: payload,
    });
  },
};
