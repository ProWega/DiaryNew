import { useMutation, useQuery } from "@tanstack/react-query";
import type { Region } from "./types";

export interface RegionSummary {
  code: string;
  isoCode: string | null;
  name: string;
  geographicHint: string | null;
  orderIdx: number;
  isPublished: boolean;
  hasContent: boolean;
  counts: { podcasts: number; stories: number; chronicle: number };
}

interface RegionsResponse {
  regions: RegionSummary[];
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { credentials: "same-origin" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

const FIVE_MINUTES = 5 * 60_000;

export function useIstokiRegions() {
  return useQuery({
    queryKey: ["istoki", "regions"],
    queryFn: () => fetchJson<RegionsResponse>("/api/public/istoki/regions"),
    staleTime: FIVE_MINUTES,
  });
}

export function useIstokiRegion(code: string | null | undefined) {
  return useQuery({
    queryKey: ["istoki", "region", code],
    queryFn: () => fetchJson<Region>(`/api/public/istoki/regions/${code}`),
    enabled: Boolean(code),
    staleTime: FIVE_MINUTES,
  });
}

// ── Phase F · public submissions ───────────────────────────────────

export type SubmissionKind = "podcast" | "story" | "chronicle";
export type SubmissionStatus = "pending" | "approved" | "rejected";

export interface CreateSubmissionInput {
  kind: SubmissionKind;
  regionCode: string;
  submitterName: string;
  submitterEmail: string;
  draft: Record<string, unknown>;
}

export interface CreateSubmissionResponse {
  id: string;
  statusToken: string;
  statusUrl: string;
}

export interface SubmissionStatusView {
  id: string;
  kind: SubmissionKind;
  regionCode: string | null;
  status: SubmissionStatus;
  moderationNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export function useCreateSubmission() {
  return useMutation<CreateSubmissionResponse, Error, CreateSubmissionInput>({
    mutationFn: async (input) => {
      const response = await fetch("/api/public/istoki/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        let message = `HTTP ${response.status}`;
        try {
          const payload = (await response.json()) as { message?: string };
          message = payload.message || message;
        } catch {
          /* ignore */
        }
        throw new Error(message);
      }
      return (await response.json()) as CreateSubmissionResponse;
    },
  });
}

export function useSubmissionStatus(token: string | null | undefined) {
  return useQuery<SubmissionStatusView>({
    queryKey: ["istoki", "submission", token],
    queryFn: () =>
      fetchJson<SubmissionStatusView>(`/api/public/istoki/submissions/by-token/${token}`),
    enabled: Boolean(token),
    refetchInterval: 30_000,
  });
}
