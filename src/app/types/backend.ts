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
