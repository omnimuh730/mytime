import { useState, useEffect } from "react";
import { Wifi, WifiOff, Signal, CheckCircle2, AlertCircle, Clock } from "lucide-react";

interface PingResult {
  time: number;
  latency: number;
}

export function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [pingHistory, setPingHistory] = useState<PingResult[]>([]);
  const [uptime, setUptime] = useState(99.97);

  useEffect(() => {
    // Simulate ping data
    const initial: PingResult[] = Array.from({ length: 60 }, (_, i) => ({
      time: i,
      latency: 8 + Math.random() * 15 + (Math.random() > 0.95 ? 50 : 0),
    }));
    setPingHistory(initial);

    const interval = setInterval(() => {
      setPingHistory((prev) => {
        const next = [
          ...prev.slice(1),
          {
            time: prev[prev.length - 1].time + 1,
            latency: 8 + Math.random() * 15 + (Math.random() > 0.95 ? 50 : 0),
          },
        ];
        return next;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const currentLatency =
    pingHistory.length > 0
      ? Math.round(pingHistory[pingHistory.length - 1].latency)
      : 0;
  const avgLatency =
    pingHistory.length > 0
      ? Math.round(
          pingHistory.reduce((s, p) => s + p.latency, 0) / pingHistory.length
        )
      : 0;
  const maxPing = Math.max(...pingHistory.map((p) => p.latency), 1);

  return (
    <div className="bg-card rounded-2xl border border-border p-4 sm:p-6 flex flex-col h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 mb-5">
        <div>
          <h3 className="text-foreground">Network Aliveness</h3>
          <p className="text-muted-foreground text-xs mt-1">
            Real-time connection monitoring
          </p>
        </div>
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs ${
            isOnline
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-red-500/10 text-red-400"
          }`}
        >
          {isOnline ? (
            <Wifi className="w-3.5 h-3.5" />
          ) : (
            <WifiOff className="w-3.5 h-3.5" />
          )}
          {isOnline ? "Connected" : "Offline"}
        </div>
      </div>

      {/* Status Indicators */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-5">
        <div className="bg-secondary/50 rounded-xl p-2 sm:p-3 text-center">
          <Signal className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
          <p className="text-lg text-foreground">{currentLatency}ms</p>
          <p className="text-xs text-muted-foreground">Latency</p>
        </div>
        <div className="bg-secondary/50 rounded-xl p-2 sm:p-3 text-center">
          <CheckCircle2 className="w-4 h-4 text-primary mx-auto mb-1" />
          <p className="text-lg text-foreground">{uptime}%</p>
          <p className="text-xs text-muted-foreground">Uptime</p>
        </div>
        <div className="bg-secondary/50 rounded-xl p-2 sm:p-3 text-center">
          <Clock className="w-4 h-4 text-chart-2 mx-auto mb-1" />
          <p className="text-lg text-foreground">{avgLatency}ms</p>
          <p className="text-xs text-muted-foreground">Avg Ping</p>
        </div>
      </div>

      {/* Ping Visualization */}
      <div className="mb-4">
        <p className="text-xs text-muted-foreground mb-2">
          Ping History (last 60 samples)
        </p>
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
                  backgroundColor: isSpike
                    ? "#f97316"
                    : ping.latency > 25
                    ? "#eab308"
                    : "#34d399",
                  opacity: i === pingHistory.length - 1 ? 1 : 0.6 + (i / pingHistory.length) * 0.4,
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Connection Details */}
      <div className="space-y-2 pt-3 border-t border-border">
        {[
          { label: "Connection Type", value: "Ethernet (1 Gbps)" },
          { label: "DNS Server", value: "8.8.8.8 (Google)" },
          { label: "Gateway", value: "192.168.1.1" },
          { label: "IP Address", value: "192.168.1.105" },
        ].map((detail) => (
          <div
            key={detail.label}
            className="flex items-center justify-between text-xs"
          >
            <span className="text-muted-foreground">{detail.label}</span>
            <span className="text-foreground">{detail.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}