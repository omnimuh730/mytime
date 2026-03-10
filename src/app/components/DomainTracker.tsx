import { useMemo } from "react";
import { Globe } from "lucide-react";
import type { NetConnectionDto } from "../types/backend";

interface Props {
  connections: NetConnectionDto[];
}

const COLORS = [
  "#6366f1", "#22d3ee", "#f97316", "#a78bfa", "#34d399",
  "#f43f5e", "#eab308", "#06b6d4", "#ec4899", "#10b981",
  "#8b5cf6", "#14b8a6", "#f59e0b", "#3b82f6", "#ef4444",
];

interface RemoteGroup {
  address: string;
  connectionCount: number;
  bandwidth: number;
  protocols: Set<string>;
  processes: Set<string>;
  color: string;
  percentage: number;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export function DomainTracker({ connections }: Props) {
  const groups = useMemo(() => {
    const map = new Map<string, { count: number; bytes: number; protocols: Set<string>; processes: Set<string> }>();

    for (const conn of connections) {
      const addr = conn.remoteAddr;
      if (addr === "0.0.0.0" || addr === "127.0.0.1") continue;

      const existing = map.get(addr);
      if (existing) {
        existing.count += 1;
        existing.bytes += conn.downloadBytes + conn.uploadBytes;
        existing.protocols.add(conn.protocol);
        existing.processes.add(conn.process);
      } else {
        map.set(addr, {
          count: 1,
          bytes: conn.downloadBytes + conn.uploadBytes,
          protocols: new Set([conn.protocol]),
          processes: new Set([conn.process]),
        });
      }
    }

    const sorted = [...map.entries()]
      .sort((a, b) => b[1].bytes - a[1].bytes);

    const maxBytes = sorted.length > 0 ? sorted[0][1].bytes : 1;

    return sorted.map(([address, data], idx): RemoteGroup => ({
      address,
      connectionCount: data.count,
      bandwidth: data.bytes,
      protocols: data.protocols,
      processes: data.processes,
      color: COLORS[idx % COLORS.length],
      percentage: Math.max(5, Math.round((data.bytes / maxBytes) * 100)),
    }));
  }, [connections]);

  return (
    <div className="bg-card rounded-2xl border border-border p-4 sm:p-6 flex flex-col">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-foreground">Remote Address Tracking</h3>
          <p className="text-muted-foreground text-xs mt-1">Top remote addresses by traffic volume</p>
        </div>
        <span className="text-[10px] text-muted-foreground tabular-nums">{groups.length} addresses</span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto space-y-3 max-h-[320px] overscroll-y-contain">
        {groups.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">No remote connections detected</div>
        )}
        {groups.map((item, idx) => (
          <div key={`${item.address}-${idx}`} className="group flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/50 transition-all duration-200">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${item.color}15` }}>
              <Globe className="w-4 h-4" style={{ color: item.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-foreground truncate font-mono">{item.address}</span>
                </div>
                <span className="text-xs text-muted-foreground">{item.connectionCount} conn</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${item.percentage}%`, backgroundColor: item.color }} />
                </div>
                <span className="text-xs text-muted-foreground w-16 text-right">{formatBytes(item.bandwidth)}</span>
              </div>
              <div className="flex items-center gap-2 mt-1 text-[9px] text-muted-foreground">
                <span>{[...item.protocols].join(", ")}</span>
                <span>·</span>
                <span className="truncate">{[...item.processes].slice(0, 3).join(", ")}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
