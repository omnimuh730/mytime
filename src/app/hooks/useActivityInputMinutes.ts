import { useCallback, useEffect, useState } from "react";

import { getActivityInputMinutes } from "../api/activity";
import type { AppInputMinuteDto } from "../types/backend";

const DEFAULT_POLL_MS = 5_000;

export function useActivityInputMinutes(pollMs = DEFAULT_POLL_MS) {
  const [inputMinutes, setInputMinutes] = useState<AppInputMinuteDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const next = await getActivityInputMinutes();
      setInputMinutes(next);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load activity input minutes",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => {
      void refresh();
    }, pollMs);
    return () => window.clearInterval(id);
  }, [pollMs, refresh]);

  return {
    inputMinutes,
    isLoading,
    error,
    refresh,
  };
}
