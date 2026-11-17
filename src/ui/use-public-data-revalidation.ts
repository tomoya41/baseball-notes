import { useEffect, useState } from "react";
import { publicNetworkOnline } from "../app/mobile-services";

const foregroundIntervalMs = 30_000;
const visibleIntervalMs = 5 * 60_000;

export function usePublicDataRevalidation(enabled = true) {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let lastCheck = performance.now();
    const check = () => {
      const now = performance.now();
      if (document.visibilityState === "hidden" || !publicNetworkOnline() || now - lastCheck < foregroundIntervalMs) return;
      lastCheck = now;
      setRevision(value => value + 1);
    };
    window.addEventListener("focus", check);
    window.addEventListener("baseball:foreground", check);
    document.addEventListener("visibilitychange", check);
    const timer = window.setInterval(check, visibleIntervalMs);
    return () => {
      window.removeEventListener("focus", check);
      window.removeEventListener("baseball:foreground", check);
      document.removeEventListener("visibilitychange", check);
      window.clearInterval(timer);
    };
  }, [enabled]);
  return revision;
}
