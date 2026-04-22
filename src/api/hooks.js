import { useCallback, useEffect, useState } from "react";
import { jsonApi } from "./jsonApi";
import { useAuth } from "../auth/AuthContext";

function useAsyncResource(loader, enabled = true) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const nextData = await loader();
      setData(nextData);
      return nextData;
    } catch (nextError) {
      setError(nextError);
      return null;
    } finally {
      setLoading(false);
    }
  }, [enabled, loader]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, setData, setError, refresh };
}

function useMutation(setData) {
  const [saving, setSaving] = useState(false);
  const [mutationError, setMutationError] = useState(null);

  const runMutation = useCallback(
    async (executor) => {
      setSaving(true);
      setMutationError(null);

      try {
        const nextData = await executor();
        if (nextData) {
          setData(nextData);
        }
        return nextData;
      } catch (error) {
        setMutationError(error);
        return null;
      } finally {
        setSaving(false);
      }
    },
    [setData],
  );

  return {
    saving,
    mutationError,
    runMutation,
  };
}

function mergeOrganizerAnalyticsSnapshot(previous, analytics) {
  if (!previous || !analytics) {
    return previous;
  }

  return {
    ...previous,
    meta: {
      ...(previous.meta || {}),
      ...(analytics.meta || {}),
    },
    summary: analytics.summary || previous.summary,
    groupsSummary: analytics.groupsSummary || previous.groupsSummary,
    sessionSummary: analytics.sessionSummary || previous.sessionSummary,
    speakerLectureSummary: analytics.speakerLectureSummary || previous.speakerLectureSummary,
  };
}

export function useParticipantDiary(sessionId) {
  const { currentUser } = useAuth();
  const enabled = Boolean(currentUser?.id && sessionId);
  const resource = useAsyncResource(
    useCallback(() => jsonApi.getParticipantDiary(currentUser.id, sessionId), [
      currentUser?.id,
      sessionId,
    ]),
    enabled,
  );

  const updateEntry = useCallback(
    async (dayId, entryId, patch) => {
      if (!currentUser?.id) {
        return null;
      }

      resource.setData((previous) =>
        previous
          ? {
              ...previous,
              history: previous.history.map((day) =>
                day.id === dayId
                  ? {
                      ...day,
                      events: day.events.map((entry) =>
                        entry.id === entryId
                          ? {
                              ...entry,
                              ...patch,
                              answered: true,
                              respondedAt: new Date().toISOString(),
                            }
                          : entry,
                      ),
                    }
                  : day,
              ),
            }
          : previous,
      );

      const nextData = await jsonApi.updateParticipantEntry(
        currentUser.id,
        sessionId,
        dayId,
        entryId,
        patch,
      );
      resource.setData(nextData);
      return nextData;
    },
    [currentUser?.id, resource, sessionId],
  );

  const updateReflection = useCallback(
    async (dayId, patch) => {
      if (!currentUser?.id) {
        return null;
      }

      resource.setData((previous) =>
        previous
          ? {
              ...previous,
              history: previous.history.map((day) =>
                day.id === dayId
                  ? (() => {
                      const reflection = {
                        ...day.reflection,
                        ...patch,
                      };
                      const answered = ["q1", "q2", "q3", "freeText"].some((field) =>
                        String(reflection[field] || "").trim(),
                      );
                      return {
                        ...day,
                        reflection: {
                          ...reflection,
                          answered,
                          respondedAt: answered ? new Date().toISOString() : null,
                        },
                      };
                    })()
                  : day,
              ),
            }
          : previous,
      );

      const nextData = await jsonApi.updateParticipantReflection(
        currentUser.id,
        sessionId,
        dayId,
        patch,
      );
      resource.setData(nextData);
      return nextData;
    },
    [currentUser?.id, resource, sessionId],
  );

  return {
    ...resource,
    updateEntry,
    updateReflection,
  };
}

export function useCuratorDashboard(sessionId, groupId) {
  const { currentUser } = useAuth();

  return useAsyncResource(
    useCallback(
      () => jsonApi.getCuratorDashboard(currentUser.id, sessionId, groupId),
      [currentUser?.id, groupId, sessionId],
    ),
    Boolean(currentUser?.id && sessionId && groupId),
  );
}

