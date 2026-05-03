import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AppRouter from "./AppRouter";
import { AuthProvider } from "./auth/AuthContext";
import { ToastProvider } from "./components/ui/Toast";
import ErrorBoundary from "./components/ErrorBoundary";
import { initSentry } from "./lib/sentry";
import "./styles/index.css";

// Initialize Sentry before anything renders. No-op when VITE_SENTRY_DSN is unset.
initSentry();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
    },
  },
});

async function enableMocking() {
  if (import.meta.env.VITE_USE_MOCK !== "true") return;
  const { worker } = await import("./mocks/browser");
  return worker.start({ onUnhandledRequest: "warn" });
}

enableMocking().then(() => {
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <AuthProvider>
              <BrowserRouter>
                <AppRouter />
              </BrowserRouter>
            </AuthProvider>
          </ToastProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </React.StrictMode>,
  );
});
