# Android Activity recreation preserves the current route

## Observed failure

API-36 emulator run [38963306415](https://github.com/tomoya41/baseball-notes/actions/runs/38963306415), application commit `c642816`, built the APK/AAB successfully but failed **2 of 6 instrumentation tests**. During font-scale changes / Activity recreation, a CS player returned to the original CS-list launch URI. The separate saved-2025-postseason/Current-profile navigation test also failed to commit its destination. These results are failures, not physical-device or emulator PASS.

## Narrow correction

Capacitor's BridgeActivity restores plugin calls, but does not save the WebView navigation history. Our Activity now saves bounded WebView state in its private Android instance-state Bundle and restores it on recreation. A copied launch Intent has its old data URI removed only when a valid saved route exists, preventing the original URI from overriding the resumed route. If history restoration is unavailable or fails, the bounded current route is loaded on the existing local Capacitor origin. Fresh launches and new external intents retain the existing deep-link validation.

External review raised P2: unbounded framework `WebView.saveState` can exceed Android's saved-state transaction limit. Following [Android's official guidance](https://developer.android.com/develop/ui/views/layout/webapps/managing-webview#preserve-state), use the already-installed AndroidX WebKit 1.14 bounded `WebViewCompat.saveState` only when `SAVE_STATE` is supported: at most 128 KiB, no forward history. Always retain a route of at most 8,192 characters; unsupported WebViews use this route-only fallback without unbounded serialization. A seventh instrumentation test inflates actual back history without extra requests, checks the complete Activity Bundle remains below 192 KiB, then verifies route restoration.

Font-scale changes retain Android's normal Activity recreation behavior; the manifest and user text scaling are unchanged. The instrumentation additionally asserts the exact selected CS-player hash survives recreation.

A pre-router loading page is not saved as a resumed route: until an NPB/MLB hash exists, the original cold-launch Intent remains authoritative.

Follow-up review fixes preserve the **encoded** fragment (so `%26`, `%3D` and `%25` in filters remain data, not new delimiters) and include the existing top-level `/privacy` route. Only the path is decoded for the bounded app-route allowlist. Regression checks cover an encoded search and privacy recreation alongside the long-history test.

The emulator script now pulls per-screen screenshots before rejecting failed instrumentation, preserving failure diagnostics. A passing run still requires that screenshot pull to succeed.

Affected areas: Android Activity, native instrumentation and its evidence script only. Web presentation, data/provenance, Gates, canonical DB, persisted Favorites/Collections/Watch and signing remain unchanged. Rollback is a revert of this native-only fix; no migration or data deletion. No new service, permissions, dependency or monthly cost.

Actual rerun results will be recorded in the delivery PR. Physical Pixel is disconnected and TalkBack remains NOT RUN. An emulator rerun does not establish physical-device quality.
