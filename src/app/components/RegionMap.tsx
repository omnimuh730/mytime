import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { MapPin } from "lucide-react";

const regionData = [
  { name: "North America", value: 42, connections: 1247, latency: "12ms", color: "#6366f1" },
  { name: "Europe", value: 28, connections: 834, latency: "45ms", color: "#22d3ee" },
  { name: "Asia Pacific", value: 18, connections: 536, latency: "89ms", color: "#a78bfa" },
  { name: "South America", value: 7, connections: 208, latency: "120ms", color: "#34d399" },
  { name: "Africa", value: 3, connections: 89, latency: "180ms", color: "#f97316" },
  { name: "Oceania", value: 2, connections: 59, latency: "95ms", color: "#f43f5e" },
];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-card border border-border rounded-xl p-3 shadow-xl">
        <p className="text-sm text-foreground mb-1">{data.name}</p>
        <p className="text-xs text-muted-foreground">{data.value}% traffic</p>
        <p className="text-xs text-muted-foreground">{data.connections} connections</p>
        <p className="text-xs text-muted-foreground">Avg latency: {data.latency}</p>
      </div>
    );
  }
  return null;
};

export function RegionMap() {
  return (
    <div className="bg-card rounded-2xl border border-border p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-foreground">Region Distribution</h3>
          <p className="text-muted-foreground text-xs mt-1">
            Traffic by geographic region
          </p>
        </div>
      </div>
      <div className="flex gap-6">
        <div className="w-[180px] h-[180px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={regionData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                dataKey="value"
                strokeWidth={0}
              >
                {regionData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-2.5">
          {regionData.map((region) => (
            <div
              key={region.name}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: region.color }}
                />
                <span className="text-xs text-foreground">{region.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  {region.latency}
                </span>
                <span className="text-xs text-foreground w-8 text-right">
                  {region.value}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Connections */}
      <div className="mt-6 pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground mb-3">Recent Connections</p>
        <div className="space-y-2">
          {[
            { ip: "192.168.1.45", location: "San Francisco, US", time: "2s ago" },
            { ip: "172.16.0.23", location: "London, UK", time: "5s ago" },
            { ip: "10.0.0.128", location: "Tokyo, JP", time: "8s ago" },
          ].map((conn) => (
            <div
              key={conn.ip}
              className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <MapPin className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs text-foreground">{conn.ip}</span>
                <span className="text-xs text-muted-foreground">
                  {conn.location}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">{conn.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
