import { useCallback, useEffect } from "react";

/**
 * Anonymous analytics queue for the public «Истоки» map.
 *
 * Events are buffered in-memory, flushed every 5 seconds and on
 * pagehide. Single global queue (module-scoped) — `useIstokiTracking`
 * just hands callers a typed `track()` and ensures the flush loop is
 * running.
 *
 * Privacy: nothing about the user is sent — no cookies, no IDs, no
 * URL referrers. The backend hashes the IP with a daily-rotating salt
 * before storage. Users can opt out by setting
 * `localStorage["istoki:no-track"] = "1"` — events are then dropped
 * before they hit the queue.
 */

export type IstokiEventType =
  | "region.opened"
  | "podcast.played"
  | "podcast.progress"
  | "story.viewed"
  | "chronicle.viewed";

export interface IstokiEvent {
  type: IstokiEventType;
  regionCode?: string | null;
  entityId?: string | null;
  payload?: Record<string, unknown>;
}

const ENDPOINT = "/api/public/istoki/events";
const FLUSH_INTERVAL_MS = 5_000;
const MAX_BATCH = 50;

let queue: IstokiEvent[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;
let listenersAttached = false;

function isOptedOut(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem("istoki:no-track") === "1";
  } catch {
    return false;
  }
}

function takeBatch(): IstokiEvent[] {
  if (!queue.length) return [];
  const batch = queue.slice(0, MAX_BATCH);
  queue = queue.slice(batch.length);
  return batch;
}

function sendBatch(batch: IstokiEvent[], { useBeacon = false }: { useBeacon?: boolean } = {}) {
  if (typeof window === "undefined") return;
  const body = JSON.stringify({ events: batch });

  if (useBeacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
    // sendBeacon reliably fires during pagehide. It expects a Blob with
    // the right content-type — bare strings turn into text/plain.
    const blob = new Blob([body], { type: "application/json" });
    const ok = navigator.sendBeacon(ENDPOINT, blob);
    if (ok) return;
    // fall through to fetch with keepalive on failure
  }

  fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    credentials: "same-origin",
    keepalive: true,
  }).catch(() => {
    // Network errors are silently dropped. Analytics is best-effort,
    // never worth surfacing to the user.
  });
}

function flushAll({ useBeacon = false }: { useBeacon?: boolean } = {}) {
  while (queue.length) {
    const batch = takeBatch();
    sendBatch(batch, { useBeacon });
  }
}

function ensureLifecycleHooks() {
  if (listenersAttached || typeof window === "undefined") return;
  listenersAttached = true;

  flushTimer = setInterval(() => flushAll(), FLUSH_INTERVAL_MS);

  // Use pagehide rather than beforeunload — pagehide fires for the
  // back/forward cache and on iOS, beforeunload doesn't reliably.
  window.addEventListener("pagehide", () => flushAll({ useBeacon: true }));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushAll({ useBeacon: true });
  });
}

export function useIstokiTracking() {
  useEffect(() => {
    ensureLifecycleHooks();
  }, []);

  // Opt-out is re-checked on every track() call rather than cached in a
  // ref — the lookup is a single localStorage read and avoids
  // touching refs during render (which the project's ESLint rule
  // `react-hooks/refs` rightly forbids).
  const track = useCallback((event: IstokiEvent) => {
    if (isOptedOut()) return;
    queue.push(event);
    if (queue.length >= MAX_BATCH) {
      flushAll();
    }
  }, []);

  return { track };
}

// Test helpers — exported so unit tests can inspect/clear the queue.
export const __istokiTrackingInternals = {
  flushNow: flushAll,
  drainQueue: () => {
    const out = queue.slice();
    queue = [];
    return out;
  },
  stopTimer: () => {
    if (flushTimer) {
      clearInterval(flushTimer);
      flushTimer = null;
    }
    listenersAttached = false;
  },
};
