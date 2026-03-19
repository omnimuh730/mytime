import { useState, useEffect, useRef } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatTooltipNumber } from "../utils/formatTooltipValue";

interface Props {
  downloadBytes?: number;
  uploadBytes?: number;
}

interface DataPoint {
  time: string;
  download: number;
  upload: number;
}

function bytesToGB(b: number): number {
  return Math.round((b / (1024 * 1024 * 1024)) * 100) / 100;
}

function bytesToMB(b: number): number {
  return Math.round((b / (1024 * 1024)) * 100) / 100;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-xl p-3 shadow-xl">
        <p className="text-xs text-muted-foreground mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground capitalize">{entry.dataKey}:</span>
            <span className="text-foreground">
              {formatTooltipNumber(entry.value, 2)} MB
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export function NetworkUsageChart({ downloadBytes = 0, uploadBytes = 0 }: Props) {
  const [history, setHistory] = useState<DataPoint[]>([]);
  const lastBytesRef = useRef({ dl: 0, ul: 0 });

  useEffect(() => {
    const now = new Date();
    const label = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;

    const dlDelta = downloadBytes > lastBytesRef.current.dl
      ? downloadBytes - lastBytesRef.current.dl
      : downloadBytes;
    const ulDelta = uploadBytes > lastBytesRef.current.ul
      ? uploadBytes - lastBytesRef.current.ul
      : uploadBytes;

    lastBytesRef.current = { dl: downloadBytes, ul: uploadBytes };

    if (dlDelta > 0 || ulDelta > 0) {
      setHistory((prev) => {
        const next = [...prev, {
          time: label,
          download: bytesToMB(dlDelta),
          upload: bytesToMB(ulDelta),
        }];
        return next.slice(-30);
      });
    }
  }, [downloadBytes, uploadBytes]);

  return (
    <div className="bg-card rounded-2xl border border-border p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 mb-5">
        <div>
          <h3 className="text-foreground">Network Usage</h3>
          <p className="text-muted-foreground text-xs mt-1">
            Live download & upload traffic deltas
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#a78bfa]" />
            <span className="text-xs text-muted-foreground">Download</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#34d399]" />
            <span className="text-xs text-muted-foreground">Upload</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-4 text-xs text-muted-foreground">
        <span>Total DL: <span className="text-foreground">{bytesToGB(downloadBytes)} GB</span></span>
        <span>Total UL: <span className="text-foreground">{bytesToGB(uploadBytes)} GB</span></span>
      </div>

      <div className="h-[200px] sm:h-[240px]">
        {history.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            Collecting data...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history}>
              <defs>
                <linearGradient id="dlGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="ulGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#34d399" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-stroke)" vertical={false} />
              <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: "var(--axis-tick)", fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--axis-tick)", fontSize: 11 }} unit=" MB" />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="download" stroke="#a78bfa" strokeWidth={2} fill="url(#dlGradient)" dot={false} activeDot={{ r: 4, fill: "#a78bfa", stroke: "#a78bfa" }} />
              <Area type="monotone" dataKey="upload" stroke="#34d399" strokeWidth={2} fill="url(#ulGradient)" dot={false} activeDot={{ r: 4, fill: "#34d399", stroke: "#34d399" }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
