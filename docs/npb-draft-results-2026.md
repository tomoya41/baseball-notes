# 2026ドラフト結果と会議前予想アーカイブ

## 範囲

2026-10-23の「ドラフトも終わったので続きを実施」を受けた、会議後の公開作業。PR #63の予想本文・候補・36配分・理由・出典・pinは変更しない。予想の会議前固定と、アプリへの会議後掲載を明確に分ける。

- 固定：2026-10-22 13:04:06.801 JST。
- GitHub Release公開：同日13:19:59 JST、Release ID 420303524、asset ID 664651245。作成・更新は13:19:58 JST。
- gzip SHA `fbc32d0ed90dc24410b5005da53950ec64f6c0bd95050f3c482e0e22c99af7f4`、本文 SHA `65749456035c4d5620597ab188065efc43459a36df8719d7d240badf74ce6860`。65,710 / 11,505 bytes。
- 会議前にアプリへ掲載したとは表示しない。16:50以降の新規事前予想の公開停止規則は保持する。

## 事後アーカイブの公開条件

明示的な`postmeeting_archive` modeだけを追加。通常の事前公開modeは従来どおり、期限後に未公開のPages assetを新規配信できない。全6 Pages経路のdeploy直前検証は残す。

アーカイブmodeは会議開始後のみ使用でき、公開GitHub APIへ1 bounded request、64KB上限・15秒・retry 0でReleaseを照合する。ID・tag・公開時刻・公開状態・asset ID/size/digest/URL・会議前の作成/更新時刻が固定値と一致する場合だけ採用する。ローカル本文のSHAとlevel-9 gzipのSHAも公開assetのdigestと一致させる。メタデータ時刻だけで過去公開を認定せず、API失敗・変更・期限後のasset差し替えは停止する。

この証拠は会議前の**Release**公開を示すもので、会議前の**アプリ／Pages**公開証拠には転用しない。新しい結果は別のimmutable datasetへ保存し、予想を書き換えない。canonical DBへのwrite、Current roster認定、HOT/Ranking Gateの変更は行わない。

## 結果Sourceの確認

既存のWikipedia正規APIを1回だけ実行。取得2026-10-23 06:19:46 JST、会議記事 page 5282993 / revision 111478113（同日06:13:28 JST）、本文 SHA `2604545385b0300428716a180d942f4f59cdfd66f79bb366f4b652cb31a80563`。代表名簿 page 5209342 / revision 111304047 は不変。本文はprivate `.data/draft-results-20261023/`のみで、Git/publicに含めない。

[Wikimedia規約§7](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use/ja)・[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)の条件Bを維持。固定revision・執筆者参照・ライセンス・変更表示・ShareAlikeを保持する。NPB公式は照合・閲覧導線のみで、公式表をWikipedia由来として取り込まない。

公開前に表形式・独立した大会区分・順位・所属・同じ記事内の表の相違を検証する。不一致・未対応・曖昧なidentityを保留し、未収録を未指名とは判定しない。終了・抽選の証拠も結果行と別に扱う。

## Delivery

取り込み件数・保留理由・tests/builds・review・Pages/HTTP/Androidの実測は、検証後に追記する。

## 採用データと保留

- 新しいimmutable結果版 `npb-draft-2026-20261023-results-v4`。179候補観測、指名122件（支配下74・育成48）、競合3組。Coverageは**partial**、当選球団は3組とも未確認。記事記載の指名であり、入団・現役登録の認定ではない。
- JSON 148,040 bytes / gzip 31,417 bytes。本文SHA `ef7463a83e9c2ce3567a9be4fd15281cdc0f8ba7ef7c2c7bbea3d6e3cda41d52`、gzip SHA `325625ceff1aa5b6b0af5156fe7d6c4119731cad90b797582a107482397e2f1c`。
- 球団別表と12球団の全体表を、球団・支配下/育成・順位・氏名・明示記事リンクで照合。表の色・太字を当選証拠に使わない。仮リンクは日本語個人記事IDにせず、記事のない名前はSource/球団/区分/順位/所属に限定した観測ID。既存canonical player IDへの名前mergeは0。
- 5件を保留：中日育成1位・楽天支配下6位は表内の氏名不一致、巨人支配下2位・ソフトバンク育成9位は所属リンクと表示の不一致、巨人育成5位は中学校表記を含む資格/所属根拠不足。誤記と思われても別名・学校・資格を推測で訂正しない。公開review metadataはslot/hash/理由だけで、異なるrevisionへ流用しない。
- 会議前の64候補・第1〜3版をdeep equalityで保護。旧v3 pinをretainedへ追加し、旧assetも引き続き配信。固定最終版の36枠・SHA・理由・資格記録は不変。
- 新候補のうち6人は、会議前に審査した個別根拠URLと、結果の固定revision・氏名・所属・記事・行hashを別reviewした橋渡しを追加。表記差や未収録を自動正規化しない。最終予想との比較は一致0、相違32、人物照合待ち3、結果未収録1。照合待ち/未収録を不的中率へ混ぜない。
- 同じprivate archive/reviewを独立outputへ再処理して本文/gzip一致。Source追加取得0回、DB read/write 0。raw本文・review作業ファイルはGitに含めない。

## 画面と性能

指名結果をHome/ドラフト入口にし、球団・支配下/育成filter、20件pagination、件数/基準時刻、5件の保留説明、出典を表示。固定予想には実指名の氏名・指名時所属を並べ、会議前Releaseと会議後アプリ掲載を区別。既存の無指定URL/旧保存版/Back/Reload/deep linkは維持。

結果は特集を開いた時の1 fetch、アーカイブ表示は追加1 fetch。Home追加fetch 0。結果148KB、固定版66KBを初期JSへ埋め込まない。公開増分2ファイル213,750 bytes（旧assetは保全）。canonical Facts/Coverage/Gate/Current/MLB/個人保存形式は変更0。Tursoの最新readbackは実施せず、復旧/最新integrity PASSとは報告しない。
