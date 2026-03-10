import type { AppEntry } from "./components/reports/CategoryManagerModal";
import type { TimelineBlock } from "./components/timeline/timeline-data";
import type {
  AppUsageSessionDto,
  AppUsageSummaryDto,
} from "./types/backend";

const DAY_START_MIN = 7 * 60;
const DAY_END_MIN = 21 * 60;

const APP_META: Record<
  string,
  { color: string; icon: string; category: string }
> = {
  code: { color: "#007acc", icon: "💻", category: "Development" },
  devenv: { color: "#7c3aed", icon: "💻", category: "Development" },
  chrome: { color: "#4caf50", icon: "🌐", category: "Browsing" },
  msedge: { color: "#0078d7", icon: "🌐", category: "Browsing" },
  firefox: { color: "#ff7139", icon: "🦊", category: "Browsing" },
  slack: { color: "#611f69", icon: "💬", category: "Communication" },
  discord: { color: "#5865f2", icon: "🎮", category: "Communication" },
  teams: { color: "#6264a7", icon: "💬", category: "Communication" },
  outlook: { color: "#0078d4", icon: "📧", category: "Communication" },
  figma: { color: "#a259ff", icon: "🎨", category: "Design" },
  photoshop: { color: "#31a8ff", icon: "🎨", category: "Design" },
  terminal: { color: "#2d2d2d", icon: "⬛", category: "Development" },
  powershell: { color: "#2563eb", icon: "⬛", category: "Development" },
  cmd: { color: "#334155", icon: "⬛", category: "Development" },
  notepad: { color: "#64748b", icon: "📝", category: "Productivity" },
  notion: { color: "#111827", icon: "📓", category: "Productivity" },
  explorer: { color: "#f0c040", icon: "📁", category: "Productivity" },
  spotify: { color: "#1db954", icon: "🎵", category: "Media" },
  obs64: { color: "#302e2b", icon: "🎥", category: "Media" },
};

const PALETTE = [
  "#6366f1",
  "#22d3ee",
  "#a78bfa",
  "#f97316",
  "#34d399",
  "#ef4444",
  "#ec4899",
  "#eab308",
];

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function getAppVisualMeta(appId: string, appName: string) {
  const known = APP_META[appId] ?? APP_META[appId.toLowerCase()];
  if (known) {
    return known;
  }
  const color = PALETTE[hashString(appName) % PALETTE.length];
  return {
    color,
    icon: "📦",
    category: "Others",
  };
}

function minuteOfDay(tsMs: number) {
  const date = new Date(tsMs);
  return date.getHours() * 60 + date.getMinutes();
}

export function toTimelineBlocks(sessions: AppUsageSessionDto[]): TimelineBlock[] {
  return sessions
    .map((session) => {
      const meta = getAppVisualMeta(session.appId, session.appName);
      const startMin = minuteOfDay(session.startedAtMs);
      const endMin = Math.max(startMin + 1, minuteOfDay(session.endedAtMs));

      return {
        id: `session-${session.id}`,
        app: session.appName,
        title: session.title || session.appName,
        startMin: Math.max(DAY_START_MIN, Math.min(startMin, DAY_END_MIN)),
        endMin: Math.max(
          Math.max(DAY_START_MIN, Math.min(startMin + 1, DAY_END_MIN)),
          Math.max(DAY_START_MIN, Math.min(endMin, DAY_END_MIN)),
        ),
        color: meta.color,
        icon: meta.icon,
        category: meta.category,
        keystrokes: 0,
        clicks: 0,
        downloadMB: 0,
        uploadMB: 0,
      };
    })
    .filter((block) => block.endMin > block.startMin)
    .sort((a, b) => a.startMin - b.startMin);
}

export function toSunburstApps(apps: AppUsageSummaryDto[]): AppEntry[] {
  return apps.map((app) => {
    const meta = getAppVisualMeta(app.appId, app.appName);
    return {
      id: app.appId,
      name: app.appName,
      color: meta.color,
      minutes: Math.max(1, Math.round(app.totalDurationMs / 60000)),
    };
  });
}
