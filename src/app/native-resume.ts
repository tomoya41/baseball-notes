// Activity state / local WebView reload only. External links still pass through
// canonicalDeepLink; keep this private route encoded when restoring filters.
export function resumableNativeRoute(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 8192) return null;
  try {
    const path = decodeURIComponent(value.split("?")[0]!);
    return path.startsWith("/NPB/") || path.startsWith("/MLB/") || path === "/privacy" ? value : null;
  } catch { return null; }
}
