# MyTime Full Implementation Plan

## 1. Goal

Turn the current project from a polished mock-data Tauri + React prototype into a fully functional desktop application that:

- captures real user activity on Windows,
- captures real network/process/domain telemetry on Windows,
- stores normalized historical data locally,
- exposes a clear Rust <-> React API through Tauri commands and events,
- powers the existing dashboard views with real data,
- remains privacy-conscious, performant, and resilient offline.

This plan assumes:

- the React frontend stays the primary UI,
- Rust in `src-tauri` becomes the runtime/service layer,
- the first real implementation target is Windows,
- data remains local-first,
- mock components are incrementally migrated rather than rewritten all at once.

## 2. Current State

What exists today:

- React app with four major views: dashboard, activity, network, help.
- Many components already express the intended product UX well.
- Tauri app shell exists, but Rust side is still near-template level.
- Frontend currently uses generated/mock data.
- Frontend currently does not call Tauri `invoke()` or subscribe to backend events.

Implication:

- the product direction is already defined by the UI,
- the missing work is mostly systems engineering, data modeling, collector implementation, IPC, state orchestration, and replacing fake data source layers.

## 3. Product Scope To Implement

### Activity scope

- active/idle session tracking,
- global keyboard activity counts,
- global mouse activity counts,
- focused window/process/app timeline,
- app usage duration aggregation,
- per-time-bucket activity summaries,
- optional shortcut detection,
- optional keystrokes-per-minute approximation,
- optional URL/title capture rules with privacy controls.

### Network scope

- process-level connections,
- per-process traffic totals,
- domain resolution / hostname attribution,
- unique domains and request-like approximations,
- bandwidth over time,
- latency / aliveness checks,
- packet-loss style health metrics where feasible,
- quota/budget tracking,
- foreground vs background traffic split.

### Cross-cutting scope

- local persistence,
- historical queries,
- live updates,
- settings and permissions,
- privacy controls,
- startup / shutdown integrity,
- crash-safe ingestion pipeline.

## 4. Guiding Architecture

Use a layered architecture in Rust:

1. `collectors`
   Responsible for reading raw OS/network signals.

2. `pipeline`
   Converts raw events into normalized domain events.

3. `storage`
   Writes and reads from local database / files.

4. `services`
   High-level business logic for analytics and summaries.

5. `ipc`
   Tauri commands and event broadcasting.

6. `app_state`
   Shared runtime state, task handles, configuration, caches.

Use a layered architecture in React:

1. `tauri client`
   Thin wrappers around `invoke()` and event listeners.

2. `query/store layer`
   Handles live state, polling, subscriptions, caching.

3. `view models`
   Maps raw backend DTOs into chart-ready UI data.

4. `components`
   Existing views consume real data via hooks instead of generating mock data.

## 5. Delivery Strategy

Do not attempt full parity in one pass.

Implement in this order:

1. Define backend data model and API contracts.
2. Build storage and app state.
3. Build live activity collection.
4. Build focused-window/app timeline collection.
5. Replace activity page with real data.
6. Build live network collection.
7. Replace network page with real data.
8. Add historical rollups and summary analytics.
9. Harden performance, privacy, startup, and packaging.

This order matters because:

- the activity side is easier to complete first,
- it proves the Rust -> React integration pattern,
- the same storage/query pipeline can be reused for network telemetry.

## 6. Recommended Rust Crates

Validate before locking final dependencies, but likely candidates are:

- `tauri` for app shell and commands
- `tokio` for async runtime and background tasks
- `serde`, `serde_json` for DTOs
- `chrono` or `time` for timestamps
- `sqlx` or `rusqlite` for SQLite persistence
- `tracing`, `tracing-subscriber` for logging
- `sysinfo` for process metadata
- `windows` crate for Win32 APIs
- `uuid` for IDs
- `anyhow` / `thiserror` for error handling
- `parking_lot` or standard sync primitives for shared state
- `dirs` for app data paths
- `netstat2` or Windows IP Helper API bindings for network connections
- `dns-lookup` only if needed for fallback hostname resolution