export function useOrganizerWorkspace(sessionId) {
  const { currentUser, refreshBootstrap, refreshUsers } = useAuth();
  const resource = useAsyncResource(
    useCallback(async () => {
      const [workspace, overview] = await Promise.all([
        jsonApi.getOrganizerWorkspace(currentUser.id, sessionId),
        jsonApi.getOrganizerSessionOverview(currentUser.id),
      ]);
      return {
        ...workspace,
        sessionCatalog: overview.sessions || [],
      };
    }, [currentUser?.id, sessionId]),
    Boolean(currentUser?.id && sessionId),
  );
  const mutation = useMutation(resource.setData);

  const refreshAnalytics = useCallback(async () => {
    if (!currentUser?.id || !sessionId) {
      return null;
    }

    const analytics = await jsonApi.getOrganizerAnalytics(currentUser.id, sessionId);
    resource.setData((previous) => mergeOrganizerAnalyticsSnapshot(previous, analytics));
    return analytics;
  }, [currentUser?.id, resource.setData, sessionId]);

  useEffect(() => {
    if (!currentUser?.id || !sessionId || mutation.saving) {
      return undefined;
    }

    const timerId = window.setInterval(() => {
      refreshAnalytics().catch(() => {});
    }, 30000);

    return () => window.clearInterval(timerId);
  }, [currentUser?.id, mutation.saving, refreshAnalytics, sessionId]);

  const createSession = useCallback(
    async (payload) => {
      const session = await jsonApi.createOrganizerSession(currentUser.id, payload);
      await refreshUsers?.();
      await refreshBootstrap?.();
      await resource.refresh();
      return session;
    },
    [currentUser?.id, refreshBootstrap, refreshUsers, resource.refresh],
  );

  const updateSession = useCallback(
    (payload) =>
      mutation.runMutation(async () => {
        await jsonApi.updateOrganizerSession(currentUser.id, sessionId, payload);
        return resource.refresh();
      }),
    [currentUser?.id, mutation, resource, sessionId],
  );

  const updateRegistration = useCallback(
    (payload) =>
      mutation.runMutation(async () => {
        await jsonApi.updateOrganizerRegistration(currentUser.id, sessionId, payload);
        return resource.refresh();
      }),
    [currentUser?.id, mutation, resource, sessionId],
  );

  const createProgram = useCallback(
    (payload) =>
      mutation.runMutation(() => jsonApi.createOrganizerProgram(currentUser.id, sessionId, payload)),
    [currentUser?.id, mutation, sessionId],
  );

  const updateProgram = useCallback(
    (programId, payload) =>
      mutation.runMutation(() =>
        jsonApi.updateOrganizerProgram(currentUser.id, sessionId, programId, payload),
      ),
    [currentUser?.id, mutation, sessionId],
  );

  const selectProgram = useCallback(
    (programId) =>
      mutation.runMutation(() =>
        jsonApi.selectOrganizerProgram(currentUser.id, sessionId, programId),
      ),
    [currentUser?.id, mutation, sessionId],
  );

  const createProgramDay = useCallback(
    (programId, payload) =>
      mutation.runMutation(() =>
        jsonApi.createOrganizerProgramDay(currentUser.id, sessionId, programId, payload),
      ),
    [currentUser?.id, mutation, sessionId],
  );

  const updateProgramDay = useCallback(
    (programId, dayId, payload) =>
      mutation.runMutation(() =>
        jsonApi.updateOrganizerProgramDay(currentUser.id, sessionId, programId, dayId, payload),
      ),
    [currentUser?.id, mutation, sessionId],
  );

  const deleteProgramDay = useCallback(
    (programId, dayId) =>
      mutation.runMutation(() =>
        jsonApi.deleteOrganizerProgramDay(currentUser.id, sessionId, programId, dayId),
      ),
    [currentUser?.id, mutation, sessionId],
  );

  const updateProgramDayFlowOrder = useCallback(
    (programId, dayId, flowOrder) =>
      mutation.runMutation(() =>
        jsonApi.updateOrganizerProgramDayFlowOrder(
          currentUser.id,
          sessionId,
          programId,
          dayId,
          flowOrder,
        ),
      ),
    [currentUser?.id, mutation, sessionId],
  );

  const updateProgramDayFlows = useCallback(
    (programId, dayId, flows) =>
      mutation.runMutation(() =>
        jsonApi.updateOrganizerProgramDayFlows(currentUser.id, sessionId, programId, dayId, flows),
      ),
    [currentUser?.id, mutation, sessionId],
  );

  const updateEvent = useCallback(
    (programId, dayId, eventId, patch) =>
      mutation.runMutation(() =>
        jsonApi.updateOrganizerEvent(currentUser.id, sessionId, programId, dayId, eventId, patch),
      ),
    [currentUser?.id, mutation, sessionId],
  );

  const addParallelEvent = useCallback(
    (programId, dayId, payload) =>
      mutation.runMutation(() =>
        jsonApi.addOrganizerParallelEvent(currentUser.id, sessionId, programId, dayId, payload),
      ),
    [currentUser?.id, mutation, sessionId],
  );

  const deleteEvent = useCallback(
    (programId, dayId, eventId) =>
      mutation.runMutation(() =>
        jsonApi.deleteOrganizerEvent(currentUser.id, sessionId, programId, dayId, eventId),
      ),
    [currentUser?.id, mutation, sessionId],
  );

  const activateEvent = useCallback(
    (programId, dayId, eventId) =>
      mutation.runMutation(() =>
        jsonApi.activateOrganizerEvent(currentUser.id, sessionId, programId, dayId, eventId),
      ),
    [currentUser?.id, mutation, sessionId],
  );

  const createSurvey = useCallback(
    (payload) =>
      mutation.runMutation(() => jsonApi.createOrganizerSurvey(currentUser.id, sessionId, payload)),
    [currentUser?.id, mutation, sessionId],
  );

  const updateSurvey = useCallback(
    (surveyId, payload) =>
      mutation.runMutation(() =>
        jsonApi.updateOrganizerSurvey(currentUser.id, sessionId, surveyId, payload),
      ),
    [currentUser?.id, mutation, sessionId],
  );

  const addSurveyQuestion = useCallback(
    (surveyId, payload) =>
      mutation.runMutation(() =>
        jsonApi.addOrganizerSurveyQuestion(currentUser.id, sessionId, surveyId, payload),
      ),
    [currentUser?.id, mutation, sessionId],
  );

  const updateSurveyQuestion = useCallback(
    (surveyId, questionId, payload) =>
      mutation.runMutation(() =>
        jsonApi.updateOrganizerSurveyQuestion(
          currentUser.id,
          sessionId,
          surveyId,
          questionId,
          payload,
        ),
      ),
    [currentUser?.id, mutation, sessionId],
  );

  const publishSurvey = useCallback(
    (surveyId, filters) =>
      mutation.runMutation(() =>
        jsonApi.publishOrganizerSurvey(currentUser.id, sessionId, surveyId, filters),
      ),
    [currentUser?.id, mutation, sessionId],
  );

  return {
    ...resource,
    saving: mutation.saving,
    mutationError: mutation.mutationError,
    createSession,
    updateSession,
    updateRegistration,
    createProgram,
    updateProgram,
    selectProgram,
    createProgramDay,
    updateProgramDay,
    deleteProgramDay,
    updateProgramDayFlowOrder,
    updateProgramDayFlows,
    updateEvent,
    addParallelEvent,
    deleteEvent,
    activateEvent,
    createSurvey,
    updateSurvey,
    addSurveyQuestion,
    updateSurveyQuestion,
    publishSurvey,
  };
}

