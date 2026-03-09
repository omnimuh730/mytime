import { useState, useMemo, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import { PremiumDateRangePicker } from "./ui/PremiumDateRangePicker";

// Generate deterministic mock data for any date range — active vs inactive hours per day
function generateActivityData(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const dayCount = Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  );
  const data: {
    label: string;
    active: number;
    inactive: number;
    fullDate: string;
  }[] = [];

  if (dayCount <= 1) {
    // Single day — show hourly active/inactive blocks (each bar = 1 hour)
    for (let h = 0; h < 24; h++) {
      const seed =
        (start.getDate() * 100 + h * 7 + start.getMonth() * 31) % 100;
      const isWorkHour = h >= 8 && h <= 17;
      const isExtended = h >= 6 && h <= 20;
      const activeMin = isWorkHour
        ? Math.round(35 + (seed % 25))
        : isExtended
        ? Math.round(10 + (seed % 15))
        : Math.round(seed % 5);
      data.push({
        label: `${String(h).padStart(2, "0")}:00`,
        active: activeMin,
        inactive: 60 - activeMin,
        fullDate: `${start.toISOString().slice(0, 10)} ${String(h).padStart(2, "0")}:00`,
      });
    }
  } else if (dayCount <= 31) {
    // Daily view — active hours per day out of 24
    for (let d = 0; d < dayCount; d++) {
      const date = new Date(start);
      date.setDate(date.getDate() + d);
      const seed =
        (date.getDate() * 17 + date.getMonth() * 31 + date.getFullYear()) %
        100;
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const baseHours = isWeekend ? 2 + (seed % 4) : 5 + (seed % 5);
      const activeHours = Math.min(24, Math.max(0, baseHours));
      const dayLabel =
        dayCount <= 14
          ? `${date.getMonth() + 1}/${date.getDate()}`
          : `${date.getDate()}`;
      data.push({
        label: dayLabel,
        active: activeHours,
        inactive: 24 - activeHours,
        fullDate: date.toISOString().slice(0, 10),
      });
    }
  } else {
    // Weekly aggregates for long ranges — avg active hours/day
    const weeks = Math.ceil(dayCount / 7);
    for (let w = 0; w < weeks; w++) {
      const date = new Date(start);
      date.setDate(date.getDate() + w * 7);
      const seed = (date.getDate() * 13 + w * 23 + date.getMonth() * 7) % 100;
      const avgActive = Math.min(24, Math.max(1, 4 + (seed % 7)));
      data.push({
        label: `W${w + 1}`,
        active: avgActive,
        inactive: 24 - avgActive,
        fullDate: `Week of ${date.getMonth() + 1}/${date.getDate()}`,
      });
    }
  }
  return data;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const activeVal = payload.find((p: any) => p.dataKey === "active")?.value ?? 0;
    const inactiveVal = payload.find((p: any) => p.dataKey === "inactive")?.value ?? 0;
    const total = activeVal + inactiveVal;
    const pct = total > 0 ? Math.round((activeVal / total) * 100) : 0;
    const isHourly = total === 60;

    return (
      <div className="bg-card border border-border rounded-xl p-3 shadow-xl min-w-[160px]">
        <p className="text-xs text-muted-foreground mb-2">{payload[0]?.payload?.fullDate || label}</p>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-muted-foreground">Active</span>
            </div>
            <span className="text-foreground tabular-nums">
              {isHourly ? `${activeVal}m` : `${activeVal}h`}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-400/60" />
              <span className="text-muted-foreground">Inactive</span>
            </div>
            <span className="text-foreground tabular-nums">
              {isHourly ? `${inactiveVal}m` : `${inactiveVal}h`}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
            <span className="text-muted-foreground">Activity Rate</span>
            <span className="text-emerald-400 tabular-nums">{pct}%</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

// Today's date for defaults
const TODAY = "2026-03-09";
const WEEK_AGO = "2026-03-03";

export function ActivityTimeline() {
  const [startDate, setStartDate] = useState(WEEK_AGO);
  const [endDate, setEndDate] = useState(TODAY);

  const handleStartChange = useCallback((val: string) => {
    setStartDate(val);
  }, []);

  const handleEndChange = useCallback((val: string) => {
    setEndDate(val);
  }, []);

  const data = useMemo(
    () => generateActivityData(startDate, endDate),
    [startDate, endDate]
  );

  const dayCount = Math.max(
    1,
    Math.round(
      (new Date(endDate).getTime() - new Date(startDate).getTime()) /
        (1000 * 60 * 60 * 24)
    ) + 1
  );
  const isHourly = dayCount <= 1;
  const maxVal = isHourly ? 60 : 24;
  const yLabel = isHourly ? "Minutes" : "Hours";

  // Compute average active
  const avgActive =
    data.length > 0
      ? +(data.reduce((s, d) => s + d.active, 0) / data.length).toFixed(1)
      : 0;

  return (
    <div className="bg-card rounded-2xl border border-border p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 mb-5">
        <div>
          <h3 className="text-foreground">Activity Timeline</h3>
          <p className="text-muted-foreground text-xs mt-1">
            Active vs. inactive time — {isHourly ? "per hour (minutes)" : "24h per day"}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-xs text-muted-foreground">Active</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-400/60" />
            <span className="text-xs text-muted-foreground">Inactive</span>
          </div>
        </div>
      </div>

      {/* Date Range Picker */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-4">
        <PremiumDateRangePicker
          startDate={startDate}
          endDate={endDate}
          onStartChange={handleStartChange}
          onEndChange={handleEndChange}
        />
      </div>

      <div className="h-[160px] sm:h-[180px] min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} stackOffset="none">
            <CartesianGrid
              key="at-grid"
              strokeDasharray="3 3"
              stroke="var(--grid-stroke)"
              vertical={false}
            />
            <XAxis
              key="at-xaxis"
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--axis-tick)", fontSize: 10 }}
              interval="preserveStartEnd"
            />
            <YAxis
              key="at-yaxis"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--axis-tick)", fontSize: 10 }}
              domain={[0, maxVal]}
              label={{
                value: yLabel,
                angle: -90,
                position: "insideLeft",
                fill: "var(--axis-tick)",
                fontSize: 10,
                offset: 10,
              }}
            />
            <Tooltip content={<CustomTooltip />} key="at-tooltip" />
            <ReferenceLine
              key="at-avg"
              y={avgActive}
              stroke="var(--grid-stroke-strong)"
              strokeDasharray="5 5"
              label={{
                value: `Avg: ${avgActive}${isHourly ? "m" : "h"}`,
                fill: "var(--axis-tick)",
                fontSize: 10,
                position: "left",
              }}
            />
            <Bar
              key="bar-active"
              dataKey="active"
              stackId="time"
              radius={[0, 0, 0, 0]}
              name="Active"
            >
              {data.map((d, i) => {
                const pct = d.active / maxVal;
                const color =
                  pct > 0.6
                    ? "#34d399"
                    : pct > 0.35
                    ? "#6366f1"
                    : pct > 0.15
                    ? "#eab308"
                    : "#ef4444";
                return <Cell key={i} fill={color} fillOpacity={0.75} />;
              })}
            </Bar>
            <Bar
              key="bar-inactive"
              dataKey="inactive"
              stackId="time"
              fill="#ef4444"
              fillOpacity={0.12}
              radius={[3, 3, 0, 0]}
              name="Inactive"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
