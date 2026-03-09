import { useState, useMemo, useCallback } from "react";
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
import { useInfiniteScroll } from "../ui/useInfiniteScroll";
import { BandwidthSkeletonRow } from "../ui/SkeletonRows";

interface BandwidthEntry {
  id: string;
  process: string;
  icon: string;
  pid: number;
  downloadMB: number;
  uploadMB: number;
  totalMB: number;
  type: "foreground" | "background";
  status: "normal" | "warning" | "danger";
  description: string;
  connections: number;
  peakMbps: number;
}

const FG_PROCESSES = [
  { process: "Google Chrome", icon: "🌐", desc: "Active browsing — tabs, streaming" },
  { process: "VS Code", icon: "💻", desc: "Extensions sync, Copilot, LSP" },
  { process: "Zoom", icon: "📹", desc: "Video calls — meeting session" },
  { process: "Figma", icon: "🎨", desc: "Design file sync, multiplayer" },
  { process: "Slack", icon: "💬", desc: "Messaging, file uploads, GIFs" },
  { process: "Firefox", icon: "🦊", desc: "Web browsing, dev tools" },
  { process: "Postman", icon: "📮", desc: "API testing, mock servers" },
  { process: "Safari", icon: "🧭", desc: "Web browsing, iCloud tabs" },
  { process: "Notion", icon: "📝", desc: "Docs sync, database queries" },
  { process: "Obsidian", icon: "🔮", desc: "Vault sync, plugin updates" },
  { process: "TablePlus", icon: "🗄️", desc: "Database queries, SSH tunnels" },
  { process: "Insomnia", icon: "🌙", desc: "REST/GraphQL API testing" },
  { process: "iTerm2", icon: "⬛", desc: "SSH sessions, remote dev" },
  { process: "Linear", icon: "📐", desc: "Project management sync" },
];

const BG_PROCESSES = [
  { process: "Steam", icon: "🎮", desc: "Game update — silently downloading", status: "danger" as const },
  { process: "Windows Update", icon: "🪟", desc: "Cumulative update + P2P sharing", status: "warning" as const },
  { process: "OneDrive", icon: "☁️", desc: "Syncing documents folder", status: "warning" as const },
  { process: "Dropbox", icon: "📦", desc: "Auto-uploading screenshots", status: "warning" as const },
  { process: "Spotify", icon: "🎵", desc: "Background streaming", status: "normal" as const },
  { process: "Microsoft Teams", icon: "👥", desc: "Notification sync, presence", status: "normal" as const },
  { process: "iCloud Drive", icon: "☁️", desc: "Photo sync, backup tasks", status: "warning" as const },
  { process: "Google Drive", icon: "📁", desc: "File mirroring, shared drives", status: "warning" as const },
  { process: "Creative Cloud", icon: "🎨", desc: "Adobe CC asset sync", status: "normal" as const },
  { process: "Epic Games", icon: "🎮", desc: "Launcher auto-update", status: "danger" as const },
  { process: "Backblaze", icon: "💾", desc: "Continuous backup upload", status: "warning" as const },
  { process: "Time Machine", icon: "⏰", desc: "Network backup to NAS", status: "warning" as const },
  { process: "CrashPlan", icon: "🛡️", desc: "Cloud backup service", status: "normal" as const },
  { process: "Antivirus", icon: "🔒", desc: "Virus definition updates", status: "normal" as const },
];

function genEntry(
  id: string,
  pool: typeof FG_PROCESSES[number],
  type: "foreground" | "background",
  idx: number,
  status?: "normal" | "warning" | "danger"
): BandwidthEntry {
  const dl = Math.round(100 + Math.random() * 5000);
  const ul = Math.round(20 + Math.random() * 2000);
  return {
    id,
    process: pool.process,
    icon: pool.icon,
    pid: 1000 + idx * 111 + Math.floor(Math.random() * 999),
    downloadMB: dl,
    uploadMB: ul,
    totalMB: dl + ul,
    type,
    status: status ?? (dl + ul > 4000 ? "warning" : "normal"),
    description: pool.desc,
    connections: Math.floor(Math.random() * 40) + 2,
    peakMbps: Math.round(Math.random() * 200 * 10) / 10,
  };
}

