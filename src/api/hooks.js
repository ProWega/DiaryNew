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
  curatorSessionDays: (userId, sessionId, groupId) => [
    "curator",
    "days",
    userId,
    sessionId,
    groupId,
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

  const setParallelSelection = useCallback(
    async ({ dayId, slotKey, eventId }) => {
      if (!userId) return null;
      const key = qk.participantDiary(userId, sessionId);
      try {
        const nextData = await jsonApi.setParallelSelection(userId, sessionId, {
          dayId,
          slotKey,
          eventId,
        });
        queryClient.setQueryData(key, nextData);
        return nextData;
      } catch (error) {
        addToast("Не удалось сохранить выбор блока", "error");
        throw error;
      }
    },
    [userId, sessionId, queryClient, addToast],
  );

  return {
    ...queryShape(query, qk.participantDiary(userId, sessionId), queryClient),
    updateEntry,
    updateReflection,
    setParallelSelection,
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

export function useCuratorSessionDays(sessionId, groupId) {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const userId = currentUser?.id;
  const queryKey = qk.curatorSessionDays(userId, sessionId, groupId);

  const query = useQuery({
    queryKey,
    queryFn: () => jsonApi.getCuratorSessionDays(userId, sessionId, groupId),
    enabled: Boolean(userId && sessionId && groupId),
  });

  return queryShape(query, queryKey, queryClient);
}

/**
 * Чат «Разговор с ИИ» для куратора. Один активный thread на (curator, group),
 * полная история в DB. Optimistic update — сразу показываем user-сообщение
 * пока ждём ответ ассистента.
 */
export function useCuratorChat(sessionId, groupId) {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const userId = currentUser?.id;
  const queryKey = ["curator", "chat", userId, sessionId, groupId];

  const query = useQuery({
    queryKey,
    queryFn: () => jsonApi.getCuratorChatThread(userId, sessionId, groupId),
    enabled: Boolean(userId && sessionId && groupId),
  });

  const sendMutation = useCommandMutation({ error: "Не удалось отправить сообщение" });
  const resetMutation = useCommandMutation({
    success: "Разговор начат заново",
    error: "Не удалось сбросить разговор",
  });

  const send = useCallback(
    async ({ text, model, filter } = {}) => {
      if (!userId || !sessionId || !groupId || !text?.trim()) return null;
      const optimisticUser = {
        id: `tmp-${Date.now()}`,
        role: "user",
        content: text,
        createdAt: new Date().toISOString(),
      };
      queryClient.setQueryData(queryKey, (prev) =>
        prev ? { ...prev, messages: [...(prev.messages || []), optimisticUser] } : prev,
      );
      const result = await sendMutation.runMutation(() =>
        jsonApi.sendCuratorChatMessage(userId, sessionId, groupId, { text, model, filter }),
      );
      if (result) {
        queryClient.setQueryData(queryKey, (prev) => {
          if (!prev) return prev;
          // Заменяем оптимистичное user-сообщение на server-saved + добавляем assistant.
          const without = (prev.messages || []).filter((m) => m.id !== optimisticUser.id);
          return {
            ...prev,
            messages: [...without, result.userMessage, result.assistantMessage],
            lastMessageAt: result.assistantMessage.createdAt,
          };
        });
        queryClient.invalidateQueries({ queryKey: ["curator", "usage", userId, sessionId] });
      } else {
        // Не успело — снимаем оптимистичное.
        queryClient.setQueryData(queryKey, (prev) =>
          prev
            ? { ...prev, messages: (prev.messages || []).filter((m) => m.id !== optimisticUser.id) }
            : prev,
        );
      }
      return result;
    },
    [userId, sessionId, groupId, queryClient, queryKey, sendMutation],
  );

  const reset = useCallback(async () => {
    if (!userId || !sessionId || !groupId) return null;
    const result = await resetMutation.runMutation(() =>
      jsonApi.resetCuratorChatThread(userId, sessionId, groupId),
    );
    if (result) queryClient.setQueryData(queryKey, result);
    return result;
  }, [userId, sessionId, groupId, queryClient, queryKey, resetMutation]);

  return {
    ...queryShape(query, queryKey, queryClient),
    send,
    reset,
    sending: sendMutation.saving,
    resetting: resetMutation.saving,
  };
}

export function useCuratorUsage(sessionId) {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const userId = currentUser?.id;
  const queryKey = ["curator", "usage", userId, sessionId];

  const query = useQuery({
    queryKey,
    queryFn: () => jsonApi.getCuratorUsage(userId, sessionId),
    enabled: Boolean(userId && sessionId),
    staleTime: 30_000,
  });

  return queryShape(query, queryKey, queryClient);
}

export function useOrganizerUsage(sessionId) {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const userId = currentUser?.id;
  const queryKey = ["organizer", "usage", userId, sessionId];

  const query = useQuery({
    queryKey,
    queryFn: () => jsonApi.getOrganizerUsage(userId, sessionId),
    enabled: Boolean(userId && sessionId),
    staleTime: 30_000,
  });

  return queryShape(query, queryKey, queryClient);
}

/**
 * Концепции мероприятия (PDF/DOCX/TXT/MD) — Curator AI v2 Phase 4.
 * Возвращает список + методы upload/delete с инвалидацией.
 */
export function useEventConcepts(sessionId, eventId) {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const userId = currentUser?.id;
  const queryKey = ["organizer", "event-concepts", userId, sessionId, eventId];

  const query = useQuery({
    queryKey,
    queryFn: () => jsonApi.listEventConcepts(userId, sessionId, eventId),
    enabled: Boolean(userId && sessionId && eventId),
  });

  const uploadMutation = useCommandMutation({
    success: "Концепция загружена",
    error: "Не удалось загрузить файл",
  });
  const deleteMutation = useCommandMutation({
    success: "Концепция удалена",
    error: "Не удалось удалить",
  });

  const upload = useCallback(
    async (file) => {
      if (!userId || !sessionId || !eventId || !file) return null;
      const result = await uploadMutation.runMutation(() =>
        jsonApi.uploadEventConcept(userId, sessionId, eventId, file),
      );
      if (result) queryClient.invalidateQueries({ queryKey });
      return result;
    },
    [uploadMutation, userId, sessionId, eventId, queryClient, queryKey],
  );

  const remove = useCallback(
    async (conceptId) => {
      if (!userId || !sessionId || !eventId || !conceptId) return null;
      const result = await deleteMutation.runMutation(() =>
        jsonApi.deleteEventConcept(userId, sessionId, eventId, conceptId),
      );
      if (result !== null) queryClient.invalidateQueries({ queryKey });
      return result;
    },
    [deleteMutation, userId, sessionId, eventId, queryClient, queryKey],
  );

  return {
    ...queryShape(query, queryKey, queryClient),
    upload,
    remove,
    uploading: uploadMutation.saving,
    removing: deleteMutation.saving,
  };
}

/**
 * Мутация «Перегенерировать записку»: вызывает POST .../brief/regenerate,
 * после успеха обновляет react-query кеш brief'а для указанного dayId.
 */
export function useRegenerateCuratorBrief(sessionId, groupId) {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const userId = currentUser?.id;
  const mutation = useCommandMutation({
    success: "Записка обновлена",
    error: "Не удалось перегенерировать",
  });

  const regenerate = useCallback(
    async ({ dayId, model } = {}) => {
      if (!userId || !sessionId || !groupId) return null;
      const result = await mutation.runMutation(() =>
        jsonApi.regenerateCuratorBrief(userId, sessionId, groupId, { dayId, model }),
      );
      if (result) {
        const key = qk.curatorBrief(userId, sessionId, groupId, dayId || null);
        queryClient.setQueryData(key, result);
      }
      return result;
    },
    [mutation, userId, sessionId, groupId, queryClient],
  );

  return { regenerate, saving: mutation.saving, error: mutation.mutationError };
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

// Curator AI v2.1: context-presets для чата «Разговор с ИИ».
export function useCuratorChatPresets(sessionId, groupId) {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const userId = currentUser?.id;
  const queryKey = ["curator", "chat-presets", userId, sessionId, groupId];

  const query = useQuery({
    queryKey,
    queryFn: () => jsonApi.listCuratorChatPresets(userId, sessionId, groupId),
    enabled: Boolean(userId && sessionId && groupId),
  });

  const createMutation = useCommandMutation({
    success: "Preset создан",
    error: "Не удалось создать preset",
  });
  const updateMutation = useCommandMutation({
    success: "Preset обновлён",
    error: "Не удалось обновить preset",
  });
  const deleteMutation = useCommandMutation({
    success: "Preset удалён",
    error: "Не удалось удалить preset",
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const createPreset = useCallback(
    async (payload) => {
      if (!userId || !sessionId || !groupId) return null;
      const result = await createMutation.runMutation(() =>
        jsonApi.createCuratorChatPreset(userId, sessionId, groupId, payload),
      );
      if (result) invalidate();
      return result;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, sessionId, groupId, createMutation],
  );

  const updatePreset = useCallback(
    async (presetId, payload) => {
      if (!userId || !sessionId || !groupId || !presetId) return null;
      const result = await updateMutation.runMutation(() =>
        jsonApi.updateCuratorChatPreset(userId, sessionId, groupId, presetId, payload),
      );
      if (result) invalidate();
      return result;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, sessionId, groupId, updateMutation],
  );

  const deletePreset = useCallback(
    async (presetId) => {
      if (!userId || !sessionId || !groupId || !presetId) return null;
      const result = await deleteMutation.runMutation(() =>
        jsonApi.deleteCuratorChatPreset(userId, sessionId, groupId, presetId),
      );
      invalidate();
      return result;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, sessionId, groupId, deleteMutation],
  );

  return {
    ...queryShape(query, queryKey, queryClient),
    createPreset,
    updatePreset,
    deletePreset,
    saving: createMutation.saving || updateMutation.saving || deleteMutation.saving,
  };
}

// Curator AI v2.1: участники + события для chat-picker'а.
export function useCuratorChatContextOptions(sessionId, groupId) {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const userId = currentUser?.id;
  const queryKey = ["curator", "chat-context-options", userId, sessionId, groupId];

  const query = useQuery({
    queryKey,
    queryFn: () => jsonApi.getCuratorChatContextOptions(userId, sessionId, groupId),
    enabled: Boolean(userId && sessionId && groupId),
  });

  return queryShape(query, queryKey, queryClient);
}

export function useOrganizerChatContextOptions(sessionId, groupId) {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const userId = currentUser?.id;
  const queryKey = ["organizer", "chat-context-options", userId, sessionId, groupId];

  const query = useQuery({
    queryKey,
    queryFn: () => jsonApi.getOrganizerChatContextOptions(userId, sessionId, groupId),
    enabled: Boolean(userId && sessionId && groupId),
  });

  return queryShape(query, queryKey, queryClient);
}

// Curator AI v2.1: live preview собранного preamble.
// Возвращает mutation-объект, чтобы вызывающий мог дебаунсить вызовы вручную.
export function useChatContextPreview(sessionId, groupId) {
  const { currentUser } = useAuth();
  const userId = currentUser?.id;
  const { mutateAsync, isPending, error, data, reset } = useMutation({
    mutationFn: (filter) => jsonApi.previewCuratorChatContext(userId, sessionId, groupId, filter),
  });
  const fetchPreview = useCallback(
    (filter) => {
      if (!userId || !sessionId || !groupId) return Promise.resolve(null);
      return mutateAsync(filter);
    },
    [userId, sessionId, groupId, mutateAsync],
  );
  return { preview: data ?? null, loading: isPending, error, fetchPreview, reset };
}

// Organizer side: список кураторов группы с preset-статистикой.
export function useOrganizerCuratorsForGroup(sessionId, groupId) {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const userId = currentUser?.id;
  const queryKey = ["organizer", "group-curators", userId, sessionId, groupId];

  const query = useQuery({
    queryKey,
    queryFn: () => jsonApi.listOrganizerCuratorsForGroup(userId, sessionId, groupId),
    enabled: Boolean(userId && sessionId && groupId),
  });

  return queryShape(query, queryKey, queryClient);
}

// Organizer side: preset'ы конкретного куратора в группе + CRUD от лица организатора.
export function useOrganizerCuratorChatPresets(sessionId, groupId, curatorId) {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const userId = currentUser?.id;
  const queryKey = ["organizer", "curator-chat-presets", userId, sessionId, groupId, curatorId];

  const query = useQuery({
    queryKey,
    queryFn: () => jsonApi.listOrganizerCuratorChatPresets(userId, sessionId, groupId, curatorId),
    enabled: Boolean(userId && sessionId && groupId && curatorId),
  });

  const createMutation = useCommandMutation({
    success: "Preset создан",
    error: "Не удалось создать preset",
  });
  const updateMutation = useCommandMutation({
    success: "Preset обновлён",
    error: "Не удалось обновить preset",
  });
  const deleteMutation = useCommandMutation({
    success: "Preset удалён",
    error: "Не удалось удалить preset",
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({
      queryKey: ["organizer", "group-curators", userId, sessionId, groupId],
    });
  };

  const createPreset = useCallback(
    async (payload) => {
      if (!userId || !sessionId || !groupId || !curatorId) return null;
      const result = await createMutation.runMutation(() =>
        jsonApi.createOrganizerCuratorChatPreset(userId, sessionId, groupId, curatorId, payload),
      );
      if (result) invalidate();
      return result;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, sessionId, groupId, curatorId, createMutation],
  );

  const updatePreset = useCallback(
    async (presetId, payload) => {
      if (!userId || !sessionId || !groupId || !curatorId || !presetId) return null;
      const result = await updateMutation.runMutation(() =>
        jsonApi.updateOrganizerCuratorChatPreset(
          userId,
          sessionId,
          groupId,
          curatorId,
          presetId,
          payload,
        ),
      );
      if (result) invalidate();
      return result;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, sessionId, groupId, curatorId, updateMutation],
  );

  const deletePreset = useCallback(
    async (presetId) => {
      if (!userId || !sessionId || !groupId || !curatorId || !presetId) return null;
      const result = await deleteMutation.runMutation(() =>
        jsonApi.deleteOrganizerCuratorChatPreset(userId, sessionId, groupId, curatorId, presetId),
      );
      invalidate();
      return result;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, sessionId, groupId, curatorId, deleteMutation],
  );

  return {
    ...queryShape(query, queryKey, queryClient),
    createPreset,
    updatePreset,
    deletePreset,
    saving: createMutation.saving || updateMutation.saving || deleteMutation.saving,
  };
}

// Organizer-side preview контекста для конкретного куратора.
export function useOrganizerChatContextPreview(sessionId, groupId, curatorId) {
  const { currentUser } = useAuth();
  const userId = currentUser?.id;
  const { mutateAsync, isPending, error, data, reset } = useMutation({
    mutationFn: (filter) =>
      jsonApi.previewOrganizerCuratorChatContext(userId, sessionId, groupId, curatorId, filter),
  });
  const fetchPreview = useCallback(
    (filter) => {
      if (!userId || !sessionId || !groupId || !curatorId) return Promise.resolve(null);
      return mutateAsync(filter);
    },
    [userId, sessionId, groupId, curatorId, mutateAsync],
  );
  return { preview: data ?? null, loading: isPending, error, fetchPreview, reset };
}

/**
 * Импорт программы из Excel: preview (без записи) и commit (запись в workspace).
 * После commit инвалидируем organizer-workspace.
 */
export function useProgramImport(sessionId) {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const addToast = useToast();
  const userId = currentUser?.id;

  const previewMutation = useMutation({
    mutationFn: ({ file, options }) =>
      jsonApi.importProgramPreview(userId, sessionId, file, options),
  });
  const commitMutation = useMutation({
    mutationFn: (payload) => jsonApi.importProgramCommit(userId, sessionId, payload),
  });

  const previewImport = useCallback(
    async ({ file, options }) => {
      if (!userId || !sessionId) return null;
      try {
        return await previewMutation.mutateAsync({ file, options });
      } catch (error) {
        addToast(error?.message || "Не удалось разобрать файл", "error");
        throw error;
      }
    },
    [userId, sessionId, previewMutation, addToast],
  );

  const commitImport = useCallback(
    async (payload) => {
      if (!userId || !sessionId) return null;
      try {
        const result = await commitMutation.mutateAsync(payload);
        queryClient.invalidateQueries({ queryKey: qk.organizerWorkspace(userId, sessionId) });
        addToast("Программа импортирована", "success");
        return result;
      } catch (error) {
        addToast(error?.message || "Не удалось сохранить программу", "error");
        throw error;
      }
    },
    [userId, sessionId, commitMutation, queryClient, addToast],
  );

  return {
    previewImport,
    commitImport,
    previewing: previewMutation.isPending,
    committing: commitMutation.isPending,
  };
}

/**
 * Хук для пакетной выдачи приглашений: preview (парс xlsx-шаблона) + generate
 * (создание magic-link'ов + PDF). Возвращает также templateUrl для прямого
 * скачивания пустого шаблона через `<a href=...>`.
 */
export function useBulkInvites(sessionId) {
  const { currentUser } = useAuth();
  const addToast = useToast();
  const userId = currentUser?.id;

  const previewMutation = useMutation({
    mutationFn: (file) => jsonApi.previewBulkInvites(userId, sessionId, file),
  });
  const generateMutation = useMutation({
    mutationFn: (payload) => jsonApi.generateBulkInvitesPdf(userId, sessionId, payload),
  });
  const templateMutation = useMutation({
    mutationFn: () => jsonApi.downloadInvitesTemplate(userId, sessionId),
  });

  const previewInvites = useCallback(
    async (file) => {
      if (!userId || !sessionId) return null;
      try {
        return await previewMutation.mutateAsync(file);
      } catch (error) {
        addToast(error?.message || "Не удалось разобрать шаблон", "error");
        throw error;
      }
    },
    [userId, sessionId, previewMutation, addToast],
  );

  const generateInvites = useCallback(
    async (payload) => {
      if (!userId || !sessionId) return null;
      try {
        const blob = await generateMutation.mutateAsync(payload);
        addToast("PDF приглашений готов", "success");
        return blob;
      } catch (error) {
        addToast(error?.message || "Не удалось сгенерировать PDF", "error");
        throw error;
      }
    },
    [userId, sessionId, generateMutation, addToast],
  );

  const downloadTemplate = useCallback(async () => {
    if (!userId || !sessionId) return null;
    try {
      return await templateMutation.mutateAsync();
    } catch (error) {
      addToast(error?.message || "Не удалось скачать шаблон", "error");
      throw error;
    }
  }, [userId, sessionId, templateMutation, addToast]);

  return {
    previewInvites,
    generateInvites,
    downloadTemplate,
    previewing: previewMutation.isPending,
    generating: generateMutation.isPending,
    downloadingTemplate: templateMutation.isPending,
  };
}
