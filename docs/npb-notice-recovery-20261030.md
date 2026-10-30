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

Tursoの最後のScheduled記録 `40947544825` は `database_read_suspended`、DB read/write 0。抑制期限の経過だけでは復旧と判定しない。HOT/Ranking、最新Production整合性、バックアップ証拠の不足は別に残す。ブラウザー操作はWork設定で無効。Pixel/TalkBack/署名互換性は未実施の独立Gate。

## 検証・公開

ローカル全体検証は218ファイル・2,150テスト成功、Windows固有の既存skip 1件。lint/typecheck/Web/Vercel build成功。新規15境界ケースは、人数不一致、引用の欠落、未照合/氏名のみ、重複、コーチ節の混入、打診/推測の拒否、旧transformationの互換性を含む。CI/Android/Pagesの成否は別途追記する。

固定データは[release v7](https://github.com/tomoya41/baseball-notes/releases/tag/npb-events-wikipedia-20261030-v7)。gzip 10,504 bytes / SHA256 `d44ec8503809c8efce85863fb6f840ba7f2c8f70997a1c511f54a50037e32588`、公開JSON 50,921 bytes / SHA256 `93eebf13b7a2d6f173d4cb1b060bc39ccb64f1b943858f20cbd6a69974ec08d9`、identity input `b3c8541c1029cf9c0a033f52b5b00a6da36fa9b2bd13791ad1fe94c77dea73af`。アップロードしたgzipも独立に再取得してhash照合した。これはPagesでの採用・アプリ有効化とは別。
