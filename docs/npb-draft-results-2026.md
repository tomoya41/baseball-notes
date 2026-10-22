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
