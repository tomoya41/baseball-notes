# Web offline startup and safe updates

Scope: browser / installed home-screen app only. Capacitor Android retains its bundled shell and existing validated response cache. No Source, canonical DB, Facts, Coverage, Gate, favorite keys or API changes.

## Available behavior

- After one successful online app-file installation, the hash-router app can restart/reload offline, including lazy route code and bundled source credits. Actual baseball data is available only when an existing reader has validated and saved that response. Unvisited/uncollected data stays unavailable.
- Cache only the built HTML, JS, CSS, manifest and three first-party app icons. No data JSON, API response, raw/event archive, third-party URL or provider access is added to the service worker. No new dependencies, account, push or monthly cost.
- Registration starts after the page load event and does not block React rendering. A first installation fetches at most 100 files / 8 MiB, four requests in parallel. Subsequent versions are separate complete caches; actual production sizes are recorded on the delivery PR. Home **data** fetches remain unchanged; app-file caching is additional background traffic.
- Every installation requires HTTP success, exact byte counts and SHA-256 for all files. A mixed deployment, missing asset or failed install removes only that incomplete version, leaving the prior complete shell usable.
- The active worker serves its matching HTML/assets together. A new worker waits; a Japanese update action activates it and reloads only the requesting tab. Another open tab can continue using the retained previous hashed assets, and gets an update action rather than a forced reload. One previous shell is retained; older tabs should update before relying on uncached lazy routes.
- Browser-owned storage is disposable. Eviction/private browsing/storage denial can prevent offline startup; personal persistence is not intentionally deleted by this feature. Cache availability is not Fact completeness or freshness proof. No background Watch evaluation or new Scheduled evidence is generated.

## Build and delivery

`npm run build` runs `scripts/build-web-offline.ts` immediately after Vite. It emits `dist/sw.js` with a content-derived version and exact allowlist. Later data staging cannot enter that allowlist. App-only coordinated Pages publication retains the existing NPB/MLB payloads. `prepare-android-web.ts` excludes the generated worker.

Keep `sw.js` at the same scope-relative URL and use `updateViaCache: none`. Normal reload/registration checks find releases; focus/reconnection checks are throttled to 15 minutes. Registration/update errors do not prevent ordinary online use. HTTPS or localhost is required; development-mode Vite does not register the worker.

## Rollback

For an app-only UI rollback, rebuild the selected working app while retaining this build/worker system, producing another verified shell version. Do not simply remove `sw.js`: installed workers would continue controlling clients.

To retire offline support, run `npx tsx scripts/build-web-offline.ts --retire` after building the rollback app, and deploy that `dist/sw.js` at the existing worker URL through the coordinated app-only publication. The retirement worker activates, deletes only this app scope's `baseball-web-shell-v1` CacheStorage entries, then unregisters itself. It does not touch IndexedDB, Preferences, localStorage, Favorites, Collections or Watch. Retain the retirement URL long enough for previously installed clients to check it. Follow with online reload verification before removing registration code.

## Validation and limits

Worker tests execute the real generated script with controlled network/cache fixtures: offline startup, lazy code, data/API exclusion, corrupted/missing version rejection, update consent, previous-tab code, unrelated cache preservation, eviction and retirement. Browser tests use the built app on a private local origin: stop its HTTP server, reload, inspect retained licensed data and URL; restart and validate update behavior. No fixture is published as a real player/game. Native build success is not Pixel/TalkBack QA.

Checked 2026-10-23: [service worker lifecycle](https://web.dev/articles/service-worker-lifecycle), [PWA update lifecycle](https://web.dev/learn/pwa/update), [registration and scope](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register), [updateViaCache](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/updateViaCache).
