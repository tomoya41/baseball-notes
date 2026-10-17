# Physical Android release QA

No physical handset or TalkBack has been operated by Codex in this batch. Android 36 emulator results are recorded separately; they cannot certify OEM gestures, accessibility or production-signed App Links.

## Preparation

Use this result form for each actual handset session: APK commit/Run, device model, Android and WebView versions, navigation mode, theme and font scale; for every row below record **PASS / FAIL / NOT RUN**, observed behavior and reproduction steps. A skipped or emulator-only check is NOT RUN for physical QA. Attach screenshots only when they show the problem; avoid personal information. The September 28 recovery batch changes server operations only and does not replace this physical test gate.

Download the **debug APK** from the final successful Android workflow's `android-beta-unsigned` artifact. The unsigned release AAB is not an installable APK. Record device/model, Android/WebView versions, APK commit, navigation mode and font scale. Enable installation from the chosen trusted download source only if the device owner permits it. Do not uninstall an existing installation to force an incompatible signature without first accepting loss of local data. Web and Android favorites do not transfer automatically.

Use an online network initially. In My choose MLB; open 2024 大谷翔平, then a saved Game. Add the player and one team to Favorites. In Player → 操作 → 整理 create `実機QA`, add the player. In My → フォローの変化 change one rule and note the setting. Save one Explorer condition. These are real saved Historical data, not current MLB events. Leave production push OFF/unconfigured.

| Check | Concrete steps | Pass condition |
|---|---|---|
| First launch | Open installed app from launcher; switch NPB/MLB, open My and Sources | No crash, no permission dead-end; 5 destinations visible. NPB HOT/Ranking unavailable, MLB year/Historical context explicit. |
| Back button | Search → Player → Analysis; open 操作, then 整理; Back twice | Top picker closes first, parent actions next, then previous route. No unwanted app exit, dim overlay or locked scrolling. Focus returns to trigger. |
| Gesture Back | Enable OS gesture navigation; repeat from left and right edges | Same sequence as Back button; gesture does not select underlying data or leave a dialog stuck. At root follow the existing app exit behavior. |
| Deep links | Open `baseballnotes://MLB/players/mlb%3Aplayer%3Ae70b8d12-aa41-50c0-9c1b-d468d451355f?season=2024` from a link-capable tool, once stopped and once running | Correct canonical player/year, safe back, no duplicated Activity. Invalid ID shows recoverable unsupported/empty state. HTTPS auto-opening is separately blocked until signed host verification. |
| Font size | OS Settings → Display → font size 150%, then maximum; reopen Player/Game/HOT/My | No clipped identity, decimal split, overlap or missing actions; tap targets usable. A long table may scroll locally; page scroll remains natural. |
| TalkBack | OS Accessibility → TalkBack; traverse primary tabs, season/competition, favorite, metric help, picker and Watch rule | Names/selected state/value intelligible, order follows content, modal confines focus, close returns focus. No unlabeled button or focus trap. Disable TalkBack afterwards if desired. |
| Themes | My appearance Light/Dark/System; change OS theme for System | Text, scores, charts, disabled/selected controls readable, setting survives restart. |
| Offline warm cold start | After loading Player/Game online, disable Wi-Fi **and mobile data** (airplane mode alone may retain Wi-Fi). Swipe app away; force-stop via OS Settings; relaunch | Bundled shell opens; previously validated response is labeled saved/offline. Favorite/collection/Watch settings remain. Uncached data gives error/retry, never fabricated empty/zero. |
| Offline first install | On a separate clean test install only, start offline before any payload load | Shell and static Sources/Privacy accessible; uncached screens explain network need. Do not claim all baseball data is bundled. |
| Network recovery | On failed uncached route restore network, press Retry; then refresh Watch | Real response loads; no persistent spinner/crash. Watch offline baseline was not advanced; first new target is baseline, not fake notification. |
| Process/restart | Note favorites, collection membership, saved condition, Watch rule/read/hidden state; stop/restart app; background for 5 min | Same canonical entities/settings persist; no duplicate historical alerts from identical projection. Data is lost only after deliberate app-data clear/uninstall; no cloud recovery promised. |
| Activity lifecycle | Home/background/resume, lock/unlock, OS theme change; return to a filtered Explorer | No duplicate listeners/dialogs; URL, scope and filters coherent; network recovery works. |
| Rotation/taps | Portrait ↔ landscape with keyboard open and picker open; long name row; season/competition changes | Safe-area/insets usable, sheet close accessible, no horizontal page overflow or stale year/stat mismatch. Keyboard never obscures all actions. |
| Offline persistence isolation | Offline Watch → re-open, verify unchanged read/rule/baseline; My → collection | Offline is explicitly labeled; no new baseline/alert writes caused by fallback. Favorites and Collections unaffected. |
| Clear/reset | In a disposable QA install, reset Watch only; then library only | Watch reset retains favorites/library; library reset retains favorites/Watch. Corrupt/quota handling has automated tests, not a claim to have physically exhausted storage. |

Mark **PASS / FAIL / NOT RUN** for every row, with screenshot and reproduction URL for failures. Treat crashes, corrupted saves, wrong year/scope, hidden warnings or inaccessible modal close as release blockers. Do not mark a visual check passed solely because an APK build succeeded.

## Automation versus remaining manual gates

Repository instrumentation exercises actual canonical MLB Player/Game, native Back, nested picker focus return, Light/Dark, 150% font, portrait/landscape recreation, favorite persistence, Collection membership via real UI, Watch rule persistence and byte-identical offline Watch state. Shell smoke covers offline first launch, connection recovery and force-stopped cached Player restart. Web tests cover deep-link query validation, persistence migration/corruption/quota/dedup/stale/partial rules. OS gesture recognition, real TalkBack, physical networking/OEM lifecycle and production signing/domain verification remain manual.

The added emulator test exposed an actual nested-dialog bug, also reproduced with Escape on the published browser: React close propagation dismissed both the collection picker and its parent actions sheet. `AppDialog` now isolates its close event. Regression uses a real parent close-state handler rather than the previous no-op test handler, and native QA waits for picker unmount and trigger focus before proceeding. No visual redesign or persistence contract change.

Signed builds, signing-key ownership and Play steps are in [Play preparation](play-release-readiness.md). No release key was generated or modified.

## 2026-10-17補足：更新前に署名を確認

CIのdebug APKが、Pixelへ初回導入したAPKと同じ署名とは限りません。初回保管APK（SHA256 `3fc935e113aafa419a03efc084c9df36c0b0657b2a6b31378d0f15f35672ac09`）の公開証明書SHA256は `223912d3da4f0c257f9a849c05a6db9dabb11caa7b2d36fba92803ce00ce360f` です。今回調べたCI版の証明書はこれと異なりました。これはAPK内の公開証明書の照合であり、未接続端末の現在のインストール状態を調べた結果ではありません。

実機更新前に、接続中Pixelの当該パッケージと候補APKの署名継続性を確認してください。同じ署名を使えない場合は更新を停止し、**アンインストール／pm clearで回避しない**でください。元の署名キーでのビルド可否、または既存アプリを残す別QA環境を所有者と決める必要があります。既定のWindows／workspace debug keystoreは今回見つかっていませんが、所有者管理の別保管先が存在しないとは断定しません。秘密鍵をチャットや公開Artifactへ送らないこと。

署名キーの生成・変更・新規Secretsの追加・Play公開は行っていません。Androidの署名・更新方針は [公式ガイド](https://developer.android.com/studio/publish/app-signing) を参照してください。物理Pixel／TalkBackのNOT RUNは、エミュレーター結果で置き換えません。
