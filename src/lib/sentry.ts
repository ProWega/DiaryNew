import * as Sentry from "@sentry/react";

/**
 * Sentry bootstrap. Opt-in via VITE_SENTRY_DSN — without it, init is skipped
 * and the SDK no-ops. Safe to call unconditionally from main.jsx.
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.1,
    // Don't pollute Sentry with errors thrown by browser extensions or noise
    ignoreErrors: ["ResizeObserver loop limit exceeded"],
  });
}

/**
 * Re-export captureException so call-sites don't need to import @sentry/react
 * directly. When Sentry isn't initialized, captureException is a no-op.
 */
export const captureException = Sentry.captureException;
