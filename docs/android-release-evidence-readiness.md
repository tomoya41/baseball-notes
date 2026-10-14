# Android Release Quality / NPB Evidence Resolution

2026-10-14、開始時のmain `705bef1`（PR #31）を確認。未マージPRなし。今回の範囲はAndroid検証の拡充、実画面で見つかった文字拡大不具合の修正、実機QA準備、NPB証拠の問い合わせ準備。**Source / canonical / payload / Gate / persistence contractの変更はない**。追加月額費用¥0。

## Android：実施・未実施の境界

ローカルにADB、標準Android SDK、操作可能な物理端末がなく、物理QA・OEMジェスチャー・TalkBackは**NOT RUN**。Webの360px確認やCI Android36を実機確認とは呼ばない。所有者が[短いインストール手順・結果票](android-physical-qa-results.md)へDevice / Android Version / APK Commit / Reproduction Steps / Screenshotを記録できるようにした。詳細は[全チェックリスト](android-device-qa.md)。

既存native Back、deep link、Activity lifecycle、150%文字、回転、Light/Dark、実UI経由のFavorites/Collections/Watch、オフライン初回起動とキャッシュ再起動・通信復帰の検証を維持する。`ReleaseQualityTest`へ追加した独立検証は次のとおり。

- MLB2024のHOT：実際のHistorical成績・基準日、最大20件の描画。
- MLB2024 Records：実際の成績とPlayer導線。
- Player Compare：名前検索から既存canonical選手を2名選択し、同年の実成績2列を確認。名前検索でidentity mergeを行わない。
- 360px / OS文字倍率200%のPlayerをスクリーンショットで確認。OEMの最大倍率を網羅したと主張しない。
- Androidの実touchで検索入力へフォーカスし、WindowInsetsのIME表示を確認。OS BackでIMEだけを閉じてSearchが維持されることを検証。DOMフォーカスだけで「キーボード検証済み」としない。

