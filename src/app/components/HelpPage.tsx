import { useState } from "react";
import {
  Copy,
  Check,
  LayoutDashboard,
  Activity,
  Wifi,
  ChevronDown,
  ChevronRight,
  HelpCircle,
} from "lucide-react";

interface HelpSection {
  id: string;
  view: string;
  viewIcon: React.ReactNode;
  cards: { title: string; description: string }[];
}

const helpData: HelpSection[] = [
  {
    id: "dashboard",
    view: "Dashboard",
    viewIcon: <LayoutDashboard className="w-4 h-4" />,
    cards: [
      {
        title: "Live Pulse Strip",
        description:
          "A real-time horizontal strip that visualizes system activity as a continuous pulse wave. It provides an at-a-glance heartbeat of your overall productivity, showing spikes during active periods and flat lines during idle time. The strip auto-scrolls to always display the most recent data.",
      },
      {
        title: "Stat Cards (Top Row)",
        description:
          "Four summary cards displaying key daily metrics: **Active Time Today** (total hours of detected activity), **Mouse Events** (cumulative clicks and movements), **Keystrokes** (total key presses), and **Network Traffic** (combined download + upload volume). Each card shows a percentage change compared to the previous day with a trend arrow indicator.",
      },
      {
        title: "Hardware & Focus Correlator",
        description:
          "A full-width analytical widget with two switchable views — **Scatter** and **Rhythm** — that cross-references typing speed (APM) with application context-switching frequency to map your biological productivity curve throughout the day.\n\n- **Scatter View**: Plots 15-minute blocks as dots on a time × APM grid, color-coded by productivity zone (Peak Flow, Good Focus, Normal, Low Energy). Includes reference areas highlighting morning and afternoon peak windows, zone threshold lines, and an average APM reference line.\n- **Rhythm View**: A composed hourly chart overlaying APM bars (color-coded by zone), a focus score area line, and an app-switches dashed line on a dual Y-axis.\n\nFour zone distribution cards at the top summarize the percentage of time, average APM, and switch rate for each productivity tier. An insight banner surfaces key findings like peak APM, best/worst hours, and total sampled blocks.",
      },
      {
        title: "Activity Timeline (Dashboard)",
        description:
          "A stacked bar chart showing **active vs. inactive time** over a selectable date range using the **PremiumDateRangePicker**. Each bar represents either a day (showing hours out of 24) or an hour (showing minutes out of 60) depending on the range length. Active bars are color-coded by intensity: green for high activity, indigo for moderate, yellow for low, and red for minimal. Inactive time is shown as a faint red overlay stacking to the full 24h/60m. A dashed average reference line and a rich tooltip with activity rate percentage provide context.\n\nFor single-day views, the chart switches to hourly granularity (minutes per hour). For ranges over 31 days, data aggregates into weekly averages.",
      },
      {
        title: "Network Usage Chart",
        description:
          "Displays download and upload bandwidth usage over time as stacked or overlaid area/bar charts with a selectable date range via the **PremiumDateRangePicker**. Helps identify periods of heavy network usage and whether traffic is predominantly inbound or outbound. Adapts to hourly, daily, or weekly granularity based on the selected range.",
      },
      {
        title: "Network Aliveness",
        description:
          "A real-time connection monitoring panel showing current latency, uptime percentage, and average ping. Features a live ping history bar chart (last 60 samples) with color-coded bars: green for normal latency, yellow for elevated, and orange for spikes. Also displays connection details including type, DNS server, gateway, and IP address.",
      },
      {
        title: "Input Monitor",
        description:
          "An animated SVG visualization of keyboard and mouse hardware. The keyboard displays a full ANSI layout with keys that glow indigo when pressed — an **Other** key represents unmapped/special keys. The mouse shows left/right click zones with press animations, and a scroll wheel that lights up cyan with directional arrows for scroll up/down events. A mini event log at the bottom shows the 4 most recent input actions.",
      },
    ],
  },
  {
    id: "activity",
    view: "Activity Tracker",
    viewIcon: <Activity className="w-4 h-4" />,
    cards: [
      {
        title: "Stat Cards (Activity)",
        description:
          "Four summary cards: **Total Active Time** (cumulative detected activity), **Mouse Clicks** (click count with trend), **Keystrokes/Min** (typing speed metric), and **Idle Periods** (number of detected idle gaps). Each includes a change indicator showing improvement or decline.",
      },
      {
        title: "Multi-Track Timeline Editor",
        description:
          "A ManicTime-style multi-track timeline editor that visualizes your day across multiple synchronized tracks:\n\n- **Activity Status Track**: Color-coded bars showing active (green), inactive (red), and shutdown (dark gray) periods.\n- **App Usage Track**: Horizontal bars representing which applications were in focus and for how long.\n\nFeatures a minimap navigator at the bottom with a draggable viewing window instead of a traditional scrollbar. Zoom is controlled via mouse scroll wheel (no zoom buttons), capped at 1x minimum for a full 7AM–9PM day view. The toolbar includes track visibility toggles and a zoom level indicator. Scroll isolation prevents page scrolling when zooming inside the timeline.",
      },
      {
        title: "App Usage Breakdown (Sunburst Chart)",
        description:
          "A hierarchical sunburst visualization showing application usage organized by category. The inner ring displays categories (e.g., Development, Communication, Browsing) and the outer ring breaks down into specific applications (e.g., VS Code, Slack, Chrome). Click on segments to drill down into subcategories. Uses real application names for authentic representation.\n\nIncludes a **Category Manager Modal** (accessible via a gear icon) that provides:\n- A spring-animated modal for viewing and reassigning apps between categories\n- Adding, editing, and deleting categories with color pickers\n- A non-removable **Others** default category that catches unassigned apps\n- Uses the custom **PremiumSelect** dropdown component with portal-based rendering to escape parent `overflow-hidden` containers",
      },
      {
        title: "Live Activity Feed",
        description:
          "A scrolling real-time feed of input events including mouse movements, clicks, keyboard activity, shortcuts, window focus changes, and application switches. Each event is timestamped and color-coded by type. Events fade in opacity as they age, keeping the most recent events prominent. Supports infinite scroll with skeleton loading via the shared **useInfiniteScroll** hook and **SkeletonRows** component.",
      },
      {
        title: "Activity Timeline (Activity Page)",
        description:
          "The same active vs. inactive stacked bar chart as on the Dashboard, with its own independent date range selection. Placed in a stretch-matched row alongside the Activity Heatmap for comparative analysis.",
      },
      {
        title: "Activity Heatmap",
        description:
          "A 7-day × 24-hour grid heatmap where each cell represents activity intensity for a given hour on a given day. Darker/cooler colors indicate low activity while brighter/warmer colors indicate high activity. Provides a weekly pattern overview to identify consistent productive hours, lunch breaks, and after-hours patterns. Height-matched with the Activity Timeline via `items-stretch`.",
      },
    ],
  },
  {
    id: "network",
    view: "Network Analysis",
    viewIcon: <Wifi className="w-4 h-4" />,
    cards: [
      {
        title: "Overview Stat Cards (Row 1)",
        description:
          "Four top-level network metrics: **Download Today** (total inbound data), **Upload Today** (total outbound data), **Active Connections** (current open connections), and **Unique Domains** (distinct domains contacted). All include trend indicators.",
      },
      {
        title: "Overview Stat Cards (Row 2)",
        description:
          "Four performance metrics: **Download Speed** (current throughput), **Upload Speed** (current outbound rate), **Avg Latency** (mean response time across regions), and **Packet Loss** (percentage of dropped packets over 24 hours).",
      },
      {
        title: "Traffic & Usage Section",
        description:
          "Contains the **Network Usage Chart** (bandwidth over time with PremiumDateRangePicker) and **Network Aliveness** (connection health monitor) side by side, providing a comprehensive view of both traffic volume and connection reliability.",
      },
      {
        title: "Data Velocity Heatmap",
        description:
          "A calendar-style heatmap showing daily network data volume over the past month. Each cell is color-coded by the amount of data transferred that day, making it easy to spot heavy-usage days, patterns, and anomalies at a glance.",
      },
      {
        title: "Network Quota Burndown",
        description:
          "A burndown chart tracking cumulative data usage against a monthly quota/budget. Shows the ideal burn rate as a straight line and actual usage as a curve. Helps predict whether you'll exceed your data cap before the billing period ends.",
      },
      {
        title: "Bandwidth Splitter",
        description:
          "Breaks down network bandwidth by process, separating foreground application traffic from background/system traffic. Each entry shows the process name, connection count, peak speed, and average speed — detail rows (Connections, Peak, Avg) are always visible, not hover-only. Useful for identifying bandwidth hogs and unexpected background network activity.",
      },
      {
        title: "Domain Analytics (Side-by-Side Left)",
        description:
          "A dedicated section with 4 stat cards (**Total Domains**, **Total Requests**, **Domain Bandwidth**, **Blocked Domains**) and a scrollable **Domain Tracker** list. The tracker shows top contacted domains ranked by request count and data volume, with a scrollable list (`max-h-[320px]`) that prevents it from stretching the layout beyond the adjacent Speed & Performance column.",
      },
      {
        title: "Speed & Performance (Side-by-Side Right)",
        description:
          "A dedicated section with 4 stat cards (**Download Speed**, **Upload Speed**, **Ping**, **Jitter**) and a **Speed Gauge** dial visualization. The gauge displays current download/upload speeds as animated dials with historical test results. Both columns use `items-stretch` so they always match height.",
      },
      {
        title: "Live Packet Matrix",
        description:
          "A real-time grid visualization of network packets flowing through the system. Each cell represents a packet, color-coded by protocol or type. The matrix updates continuously to show current network activity at a granular, forensic level — useful for debugging and traffic pattern analysis.",
      },
    ],
  },
  {
    id: "ui-design",
    view: "UI & Design System",
    viewIcon: <HelpCircle className="w-4 h-4" />,
    cards: [
      {
        title: "Dark / Light Theme Toggle",
        description:
          "A theme toggle button in the top header bar switches between dark and light modes. The toggle uses CSS custom properties defined in `/src/styles/theme.css` and applies globally via a `data-theme` attribute. Animated with Motion spring transitions and icon rotation (Sun/Moon icons).",
      },
      {
        title: "Sidebar Navigation",
        description:
          "An animated sidebar with 4 navigable views: **Dashboard**, **Activity Tracker**, **Network Analysis**, and **Help & Documentation**. Features micro-animations on hover and selection including scale springs, glow effects, and sliding active indicators. On mobile (`<lg`), the sidebar collapses into a fixed bottom navigation bar with compact icons.",
      },
      {
        title: "Glass-Effect Top Bar",
        description:
          "A frosted-glass header bar with `backdrop-blur-sm` and semi-transparent background. Displays the current page icon (with spring entry/exit animations), page title, subtitle, live status chips (connection status, uptime, last sync), and the theme toggle. Status chips wrap gracefully on smaller screens.",
      },
      {
        title: "PremiumDateRangePicker",
        description:
          "A custom date range picker component replacing native `<input type=\"date\">` elements in the Activity Timeline and Network Usage Chart. Features a portal-rendered dropdown (`createPortal` to `document.body`) with `fixed` positioning and `z-[9999]` to escape any parent `overflow-hidden` containers. Includes:\n\n- A trigger button showing the selected range with day count badge\n- A calendar panel with 40×40px day cells, month navigation, and today highlighting\n- Range selection with visual start/end/in-range styling\n- Quick-select presets (Today, Last 7/14/30/90 days, This Month, This Year)\n- Repositions dynamically on scroll and resize events",
      },
      {
        title: "PremiumSelect",
        description:
          "A custom select dropdown component used in the Category Manager Modal, replacing native `<select>` elements. Renders its dropdown via `createPortal` to `document.body` with `fixed` positioning to escape parent `overflow-hidden` containers. Features smooth open/close animations, search filtering, and keyboard navigation.",
      },
      {
        title: "Infinite Scroll & Skeleton Loading",
        description:
          "A shared **useInfiniteScroll** hook and **SkeletonRows** component in `/src/app/components/ui/` provide consistent infinite-scroll behavior with skeleton placeholder rows during loading. Used across scrollable lists like the Live Activity Feed and Domain Tracker.",
      },
      {
        title: "Responsive Design",
        description:
          "Full responsiveness pass across all views. The sidebar collapses to a bottom nav on mobile (`<lg`). App.tsx grids use responsive breakpoints (`grid-cols-1 lg:grid-cols-2`, etc.). Components use responsive padding (`p-4 sm:p-6`), wrapping headers (`flex-col sm:flex-row`), and horizontal scroll wrappers for dense content. A key CSS Grid fix pattern adds `min-w-0` on grid children to prevent Recharts `ResponsiveContainer` from expanding beyond `1fr` tracks.",
      },
    ],
  },
];