Prefer SQLite over ad hoc JSON files for the main telemetry store.

## 7. Windows Data Collection Plan

### 7.1 Activity collection

Use native Windows APIs for:

- global keyboard/mouse hooks or raw input counts,
- idle detection,
- foreground window detection,
- process/window title extraction,
- session lock/unlock and shutdown awareness.

Likely Windows API areas:

- `SetWindowsHookEx` or raw input approach for input counting,
- `GetLastInputInfo` for idle time,
- `GetForegroundWindow`,
- `GetWindowTextW`,
- `GetWindowThreadProcessId`,
- process image path lookup APIs.

Important design choice:

- do not store raw keystrokes,
- store only counts, rates, and optional shortcut categories,
- keep privacy-safe defaults.

### 7.2 Network collection

Start with process connection and byte counters rather than true packet capture.

Sources can include:

- Windows IP Helper API,
- per-interface byte counters,
- process/network table snapshots,
- periodic diffing to infer rates.

First workable version should collect:

- active TCP/UDP connections,
- process owning each connection,
- remote IP/port,
- protocol,
- periodic aggregate download/upload estimation per process,
- hostname/domain enrichment cache.

Do not begin with deep packet inspection.

Reason:

- it raises complexity,
- increases permissions risk,
- increases privacy risk,
- is not necessary to make the current UI useful.

### 7.3 Domain attribution

Domain analytics is harder than app analytics.

Use a staged approach:

1. Map remote IPs to reverse DNS / cached hostname where possible.
2. Attribute connection hostnames over time to processes.
3. Aggregate "domain contact" counts by observed connection/session occurrences.
4. Later, if needed, add optional DNS event integration or packet capture for more precise host/request attribution.

## 8. Local Data Model

Use SQLite with migrations from day one.

Suggested logical tables:

- `app_sessions`
  - id
  - process_name
  - executable_path
  - window_title
  - started_at
  - ended_at
  - duration_ms
  - category

- `input_samples`
  - id
  - bucket_start
  - bucket_end
  - mouse_events
  - key_events
  - shortcut_events
  - active_ms
  - idle_ms

- `activity_state_changes`
  - id
  - timestamp
  - state (`active`, `idle`, `shutdown`, `locked`)

- `network_process_samples`
  - id
  - bucket_start
  - bucket_end
  - pid
  - process_name
  - bytes_sent
  - bytes_received
  - connections
  - foreground_bytes
  - background_bytes

- `network_connections`
  - id
  - observed_at
  - pid
  - protocol
  - local_addr
  - local_port
  - remote_addr
  - remote_port
  - hostname
  - state

- `network_health_samples`
  - id
  - observed_at
  - latency_ms
  - packet_loss_pct
  - online
  - interface_name

- `daily_rollups`
  - date
  - active_ms
  - idle_ms
  - key_events
  - mouse_events
  - bytes_sent
  - bytes_received
  - unique_domains
  - unique_apps

- `settings`
  - key
  - value_json

- `domain_cache`
  - ip
  - hostname
  - last_resolved_at

## 9. Backend Module Breakdown

Suggested Rust folder layout:

```text
src-tauri/src/
  main.rs
  lib.rs
  app_state.rs
  config/
    mod.rs
  db/
    mod.rs
    migrations.rs
    repository_activity.rs
    repository_network.rs
    repository_settings.rs
  collectors/
    mod.rs
    activity/
      mod.rs
      input.rs
      idle.rs
      foreground_window.rs
      session.rs
    network/
      mod.rs
      connections.rs
      throughput.rs
      dns.rs
      health.rs
  services/
    mod.rs
    activity_service.rs
    network_service.rs
    analytics_service.rs
    settings_service.rs
  ipc/
    mod.rs
    commands_activity.rs
    commands_network.rs
    commands_settings.rs
    events.rs
  models/
    mod.rs
    dto.rs
    domain.rs
  platform/
    mod.rs
    windows.rs
```

