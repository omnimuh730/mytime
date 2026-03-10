import { useState, useRef, useEffect } from "react";
import { ArrowDown, ArrowUp, Zap, RotateCcw } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { NetSpeedSnapshotDto } from "../types/backend";
import { runSpeedTest } from "../api/network";

interface Props {
  speedHistory: NetSpeedSnapshotDto[];
  currentDownloadBps: number;
  currentUploadBps: number;
}

function bpsToMbps(bps: number): number {
  return Math.round((bps / 1_000_000) * 100) / 100;
}

export function SpeedGauge({ speedHistory, currentDownloadBps, currentUploadBps }: Props) {
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ dl: number; ul: number; lat: number } | null>(null);
  const testTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear "last test" display after 30s so gauge returns to live data
  useEffect(() => {
    return () => { if (testTimeoutRef.current) clearTimeout(testTimeoutRef.current); };
  }, []);

  const handleRunTest = async () => {
    if (isTesting) return;
    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await runSpeedTest();
      setTestResult({
        dl: result.downloadBps,
        ul: result.uploadBps,
        lat: result.latencyMs,
      });

      if (testTimeoutRef.current) clearTimeout(testTimeoutRef.current);
      testTimeoutRef.current = setTimeout(() => setTestResult(null), 30_000);
    } catch {
      setTestResult(null);
    } finally {
      setIsTesting(false);
    }
  };

  const showTest = testResult !== null && !isTesting;
  const displayDl = showTest ? bpsToMbps(testResult!.dl) : bpsToMbps(currentDownloadBps);
  const displayUl = showTest ? bpsToMbps(testResult!.ul) : bpsToMbps(currentUploadBps);

  const chartData = speedHistory.map((s) => ({
    time: s.timestamp.replace(/^T-/, ""),
    download: bpsToMbps(s.downloadBps),
    upload: bpsToMbps(s.uploadBps),
  }));

  const radius = 80;
  const circumference = Math.PI * radius;
  const maxSpeed = Math.max(100, displayDl * 2, 500);
  const downloadPercent = Math.min(displayDl / maxSpeed, 1);
  const strokeDashoffset = circumference - downloadPercent * circumference;

  return (
    <div className="bg-card rounded-2xl border border-border p-4 sm:p-6 flex flex-col">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-foreground">Speed Monitor</h3>
          <p className="text-muted-foreground text-xs mt-1">
            {showTest ? "Speed test result (live resumes in 30s)" : "Current network throughput"}
          </p>
        </div>
        <button
          onClick={handleRunTest}
          disabled={isTesting}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${isTesting ? "animate-spin" : ""}`} />
          {isTesting ? "Testing..." : "Run Test"}
        </button>
      </div>

      <div className="flex justify-center mb-6">
        <div className="relative">
          <svg width="200" height="115" viewBox="0 0 200 115">
            <path d="M 10 105 A 80 80 0 0 1 190 105" fill="none" stroke="var(--gauge-track)" strokeWidth="12" strokeLinecap="round" />
            <path d="M 10 105 A 80 80 0 0 1 190 105" fill="none" stroke="url(#speedGradient)" strokeWidth="12" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} className="transition-all duration-500" />
            <defs>
              <linearGradient id="speedGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="var(--chart-1)" />
                <stop offset="50%" stopColor="var(--chart-2)" />
                <stop offset="100%" stopColor="var(--chart-4)" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
            <Zap className="w-4 h-4 text-primary mb-1" />
            <span className="text-3xl text-foreground tabular-nums">{displayDl.toFixed(1)}</span>
            <span className="text-xs text-muted-foreground">Mbps</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-secondary/50 rounded-xl p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <ArrowDown className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Download</p>
            <p className="text-sm text-foreground">{displayDl.toFixed(1)} Mbps</p>
          </div>
        </div>
        <div className="bg-secondary/50 rounded-xl p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-chart-2/10 flex items-center justify-center">
            <ArrowUp className="w-4 h-4 text-chart-2" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Upload</p>
            <p className="text-sm text-foreground">{displayUl.toFixed(1)} Mbps</p>
          </div>
        </div>
      </div>

      {showTest && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Test latency</span>
          <span className="text-foreground tabular-nums">{testResult!.lat} ms</span>
        </div>
      )}

      <div>
        <p className="text-xs text-muted-foreground mb-3">Speed History</p>
        <div className="h-[120px]">
          {chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Collecting...</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-stroke)" vertical={false} />
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: "var(--axis-tick)", fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--axis-tick)", fontSize: 10 }} width={35} />
                <Tooltip contentStyle={{ backgroundColor: "var(--tooltip-bg)", border: "1px solid var(--tooltip-border)", borderRadius: "12px", fontSize: "12px" }} labelStyle={{ color: "var(--axis-tick)" }} itemStyle={{ color: "var(--foreground)" }} />
                <Line type="monotone" dataKey="download" stroke="#6366f1" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#6366f1" }} />
                <Line type="monotone" dataKey="upload" stroke="#22d3ee" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#22d3ee" }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
