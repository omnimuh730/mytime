export type MetricTrend = "up" | "down";

export interface MetricCardDto {
  title: string;
  value: string;
  change?: string | null;
  trend?: MetricTrend | null;
  subtitle?: string | null;
}

export interface DashboardMetricsDto {
  activeTimeToday: MetricCardDto;
  mouseEvents: MetricCardDto;
  keystrokes: MetricCardDto;
  networkTraffic: MetricCardDto;
}

export interface DashboardSummaryDto {
  generatedAt: string;
  metrics: DashboardMetricsDto;
}

export interface AppStatusDto {
  appName: string;
  version: string;
  platform: string;
  startedAt: string;
  backendMode: string;
  collectorsRunning: boolean;
  dataDir: string;
  logDir: string;
  dbPath: string;
  dbExists: boolean;
  ipAddress: string;
  online: boolean;
  latencyMs: number;
}

export interface ActivityTimelinePointDto {
  label: string;
  active: number;
  inactive: number;
  fullDate: string;
}

export interface ActivityTimelineDto {
  generatedAt: string;
  startDate: string;
  endDate: string;
  isHourly: boolean;
  yLabel: string;
  maxValue: number;
  avgActive: number;
  points: ActivityTimelinePointDto[];
}

export interface NetworkSummaryDto {
  generatedAt: string;
  downloadToday: MetricCardDto;
  uploadToday: MetricCardDto;
  activeConnections: MetricCardDto;
  uniqueDomains: MetricCardDto;
}

export type InputMonitorKind = "keyboard" | "mouse" | "scroll";
export type InputMonitorAction = "press" | "release" | "move" | "wheel";
export type InputMonitorButton = "left" | "right" | "middle";
export type InputMonitorDirection = "up" | "down";

export interface InputMonitorEventDto {
  kind: InputMonitorKind;
  action: InputMonitorAction;
  label: string;
  stateKey?: string | null;
  button?: InputMonitorButton | null;
  direction?: InputMonitorDirection | null;
  x?: number | null;
  y?: number | null;
  timestamp: number;
}

export interface LiveFeedEventDto {
  id: number;
  eventType: "mouse" | "keyboard" | "scroll";
  description: string;
  timestamp: string;
  detail?: string | null;
}

/** 7 days (Mon–Sun) × 24 hours, activity intensity 0–100. */
export interface ActivityHeatmapDto {
  grid: number[][];
}

export interface AppUsageSessionDto {
  id: number;
  appId: string;
  appName: string;
  iconDataUrl?: string | null;
  title: string;
  pid: number;
  startedAtMs: number;
  endedAtMs: number;
  durationMs: number;
  keyPresses: number;
  mouseClicks: number;
  scrollEvents: number;
}

export interface AppUsageSummaryDto {
  appId: string;
  appName: string;
  iconDataUrl?: string | null;
  sessionCount: number;
  totalDurationMs: number;
  keyPresses: number;
  mouseClicks: number;
  scrollEvents: number;
}

export interface AppInputMinuteDto {
  minuteOfDay: number;
  keyPresses: number;
  mouseClicks: number;
  mouseMoves: number;
  scrollEvents: number;
}

export interface ActivityAppUsageDto {
  generatedAt: string;
  sessions: AppUsageSessionDto[];
  apps: AppUsageSummaryDto[];
  inputMinutes: AppInputMinuteDto[];
}

export interface ActivityOverviewDto {
  generatedAt: string;
  totalSessions: number;
  apps: AppUsageSummaryDto[];
  inputMinutes: AppInputMinuteDto[];
  timelineSessions: AppUsageSessionDto[];
}

export interface ActivitySessionPageDto {
  generatedAt: string;
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  sessions: AppUsageSessionDto[];
}

// ── Network monitoring DTOs ──

export interface NetConnectionDto {
  id: string;
  process: string;
  pid: number;
  icon: string;
  protocol: string;
  localAddr: string;
  localPort: number;
  remoteAddr: string;
  remotePort: number;
  state: string;
  downloadBytes: number;
  uploadBytes: number;
}

export interface NetProcessBandwidthDto {
  id: string;
  process: string;
  pid: number;
  icon: string;
  iconDataUrl: string | null;
  downloadBytes: number;
  uploadBytes: number;
  totalBytes: number;
  connectionCount: number;
  peakBps: number;
  processType: "foreground" | "background";
  status: "normal" | "warning" | "danger";
  description: string;
}

export interface NetDomainDto {
  domain: string;
  requestCount: number;
  bandwidthBytes: number;
  category: string;
  color: string;
  percentage: number;
}

export interface NetSpeedSnapshotDto {
  downloadBps: number;
  uploadBps: number;
  latencyMs: number;
  jitterMs: number;
  timestamp: string;
}

export interface NetUsagePointDto {
  label: string;
  downloadBytes: number;
  uploadBytes: number;
}

export interface NetStatusDto {
  isOnline: boolean;
  latencyMs: number;
  uptimePercent: number;
  avgLatencyMs: number;
  connectionType: string;
  dnsServer: string;
  gateway: string;
  localIp: string;
}

export interface SpeedTestResultDto {
  downloadBps: number;
  uploadBps: number;
  latencyMs: number;
}

export interface NetOverviewDto {
  generatedAt: string;
  downloadBytesToday: number;
  uploadBytesToday: number;
  activeConnections: number;
  uniqueRemoteAddrs: number;
  speed: NetSpeedSnapshotDto;
  status: NetStatusDto;
}
