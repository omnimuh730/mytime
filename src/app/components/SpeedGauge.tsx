import { useState, useEffect } from "react";
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

const speedHistory = [
  { time: "9:00", download: 285, upload: 92 },
  { time: "10:00", download: 312, upload: 88 },
  { time: "11:00", download: 298, upload: 95 },
  { time: "12:00", download: 275, upload: 85 },
  { time: "13:00", download: 320, upload: 98 },
  { time: "14:00", download: 340, upload: 102 },
  { time: "15:00", download: 305, upload: 90 },
  { time: "16:00", download: 292, upload: 87 },
];

export function SpeedGauge() {
  const [downloadSpeed, setDownloadSpeed] = useState(342.8);
  const [uploadSpeed, setUploadSpeed] = useState(98.4);
  const [isTesting, setIsTesting] = useState(false);
  const [progress, setProgress] = useState(0);

  const runSpeedTest = () => {
    setIsTesting(true);
    setProgress(0);

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsTesting(false);
          setDownloadSpeed(300 + Math.random() * 100);
          setUploadSpeed(80 + Math.random() * 40);
          return 100;
        }
        setDownloadSpeed(Math.random() * 400);
        setUploadSpeed(Math.random() * 120);
        return prev + 5;
      });
    }, 150);
  };

  // Gauge SVG
  const radius = 80;
  const circumference = Math.PI * radius;
  const maxSpeed = 500;
  const downloadPercent = Math.min(downloadSpeed / maxSpeed, 1);
  const strokeDashoffset = circumference - downloadPercent * circumference;

  return (
    <div className="bg-card rounded-2xl border border-border p-4 sm:p-6 flex flex-col">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-foreground">Speed Monitor</h3>
          <p className="text-muted-foreground text-xs mt-1">
            Current network throughput
          </p>
        </div>
        <button
          onClick={runSpeedTest}
          disabled={isTesting}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <RotateCcw
            className={`w-3.5 h-3.5 ${isTesting ? "animate-spin" : ""}`}
          />
          {isTesting ? "Testing..." : "Run Test"}
        </button>
      </div>

      {/* Gauge */}
      <div className="flex justify-center mb-6">
        <div className="relative">
          <svg width="200" height="115" viewBox="0 0 200 115">
            {/* Background arc */}
            <path
              d="M 10 105 A 80 80 0 0 1 190 105"
              fill="none"
              stroke="var(--gauge-track)"
              strokeWidth="12"
              strokeLinecap="round"
            />
            {/* Progress arc */}
            <path
              d="M 10 105 A 80 80 0 0 1 190 105"
              fill="none"
              stroke="url(#speedGradient)"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-500"
            />
            <defs>
              <linearGradient
                id="speedGradient"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="0%"
              >
                <stop offset="0%" stopColor="var(--chart-1)" />
                <stop offset="50%" stopColor="var(--chart-2)" />
                <stop offset="100%" stopColor="var(--chart-4)" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
            <Zap className="w-4 h-4 text-primary mb-1" />
            <span className="text-3xl text-foreground tabular-nums">
              {downloadSpeed.toFixed(1)}
            </span>
            <span className="text-xs text-muted-foreground">Mbps</span>
          </div>
        </div>
      </div>

      {/* Download / Upload */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-secondary/50 rounded-xl p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <ArrowDown className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Download</p>
            <p className="text-sm text-foreground">
              {downloadSpeed.toFixed(1)} Mbps
            </p>
          </div>
        </div>
        <div className="bg-secondary/50 rounded-xl p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-chart-2/10 flex items-center justify-center">
            <ArrowUp className="w-4 h-4 text-chart-2" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Upload</p>
            <p className="text-sm text-foreground">
              {uploadSpeed.toFixed(1)} Mbps
            </p>
          </div>
        </div>
      </div>

      {/* Speed History */}
      <div>
        <p className="text-xs text-muted-foreground mb-3">Speed History</p>
        <div className="h-[120px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={speedHistory}>
              <CartesianGrid
                key="speed-grid"
                strokeDasharray="3 3"
                stroke="var(--grid-stroke)"
                vertical={false}
              />
              <XAxis
                key="speed-xaxis"
                dataKey="time"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--axis-tick)", fontSize: 10 }}
              />
              <YAxis
                key="speed-yaxis"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--axis-tick)", fontSize: 10 }}
                width={35}
              />
              <Tooltip
                key="speed-tooltip"
                contentStyle={{
                  backgroundColor: "var(--tooltip-bg)",
                  border: "1px solid var(--tooltip-border)",
                  borderRadius: "12px",
                  fontSize: "12px",
                }}
                labelStyle={{ color: "var(--axis-tick)" }}
                itemStyle={{ color: "var(--foreground)" }}
              />
              <Line
                key="line-download"
                type="monotone"
                dataKey="download"
                stroke="#6366f1"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "#6366f1" }}
              />
              <Line
                key="line-upload"
                type="monotone"
                dataKey="upload"
                stroke="#22d3ee"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "#22d3ee" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Progress bar during test */}
      {isTesting && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground">Running speed test...</span>
            <span className="text-foreground">{progress}%</span>
          </div>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary via-chart-2 to-chart-4 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}