export function useOrganizerDashboard(sessionId) {
  return useOrganizerWorkspace(sessionId);
}

export function useAdminDashboard() {
  const { currentUser } = useAuth();

  return useAsyncResource(
    useCallback(() => jsonApi.getAdminDashboard(currentUser.id), [currentUser?.id]),
    Boolean(currentUser?.id),
  );
}

export function useAdminWorkspace() {
  const { currentUser } = useAuth();
  const resource = useAsyncResource(
    useCallback(() => jsonApi.getAdminWorkspace(currentUser.id), [currentUser?.id]),
    Boolean(currentUser?.id),
  );
  const mutation = useMutation(resource.setData);

  const refreshAfter = useCallback(
    (executor) =>
      mutation.runMutation(async () => {
        await executor();
        return resource.refresh();
      }),
    [mutation, resource],
  );

  return {
    ...resource,
    saving: mutation.saving,
    mutationError: mutation.mutationError,
    createUser: (payload) => refreshAfter(() => jsonApi.createAdminUser(currentUser.id, payload)),
    updateUser: (userId, payload) => refreshAfter(() => jsonApi.updateAdminUser(currentUser.id, userId, payload)),
    updateUserStatus: (userId, status) => refreshAfter(() => jsonApi.updateAdminUserStatus(currentUser.id, userId, status)),
    upsertAssignment: (userId, payload) => refreshAfter(() => jsonApi.upsertAdminAssignment(currentUser.id, userId, payload)),
    createSession: (payload) => refreshAfter(() => jsonApi.createAdminSession(currentUser.id, payload)),
    updateSession: (sessionId, payload) => refreshAfter(() => jsonApi.updateAdminSession(currentUser.id, sessionId, payload)),
    updateRegistration: (sessionId, payload) => refreshAfter(() => jsonApi.updateAdminRegistration(currentUser.id, sessionId, payload)),
  };
}
