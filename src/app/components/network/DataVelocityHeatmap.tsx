import { useState, useMemo } from "react";
import { Calendar, TrendingUp, TrendingDown, ArrowDownUp } from "lucide-react";

interface DayData {
  date: string;
  day: number;
  month: number;
  year: number;
  dow: number; // 0=Sun
  downloadGB: number;
  uploadGB: number;
  totalGB: number;
}

function generateMonthData(): DayData[] {
  const data: DayData[] = [];
  // Generate ~5 weeks of data centered around today (March 9, 2026)
  const today = new Date(2026, 2, 9); // March 9, 2026

  for (let i = -34; i <= 0; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);

    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    const baseDown = isWeekend ? 6 + Math.random() * 12 : 10 + Math.random() * 18;
    const baseUp = isWeekend ? 1.5 + Math.random() * 4 : 2 + Math.random() * 7;

    // Some spike days
    const spike = Math.random() > 0.88 ? 10 + Math.random() * 15 : 0;

    const downloadGB = Math.round((baseDown + spike) * 10) / 10;
    const uploadGB = Math.round(baseUp * 10) / 10;

    data.push({
      date: d.toISOString().split("T")[0],
      day: d.getDate(),
      month: d.getMonth(),
      year: d.getFullYear(),
      dow: d.getDay(),
      downloadGB,
      uploadGB,
      totalGB: Math.round((downloadGB + uploadGB) * 10) / 10,
    });
  }

  return data;
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

export function DataVelocityHeatmap() {
  const data = useMemo(() => generateMonthData(), []);
  const [hoveredDay, setHoveredDay] = useState<DayData | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const maxTotal = Math.max(...data.map((d) => d.totalGB));
  const avgTotal = Math.round((data.reduce((s, d) => s + d.totalGB, 0) / data.length) * 10) / 10;
  const totalAll = Math.round(data.reduce((s, d) => s + d.totalGB, 0) * 10) / 10;
  const peakDay = data.reduce((best, d) => (d.totalGB > best.totalGB ? d : best), data[0]);

  const getIntensity = (total: number) => {
    if (total <= 0) return 0;
    const ratio = total / maxTotal;
    return Math.min(Math.floor(ratio * 7), 6);
  };

  // Organize into weeks (columns)
  const weeks: (DayData | null)[][] = [];
  let currentWeek: (DayData | null)[] = [];

  // Pad the start
  if (data.length > 0) {
    const firstDow = data[0].dow;
    for (let i = 0; i < firstDow; i++) {
      currentWeek.push(null);
    }
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

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return (
    <div className="bg-card rounded-2xl border border-border p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 mb-5">
        <div>
          <h3 className="text-foreground flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Data Velocity Heatmap
          </h3>
          <p className="text-muted-foreground text-xs mt-1">
            Daily network usage over the past 5 weeks — darker = heavier usage
          </p>
        </div>
        <div className="flex items-center gap-3 sm:gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <ArrowDownUp className="w-3 h-3 text-primary" />
            <span className="text-muted-foreground">
              Total: <span className="text-foreground">{totalAll} GB</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-3 h-3 text-chart-4" />
            <span className="text-muted-foreground">
              Avg: <span className="text-foreground">{avgTotal} GB/day</span>
            </span>
          </div>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="flex gap-2">
        {/* Day of week labels */}
        <div className="flex flex-col gap-[3px] pt-6 shrink-0">
          {DOW_LABELS.map((label) => (
            <div
              key={label}
              className="h-[28px] flex items-center text-[10px] text-muted-foreground pr-2"
            >
              {label}
            </div>
          ))}
        </div>

        {/* Weeks */}
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-[3px]">
            {weeks.map((week, wi) => {
              // Month label
              const firstDayInWeek = week.find((d) => d !== null);
              const showMonth =
                firstDayInWeek &&
                (wi === 0 || firstDayInWeek.day <= 7);

              return (
                <div key={wi} className="flex flex-col gap-[3px]">
                  {/* Month label */}
                  <div className="h-5 flex items-end">
                    {showMonth && firstDayInWeek && (
                      <span className="text-[9px] text-muted-foreground">
                        {monthNames[firstDayInWeek.month]}
                      </span>
                    )}
                  </div>
                  {week.map((day, di) => (
                    <div
                      key={di}
                      className={`w-[28px] h-[28px] rounded-md transition-all duration-150 relative ${
                        day ? "cursor-pointer hover:ring-2 hover:ring-primary/40" : ""
                      }`}
                      style={{
                        backgroundColor: day
                          ? INTENSITY_COLORS[getIntensity(day.totalGB)]
                          : "transparent",
                      }}
                      onMouseEnter={(e) => {
                        if (day) {
                          setHoveredDay(day);
                          const rect = e.currentTarget.getBoundingClientRect();
                          setTooltipPos({
                            x: rect.left + rect.width / 2,
                            y: rect.top,
                          });
                        }
                      }}
                      onMouseLeave={() => setHoveredDay(null)}
                    >
                      {day && day.day === new Date(2026, 2, 9).getDate() && day.month === 2 && (
                        <div className="absolute inset-0 rounded-md ring-2 ring-primary pointer-events-none" />
                      )}
                      {day && (
                        <span className="absolute inset-0 flex items-center justify-center text-[8px] text-white/40">
                          {day.day}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">Less</span>
          {INTENSITY_COLORS.map((color, i) => (
            <div
              key={i}
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: color }}
            />
          ))}
          <span className="text-[10px] text-muted-foreground">More</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px]">
          <TrendingUp className="w-3 h-3 text-chart-5" />
          <span className="text-muted-foreground">
            Peak:{" "}
            <span className="text-chart-5">
              {monthNames[peakDay.month]} {peakDay.day} — {peakDay.totalGB} GB
            </span>
          </span>
        </div>
      </div>

      {/* Tooltip */}
      {hoveredDay && (
        <div
          className="fixed z-[100] pointer-events-none"
          style={{
            left: tooltipPos.x,
            top: tooltipPos.y - 8,
            transform: "translate(-50%, -100%)",
          }}
        >
          <div className="bg-popover border border-border rounded-xl p-3 shadow-2xl shadow-black/50 min-w-[180px]">
            <p className="text-xs text-foreground mb-2">
              {monthNames[hoveredDay.month]} {hoveredDay.day}, {hoveredDay.year}
              <span className="text-muted-foreground ml-1">
                ({DOW_LABELS[hoveredDay.dow]})
              </span>
            </p>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-chart-4 flex items-center gap-1">
                  <TrendingDown className="w-3 h-3" />
                  Download
                </span>
                <span className="text-foreground tabular-nums">
                  {hoveredDay.downloadGB} GB
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-chart-5 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  Upload
                </span>
                <span className="text-foreground tabular-nums">
                  {hoveredDay.uploadGB} GB
                </span>
              </div>
              <div className="flex items-center justify-between text-xs pt-1 border-t border-border">
                <span className="text-primary">Total</span>
                <span className="text-foreground tabular-nums">
                  {hoveredDay.totalGB} GB
                </span>
              </div>
            </div>
            {/* Intensity bar */}
            <div className="mt-2 h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full"
                style={{
                  width: `${(hoveredDay.totalGB / maxTotal) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}