## 10. Tauri API Contract Plan

Split IPC into two categories:

- request/response commands for initial and historical data,
- event streams for live updates.

### 10.1 Commands to implement

Activity commands:

- `get_app_status()`
- `get_dashboard_summary(range)`
- `get_activity_timeline(range, granularity?)`
- `get_live_activity_feed(limit, cursor?)`
- `get_app_usage_breakdown(range)`
- `get_activity_heatmap(range)`
- `get_focus_correlation(range)`
- `get_timeline_editor_day(date)`

Network commands:

- `get_network_summary(range)`
- `get_network_usage(range, granularity?)`
- `get_network_health(range)`
- `get_domain_stats(range, cursor?)`
- `get_bandwidth_split(range, filter?, sort?)`
- `get_live_packet_matrix(limit, cursor?)`
- `get_network_quota_status()`
- `get_network_velocity_heatmap(range)`

Settings/system commands:

- `get_settings()`
- `update_settings(patch)`
- `get_capabilities_status()`
- `start_collectors()`
- `stop_collectors()`
- `reset_demo_data()` only for development

### 10.2 Events to implement

- `activity://summary-updated`
- `activity://live-event`
- `activity://timeline-updated`
- `network://summary-updated`
- `network://live-process-update`
- `network://health-updated`
- `system://collector-status`
- `system://error`

### 10.3 Contract rules

- all commands return typed DTOs,
- timestamps should be ISO8601 UTC or epoch ms consistently,
- avoid returning raw DB rows directly,
- keep chart-oriented responses explicit,
- include pagination cursors for large lists,
- include `source` / `confidence` fields for network-domain attribution where needed.

## 11. React Integration Plan

Create a dedicated frontend API layer rather than sprinkling `invoke()` throughout components.

Suggested layout:

```text
src/app/
  api/
    tauri.ts
    activity.ts
    network.ts
    settings.ts
  hooks/
    useDashboardSummary.ts
    useActivityTimeline.ts
    useLiveActivityFeed.ts
    useAppUsageBreakdown.ts
    useNetworkSummary.ts
    useNetworkUsage.ts
    useDomainStats.ts
    useLivePacketMatrix.ts
    useCollectorStatus.ts
  types/
    backend.ts
  stores/
    appStore.ts
```

### React implementation rules

- existing UI components should stop generating their own data,
- each component should depend on hooks/selectors,
- live views should subscribe to Tauri events,
- historical views should fetch on mount and on filter/date changes,
- loading/error/empty states should be standardized.

## 12. Detailed Execution Phases

## Phase 0: Planning and contracts

### Step 0.1

Audit every existing component and map each mock field to a real backend field.

Deliverable:

- a component-to-data-contract matrix.

### Step 0.2

Define canonical domain types:

- activity sample,
- app session,
- live activity event,
- network process sample,
- connection sample,
- domain aggregate,
- health sample,
- dashboard summary.

Deliverable:

- Rust domain structs,
- frontend TypeScript interfaces,
- documented serialization format.

### Step 0.3

Choose persistence stack.

Recommendation:

- SQLite with migrations,
- SQLx if async SQL ergonomics matter,
- or `rusqlite` if simpler synchronous access is preferred.

Deliverable:

- final database tech decision,
- migration approach,
- schema v1.

## Phase 1: Core Rust foundation

### Step 1.1

Set up structured logging and app directories.

Implement:

- app data dir,
- logs dir,
- db path,
- config file path,
- tracing subscriber initialization.

### Step 1.2

Create `AppState`.

Include:

- DB pool/connection,
- collector task handles,
- in-memory caches,
- event broadcaster handles,
- settings snapshot.

### Step 1.3

Add DB bootstrap and migrations on startup.

Startup behavior:

- open/create DB,
- run migrations,
- validate settings schema,
- initialize services,
- then start collectors.

## Phase 2: Activity collector MVP

### Step 2.1

Implement idle detection service.

Behavior:

- sample `GetLastInputInfo`,
- mark transitions between `active` and `idle`,
- emit state change events,
- persist state transitions.

