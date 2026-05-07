import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { jsonApi } from "./jsonApi";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ui/Toast";

// Query key factory — stable arrays used for caching and invalidation
const qk = {
  participantDiary: (userId, sessionId) => ["participant", "diary", userId, sessionId],
  curatorDashboard: (userId, sessionId, groupId) => [
    "curator",
    "dashboard",
    userId,
    sessionId,
    groupId,
  ],
  curatorBrief: (userId, sessionId, groupId, dayId) => [
    "curator",
    "brief",
    userId,
    sessionId,
    groupId,
    dayId || "default",
  ],
  returnPoints: (userId) => ["participant", "return-points", userId],
  organizerWorkspace: (userId, sessionId) => ["organizer", "workspace", userId, sessionId],
  adminDashboard: (userId) => ["admin", "dashboard", userId],
  adminWorkspace: (userId) => ["admin", "workspace", userId],
};

// Generic mutation helper: runs any async executor, shows toast, exposes saving/error state.
// Callers do: mutation.runMutation(() => someApi.call(...))
function useCommandMutation(messages = {}) {
  const addToast = useToast();
  const { mutateAsync, isPending, error } = useMutation({
    mutationFn: (executor) => executor(),
  });

  const runMutation = useCallback(
    async (executor) => {
      try {
        const result = await mutateAsync(executor);
        if (messages.success) addToast(messages.success, "success");
        return result;
      } catch {
        if (messages.error) addToast(messages.error, "error");
        return null;
      }
    },
    [mutateAsync, messages.success, messages.error, addToast],
  );

  return { saving: isPending, mutationError: error, runMutation };
}

// Normalises a react-query result to the shape the views expect.
function queryShape(query, queryKey, queryClient) {
  return {
    data: query.data ?? null,
    loading: query.isLoading,
    error: query.error,
    refresh: query.refetch,
    setData: (updater) => queryClient.setQueryData(queryKey, updater),
    setError: () => {},
  };
}

function mergeOrganizerAnalyticsSnapshot(previous, analytics) {
  if (!previous || !analytics) {
    return previous;
  }

  return {
    ...previous,
    meta: { ...(previous.meta || {}), ...(analytics.meta || {}) },
    summary: analytics.summary || previous.summary,
    groupsSummary: analytics.groupsSummary || previous.groupsSummary,
    sessionSummary: analytics.sessionSummary || previous.sessionSummary,
    speakerLectureSummary: analytics.speakerLectureSummary || previous.speakerLectureSummary,
    dataState: analytics.dataState || previous.dataState,
    eventPulse: analytics.eventPulse || previous.eventPulse,
    groupPulse: analytics.groupPulse || previous.groupPulse,
    participantScatter: analytics.participantScatter || previous.participantScatter,
    operationalBrief: analytics.operationalBrief || previous.operationalBrief,
    curatorCandidates: analytics.curatorCandidates || previous.curatorCandidates,
  };
}

