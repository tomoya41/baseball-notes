# NPB契約通知の追加 — 2026-10-30

基準はPR #106後のmain `f496376`。NPBの実データ補完を対象とし、UI、Currentの所属・背番号、Facts、HOT/Ranking Gateは変更しない。追加月額¥0。

## 採用する4件

Wikipedia「2026年の日本プロ野球」の10月29日欄にある楽天の来季契約通知から、**渡辺翔太、古賀康誠、石原彪、入江大樹**の4件を追加する。種別は戦力外通告、確定度は `encyclopedia_record`。公式発表の直接確認や現在所属の証明とは扱わず、発表日・契約終了日・移籍先はnullのまま。

同じ6選手の列挙にある金子京介は原文に選手記事へのリンクがないため、既存の本人IDがあっても名前で結び付けない。大栄利哉は既存Directoryと独立IDの橋渡しがなく保留。コーチ退任や新スタッフの発表を、選手の引退・移籍へ変換しない。

| 検証 | 結果 |
|---|---|
| 旧62件のID・種別・日付・本文・statement hash | 全件同一。sourceRevisionだけ新しい共通出典版へ進む |
| 旧62選手の本人情報 | 全件同一 |
| 新規 | 4件・4選手。Canonical UUIDの新規作成・再採番は0 |
| 合計 | 66件・66選手。Coverage partialを維持 |
| Identity | 既存Canonical UUID/NPB ID/QID + 原記事のQID、唯一のNPB ID、revision、本文hashを個別照合 |
| 既存identity archive | `d4946a34dd2c2c72bc10ee0a2bf0b2336690a705f51d38198d00bb35f9f9b092`、2026-10-17保存版 |
| 新規article association | 既存recovery registryへ4件だけ追加。探索用188候補は採用しない |
| 契約更改の実データ | 0件、未収録。交渉・打診を合意へ変換しない |

## 出典・権利