### Step 2.2

Implement input counting service.

Behavior:

- record counts of keyboard and mouse activity in time buckets,
- aggregate every N seconds,
- persist summarized buckets,
- avoid storing key contents.

Recommended initial bucket:

- 5-second or 10-second live bucket,
- 1-minute persisted aggregate.

### Step 2.3

Implement foreground window tracker.

Behavior:

- poll current foreground window every 500ms to 1s,
- detect app/window changes,
- resolve process metadata,
- start/end app sessions,
- persist app usage segments.

### Step 2.4

Implement session lifecycle tracker.

Track:

- app launch/exit if feasible,
- lock/unlock,
- suspend/resume,
- shutdown boundaries.

### Step 2.5

Implement activity service queries.

Return:

- daily summary,
- timeline bars,
- activity heatmap,
- live feed records,
- app usage totals.

## Phase 3: React activity integration

### Step 3.1

Create `src/app/api/activity.ts`.

Implement typed wrappers for all activity commands and subscriptions.

### Step 3.2

Create hooks:

- `useDashboardSummary`
- `useActivityTimeline`
- `useLiveActivityFeed`
- `useAppUsageBreakdown`
- `useActivityHeatmap`
- `useFocusCorrelation`
- `useTimelineEditorData`

### Step 3.3

Replace these components first:

- `StatCard` consumers in activity/dashboard pages,
- `ActivityTimeline`,
- `LiveActivityFeed`,
- `SunburstChart`,
- `ActivityHeatmap`,
- `TimelineEditor`.

### Step 3.4

Add fallback states.

UI states needed:

- collecting disabled,
- insufficient permissions,
- no data yet,
- loading history,
- live collector disconnected.

## Phase 4: Network collector MVP

### Step 4.1

Implement interface health sampler.

Collect:

- current online/offline,
- ping/latency to stable targets,
- rolling average,
- uptime percentage over local measurement window.

Store samples every fixed interval.

### Step 4.2

Implement connection snapshot collector.

Collect:

- PID,
- process name,
- protocol,
- local/remote endpoint,
- connection state,
- observation time.

### Step 4.3

Implement throughput estimator.

Collect:

- bytes sent/received by process if obtainable,
- else infer via per-connection/per-interface diffing.

Important note:

process-level byte precision may require iteration and platform-specific compromises.

Plan for v1:

- accurate-enough sampled process throughput,
- clearly annotate confidence/approximation internally.

### Step 4.4

Implement foreground/background attribution.

Logic:

- compare connection/process activity against current foreground app,
- mark bytes as foreground if process is active/foreground,
- otherwise background.

### Step 4.5

Implement hostname/domain enrichment cache.

Behavior:

- resolve remote IPs lazily,
- cache results,
- avoid blocking collectors,
- backfill unresolved IPs asynchronously.

### Step 4.6

Implement network analytics queries.

Return:

- network usage over time,
- top domains,
- unique domains,
- process bandwidth split,
- quota progress,
- velocity heatmap,
- live packet/process matrix rows.

## Phase 5: React network integration

### Step 5.1

Create `src/app/api/network.ts`.

Implement command and event wrappers.

### Step 5.2

Create hooks:

- `useNetworkSummary`
- `useNetworkUsage`
- `useNetworkStatus`
- `useDomainStats`
- `useBandwidthSplit`
- `usePacketMatrix`
- `useQuotaStatus`
- `useVelocityHeatmap`

### Step 5.3

Replace these components:

- `NetworkUsageChart`
- `NetworkStatus`
- `DomainTracker`
- `BandwidthSplitter`
- `DataVelocityHeatmap`
- `NetworkQuotaBurndown`
- `LivePacketMatrix`
- network stat cards in `App.tsx`

### Step 5.4

Add data refresh strategy.

Recommended:

- event-driven live updates for fast-changing widgets,
- command re-fetch for charts after filters/date changes,
- periodic background re-sync for summary tiles.

## Phase 6: Dashboard synthesis

