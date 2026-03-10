import { useState } from "react";
import { useActivityHeatmap } from "../hooks/useActivityHeatmap";

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const hours = Array.from({ length: 24 }, (_, i) =>
  i.toString().padStart(2, "0")
);

const getColor = (value: number) => {
  if (value === 0) return "rgba(99, 102, 241, 0.03)";
  if (value < 15) return "rgba(99, 102, 241, 0.1)";
  if (value < 30) return "rgba(99, 102, 241, 0.2)";
  if (value < 50) return "rgba(99, 102, 241, 0.35)";
  if (value < 70) return "rgba(99, 102, 241, 0.55)";
  if (value < 85) return "rgba(99, 102, 241, 0.75)";
  return "rgba(99, 102, 241, 0.95)";
};

export function ActivityHeatmap() {
  const [hoveredCell, setHoveredCell] = useState<{
    day: number;
    hour: number;
  } | null>(null);
  const { grid, isLoading, error } = useActivityHeatmap();

  const heatmapData = grid ?? [];

  return (
    <div className="bg-card rounded-2xl border border-border p-4 sm:p-6">
      {error && (
        <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-foreground">Activity Heatmap</h3>
          <p className="text-muted-foreground text-xs mt-1">
            Weekly activity intensity by hour
          </p>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>Less</span>
          {[0.05, 0.15, 0.3, 0.5, 0.7, 0.9].map((opacity, i) => (
            <div
              key={i}
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: `rgba(99, 102, 241, ${opacity})` }}
            />
          ))}
          <span>More</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        {isLoading && heatmapData.length === 0 ? (
          <div className="min-h-[200px] flex items-center justify-center text-muted-foreground text-sm">
            Loading heatmap…
          </div>
        ) : (
        <div className="min-w-[600px]">
          {/* Hour labels */}
          <div className="flex mb-1 ml-10">
            {hours.map((h, i) =>
              i % 3 === 0 ? (
                <div
                  key={h}
                  className="text-xs text-muted-foreground"
                  style={{ width: `${100 / 24}%` }}
                >
                  {h}:00
                </div>
              ) : (
                <div key={h} style={{ width: `${100 / 24}%` }} />
              )
            )}
          </div>

          {/* Heatmap Grid */}
          {days.map((day, dayIndex) => (
            <div key={day} className="flex items-center gap-1 mb-1">
              <span className="text-xs text-muted-foreground w-9 shrink-0">
                {day}
              </span>
              <div className="flex flex-1 gap-px">
                {hours.map((_, hourIndex) => {
                  const value =
                    heatmapData[dayIndex]?.[hourIndex] ?? 0;
                  const isHovered =
                    hoveredCell?.day === dayIndex &&
                    hoveredCell?.hour === hourIndex;
                  return (
                    <div
                      key={hourIndex}
                      className="flex-1 h-6 rounded-sm cursor-pointer transition-all duration-150 relative"
                      style={{
                        backgroundColor: getColor(value),
                        transform: isHovered ? "scale(1.3)" : "scale(1)",
                        zIndex: isHovered ? 10 : 0,
                      }}
                      onMouseEnter={() =>
                        setHoveredCell({ day: dayIndex, hour: hourIndex })
                      }
                      onMouseLeave={() => setHoveredCell(null)}
                    >
                      {isHovered && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-card border border-border rounded-lg px-2 py-1 shadow-xl whitespace-nowrap z-20">
                          <p className="text-xs text-foreground">
                            {day} {hours[hourIndex]}:00
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Activity: {value}%
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        )}
      </div>
    </div>
  );
}