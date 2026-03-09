/**
 * Reusable skeleton loading rows for infinite scroll lists.
 * Each variant matches the row layout of its parent component.
 */

export function SkeletonPulse({ className = "" }: { className?: string }) {
  return (
    <div
      className={`bg-muted-foreground/10 rounded animate-pulse ${className}`}
    />
  );
}

/** Domain Tracker skeleton row */
export function DomainSkeletonRow() {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl">
      <SkeletonPulse className="w-8 h-8 rounded-lg shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <SkeletonPulse className="h-3.5 w-32" />
          <SkeletonPulse className="h-3 w-16" />
        </div>
        <div className="flex items-center gap-3">
          <SkeletonPulse className="flex-1 h-1.5 rounded-full" />
          <SkeletonPulse className="h-3 w-14" />
        </div>
      </div>
    </div>
  );
}

/** Bandwidth Splitter skeleton row */
export function BandwidthSkeletonRow() {
  return (
    <div>
      <div className="grid grid-cols-[1fr_90px_90px_90px_80px] gap-2 px-4 py-3 border-b border-border/40 items-center">
        <div className="flex items-center gap-2.5">
          <SkeletonPulse className="w-6 h-6 rounded shrink-0" />
          <div className="flex-1 min-w-0">
            <SkeletonPulse className="h-3 w-24 mb-1.5" />
            <SkeletonPulse className="h-2.5 w-40" />
          </div>
        </div>
        <SkeletonPulse className="h-3 w-14" />
        <SkeletonPulse className="h-3 w-12" />
        <SkeletonPulse className="h-3 w-14" />
        <div className="flex justify-end">
          <SkeletonPulse className="h-5 w-14 rounded" />
        </div>
      </div>
      <div className="flex px-4 py-1.5 bg-secondary/30 border-b border-border/40 items-center gap-6">
        <SkeletonPulse className="h-2.5 w-24" />
        <SkeletonPulse className="h-2.5 w-28" />
        <SkeletonPulse className="h-2.5 w-28" />
      </div>
    </div>
  );
}

/** Live Packet Matrix skeleton row */
export function PacketSkeletonRow() {
  return (
    <div className="grid grid-cols-[180px_70px_90px_90px_100px_1fr_60px_50px] gap-2 px-5 py-2 border-b border-border/30 items-center">
      <div className="flex items-center gap-2">
        <SkeletonPulse className="w-5 h-5 rounded shrink-0" />
        <div>
          <SkeletonPulse className="h-3 w-20 mb-1" />
          <SkeletonPulse className="h-2 w-16" />
        </div>
      </div>
      <SkeletonPulse className="h-5 w-12 rounded" />
      <SkeletonPulse className="h-3 w-16" />
      <SkeletonPulse className="h-3 w-14" />
      <SkeletonPulse className="h-2.5 w-24" />
      <div className="flex items-center gap-2">
        <SkeletonPulse className="flex-1 h-1.5 rounded-full" />
        <SkeletonPulse className="h-2.5 w-10" />
      </div>
      <SkeletonPulse className="h-2.5 w-10 ml-auto" />
      <div className="flex justify-end">
        <SkeletonPulse className="w-2 h-2 rounded-full" />
      </div>
    </div>
  );
}

/** App Usage List skeleton row */
export function AppUsageSkeletonRow() {
  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-3 px-4 py-2.5 border-b border-border/50 items-center">
      <div className="flex items-center gap-2">
        <SkeletonPulse className="w-4 h-4 rounded shrink-0" />
        <SkeletonPulse className="h-3 w-36" />
      </div>
      <div className="flex items-center gap-1.5 w-24">
        <SkeletonPulse className="w-2 h-2 rounded-sm shrink-0" />
        <SkeletonPulse className="h-2.5 w-16" />
      </div>
      <SkeletonPulse className="h-2.5 w-12" />
      <SkeletonPulse className="h-2.5 w-12" />
      <SkeletonPulse className="h-2.5 w-10 ml-auto" />
    </div>
  );
}

/** App Summary skeleton row (right panel) */
export function AppSummarySkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border/50">
      <SkeletonPulse className="w-5 h-5 rounded shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <SkeletonPulse className="h-3 w-20" />
          <SkeletonPulse className="h-3 w-12" />
        </div>
        <div className="flex items-center gap-2">
          <SkeletonPulse className="flex-1 h-1.5 rounded-full" />
          <SkeletonPulse className="h-2.5 w-8" />
        </div>
      </div>
    </div>
  );
}