export function useParticipantDiary(sessionId) {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const addToast = useToast();
  const userId = currentUser?.id;

  const query = useQuery({
    queryKey: qk.participantDiary(userId, sessionId),
    queryFn: () => jsonApi.getParticipantDiary(userId, sessionId),
    enabled: Boolean(userId && sessionId),
  });

  const updateEntry = useCallback(
    async (dayId, entryId, patch) => {
      if (!userId) return null;

      const key = qk.participantDiary(userId, sessionId);
      const previousData = queryClient.getQueryData(key);

      queryClient.setQueryData(key, (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          history: prev.history.map((day) =>
            day.id === dayId
              ? {
                  ...day,
                  events: day.events.map((entry) =>
                    entry.id === entryId
                      ? {
                          ...entry,
                          ...patch,
                          reflectionAnswers: patch.reflectionAnswers || entry.reflectionAnswers,
                          answered: true,
                          respondedAt: new Date().toISOString(),
                        }
                      : entry,
                  ),
                }
              : day,
          ),
        };
      });

      try {
        const nextData = await jsonApi.updateParticipantEntry(
          userId,
          sessionId,
          dayId,
          entryId,
          patch,
        );
        queryClient.setQueryData(key, nextData);
        addToast("Сохранено", "success");
        return nextData;
      } catch (error) {
        queryClient.setQueryData(key, previousData);
        addToast("Ошибка сохранения", "error");
        throw error;
      }
    },
    [userId, sessionId, queryClient, addToast],
  );

  const updateReflection = useCallback(
    async (dayId, patch) => {
      if (!userId) return null;

      const key = qk.participantDiary(userId, sessionId);
      const previousData = queryClient.getQueryData(key);

      queryClient.setQueryData(key, (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          history: prev.history.map((day) => {
            if (day.id !== dayId) return day;
            const reflection = {
              ...day.reflection,
              ...patch,
              answers: { ...(day.reflection?.answers || {}), ...(patch.answers || {}) },
            };
            const answered =
              ["q1", "q2", "q3", "mind", "heart", "will", "freeText"].some((field) =>
                String(reflection[field] || "").trim(),
              ) || Object.values(reflection.answers || {}).some((v) => String(v || "").trim());
            return {
              ...day,
              reflection: {
                ...reflection,
                answered,
                respondedAt: answered ? new Date().toISOString() : null,
              },
            };
          }),
        };
      });

      try {
        const nextData = await jsonApi.updateParticipantReflection(userId, sessionId, dayId, patch);
        queryClient.setQueryData(key, nextData);
        addToast("Сохранено", "success");
        return nextData;
      } catch (error) {
        queryClient.setQueryData(key, previousData);
        addToast("Ошибка сохранения", "error");
        throw error;
      }
    },
    [userId, sessionId, queryClient, addToast],
  );

  return {
    ...queryShape(query, qk.participantDiary(userId, sessionId), queryClient),
    updateEntry,
    updateReflection,
  };
}

export function useCuratorDashboard(sessionId, groupId) {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const userId = currentUser?.id;
  const queryKey = qk.curatorDashboard(userId, sessionId, groupId);

  const query = useQuery({
    queryKey,
    queryFn: () => jsonApi.getCuratorDashboard(userId, sessionId, groupId),
    enabled: Boolean(userId && sessionId && groupId),
  });

  return queryShape(query, queryKey, queryClient);
}

export function useCuratorBrief(sessionId, groupId, dayId = null) {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const userId = currentUser?.id;
  const queryKey = qk.curatorBrief(userId, sessionId, groupId, dayId);

  const query = useQuery({
    queryKey,
    queryFn: () => jsonApi.getCuratorBrief(userId, sessionId, groupId, dayId),
    enabled: Boolean(userId && sessionId && groupId),
  });

  return queryShape(query, queryKey, queryClient);
}

export function useReturnPoints() {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const userId = currentUser?.id;
  const queryKey = qk.returnPoints(userId);

  const query = useQuery({
    queryKey,
    queryFn: () => jsonApi.getReturnPoints(userId),
    enabled: Boolean(userId),
  });

  const mutation = useCommandMutation({
    success: "Запись сохранена",
    error: "Не удалось сохранить запись",
  });

  const submit = useCallback(
    async ({ sessionId, touchpointIndex, content, isAnonymous, isHiddenFromCurator }) => {
      if (!userId) return null;
      const result = await mutation.runMutation(() =>
        jsonApi.submitReturnEntry(userId, sessionId, touchpointIndex, {
          content,
          isAnonymous,
          isHiddenFromCurator,
        }),
      );
      // Refresh the cached list so the optimistic state lines up.
      queryClient.invalidateQueries({ queryKey });
      return result;
    },
    [userId, queryKey, queryClient, mutation],
  );

  return {
    ...queryShape(query, queryKey, queryClient),
    submit,
    submitting: mutation.saving,
  };
}

