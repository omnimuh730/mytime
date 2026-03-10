import { useState, useMemo } from "react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  Area,
  AreaChart,
} from "recharts";
import {
  Gauge,
  AlertTriangle,
  Calendar,
  Settings,
  Flame,
} from "lucide-react";

interface Props {
  downloadBytesToday: number;
  uploadBytesToday: number;
}

interface DayProjection {
  day: number;
  label: string;
  actual: number | null;
  projected: number | null;
  optimistic: number | null;
  pessimistic: number | null;
}

function bytesToGB(b: number): number {
  return Math.round((b / (1024 * 1024 * 1024)) * 100) / 100;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border border-border rounded-xl p-3 shadow-xl">
        <p className="text-xs text-foreground mb-1.5">{label}</p>
        {payload.map((p: any, i: number) => (
          <div key={i} className="flex items-center gap-2 text-[11px]">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-muted-foreground capitalize">
              {p.dataKey === "actual" ? "Actual" : p.dataKey === "projected" ? "Projected" : p.dataKey === "optimistic" ? "Best Case" : "Worst Case"}:
            </span>
            <span className="text-foreground tabular-nums">{p.value?.toFixed(1)} GB</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export function NetworkQuotaBurndown({ downloadBytesToday, uploadBytesToday }: Props) {
  const [quotaGB, setQuotaGB] = useState(50);
  const [showSettings, setShowSettings] = useState(false);

  const todayGB = bytesToGB(downloadBytesToday + uploadBytesToday);
  const todayIndex = new Date().getDate();
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();

  const data = useMemo(() => {
    const result: DayProjection[] = [];
    const avgDaily = todayIndex > 0 ? todayGB / todayIndex : todayGB;

    let cumulative = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      if (day <= todayIndex) {
        const dayUsage = day === todayIndex ? todayGB : 0;
        cumulative += dayUsage;
        result.push({
          day,
          label: `${new Date().toLocaleString("default", { month: "short" })} ${day}`,
          actual: Math.round(cumulative * 10) / 10,
          projected: null,
          optimistic: null,
          pessimistic: null,
        });
      } else {
        const projected = cumulative + avgDaily * (day - todayIndex);
        result.push({
          day,
          label: `${new Date().toLocaleString("default", { month: "short" })} ${day}`,
          actual: null,
          projected: Math.round(projected * 10) / 10,
          optimistic: Math.round(projected * 0.7 * 10) / 10,
          pessimistic: Math.round(projected * 1.4 * 10) / 10,
        });
      }
    }
    return result;
  }, [todayGB, todayIndex, daysInMonth]);

  const currentUsage = todayGB;
  const percentUsed = quotaGB > 0 ? Math.round((currentUsage / quotaGB) * 100) : 0;
  const avgDaily = todayIndex > 0 ? currentUsage / todayIndex : currentUsage;
  const remaining = quotaGB - currentUsage;
  const daysLeft = remaining > 0 && avgDaily > 0 ? Math.floor(remaining / avgDaily) : 0;
  const exhaustionDay = Math.min(todayIndex + daysLeft, daysInMonth);

  const isOverBudget = currentUsage >= quotaGB;
  const isWarning = percentUsed > 70;

  const ringPercentage = Math.min(percentUsed, 100);
  const circumference = 2 * Math.PI * 54;
  const dashOffset = circumference - (ringPercentage / 100) * circumference;
  const ringColor = isOverBudget ? "#ef4444" : isWarning ? "#eab308" : "#6366f1";

  const monthName = new Date().toLocaleString("default", { month: "short" });

  return (
    <div className="bg-card rounded-2xl border border-border p-4 sm:p-6 overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 mb-5">
        <div>
          <h3 className="text-foreground flex items-center gap-2">
            <Gauge className="w-5 h-5 text-chart-5" />
            Network Quota & Burndown
          </h3>
          <p className="text-muted-foreground text-xs mt-1">Monthly quota projection from today&apos;s real interface counters</p>
        </div>
        <div className="flex items-center gap-2">
          {!isOverBudget && daysLeft < 15 && daysLeft > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-yellow-500/10 text-yellow-400 text-xs">
              <AlertTriangle className="w-3 h-3" />
              Runs out {monthName} {exhaustionDay}
            </div>
          )}
          <button onClick={() => setShowSettings(!showSettings)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="mb-4 p-3 rounded-xl bg-secondary/40 border border-border">
          <div className="flex items-center gap-4">
            <label className="text-xs text-muted-foreground whitespace-nowrap">Monthly Quota:</label>
            <input type="range" min="10" max="200" step="5" value={quotaGB} onChange={(e) => setQuotaGB(parseInt(e.target.value))} className="flex-1 accent-primary cursor-pointer" />
            <div className="flex items-center gap-1">
              <input type="number" value={quotaGB} onChange={(e) => setQuotaGB(Math.max(1, parseInt(e.target.value) || 1))} className="w-16 bg-secondary border border-border rounded-lg px-2 py-1 text-xs text-foreground text-center focus:outline-none focus:ring-1 focus:ring-primary/50" />
              <span className="text-xs text-muted-foreground">GB</span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] lg:grid-cols-[200px_1fr] gap-4 sm:gap-6 min-w-0">
        <div className="flex flex-col items-center justify-center">
          <div className="relative">
            <svg width="130" height="130" className="-rotate-90">
              <circle cx="65" cy="65" r="54" fill="none" stroke="var(--gauge-track)" strokeWidth="8" />
              <circle cx="65" cy="65" r="54" fill="none" stroke={ringColor} strokeWidth="8" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={dashOffset} className="transition-all duration-1000" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center rotate-0">
              <span className="text-2xl tabular-nums transition-colors duration-500" style={{ color: ringColor }}>{percentUsed}%</span>
              <span className="text-[10px] text-muted-foreground">used</span>
            </div>
          </div>

          <div className="mt-4 space-y-2 w-full">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Used</span>
              <span className="text-foreground tabular-nums">{currentUsage.toFixed(2)} GB</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Remaining</span>
              <span className="tabular-nums" style={{ color: remaining > 0 ? "#34d399" : "#ef4444" }}>
                {remaining > 0 ? `${remaining.toFixed(2)} GB` : "Over budget!"}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Daily Avg</span>
              <span className="text-foreground tabular-nums">{avgDaily.toFixed(2)} GB/day</span>
            </div>
            <div className="flex items-center justify-between text-xs pt-2 border-t border-border">
              <span className="text-muted-foreground flex items-center gap-1">
                <Flame className="w-3 h-3 text-chart-5" />Exhaustion
              </span>
              <span className="tabular-nums" style={{ color: daysLeft < 10 ? "#ef4444" : "#eab308" }}>
                {daysLeft > 0 ? `${monthName} ${exhaustionDay} (${daysLeft}d left)` : "—"}
              </span>
            </div>
          </div>
        </div>

        <div className="h-[260px] min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <defs key="nqb-defs">
                <linearGradient id="projectedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="pessimisticGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.08} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid key="nqb-grid" strokeDasharray="3 3" stroke="var(--grid-stroke)" />
              <XAxis key="nqb-xaxis" dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "var(--axis-tick)", fontSize: 10 }} interval={4} />
              <YAxis key="nqb-yaxis" axisLine={false} tickLine={false} tick={{ fill: "var(--axis-tick)", fontSize: 10 }} tickFormatter={(v) => `${v}G`} />
              <Tooltip content={<CustomTooltip />} key="nqb-tooltip" />
              <ReferenceLine key="refline-quota" y={quotaGB} stroke="#ef4444" strokeDasharray="8 4" strokeWidth={1.5} label={{ value: `Quota: ${quotaGB} GB`, fill: "#ef4444", fontSize: 10, position: "right" }} />
              <ReferenceArea key="refarea-danger" y1={quotaGB} y2={quotaGB * 1.5} fill="#ef4444" fillOpacity={0.03} />
              <Area key="area-pessimistic" type="monotone" dataKey="pessimistic" stroke="#ef4444" strokeWidth={1} strokeDasharray="4 4" fill="url(#pessimisticGrad)" dot={false} connectNulls={false} />
              <Area key="area-optimistic" type="monotone" dataKey="optimistic" stroke="#34d399" strokeWidth={1} strokeDasharray="4 4" fill="none" dot={false} connectNulls={false} />
              <Area key="area-projected" type="monotone" dataKey="projected" stroke="#6366f1" strokeWidth={2} strokeDasharray="6 3" fill="url(#projectedGrad)" dot={false} connectNulls={false} />
              <Area key="line-actual" type="monotone" dataKey="actual" stroke="#22d3ee" strokeWidth={2.5} fill="none" dot={{ r: 2.5, fill: "#22d3ee", strokeWidth: 0 }} activeDot={{ r: 5, fill: "#22d3ee", stroke: "var(--dot-stroke)", strokeWidth: 2 }} connectNulls={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t border-border">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px]">
          {[
            { label: "Actual", color: "#22d3ee", dash: false },
            { label: "Projected", color: "#6366f1", dash: true },
            { label: "Best Case", color: "#34d399", dash: true },
            { label: "Worst Case", color: "#ef4444", dash: true },
            { label: "Quota Limit", color: "#ef4444", dash: false },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <div className="w-4 h-0.5 rounded" style={{ backgroundColor: item.dash ? "transparent" : item.color, ...(item.dash ? { backgroundImage: `repeating-linear-gradient(90deg, ${item.color} 0px, ${item.color} 3px, transparent 3px, transparent 6px)` } : {}) }} />
              <span className="text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1 text-[10px]">
          <Calendar className="w-3 h-3 text-muted-foreground" />
          <span className="text-muted-foreground">Current billing cycle</span>
        </div>
      </div>
    </div>
  );
}