const initialFg: BandwidthEntry[] = [
  { id: "f1", process: "Google Chrome", icon: "🌐", pid: 14832, downloadMB: 3840, uploadMB: 420, totalMB: 4260, type: "foreground", status: "normal", description: "Active browsing — 47 tabs, YouTube 4K streaming", connections: 89, peakMbps: 142.5 },
  { id: "f2", process: "VS Code", icon: "💻", pid: 9821, downloadMB: 890, uploadMB: 240, totalMB: 1130, type: "foreground", status: "normal", description: "Extensions sync, GitHub Copilot, Language servers", connections: 12, peakMbps: 28.3 },
  { id: "f3", process: "Zoom", icon: "📹", pid: 7744, downloadMB: 1240, uploadMB: 980, totalMB: 2220, type: "foreground", status: "normal", description: "Video calls — 2h 15m total meeting time today", connections: 4, peakMbps: 45.2 },
  { id: "f4", process: "Figma", icon: "🎨", pid: 5531, downloadMB: 620, uploadMB: 180, totalMB: 800, type: "foreground", status: "normal", description: "Design file sync, 3 files open", connections: 8, peakMbps: 22.1 },
  { id: "f5", process: "Slack", icon: "💬", pid: 6612, downloadMB: 340, uploadMB: 95, totalMB: 435, type: "foreground", status: "normal", description: "Messaging, file uploads, GIF loading", connections: 15, peakMbps: 12.4 },
];

const initialBg: BandwidthEntry[] = [
  { id: "b1", process: "Steam", icon: "🎮", pid: 3312, downloadMB: 10240, uploadMB: 45, totalMB: 10285, type: "background", status: "danger", description: "Game update: Cyberpunk 2077 — 10 GB downloaded silently!", connections: 6, peakMbps: 285.0 },
  { id: "b2", process: "Windows Update", icon: "🪟", pid: 1104, downloadMB: 2400, uploadMB: 890, totalMB: 3290, type: "background", status: "warning", description: "KB5034441 cumulative update + P2P upload sharing", connections: 22, peakMbps: 95.0 },
  { id: "b3", process: "OneDrive", icon: "☁️", pid: 2241, downloadMB: 1800, uploadMB: 2100, totalMB: 3900, type: "background", status: "warning", description: "Syncing 847 files from Documents folder", connections: 8, peakMbps: 68.3 },
  { id: "b4", process: "Dropbox", icon: "📦", pid: 4418, downloadMB: 340, uploadMB: 1250, totalMB: 1590, type: "background", status: "warning", description: "Auto-uploading screenshots & camera imports", connections: 3, peakMbps: 42.1 },
  { id: "b5", process: "Spotify", icon: "🎵", pid: 8890, downloadMB: 280, uploadMB: 12, totalMB: 292, type: "background", status: "normal", description: "Background streaming — High quality preset", connections: 5, peakMbps: 4.2 },
  { id: "b6", process: "Microsoft Teams", icon: "👥", pid: 7723, downloadMB: 420, uploadMB: 60, totalMB: 480, type: "background", status: "normal", description: "Notification sync, chat preload, presence updates", connections: 11, peakMbps: 8.5 },
];

type SortField = "process" | "download" | "upload" | "total";
type SortDir = "asc" | "desc";

function formatMB(mb: number): string {
  if (mb >= 1000) return `${(mb / 1000).toFixed(1)} GB`;
  return `${mb} MB`;
}