確認日：2026-10-30 JST。既採用の[年表](https://ja.wikipedia.org/w/index.php?curid=5145794&oldid=111569587)、revision **111569587**、改版2026-10-29T22:25:22Z、取得2026-10-29T23:56:52.366Z。本文SHA256は `081bdf42c96ff36a03b09aadcfc926d4c1159f51122889a6895b71fae3d03d13`。

[Wikimedia Terms §7](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use#7._Licensing_of_Content)、[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)、[API etiquette](https://www.mediawiki.org/wiki/API:Etiquette)を再確認。原記事・版・[執筆履歴](https://ja.wikipedia.org/w/index.php?curid=5145794&action=history)、抽出・分類の変更内容、ライセンス、継承条件を維持し、取得・保存・加工・Web/Android再表示は条件付き採用Bの範囲とする。引用先メディア本文・写真・ロゴの利用権とは区別する。

今回の年表取得は公式APIへの有限1回、キャッシュ後の再処理は通信0。追加の調査は本人未照合CS記事5件へのまとめ取得1回、過去成績の不整合がある現役20記事へのまとめ取得1回に限定し、それらの新規データは採用していない。User-Agent/maxlag/キャッシュを使用し、第三者の記事本文、非公開API、Tursoへはアクセスしない。Wikidataの[CC0条件](https://www.wikidata.org/wiki/Wikidata:Licensing)は確認したが、今回新たなWikidataデータを取得・採用していない。

## Parserと互換性

個別引用の付いた最初の契約通知節と、別引用のコーチ退任節、新スタッフ発表が続く**確認済みの厳密な構文だけ**を追加した。人数と列挙数、重複、引用位置、全文の末尾を照合し、氏名のみの項目は未確定の位置として数えるだけでID検索をしない。推測、打診、人数不一致、別の文法は引き続き隔離する。

旧schemaVersion 1の構造と旧transformation値を保持し、新しい「個別引用付き最初の選手通知節」を表すtransformation値だけを追加で許可する。全旧releaseはそのまま検証できる。新releaseは新しいhash/URLで固定し、v1–v6を上書きしない。既存アプリのpinを維持してデータを先に配信し、公開JSONの照合後に別の小さなPRで有効化する。rollbackは旧pinへ戻し、新旧assetは保持する。

## 追加できなかったデータ

過去成績の不整合がある現役20選手を最新revisionで再検証したが、追加可能な年度行は0、既存正常行の変更0。統計検証は緩めていない。CSの明示リンク5選手は、既存Canonicalとの独立した橋渡し不足、またはQID/Directory不足を確認し、今回追加0。これらの個別確認でHistorical全59件が解決したとは扱わない。

Tursoは[Scheduled 40969575586](https://github.com/tomoya41/baseball-notes/actions/runs/40969575586)の2026-10-29T22:56:39.701Zの最小read 1回で `SQL read operations are forbidden` が再発した。その後の[40976633625](https://github.com/tomoya41/baseball-notes/actions/runs/40976633625)は `database_read_suspended`、DB read/write 0、再試行抑制期限2026-10-30T22:56:39.701Z。本作業は既存のログだけを読み、手動DBアクセスは0。アカウント側の具体的原因・quota解除を推測しない。HOT/Ranking、最新Production整合性、バックアップ証拠の不足は別に残す。ブラウザー操作はWork設定で無効。ADB接続端末0のためPixel/TalkBack/署名互換性は未実施の独立Gate。

## 検証・公開

ローカル全体検証は218ファイル・2,150テスト成功、Windows固有の既存skip 1件。lint/typecheck/Web/Vercel build成功。新規15境界ケースは、人数不一致、引用の欠落、未照合/氏名のみ、重複、コーチ節の混入、打診/推測の拒否、旧transformationの互換性を含む。CI/Android/Pagesの成否は別途追記する。

固定データは[release v7](https://github.com/tomoya41/baseball-notes/releases/tag/npb-events-wikipedia-20261030-v7)。gzip 10,504 bytes / SHA256 `d44ec8503809c8efce85863fb6f840ba7f2c8f70997a1c511f54a50037e32588`、公開JSON 50,921 bytes / SHA256 `93eebf13b7a2d6f173d4cb1b060bc39ccb64f1b943858f20cbd6a69974ec08d9`、identity input `b3c8541c1029cf9c0a033f52b5b00a6da36fa9b2bd13791ad1fe94c77dea73af`。アップロードしたgzipも独立に再取得してhash照合した。これはPagesでの採用・アプリ有効化とは別。

[PR #107](https://github.com/tomoya41/baseball-notes/pull/107)は `c65b3a8ec10ea35331b01141e02d5c98c1aad9e2` へマージ。レビュー対象 `42281e8` はCodex Review指摘なし。[Foundation](https://github.com/tomoya41/baseball-notes/actions/runs/40977793953)で218ファイル/2,151テスト成功、[Android debug APK/unsigned AAB build](https://github.com/tomoya41/baseball-notes/actions/runs/40977794052)成功。この自動PR実行はエミュレーターをskipしており、実機/エミュレーター成功とは呼ばない。先行[Pages配信](https://github.com/tomoya41/baseball-notes/actions/runs/40978464032)はv6 pinを維持したデータ先行段階。66件版の有効化・Android実行の結果は後続PRで個別確認する。

先行Pages artifact **12943223840**（ZIP 301,838,260 bytes、SHA256 `c637a647cd5b9a9ee5da708c000fdcf8ef7635cd6d59a660c8033ed3719256c1`）を全件検査。既存65,729データファイル/362,320,715 bytesはhash・件数とも同一、変更/削除0。追加はv7 JSON 1ファイル/50,921 bytesだけで、合計65,730ファイル/362,371,636 bytes。v7と旧v6の公開HTTP 200/body hash、公開HTML/entry JSのartifact一致も確認した。ここまでアプリのactive表示は62件のまま。次のPRはpinをv7へ進め、v6をretainedへ移すだけで、新旧データの公開URLを保持する。

その後の[定期候補40992863758](https://github.com/tomoya41/baseball-notes/actions/runs/40992863758)、改版111571656も確認。66件の意味・本文・statement hash・使用選手のidentityと、隔離107件がv7と一致した。identity input hashの差は、追跡済みregistryのLF/CRLF表現差だけで再現できたため、ID変更・追加事象とは扱わない。元の入力hashを上書きせず、新版の自動再配信も行わない。確認済みrun/revisionはignored automation-stateに記録した。定期候補は今回の手動開発・レビュー・公開承認と別に扱う。

有効化PRの初回Android実行は、[standard 41021274536](https://github.com/tomoya41/baseball-notes/actions/runs/41021274536)・[actual 16KB 41021278100](https://github.com/tomoya41/baseball-notes/actions/runs/41021278100)とも**37/38、失敗1**。追加4選手の新規テストは成功したが、既存の出典リンク検証1か所が旧版111560963を固定していた。実際の採用出典111569587へ期待値を修正し、3か所の出典検証を一つの明示的なテスト定数にまとめた。generic URLへの緩和やテストskipは行わない。150%/200%では縦スクロール後の選手カードも撮影・可視範囲検証する。アプリ本体・pin・データはこのQA修正前後で同一。初回失敗を成功として数えず、修正版を両環境で再実行する。

修正版 `863ab7d22df61337215fb1e3b5aca94779eec670` はCodex Review指摘なし。[standard再実行41023415702](https://github.com/tomoya41/baseball-notes/actions/runs/41023415702)・[actual 16KB再実行41023419396](https://github.com/tomoya41/baseball-notes/actions/runs/41023419396)とも**38/38 + process restart 1成功**。実ページサイズは4,096/16,384 bytes、16KB JNI事前検証2件も成功。4選手それぞれの唯一の結果、日付、固定版/本人照合記事/Canonical profileリンク、コーチ情報を混ぜないことを実データで確認した。

両emulator artifactを独立取得してZIP hash/CRC、instrumentation結果、page-size、restartを検証した。standard **12963561026**（10,246,562 bytes、SHA256 `c786f23684c2df2a26c81ac87740ba233bbc80580d4206257b02d7f1f47b3aa4`）、16KB **12962474524**（10,262,164 bytes、SHA256 `7fca584cfd63989aa6a55222a0355cee12a4ab62b0962f471f31047930a32a5a`）。360px Light/Dark × 通常/150%/200%の選手カード計12画像を目視し、通常サイズの既存デザイン、文字拡大後の縦スクロール、名前・リンク・下部ナビの利用可能性を確認した。Pixel/TalkBack/公開ブラウザーの実操作の代用とは扱わない。
