import { useEffect, useState } from "react";

/**
 * Returns a longer interval while the document is hidden (e.g. window minimized
 * or app in tray). Reduces Tauri `invoke` / IPC load when the UI is not visible.
 */
export function useAdaptivePollInterval(baseMs: number, hiddenMultiplier = 4) {
  const [ms, setMs] = useState(baseMs);

  useEffect(() => {
    const sync = () => {
      const hidden =
        typeof document !== "undefined" &&
        document.visibilityState === "hidden";
      setMs(hidden ? baseMs * hiddenMultiplier : baseMs);
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, [baseMs, hiddenMultiplier]);

  return ms;
}
