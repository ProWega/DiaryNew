import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getCsrfToken } from "../../lib/csrfToken";
import type { Region } from "../istoki/types";
import type { RegionSummary } from "../istoki/api";

const ADMIN_BASE = "/api/admin/istoki";

interface FetchOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
}

async function adminFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
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
): Promise<{ url: string; sizeBytes: number; mime: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${ADMIN_BASE}/uploads/${kind}`, {
    method: "POST",
    headers: { "X-CSRF-Token": getCsrfToken() ?? "" },
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

// ── Queries ────────────────────────────────────────────────────────

export function useAdminRegions() {
  return useQuery({
    queryKey: ["istoki", "admin", "regions"],
    queryFn: () => adminFetch<{ regions: RegionSummary[] }>("/regions"),
  });
}

export function useAdminRegion(code: string | null | undefined) {
  return useQuery({
    queryKey: ["istoki", "admin", "region", code],
    queryFn: () => adminFetch<Region>(`/regions/${code}`),
    enabled: Boolean(code),
  });
}

// ── Mutations (return raw promises; callers wrap in useCommandMutation) ──

export function useAdminMutations() {
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
        adminFetch<{ code: string }>("/regions", { method: "POST", body: payload }),
      onSuccess: (_data, variables) => invalidateRegion(variables.code),
    }),
    updateRegion: useMutation({
      mutationFn: (payload: Partial<Region> & { code: string }) =>
        adminFetch<{ code: string }>(`/regions/${payload.code}`, { method: "PUT", body: payload }),
      onSuccess: (_data, variables) => invalidateRegion(variables.code),
    }),
    deleteRegion: useMutation({
      mutationFn: (code: string) => adminFetch<void>(`/regions/${code}`, { method: "DELETE" }),
      onSuccess: () => invalidateAll(),
    }),

    createPodcast: useMutation({
      mutationFn: ({ regionCode, ...body }: { regionCode: string; [k: string]: unknown }) =>
        adminFetch<{ id: string }>(`/regions/${regionCode}/podcasts`, {
          method: "POST",
          body,
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
      }) => adminFetch<{ id: string }>(`/podcasts/${id}`, { method: "PUT", body: { ...body, id } }),
      onSuccess: (_data, variables) => invalidateRegion(variables.regionCode),
    }),
    deletePodcast: useMutation({
      mutationFn: ({ id }: { id: string; regionCode: string }) =>
        adminFetch<void>(`/podcasts/${id}`, { method: "DELETE" }),
      onSuccess: (_data, variables) => invalidateRegion(variables.regionCode),
    }),

    createStory: useMutation({
      mutationFn: ({ regionCode, ...body }: { regionCode: string; [k: string]: unknown }) =>
        adminFetch<{ id: string }>(`/regions/${regionCode}/stories`, {
          method: "POST",
          body,
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
      }) => adminFetch<{ id: string }>(`/stories/${id}`, { method: "PUT", body: { ...body, id } }),
      onSuccess: (_data, variables) => invalidateRegion(variables.regionCode),
    }),
    deleteStory: useMutation({
      mutationFn: ({ id }: { id: string; regionCode: string }) =>
        adminFetch<void>(`/stories/${id}`, { method: "DELETE" }),
      onSuccess: (_data, variables) => invalidateRegion(variables.regionCode),
    }),

    createChronicle: useMutation({
      mutationFn: ({ regionCode, ...body }: { regionCode: string; [k: string]: unknown }) =>
        adminFetch<{ id: string }>(`/regions/${regionCode}/chronicle`, {
          method: "POST",
          body,
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
        adminFetch<{ id: string }>(`/chronicle/${id}`, { method: "PUT", body: { ...body, id } }),
      onSuccess: (_data, variables) => invalidateRegion(variables.regionCode),
    }),
    deleteChronicle: useMutation({
      mutationFn: ({ id }: { id: string; regionCode: string }) =>
        adminFetch<void>(`/chronicle/${id}`, { method: "DELETE" }),
      onSuccess: (_data, variables) => invalidateRegion(variables.regionCode),
    }),
  };
}

export { uploadFile };
