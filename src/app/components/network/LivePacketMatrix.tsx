import { useState, useEffect, useRef, useCallback } from "react";
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
import { useInfiniteScroll } from "../ui/useInfiniteScroll";
import { PacketSkeletonRow } from "../ui/SkeletonRows";

interface ProcessPacket {
  id: string;
  process: string;
  pid: number;
  icon: string;
  protocol: string;
  localPort: number;
  remoteIP: string;
  remotePort: number;
  downloadMbps: number;
  uploadMbps: number;
  totalMbps: number;
  packets: number;
  state: "active" | "idle" | "burst";
  direction: "in" | "out" | "both";
}

const PROCESS_POOL = [
  { process: "chrome.exe", pid: 14832, icon: "🌐", protocol: "HTTPS" },
  { process: "code.exe", pid: 9821, icon: "💻", protocol: "HTTPS" },
  { process: "slack.exe", pid: 6612, icon: "💬", protocol: "WSS" },
  { process: "figma.exe", pid: 5531, icon: "🎨", protocol: "HTTPS" },
  { process: "spotify.exe", pid: 8890, icon: "🎵", protocol: "HTTPS" },
  { process: "steam.exe", pid: 3312, icon: "🎮", protocol: "TCP" },
  { process: "node.exe", pid: 2240, icon: "⬡", protocol: "HTTP" },
  { process: "docker.exe", pid: 4418, icon: "🐳", protocol: "TCP" },
  { process: "zoom.exe", pid: 7744, icon: "📹", protocol: "UDP" },
  { process: "teams.exe", pid: 7723, icon: "👥", protocol: "HTTPS" },
  { process: "discord.exe", pid: 1092, icon: "🎮", protocol: "WSS" },
  { process: "onedrive.exe", pid: 2241, icon: "☁️", protocol: "HTTPS" },
  { process: "svchost.exe", pid: 1104, icon: "🪟", protocol: "HTTPS" },
  { process: "postgres.exe", pid: 5432, icon: "🐘", protocol: "TCP" },
  { process: "nginx.exe", pid: 8080, icon: "🔄", protocol: "HTTP" },
  { process: "redis-server", pid: 6379, icon: "🔴", protocol: "TCP" },
];

const EXTRA_PROCESSES = [
  { process: "kubectl", pid: 9090, icon: "☸️", protocol: "HTTPS" },
  { process: "mongod.exe", pid: 27017, icon: "🍃", protocol: "TCP" },
  { process: "python3", pid: 3030, icon: "🐍", protocol: "HTTP" },
  { process: "java.exe", pid: 4040, icon: "☕", protocol: "TCP" },
  { process: "mysql.exe", pid: 3306, icon: "🐬", protocol: "TCP" },
  { process: "grafana", pid: 3100, icon: "📊", protocol: "HTTP" },
  { process: "prometheus", pid: 9100, icon: "🔥", protocol: "HTTP" },
  { process: "vault", pid: 8200, icon: "🔐", protocol: "HTTPS" },
  { process: "consul", pid: 8500, icon: "🏛️", protocol: "HTTP" },
  { process: "terraform", pid: 8600, icon: "🏗️", protocol: "HTTPS" },
  { process: "ansible", pid: 2222, icon: "🤖", protocol: "SSH" },
  { process: "jenkins", pid: 8888, icon: "🎩", protocol: "HTTP" },
];

const REMOTE_IPS = [
  "54.239.28.85", "142.250.80.14", "104.16.249.5", "52.174.38.22",
  "151.101.1.140", "13.112.44.12", "23.223.198.4", "192.168.1.15",
  "172.217.14.99", "34.107.221.82", "20.42.73.26", "185.199.108.133",
];

function generatePacket(pool: typeof PROCESS_POOL[number], idx: number): ProcessPacket {
  const dl = Math.random() > 0.3 ? Math.random() * 85 + 0.1 : 0;
  const ul = Math.random() > 0.4 ? Math.random() * 25 + 0.05 : 0;
  const total = dl + ul;
  const hasBurst = Math.random() > 0.93;

  return {
    id: `${pool.pid}-${idx}-${Math.random()}`,
    process: pool.process,
    pid: pool.pid,
    icon: pool.icon,
    protocol: pool.protocol,
    localPort: 1024 + Math.floor(Math.random() * 64000),
    remoteIP: REMOTE_IPS[Math.floor(Math.random() * REMOTE_IPS.length)],
    remotePort: [80, 443, 8080, 3000, 5432, 6379, 8443][Math.floor(Math.random() * 7)],
    downloadMbps: Math.round(dl * 100) / 100,
    uploadMbps: Math.round(ul * 100) / 100,
    totalMbps: Math.round(total * 100) / 100,
    packets: Math.floor(Math.random() * 5000) + 10,
    state: hasBurst ? "burst" : total > 0.5 ? "active" : "idle",
    direction: dl > ul * 2 ? "in" : ul > dl * 2 ? "out" : "both",
  };
}

