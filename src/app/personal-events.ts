import { PERSONAL_JOURNAL_KEY, PERSONAL_RESTORED_EVENT } from "../application/personal-settings";
export function personalRestored() { window.dispatchEvent(new Event(PERSONAL_RESTORED_EVENT)); }
export function onPersonalRestored(refresh: () => void) {
  const otherTab = (e: StorageEvent) => { if (e.key === `CapacitorStorage.${PERSONAL_JOURNAL_KEY}`) refresh(); };
  window.addEventListener(PERSONAL_RESTORED_EVENT, refresh); window.addEventListener("storage", otherTab);
  return () => { window.removeEventListener(PERSONAL_RESTORED_EVENT, refresh); window.removeEventListener("storage", otherTab); };
}
