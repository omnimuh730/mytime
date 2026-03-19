import { useCallback, useEffect, useState } from "react";

import { getActivityAppUsage } from "../api/activity";
import type { ActivityAppUsageDto } from "../types/backend";

/** Omit `limit` to load full session history (backend default ~10k). */
export function useActivityAppUsage(limit?: number) {
  const [data, setData] = useState<ActivityAppUsageDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const next = await getActivityAppUsage(limit);
      setData(next);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load activity app usage",
      );
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 3000);
    return () => clearInterval(id);
  }, [refresh]);

  return {
    data,
    isLoading,
    error,
    refresh,
  };
}