export function useOrganizerWorkspace(sessionId) {
  const { currentUser, refreshBootstrap, refreshUsers } = useAuth();
  const queryClient = useQueryClient();
  const userId = currentUser?.id;
  const queryKey = qk.organizerWorkspace(userId, sessionId);

  const mutation = useCommandMutation({ success: "Сохранено", error: "Ошибка сохранения" });

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const [workspace, overview, analytics] = await Promise.all([
        jsonApi.getOrganizerWorkspace(userId, sessionId),
        jsonApi.getOrganizerSessionOverview(userId),
        jsonApi.getOrganizerAnalytics(userId, sessionId),
      ]);
      return mergeOrganizerAnalyticsSnapshot(
        { ...workspace, sessionCatalog: overview.sessions || [] },
        analytics,
      );
    },
    enabled: Boolean(userId && sessionId),
    refetchInterval: mutation.saving ? false : 30000,
  });

  const createSession = useCallback(
    async (payload) => {
      const session = await jsonApi.createOrganizerSession(userId, payload);
      await refreshUsers?.();
      await refreshBootstrap?.();
      await query.refetch();
      return session;
    },
    [userId, refreshBootstrap, refreshUsers, query.refetch],
  );

  const withRefetch = (executor) =>
    mutation.runMutation(async () => {
      await executor();
      return query.refetch();
    });

  const run = (executor) => mutation.runMutation(executor);

  return {
    ...queryShape(query, queryKey, queryClient),
    saving: mutation.saving,
    mutationError: mutation.mutationError,
    createSession,
    updateSession: (payload) =>
      withRefetch(() => jsonApi.updateOrganizerSession(userId, sessionId, payload)),
    updateRegistration: (payload) =>
      withRefetch(() => jsonApi.updateOrganizerRegistration(userId, sessionId, payload)),
    updateSessionSettings: (payload) =>
      run(() => jsonApi.updateOrganizerSessionSettings(userId, sessionId, payload)),
    createProgram: (payload) =>
      run(() => jsonApi.createOrganizerProgram(userId, sessionId, payload)),
    updateProgram: (programId, payload) =>
      run(() => jsonApi.updateOrganizerProgram(userId, sessionId, programId, payload)),
    publishProgram: (programId) =>
      run(() => jsonApi.publishOrganizerProgram(userId, sessionId, programId)),
    draftProgram: (programId) =>
      run(() => jsonApi.draftOrganizerProgram(userId, sessionId, programId)),
    selectProgram: (programId) =>
      run(() => jsonApi.selectOrganizerProgram(userId, sessionId, programId)),
    createProgramDay: (programId, payload) =>
      run(() => jsonApi.createOrganizerProgramDay(userId, sessionId, programId, payload)),
    updateProgramDay: (programId, dayId, payload) =>
      run(() => jsonApi.updateOrganizerProgramDay(userId, sessionId, programId, dayId, payload)),
    deleteProgramDay: (programId, dayId) =>
      run(() => jsonApi.deleteOrganizerProgramDay(userId, sessionId, programId, dayId)),
    updateProgramDayFlowOrder: (programId, dayId, flowOrder) =>
      run(() =>
        jsonApi.updateOrganizerProgramDayFlowOrder(userId, sessionId, programId, dayId, flowOrder),
      ),
    updateProgramDayFlows: (programId, dayId, flows) =>
      run(() => jsonApi.updateOrganizerProgramDayFlows(userId, sessionId, programId, dayId, flows)),
    updateEvent: (programId, dayId, eventId, patch) =>
      run(() => jsonApi.updateOrganizerEvent(userId, sessionId, programId, dayId, eventId, patch)),
    addParallelEvent: (programId, dayId, payload) =>
      run(() => jsonApi.addOrganizerParallelEvent(userId, sessionId, programId, dayId, payload)),
    deleteEvent: (programId, dayId, eventId) =>
      run(() => jsonApi.deleteOrganizerEvent(userId, sessionId, programId, dayId, eventId)),
    activateEvent: (programId, dayId, eventId) =>
      run(() => jsonApi.activateOrganizerEvent(userId, sessionId, programId, dayId, eventId)),
    createGroup: (payload) => run(() => jsonApi.createOrganizerGroup(userId, sessionId, payload)),
    updateGroup: (groupId, payload) =>
      run(() => jsonApi.updateOrganizerGroup(userId, sessionId, groupId, payload)),
    deleteGroup: (groupId) => run(() => jsonApi.deleteOrganizerGroup(userId, sessionId, groupId)),
    assignGroupCurator: (groupId, curatorId) =>
      run(() => jsonApi.assignOrganizerGroupCurator(userId, sessionId, groupId, curatorId)),
    assignGroupParticipants: (groupId, participantIds) =>
      run(() =>
        jsonApi.assignOrganizerGroupParticipants(userId, sessionId, groupId, participantIds),
      ),
    createSurvey: (payload) => run(() => jsonApi.createOrganizerSurvey(userId, sessionId, payload)),
    updateSurvey: (surveyId, payload) =>
      run(() => jsonApi.updateOrganizerSurvey(userId, sessionId, surveyId, payload)),
    addSurveyQuestion: (surveyId, payload) =>
      run(() => jsonApi.addOrganizerSurveyQuestion(userId, sessionId, surveyId, payload)),
    updateSurveyQuestion: (surveyId, questionId, payload) =>
      run(() =>
        jsonApi.updateOrganizerSurveyQuestion(userId, sessionId, surveyId, questionId, payload),
      ),
    publishSurvey: (surveyId, filters) =>
      run(() => jsonApi.publishOrganizerSurvey(userId, sessionId, surveyId, filters)),
  };
}

