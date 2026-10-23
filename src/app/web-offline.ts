import { isAndroid } from "./platform";

export type WebOfflineState = { ready: boolean; updateAvailable: boolean; applying: boolean; failed: boolean };
let state: WebOfflineState = { ready: false, updateAvailable: false, applying: false, failed: false };
const listeners = new Set<() => void>();
export const webOfflineState = () => state;
export function subscribeWebOffline(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
function change(patch: Partial<WebOfflineState>) { state = { ...state, ...patch }; listeners.forEach(listener => listener()); }
let apply: (() => void) | undefined;
export function applyWebUpdate() { apply?.(); }

export async function connectWebOffline(container: ServiceWorkerContainer, base: URL, reload: () => void) {
  const registration = await container.register(new URL("sw.js", base), { scope: base.pathname, updateViaCache: "none" });
  let waiting = registration.waiting, hadController = !!container.controller, requested = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const inspect = () => change({ ready: registration.active?.state === "activated", updateAvailable: !!waiting });
  const track = () => {
    const worker = registration.installing;
    if (!worker) return;
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed" && container.controller) { waiting = registration.waiting ?? worker; change({ updateAvailable: true }); }
      if (worker.state === "activated") inspect();
      if (worker.state === "redundant" && !registration.active) change({ failed: true });
    });
  };
  const controlled = () => {
    clearTimeout(timer);
    if (requested) reload();
    else if (hadController) { waiting = null; change({ ready: true, updateAvailable: true }); }
    else inspect();
    hadController = !!container.controller;
  };
  apply = () => {
    if (!waiting) { reload(); return; }
    requested = true;
    change({ applying: true });
    timer = setTimeout(() => { requested = false; change({ applying: false, failed: true }); }, 10000);
    waiting.postMessage({ type: "ACTIVATE_WEB_UPDATE" });
  };
  registration.addEventListener("updatefound", track);
  container.addEventListener("controllerchange", controlled);
  track(); inspect();
  let checkedAt = Date.now();
  const check = () => {
    if (navigator.onLine === false || Date.now() - checkedAt < 15 * 60 * 1000) return;
    checkedAt = Date.now();
    void registration.update().catch(() => undefined);
  };
  window.addEventListener("online", check); window.addEventListener("focus", check);
  return () => {
    registration.removeEventListener("updatefound", track); container.removeEventListener("controllerchange", controlled);
    window.removeEventListener("online", check); window.removeEventListener("focus", check); clearTimeout(timer); apply = undefined;
  };
}

let started = false;
export function startWebOffline() {
  if (started || !import.meta.env.PROD || isAndroid() || !window.isSecureContext || !("serviceWorker" in navigator)) return;
  started = true;
  const start = () => { void connectWebOffline(navigator.serviceWorker, new URL(import.meta.env.BASE_URL, location.href), () => location.reload()).catch(() => change({ failed: true })); };
  if (document.readyState === "complete") setTimeout(start, 0);
  else window.addEventListener("load", start, { once: true });
}
