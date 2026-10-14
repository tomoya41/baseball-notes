# Google Play release preparation — checked 2026-10-14

This is preparation, not a Play release. No account registration, fee payment, signature/key change, production Firebase or Play upload was performed. Monthly operating cost remains **¥0**; potential store registration cost is separate.

## Packaging and owner decisions

| Item | Repository state | Remaining action / owner gate |
|---|---|---|
| Application ID | `com.tomoya41.baseballnotes`; Java namespace `jp.baseballdata.app` | Owner confirms permanent store ID before first listing. Do not rename casually after release. |
| Version | code `1`, name `0.1.0-beta.1` | Choose launch name/version; increment code for every uploaded update. No bump required for this unsigned preparation. |
| SDK | min24 / compile36 / target36; JDK21, Capacitor8.5.2 | Meets [current target API36 submission requirement](https://developer.android.com/google/play/requirements/target-sdk). Old devices/API24 and OEMs still need physical QA. |
| Release AAB | CI builds `app-release.aab`, unsigned; debug APK separately signed by development tooling | Not store-ready until owner-approved signing. Debug key is not a release key. |
| Signing | No `signingConfigs.release`, no committed keystore; secrets absent from repo | Owner chooses [Play App Signing/upload key](https://developer.android.com/studio/publish/app-signing), custody and encrypted offline backups. Generate/configure only after explicit approval. Never commit keystore/password. |
| App Links | HTTPS manifest + custom scheme; validated route parsing | Need actual Play **app-signing certificate** SHA256 and root host control. Upload signing certificate is not necessarily the app-signing certificate. |
| Root assetlinks | Generator refuses absent/invalid fingerprints and writes ignored `.data/app-link-host-root` | Publish at `https://tomoya41.github.io/.well-known/assetlinks.json`, not `/baseball-notes/.well-known`. Separate host-root deployment required; no placeholder or debug fingerprint. |
| Privacy | In-app [#/privacy](https://tomoya41.github.io/baseball-notes/#/privacy), Source credits; no login/analytics/cloud sync; FCM disabled | Owner supplies developer identity/contact and durable public privacy page. Review actual final SDK/network behavior and policy, not just UI text. |
| Data safety | Local Preferences/IndexedDB, normal GitHub Pages/API connections; Firebase dependency packaged but auto-init disabled/unconfigured | Owner completes [Data safety](https://support.google.com/googleplay/android-developer/answer/10787469) for actual shipped build, including third-party SDKs. Never prefill “no data” simply because saves are local. |
| Store listing | No submitted listing/assets | Owner approves title, contact, descriptions, content rating/target audience, screenshots and originality/rights. No unlicensed player photos or team logos. |
| Screenshots | Emulator evidence is QA evidence, not final store marketing assets | Produce actual polished mobile captures; exclude QA collection/name, debug indicators and claims of realtime/push. Prepare accepted sizes at upload using current Console requirements. |
| Native libraries | Prior CI package scan found no app `.so` payload | Recheck final APK/AAB and dependencies; do not infer all devices/16KB page sizes are physically tested. |
| Permissions | INTERNET and POST_NOTIFICATIONS; cleartext blocked, backups disabled, FCM auto-init/analytics disabled | Keep notification unconfigured state honest. No fake background delivery or production backend added. |

## Privacy / Data safety review sheet

Owner must compare [Google User Data policy](https://support.google.com/googleplay/android-developer/answer/10144311) with the final release:

- Favorites (players/teams), Collections, Saved Views, Activity, Watch rules/baselines/read state and response cache are device local; no account or synchronization. App data clear/uninstall deletes them, Android `allowBackup=false`.
- Public data network requests expose normal connection information to hosting/API operators. Do not equate no analytics with no network disclosure.
- Firebase Messaging library exists, but `google-services.json` is absent, messaging auto-init and analytics disabled. The existing future opt-in notification code would process installation/token/topic information **if production configuration were enabled**. That is not current functioning push. Reassess policy/Data safety before enabling it.
- Current Privacy screen describes local data and future notification behavior but does not identify a confirmed owner/contact. Supply those owner facts rather than inventing them. Ensure a publicly accessible, stable, non-geofenced privacy URL in Console and app; inspect it without login.
- No news copying, photo/logo rights expansion, raw restricted source export, personal search analytics or monetization is introduced by this delivery.

## Domain verification when signing is approved

[Official App Links verification](https://developer.android.com/training/app-links/verify-applinks) checks each host root. With the approved signed build installed and root JSON deployed:

```text
adb shell pm verify-app-links --re-verify com.tomoya41.baseballnotes
adb shell pm get-app-links com.tomoya41.baseballnotes
```

Require `tomoya41.github.io: verified`; manual forced association is not verification proof. Open an HTTPS Player link both stopped/running, with correct season/scope. Do not issue key-generation or host publication commands until owner approval and the final certificate are supplied.

## Costs and external testing

[Google developer account registration](https://support.google.com/googleplay/android-developer/answer/6112435) currently costs **US$25 once**, and requires account/identity verification; this has **not** been paid or initiated. Currency conversion/taxes/card fees are not estimated as a guaranteed yen amount. This is not a monthly service fee.

For personal accounts created after November 13, 2023, [current production-access testing](https://support.google.com/googleplay/android-developer/answer/14151465) requires at least **12 opted-in closed testers continuously for 14 days**, followed by production-access application; eligibility is not automatic. Account type/date and physical-device verification are owner-specific. Do not claim this project has completed them.

The registration fee and 12-testers/14-days rules were rechecked against those official pages on October 14; no registration/payment or Console access occurred. [Per-device result form](android-physical-qa-results.md) records the exact APK commit, device, reproduction and screenshot for each physical check. Engineering build/emulator evidence, actual physical QA and Play owner gates remain separate. The current release has no functioning Browser/Native Push and makes no background-delivery promise.

## Suggested listing copy (draft, owner approval needed)

**Title:** Baseball Notes

**Short description:** 野球の試合・選手成績を読み解く。比較、過去シーズン、フォローの変化をひとつに。

**Description points:** NPBの保存済み2026年データとMLB 2014〜2025年の過去シーズン、選手・球団・試合、直近成績、比較、記録の節目。お気に入りやコレクションは端末保存。取得済みデータの変化をアプリ内で確認。リアルタイム速報・バックグラウンドPushは提供しない。データ範囲・欠損・出典を各画面で確認可能。NPB HOT/Rankingは未公開で、MLB Historicalを現在の速報と表現しない。

## Release sequence

1. Complete [physical QA](android-device-qa.md), TalkBack and final SDK/privacy audit; record failed/unrun gates.
2. Owner decides ID/version, account/cost/contact, signing custody and root-host access. No implementation progress depends on prematurely creating a key.
3. After explicit approval, configure signing securely, build signed AAB, validate package/cert, then host assetlinks and verify actual domain association.
4. Owner prepares Console listing/Data safety/privacy/content rating and required closed test. Internal/closed upload and production publication are separate approvals.
5. Only after these gates call it Play-ready. Current unsigned CI success is **engineering readiness**, not signed/store/physical readiness.
