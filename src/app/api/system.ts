import type { AppStatusDto } from "../types/backend";
import { invokeWithFallback } from "./tauri";

function createFallbackStatus(): AppStatusDto {
  return {
    appName: "MyTime",
    version: "0.1.0",
    platform: "browser",
    startedAt: new Date().toISOString(),
    backendMode: "frontend-fallback",
    collectorsRunning: false,
    dataDir: "unavailable",
    logDir: "unavailable",
    dbPath: "unavailable",
    dbExists: false,
    ipAddress: "192.168.1.42",
    online: true,
    latencyMs: 12,
  };
}

export function getAppStatus() {
  return invokeWithFallback<AppStatusDto>("get_app_status", createFallbackStatus);
}
