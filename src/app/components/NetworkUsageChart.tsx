import { useState, useMemo, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { PremiumDateRangePicker } from "./ui/PremiumDateRangePicker";

// Generate deterministic mock network data for any date range
function generateNetworkData(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const dayCount = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  const data: { time: string; download: number; upload: number }[] = [];

  if (dayCount <= 14) {
    // Daily bars
    for (let d = 0; d < dayCount; d++) {
      const date = new Date(start);
      date.setDate(date.getDate() + d);
      const seed = (date.getDate() * 23 + date.getMonth() * 17 + date.getFullYear() * 3) % 100;
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const mult = isWeekend ? 1.3 : 0.85;
      data.push({
        time: dayCount <= 7
          ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getDay()]
          : `${date.getMonth() + 1}/${date.getDate()}`,
        download: Math.round((seed * 0.05 + 1.5) * mult * 10) / 10,
        upload: Math.round((seed * 0.02 + 0.5) * mult * 10) / 10,
      });
    }
  } else if (dayCount <= 60) {
    // Weekly aggregates
    const weeks = Math.ceil(dayCount / 7);
    for (let w = 0; w < weeks; w++) {
      const date = new Date(start);
      date.setDate(date.getDate() + w * 7);
      const seed = (date.getDate() * 19 + w * 37 + date.getMonth() * 11) % 100;
      data.push({
        time: `W${w + 1}`,
        download: Math.round((seed * 0.15 + 10) * 10) / 10,
        upload: Math.round((seed * 0.06 + 3) * 10) / 10,
      });
    }
  } else {
    // Monthly aggregates
    const months = Math.ceil(dayCount / 30);
    for (let m = 0; m < months; m++) {
      const date = new Date(start);
      date.setMonth(date.getMonth() + m);
      const seed = (date.getMonth() * 29 + m * 41 + date.getFullYear() * 3) % 100;
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      data.push({
        time: monthNames[date.getMonth()],
        download: Math.round((seed * 0.5 + 30) * 10) / 10,
        upload: Math.round((seed * 0.2 + 10) * 10) / 10,
      });
    }
  }
  return data;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-xl p-3 shadow-xl">
        <p className="text-xs text-muted-foreground mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground capitalize">
              {entry.dataKey}:
            </span>
            <span className="text-foreground">{entry.value} GB</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const TODAY = "2026-03-09";
const WEEK_AGO = "2026-03-03";

export function NetworkUsageChart() {
  const [startDate, setStartDate] = useState(WEEK_AGO);
  const [endDate, setEndDate] = useState(TODAY);

  const handleStartChange = useCallback((val: string) => {
    setStartDate(val);
  }, []);

  const handleEndChange = useCallback((val: string) => {
    setEndDate(val);
  }, []);

  const data = useMemo(() => generateNetworkData(startDate, endDate), [startDate, endDate]);

  return (
    <div className="bg-card rounded-2xl border border-border p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 mb-5">
        <div>
          <h3 className="text-foreground">Network Usage</h3>
          <p className="text-muted-foreground text-xs mt-1">
            Download & upload traffic over selected range
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#a78bfa]" />
            <span className="text-xs text-muted-foreground">Download</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#34d399]" />
            <span className="text-xs text-muted-foreground">Upload</span>
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

      <div className="h-[200px] sm:h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={4}>
            <CartesianGrid
              key="grid"
              strokeDasharray="3 3"
              stroke="var(--grid-stroke)"
              vertical={false}
            />
            <XAxis
              key="xaxis"
              dataKey="time"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--axis-tick)", fontSize: 11 }}
              interval="preserveStartEnd"
            />
            <YAxis
              key="yaxis"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--axis-tick)", fontSize: 11 }}
              unit=" GB"
            />
            <Tooltip content={<CustomTooltip />} key="tooltip" />
            <Bar
              key="bar-download"
              dataKey="download"
              fill="#a78bfa"
              radius={[6, 6, 0, 0]}
              maxBarSize={32}
            />
            <Bar
              key="bar-upload"
              dataKey="upload"
              fill="#34d399"
              radius={[6, 6, 0, 0]}
              maxBarSize={32}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}