### Step 6.1

Implement `get_dashboard_summary(range)`.

Combine:

- active time,
- mouse/key totals,
- network traffic,
- active connections,
- top apps,
- top domains,
- live health state.

### Step 6.2

Wire dashboard widgets:

- `LivePulseStrip`
- dashboard stat cards
- `FocusCorrelator`
- `InputVisualizer`
- `NetworkStatus`
- `NetworkUsageChart`
- `ActivityTimeline`

### Step 6.3

Remove remaining mock generators once the dashboard is stable.

## Phase 7: Settings, privacy, and controls

Add a real settings model before broad rollout.

### Settings to support

- start on boot,
- enable activity collection,
- enable network collection,
- idle timeout threshold,
- retained history window,
- allowed/blocked executable capture,
- allow window-title capture,
- allow hostname/domain capture,
- anonymize titles/domains,
- network quota target,
- ping targets,
- sampling intervals.

### Privacy defaults

- no raw keystrokes,
- no clipboard capture,
- no screenshots,
- no packet payloads,
- window title capture optional,
- process path capture optional,
- settings page explains exactly what is stored.

## Phase 8: Performance and correctness hardening

### Requirements

- collectors must not block UI,
- DB writes must be batched,
- live event rate must be throttled,
- charts should request aggregated data, not raw event streams,
- startup should not replay massive raw logs synchronously.

### Hardening tasks

- batch insert pipelines,
- rollup jobs for minute/hour/day aggregates,
- domain resolution worker queue,
- bounded in-memory caches,
- backpressure on event emission,
- crash recovery for open app sessions,
- WAL mode for SQLite if appropriate.

## Phase 9: Testing strategy

### Rust tests

- unit tests for aggregators,
- unit tests for time bucketing,
- unit tests for foreground/background attribution,
- unit tests for domain resolution caching,
- integration tests for repository queries,
- migration tests,
- command handler tests.

### Frontend tests

- hook tests with mocked Tauri API,
- component tests for loading/error/empty/live states,
- chart transformation tests,
- regression tests for pagination/live updates.

### Manual test matrix

- idle/active transition,
- app switching,
- lock/unlock,
- sleep/resume,
- network disconnect/reconnect,
- heavy download,
- multi-monitor / multiple windows,
- long-running app session,
- app restart with persisted history intact.

## 13. Milestone Roadmap

## Milestone A: Backend skeleton

Target outcome:

- app starts,
- DB exists,
- logging works,
- commands return stub real schemas,
- React can call backend successfully.

## Milestone B: Real activity collection

Target outcome:

- dashboard/activity page show real active time, idle time, input counts, app sessions.

## Milestone C: Real activity history

Target outcome:

- timeline, sunburst, heatmap, live feed are backend-powered.

## Milestone D: Real network collection

Target outcome:

- network page shows real health, process traffic, connection rows, top domains.

## Milestone E: Production quality

Target outcome:

- settings, privacy, rollups, error handling, startup behavior, packaging, stable long-session performance.

## 14. Detailed Order Of Implementation

Use this sequence exactly unless blocked:

1. Create Rust module layout.
2. Add logging, config, app data paths.
3. Add SQLite and migrations.
4. Define DTOs and shared API contracts.
5. Add Tauri commands returning placeholder real DTOs.
6. Add frontend API wrappers and one sample live hook.
7. Implement idle detection.
8. Implement input counters.
9. Implement foreground window tracking.
10. Persist activity buckets and app sessions.
11. Replace activity stat cards.
12. Replace activity timeline.
13. Replace live activity feed.
14. Replace sunburst/app usage.
15. Replace timeline editor data source.
16. Implement network health collector.
17. Implement connection snapshot collector.
18. Implement process throughput estimator.
19. Implement domain enrichment cache.
20. Persist network samples and connection observations.
21. Replace network summary widgets.
22. Replace domain tracker.
23. Replace bandwidth splitter.
24. Replace packet matrix.
25. Add dashboard summary aggregation.
26. Add settings model and settings UI.
27. Add retention and rollups.
28. Add QA pass for long-running stability.
29. Add installer/build/release hardening.