function EntryTable({
  entries,
  isLoading,
  scrollRef,
  sort,
  onSortChange,
}: {
  entries: BandwidthEntry[];
  isLoading: boolean;
  scrollRef: React.RefObject<HTMLDivElement | null>;
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

  const maxMB = Math.max(...entries.map((e) => e.totalMB), 1);

  return (
    <div>
      {/* Header */}
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

      {/* Rows */}
      <div ref={scrollRef} className="max-h-[300px] overflow-y-auto overscroll-y-contain">
        {entries.map((entry) => {
          const barWidth = (entry.totalMB / maxMB) * 100;
          return (
            <div key={entry.id} className="relative group hover:bg-secondary/40 transition-colors">
              <div
                className="absolute inset-y-0 left-0 opacity-[0.04] transition-all"
                style={{
                  width: `${barWidth}%`,
                  backgroundColor:
                    entry.status === "danger" ? "#ef4444"
                    : entry.status === "warning" ? "#eab308"
                    : "#6366f1",
                }}
              />
              <div className="relative grid grid-cols-[1fr_90px_90px_90px_80px] gap-2 px-4 py-3 border-b border-border/40 items-center">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-base shrink-0">{entry.icon}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-foreground truncate">{entry.process}</span>
                      <span className="text-[9px] text-muted-foreground/60 tabular-nums">PID {entry.pid}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">{entry.description}</p>
                  </div>
                </div>
                <div className="text-xs text-chart-4 tabular-nums">{formatMB(entry.downloadMB)}</div>
                <div className="text-xs text-chart-5 tabular-nums">{formatMB(entry.uploadMB)}</div>
                <div className="text-xs text-foreground tabular-nums">{formatMB(entry.totalMB)}</div>
                <div className="flex justify-end">
                  {entry.status === "danger" && (
                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 text-[9px]">
                      <Skull className="w-3 h-3" /> ROGUE
                    </div>
                  )}
                  {entry.status === "warning" && (
                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 text-[9px]">
                      <AlertTriangle className="w-3 h-3" /> HEAVY
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
                <span>Connections: <span className="text-foreground">{entry.connections}</span></span>
                <span>Peak: <span className="text-foreground">{entry.peakMbps} Mbps</span></span>
                <span>Avg: <span className="text-foreground">{(entry.totalMB / 14.4).toFixed(1)} MB/hr</span></span>
              </div>
            </div>
          );
        })}

        {/* Skeleton rows */}
        {isLoading && Array.from({ length: 3 }).map((_, i) => (
          <BandwidthSkeletonRow key={`skel-${i}`} />
        ))}
      </div>
    </div>
  );
}

export function BandwidthSplitter() {
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({
    field: "total",
    dir: "desc",
  });
  const [filter, setFilter] = useState("");

  const handleSortChange = (field: SortField) => {
    setSort((prev) =>
      prev.field === field
        ? { field, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { field, dir: "desc" }
    );
  };

  const sortEntries = (entries: BandwidthEntry[]) => {
    let filtered = entries;
    if (filter) {
      const lower = filter.toLowerCase();
      filtered = entries.filter(
        (e) =>
          e.process.toLowerCase().includes(lower) ||
          e.description.toLowerCase().includes(lower)
      );
    }
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sort.field === "process") cmp = a.process.localeCompare(b.process);
      else if (sort.field === "download") cmp = a.downloadMB - b.downloadMB;
      else if (sort.field === "upload") cmp = a.uploadMB - b.uploadMB;
      else cmp = a.totalMB - b.totalMB;
      return sort.dir === "asc" ? cmp : -cmp;
    });
  };

  // Foreground infinite scroll
  const generateFg = useCallback((count: number): BandwidthEntry[] => {
    return Array.from({ length: 8 }, (_, i) => {
      const idx = count + i;
      const pool = FG_PROCESSES[idx % FG_PROCESSES.length];
      return genEntry(`fg-${idx}`, pool, "foreground", idx);
    });
  }, []);

  const {
    items: fgItems,
    isLoading: fgLoading,
    scrollRef: fgScrollRef,
  } = useInfiniteScroll(initialFg, generateFg, { initialCount: 5, batchSize: 5 });

  // Background infinite scroll
  const generateBg = useCallback((count: number): BandwidthEntry[] => {
    return Array.from({ length: 8 }, (_, i) => {
      const idx = count + i;
      const pool = BG_PROCESSES[idx % BG_PROCESSES.length];
      return genEntry(`bg-${idx}`, pool, "background", idx, pool.status);
    });
  }, []);

  const {
    items: bgItems,
    isLoading: bgLoading,
    scrollRef: bgScrollRef,
  } = useInfiniteScroll(initialBg, generateBg, { initialCount: 6, batchSize: 5 });

  const fgSorted = sortEntries(fgItems);
  const bgSorted = sortEntries(bgItems);

  const fgTotal = fgItems.reduce((s, e) => s + e.totalMB, 0);
  const bgTotal = bgItems.reduce((s, e) => s + e.totalMB, 0);
  const grandTotal = fgTotal + bgTotal || 1;
  const rogueCount = bgItems.filter((e) => e.status === "danger" || e.status === "warning").length;

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
      {/* Header */}
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0">
          <div>
            <h3 className="text-foreground flex items-center gap-2">
              <Eye className="w-5 h-5 text-chart-2" />
              Foreground vs. Background Bandwidth
            </h3>
            <p className="text-muted-foreground text-xs mt-1">
              Identify bandwidth thieves — intentional vs. rogue data usage
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Filter processes..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="bg-secondary border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground w-[180px] focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
          </div>
        </div>

        {/* Summary Bar */}
        <div className="flex items-center gap-4 mt-4">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2 text-xs">
                <Eye className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-muted-foreground">Intentional</span>
                <span className="text-foreground">{formatMB(fgTotal)}</span>
                <span className="text-muted-foreground">
                  ({Math.round((fgTotal / grandTotal) * 100)}%)
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <EyeOff className="w-3.5 h-3.5 text-red-400" />
                <span className="text-muted-foreground">Background</span>
                <span className="text-foreground">{formatMB(bgTotal)}</span>
                <span className="text-muted-foreground">
                  ({Math.round((bgTotal / grandTotal) * 100)}%)
                </span>
              </div>
            </div>
            <div className="h-2.5 bg-secondary rounded-full overflow-hidden flex">
              <div
                className="h-full bg-emerald-500/60 transition-all duration-500"
                style={{ width: `${(fgTotal / grandTotal) * 100}%` }}
              />
              <div
                className="h-full bg-red-500/60 transition-all duration-500"
                style={{ width: `${(bgTotal / grandTotal) * 100}%` }}
              />
            </div>
          </div>
          {rogueCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs shrink-0">
              <AlertTriangle className="w-3.5 h-3.5" />
              {rogueCount} bandwidth {rogueCount > 1 ? "thieves" : "thief"} detected
            </div>
          )}
        </div>
      </div>

      {/* Split View */}
      <div className="grid grid-cols-2 divide-x divide-border">
        {/* Foreground / Intentional */}
        <div>
          <div className="px-4 py-2 bg-emerald-500/5 border-b border-border flex items-center gap-2">
            <Eye className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs text-emerald-400">Intentional Data</span>
            <span className="text-[10px] text-muted-foreground ml-auto">
              {fgItems.length} processes
            </span>
          </div>
          <EntryTable
            entries={fgSorted}
            isLoading={fgLoading}
            scrollRef={fgScrollRef}
            sort={sort}
            onSortChange={handleSortChange}
          />
        </div>

        {/* Background / Rogue */}
        <div>
          <div className="px-4 py-2 bg-red-500/5 border-b border-border flex items-center gap-2">
            <EyeOff className="w-3.5 h-3.5 text-red-400" />
            <span className="text-xs text-red-400">Rogue / Background Data</span>
            <span className="text-[10px] text-muted-foreground ml-auto">
              {bgItems.length} processes
            </span>
          </div>
          <EntryTable
            entries={bgSorted}
            isLoading={bgLoading}
            scrollRef={bgScrollRef}
            sort={sort}
            onSortChange={handleSortChange}
          />
        </div>
      </div>
      </div>
      </div>
    </div>
  );
}