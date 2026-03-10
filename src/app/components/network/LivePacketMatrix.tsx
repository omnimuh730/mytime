import { useState, useMemo } from "react";
import {
  Zap,
  ArrowUp,
  ArrowDown,
  Pause,
  Play,
  Terminal,
  Wifi,
  Activity,
} from "lucide-react";
import type { NetConnectionDto } from "../../types/backend";

interface Props {
  connections: NetConnectionDto[];
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export function LivePacketMatrix({ connections }: Props) {
  const [isPaused, setIsPaused] = useState(false);

  const displayed = useMemo(() => {
    if (isPaused) return [];
    return connections
      .filter((c) => c.remoteAddr !== "0.0.0.0" && c.remoteAddr !== "127.0.0.1")
      .sort((a, b) => (b.downloadBytes + b.uploadBytes) - (a.downloadBytes + a.uploadBytes))
      .slice(0, 100);
  }, [connections, isPaused]);

  const totalBytes = displayed.reduce((s, c) => s + c.downloadBytes + c.uploadBytes, 0);
  const activeCount = displayed.filter((c) => c.state === "ESTABLISHED").length;
  const maxBytes = Math.max(...displayed.map((c) => c.downloadBytes + c.uploadBytes), 1);

  const getStateColor = (state: string) => {
    if (state === "ESTABLISHED") return "#34d399";
    if (state === "LISTEN") return "#6366f1";
    if (state === "TIME_WAIT" || state === "CLOSE_WAIT") return "#eab308";
    return "#7a7b9a";
  };

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0">
          <div>
            <h3 className="text-foreground flex items-center gap-2">
              <Terminal className="w-5 h-5 text-chart-4" />
              Live Connection Matrix
            </h3>
            <p className="text-muted-foreground text-xs mt-1">Real-time process network connections — polled every 2s</p>
          </div>
          <div className="flex items-center gap-3">
            {!isPaused && (
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[10px] text-red-400 uppercase tracking-wider">Live</span>
              </div>
            )}
            <button
              onClick={() => setIsPaused(!isPaused)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-colors cursor-pointer ${isPaused ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
            >
              {isPaused ? <><Play className="w-3 h-3" /> Resume</> : <><Pause className="w-3 h-3" /> Freeze</>}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-6 mt-3 pt-3 border-t border-border">
          <div className="flex items-center gap-2 text-xs">
            <Zap className="w-3.5 h-3.5 text-chart-5" />
            <span className="text-muted-foreground">Traffic:</span>
            <span className="text-foreground tabular-nums">{formatBytes(totalBytes)}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Activity className="w-3.5 h-3.5 text-chart-2" />
            <span className="text-muted-foreground">Established:</span>
            <span className="text-foreground tabular-nums">{activeCount}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Wifi className="w-3.5 h-3.5 text-chart-3" />
            <span className="text-muted-foreground">Total:</span>
            <span className="text-foreground tabular-nums">{displayed.length}</span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          <div className="grid grid-cols-[180px_70px_100px_100px_120px_1fr_60px] gap-2 px-5 py-2 bg-secondary/20 border-b border-border text-[10px] text-muted-foreground uppercase tracking-wider">
            <span>Process</span>
            <span>Protocol</span>
            <span className="flex items-center gap-1"><ArrowDown className="w-2.5 h-2.5 text-chart-4" /> Download</span>
            <span className="flex items-center gap-1"><ArrowUp className="w-2.5 h-2.5 text-chart-5" /> Upload</span>
            <span>Remote</span>
            <span>Activity</span>
            <span className="text-right">State</span>
          </div>
        </div>
      </div>

      <div className="max-h-[380px] overflow-y-auto overflow-x-auto overscroll-y-contain">
        <div className="min-w-[800px]">
          {displayed.length === 0 && (
            <div className="px-5 py-8 text-center text-muted-foreground text-sm">
              {isPaused ? "Paused — click Resume to continue" : "No active connections detected"}
            </div>
          )}
          {displayed.map((conn) => {
            const total = conn.downloadBytes + conn.uploadBytes;
            const barWidth = Math.max((total / maxBytes) * 100, 0.5);
            const stateColor = getStateColor(conn.state);

            return (
              <div
                key={conn.id}
                className="relative grid grid-cols-[180px_70px_100px_100px_120px_1fr_60px] gap-2 px-5 py-2 border-b border-border/30 items-center hover:bg-secondary/30 transition-all duration-300"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm shrink-0">{conn.icon}</span>
                  <div className="min-w-0">
                    <span className="text-xs text-foreground truncate block">{conn.process}</span>
                    <span className="text-[9px] text-muted-foreground/60 tabular-nums">PID {conn.pid} : {conn.localPort}</span>
                  </div>
                </div>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded w-fit"
                  style={{
                    backgroundColor: conn.protocol === "UDP" ? "rgba(239,68,68,0.1)" : conn.protocol === "TCP" ? "rgba(234,179,8,0.1)" : "rgba(52,211,153,0.1)",
                    color: conn.protocol === "UDP" ? "#ef4444" : conn.protocol === "TCP" ? "#eab308" : "#34d399",
                  }}
                >
                  {conn.protocol}
                </span>
                <span className="text-xs text-chart-4 tabular-nums">{formatBytes(conn.downloadBytes)}</span>
                <span className="text-xs text-chart-5 tabular-nums">{formatBytes(conn.uploadBytes)}</span>
                <span className="text-[10px] text-muted-foreground tabular-nums truncate">
                  {conn.remoteAddr}:{conn.remotePort}
                </span>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-secondary/50 rounded-full overflow-hidden">
                    <div className="h-full rounded-full overflow-hidden transition-all duration-300" style={{ width: `${barWidth}%`, backgroundColor: stateColor, opacity: 0.7 }} />
                  </div>
                  <span className="text-[10px] text-foreground tabular-nums w-16 text-right">{formatBytes(total)}</span>
                </div>
                <div className="flex justify-end">
                  <div
                    className="w-2 h-2 rounded-full transition-colors duration-300"
                    style={{ backgroundColor: stateColor, boxShadow: conn.state === "ESTABLISHED" ? "0 0 6px rgba(52,211,153,0.3)" : "none" }}
                    title={conn.state}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-5 py-2 bg-secondary/10 border-t border-border flex items-center justify-between">
        <div className="flex items-center gap-4 text-[10px]">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-muted-foreground">Established</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#6366f1]" />
            <span className="text-muted-foreground">Listen</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#eab308]" />
            <span className="text-muted-foreground">Wait</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-muted-foreground" />
            <span className="text-muted-foreground">Other</span>
          </div>
        </div>
      </div>
    </div>
  );
}