export function useOrganizerDashboard(sessionId) {
  return useOrganizerWorkspace(sessionId);
}

export function useAdminDashboard() {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const userId = currentUser?.id;
  const queryKey = qk.adminDashboard(userId);

  const query = useQuery({
    queryKey,
    queryFn: () => jsonApi.getAdminDashboard(userId),
    enabled: Boolean(userId),
  });

  return queryShape(query, queryKey, queryClient);
}

export function useAdminWorkspace() {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const userId = currentUser?.id;
  const queryKey = qk.adminWorkspace(userId);

  const mutation = useCommandMutation({ success: "Сохранено", error: "Ошибка сохранения" });

  const query = useQuery({
    queryKey,
    queryFn: () => jsonApi.getAdminWorkspace(userId),
    enabled: Boolean(userId),
  });

  const refreshAfter = (executor) =>
    mutation.runMutation(async () => {
      await executor();
      return queryClient.invalidateQueries({ queryKey });
    });

  return {
    ...queryShape(query, queryKey, queryClient),
    saving: mutation.saving,
    mutationError: mutation.mutationError,
    createUser: (payload) => refreshAfter(() => jsonApi.createAdminUser(userId, payload)),
    updateUser: (uid, payload) => refreshAfter(() => jsonApi.updateAdminUser(userId, uid, payload)),
    updateUserStatus: (uid, status) =>
      refreshAfter(() => jsonApi.updateAdminUserStatus(userId, uid, status)),
    upsertAssignment: (uid, payload) =>
      refreshAfter(() => jsonApi.upsertAdminAssignment(userId, uid, payload)),
    createSession: (payload) => refreshAfter(() => jsonApi.createAdminSession(userId, payload)),
    updateSession: (sid, payload) =>
      refreshAfter(() => jsonApi.updateAdminSession(userId, sid, payload)),
    updateRegistration: (sid, payload) =>
      refreshAfter(() => jsonApi.updateAdminRegistration(userId, sid, payload)),
    createMagicLink: (payload) => jsonApi.createMagicLink(userId, payload),
  };
}

// Methodology v4: журнализация выбора этапа пути + careful_mode участником.
// На успех инвалидирует bootstrap-кеш (там лежит journeyStage / isCarefulMode),
// чтобы AppLayout и onboarding modal сразу увидели актуальное значение.
export function useJourneyStageMutation() {
  const { currentUser, refreshBootstrap } = useAuth();
  const userId = currentUser?.id;
  const sessionId = currentUser?.sessionId;
  const mutation = useCommandMutation({
    success: "Этап сохранён",
    error: "Не удалось сохранить",
  });

  const updateJourneyStage = useCallback(
    async (patch) => {
      if (!userId || !sessionId) return null;
      const result = await mutation.runMutation(() =>
        jsonApi.updateJourneyStage(userId, sessionId, patch),
      );
      if (result && refreshBootstrap) {
        await refreshBootstrap();
      }
      return result;
    },
    [userId, sessionId, mutation, refreshBootstrap],
  );

  return { saving: mutation.saving, error: mutation.mutationError, updateJourneyStage };
}
