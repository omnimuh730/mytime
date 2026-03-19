import { useCallback, useEffect, useRef, useState } from "react";

import { getDashboardSummary } from "../api/dashboard";
import { subscribeToInputMonitor } from "../api/inputMonitor";
import { hasTauriRuntime } from "../api/tauri";
import type { DashboardSummaryDto } from "../types/backend";

export type DashboardSummaryMode = "off" | "passive" | "live";

export function useDashboardSummary(mode: DashboardSummaryMode = "live") {
  const [summary, setSummary] = useState<DashboardSummaryDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastRefreshAtRef = useRef(0);
  const pendingRefreshRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const nextSummary = await getDashboardSummary();
      setSummary(nextSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard summary");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mode === "off") {
      return;
    }

    void refresh();

    let cancelled = false;
    let disposeLiveListener: (() => void) | undefined;
    const throttleMs = mode === "live" ? 1_200 : 4_000;
    const intervalMs = mode === "live" ? 6_000 : 12_000;

    const scheduleRefresh = () => {
      const now = Date.now();
      const elapsed = now - lastRefreshAtRef.current;

      if (elapsed >= throttleMs) {
        lastRefreshAtRef.current = now;
        void refresh();
        return;
      }

      if (pendingRefreshRef.current !== null) {
        return;
      }

      pendingRefreshRef.current = window.setTimeout(() => {
        pendingRefreshRef.current = null;
        lastRefreshAtRef.current = Date.now();
        void refresh();
      }, throttleMs - elapsed);
    };

    if (mode === "live" && hasTauriRuntime()) {
      void (async () => {
        const unlisten = await subscribeToInputMonitor(() => {
          scheduleRefresh();
        });

        if (cancelled) {
          unlisten();
          return;
        }

        disposeLiveListener = unlisten;
      })();
    }

    const interval = window.setInterval(() => {
      scheduleRefresh();
    }, intervalMs);

    return () => {
      cancelled = true;
      disposeLiveListener?.();
      window.clearInterval(interval);
      if (pendingRefreshRef.current !== null) {
        window.clearTimeout(pendingRefreshRef.current);
        pendingRefreshRef.current = null;
      }
    };
  }, [mode, refresh]);

  return {
    summary,
    isLoading,
    error,
    refresh,
  };
}
