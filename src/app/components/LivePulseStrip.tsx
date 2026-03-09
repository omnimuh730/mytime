import { useState, useEffect, useRef } from "react";
import { Wifi, Heart, Zap, Monitor } from "lucide-react";

interface PulseEvent {
  id: number;
  type: "active" | "idle" | "network-in" | "network-out" | "app-switch";
  intensity: number; // 0-100
  timestamp: number;
}

interface ConnectionDot {
  id: number;
  active: boolean;
  direction: "in" | "out";
  flashing: boolean;
}

export function LivePulseStrip() {
  const [apm, setApm] = useState(64);
  const [apmHistory, setApmHistory] = useState<number[]>([]);
  const [pulseEvents, setPulseEvents] = useState<PulseEvent[]>([]);
  const [connections, setConnections] = useState<ConnectionDot[]>([]);
  const [totalActions, setTotalActions] = useState(2847);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initialize
  useEffect(() => {
    // Generate 60 minutes of pulse history
    const initialPulse: PulseEvent[] = Array.from({ length: 120 }, (_, i) => ({
      id: i,
      type: (["active", "idle", "network-in", "network-out", "app-switch"] as const)[
        Math.floor(Math.random() * 5)
      ],
      intensity: Math.random() > 0.85 ? 10 + Math.random() * 30 : 40 + Math.random() * 60,
      timestamp: Date.now() - (120 - i) * 30000,
    }));
    setPulseEvents(initialPulse);

    // APM history (last 30 data points for heart-rate)
    const initialApm = Array.from({ length: 40 }, () =>
      Math.round(30 + Math.random() * 70)
    );
    setApmHistory(initialApm);

    // Network connections
    const initialConns: ConnectionDot[] = Array.from({ length: 24 }, (_, i) => ({
      id: i,
      active: Math.random() > 0.2,
      direction: Math.random() > 0.5 ? "in" : "out",
      flashing: false,
    }));
    setConnections(initialConns);
  }, []);

  // Live updates
  useEffect(() => {
    const apmInterval = setInterval(() => {
      const newApm = Math.round(
        30 + Math.random() * 70 + (Math.random() > 0.9 ? 30 : 0)
      );
      setApm(newApm);
      setApmHistory((prev) => [...prev.slice(-39), newApm]);
      setTotalActions((prev) => prev + Math.round(Math.random() * 5));
    }, 1500);

    const pulseInterval = setInterval(() => {
      setPulseEvents((prev) => [
        ...prev.slice(-119),
        {
          id: Date.now(),
          type: (["active", "idle", "network-in", "network-out", "app-switch"] as const)[
            Math.floor(Math.random() * 5)
          ],
          intensity: Math.random() > 0.85 ? 10 + Math.random() * 30 : 40 + Math.random() * 60,
          timestamp: Date.now(),
        },
      ]);
    }, 2000);

    const connInterval = setInterval(() => {
      setConnections((prev) =>
        prev.map((c) => ({
          ...c,
          flashing: Math.random() > 0.6,
          active: Math.random() > 0.15,
        }))
      );
    }, 800);

    return () => {
      clearInterval(apmInterval);
      clearInterval(pulseInterval);
      clearInterval(connInterval);
    };
  }, []);

  // Auto-scroll the timeline
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
    apm > 90 ? "#34d399" : apm > 60 ? "#6366f1" : apm > 30 ? "#eab308" : "#ef4444";
  const maxApm = Math.max(...apmHistory, 1);

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
            <div
              className="absolute inset-0 rounded-full animate-ping opacity-30"
              style={{ backgroundColor: apmColor }}
            />
          </div>
          <div className="flex flex-col">
            <div className="flex items-baseline gap-1">
              <span
                className="text-xl tabular-nums transition-colors duration-300"
                style={{ color: apmColor }}
              >
                {apm}
              </span>
              <span className="text-xs text-muted-foreground">APM</span>
            </div>
            <span className="text-[10px] text-muted-foreground">
              Actions/Min
            </span>
          </div>
          {/* Mini ECG line */}
          <div className="flex items-end gap-px h-8 w-[60px] sm:w-[100px]">
            {apmHistory.slice(-30).map((val, i) => (
              <div
                key={i}
                className="flex-1 rounded-sm transition-all duration-300"
                style={{
                  height: `${(val / maxApm) * 100}%`,
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
                Live Pulse — Last 60 min
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
            <span className="text-[10px] text-muted-foreground">Conns</span>
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
                  boxShadow: conn.flashing && conn.active
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
            <span className="text-xs text-foreground tabular-nums">6h 42m</span>
            <span className="text-[10px] text-muted-foreground">Session</span>
          </div>
        </div>
      </div>
    </div>
  );
}