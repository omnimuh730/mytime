import { useState, useEffect } from "react";
import {
  Mouse,
  Keyboard,
  MonitorSmartphone,
  Clock,
} from "lucide-react";

interface ActivityEvent {
  id: number;
  type: "mouse" | "keyboard" | "idle" | "active";
  description: string;
  timestamp: string;
  detail?: string;
}

const initialEvents: ActivityEvent[] = [
  {
    id: 1,
    type: "mouse",
    description: "Mouse movement detected",
    timestamp: "15:42:38",
    detail: "Position: (1284, 567)",
  },
  {
    id: 2,
    type: "keyboard",
    description: "Keyboard activity",
    timestamp: "15:42:35",
    detail: "45 keystrokes/min",
  },
  {
    id: 3,
    type: "active",
    description: "Window focused",
    timestamp: "15:42:30",
    detail: "VS Code - App.tsx",
  },
  {
    id: 4,
    type: "mouse",
    description: "Mouse click",
    timestamp: "15:42:22",
    detail: "Left click at (890, 234)",
  },
  {
    id: 5,
    type: "keyboard",
    description: "Keyboard shortcut",
    timestamp: "15:42:18",
    detail: "Ctrl+S (Save)",
  },
  {
    id: 6,
    type: "idle",
    description: "Idle period ended",
    timestamp: "15:42:10",
    detail: "Duration: 2m 15s",
  },
  {
    id: 7,
    type: "active",
    description: "Application switch",
    timestamp: "15:39:55",
    detail: "Chrome -> VS Code",
  },
  {
    id: 8,
    type: "mouse",
    description: "Scroll activity",
    timestamp: "15:39:48",
    detail: "Vertical scroll: 340px",
  },
];

const iconMap = {
  mouse: Mouse,
  keyboard: Keyboard,
  idle: Clock,
  active: MonitorSmartphone,
};

const colorMap = {
  mouse: { bg: "bg-primary/10", text: "text-primary" },
  keyboard: { bg: "bg-chart-2/10", text: "text-chart-2" },
  idle: { bg: "bg-yellow-500/10", text: "text-yellow-400" },
  active: { bg: "bg-emerald-500/10", text: "text-emerald-400" },
};

export function LiveActivityFeed() {
  const [events, setEvents] = useState(initialEvents);

  useEffect(() => {
    const types: Array<ActivityEvent["type"]> = [
      "mouse",
      "keyboard",
      "active",
      "mouse",
    ];
    const descriptions: Record<string, string[]> = {
      mouse: [
        "Mouse movement detected",
        "Mouse click",
        "Double click",
        "Scroll activity",
      ],
      keyboard: [
        "Keyboard activity",
        "Keyboard shortcut",
        "Text input",
        "Key combination",
      ],
      active: [
        "Window focused",
        "Application switch",
        "Tab change",
        "Screen active",
      ],
    };

    const interval = setInterval(() => {
      const type = types[Math.floor(Math.random() * types.length)];
      const descs = descriptions[type] || descriptions.mouse;
      const desc = descs[Math.floor(Math.random() * descs.length)];
      const now = new Date();
      const timestamp = `${now.getHours().toString().padStart(2, "0")}:${now
        .getMinutes()
        .toString()
        .padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;

      const newEvent: ActivityEvent = {
        id: Date.now(),
        type,
        description: desc,
        timestamp,
        detail:
          type === "mouse"
            ? `Position: (${Math.round(Math.random() * 1920)}, ${Math.round(
                Math.random() * 1080
              )})`
            : type === "keyboard"
            ? `${Math.round(30 + Math.random() * 60)} keystrokes/min`
            : "Active session",
      };

      setEvents((prev) => [newEvent, ...prev.slice(0, 7)]);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-card rounded-2xl border border-border p-4 sm:p-6 flex flex-col h-full">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-foreground">Live Activity Feed</h3>
          <p className="text-muted-foreground text-xs mt-1">
            Real-time input events
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-emerald-400">Live</span>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-1 overscroll-y-contain">
        {events.map((event, index) => {
          const Icon = iconMap[event.type];
          const colors = colorMap[event.type];
          return (
            <div
              key={event.id}
              className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-secondary/50 transition-all duration-200"
              style={{
                opacity: 1 - index * 0.08,
              }}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${colors.bg}`}
              >
                <Icon className={`w-3.5 h-3.5 ${colors.text}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-foreground truncate">
                  {event.description}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {event.detail}
                </p>
              </div>
              <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                {event.timestamp}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}