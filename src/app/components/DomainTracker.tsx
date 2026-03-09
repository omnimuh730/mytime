import { useCallback } from "react";
import { Globe, ExternalLink } from "lucide-react";
import { useInfiniteScroll } from "./ui/useInfiniteScroll";
import { DomainSkeletonRow } from "./ui/SkeletonRows";

interface DomainEntry {
  domain: string;
  requests: number;
  bandwidth: string;
  category: string;
  color: string;
  percentage: number;
}

const COLORS = [
  "#6366f1", "#22d3ee", "#f97316", "#a78bfa", "#34d399",
  "#f43f5e", "#eab308", "#06b6d4", "#ec4899", "#10b981",
  "#8b5cf6", "#14b8a6", "#f59e0b", "#3b82f6", "#ef4444",
];

const CATEGORIES = [
  "Development", "API Services", "Reference", "Design", "Communication",
  "Package Registry", "Hosting", "CDN", "Analytics", "Cloud Storage",
  "Social Media", "Documentation", "CI/CD", "Monitoring", "Security",
];

const DOMAINS_POOL = [
  "github.com", "googleapis.com", "stackoverflow.com", "figma.com",
  "slack.com", "npmjs.com", "vercel.com", "cdn.jsdelivr.net",
  "aws.amazon.com", "docker.io", "gitlab.com", "medium.com",
  "notion.so", "linear.app", "sentry.io", "datadog.com",
  "cloudflare.com", "netlify.com", "heroku.com", "digitalocean.com",
  "twilio.com", "stripe.com", "auth0.com", "supabase.co",
  "planetscale.com", "prisma.io", "tailwindcss.com", "react.dev",
  "typescriptlang.org", "developer.mozilla.org", "caniuse.com",
  "bundlephobia.com", "unpkg.com", "esm.sh", "jsfiddle.net",
  "codepen.io", "replit.com", "codesandbox.io", "stackblitz.com",
  "railway.app", "fly.io", "render.com", "deno.land",
];

const initialDomains: DomainEntry[] = [
  { domain: "github.com", requests: 2847, bandwidth: "1.2 GB", category: "Development", color: "#6366f1", percentage: 85 },
  { domain: "googleapis.com", requests: 2156, bandwidth: "890 MB", category: "API Services", color: "#22d3ee", percentage: 72 },
  { domain: "stackoverflow.com", requests: 1543, bandwidth: "650 MB", category: "Reference", color: "#f97316", percentage: 58 },
  { domain: "figma.com", requests: 1230, bandwidth: "520 MB", category: "Design", color: "#a78bfa", percentage: 48 },
  { domain: "slack.com", requests: 987, bandwidth: "380 MB", category: "Communication", color: "#34d399", percentage: 35 },
  { domain: "npmjs.com", requests: 756, bandwidth: "290 MB", category: "Package Registry", color: "#f43f5e", percentage: 28 },
  { domain: "vercel.com", requests: 543, bandwidth: "180 MB", category: "Hosting", color: "#eab308", percentage: 20 },
  { domain: "cdn.jsdelivr.net", requests: 421, bandwidth: "150 MB", category: "CDN", color: "#06b6d4", percentage: 15 },
];

function generateDomains(existingCount: number): DomainEntry[] {
  const batch: DomainEntry[] = [];
  for (let i = 0; i < 8; i++) {
    const idx = existingCount + i;
    const domainIdx = idx % DOMAINS_POOL.length;
    const requests = Math.max(50, Math.round(2800 / (idx + 1) + Math.random() * 200));
    const mbRaw = requests * (0.2 + Math.random() * 0.3);
    const bandwidth = mbRaw >= 1000 ? `${(mbRaw / 1000).toFixed(1)} GB` : `${Math.round(mbRaw)} MB`;
    batch.push({
      domain: idx < DOMAINS_POOL.length ? DOMAINS_POOL[domainIdx] : `service-${idx}.example.com`,
      requests,
      bandwidth,
      category: CATEGORIES[idx % CATEGORIES.length],
      color: COLORS[idx % COLORS.length],
      percentage: Math.max(5, Math.round(85 / (idx * 0.3 + 1))),
    });
  }
  return batch;
}

export function DomainTracker() {
  const generateMore = useCallback(
    (count: number) => generateDomains(count),
    []
  );

  const { items, isLoading, scrollRef } = useInfiniteScroll(
    initialDomains,
    generateMore,
    { initialCount: 8, batchSize: 6 }
  );

  return (
    <div className="bg-card rounded-2xl border border-border p-4 sm:p-6 flex flex-col">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-foreground">Domain Tracking</h3>
          <p className="text-muted-foreground text-xs mt-1">
            Top domains by request volume
          </p>
        </div>
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {items.length} domains loaded
        </span>
      </div>
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto space-y-3 max-h-[320px] overscroll-y-contain"
      >
        {items.map((item, idx) => (
          <div
            key={`${item.domain}-${idx}`}
            className="group flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/50 transition-all duration-200 cursor-pointer"
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${item.color}15` }}
            >
              <Globe className="w-4 h-4" style={{ color: item.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-foreground truncate">
                    {item.domain}
                  </span>
                  <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <span className="text-xs text-muted-foreground">
                  {item.requests.toLocaleString()} req
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${item.percentage}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
                <span className="text-xs text-muted-foreground w-16 text-right">
                  {item.bandwidth}
                </span>
              </div>
            </div>
          </div>
        ))}

        {/* Skeleton loading rows */}
        {isLoading && (
          <>
            {Array.from({ length: 3 }).map((_, i) => (
              <DomainSkeletonRow key={`skel-${i}`} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}