function generateMarkdown(): string {
  let md = "# Activity Tracker & Network Monitor — Help Guide\n\n";
  md +=
    "A comprehensive reference for all views, cards, widgets, and UI components in the application.\n\n";
  md += "---\n\n";

  for (const section of helpData) {
    md += `## ${section.view}\n\n`;
    for (const card of section.cards) {
      md += `### ${card.title}\n\n`;
      md += `${card.description}\n\n`;
    }
    md += "---\n\n";
  }

  md += `*Generated on ${new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })}*\n`;

  return md;
}

export function HelpPage() {
  const [copied, setCopied] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(helpData.map((s) => s.id))
  );

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCopyAll = async () => {
    const md = generateMarkdown();
    try {
      await navigator.clipboard.writeText(md);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = md;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-foreground text-xl">Help & Documentation</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Complete reference for all views, cards, widgets, and UI components
            in this application.
          </p>
        </div>
        <button
          onClick={handleCopyAll}
          className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-sm transition-all duration-200 shrink-0 cursor-pointer ${
            copied
              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
              : "bg-secondary hover:bg-secondary/80 text-foreground border border-border"
          }`}
        >
          {copied ? (
            <>
              <Check className="w-4 h-4" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              Copy All as Markdown
            </>
          )}
        </button>
      </div>

      {/* Sections */}
      {helpData.map((section) => {
        const isExpanded = expandedSections.has(section.id);
        return (
          <div
            key={section.id}
            className="bg-card rounded-2xl border border-border overflow-hidden"
          >
            {/* Section header */}
            <button
              onClick={() => toggleSection(section.id)}
              className="w-full flex items-center gap-3 p-4 sm:p-5 hover:bg-secondary/30 transition-colors cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                {section.viewIcon}
              </div>
              <div className="flex-1 text-left">
                <h3 className="text-foreground">{section.view}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {section.cards.length} components
                </p>
              </div>
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
            </button>

            {/* Cards list */}
            {isExpanded && (
              <div className="border-t border-border">
                {section.cards.map((card, idx) => (
                  <div
                    key={card.title}
                    className={`px-4 sm:px-5 py-3 sm:py-4 ${
                      idx < section.cards.length - 1
                        ? "border-b border-border/50"
                        : ""
                    }`}
                  >
                    <h4 className="text-foreground text-sm mb-2 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-md bg-secondary text-muted-foreground flex items-center justify-center text-[10px] shrink-0">
                        {idx + 1}
                      </span>
                      {card.title}
                    </h4>
                    <p className="text-muted-foreground text-xs leading-relaxed pl-7 whitespace-pre-line">
                      {card.description.split(/(\*\*[^*]+\*\*)/).map((part, i) => {
                        if (part.startsWith("**") && part.endsWith("**")) {
                          return (
                            <span key={i} className="text-foreground">
                              {part.slice(2, -2)}
                            </span>
                          );
                        }
                        return part;
                      })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Footer note */}
      <div className="text-center py-4">
        <p className="text-xs text-muted-foreground">
          All data shown in this application is simulated/mock data with no
          backend connection. The app features full dark/light theme support and responsive design across all breakpoints.
        </p>
      </div>
    </div>
  );
}
