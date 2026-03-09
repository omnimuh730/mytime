import type { NetworkSummaryDto } from "../types/backend";
import { invokeWithFallback } from "./tauri";

function createFallbackSummary(): NetworkSummaryDto {
  return {
    generatedAt: new Date().toISOString(),
    downloadToday: {
      title: "Download Today",
      value: "18.4 GB",
      change: "+28%",
      trend: "up",
    },
    uploadToday: {
      title: "Upload Today",
      value: "7.7 GB",
      change: "+15%",
      trend: "up",
    },
    activeConnections: {
      title: "Active Connections",
      value: "147",
      change: "+12",
      trend: "up",
    },
    uniqueDomains: {
      title: "Unique Domains",
      value: "89",
      change: "+7",
      trend: "up",
    },
  };
}

export function getNetworkSummary() {
  return invokeWithFallback<NetworkSummaryDto>(
    "get_network_summary",
    createFallbackSummary,
  );
}
