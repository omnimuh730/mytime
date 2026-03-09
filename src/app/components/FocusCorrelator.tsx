import { useState } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  Bar,
  Cell,
  ComposedChart,
  Line,
  Area,
  ZAxis,
} from "recharts";
import {
  Brain,
  Sparkles,
  TrendingUp,
  Clock,
  Zap,
  Coffee,
  Moon,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  MousePointerClick,
} from "lucide-react";

// Generate data: each point = a 15-min block with typing speed & app switches
const generateScatterData = () => {
  const data = [];
  for (let h = 7; h <= 21; h++) {
    for (let m = 0; m < 60; m += 15) {
      const hour = h + m / 60;
      // Simulate biological rhythm: peak around 10-11:30 AM and 2-3:30 PM
      const morningPeak =
        Math.exp(-Math.pow(hour - 10.75, 2) / 1.5) * 45;
      const afternoonPeak =
        Math.exp(-Math.pow(hour - 14.75, 2) / 2) * 35;
      const baseAPM = 35 + morningPeak + afternoonPeak;
      const apm = Math.round(baseAPM + (Math.random() - 0.5) * 20);

      // App switches inversely correlate with focus
      const baseSwitches = 8 - morningPeak * 0.12 - afternoonPeak * 0.1;
      const switches = Math.max(
        0,
        Math.round(baseSwitches + (Math.random() - 0.5) * 4)
      );

      // Focus score derived from APM and switches
      const focusScore = Math.min(
        100,
        Math.max(0, Math.round(apm * 1.1 - switches * 5 + 10))
      );

      data.push({
        hour,
        timeLabel: `${h}:${m.toString().padStart(2, "0")}`,
        apm,
        switches,
        focusScore,
        productivity:
          apm > 65 ? "peak" : apm > 50 ? "good" : apm > 35 ? "normal" : "low",
      });
    }
  }
  return data;
};

const scatterData = generateScatterData();

const peakData = scatterData.filter((d) => d.productivity === "peak");
const goodData = scatterData.filter((d) => d.productivity === "good");
const normalData = scatterData.filter((d) => d.productivity === "normal");
const lowData = scatterData.filter((d) => d.productivity === "low");

// Hourly aggregation for the rhythm chart
const hourlyData = useMemoHourly();
function useMemoHourly() {
  const hourMap: Record<
    number,
    { apmSum: number; switchSum: number; focusSum: number; count: number }
  > = {};
  for (const d of scatterData) {
    const h = Math.floor(d.hour);
    if (!hourMap[h])
      hourMap[h] = { apmSum: 0, switchSum: 0, focusSum: 0, count: 0 };
    hourMap[h].apmSum += d.apm;
    hourMap[h].switchSum += d.switches;
    hourMap[h].focusSum += d.focusScore;
    hourMap[h].count += 1;
  }
  return Object.entries(hourMap)
    .map(([h, v]) => ({
      hour: parseInt(h),
      label: `${parseInt(h)}:00`,
      avgAPM: Math.round(v.apmSum / v.count),
      avgSwitches: +(v.switchSum / v.count).toFixed(1),
      avgFocus: Math.round(v.focusSum / v.count),
      productivity:
        v.apmSum / v.count > 65
          ? "peak"
          : v.apmSum / v.count > 50
          ? "good"
          : v.apmSum / v.count > 35
          ? "normal"
          : "low",
    }))
    .sort((a, b) => a.hour - b.hour);
}

const zoneColors: Record<string, string> = {
  peak: "#34d399",
  good: "#6366f1",
  normal: "#eab308",
  low: "#ef4444",
};

const zoneLabels: Record<string, string> = {
  peak: "Peak Flow",
  good: "Good Focus",
  normal: "Normal",
  low: "Low Energy",
};

const zoneIcons: Record<string, typeof Zap> = {
  peak: Zap,
  good: TrendingUp,
  normal: Coffee,
  low: Moon,
};

const zoneDescriptions: Record<string, string> = {
  peak: "Deep work zone — minimal distractions, high throughput",
  good: "Productive focus — steady output with occasional context switches",
  normal: "Moderate focus — higher distraction frequency",
  low: "Recovery period — low activity, frequent app switching",
};

const CustomScatterTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const color = zoneColors[data.productivity];
    return (
      <div className="bg-card border border-border rounded-xl p-3 shadow-xl min-w-[180px]">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-foreground">{data.timeLabel}</p>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-md capitalize"
            style={{ backgroundColor: color + "20", color }}
          >
            {data.productivity}
          </span>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Typing Speed</span>
            <span className="text-foreground tabular-nums">{data.apm} APM</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">App Switches</span>
            <span className="text-foreground tabular-nums">
              {data.switches}/15min
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Focus Score</span>
            <span className="tabular-nums" style={{ color }}>
              {data.focusScore}%
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

const CustomRhythmTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-xl p-3 shadow-xl min-w-[160px]">
        <p className="text-xs text-foreground mb-2">{label}</p>
        {payload.map((p: any, i: number) => (
          <div key={i} className="flex items-center justify-between text-xs mb-1">
            <div className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: p.color }}
              />
              <span className="text-muted-foreground">{p.name}</span>
            </div>
            <span className="text-foreground tabular-nums">{p.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// Stats
const avgPeakAPM =
  peakData.length > 0
    ? Math.round(peakData.reduce((s, d) => s + d.apm, 0) / peakData.length)
    : 0;
const avgAPM = Math.round(
  scatterData.reduce((s, d) => s + d.apm, 0) / scatterData.length
);
const avgFocus = Math.round(
  scatterData.reduce((s, d) => s + d.focusScore, 0) / scatterData.length
);
const totalBlocks = scatterData.length;

// Zone stats
const zoneStats = (["peak", "good", "normal", "low"] as const).map((zone) => {
  const items = scatterData.filter((d) => d.productivity === zone);
  const count = items.length;
  const pct = Math.round((count / totalBlocks) * 100);
  const avgApm =
    count > 0 ? Math.round(items.reduce((s, d) => s + d.apm, 0) / count) : 0;
  const avgSw =
    count > 0
      ? +(items.reduce((s, d) => s + d.switches, 0) / count).toFixed(1)
      : 0;
  const hours = +((count * 15) / 60).toFixed(1);
  return { zone, count, pct, avgApm, avgSw, hours };
});

// Best and worst hours
const bestHour = hourlyData.reduce(
  (best, h) => (h.avgAPM > best.avgAPM ? h : best),
  hourlyData[0]
);
const worstHour = hourlyData.reduce(
  (worst, h) => (h.avgAPM < worst.avgAPM ? h : worst),
  hourlyData[0]
);

export function FocusCorrelator() {
  const [view, setView] = useState<"scatter" | "rhythm">("rhythm");

  return (
    <div className="bg-card rounded-2xl border border-border p-4 sm:p-6 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 mb-4">
        <div>
          <h3 className="text-foreground flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            Hardware & Focus Correlator
          </h3>
          <p className="text-muted-foreground text-xs mt-1">
            Typing speed vs. context switching — biological productivity mapping
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs">
            <Sparkles className="w-3 h-3" />
            Peak: 10:00–11:30 AM
          </div>
          {/* View Toggle */}
          <div className="flex bg-secondary/60 rounded-lg p-0.5">
            <button
              onClick={() => setView("scatter")}
              className={`px-2 py-1 rounded-md text-[10px] transition-colors cursor-pointer ${
                view === "scatter"
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Scatter
            </button>
            <button
              onClick={() => setView("rhythm")}
              className={`px-2 py-1 rounded-md text-[10px] transition-colors cursor-pointer ${
                view === "rhythm"
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Rhythm
            </button>
          </div>
        </div>
      </div>

      {/* Zone Distribution Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-4">
        {zoneStats.map((z) => {
          const Icon = zoneIcons[z.zone];
          const color = zoneColors[z.zone];
          return (
            <div
              key={z.zone}
              className="relative rounded-xl border border-border p-3 overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${color}08 0%, transparent 60%)`,
              }}
            >
              {/* Percentage bar background */}
              <div
                className="absolute bottom-0 left-0 h-1 rounded-b-xl transition-all duration-500"
                style={{
                  width: `${z.pct}%`,
                  backgroundColor: color,
                  opacity: 0.4,
                }}
              />
              <div className="flex items-center gap-1.5 mb-2">
                <Icon className="w-3.5 h-3.5" style={{ color }} />
                <span className="text-xs text-foreground capitalize">
                  {zoneLabels[z.zone]}
                </span>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <span
                    className="text-xl tabular-nums"
                    style={{ color }}
                  >
                    {z.pct}%
                  </span>
                  <span className="text-[10px] text-muted-foreground ml-1">
                    ({z.hours}h)
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-muted-foreground">
                    {z.avgApm} <span className="text-[9px]">APM</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {z.avgSw} <span className="text-[9px]">sw/15m</span>
                  </div>
                </div>
              </div>
              <p className="text-[9px] text-muted-foreground mt-1.5 leading-tight hidden sm:block">
                {zoneDescriptions[z.zone]}
              </p>
            </div>
          );
        })}
      </div>

      {/* Insight Banner */}
      <div className="flex items-start sm:items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-primary/5 via-chart-2/5 to-chart-4/5 border border-primary/10 mb-4">
        <Brain className="w-5 h-5 text-primary shrink-0 mt-0.5 sm:mt-0" />
        <div className="text-xs text-foreground space-y-1">
          <p>
            <span className="text-primary">Insight:</span> Your peak typing
            speed is{" "}
            <span className="text-emerald-400">{avgPeakAPM} APM</span> during
            morning flow (10:00–11:30 AM) with the fewest app switches. Overall
            average is <span className="text-chart-2">{avgAPM} APM</span> with a
            mean focus score of{" "}
            <span className="text-chart-4">{avgFocus}%</span>.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <span className="flex items-center gap-1 text-[10px]">
              <ArrowUpRight className="w-3 h-3 text-emerald-400" />
              <span className="text-muted-foreground">
                Best hour:{" "}
                <span className="text-foreground">
                  {bestHour.label} ({bestHour.avgAPM} APM)
                </span>
              </span>
            </span>
            <span className="flex items-center gap-1 text-[10px]">
              <ArrowDownRight className="w-3 h-3 text-red-400" />
              <span className="text-muted-foreground">
                Lowest hour:{" "}
                <span className="text-foreground">
                  {worstHour.label} ({worstHour.avgAPM} APM)
                </span>
              </span>
            </span>
            <span className="flex items-center gap-1 text-[10px]">
              <Activity className="w-3 h-3 text-chart-2" />
              <span className="text-muted-foreground">
                Sampled:{" "}
                <span className="text-foreground">
                  {totalBlocks} blocks (15-min intervals)
                </span>
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Charts */}
      {view === "scatter" ? (
        <div className="h-[220px] sm:h-[300px] min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--grid-stroke)"
              />
              <XAxis
                dataKey="hour"
                type="number"
                domain={[7, 21]}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--axis-tick)", fontSize: 10 }}
                tickFormatter={(val) => `${Math.floor(val)}:00`}
                ticks={[7, 9, 11, 13, 15, 17, 19, 21]}
                name="Time"
              />
              <YAxis
                dataKey="apm"
                type="number"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--axis-tick)", fontSize: 10 }}
                name="APM"
                label={{
                  value: "APM",
                  angle: -90,
                  position: "insideLeft",
                  fill: "var(--axis-tick)",
                  fontSize: 10,
                  offset: 10,
                }}
              />
              <Tooltip
                content={<CustomScatterTooltip />}
                cursor={{
                  strokeDasharray: "3 3",
                  stroke: "var(--grid-stroke-strong)",
                }}
              />

              {/* Peak productivity zone highlight */}
              <ReferenceArea
                key="peak-zone-morning"
                x1={10}
                x2={11.5}
                y1={0}
                y2={100}
                fill="#34d399"
                fillOpacity={0.06}
                stroke="#34d399"
                strokeOpacity={0.15}
                strokeDasharray="3 3"
              />
              <ReferenceArea
                key="peak-zone-afternoon"
                x1={14}
                x2={15.5}
                y1={0}
                y2={100}
                fill="#6366f1"
                fillOpacity={0.04}
                stroke="#6366f1"
                strokeOpacity={0.1}
                strokeDasharray="3 3"
              />

              {/* Zone threshold lines */}
              <ReferenceLine
                key="threshold-peak"
                y={65}
                stroke="#34d399"
                strokeDasharray="5 5"
                strokeOpacity={0.3}
                label={{
                  value: "Peak ▸",
                  fill: "#34d399",
                  fontSize: 9,
                  position: "right",
                }}
              />
              <ReferenceLine
                key="threshold-good"
                y={50}
                stroke="#6366f1"
                strokeDasharray="5 5"
                strokeOpacity={0.3}
                label={{
                  value: "Good ▸",
                  fill: "#6366f1",
                  fontSize: 9,
                  position: "right",
                }}
              />
              <ReferenceLine
                key="threshold-normal"
                y={35}
                stroke="#eab308"
                strokeDasharray="5 5"
                strokeOpacity={0.3}
                label={{
                  value: "Normal ▸",
                  fill: "#eab308",
                  fontSize: 9,
                  position: "right",
                }}
              />

              {/* Average line */}
              <ReferenceLine
                key="avg-line"
                y={avgAPM}
                stroke="var(--grid-stroke-strong)"
                strokeDasharray="5 5"
                label={{
                  value: `Avg: ${avgAPM}`,
                  fill: "var(--axis-tick)",
                  fontSize: 10,
                  position: "left",
                }}
              />

              {/* Data points by productivity tier */}
              <ZAxis type="number" dataKey="focusScore" range={[40, 120]} />
              <Scatter
                key="scatter-low"
                data={lowData}
                fill="#ef4444"
                opacity={0.7}
                name="Low"
              />
              <Scatter
                key="scatter-normal"
                data={normalData}
                fill="#eab308"
                opacity={0.7}
                name="Normal"
              />
              <Scatter
                key="scatter-good"
                data={goodData}
                fill="#6366f1"
                opacity={0.8}
                name="Good"
              />
              <Scatter
                key="scatter-peak"
                data={peakData}
                fill="#34d399"
                opacity={0.9}
                name="Peak"
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      ) : (
        /* Rhythm View - Composed hourly chart */
        <div className="h-[220px] sm:h-[300px] min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={hourlyData}
              margin={{ top: 10, right: 10, bottom: 10, left: 0 }}
            >
              <defs>
                <linearGradient id="focusGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--grid-stroke)"
              />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--axis-tick)", fontSize: 10 }}
              />
              <YAxis
                yAxisId="apm"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--axis-tick)", fontSize: 10 }}
                label={{
                  value: "APM",
                  angle: -90,
                  position: "insideLeft",
                  fill: "var(--axis-tick)",
                  fontSize: 10,
                  offset: 10,
                }}
              />
              <YAxis
                yAxisId="switches"
                orientation="right"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--axis-tick)", fontSize: 10 }}
                label={{
                  value: "Switches",
                  angle: 90,
                  position: "insideRight",
                  fill: "var(--axis-tick)",
                  fontSize: 10,
                  offset: 10,
                }}
              />
              <Tooltip content={<CustomRhythmTooltip />} />

              {/* Peak zone highlights */}
              <ReferenceArea
                key="rhythm-zone-morning"
                x1="10:00"
                x2="11:00"
                yAxisId="apm"
                fill="#34d399"
                fillOpacity={0.06}
              />
              <ReferenceArea
                key="rhythm-zone-afternoon"
                x1="14:00"
                x2="15:00"
                yAxisId="apm"
                fill="#6366f1"
                fillOpacity={0.04}
              />

              {/* Avg APM bar chart */}
              <Bar
                yAxisId="apm"
                dataKey="avgAPM"
                name="Avg APM"
                radius={[4, 4, 0, 0]}
                barSize={20}
              >
                {hourlyData.map((d, i) => (
                  <Cell
                    key={i}
                    fill={zoneColors[d.productivity]}
                    fillOpacity={0.6}
                  />
                ))}
              </Bar>

              {/* Focus score area */}
              <Area
                yAxisId="apm"
                type="monotone"
                dataKey="avgFocus"
                name="Focus Score"
                stroke="#6366f1"
                strokeWidth={2}
                fill="url(#focusGrad)"
                dot={false}
              />

              {/* App switches line */}
              <Line
                yAxisId="switches"
                type="monotone"
                dataKey="avgSwitches"
                name="Switches/15m"
                stroke="#ef4444"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={{ r: 2.5, fill: "#ef4444", strokeWidth: 0 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Legend & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-4 pt-4 border-t border-border gap-3 sm:gap-0">
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
          {view === "scatter" ? (
            <>
              {(["peak", "good", "normal", "low"] as const).map((zone) => (
                <div key={zone} className="flex items-center gap-1.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: zoneColors[zone] }}
                  />
                  <span className="text-[10px] text-muted-foreground capitalize">
                    {zoneLabels[zone]} ({zoneStats.find((z) => z.zone === zone)?.pct}%)
                  </span>
                </div>
              ))}
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-2.5 rounded-sm bg-primary/60" />
                <span className="text-[10px] text-muted-foreground">
                  APM (color = zone)
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 rounded bg-primary" />
                <span className="text-[10px] text-muted-foreground">
                  Focus Score
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div
                  className="w-3 h-0.5 rounded"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(90deg, #ef4444 0px, #ef4444 2px, transparent 2px, transparent 4px)",
                  }}
                />
                <span className="text-[10px] text-muted-foreground">
                  App Switches
                </span>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-3 sm:gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-3 h-3 text-emerald-400" />
            <span className="text-muted-foreground">
              Peak: <span className="text-foreground tabular-nums">{avgPeakAPM} APM</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-chart-2" />
            <span className="text-muted-foreground">
              Avg: <span className="text-foreground tabular-nums">{avgAPM} APM</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <MousePointerClick className="w-3 h-3 text-red-400" />
            <span className="text-muted-foreground">
              Focus: <span className="text-foreground tabular-nums">{avgFocus}%</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}