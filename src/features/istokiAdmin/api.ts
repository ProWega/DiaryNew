import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getCsrfToken } from "../../lib/csrfToken";
import { useAuth } from "../../auth/AuthContext";
import type { Region } from "../istoki/types";
import type { RegionSummary } from "../istoki/api";

const ADMIN_BASE = "/api/admin/istoki";

interface FetchOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
  viewerId?: string | number | null;
}

async function adminFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  // Project's dev-mode auth resolves the viewer from this header when no
  // valid session cookie is present (server/lib/routeHelpers.cjs::getViewerId).
  // Existing admin pages use the same convention via src/api/jsonApi.ts.
  if (options.viewerId != null) {
    headers["x-viewer-id"] = String(options.viewerId);
  }
  if (method !== "GET" && method !== "HEAD") {
    headers["X-CSRF-Token"] = getCsrfToken() ?? "";
  }

  const response = await fetch(`${ADMIN_BASE}${path}`, {
    method,
    headers,
    credentials: "include",
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const payload = (await response.json()) as { message?: string };
      message = payload.message ?? message;
    } catch {
      /* ignore */
    }
    const error = new Error(message);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function uploadFile(
  kind: "audio" | "photo",
  file: File,
  viewerId: string | number | null,
): Promise<{ url: string; sizeBytes: number; mime: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const headers: Record<string, string> = { "X-CSRF-Token": getCsrfToken() ?? "" };
  if (viewerId != null) headers["x-viewer-id"] = String(viewerId);
  const response = await fetch(`${ADMIN_BASE}/uploads/${kind}`, {
    method: "POST",
    headers,
    credentials: "include",
    body: formData,
  });
  if (!response.ok) {
    let message = "Загрузка не удалась";
    try {
      const payload = (await response.json()) as { message?: string };
      message = payload.message ?? message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return (await response.json()) as { url: string; sizeBytes: number; mime: string };
}

function useViewerId(): string | null {
  // AuthContext is plain JS; cast to a minimal shape we rely on here.
  const { currentUser } = useAuth() as { currentUser?: { id?: string | number } | null };
  return currentUser?.id ? String(currentUser.id) : null;
}

// ── Queries ────────────────────────────────────────────────────────

export function useAdminRegions() {
  const viewerId = useViewerId();
  return useQuery({
    queryKey: ["istoki", "admin", "regions", viewerId],
    queryFn: () => adminFetch<{ regions: RegionSummary[] }>("/regions", { viewerId }),
    enabled: Boolean(viewerId),
  });
}

export function useAdminRegion(code: string | null | undefined) {
  const viewerId = useViewerId();
  return useQuery({
    queryKey: ["istoki", "admin", "region", code, viewerId],
    queryFn: () => adminFetch<Region>(`/regions/${code}`, { viewerId }),
    enabled: Boolean(code) && Boolean(viewerId),
  });
}

// ── Mutations (return raw promises; callers wrap in useCommandMutation) ──

export function useAdminMutations() {
  const viewerId = useViewerId();
  const queryClient = useQueryClient();

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["istoki"] });
  }

  function invalidateRegion(code?: string | null) {
    queryClient.invalidateQueries({ queryKey: ["istoki", "admin", "regions"] });
    queryClient.invalidateQueries({ queryKey: ["istoki", "regions"] });
    if (code) {
      queryClient.invalidateQueries({ queryKey: ["istoki", "admin", "region", code] });
      queryClient.invalidateQueries({ queryKey: ["istoki", "region", code] });
    }
  }

  return {
    upsertRegion: useMutation({
      mutationFn: (payload: Partial<Region> & { code: string }) =>
        adminFetch<{ code: string }>("/regions", { method: "POST", body: payload, viewerId }),
      onSuccess: (_data, variables) => invalidateRegion(variables.code),
    }),
    updateRegion: useMutation({
      mutationFn: (payload: Partial<Region> & { code: string }) =>
        adminFetch<{ code: string }>(`/regions/${payload.code}`, {
          method: "PUT",
          body: payload,
          viewerId,
        }),
      onSuccess: (_data, variables) => invalidateRegion(variables.code),
    }),
    deleteRegion: useMutation({
      mutationFn: (code: string) =>
        adminFetch<void>(`/regions/${code}`, { method: "DELETE", viewerId }),
      onSuccess: () => invalidateAll(),
    }),

    createPodcast: useMutation({
      mutationFn: ({ regionCode, ...body }: { regionCode: string; [k: string]: unknown }) =>
        adminFetch<{ id: string }>(`/regions/${regionCode}/podcasts`, {
          method: "POST",
          body,
          viewerId,
        }),
      onSuccess: (_data, variables) => invalidateRegion(variables.regionCode),
    }),
    updatePodcast: useMutation({
      mutationFn: ({
        id,
        regionCode: _rc,
        ...body
      }: {
        id: string;
        regionCode: string;
        [k: string]: unknown;
      }) =>
        adminFetch<{ id: string }>(`/podcasts/${id}`, {
          method: "PUT",
          body: { ...body, id },
          viewerId,
        }),
      onSuccess: (_data, variables) => invalidateRegion(variables.regionCode),
    }),
    deletePodcast: useMutation({
      mutationFn: ({ id }: { id: string; regionCode: string }) =>
        adminFetch<void>(`/podcasts/${id}`, { method: "DELETE", viewerId }),
      onSuccess: (_data, variables) => invalidateRegion(variables.regionCode),
    }),

    createStory: useMutation({
      mutationFn: ({ regionCode, ...body }: { regionCode: string; [k: string]: unknown }) =>
        adminFetch<{ id: string }>(`/regions/${regionCode}/stories`, {
          method: "POST",
          body,
          viewerId,
        }),
      onSuccess: (_data, variables) => invalidateRegion(variables.regionCode),
    }),
    updateStory: useMutation({
      mutationFn: ({
        id,
        regionCode: _rc,
        ...body
      }: {
        id: string;
        regionCode: string;
        [k: string]: unknown;
      }) =>
        adminFetch<{ id: string }>(`/stories/${id}`, {
          method: "PUT",
          body: { ...body, id },
          viewerId,
        }),
      onSuccess: (_data, variables) => invalidateRegion(variables.regionCode),
    }),
    deleteStory: useMutation({
      mutationFn: ({ id }: { id: string; regionCode: string }) =>
        adminFetch<void>(`/stories/${id}`, { method: "DELETE", viewerId }),
      onSuccess: (_data, variables) => invalidateRegion(variables.regionCode),
    }),

    createChronicle: useMutation({
      mutationFn: ({ regionCode, ...body }: { regionCode: string; [k: string]: unknown }) =>
        adminFetch<{ id: string }>(`/regions/${regionCode}/chronicle`, {
          method: "POST",
          body,
          viewerId,
        }),
      onSuccess: (_data, variables) => invalidateRegion(variables.regionCode),
    }),
    updateChronicle: useMutation({
      mutationFn: ({
        id,
        regionCode: _rc,
        ...body
      }: {
        id: string;
        regionCode: string;
        [k: string]: unknown;
      }) =>
        adminFetch<{ id: string }>(`/chronicle/${id}`, {
          method: "PUT",
          body: { ...body, id },
          viewerId,
        }),
      onSuccess: (_data, variables) => invalidateRegion(variables.regionCode),
    }),
    deleteChronicle: useMutation({
      mutationFn: ({ id }: { id: string; regionCode: string }) =>
        adminFetch<void>(`/chronicle/${id}`, { method: "DELETE", viewerId }),
      onSuccess: (_data, variables) => invalidateRegion(variables.regionCode),
    }),
  };
}

export { uploadFile };
