import type {
  NetworkSummaryDto,
  NetOverviewDto,
  NetConnectionDto,
  NetProcessBandwidthDto,
  NetSpeedSnapshotDto,
  NetUsagePointDto,
  SpeedTestResultDto,
} from "../types/backend";
import { invokeWithFallback } from "./tauri";

function createFallbackSummary(): NetworkSummaryDto {
  return {
    generatedAt: new Date().toISOString(),
    downloadToday: { title: "Download Today", value: "0 B" },
    uploadToday: { title: "Upload Today", value: "0 B" },
    activeConnections: { title: "Active Connections", value: "0" },
    uniqueDomains: { title: "Unique Domains", value: "0" },
  };
}

function createFallbackOverview(): NetOverviewDto {
  return {
    generatedAt: new Date().toISOString(),
    downloadBytesToday: 0,
    uploadBytesToday: 0,
    activeConnections: 0,
    uniqueRemoteAddrs: 0,
    speed: { downloadBps: 0, uploadBps: 0, latencyMs: 0, jitterMs: 0, timestamp: new Date().toISOString() },
    status: {
      isOnline: false,
      latencyMs: 0,
      uptimePercent: 0,
      avgLatencyMs: 0,
      connectionType: "Unknown",
      dnsServer: "—",
      gateway: "—",
      localIp: "127.0.0.1",
    },
  };
}

export function getNetworkSummary() {
  return invokeWithFallback<NetworkSummaryDto>("get_network_summary", createFallbackSummary);
}

export function getNetworkOverview() {
  return invokeWithFallback<NetOverviewDto>("get_network_overview", createFallbackOverview);
}

export function getNetworkConnections() {
  return invokeWithFallback<NetConnectionDto[]>("get_network_connections", () => []);
}

export function getProcessBandwidth() {
  return invokeWithFallback<NetProcessBandwidthDto[]>("get_process_bandwidth", () => []);
}

export function getSpeedHistory() {
  return invokeWithFallback<NetSpeedSnapshotDto[]>("get_speed_history", () => []);
}

export function getNetworkUsageHistory() {
  return invokeWithFallback<NetUsagePointDto[]>("get_network_usage_history", () => []);
}

export function runSpeedTest() {
  return invokeWithFallback<SpeedTestResultDto>("run_speed_test", () => ({
    downloadBps: 0,
    uploadBps: 0,
    latencyMs: 0,
  }));
}
