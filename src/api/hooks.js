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

  return { data, loading, error, setData, refresh };
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
                  ? {
                      ...day,
                      reflection: {
                        ...day.reflection,
                        ...patch,
                      },
                    }
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

export function useOrganizerDashboard(sessionId) {
  const { currentUser } = useAuth();

  return useAsyncResource(
    useCallback(
      () => jsonApi.getOrganizerDashboard(currentUser.id, sessionId),
      [currentUser?.id, sessionId],
    ),
    Boolean(currentUser?.id && sessionId),
  );
}

export function useAdminDashboard() {
  const { currentUser } = useAuth();

  return useAsyncResource(
    useCallback(() => jsonApi.getAdminDashboard(currentUser.id), [currentUser?.id]),
    Boolean(currentUser?.id),
  );
}
