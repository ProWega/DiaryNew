import { useQuery } from "@tanstack/react-query";
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
