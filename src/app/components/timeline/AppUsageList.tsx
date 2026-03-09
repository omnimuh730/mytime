import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  ChevronUp,
  ChevronDown,
  Clock,
  Filter,
  Search,
  LayoutList,
} from "lucide-react";
import {
  type TimelineBlock,
  formatMinutes,
  formatDuration,
  APP_COLORS,
  APP_ICONS,
} from "./timeline-data";
import {
  AppUsageSkeletonRow,
  AppSummarySkeletonRow,
} from "../ui/SkeletonRows";

interface AppUsageListProps {
  blocks: TimelineBlock[];
  onBlockSelect: (block: TimelineBlock) => void;
  selectedBlockIds: Set<string>;
}

type SortField = "title" | "start" | "end" | "duration" | "app";
type SortDir = "asc" | "desc";

// Extra mock data generator for infinite scroll
const EXTRA_APPS = [
  { app: "VS Code", titles: ["Editing App.tsx", "Debugging server.ts", "Reviewing PR #142", "Refactoring utils", "Writing tests"] },
  { app: "Google Chrome", titles: ["Stack Overflow", "GitHub Issues", "MDN Docs", "Tailwind Docs", "React Reference"] },
  { app: "Slack", titles: ["#engineering channel", "DM with Sarah", "Stand-up thread", "Code review discussion", "Bug report triage"] },
  { app: "Figma", titles: ["Dashboard redesign", "Component library", "Icon system", "Mobile wireframes", "Design review"] },
  { app: "Terminal", titles: ["npm run dev", "git rebase", "docker compose up", "Running migrations", "SSH to staging"] },
  { app: "Notion", titles: ["Sprint planning", "Meeting notes", "Architecture doc", "Roadmap update", "Research notes"] },
  { app: "Discord", titles: ["Dev community", "Voice chat", "Bug report channel", "Feedback thread", "Team standup"] },
  { app: "Spotify", titles: ["Focus playlist", "Lo-fi beats", "Ambient coding", "Podcast episode", "Deep work mix"] },
  { app: "Postman", titles: ["Testing auth API", "GraphQL queries", "Webhook testing", "Collection runner", "Environment setup"] },
  { app: "Docker", titles: ["Container logs", "Image build", "Compose restart", "Volume management", "Network inspect"] },
];

const TAGS = [undefined, "deep-work", "meeting", "review", "break", "research", "deploy", "debug"];

function generateExtraBlocks(startIdx: number, count: number): TimelineBlock[] {
  const blocks: TimelineBlock[] = [];
  for (let i = 0; i < count; i++) {
    const idx = startIdx + i;
    const appEntry = EXTRA_APPS[idx % EXTRA_APPS.length];
    const title = appEntry.titles[idx % appEntry.titles.length];
    const startMin = 420 + (idx * 17) % 720; // between 7am-7pm
    const duration = 5 + Math.floor(Math.random() * 55);
    blocks.push({
      id: `extra-${idx}-${Date.now()}`,
      app: appEntry.app,
      title: `${title} (${idx + 1})`,
      startMin,
      endMin: startMin + duration,
      color: APP_COLORS[appEntry.app] || "#6366f1",
      icon: APP_ICONS[appEntry.app] || "📱",
      category: "work",
      keystrokes: Math.floor(Math.random() * 2000),
      clicks: Math.floor(Math.random() * 500),
      downloadMB: Math.round(Math.random() * 50 * 10) / 10,
      uploadMB: Math.round(Math.random() * 20 * 10) / 10,
      tag: TAGS[idx % TAGS.length],
    });
  }
  return blocks;
}

// Simple infinite scroll hook for this component (works with growing block array)
function useListInfiniteScroll(
  totalCount: number,
  opts: { batchSize: number; loadDelay: number; threshold: number }
) {
  const [visibleCount, setVisibleCount] = useState(opts.batchSize);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  // Reset visible count when total changes significantly (e.g., filter)
  useEffect(() => {
    setVisibleCount(Math.min(opts.batchSize, totalCount));
  }, [totalCount, opts.batchSize]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || loadingRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollHeight - scrollTop - clientHeight < opts.threshold) {
      loadingRef.current = true;
      setIsLoading(true);
      setTimeout(() => {
        setVisibleCount((prev) => prev + opts.batchSize);
        setIsLoading(false);
        loadingRef.current = false;
      }, opts.loadDelay);
    }
  }, [opts.batchSize, opts.loadDelay, opts.threshold]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  return { visibleCount, isLoading, scrollRef };
}

