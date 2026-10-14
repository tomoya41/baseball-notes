# Physical Android: shortest release QA and result form

**Physical status: NOT RUN.** No physical handset/TalkBack is available to the agent. This sheet is for the owner to record actual results; emulator PASS does not fill these rows.

## Obtain the APK

Open the successful Run linked in the delivery PR → Artifacts → `android-beta-unsigned` → download/extract → `apk/debug/app-debug.apk`. Install the **debug APK**, not `bundle/release/app-release.aab`. Install only from that trusted artifact with owner consent. If an existing installation rejects the signature, stop and report it; do not uninstall or clear its saved data to force an update. Neither Web favorites nor CI emulator test data transfer automatically to your handset.

Session record: APK Run/commit __; model __; Android __; WebView __; navigation buttons/gestures __; Light/Dark/System __; font scale __; date __. Use **PASS /FAIL /NOT RUN** and exact route/steps for every check.

## Short session (about 10–15 minutes, longer if any failure)

| Order | Actual operation | PASS condition | Physical result |
|---|---|---|---|
| 1 | Online first launch → NPB Home, September9 Game, September28 restored Game → MLB 2024 Player | No crash; September9 remains incomplete, September28 stats visible; Historical/year explicit; NPB HOT/Ranking unavailable | NOT RUN |
| 2 | Player → 操作 → 整理; Back/edge gesture twice; open invalid/custom deep link using the full-checklist examples | Child closes before parent; focus returns; correct year/ID or safe fallback; no duplicate Activity | NOT RUN |
| 3 | Favorite one Player and Team; create `実機QA` Collection, add Player; save Explorer condition; change one Watch rule | Canonical objects/condition/rule readable and usable; no notification permission or fake realtime claim | NOT RUN |
| 4 | Force-stop/relaunch; background/resume; rotate with a dialog/filter open | Saved state survives, correct URL/year/scope; no stuck overlay or lost actions | NOT RUN |
| 5 | Load Player/Game online; turn off both Wi-Fi/mobile data, force-stop/relaunch; open an uncached target | Cached response labeled offline/saved; uncached target has error/Retry; Watch does not advance baseline offline | NOT RUN |
| 6 | Restore network → Retry → Watch check | Real data returns; same projection does not create duplicate alerts; rules/read state persist | NOT RUN |
| 7 | Light/Dark/System; OS font150% then max; portrait/landscape Player/Game/My/HOT | Scores/names/decimals/actions readable and tappable; no page-wide horizontal overflow | NOT RUN |
| 8 | TalkBack → primary navigation, selected season, metric explanation, dialog close, Watch rule | Meaningful labels/values, logical order, modal confines focus and returns it; no unlabeled button/trap | NOT RUN |

Use [full checklist](android-device-qa.md) for offline first-install (separate disposable install), corrupted/quota/reset isolation, lifecycle and all release cases. Do not alter daily-use saved data for destructive tests. If a row fails, record observed vs expected behavior, device/font/theme/navigation, URL/year/scope, online/offline, APK Run/commit and a screenshot without personal information. This is enough for a reproducible fix; do not guess PASS.

## Owner release gates — all still pending

Release signing and custody; verified host App Links/`assetlinks.json`; final Privacy/Data safety review; Play account/listing/testers/production submission. No keys, account fees, payments, association file or store release were created by this QA batch. [Play preparation](play-release-readiness.md) keeps these separate from engineering build/emulator readiness.
