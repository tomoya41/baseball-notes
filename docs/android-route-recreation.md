# Android Activity recreation preserves the current route

## Observed failure

API-36 emulator run [38963306415](https://github.com/tomoya41/baseball-notes/actions/runs/38963306415), application commit `c642816`, built the APK/AAB successfully but failed **2 of 6 instrumentation tests**. During font-scale changes / Activity recreation, a CS player returned to the original CS-list launch URI. The separate saved-2025-postseason/Current-profile navigation test also failed to commit its destination. These results are failures, not physical-device or emulator PASS.

## Narrow correction

Capacitor's BridgeActivity restores plugin calls, but does not save the WebView navigation history. Our Activity now saves WebView state in its private Android instance-state Bundle and restores it on recreation. A copied launch Intent has its old data URI removed only when a saved WebView state exists, preventing the original URI from overriding the resumed route. If WebView restoration fails, the original launch Intent is delivered through Capacitor's normal path. Fresh launches and new external intents retain the existing deep-link validation.

Font-scale changes retain Android's normal Activity recreation behavior; the manifest and user text scaling are unchanged. The instrumentation additionally asserts the exact selected CS-player hash survives recreation.

Affected areas: Android Activity and native instrumentation only. Web presentation, data/provenance, Gates, canonical DB, persisted Favorites/Collections/Watch and signing remain unchanged. Rollback is a revert of this native-only commit; no migration or data deletion. No new service, permissions, dependency or monthly cost.

Actual rerun results will be recorded in the delivery PR. Physical Pixel is disconnected and TalkBack remains NOT RUN. An emulator rerun does not establish physical-device quality.
