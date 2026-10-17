# Android route recreation — bounded resume

## Problem and final behavior

API-36 run [38963306415](https://github.com/tomoya41/baseball-notes/actions/runs/38963306415), app commit `c642816`, built successfully but failed **2 of 6** instrumentation tests. After font-scale Activity recreation, the original launch URI could replace the selected CS player / subsequent profile navigation. These failures are retained as evidence, not reported as PASS.

The final implementation saves only the current **encoded hash route**, at most 8,192 characters, in Android's private instance-state Bundle. `RouteRestore` is a small native adapter that exposes this one-shot value to `installPlatformRuntime`; the existing React root already waits for that runtime before rendering. Neither the launch Intent nor WebView browsing history is modified/restored. The app resumes the current screen; after recreation, Back uses the existing cold-route parent fallback until new router history exists. It does not promise to restore the entire previous Back/Forward stack, scroll position or an open dialog.

Capacitor retains the initial ACTION_VIEW event as well as `getLaunchUrl`. When resuming, ignore one matching initial replay; a later external link, including the same URI, still opens normally. A different valid external link arriving during boot takes priority. Invalid external events cannot suppress resume. External links retain canonicalDeepLink validation. A local WebView reload can retain its existing valid hash; old adapters without RouteRestore fall back safely.

The route policy includes NPB, MLB and the app's `/privacy` screen; validates the decoded path only; preserves encoded query delimiters such as `%26`, `%3D`, `%25`; rejects oversized/invalid state. A pre-router loading page does not consume a pending cold link. Font scaling retains Android's normal recreation behavior and the user's actual OS scale.

## Review corrections and regression

Review identified the size risk of serializing unlimited WebView history and the ordering risk of calling restoreState after Capacitor has already started loading. [Android's state guidance](https://developer.android.com/develop/ui/views/layout/webapps/managing-webview#preserve-state) supports size-bounded preservation; this app needs only one route and therefore avoids WebView saveState/restoreState and any added WebKit dependency entirely. Review also identified encoded-query and privacy-route handling; both are fixed with regressions.

Java instrumentation now has seven tests, including 160 long history entries without extra fetches, a complete Activity Bundle below 192 KiB, exact route recreation, encoded filters and privacy. TypeScript runtime tests cover cold launch, retained-event timing, a new link during boot, an invalid event, old-adapter fallback and Web isolation. The emulator script pulls per-screen screenshots before rejecting failed instrumentation; passing QA still requires the screenshots to exist.

An intermediate native restore attempt failed the ActivityScenario recreation identity checks and was not merged or published. The final route-only adapter leaves the Intent unchanged and removes the unsafe restore ordering entirely. Actual final run/review evidence is recorded on PR #40; failed and cancelled obsolete runs are not successes.

Affected areas: Activity + one native adapter, platform boot logic, tests/evidence script. No data, canonical write, rights/Gate change, persistence migration, dependency, permission, signing key or monthly cost. Rollback: revert this native-resume unit; no saved user data is deleted. New app code needs a new debug APK; bundled old APKs and their retained payload generations remain supported. Physical Pixel is disconnected and TalkBack NOT RUN.