## 15. React Refactor Mapping

Map current components to likely backend sources:

- `ActivityTimeline.tsx`
  - command: `get_activity_timeline`

- `LiveActivityFeed.tsx`
  - command: `get_live_activity_feed`
  - event: `activity://live-event`

- `FocusCorrelator.tsx`
  - command: `get_focus_correlation`

- `SunburstChart.tsx`
  - command: `get_app_usage_breakdown`
  - settings/category persistence if category editing is meant to be real

- `TimelineEditor.tsx`
  - command: `get_timeline_editor_day`

- `NetworkUsageChart.tsx`
  - command: `get_network_usage`

- `NetworkStatus.tsx`
  - command: `get_network_health`
  - event: `network://health-updated`

- `DomainTracker.tsx`
  - command: `get_domain_stats`

- `BandwidthSplitter.tsx`
  - command: `get_bandwidth_split`

- `LivePacketMatrix.tsx`
  - command: `get_live_packet_matrix`
  - event: `network://live-process-update`

## 16. Risks And Mitigations

### Risk: process-level network byte accuracy is limited

Mitigation:

- start with sampled approximations,
- expose internal confidence levels,
- keep UI labels honest if values are estimated.

### Risk: global hooks add stability/privacy concerns

Mitigation:

- store counts only,
- isolate hook logic,
- add kill-switch settings,
- add extensive logging and error recovery.

### Risk: UI expects richer data than backend can provide immediately

Mitigation:

- add partial data states,
- implement per-widget migration,
- keep temporary fallback rendering until each widget is truly wired.

### Risk: large data volume over long-running sessions

Mitigation:

- aggregate aggressively,
- retain raw short-term data only if necessary,
- build hourly/daily rollups,
- prune by retention policy.

### Risk: Tauri event storms

Mitigation:

- throttle event emission,
- emit summaries instead of every raw event,
- let React poll lists when full live streaming is unnecessary.

## 17. Definition Of Done

The project is fully implemented when:

- the app collects real activity and network telemetry on Windows,
- the main dashboard and all major pages render from backend data,
- no major chart depends on `Math.random` or hardcoded demo arrays,
- app restarts preserve history,
- collectors recover after sleep/resume and network changes,
- settings control collection/privacy behavior,
- the Rust <-> React API is typed and stable,
- the app remains usable during long sessions,
- tests cover core aggregation and query logic.

## 18. Recommended First Sprint

If starting immediately, the first sprint should only aim to establish the real architecture.

### Sprint 1 tasks

1. Create Rust module skeleton.
2. Add logging and app state.
3. Add SQLite with first migrations.
4. Define DTOs for dashboard/activity/network summaries.
5. Add `get_app_status`, `get_dashboard_summary`, `get_activity_timeline`, `get_network_summary`.
6. Add frontend API wrapper modules.
7. Replace one simple widget with real `invoke()` plumbing.

### Sprint 1 success criteria

- app boots with DB initialized,
- frontend successfully calls Rust commands,
- at least one view reads backend data instead of local mock data,
- foundation is ready for collectors.

## 19. Recommended Second Sprint

### Sprint 2 tasks

1. Implement idle detection.
2. Implement input counters.
3. Implement foreground app tracker.
4. Persist app sessions and minute activity buckets.
5. Replace activity summary cards and activity timeline.
6. Add live activity event stream.

### Sprint 2 success criteria

- app shows real active/idle time,
- app usage begins accumulating across sessions,
- activity page becomes meaningfully real.

## 20. Final Recommendation

Treat this as a data-platform project with a UI already designed, not as a UI project that needs a little backend work.

The hardest parts will be:

- Windows telemetry collection,
- trustworthy data modeling,
- network attribution,
- stable local persistence,
- live update orchestration.

The safest route is:

- build the domain model first,
- make one thin but correct end-to-end slice,
- then replace mock widgets one family at a time.