function generateInitialPackets(): ProcessPacket[] {
  return PROCESS_POOL.map((p, i) => generatePacket(p, i))
    .sort((a, b) => b.totalMbps - a.totalMbps);
}

export function LivePacketMatrix() {
  const [basePackets] = useState<ProcessPacket[]>(() => generateInitialPackets());
  const [isPaused, setIsPaused] = useState(false);
  const [updateCount, setUpdateCount] = useState(0);
  const [totalPackets, setTotalPackets] = useState(142857);
  const [totalMbps, setTotalMbps] = useState(0);
  const [liveUpdates, setLiveUpdates] = useState<Record<string, Partial<ProcessPacket>>>({});
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const generateMore = useCallback((count: number): ProcessPacket[] => {
    const allPool = [...PROCESS_POOL, ...EXTRA_PROCESSES];
    return Array.from({ length: 8 }, (_, i) => {
      const idx = count + i;
      const pool = allPool[idx % allPool.length];
      return generatePacket(pool, idx);
    });
  }, []);

  const { items, isLoading, scrollRef } = useInfiniteScroll(
    basePackets,
    generateMore,
    { initialCount: 16, batchSize: 8 }
  );

  // Live updates for existing items
  useEffect(() => {
    if (isPaused) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      const updates: Record<string, Partial<ProcessPacket>> = {};
      items.forEach((pkt) => {
        const dl = Math.random() > 0.3 ? Math.random() * 85 + 0.1 : 0;
        const ul = Math.random() > 0.4 ? Math.random() * 25 + 0.05 : 0;
        const total = dl + ul;
        const hasBurst = Math.random() > 0.93;
        updates[pkt.id] = {
          downloadMbps: Math.round(dl * 100) / 100,
          uploadMbps: Math.round(ul * 100) / 100,
          totalMbps: Math.round(total * 100) / 100,
          packets: Math.floor(Math.random() * 5000) + 10,
          state: hasBurst ? "burst" : total > 0.5 ? "active" : "idle",
        };
      });
      setLiveUpdates(updates);
      setUpdateCount((c) => c + 1);
      setTotalPackets((p) => p + Math.floor(Math.random() * 300) + 50);
      const sumMbps = Object.values(updates).reduce((s, u) => s + (u.totalMbps ?? 0), 0);
      setTotalMbps(Math.round(sumMbps * 100) / 100);
    }, 500);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPaused, items]);

  const displayPackets = items.map((pkt) => ({
    ...pkt,
    ...liveUpdates[pkt.id],
  }));

  const getStateColor = (state: string) => {
    if (state === "burst") return "#ef4444";
    if (state === "active") return "#34d399";
    return "#7a7b9a";
  };

  const maxMbps = Math.max(...displayPackets.map((p) => p.totalMbps), 0.01);
  const getBarWidth = (mbps: number) => Math.max((mbps / maxMbps) * 100, 0.5);

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      {/* Header */}
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0">
          <div>
            <h3 className="text-foreground flex items-center gap-2">
              <Terminal className="w-5 h-5 text-chart-4" />
              Live Packet Matrix
            </h3>
            <p className="text-muted-foreground text-xs mt-1">
              Real-time process network activity — updates every 500ms
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {!isPaused && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[10px] text-red-400 uppercase tracking-wider">Live</span>
                </div>
              )}
              <button
                onClick={() => setIsPaused(!isPaused)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-colors cursor-pointer ${
                  isPaused
                    ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {isPaused ? <><Play className="w-3 h-3" /> Resume</> : <><Pause className="w-3 h-3" /> Freeze</>}
              </button>
            </div>
          </div>
        </div>

        {/* Live Stats Bar */}
        <div className="flex items-center gap-6 mt-3 pt-3 border-t border-border">
          <div className="flex items-center gap-2 text-xs">
            <Zap className="w-3.5 h-3.5 text-chart-5" />
            <span className="text-muted-foreground">Throughput:</span>
            <span className="text-foreground tabular-nums">{totalMbps} Mbps</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Activity className="w-3.5 h-3.5 text-chart-2" />
            <span className="text-muted-foreground">Processes:</span>
            <span className="text-foreground tabular-nums">
              {displayPackets.filter((p) => p.state !== "idle").length} active
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Wifi className="w-3.5 h-3.5 text-chart-3" />
            <span className="text-muted-foreground">Packets:</span>
            <span className="text-foreground tabular-nums">{totalPackets.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2 text-xs ml-auto">
            <span className="text-[10px] text-muted-foreground/60 tabular-nums">
              {items.length} rows &middot; Tick #{updateCount}
            </span>
          </div>
        </div>
      </div>

      {/* Column Headers */}
      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          <div className="grid grid-cols-[180px_70px_90px_90px_100px_1fr_60px_50px] gap-2 px-5 py-2 bg-secondary/20 border-b border-border text-[10px] text-muted-foreground uppercase tracking-wider">
            <span>Process</span>
            <span>Protocol</span>
            <span className="flex items-center gap-1">
              <ArrowDown className="w-2.5 h-2.5 text-chart-4" /> Download
            </span>
            <span className="flex items-center gap-1">
              <ArrowUp className="w-2.5 h-2.5 text-chart-5" /> Upload
            </span>
            <span>Remote IP</span>
            <span>Activity</span>
            <span className="text-right">Packets</span>
            <span className="text-right">State</span>
          </div>
        </div>
      </div>

      {/* Packet Rows */}
      <div ref={scrollRef} className="max-h-[380px] overflow-y-auto overflow-x-auto overscroll-y-contain">
        <div className="min-w-[800px]">
          {displayPackets.map((pkt, index) => (
            <div
              key={pkt.id}
              className={`relative grid grid-cols-[180px_70px_90px_90px_100px_1fr_60px_50px] gap-2 px-5 py-2 border-b border-border/30 items-center transition-all duration-300 ${
                pkt.state === "burst" ? "bg-red-500/5" : "hover:bg-secondary/30"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm shrink-0">{pkt.icon}</span>
                <div className="min-w-0">
                  <span className="text-xs text-foreground truncate block">{pkt.process}</span>
                  <span className="text-[9px] text-muted-foreground/60 tabular-nums">
                    PID {pkt.pid} : {pkt.localPort}
                  </span>
                </div>
              </div>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded w-fit"
                style={{
                  backgroundColor:
                    pkt.protocol === "UDP" ? "rgba(239,68,68,0.1)"
                    : pkt.protocol === "WSS" ? "rgba(99,102,241,0.1)"
                    : pkt.protocol === "TCP" ? "rgba(234,179,8,0.1)"
                    : "rgba(52,211,153,0.1)",
                  color:
                    pkt.protocol === "UDP" ? "#ef4444"
                    : pkt.protocol === "WSS" ? "#6366f1"
                    : pkt.protocol === "TCP" ? "#eab308"
                    : "#34d399",
                }}
              >
                {pkt.protocol}
              </span>
              <span className="text-xs text-chart-4 tabular-nums">
                {pkt.downloadMbps > 0 ? `${pkt.downloadMbps.toFixed(2)} Mbps` : "—"}
              </span>
              <span className="text-xs text-chart-5 tabular-nums">
                {pkt.uploadMbps > 0 ? `${pkt.uploadMbps.toFixed(2)} Mbps` : "—"}
              </span>
              <span className="text-[10px] text-muted-foreground tabular-nums truncate">
                {pkt.remoteIP}:{pkt.remotePort}
              </span>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-secondary/50 rounded-full overflow-hidden">
                  <div className="h-full flex rounded-full overflow-hidden transition-all duration-300">
                    <div
                      className="h-full transition-all duration-300"
                      style={{ width: `${getBarWidth(pkt.downloadMbps)}%`, backgroundColor: "#34d399", opacity: 0.7 }}
                    />
                    <div
                      className="h-full transition-all duration-300"
                      style={{ width: `${getBarWidth(pkt.uploadMbps)}%`, backgroundColor: "#f97316", opacity: 0.7 }}
                    />
                  </div>
                </div>
                <span className="text-[10px] text-foreground tabular-nums w-14 text-right">
                  {pkt.totalMbps.toFixed(1)}
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground tabular-nums text-right">
                {pkt.packets.toLocaleString()}
              </span>
              <div className="flex justify-end">
                <div
                  className="w-2 h-2 rounded-full transition-colors duration-300"
                  style={{
                    backgroundColor: getStateColor(pkt.state),
                    boxShadow:
                      pkt.state === "burst" ? "0 0 8px rgba(239,68,68,0.4)"
                      : pkt.state === "active" ? "0 0 6px rgba(52,211,153,0.3)"
                      : "none",
                  }}
                />
              </div>
              {pkt.state === "burst" && (
                <div className="absolute inset-0 bg-red-500/3 pointer-events-none animate-pulse" />
              )}
            </div>
          ))}

          {/* Skeleton rows */}
          {isLoading && Array.from({ length: 4 }).map((_, i) => (
            <PacketSkeletonRow key={`skel-${i}`} />
          ))}
        </div>
      </div>

      {/* Footer Legend */}
      <div className="px-5 py-2 bg-secondary/10 border-t border-border flex items-center justify-between">
        <div className="flex items-center gap-4 text-[10px]">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-muted-foreground">Active</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.4)]" />
            <span className="text-muted-foreground">Burst</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-muted-foreground" />
            <span className="text-muted-foreground">Idle</span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-[10px]">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-1.5 rounded bg-chart-4/70" />
            <span className="text-muted-foreground">Download</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-1.5 rounded bg-chart-5/70" />
            <span className="text-muted-foreground">Upload</span>
          </div>
        </div>
      </div>
    </div>
  );
}