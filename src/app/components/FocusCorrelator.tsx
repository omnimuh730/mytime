import { useState, useMemo } from "react";
import { formatTooltipNumber } from "../utils/formatTooltipValue";
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
import type { AppInputMinuteDto } from "../types/backend";

interface ScatterPoint {
  hour: number;
  timeLabel: string;
  apm: number;
  switches: number;
  focusScore: number;
  productivity: string;
}

interface HourlyPoint {
  hour: number;
  label: string;
  avgAPM: number;
  avgSwitches: number;
  avgFocus: number;
  productivity: string;
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

function classifyProductivity(apm: number): string {
  if (apm > 65) return "peak";
  if (apm > 50) return "good";
  if (apm > 35) return "normal";
  return "low";
}

function buildFromInputMinutes(inputMinutes: AppInputMinuteDto[]) {
  if (inputMinutes.length === 0) return { scatterData: [], hourlyData: [] };

  const blockMap: Record<
    string,
    { apmSum: number; switchCount: number; count: number }
  > = {};

  for (const m of inputMinutes) {
    const h = Math.floor(m.minuteOfDay / 60);
    const q = Math.floor((m.minuteOfDay % 60) / 15) * 15;
    const key = `${h}:${q.toString().padStart(2, "0")}`;
    if (!blockMap[key]) blockMap[key] = { apmSum: 0, switchCount: 0, count: 0 };
    const apm =
      m.keyPresses * 12 +
      m.mouseClicks * 10 +
      m.scrollEvents * 8 +
      m.mouseMoves * 3;
    blockMap[key].apmSum += apm;
    blockMap[key].count += 1;
  }

  const scatterData: ScatterPoint[] = Object.entries(blockMap)
    .map(([key, v]) => {
      const [hStr, mStr] = key.split(":");
      const h = parseInt(hStr);
      const min = parseInt(mStr);
      const hour = h + min / 60;
      const apm = Math.round(v.apmSum / v.count);
      const switches = Math.max(0, Math.round(v.switchCount / v.count));
      const focusScore = Math.min(
        100,
        Math.max(0, Math.round(apm * 1.1 - switches * 5 + 10)),
      );
      return {
        hour,
        timeLabel: key,
        apm: Math.min(apm, 100),
        switches,
        focusScore,
        productivity: classifyProductivity(Math.min(apm, 100)),
      };
    })
    .sort((a, b) => a.hour - b.hour);

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

  const hourlyData: HourlyPoint[] = Object.entries(hourMap)
    .map(([h, v]) => {
      const avg = Math.round(v.apmSum / v.count);
      return {
        hour: parseInt(h),
        label: `${parseInt(h)}:00`,
        avgAPM: avg,
        avgSwitches: +(v.switchSum / v.count).toFixed(1),
        avgFocus: Math.round(v.focusSum / v.count),
        productivity: classifyProductivity(avg),
      };
    })
    .sort((a, b) => a.hour - b.hour);

  return { scatterData, hourlyData };
}

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
            <span className="text-muted-foreground">Input Intensity</span>
            <span className="text-foreground tabular-nums">
              {formatTooltipNumber(data.apm, 2)} APM
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Focus Score</span>
            <span className="tabular-nums" style={{ color }}>
              {formatTooltipNumber(data.focusScore, 2)}%
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
          <div
            key={i}
            className="flex items-center justify-between text-xs mb-1"
          >
            <div className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: p.color }}
              />
              <span className="text-muted-foreground">{p.name}</span>
            </div>
            <span className="text-foreground tabular-nums">
              {formatTooltipNumber(p.value, 2)}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

interface FocusCorrelatorProps {
  inputMinutes?: AppInputMinuteDto[];
}