export function AppUsageList({
  blocks: initialBlocks,
  onBlockSelect,
  selectedBlockIds,
}: AppUsageListProps) {
  const [sortField, setSortField] = useState<SortField>("start");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filterText, setFilterText] = useState("");
  const [filterApp, setFilterApp] = useState<string | null>(null);
  const [extraBlocks, setExtraBlocks] = useState<TimelineBlock[]>([]);
  const extraGenRef = useRef(0);

  // All blocks = initial + generated extras
  const allBlocks = useMemo(
    () => [...initialBlocks, ...extraBlocks],
    [initialBlocks, extraBlocks]
  );

  // Aggregate app stats (from all blocks)
  const appStats = useMemo(() => {
    const stats: Record<
      string,
      { app: string; totalMins: number; count: number; color: string; icon: string }
    > = {};
    allBlocks.forEach((b) => {
      if (!stats[b.app]) {
        stats[b.app] = { app: b.app, totalMins: 0, count: 0, color: b.color, icon: b.icon };
      }
      stats[b.app].totalMins += b.endMin - b.startMin;
      stats[b.app].count++;
    });
    return Object.values(stats).sort((a, b) => b.totalMins - a.totalMins);
  }, [allBlocks]);

  const totalMins = appStats.reduce((s, a) => s + a.totalMins, 0);

  // Filtered & sorted blocks
  const filteredBlocks = useMemo(() => {
    let result = [...allBlocks];
    if (filterText) {
      const lower = filterText.toLowerCase();
      result = result.filter(
        (b) => b.title.toLowerCase().includes(lower) || b.app.toLowerCase().includes(lower)
      );
    }
    if (filterApp) {
      result = result.filter((b) => b.app === filterApp);
    }
    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === "title") cmp = a.title.localeCompare(b.title);
      else if (sortField === "app") cmp = a.app.localeCompare(b.app);
      else if (sortField === "start") cmp = a.startMin - b.startMin;
      else if (sortField === "end") cmp = a.endMin - b.endMin;
      else if (sortField === "duration") cmp = (a.endMin - a.startMin) - (b.endMin - b.startMin);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [allBlocks, filterText, filterApp, sortField, sortDir]);

  // Main list infinite scroll
  const {
    visibleCount: mainVisible,
    isLoading: mainLoading,
    scrollRef: mainScrollRef,
  } = useListInfiniteScroll(filteredBlocks.length, {
    batchSize: 15,
    loadDelay: 600,
    threshold: 100,
  });

  // App summary infinite scroll
  const {
    visibleCount: summaryVisible,
    isLoading: summaryLoading,
    scrollRef: summaryScrollRef,
  } = useListInfiniteScroll(appStats.length, {
    batchSize: 10,
    loadDelay: 500,
    threshold: 60,
  });

  // Generate more blocks when main list nears end
  useEffect(() => {
    if (mainVisible >= filteredBlocks.length - 5 && !mainLoading) {
      const batch = generateExtraBlocks(extraGenRef.current, 12);
      extraGenRef.current += 12;
      setExtraBlocks((prev) => [...prev, ...batch]);
    }
  }, [mainVisible, filteredBlocks.length, mainLoading]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field)
      return <ChevronUp className="w-3 h-3 text-muted-foreground/30" />;
    return sortDir === "asc" ? (
      <ChevronUp className="w-3 h-3 text-primary" />
    ) : (
      <ChevronDown className="w-3 h-3 text-primary" />
    );
  };

  const visibleBlocks = filteredBlocks.slice(0, mainVisible);
  const visibleStats = appStats.slice(0, summaryVisible);

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      {/* Card Title */}
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-foreground flex items-center gap-2">
              <LayoutList className="w-5 h-5 text-chart-3" />
              Application Usage Log
            </h3>
            <p className="text-muted-foreground text-xs mt-1">
              Detailed breakdown of all tracked application sessions
            </p>
          </div>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {filteredBlocks.length} entries
          </span>
        </div>
      </div>

      {/* Two-panel layout like ManicTime */}
      <div className="flex divide-x divide-border">
        {/* Left: Detail List */}
        <div className="flex-1 min-w-0">
          {/* Search & Filter Bar */}
          <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 border-b border-border">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Filter by title or app..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
            {filterApp && (
              <button
                onClick={() => setFilterApp(null)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 text-primary text-[10px] hover:bg-primary/20 transition-colors cursor-pointer"
              >
                <Filter className="w-3 h-3" />
                {filterApp}
                <span className="ml-1 opacity-60">&times;</span>
              </button>
            )}
            <span className="text-[10px] text-muted-foreground shrink-0">
              showing {visibleBlocks.length} of {filteredBlocks.length}
            </span>
          </div>

          {/* Table Header */}
          <div className="overflow-x-auto">
            <div className="min-w-[520px]">
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-3 px-4 py-1.5 border-b border-border bg-secondary/20 text-[10px] text-muted-foreground uppercase tracking-wider">
                <button onClick={() => toggleSort("title")} className="flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors text-left">
                  Title <SortIcon field="title" />
                </button>
                <button onClick={() => toggleSort("app")} className="flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors w-24">
                  App <SortIcon field="app" />
                </button>
                <button onClick={() => toggleSort("start")} className="flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors w-20">
                  Start <SortIcon field="start" />
                </button>
                <button onClick={() => toggleSort("end")} className="flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors w-20">
                  End <SortIcon field="end" />
                </button>
                <button onClick={() => toggleSort("duration")} className="flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors w-16 justify-end">
                  Duration <SortIcon field="duration" />
                </button>
              </div>
            </div>
          </div>

          {/* Table Body */}
          <div ref={mainScrollRef} className="max-h-[320px] overflow-y-auto overflow-x-auto overscroll-y-contain">
            <div className="min-w-[520px]">
              {visibleBlocks.map((block) => {
                const duration = block.endMin - block.startMin;
                const isSelected = selectedBlockIds.has(block.id);
                return (
                  <div
                    key={block.id}
                    onClick={() => onBlockSelect(block)}
                    className={`grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-3 px-4 py-2 border-b border-border/50 cursor-pointer transition-all duration-150 ${
                      isSelected
                        ? "bg-primary/10 border-l-2 border-l-primary"
                        : "hover:bg-secondary/40"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs shrink-0">{block.icon}</span>
                      <span className="text-xs text-foreground truncate">{block.title}</span>
                      {block.tag && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary shrink-0">
                          {block.tag}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 w-24">
                      <div className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: block.color }} />
                      <span className="text-[11px] text-muted-foreground truncate">{block.app}</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground tabular-nums w-20">
                      {formatMinutes(block.startMin)}
                    </span>
                    <span className="text-[11px] text-muted-foreground tabular-nums w-20">
                      {formatMinutes(block.endMin)}
                    </span>
                    <span className="text-[11px] text-foreground tabular-nums w-16 text-right">
                      {formatDuration(duration)}
                    </span>
                  </div>
                );
              })}

              {/* Skeleton loading rows */}
              {mainLoading && Array.from({ length: 4 }).map((_, i) => (
                <AppUsageSkeletonRow key={`skel-${i}`} />
              ))}
            </div>
          </div>
        </div>

        {/* Right: App Summary (like ManicTime right panel) — hidden on small screens */}
        <div className="w-[280px] shrink-0 hidden md:block">
          <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
            <span className="text-xs text-foreground">App Summary</span>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock className="w-3 h-3" />
              Total: {formatDuration(totalMins)}
            </div>
          </div>
          <div ref={summaryScrollRef} className="max-h-[360px] overflow-y-auto overscroll-y-contain">
            {visibleStats.map((stat) => {
              const pct = totalMins > 0 ? Math.round((stat.totalMins / totalMins) * 100) : 0;
              const isFiltered = filterApp === stat.app;
              return (
                <div
                  key={stat.app}
                  onClick={() => setFilterApp(isFiltered ? null : stat.app)}
                  className={`flex items-center gap-3 px-4 py-2.5 border-b border-border/50 cursor-pointer transition-all duration-150 ${
                    isFiltered ? "bg-primary/5" : "hover:bg-secondary/40"
                  }`}
                >
                  <span className="text-sm shrink-0">{stat.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-foreground truncate">{stat.app}</span>
                      <span className="text-xs text-foreground tabular-nums shrink-0 ml-2">
                        {formatDuration(stat.totalMins)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: stat.color }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground w-8 text-right tabular-nums">
                        {pct}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Summary skeleton rows */}
            {summaryLoading && Array.from({ length: 3 }).map((_, i) => (
              <AppSummarySkeletonRow key={`skel-sum-${i}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}