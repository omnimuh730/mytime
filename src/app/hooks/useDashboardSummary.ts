import { useCallback, useEffect, useState } from "react";

import { getDashboardSummary } from "../api/dashboard";
import type { DashboardSummaryDto } from "../types/backend";

export function useDashboardSummary() {
  const [summary, setSummary] = useState<DashboardSummaryDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  }, [refresh]);

  return {
    summary,
    isLoading,
    error,
    refresh,
  };
}
