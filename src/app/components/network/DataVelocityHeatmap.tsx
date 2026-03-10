import { useState, useMemo } from "react";
import { Calendar, TrendingUp, TrendingDown, ArrowDownUp } from "lucide-react";

interface Props {
  downloadBytesToday: number;
  uploadBytesToday: number;
}

interface DayData {
  date: string;
  day: number;
  month: number;
  year: number;
  dow: number;
  downloadGB: number;
  uploadGB: number;
  totalGB: number;
  isToday: boolean;
}

const INTENSITY_COLORS = [
  "rgba(99, 102, 241, 0.06)",
  "rgba(99, 102, 241, 0.15)",
  "rgba(99, 102, 241, 0.28)",
  "rgba(99, 102, 241, 0.45)",
  "rgba(99, 102, 241, 0.65)",
  "rgba(99, 102, 241, 0.85)",
  "#6366f1",
];

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function bytesToGB(b: number): number {
  return Math.round((b / (1024 * 1024 * 1024)) * 100) / 100;
}

export function DataVelocityHeatmap({ downloadBytesToday, uploadBytesToday }: Props) {
  const [hoveredDay, setHoveredDay] = useState<DayData | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const todayDlGB = bytesToGB(downloadBytesToday);
  const todayUlGB = bytesToGB(uploadBytesToday);
  const todayTotalGB = Math.round((todayDlGB + todayUlGB) * 100) / 100;

  const data = useMemo(() => {
    const result: DayData[] = [];
    const today = new Date();

    for (let i = -34; i <= 0; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const isToday = i === 0;

      const downloadGB = isToday ? todayDlGB : 0;
      const uploadGB = isToday ? todayUlGB : 0;

      result.push({
        date: d.toISOString().split("T")[0],
        day: d.getDate(),
        month: d.getMonth(),
        year: d.getFullYear(),
        dow: d.getDay(),
        downloadGB,
        uploadGB,
        totalGB: Math.round((downloadGB + uploadGB) * 100) / 100,
        isToday,
      });
    }
    return result;
  }, [todayDlGB, todayUlGB]);

  const maxTotal = Math.max(...data.map((d) => d.totalGB), 0.01);
  const totalAll = Math.round(data.reduce((s, d) => s + d.totalGB, 0) * 100) / 100;
  const avgTotal = data.length > 0 ? Math.round((totalAll / data.length) * 100) / 100 : 0;

  const getIntensity = (total: number) => {
    if (total <= 0) return 0;
    const ratio = total / maxTotal;
    return Math.min(Math.floor(ratio * 7), 6);
  };

  const weeks: (DayData | null)[][] = [];
  let currentWeek: (DayData | null)[] = [];

  if (data.length > 0) {
    for (let i = 0; i < data[0].dow; i++) currentWeek.push(null);
  }

  data.forEach((d) => {
    currentWeek.push(d);
    if (d.dow === 6) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  });
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }

  return (
    <div className="bg-card rounded-2xl border border-border p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 mb-5">
        <div>
          <h3 className="text-foreground flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Data Velocity Heatmap
          </h3>
          <p className="text-muted-foreground text-xs mt-1">Daily network usage — today tracked live from interface counters</p>
        </div>
        <div className="flex items-center gap-3 sm:gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <ArrowDownUp className="w-3 h-3 text-primary" />
            <span className="text-muted-foreground">Today: <span className="text-foreground">{todayTotalGB} GB</span></span>
          </div>
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-3 h-3 text-chart-4" />
            <span className="text-muted-foreground">Avg: <span className="text-foreground">{avgTotal} GB/day</span></span>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex flex-col gap-[3px] pt-6 shrink-0">
          {DOW_LABELS.map((label) => (
            <div key={label} className="h-[28px] flex items-center text-[10px] text-muted-foreground pr-2">{label}</div>
          ))}
        </div>

        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-[3px]">
            {weeks.map((week, wi) => {
              const firstDayInWeek = week.find((d) => d !== null);
              const showMonth = firstDayInWeek && (wi === 0 || firstDayInWeek.day <= 7);

              return (
                <div key={wi} className="flex flex-col gap-[3px]">
                  <div className="h-5 flex items-end">
                    {showMonth && firstDayInWeek && (
                      <span className="text-[9px] text-muted-foreground">{monthNames[firstDayInWeek.month]}</span>
                    )}
                  </div>
                  {week.map((day, di) => (
                    <div
                      key={di}
                      className={`w-[28px] h-[28px] rounded-md transition-all duration-150 relative ${day ? "cursor-pointer hover:ring-2 hover:ring-primary/40" : ""}`}
                      style={{ backgroundColor: day ? INTENSITY_COLORS[getIntensity(day.totalGB)] : "transparent" }}
                      onMouseEnter={(e) => {
                        if (day) {
                          setHoveredDay(day);
                          const rect = e.currentTarget.getBoundingClientRect();
                          setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });
                        }
                      }}
                      onMouseLeave={() => setHoveredDay(null)}
                    >
                      {day?.isToday && <div className="absolute inset-0 rounded-md ring-2 ring-primary pointer-events-none" />}
                      {day && <span className="absolute inset-0 flex items-center justify-center text-[8px] text-white/40">{day.day}</span>}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">Less</span>
          {INTENSITY_COLORS.map((color, i) => (
            <div key={i} className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
          ))}
          <span className="text-[10px] text-muted-foreground">More</span>
        </div>
      </div>

      {hoveredDay && (
        <div className="fixed z-[100] pointer-events-none" style={{ left: tooltipPos.x, top: tooltipPos.y - 8, transform: "translate(-50%, -100%)" }}>
          <div className="bg-popover border border-border rounded-xl p-3 shadow-2xl shadow-black/50 min-w-[180px]">
            <p className="text-xs text-foreground mb-2">
              {monthNames[hoveredDay.month]} {hoveredDay.day}, {hoveredDay.year}
              <span className="text-muted-foreground ml-1">({DOW_LABELS[hoveredDay.dow]})</span>
              {hoveredDay.isToday && <span className="text-primary ml-1">(today)</span>}
            </p>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-chart-4 flex items-center gap-1"><TrendingDown className="w-3 h-3" />Download</span>
                <span className="text-foreground tabular-nums">{hoveredDay.downloadGB} GB</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-chart-5 flex items-center gap-1"><TrendingUp className="w-3 h-3" />Upload</span>
                <span className="text-foreground tabular-nums">{hoveredDay.uploadGB} GB</span>
              </div>
              <div className="flex items-center justify-between text-xs pt-1 border-t border-border">
                <span className="text-primary">Total</span>
                <span className="text-foreground tabular-nums">{hoveredDay.totalGB} GB</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
