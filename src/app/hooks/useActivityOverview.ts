import { startTransition, useCallback, useEffect, useState } from "react";

import { getActivityOverview } from "../api/activity";
import type { ActivityOverviewDto } from "../types/backend";

const POLL_MS = 12_000;

export function useActivityOverview() {
  const [overview, setOverview] = useState<ActivityOverviewDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const next = await getActivityOverview();
      startTransition(() => {
        setOverview(next);
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load activity overview",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => {
      void refresh();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  return {
    overview,
    isLoading,
    error,
    refresh,
  };
}
