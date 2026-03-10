import { useCallback, useEffect, useState } from "react";
import { getActivityTimeline } from "../api/activity";
import type { ActivityTimelineDto } from "../types/backend";

export interface ActivityTimelineChartPoint {
  label: string;
  active: number;
  inactive: number;
  fullDate: string;
}

export function useActivityTimeline(startDate: string, endDate: string) {
  const [dto, setDto] = useState<ActivityTimelineDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTimeline = useCallback(async () => {
    try {
      setError(null);
      setIsLoading(true);
      const result = await getActivityTimeline(startDate, endDate);
      setDto(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load activity timeline");
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    void fetchTimeline();
  }, [fetchTimeline]);

  const data: ActivityTimelineChartPoint[] = dto
    ? dto.points.map((p) => ({
        label: p.label,
        active: p.active,
        inactive: p.inactive,
        fullDate: p.fullDate,
      }))
    : [];

  return {
    data,
    isHourly: dto?.isHourly ?? false,
    maxValue: dto?.maxValue ?? 24,
    yLabel: dto?.yLabel ?? "Hours",
    avgActive: dto?.avgActive ?? 0,
    isLoading,
    error,
    refresh: fetchTimeline,
  };
}
