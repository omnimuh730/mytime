import { useState, useMemo } from "react";
import {
  Eye,
  EyeOff,
  AlertTriangle,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Shield,
  Skull,
  Search,
} from "lucide-react";
import type { NetProcessBandwidthDto } from "../../types/backend";

interface Props {
  processes: NetProcessBandwidthDto[];
}

type SortField = "process" | "download" | "upload" | "total";
type SortDir = "asc" | "desc";

function formatMB(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function EntryTable({
  entries,
  sort,
  onSortChange,
}: {
  entries: NetProcessBandwidthDto[];
  sort: { field: SortField; dir: SortDir };
  onSortChange: (field: SortField) => void;
}) {
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sort.field !== field)
      return <ArrowUpDown className="w-3 h-3 text-muted-foreground/30" />;
    return sort.dir === "asc" ? (
      <ChevronUp className="w-3 h-3 text-primary" />
    ) : (
      <ChevronDown className="w-3 h-3 text-primary" />
    );
  };

  const maxBytes = Math.max(...entries.map((e) => e.totalBytes), 1);

  return (
    <div>
      <div className="grid grid-cols-[1fr_90px_90px_90px_80px] gap-2 px-4 py-2 bg-secondary/20 border-b border-border text-[10px] text-muted-foreground uppercase tracking-wider">
        <button onClick={() => onSortChange("process")} className="flex items-center gap-1 cursor-pointer hover:text-foreground text-left">
          Process <SortIcon field="process" />
        </button>
        <button onClick={() => onSortChange("download")} className="flex items-center gap-1 cursor-pointer hover:text-foreground">
          Download <SortIcon field="download" />
        </button>
        <button onClick={() => onSortChange("upload")} className="flex items-center gap-1 cursor-pointer hover:text-foreground">
          Upload <SortIcon field="upload" />
        </button>
        <button onClick={() => onSortChange("total")} className="flex items-center gap-1 cursor-pointer hover:text-foreground">
          Total <SortIcon field="total" />
        </button>
        <span className="text-right">Status</span>
      </div>

      <div className="max-h-[300px] overflow-y-auto overscroll-y-contain">
        {entries.length === 0 && (
          <div className="px-4 py-8 text-center text-muted-foreground text-sm">No processes detected</div>
        )}
        {entries.map((entry) => {
          const barWidth = (entry.totalBytes / maxBytes) * 100;
          return (
            <div key={entry.id} className="relative group hover:bg-secondary/40 transition-colors">
              <div
                className="absolute inset-y-0 left-0 opacity-[0.04] transition-all"
                style={{
                  width: `${barWidth}%`,
                  backgroundColor: entry.status === "danger" ? "#ef4444" : entry.status === "warning" ? "#eab308" : "#6366f1",
                }}
              />
              <div className="relative grid grid-cols-[1fr_90px_90px_90px_80px] gap-2 px-4 py-3 border-b border-border/40 items-center">
                <div className="flex items-center gap-2.5 min-w-0">
                  {entry.iconDataUrl ? (
                    <img src={entry.iconDataUrl} alt="" className="w-5 h-5 shrink-0 rounded" />
                  ) : (
                    <span className="text-base shrink-0">{entry.icon}</span>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-foreground truncate">{entry.process}</span>
                      <span className="text-[9px] text-muted-foreground/60 tabular-nums">PID {entry.pid}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">{entry.description}</p>
                  </div>
                </div>
                <div className="text-xs text-chart-4 tabular-nums">{formatMB(entry.downloadBytes)}</div>
                <div className="text-xs text-chart-5 tabular-nums">{formatMB(entry.uploadBytes)}</div>
                <div className="text-xs text-foreground tabular-nums">{formatMB(entry.totalBytes)}</div>
                <div className="flex justify-end">
                  {entry.status === "danger" && (
                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 text-[9px]">
                      <Skull className="w-3 h-3" /> HEAVY
                    </div>
                  )}
                  {entry.status === "warning" && (
                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 text-[9px]">
                      <AlertTriangle className="w-3 h-3" /> MEDIUM
                    </div>
                  )}
                  {entry.status === "normal" && (
                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[9px]">
                      <Shield className="w-3 h-3" /> OK
                    </div>
                  )}
                </div>
              </div>
              <div className="flex px-4 py-1.5 bg-secondary/30 border-b border-border/40 items-center gap-6 text-[10px] text-muted-foreground">
                <span>Connections: <span className="text-foreground">{entry.connectionCount}</span></span>
                <span>Peak: <span className="text-foreground">{(entry.peakBps / 1_000_000).toFixed(1)} Mbps</span></span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function BandwidthSplitter({ processes }: Props) {
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({ field: "total", dir: "desc" });
  const [filter, setFilter] = useState("");

  const handleSortChange = (field: SortField) => {
    setSort((prev) => prev.field === field ? { field, dir: prev.dir === "asc" ? "desc" : "asc" } : { field, dir: "desc" });
  };

  const sortEntries = (entries: NetProcessBandwidthDto[]) => {
    let filtered = entries;
    if (filter) {
      const lower = filter.toLowerCase();
      filtered = entries.filter((e) => e.process.toLowerCase().includes(lower) || e.description.toLowerCase().includes(lower));
    }
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sort.field === "process") cmp = a.process.localeCompare(b.process);
      else if (sort.field === "download") cmp = Number(a.downloadBytes) - Number(b.downloadBytes);
      else if (sort.field === "upload") cmp = Number(a.uploadBytes) - Number(b.uploadBytes);
      else cmp = Number(a.totalBytes) - Number(b.totalBytes);
      return sort.dir === "asc" ? cmp : -cmp;
    });
  };

  const fgItems = useMemo(() => processes.filter((p) => p.processType === "foreground"), [processes]);
  const bgItems = useMemo(() => processes.filter((p) => p.processType === "background"), [processes]);

  const fgSorted = sortEntries(fgItems);
  const bgSorted = sortEntries(bgItems);

  const fgTotal = fgItems.reduce((s, e) => s + e.totalBytes, 0);
  const bgTotal = bgItems.reduce((s, e) => s + e.totalBytes, 0);
  const grandTotal = fgTotal + bgTotal || 1;
  const rogueCount = bgItems.filter((e) => e.status === "danger" || e.status === "warning").length;

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-border">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0">
              <div>
                <h3 className="text-foreground flex items-center gap-2">
                  <Eye className="w-5 h-5 text-chart-2" />
                  Foreground vs. Background Bandwidth
                </h3>
                <p className="text-muted-foreground text-xs mt-1">Intentional vs. background data usage — {processes.length} processes tracked</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="text" placeholder="Filter processes..." value={filter} onChange={(e) => setFilter(e.target.value)} className="bg-secondary border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground w-[180px] focus:outline-none focus:ring-1 focus:ring-primary/50" />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 mt-4">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 text-xs">
                    <Eye className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-muted-foreground">Intentional</span>
                    <span className="text-foreground">{formatMB(fgTotal)}</span>
                    <span className="text-muted-foreground">({Math.round((fgTotal / grandTotal) * 100)}%)</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <EyeOff className="w-3.5 h-3.5 text-red-400" />
                    <span className="text-muted-foreground">Background</span>
                    <span className="text-foreground">{formatMB(bgTotal)}</span>
                    <span className="text-muted-foreground">({Math.round((bgTotal / grandTotal) * 100)}%)</span>
                  </div>
                </div>
                <div className="h-2.5 bg-secondary rounded-full overflow-hidden flex">
                  <div className="h-full bg-emerald-500/60 transition-all duration-500" style={{ width: `${(fgTotal / grandTotal) * 100}%` }} />
                  <div className="h-full bg-red-500/60 transition-all duration-500" style={{ width: `${(bgTotal / grandTotal) * 100}%` }} />
                </div>
              </div>
              {rogueCount > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs shrink-0">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {rogueCount} heavy {rogueCount > 1 ? "consumers" : "consumer"}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 divide-x divide-border">
            <div>
              <div className="px-4 py-2 bg-emerald-500/5 border-b border-border flex items-center gap-2">
                <Eye className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs text-emerald-400">Intentional Data</span>
                <span className="text-[10px] text-muted-foreground ml-auto">{fgItems.length} processes</span>
              </div>
              <EntryTable entries={fgSorted} sort={sort} onSortChange={handleSortChange} />
            </div>
            <div>
              <div className="px-4 py-2 bg-red-500/5 border-b border-border flex items-center gap-2">
                <EyeOff className="w-3.5 h-3.5 text-red-400" />
                <span className="text-xs text-red-400">Background Data</span>
                <span className="text-[10px] text-muted-foreground ml-auto">{bgItems.length} processes</span>
              </div>
              <EntryTable entries={bgSorted} sort={sort} onSortChange={handleSortChange} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
