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

このバッチで文字拡大修正まで検証したAPK：[Run 38582519304](https://github.com/tomoya41/baseball-notes/actions/runs/38582519304)、APK commit `88da9a4`、SHA256 `3fc935e113aafa419a03efc084c9df36c0b0657b2a6b31378d0f15f35672ac09`。後続docsのみのcommitとは区別して記録する。エミュレーターは3テストPASSだが、この票の実機結果はすべてNOT RUN。

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

## 最短チェック（10〜15分、失敗があれば追加時間を確保）

| 順番 | 操作 | PASS条件 | 実機結果 |
|---|---|---|---|
| 1 | オンライン初回起動 → NPBホーム、9/9の試合、9/28の復元済み試合 → MLB2024選手 | クラッシュなし。9/9は一部未収録、9/28は成績あり。MLBは過去年度、NPB HOT/Rankingは未公開と分かる | NOT RUN |
| 2 | 選手 → 操作 → 整理 → Back／端からの戻るジェスチャーを2回。全チェックリストのdeep link例も開く | 子画面、親画面の順で閉じ、フォーカスが戻る。正しいID／年度、無効URLは安全な案内。Activity重複なし | NOT RUN |
| 3 | 選手と球団をお気に入りへ追加。`実機QA`コレクションを作成して選手を追加。探索条件を保存。フォローのルールを1つ変更 | 対象・保存条件・ルールを開ける。Push許可を強制せず、リアルタイム通知に見えない | NOT RUN |
| 4 | OS設定から強制停止 → 再起動。ホームへ戻して再開。ダイアログ／フィルターを開いて回転 | 保存内容・URL・年度・公式戦／Postseasonを維持。残った暗い背景や操作不能なし | NOT RUN |
| 5 | 選手／試合をオンラインで開く → Wi-Fiとモバイル通信を両方OFF → 強制停止・再起動。未キャッシュの対象も開く | キャッシュはオフライン／保存済み表示、未取得は再試行案内。オフラインでWatch基準値を進めない | NOT RUN |
| 6 | 通信ON → 再読み込み → フォローの変化を確認 | 実データが戻る。同じデータで重複通知を作らず、ルール・既読状態を維持 | NOT RUN |
| 7 | ライト／ダーク／端末設定。OS文字150%と最大。縦横の選手／試合／My／HOT | 名前・スコア・小数・操作が読みやすくタップ可能。ページ全体の横はみ出しなし | NOT RUN |
| 8 | TalkBackをON → 基本ナビ、年度、指標説明、ダイアログを閉じる、フォローのルール | 名前・選択状態・値を読み上げ、順序が自然。ダイアログ内にフォーカスを保ち、閉じると戻る。無名ボタン／閉じられない画面なし | NOT RUN |

Use [full checklist](android-device-qa.md) for offline first-install (separate disposable install), corrupted/quota/reset isolation, lifecycle and all release cases. Do not alter daily-use saved data for destructive tests. If a row fails, record observed vs expected behavior, device/font/theme/navigation, URL/year/scope, online/offline, APK Run/commit and a screenshot without personal information. This is enough for a reproducible fix; do not guess PASS.

**追加確認**：MLB2024のHOT → Player → Compare、記録 → Player、選手検索でキーボード表示 → Backでキーボードのみ閉じる操作を確認する。HOTは2024年の基準日・期間が明示され、現在の速報に見えないこと。文字拡大はその端末の最大設定も別途確認する。エミュレーターの200%確認は各OEMの最大文字設定を保証しない。

## Owner release gates — all still pending

Release signing and custody; verified host App Links/`assetlinks.json`; final Privacy/Data safety review; Play account/listing/testers/production submission. No keys, account fees, payments, association file or store release were created by this QA batch. [Play preparation](play-release-readiness.md) keeps these separate from engineering build/emulator readiness.

## 2026-10-16 Phase 2補足

最新版のHistorical-only OB検索・年度推移・Favorite再開を実機でも確認する。例: NPB → 選手 → 過去の選手・OB → 阿部慎之助を検索 → 別年度候補 → 年度比較 → ★ → My → 過去年度へ戻る。PASSは正しい収録年度・出典が表示され、2026 Currentプロフィールへ誘導されないこと。200%文字拡大時は「ホーム/試合/選手/記録/My」の全ラベルが意味を保ち、切断・重なりなく操作できること。OS倍率を下げてPASSにしない。

今回の物理Pixel接続は検出されず、新APKでの操作とTalkBackはNOT RUN。前回のPixel初回起動成功と今回の検証を混同しない。新しいEmulator証拠はPhase 2 deliveryへ記録する。
