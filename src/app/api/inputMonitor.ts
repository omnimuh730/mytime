import { listen } from "@tauri-apps/api/event";

import type {
  InputMonitorEventDto,
  LiveFeedEventDto,
} from "../types/backend";
import { hasTauriRuntime } from "./tauri";
import { invokeCommand } from "./tauri";

const INPUT_MONITOR_EVENT = "input-monitor://event";

export async function subscribeToInputMonitor(
  handler: (event: InputMonitorEventDto) => void,
) {
  if (!hasTauriRuntime()) {
    return () => {};
  }

  return listen<InputMonitorEventDto>(INPUT_MONITOR_EVENT, ({ payload }) => {
    handler(payload);
  });
}

export async function getRecentInputEvents(
  limit?: number,
): Promise<LiveFeedEventDto[]> {
  if (!hasTauriRuntime()) {
    return [];
  }
  return invokeCommand<LiveFeedEventDto[]>("get_recent_input_events", {
    limit: limit ?? 50,
  });
}
