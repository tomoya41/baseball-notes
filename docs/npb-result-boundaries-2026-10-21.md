# 結果反映の停止条件と追加試合の検証

2026-10-21 22:50 JST確認。基準 main `11b445c` / PR #58。結果の発生を待つための架空更新・公開は行わない。

## 実結果と利用条件

[ドラフト開催要項](https://draft.npb.jp/draft/2026/)は10/22 16:50、[日本シリーズ開催要項](https://npb.jp/nippons/2026/information.html)は10/24開幕予定。確認時点では開催前なので、指名・抽選・日本シリーズ終了結果はすべて0件を維持する。前バッチで取得したprivate候補を再取得せず、Source registry / immutable release / pin / forecastは変更しない。

採用経路は従来のWikipedia正規APIと、revision/hash・執筆者・変更表示・[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)の条件付き利用。公開[Wikimedia利用規約§7](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use/ja)を再確認した。NPB公式は予定と競技規則の独立照合に限り、結果表・記事・画像を取り込まない。取得可能であることだけでは新revisionをadmissionしない。

## 今回追加した検証

日本シリーズの既存schemaに限定した追加であり、共通Series / MLB / CSの規則は変更しない。

- 日付はGame番号順で前進する必要がある。同日・逆転日付やサスペンデッドは拒否する。順延の実施日を規則から自動生成しない。
- 第8戦以降は、それ以前の全試合の終了結果、引き分け、未決着を確認できる場合だけ受け入れる。不明な第7戦を引き分けとして埋めない。4勝済みなら追加予定・追加結果とも拒否する。
- 第8戦は第7戦と同じ主催球団・球場、第9戦は相手側主催・球場で1日の移動日が必要であることを検証する。球場は第1–7戦で明示的に収録した主催球団の球場と照合し、候補が複数なら保留する。実際の日付・球場はSourceから個別に確認し、規則だけから生成しない。特別な球場変更など通常規則外の扱いは別証拠・別レビューで保留する。
- 3引き分け以上なら第9戦を終えても未決着になり得る。第10戦以降は主催・球場等の根拠が未確認なので、予定・終了とも明示的に保留する。9試合で必ず決着すると推定せず、Competitionの試合数上限や優勝確定の根拠にも使わない。
- 第1–7戦の12回引き分けは勝数に加えない。第8戦以降は回数制限による引き分け終了を受理せず、13回の明示的な決着をfixtureで確認する。既存の30回上限は入力サイズの安全上限であり、競技上の延長制限ではない。それを超える形式は別レビューで扱う。
- 延長に入る各回の直前は、独立に保存された両側の累積得点が同点でなければならない。9回以前に決着しているのに12回引き分けや13回終了とする不整合を拒否する。
- fixtureで、延期→明示的な再日程→終了の間もGame IDを維持し、確定済み試合の日付・球場・証拠は通常更新で変更できないことを検証する。予定、延期、中止にはスコアや選手成績を作らない。

これは**Contractの境界検証**。現行の取得adapterが扱えるのは、従来の7試合日程とreview済みLinescoreの形式。順延行・第8戦以降の実際のWikipedia表形式は、公開されたrevisionの取得・権利・identity・完全一致proofを確認するまで引き続き停止する。fixtureをSource evidenceや実データとして公開しない。個人成績は未収録のまま。

## 発表後に進める条件

PR #58の[更新手順](draft-japan-opening-2026-10.md)を再利用する。指名は支配下/育成、順位、候補の記事と所属、抽選参加者/当選を個別に照合し、保存forecast hashを固定する。日本シリーズは実際に終了を確認できる試合だけ、日程表・Linescore・取得日・終了証拠・算術と独立した進出情報を照合する。

未知の表形式、未来の結果、identity衝突、Source/権利不明、既存確定結果の変更・削除、予想変更、保護payloadの意図しない差分、P1/P2は公開停止。確認できた部分だけpartialとして新immutable版へ進め、旧assetは保持する。結果が0件の現在は、新release/pinもPages再配信も不要。

## Tursoと独立Gate

最新の実Scheduled [EOD watcher 39611063654](https://github.com/tomoya41/baseball-notes/actions/runs/39611063654)は10/21 13:47:38 UTC、`SQL read operations are forbidden`で停止。既存runのDB read 1 / write 0 / Source HTTP 0 / retry 0。Freshness run 39570648316もread-blocked。今回新規DB要求0。既知の制限中に接続probeや大きな監査を再実行しない。

Owner Consoleの無料枠残量・リセット・復旧確認後だけ[既存の最小負荷手順](japan-series-release-readiness.md#turso復旧を確認する順序)へ進む。読取成功はScheduled収集、Backup/restore、Coverage/Freshness、HOT/Ranking Gate成功とは別。現在のGate、NPB Current、MLB Historical 2014–2025は変更しない。

Pixel/TalkBack実機QAは別Gate。既存データの削除・署名変更・Play公開は実施しない。追加費用¥0。
