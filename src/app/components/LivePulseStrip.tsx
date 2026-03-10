import { useState, useEffect, useRef, useMemo } from "react";
import { Wifi, Heart, Zap, Monitor } from "lucide-react";
import type { AppInputMinuteDto, NetOverviewDto } from "../types/backend";

interface PulseEvent {
  id: number;
  type: "active" | "idle" | "network-in" | "network-out" | "app-switch";
  intensity: number;
  timestamp: number;
}

interface ConnectionDot {
  id: number;
  active: boolean;
  direction: "in" | "out";
  flashing: boolean;
}

interface Props {
  inputMinutes?: AppInputMinuteDto[];
  networkOverview?: NetOverviewDto | null;
  sessionDuration?: string;
}

export function LivePulseStrip({
  inputMinutes = [],
  networkOverview = null,
  sessionDuration,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevNetRef = useRef({ dl: 0, ul: 0 });

  const totalActions = useMemo(() => {
    return inputMinutes.reduce(
      (sum, m) =>
        sum + m.keyPresses + m.mouseClicks + m.mouseMoves + m.scrollEvents,
      0,
    );
  }, [inputMinutes]);

  const currentApm = useMemo(() => {
    if (inputMinutes.length === 0) return 0;
    const now = new Date();
    const currentMin = now.getHours() * 60 + now.getMinutes();
    const recentBuckets = inputMinutes.filter(
      (m) => m.minuteOfDay >= currentMin - 5 && m.minuteOfDay <= currentMin,
    );
    if (recentBuckets.length === 0) return 0;
    const total = recentBuckets.reduce(
      (s, m) =>
        s + m.keyPresses + m.mouseClicks + m.mouseMoves + m.scrollEvents,
      0,
    );
    return Math.round(total / recentBuckets.length);
  }, [inputMinutes]);

  const apmHistory = useMemo(() => {
    if (inputMinutes.length === 0) return Array(40).fill(0) as number[];
    const sorted = [...inputMinutes].sort(
      (a, b) => a.minuteOfDay - b.minuteOfDay,
    );
    const last40 = sorted.slice(-40);
    return last40.map((m) =>
      Math.min(
        100,
        m.keyPresses * 12 +
          m.mouseClicks * 10 +
          m.scrollEvents * 8 +
          m.mouseMoves * 3,
      ),
    );
  }, [inputMinutes]);

  const pulseEvents = useMemo((): PulseEvent[] => {
    if (inputMinutes.length === 0) return [];
    const sorted = [...inputMinutes].sort(
      (a, b) => a.minuteOfDay - b.minuteOfDay,
    );
    const last120 = sorted.slice(-120);
    return last120.map((m, i) => {
      const intensity = Math.min(
        100,
        m.keyPresses * 12 +
          m.mouseClicks * 10 +
          m.scrollEvents * 8 +
          m.mouseMoves * 3,
      );
      const isIdle =
        m.keyPresses === 0 &&
        m.mouseClicks === 0 &&
        m.mouseMoves === 0 &&
        m.scrollEvents === 0;
      const type: PulseEvent["type"] = isIdle
        ? "idle"
        : m.keyPresses > m.mouseClicks
          ? "active"
          : "app-switch";
      return {
        id: m.minuteOfDay * 1000 + i,
        type,
        intensity: Math.max(intensity, 5),
        timestamp: Date.now() - (last120.length - i) * 60000,
      };
    });
  }, [inputMinutes]);

  const [connections, setConnections] = useState<ConnectionDot[]>(
    Array.from({ length: 24 }, (_, i) => ({
      id: i,
      active: false,
      direction: (i % 2 === 0 ? "in" : "out") as "in" | "out",
      flashing: false,
    })),
  );

  useEffect(() => {
    if (!networkOverview) return;
    const connCount = networkOverview.activeConnections;
    const dlNow = networkOverview.downloadBytesToday;
    const ulNow = networkOverview.uploadBytesToday;
    const dlDelta = dlNow - prevNetRef.current.dl;
    const ulDelta = ulNow - prevNetRef.current.ul;
    prevNetRef.current = { dl: dlNow, ul: ulNow };
    const hasTraffic = dlDelta > 0 || ulDelta > 0;

    setConnections((prev) =>
      prev.map((c, i) => ({
        ...c,
        active: i < Math.min(connCount, 24),
        direction: i % 2 === 0 ? "in" : "out",
        flashing: hasTraffic && i < Math.min(connCount, 24) && Math.random() > 0.4,
      })),
    );
  }, [networkOverview]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [pulseEvents]);

  const getEventColor = (event: PulseEvent) => {
    if (event.type === "idle") return "rgba(122, 123, 154, 0.4)";
    if (event.type === "network-in") return "#34d399";
    if (event.type === "network-out") return "#22d3ee";
    if (event.type === "app-switch") return "#f97316";
    return "#6366f1";
  };

  const apmColor =
    currentApm > 90
      ? "#34d399"
      : currentApm > 60
        ? "#6366f1"
        : currentApm > 30
          ? "#eab308"
          : "#ef4444";
  const maxApm = Math.max(...apmHistory, 1);

  const activeConns = networkOverview?.activeConnections ?? 0;

  return (
    <div className="bg-card/60 backdrop-blur-sm rounded-2xl border border-border overflow-hidden">
      <div className="flex items-stretch h-[72px]">
        {/* APM Heart-Rate Monitor */}
        <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 border-r border-border shrink-0">
          <div className="relative">
            <Heart
              className="w-5 h-5 transition-colors duration-300"
              style={{ color: apmColor }}
              fill={apmColor}
            />
            {currentApm > 0 && (
              <div
                className="absolute inset-0 rounded-full animate-ping opacity-30"
                style={{ backgroundColor: apmColor }}
              />
            )}
          </div>
          <div className="flex flex-col">
            <div className="flex items-baseline gap-1">
              <span
                className="text-xl tabular-nums transition-colors duration-300"
                style={{ color: apmColor }}
              >
                {currentApm}
              </span>
              <span className="text-xs text-muted-foreground">APM</span>
            </div>
            <span className="text-[10px] text-muted-foreground">
              Actions/Min
            </span>
          </div>
          <div className="flex items-end gap-px h-8 w-[60px] sm:w-[100px]">
            {apmHistory.slice(-30).map((val, i) => (
              <div
                key={i}
                className="flex-1 rounded-sm transition-all duration-300"
                style={{
                  height: `${(val / maxApm) * 100}%`,
                  minHeight: val > 0 ? "2px" : "0px",
                  backgroundColor: apmColor,
                  opacity: 0.3 + (i / 30) * 0.7,
                }}
              />
            ))}
          </div>
        </div>

        {/* Live Activity Timeline */}
        <div className="flex-1 flex flex-col justify-center px-3 sm:px-4 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Live Pulse — Last {Math.min(inputMinutes.length, 120)} min
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-emerald-400">
                {totalActions.toLocaleString()} actions
              </span>
            </div>
          </div>
          <div
            ref={scrollRef}
            className="flex items-end gap-px h-7 overflow-hidden"
          >
            {pulseEvents.map((event) => (
              <div
                key={event.id}
                className="shrink-0 rounded-sm transition-all duration-500"
                style={{
                  width: "4px",
                  height: `${Math.max(event.intensity * 0.9, 8)}%`,
                  backgroundColor: getEventColor(event),
                  opacity: 0.8,
                }}
              />
            ))}
          </div>
        </div>

        {/* Network Connections Grid */}
        <div className="hidden md:flex items-center gap-3 px-5 border-l border-border shrink-0">
          <div className="flex flex-col items-center">
            <Wifi className="w-4 h-4 text-muted-foreground mb-1" />
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {activeConns}
            </span>
          </div>
          <div className="grid grid-cols-8 grid-rows-3 gap-[3px]">
            {connections.map((conn) => (
              <div
                key={conn.id}
                className="w-2.5 h-2.5 rounded-sm transition-all duration-300"
                style={{
                  backgroundColor: !conn.active
                    ? "rgba(122, 123, 154, 0.15)"
                    : conn.flashing
                      ? conn.direction === "in"
                        ? "#34d399"
                        : "#ef4444"
                      : conn.direction === "in"
                        ? "rgba(52, 211, 153, 0.3)"
                        : "rgba(239, 68, 68, 0.3)",
                  boxShadow:
                    conn.flashing && conn.active
                      ? `0 0 6px ${conn.direction === "in" ? "#34d399" : "#ef4444"}40`
                      : "none",
                }}
              />
            ))}
          </div>
          <div className="flex flex-col gap-0.5 text-[10px]">
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-muted-foreground">In</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
              <span className="text-muted-foreground">Out</span>
            </div>
          </div>
        </div>

        {/* Session Summary */}
        <div className="hidden sm:flex items-center px-3 sm:px-5 border-l border-border shrink-0">
          <div className="flex flex-col items-center gap-1">
            <Monitor className="w-4 h-4 text-primary" />
            <span className="text-xs text-foreground tabular-nums">
              {sessionDuration ?? "—"}
            </span>
            <span className="text-[10px] text-muted-foreground">Session</span>
          </div>
        </div>
      </div>
    </div>
  );
}
