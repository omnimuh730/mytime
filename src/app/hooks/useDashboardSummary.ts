import { useCallback, useEffect, useRef, useState } from "react";

import { getDashboardSummary } from "../api/dashboard";
import { subscribeToInputMonitor } from "../api/inputMonitor";
import { hasTauriRuntime } from "../api/tauri";
import type { DashboardSummaryDto } from "../types/backend";

export function useDashboardSummary() {
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
    void refresh();

    let cancelled = false;
    let disposeLiveListener: (() => void) | undefined;

    const scheduleRefresh = () => {
      const now = Date.now();
      const throttleMs = 300;
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

    if (hasTauriRuntime()) {
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
    }, 4000);

    return () => {
      cancelled = true;
      disposeLiveListener?.();
      window.clearInterval(interval);
      if (pendingRefreshRef.current !== null) {
        window.clearTimeout(pendingRefreshRef.current);
        pendingRefreshRef.current = null;
      }
    };
  }, [refresh]);

  return {
    summary,
    isLoading,
    error,
    refresh,
  };
}
