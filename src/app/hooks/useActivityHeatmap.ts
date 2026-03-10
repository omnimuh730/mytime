import { useCallback, useEffect, useState } from "react";
import { getActivityHeatmap } from "../api/activity";
import type { ActivityHeatmapDto } from "../types/backend";

export function useActivityHeatmap() {
  const [data, setData] = useState<ActivityHeatmapDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHeatmap = useCallback(async () => {
    try {
      setError(null);
      setIsLoading(true);
      const result = await getActivityHeatmap();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load activity heatmap");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchHeatmap();
    const id = setInterval(() => void fetchHeatmap(), 4000);
    return () => clearInterval(id);
  }, [fetchHeatmap]);

  return {
    grid: data?.grid ?? null,
    isLoading,
    error,
    refresh: fetchHeatmap,
  };
}
