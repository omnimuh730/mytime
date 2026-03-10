import { useState, useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import {
  Mouse,
  Keyboard,
  Timer,
  Wifi,
  ArrowDownUp,
  Globe,
  Activity,
  Calendar,
  Download,
  Upload,
  Gauge,
  ShieldAlert,
  Sun,
  Moon,
  Clock,
  Signal,
  LayoutDashboard,
  HelpCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Sidebar } from "./components/Sidebar";
import { StatCard } from "./components/StatCard";
import { ActivityTimeline } from "./components/ActivityTimeline";
import { NetworkUsageChart } from "./components/NetworkUsageChart";
import { DomainTracker } from "./components/DomainTracker";
import { NetworkStatus } from "./components/NetworkStatus";
import { SpeedGauge } from "./components/SpeedGauge";
import { ActivityHeatmap } from "./components/ActivityHeatmap";
import { LiveActivityFeed } from "./components/LiveActivityFeed";
import { InputVisualizer } from "./components/InputVisualizer";
import { LivePulseStrip } from "./components/LivePulseStrip";
import { FocusCorrelator } from "./components/FocusCorrelator";
import { TimelineEditor } from "./components/timeline/TimelineEditor";
import { DataVelocityHeatmap } from "./components/network/DataVelocityHeatmap";
import { BandwidthSplitter } from "./components/network/BandwidthSplitter";
import { NetworkQuotaBurndown } from "./components/network/NetworkQuotaBurndown";
import { LivePacketMatrix } from "./components/network/LivePacketMatrix";
import { SunburstChart } from "./components/reports/SunburstChart";
import { HelpPage } from "./components/HelpPage";
import {
  toActivityStatus,
  toApmData,
  toNetworkData,
  toSunburstApps,
  toTimelineBlocks,
  toTimelineMarkers,
} from "./activityAppUsage";
import { useActivityAppUsage } from "./hooks/useActivityAppUsage";
import { useDashboardSummary } from "./hooks/useDashboardSummary";
import { useAppStatus } from "./hooks/useAppStatus";
import { useNetworkOverview, useProcessBandwidth, useNetworkConnections, useSpeedHistory } from "./hooks/useNetworkData";
import type { DashboardSummaryDto } from "./types/backend";

const PAGE_CONFIG: Record<string, { title: string; subtitle: string; icon: typeof LayoutDashboard; accentColor: string }> = {
  dashboard: { title: "Dashboard", subtitle: "System overview & productivity intelligence", icon: LayoutDashboard, accentColor: "text-primary" },
  activity: { title: "Activity Tracker", subtitle: "Input monitoring & application usage analytics", icon: Activity, accentColor: "text-chart-2" },
  network: { title: "Network Analysis", subtitle: "Traffic forensics & bandwidth intelligence", icon: Wifi, accentColor: "text-chart-3" },
  help: { title: "Help & Documentation", subtitle: "Guides, shortcuts, and system reference", icon: HelpCircle, accentColor: "text-chart-5" },
};

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isDark, setIsDark] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(0);
  const {
    summary: dashboardSummary,
    isLoading: isDashboardSummaryLoading,
    error: dashboardSummaryError,
  } = useDashboardSummary();
  const { status: appStatus } = useAppStatus();

  useEffect(() => {
    document.documentElement.classList.toggle("light", !isDark);
  }, [isDark]);

  useEffect(() => {
    const interval = setInterval(() => setLastUpdated((v) => v + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setLastUpdated(0);
  }, [activeTab]);

  useEffect(() => {
    if (dashboardSummary?.generatedAt) {
      setLastUpdated(0);
    }
  }, [dashboardSummary?.generatedAt]);

  const page = PAGE_CONFIG[activeTab] || PAGE_CONFIG.dashboard;
  const PageIcon = page.icon;
  const ipAddress = appStatus?.ipAddress ?? "192.168.1.42";
  const isOnline = appStatus?.online ?? true;
  const latencyMs = appStatus?.latencyMs ?? 12;

  const formatUpdated = (s: number) => {
    if (s < 5) return "just now";
    if (s < 60) return `${s}s ago`;
    return `${Math.floor(s / 60)}m ago`;
  };

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-auto min-h-[56px] lg:min-h-[72px] border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 sm:px-6 lg:px-8 py-2 sm:py-0 shrink-0 bg-card/40 backdrop-blur-sm gap-2 sm:gap-0">
          {/* Left: Page context */}
          <div className="flex items-center gap-3 lg:gap-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab + "-icon"}
                className={`w-8 h-8 lg:w-10 lg:h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 ${page.accentColor}`}
                initial={{ scale: 0.5, opacity: 0, rotate: -30 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0.5, opacity: 0, rotate: 30 }}
                transition={{ type: "spring", stiffness: 400, damping: 22 }}
              >
                <PageIcon className="w-4 h-4 lg:w-[18px] lg:h-[18px]" />
              </motion.div>
            </AnimatePresence>
            <div className="flex flex-col gap-0.5">
              <AnimatePresence mode="wait">
                <motion.h2
                  key={activeTab + "-title"}
                  className="text-foreground tracking-tight leading-tight text-sm sm:text-base lg:text-xl"
                  initial={{ y: 12, opacity: 0, filter: "blur(4px)" }}
                  animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                  exit={{ y: -12, opacity: 0, filter: "blur(4px)" }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                >
                  {page.title}
                </motion.h2>
              </AnimatePresence>
              <AnimatePresence mode="wait">
                <motion.p
                  key={activeTab + "-sub"}
                  className="text-[10px] sm:text-[11px] text-muted-foreground leading-tight hidden sm:block"
                  initial={{ y: 10, opacity: 0, filter: "blur(3px)" }}
                  animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                  exit={{ y: -10, opacity: 0, filter: "blur(3px)" }}
                  transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.04 }}
                >
                  {page.subtitle}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>

          {/* Right: Status chips */}
          <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-3 flex-wrap sm:flex-nowrap">
            {/* Last updated chip */}
            <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-secondary/50 border border-border/50 text-[10px] sm:text-[11px] text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span className="tabular-nums">{formatUpdated(lastUpdated)}</span>
            </div>

            {/* IP chip — hide on very small */}
            <div className="hidden sm:flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-secondary/50 border border-border/50 text-[10px] sm:text-[11px]">
              <Signal className="w-3 h-3 text-muted-foreground" />
              <span className="text-foreground tabular-nums">{ipAddress}</span>
            </div>

            {/* Network status chip */}
            <div
              className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl text-[10px] sm:text-[11px] ${
                isOnline
                  ? "bg-emerald-500/8 border border-emerald-500/15"
                  : "bg-red-500/8 border border-red-500/15"
              }`}
            >
              <div className="relative flex items-center justify-center">
                <span
                  className={`absolute w-2 h-2 rounded-full animate-ping opacity-30 ${
                    isOnline ? "bg-emerald-400" : "bg-red-400"
                  }`}
                />
                <span
                  className={`relative w-2 h-2 rounded-full ${
                    isOnline ? "bg-emerald-400" : "bg-red-400"
                  }`}
                />
              </div>
              <span className={isOnline ? "text-emerald-400" : "text-red-400"}>
                {isOnline ? "Online" : "Offline"}
              </span>
              <span
                className={`tabular-nums hidden sm:inline ${
                  isOnline ? "text-emerald-400/50" : "text-red-400/50"
                }`}
              >
                {latencyMs}ms
              </span>
            </div>

            {/* Separator */}
            <div className="w-px h-5 sm:h-6 bg-border mx-0.5" />

            {/* Theme Toggle */}
            <motion.button
              onClick={() => setIsDark((v) => !v)}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center cursor-pointer text-muted-foreground hover:text-foreground bg-secondary/50 border border-border/50 hover:bg-secondary transition-colors"
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.85, rotate: 180 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              <AnimatePresence mode="wait">
                {isDark ? (
                  <motion.div key="sun" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
                    <Sun className="w-4 h-4" />
                  </motion.div>
                ) : (
                  <motion.div key="moon" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}>
                    <Moon className="w-4 h-4" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-20 lg:pb-8">
          {activeTab === "dashboard" && <DashboardView summary={dashboardSummary} />}
          {activeTab === "activity" && (
            <ActivityView
              summary={dashboardSummary}
              isSummaryLoading={isDashboardSummaryLoading}
              summaryError={dashboardSummaryError}
            />
          )}
          {activeTab === "network" && <NetworkView />}
          {activeTab === "help" && <HelpPage />}
        </main>
      </div>
    </div>
  );
}

function DashboardView({ summary }: { summary: DashboardSummaryDto | null }) {
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Live Pulse Strip */}
      <LivePulseStrip />

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title={summary?.metrics.activeTimeToday.title ?? "Active Time Today"}
          value={summary?.metrics.activeTimeToday.value ?? "6h 42m"}
          change={summary?.metrics.activeTimeToday.change ?? "+12%"}
          trend={summary?.metrics.activeTimeToday.trend ?? "up"}
          icon={<Timer className="w-5 h-5" />}
          color="bg-primary/10 text-primary"
          subtitle={summary?.metrics.activeTimeToday.subtitle ?? "vs yesterday"}
        />
        <StatCard
          title={summary?.metrics.mouseEvents.title ?? "Mouse Events"}
          value={summary?.metrics.mouseEvents.value ?? "14,827"}
          change={summary?.metrics.mouseEvents.change ?? "+8%"}
          trend={summary?.metrics.mouseEvents.trend ?? "up"}
          icon={<Mouse className="w-5 h-5" />}
          color="bg-chart-2/10 text-chart-2"
          subtitle={summary?.metrics.mouseEvents.subtitle ?? "clicks & movements"}
        />
        <StatCard
          title={summary?.metrics.keystrokes.title ?? "Keystrokes"}
          value={summary?.metrics.keystrokes.value ?? "23,456"}
          change={summary?.metrics.keystrokes.change ?? "-3%"}
          trend={summary?.metrics.keystrokes.trend ?? "down"}
          icon={<Keyboard className="w-5 h-5" />}
          color="bg-chart-3/10 text-chart-3"
          subtitle={summary?.metrics.keystrokes.subtitle ?? "total today"}
        />
        <StatCard
          title={summary?.metrics.networkTraffic.title ?? "Network Traffic"}
          value={summary?.metrics.networkTraffic.value ?? "26.1 GB"}
          change={summary?.metrics.networkTraffic.change ?? "+24%"}
          trend={summary?.metrics.networkTraffic.trend ?? "up"}
          icon={<ArrowDownUp className="w-5 h-5" />}
          color="bg-chart-4/10 text-chart-4"
          subtitle={summary?.metrics.networkTraffic.subtitle ?? "download + upload"}
        />
      </div>

      {/* Focus Correlator (full width) */}
      <FocusCorrelator />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <ActivityTimeline />
        <NetworkUsageChart />
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 items-stretch">
        <div className="lg:col-span-1 [&>div]:h-full">
          <NetworkStatus />
        </div>
        <div className="lg:col-span-2 [&>div]:h-full">
          <InputVisualizer />
        </div>
      </div>
    </div>
  );
}

function ActivityView({
  summary,
  isSummaryLoading,
  summaryError,
}: {
  summary: DashboardSummaryDto | null;
  isSummaryLoading: boolean;
  summaryError: string | null;
}) {
  const {
    data: appUsageData,
    isLoading: isAppUsageLoading,
    error: appUsageError,
  } = useActivityAppUsage();

  const realTimelineBlocks = useMemo(
    () => toTimelineBlocks(appUsageData?.sessions ?? []),
    [appUsageData],
  );
  const realActivityStatus = useMemo(
    () => toActivityStatus(appUsageData?.inputMinutes ?? []),
    [appUsageData],
  );
  const realTimelineMarkers = useMemo(
    () => toTimelineMarkers(appUsageData?.inputMinutes ?? []),
    [appUsageData],
  );
  const realApmData = useMemo(
    () => toApmData(appUsageData?.inputMinutes ?? []),
    [appUsageData],
  );
  const realNetworkData = useMemo(() => toNetworkData(), []);
  const realSunburstApps = useMemo(
    () => toSunburstApps(appUsageData?.apps ?? []),
    [appUsageData],
  );

  const activeTime = summary?.metrics.activeTimeToday?.value ?? "—";
  const mouseEvents = summary?.metrics.mouseEvents?.value ?? "—";
  const keystrokes = summary?.metrics.keystrokes?.value ?? "—";
  const activeTimeChange = summary?.metrics.activeTimeToday?.change ?? undefined;
  const activeTimeTrend = summary?.metrics.activeTimeToday?.trend;
  const mouseChange = summary?.metrics.mouseEvents?.change ?? undefined;
  const mouseTrend = summary?.metrics.mouseEvents?.trend;
  const keystrokesChange = summary?.metrics.keystrokes?.change ?? undefined;
  const keystrokesTrend = summary?.metrics.keystrokes?.trend;

  return (
    <div className="space-y-4 sm:space-y-6">
      {summaryError && (
        <div className="rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {summaryError}
        </div>
      )}
      {appUsageError && (
        <div className="rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {appUsageError}
        </div>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Total Active Time"
          value={isSummaryLoading ? "…" : activeTime}
          change={activeTimeChange}
          trend={activeTimeTrend ?? "up"}
          icon={<Timer className="w-5 h-5" />}
          color="bg-primary/10 text-primary"
        />
        <StatCard
          title="Mouse Events"
          value={isSummaryLoading ? "…" : mouseEvents}
          change={mouseChange}
          trend={mouseTrend ?? "up"}
          icon={<Mouse className="w-5 h-5" />}
          color="bg-chart-2/10 text-chart-2"
        />
        <StatCard
          title="Keystrokes"
          value={isSummaryLoading ? "…" : keystrokes}
          change={keystrokesChange}
          trend={keystrokesTrend ?? "up"}
          icon={<Keyboard className="w-5 h-5" />}
          color="bg-chart-3/10 text-chart-3"
        />
        <StatCard
          title="Idle Periods"
          value="—"
          icon={<Activity className="w-5 h-5" />}
          color="bg-chart-5/10 text-chart-5"
        />
      </div>

      {/* Multi-Track Timeline Editor (timebar + tracks + minimap) */}
      <div className="min-h-[320px]">
        <TimelineEditor
          blocks={realTimelineBlocks}
          activityStatus={realActivityStatus}
          markers={realTimelineMarkers}
          apmData={realApmData}
          networkData={realNetworkData}
          isLoading={isAppUsageLoading}
        />
      </div>

      {/* App Usage Sunburst + Live Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <SunburstChart allApps={realSunburstApps} />
        <LiveActivityFeed />
      </div>

      {/* Activity Timeline + Activity Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 items-stretch">
        <div className="[&>div]:h-full">
          <ActivityTimeline initialRange="today" />
        </div>
        <div className="[&>div]:h-full">
          <ActivityHeatmap />
        </div>
      </div>
    </div>
  );
}

function NetworkView() {
  const { overview } = useNetworkOverview();
  const { processes } = useProcessBandwidth();
  const { connections } = useNetworkConnections();
  const { history: speedHistory } = useSpeedHistory();

  const dlStr = overview ? fmtBytes(overview.downloadBytesToday) : "—";
  const ulStr = overview ? fmtBytes(overview.uploadBytesToday) : "—";
  const conns = overview?.activeConnections ?? 0;
  const remotes = overview?.uniqueRemoteAddrs ?? 0;
  const dlSpeed = overview ? fmtMbps(overview.speed.downloadBps) : "—";
  const ulSpeed = overview ? fmtMbps(overview.speed.uploadBps) : "—";
  const latency = overview?.speed.latencyMs ?? 0;
  const jitter = overview?.speed.jitterMs ?? 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ── Overview Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard title="Download Today" value={dlStr} icon={<Download className="w-5 h-5" />} color="bg-chart-3/10 text-chart-3" />
        <StatCard title="Upload Today" value={ulStr} icon={<Upload className="w-5 h-5" />} color="bg-chart-4/10 text-chart-4" />
        <StatCard title="Active Connections" value={String(conns)} icon={<Wifi className="w-5 h-5" />} color="bg-chart-2/10 text-chart-2" />
        <StatCard title="Unique Remote IPs" value={String(remotes)} icon={<Globe className="w-5 h-5" />} color="bg-primary/10 text-primary" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard title="Download Speed" value={dlSpeed} icon={<Gauge className="w-5 h-5" />} color="bg-chart-5/10 text-chart-5" />
        <StatCard title="Upload Speed" value={ulSpeed} icon={<Gauge className="w-5 h-5" />} color="bg-chart-2/10 text-chart-2" />
        <StatCard title="Latency" value={`${latency}ms`} icon={<Activity className="w-5 h-5" />} color="bg-chart-3/10 text-chart-3" subtitle="to 8.8.8.8" />
        <StatCard title="Jitter" value={`${jitter.toFixed(1)}ms`} icon={<ShieldAlert className="w-5 h-5" />} color="bg-chart-4/10 text-chart-4" />
      </div>

      <SectionHeader icon={<ArrowDownUp className="w-4 h-4" />} title="Traffic & Usage" subtitle="Real-time and historical bandwidth overview" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <NetworkUsageChart downloadBytes={overview?.downloadBytesToday ?? 0} uploadBytes={overview?.uploadBytesToday ?? 0} />
        <NetworkStatus overview={overview} />
      </div>

      <SectionHeader icon={<Calendar className="w-4 h-4" />} title="Data Velocity & Quota" subtitle="Daily volume heatmap and monthly budget tracking" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <DataVelocityHeatmap downloadBytesToday={overview?.downloadBytesToday ?? 0} uploadBytesToday={overview?.uploadBytesToday ?? 0} />
        <NetworkQuotaBurndown downloadBytesToday={overview?.downloadBytesToday ?? 0} uploadBytesToday={overview?.uploadBytesToday ?? 0} />
      </div>

      <SectionHeader icon={<ShieldAlert className="w-4 h-4" />} title="Bandwidth Analysis" subtitle="Foreground vs. background process traffic split" />
      <BandwidthSplitter processes={processes} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 items-stretch">
        <div className="flex flex-col gap-3 sm:gap-4">
          <SectionHeader icon={<Globe className="w-4 h-4" />} title="Domain Analytics" subtitle="Top remote addresses and request counts" />
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <StatCard title="Remote IPs" value={String(remotes)} icon={<Globe className="w-5 h-5" />} color="bg-primary/10 text-primary" />
            <StatCard title="Connections" value={String(conns)} icon={<ArrowDownUp className="w-5 h-5" />} color="bg-chart-2/10 text-chart-2" />
            <StatCard title="Total Traffic" value={fmtBytes((overview?.downloadBytesToday ?? 0) + (overview?.uploadBytesToday ?? 0))} icon={<Download className="w-5 h-5" />} color="bg-chart-3/10 text-chart-3" />
            <StatCard title="Processes" value={String(processes.length)} icon={<ShieldAlert className="w-5 h-5" />} color="bg-chart-4/10 text-chart-4" />
          </div>
          <div className="flex-1 min-h-0 [&>div]:h-full">
            <DomainTracker connections={connections} />
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:gap-4">
          <SectionHeader icon={<Gauge className="w-4 h-4" />} title="Speed & Performance" subtitle="Connection speed monitoring, ping, and jitter analysis" />
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <StatCard title="Download Speed" value={dlSpeed} icon={<Download className="w-5 h-5" />} color="bg-primary/10 text-primary" />
            <StatCard title="Upload Speed" value={ulSpeed} icon={<Upload className="w-5 h-5" />} color="bg-chart-2/10 text-chart-2" />
            <StatCard title="Ping" value={`${latency}ms`} icon={<Activity className="w-5 h-5" />} color="bg-chart-4/10 text-chart-4" />
            <StatCard title="Jitter" value={`${jitter.toFixed(1)}ms`} icon={<Wifi className="w-5 h-5" />} color="bg-chart-3/10 text-chart-3" />
          </div>
          <div className="flex-1 min-h-0 [&>div]:h-full">
            <SpeedGauge speedHistory={speedHistory} currentDownloadBps={overview?.speed.downloadBps ?? 0} currentUploadBps={overview?.speed.uploadBps ?? 0} />
          </div>
        </div>
      </div>
      <LivePacketMatrix connections={connections} />
    </div>
  );
}

function fmtBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function fmtMbps(bps: number): string {
  return `${(bps / 1_000_000).toFixed(1)} Mbps`;
}

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-3 pt-4 pb-1 border-t border-border">
      <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <h3 className="text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">
          {subtitle}
        </p>
      </div>
    </div>
  );
}