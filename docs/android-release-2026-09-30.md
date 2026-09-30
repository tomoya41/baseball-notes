# Android Beta / Release preparation

Accessed: 2026-09-30 (Asia/Tokyo). Implementation, device verification and external release gates are separate. This does not certify NPB Scheduled Operations or open HOT/Ranking gates.

## Toolchain and primary evidence

| Item | Decision / official source |
|---|---|
| Capacitor | Exact core/android/CLI **8.5.2**, npm `latest` stable; exclude next/nightly. [v8 environment](https://capacitorjs.com/docs/getting-started/environment-setup), [8.5 upgrade](https://capacitorjs.com/docs/updating/8-5). |
| Node | Local 24.19.0, CI Node 24; Capacitor requires 22+. |
| Android | min 24 / compile 36 / target 36; JDK 21, Gradle 8.14.3, AGP 8.13.0; Android Studio 2025.2.1 minimum. |
| Play target | [Google requirements](https://developer.android.com/google/play/requirements/target-sdk): API 36 for new apps/updates from 2026-08-31. Recheck before submission. |
| AAB / native code | [App bundles](https://developer.android.com/guide/app-bundle), [64-bit](https://developer.android.com/google/play/requirements/64-bit), [16 KB pages](https://developer.android.com/guide/practices/page-sizes). APK contains datastore shared-counter `.so`; arm64/x86_64 are present and all four ABI libraries have 16KB PT_LOAD alignment. Actual 16KB device runtime remains a release check. |
| FCM cost | [Firebase pricing](https://firebase.google.com/pricing): Cloud Messaging no-cost; Spark requires no payment method. No paid Functions/hosting/Firestore/Analytics. |
| Permission | [FCM Android setup](https://firebase.google.com/docs/cloud-messaging/android/get-started): Android 13+ POST_NOTIFICATIONS runtime permission; auto-init disabled before opt-in. |
| Topics | [Topic messaging](https://firebase.google.com/docs/cloud-messaging/topic-messaging): public information; max 2,000 topics per installation. Canonical `npb-player-<UUID>`. |
| App Links | [Verification](https://developer.android.com/training/app-links/verify-applinks): host-root Digital Asset Links with actual app-signing SHA-256. |
| Privacy | [Data Safety](https://support.google.com/googleplay/android-developer/answer/10787469), [user data policy](https://support.google.com/googleplay/android-developer/answer/10144311). Final declarations must describe enabled SDK behavior. |

## Identity / build / rollback

Name: **Baseball Notes**. Provisional applicationId: **com.tomoya41.baseballnotes**. Earlier `jp.baseballdata.app` was an unreleased stub; it remains the Java namespace. Version 0.1.0-beta.1 / code 1.

**FINAL PACKAGE ID CONFIRMATION REQUIRED BEFORE FIRST STORE RELEASE**

Shared React/HashRouter remains the source of truth. `prepare-android-web.ts` copies built UI into `.data/android-web`, excluding `/data`. No historical SQLite/raw PA in APK. Rollback reverts runtime/shell adapters without canonical Fact changes or Favorites v1 migration.

```powershell
npm ci
npm run check
npm run android:sync
# Local Android SDK and JDK 21 required:
npm run android:apk
npm run android:aab
```

Linux/macOS after sync: `bash android/gradlew -p android :app:assembleDebug :app:assembleRelease :app:bundleRelease`. CI builds debug APK, unsigned release APK/AAB and app instrumentation APK. Emulator is workflow_dispatch only. Public standard Linux runner execution is free; private-repository builds are disabled. Artifacts are retained for seven days. [GitHub billing documentation](https://docs.github.com/en/billing/concepts/product-billing/github-actions) separately describes artifact/cache storage allowances and overage billing. Keep storage within the account's included allowance and set a zero spending limit before recurring operation; public runner minutes alone do not prove the account's entire bill is zero. Account billing settings and historical charges were not inspected or changed in this task. No signing key/password is generated or committed. Debug CI certificates are ephemeral, not release identities.

## Runtime / cache / Favorites

App/Network/Browser/notifications stay in platform adapters. Android public JSON uses existing HTTPS Pages origin; Web retains relative URLs. Safe areas use native insets/CSS env; `adjustResize` supports keyboard. No portrait lock. Launch reuses the Web ball logo without animation.

Back closes the top dialog, router history, then canonical parent screen; root exits. Custom/HTTPS incoming URIs validate league + canonical resource/ID and translate to existing hash routes. Optional season/date/asOfDate is retained, provider IDs rejected. Example: `baseballnotes://MLB/players/mlb%3Aplayer%3Ae70b8d12-aa41-50c0-9c1b-d468d451355f`.

IndexedDB public response cache: max 64 MiB / 400 entries / 2 MiB per response. GET dedupe, bounded timeout, commit only after repository schema and identity validation. Invalid responses cannot overwrite valid cache; 404 evicts removed resources. Raw event/PA routes excluded. Fallback shows **保存済みデータ**. First offline launch still renders shell and explicit offline/missing states. Reconnect refreshes the visible stale screen, not the WebView. Cache is disposable, not an authoritative offline database.

Favorites v1 unchanged: league + kind + canonical entityId + addedAt. Web Preferences preserve existing local storage; native Preferences persist across restarts. Web/native origins have separate storage, with no automatic Favorites transfer or cloud sync.

## Firebase manual setup / notifications

1. Owner confirms package ID, prepares **Spark** project with Analytics disabled, registers Android app. Local/CI `google-services.json` is Git-ignored. Its public client configuration is distinct from private service credentials.
2. Enable FCM HTTP v1; prepare least-privilege messaging credential. Store only in GitHub Actions Secret `FIREBASE_SERVICE_ACCOUNT_JSON`; repository variable `NPB_NOTIFICATIONS_ENABLED=true` only after acceptance tests. No service credential in APK/Pages/logs.
3. My → **成績更新通知** explains EOD, then explicit ON triggers permission/auto-init. Initial OFF; no startup permission prompt. MLB Historical topics excluded. Denial leaves OFF; missing Firebase shows preparation pending.
4. Favorite add/remove reconciles canonical NPB topics. Persist a pending topic before its SDK call: timeout/process death cannot lose an uncertain subscription that removal/OFF must undo. OFF disables native delivery immediately; cleanup retries on reconnect. Receiver checks current saved NPB Favorites as well as opt-in/permission before showing a message. SDK topic operations can wait for connectivity; no infinite application retry loop.
5. Daily/Watcher notification step follows verified Pages publication and published ledger mark. Missing config exits `disabled` before opening DB. Send failure is independent/continue-on-error with a five-minute step budget and cannot fail data publication.
6. Existing backed-up permanent-event ledger claims date + Player + event type BEFORE HTTP send. Unknown outcomes are not automatically resent: at-most-once attempt, possible missed alerts, not guaranteed delivery. Native receiver also deduplicates events. Data-only messages respect local OFF. Force-stopped apps may not receive until reopened; no live SLA.
7. Tap uses canonical Player deep link. No token database/account/Analytics. External Firebase setup and production push verification are independent code/build gates.

## App Links manual gate

Android verifies **https://tomoya41.github.io/.well-known/assetlinks.json**, not the project path `/baseball-notes/.well-known/assetlinks.json`.

Set `ANDROID_APP_LINK_FINGERPRINTS` only to owner-approved actual app-signing SHA-256 values. `npx tsx scripts/generate-android-assetlinks.ts` rejects missing/placeholder values and writes `.data/app-link-host-root/.well-known/assetlinks.json`. Owner publishes at domain root in the user-site repository. Debug/upload/Play app-signing fingerprints differ. No ephemeral CI debug certificate is published as release authority. Custom scheme works independently.

## Privacy / store checklist

| Data | Storage / transmission |
|---|---|
| Favorites/settings | Device Preferences; no server table/cloud sync. |
| Public response cache | Bounded device IndexedDB; cleared with app data. |
| Requests | GitHub Pages/existing Player APIs receive normal connection information. |
| FCM after opt-in | Firebase installation identifier/token and Player topics; app DB stores no token. |
| Notification ledger | Public Player/date event states only; no user identity. |
| Analytics/login | None. |

`#/privacy` works Web/Android; Data Sources retains Retrosheet/Chadwick/name credits. External HTTPS links open native browser. Before store submission: owner-approved public privacy policy/contact, Data Safety, content rating/target audience, ads declaration, listing/screenshots and applicable account test requirements. In-app disclosure is not a completed Play declaration.

Manual gates: final package ID, persistent signing/signed AAB, host-root assetlinks, Firebase config/Secret and actual opt-in/denial/OFF/background/cold-tap push, physical-device TalkBack/keyboard/font scaling/gesture Back/OEM battery behavior. No Play upload in this batch. NPB/MLB data and Operations gates unchanged.
