import { useCallback, useEffect, useState } from "react";

import { getActivityAppUsage } from "../api/activity";
import type { ActivityAppUsageDto } from "../types/backend";

export function useActivityAppUsage(limit = 120) {
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
