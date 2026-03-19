import type { Category } from "../components/reports/CategoryManagerModal";
import { invokeCommand, invokeWithFallback } from "./tauri";

export type SunburstPersistedSettings = {
  categories: Category[];
  assignments: Record<string, string>;
};

export async function loadSunburstSettings(): Promise<SunburstPersistedSettings | null> {
  const raw = await invokeWithFallback<string>("get_sunburst_settings", () => "");
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "categories" in parsed &&
      "assignments" in parsed &&
      Array.isArray((parsed as SunburstPersistedSettings).categories) &&
      typeof (parsed as SunburstPersistedSettings).assignments === "object"
    ) {
      return parsed as SunburstPersistedSettings;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export async function saveSunburstSettings(
  data: SunburstPersistedSettings,
): Promise<void> {
  await invokeCommand<void>("save_sunburst_settings", {
    json: JSON.stringify(data),
  });
}
