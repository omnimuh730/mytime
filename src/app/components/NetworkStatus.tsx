import { useState, useEffect, useRef } from "react";
import { Wifi, WifiOff, Signal, CheckCircle2, Clock } from "lucide-react";
import type { NetOverviewDto } from "../types/backend";

interface PingResult {
  time: number;
  latency: number;
}

interface Props {
  overview?: NetOverviewDto | null;
}

export function NetworkStatus({ overview = null }: Props) {
  const [pingHistory, setPingHistory] = useState<PingResult[]>([]);
  const tickRef = useRef(0);

  const isOnline = overview?.status.isOnline ?? false;
  const currentLatency = overview?.speed.latencyMs ?? 0;
  const uptime = overview?.status.uptimePercent ?? 0;

  useEffect(() => {
    if (overview === null) return;
    setPingHistory((prev) => {
      tickRef.current += 1;
      const next = [
        ...prev.slice(-(59)),
        { time: tickRef.current, latency: currentLatency },
      ];
      return next;
    });
  }, [currentLatency, overview?.generatedAt]);

  const avgLatency =
    pingHistory.length > 0
      ? Math.round(pingHistory.reduce((s, p) => s + p.latency, 0) / pingHistory.length)
      : 0;
  const maxPing = Math.max(...pingHistory.map((p) => p.latency), 1);

  const details = [
    { label: "Connection Type", value: overview?.status.connectionType ?? "—" },
    { label: "DNS Server", value: overview?.status.dnsServer ?? "—" },
    { label: "Gateway", value: overview?.status.gateway ?? "—" },
    { label: "IP Address", value: overview?.status.localIp ?? "—" },
  ];

  return (
    <div className="bg-card rounded-2xl border border-border p-4 sm:p-6 flex flex-col h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 mb-5">
        <div>
          <h3 className="text-foreground">Network Aliveness</h3>
          <p className="text-muted-foreground text-xs mt-1">Real-time connection monitoring</p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs ${isOnline ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
          {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
          {isOnline ? "Connected" : "Offline"}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-5">
        <div className="bg-secondary/50 rounded-xl p-2 sm:p-3 text-center">
          <Signal className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
          <p className="text-lg text-foreground">{currentLatency}ms</p>
          <p className="text-xs text-muted-foreground">Latency</p>
        </div>
        <div className="bg-secondary/50 rounded-xl p-2 sm:p-3 text-center">
          <CheckCircle2 className="w-4 h-4 text-primary mx-auto mb-1" />
          <p className="text-lg text-foreground">{uptime.toFixed(2)}%</p>
          <p className="text-xs text-muted-foreground">Uptime</p>
        </div>
        <div className="bg-secondary/50 rounded-xl p-2 sm:p-3 text-center">
          <Clock className="w-4 h-4 text-chart-2 mx-auto mb-1" />
          <p className="text-lg text-foreground">{avgLatency}ms</p>
          <p className="text-xs text-muted-foreground">Avg Ping</p>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-xs text-muted-foreground mb-2">Ping History (last 60 samples)</p>
        <div className="flex items-end gap-px h-16 bg-secondary/30 rounded-lg p-2">
          {pingHistory.map((ping, i) => {
            const height = (ping.latency / maxPing) * 100;
            const isSpike = ping.latency > 40;
            return (
              <div
                key={i}
                className="flex-1 rounded-sm transition-all duration-300"
                style={{
                  height: `${Math.max(height, 5)}%`,
                  backgroundColor: isSpike ? "#f97316" : ping.latency > 25 ? "#eab308" : "#34d399",
                  opacity: i === pingHistory.length - 1 ? 1 : 0.6 + (i / pingHistory.length) * 0.4,
                }}
              />
            );
          })}
        </div>
      </div>

      <div className="space-y-2 pt-3 border-t border-border">
        {details.map((detail) => (
          <div key={detail.label} className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{detail.label}</span>
            <span className="text-foreground">{detail.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
