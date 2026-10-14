# Android実機QA：インストール手順と結果票

**Physical status: NOT RUN.** No physical handset/TalkBack is available to the agent. This sheet is for the owner to record actual results; emulator PASS does not fill these rows.

2026-10-14：ローカルのADBと標準Android SDKパスが利用できず、物理端末の操作は未実施。エミュレーターの成功を実機PASSへ転記しない。[全項目の手順・合格条件](android-device-qa.md)と併用する。

## Obtain the APK

Open the successful Run linked in the delivery PR → Artifacts → `android-beta-unsigned` → download/extract → `apk/debug/app-debug.apk`. Install the **debug APK**, not `bundle/release/app-release.aab`. Install only from that trusted artifact with owner consent. If an existing installation rejects the signature, stop and report it; do not uninstall or clear its saved data to force an update. Neither Web favorites nor CI emulator test data transfer automatically to your handset.

最短の準備：

1. このバッチのPRにある成功したAndroid Runを開き、`android-beta-unsigned`をダウンロード・展開する。Artifactsは7日保持。期限切れの場合は同じcommitのworkflowを再実行し、Runを記録する。
2. `apk/debug/app-debug.apk`を本人の端末へ移し、信頼したダウンロード元だけからインストールする。`app-release.aab`は実機へ直接インストールしない。
3. 署名不一致が出たら停止する。保存データを消して更新を強行しない。普段使いのFavorites等はWeb・CIから同期されない。
4. 以下のセッション欄を埋め、10〜15分のチェックを始める。失敗があれば先へ進む前に再現手順を記録する。TalkBackや通信の物理検証には追加時間を確保する。

Session record: APK Run/commit __; model __; Android __; WebView __; navigation buttons/gestures __; Light/Dark/System __; font scale __; date __. Use **PASS /FAIL /NOT RUN** and exact route/steps for every check.

## 項目ごとの記録（コピーして使用）

端末・Android Version・APK Commitはセッション共通値を参照してよいが、別端末・別APKの結果を混ぜない。スクリーンショットは端末名・アカウント等の個人情報を含めず、所有者が許可した添付先だけへ保存する。

```text
Check ID / 項目：
Result：NOT RUN（実際に確認後、PASS又はFAILに変更）
Device / Android Version / WebView：
APK Commit / Actions Run：
日付 / Light・Dark / 文字倍率 / 縦横 / Navigation mode：
Network：online / offline（Wi-Fiとモバイル通信の両方を確認）
Route / League / Season / Regular・Postseason：
Reproduction Steps：1. … 2. … 3. …
Expected / Observed：
Screenshot：未取得 / 所有者が保管したファイル名
```

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

**追加確認**：MLB2024のHOT → Player → Compare、記録 → Player、選手検索でキーボード表示 → Backでキーボードのみ閉じる操作を確認する。HOTは2024年の基準日・期間が明示され、現在の速報に見えないこと。文字拡大はその端末の最大設定も別途確認する。エミュレーターの200%確認は各OEMの最大文字設定を保証しない。

## Owner release gates — all still pending

Release signing and custody; verified host App Links/`assetlinks.json`; final Privacy/Data safety review; Play account/listing/testers/production submission. No keys, account fees, payments, association file or store release were created by this QA batch. [Play preparation](play-release-readiness.md) keeps these separate from engineering build/emulator readiness.
