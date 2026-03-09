import { useCallback, useEffect, useState } from "react";

import { getAppStatus } from "../api/system";
import type { AppStatusDto } from "../types/backend";

export function useAppStatus() {
  const [status, setStatus] = useState<AppStatusDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const nextStatus = await getAppStatus();
      setStatus(nextStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load app status");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();

    const interval = window.setInterval(() => {
      void refresh();
    }, 30_000);

    return () => window.clearInterval(interval);
  }, [refresh]);

  return {
    status,
    isLoading,
    error,
    refresh,
  };
}