初回[Android36 Run 38579825176](https://github.com/tomoya41/baseball-notes/actions/runs/38579825176)はAPK /unsigned AAB、既存検証と追加の3 instrumentation tests、実IME /BackまでPASS。ただし取得した200%文字のスクリーンショットで、年度とCompetitionが切れ、OPSとHRのglyphが隣のセルへ出ることを発見。ページのscrollWidthだけではこの問題を検出できなかった。

`MainActivity`の既存Capacitor WebViewListenerからOS fontScaleをCSSのlayout用変数・large-font属性に反映する。ユーザーの文字倍率やWebView textZoomは縮小・無効化しない。1.5倍以上ではヘッダーとPlayer年度・Competition操作を折り返し、headlineのセル幅と基本ナビの高さ・下部余白に必要な幅を確保する。通常文字倍率のデザインは維持する。Cold load、Activity recreation、configuration changeへ適用し、DBやネットワークを追加しない。

追加のnative回帰は文字glyphのRangeがセル内に収まること、ヘッダー操作の表示範囲、WebView textZoomが保たれることも確認する。対象はCSSとnative presentationだけで、大規模再設計・評価値変更・Source変更はない。release key、署名設定、App Links・assetlinks、Console、支払い・ストア公開は変更しない。

Codex Reviewの初回P2（テストのIME APIがAndroid30以上専用）は既存AndroidX `ViewCompat /WindowInsetsCompat`へ修正。Android24〜29やOEM実機での実行はまだNOT RUN。

## NPB：現状と運用証拠

新しい[read-only integrity Run 38579831563](https://github.com/tomoya41/baseball-notes/actions/runs/38579831563)のintegrity stepはPASS。**workflow全体はFAIL**で、Freshnessを健全とみなした結果ではない。

| 項目 | 前回PR #31 → 今回 |
|---|---|
| Games / pending | 899 /6 → 899 /6 |
| 保存済み打撃 /投球Facts | 23,548 /7,142 → 不変 |
| 日付Coverage | 166 complete /25 no_games /5 partial /196 total → 不変 |
| partial日 | 4/9、4/14、5/3、6/20、9/9 → 不変 |
| evidence findings / input errors | 0 /0 → 0 /0 |
| 保護対象count/hash | 前回監査のafterと今回beforeが一致、今回before/afterも不変 |
| canonical書き込み / nf3リクエスト | 0 /0 |
| reviewed calendar終端 | 10/8 scheduled、season in_progress、seasonEndConfirmedなし |
| Freshness | effectiveDate10/12、staleのまま |
| HOT /Ranking | 非公開のまま |

実際のscheduled EOD [38547825206](https://github.com/tomoya41/baseball-notes/actions/runs/38547825206)は10/14を `outside_reviewed_regular_calendar` として正常skip。Sourceリクエスト0、DB書き込み0、publishRequired false。手動publish [38549476125](https://github.com/tomoya41/baseball-notes/actions/runs/38549476125)は成功したが、scheduled Fact収集証拠ではない。scheduled Daily [38482059458](https://github.com/tomoya41/baseball-notes/actions/runs/38482059458)の期間外skipも代用しない。今回の読み取り監査で新たなScheduled Fact収集・publication callbackは作らない。

freshness診断は期間外収集、10/12 snapshotのstale、`retentionVerified=false`を区別して報告している。外側のfailureを正常skipの不具合として繰り返し修正せず、terminal snapshot保持を確定するには既存の独立した終了確認・保持証拠が必要。manual Backup drillの成功だけで保持／終了／scheduledProduction条件を満たしたと扱わない。

6試合は[問い合わせ案とpermission / adapter設計](npb-ending-evidence-permission.md)へ整理した。144打撃・33投球は前回dry-run候補で保存Factsではない。新しい終了証拠と利用条件の回答があるまで大量再取得・再dry-run・復元を行わない。既存のnf3限定利用、公式secondary-use制限、provider識別を維持する。

## Play公開前のOwner Gate

物理QA・TalkBack、Release Signingとkey custody / backup、verified App Links、Privacy / Data safetyの最終確認、Console、listing / screenshots、必要なtesters、production submissionは未完了。個人開発者の実名・連絡先を推定してdocsへ記入しない。

[Play準備](play-release-readiness.md)の公式資料を再確認。登録費US$25は一回の費用で未実行。対象の新しい個人アカウントは12人の14日間closed testとproduction access申請が必要。所有者のアカウント要件と工程は別Gateで、エミュレーター成功からPlay-readyとは判断しない。

## 回帰と公開方針

最初のローカルfull tests **106 files /1,252 tests PASS**、lint /typecheck /Web /Vercel build PASS。変更前JS `index-CBLvDdCB.js` 482.57KB（gzip149.25KB）、CSS `index-Boa71_gd.css` 65.51KB（gzip11.96KB）。文字拡大修正後のbuild /emulator /性能は最終実行で再確認する。Home追加fetch0、payload・評価ロジック変更0。

公開HTTPはNPB core7 payloadのhash不変、6 pending GameのID/date/teams/score/partialと保存B/P0を検証。MLB Regular /Postseasonの38 HTTP契約検証は2014〜2025の12年、27,623 /472 Games、既存canonical ID継続、2既存payload hash不変を確認。これは全63,167ファイルをHTTP取得したという主張ではない。

Android build /emulator /Reviewの最終結果は実行後に記録する。初めはdocsとtestのみで再deploy不要だったが、実画面で発見した文字拡大不具合の修正が入ったため、最終検証・review後にmain merge、正式なread-only publishによるPages公開とHTTP smokeを実施する。NPB7 core payloadとMLB releaseを維持し、manual publishをScheduled Fact証拠に流用しない。

## 次の判断

まず所有者の物理端末でdebug APKを使い、短いQA票を埋める。失敗した項目だけ再現・修正する。同時にnf3 /NPB問い合わせ文を所有者が確認し、承認後に送信する。未返答中はNPB repairではなくAndroid品質／Play準備を進める。
