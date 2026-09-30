import { PreferenceStore } from "../infrastructure/storage";
export type ThemePreference = "system" | "light" | "dark";
export function parseTheme(value: string | null): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}
const store = new PreferenceStore();
export async function readAppearance(): Promise<ThemePreference> { return parseTheme(await store.get("appearance-v1")); }
export async function setAppearance(value: ThemePreference) {
  document.documentElement.dataset.theme = value;
  await store.set("appearance-v1", value);
}
export async function restoreAppearance() {
  try { document.documentElement.dataset.theme = await readAppearance(); } catch { /* System theme works without storage. */ }
}