export function FocusCorrelator({ inputMinutes = [] }: FocusCorrelatorProps) {
  const [view, setView] = useState<"scatter" | "rhythm">("rhythm");

  const { scatterData, hourlyData } = useMemo(
    () => buildFromInputMinutes(inputMinutes),
    [inputMinutes],
  );

  const peakData = useMemo(
    () => scatterData.filter((d) => d.productivity === "peak"),
    [scatterData],
  );
  const goodData = useMemo(
    () => scatterData.filter((d) => d.productivity === "good"),
    [scatterData],
  );
  const normalData = useMemo(
    () => scatterData.filter((d) => d.productivity === "normal"),
    [scatterData],
  );
  const lowData = useMemo(
    () => scatterData.filter((d) => d.productivity === "low"),
    [scatterData],
  );

  const totalBlocks = scatterData.length;
  const avgAPM =
    totalBlocks > 0
      ? Math.round(scatterData.reduce((s, d) => s + d.apm, 0) / totalBlocks)
      : 0;
  const avgFocus =
    totalBlocks > 0
      ? Math.round(
          scatterData.reduce((s, d) => s + d.focusScore, 0) / totalBlocks,
        )
      : 0;
  const avgPeakAPM =
    peakData.length > 0
      ? Math.round(peakData.reduce((s, d) => s + d.apm, 0) / peakData.length)
      : 0;

  const zoneStats = useMemo(
    () =>
      (["peak", "good", "normal", "low"] as const).map((zone) => {
        const items = scatterData.filter((d) => d.productivity === zone);
        const count = items.length;
        const pct =
          totalBlocks > 0 ? Math.round((count / totalBlocks) * 100) : 0;
        const avgApm =
          count > 0
            ? Math.round(items.reduce((s, d) => s + d.apm, 0) / count)
            : 0;
        const avgSw =
          count > 0
            ? +(items.reduce((s, d) => s + d.switches, 0) / count).toFixed(1)
            : 0;
        const hours = +((count * 15) / 60).toFixed(1);
        return { zone, count, pct, avgApm, avgSw, hours };
      }),
    [scatterData, totalBlocks],
  );

  const bestHour =
    hourlyData.length > 0
      ? hourlyData.reduce((best, h) =>
          h.avgAPM > best.avgAPM ? h : best,
        )
      : null;
  const worstHour =
    hourlyData.length > 0
      ? hourlyData.reduce((worst, h) =>
          h.avgAPM < worst.avgAPM ? h : worst,
        )
      : null;

  const peakLabel = useMemo(() => {
    if (!bestHour) return "No data yet";
    const h = bestHour.hour;
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const endH = h + 1;
    const endH12 = endH === 0 ? 12 : endH > 12 ? endH - 12 : endH;
    const endAmpm = endH >= 12 ? "PM" : "AM";
    return `${h12}:00–${endH12}:00 ${endAmpm}`;
  }, [bestHour]);

  const xDomain = useMemo(() => {
    if (hourlyData.length === 0) return [0, 24];
    const min = Math.max(0, hourlyData[0].hour - 1);
    const max = Math.min(24, hourlyData[hourlyData.length - 1].hour + 1);
    return [min, max];
  }, [hourlyData]);

  const hasData = scatterData.length > 0;

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
            Input intensity vs. focus — real-time productivity mapping
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {bestHour && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs">
              <Sparkles className="w-3 h-3" />
              Peak: {peakLabel}
            </div>
          )}
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
                  <span className="text-xl tabular-nums" style={{ color }}>
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
          {hasData ? (
            <>
              <p>
                <span className="text-primary">Insight:</span> Your peak input
                intensity is{" "}
                <span className="text-emerald-400">{avgPeakAPM} APM</span>{" "}
                during {peakLabel}. Overall average is{" "}
                <span className="text-chart-2">{avgAPM} APM</span> with a mean
                focus score of{" "}
                <span className="text-chart-4">{avgFocus}%</span>.
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                {bestHour && (
                  <span className="flex items-center gap-1 text-[10px]">
                    <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                    <span className="text-muted-foreground">
                      Best hour:{" "}
                      <span className="text-foreground">
                        {bestHour.label} ({bestHour.avgAPM} APM)
                      </span>
                    </span>
                  </span>
                )}
                {worstHour && (
                  <span className="flex items-center gap-1 text-[10px]">
                    <ArrowDownRight className="w-3 h-3 text-red-400" />
                    <span className="text-muted-foreground">
                      Lowest hour:{" "}
                      <span className="text-foreground">
                        {worstHour.label} ({worstHour.avgAPM} APM)
                      </span>
                    </span>
                  </span>
                )}
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
            </>
          ) : (
            <p className="text-muted-foreground">
              Collecting input data — insights will appear as you type, click,
              and interact.
            </p>
          )}
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
                domain={xDomain}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--axis-tick)", fontSize: 10 }}
                tickFormatter={(val: number) => `${Math.floor(val)}:00`}
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

              {hasData && (
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
              )}

              <ZAxis type="number" dataKey="focusScore" range={[40, 120]} />
              <Scatter key="scatter-low" data={lowData} fill="#ef4444" opacity={0.7} name="Low" />
              <Scatter key="scatter-normal" data={normalData} fill="#eab308" opacity={0.7} name="Normal" />
              <Scatter key="scatter-good" data={goodData} fill="#6366f1" opacity={0.8} name="Good" />
              <Scatter key="scatter-peak" data={peakData} fill="#34d399" opacity={0.9} name="Peak" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      ) : (
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

              {bestHour && (
                <ReferenceArea
                  key="rhythm-zone-best"
                  x1={bestHour.label}
                  x2={bestHour.label}
                  yAxisId="apm"
                  fill="#34d399"
                  fillOpacity={0.06}
                />
              )}

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
                    {zoneLabels[zone]} (
                    {zoneStats.find((z) => z.zone === zone)?.pct}%)
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
              Peak:{" "}
              <span className="text-foreground tabular-nums">
                {avgPeakAPM} APM
              </span>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-chart-2" />
            <span className="text-muted-foreground">
              Avg:{" "}
              <span className="text-foreground tabular-nums">{avgAPM} APM</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <MousePointerClick className="w-3 h-3 text-red-400" />
            <span className="text-muted-foreground">
              Focus:{" "}
              <span className="text-foreground tabular-nums">{avgFocus}%</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
