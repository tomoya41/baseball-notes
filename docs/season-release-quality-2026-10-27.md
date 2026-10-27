# 2026シーズン・リリース品質確認（2026-10-27）

基準main `b6e6a5c`。新規画面・データ移行・Production Gate変更・有料サービスは追加しない。確定済み実データの更新と、更新を安全に検証する処理を区別する。

## 日本シリーズ

既存の許可済みWikipedia公式APIを1回、2026-10-27T00:45:57.675Zに取得。記事5306035/revision111531245/hash `15534c3a98465e20a615dd0af194cc59e5faa59fcf28e69bc9177a650a89b803`、日程5307595/revision111514888/hash `ffea197acc5c240ebdeb325dbaf00147c111b27429ae5b94e5de5f8f1666f34f`。新Source/ニュース本文/NPB.jp収集なし。

記事の前版との差分は第3戦の未完了Linescore内の投手記入のみ。日程・確定Linescoreは不変。既存2試合の終了証拠を完全一致で再検証し、private rebuildの差分は確定結果追加0・日程変更0・ソフトバンク2勝/DeNA0勝・優勝未確定。`requiresPublication=false`のため、取得日時だけで新asset/pinを作らない。未完了表の`[[東]]`等から予告先発の人物を推測せず、個人成績/MVPは未収録を維持。Home/Series/Game/週間/月間は既存の同じv3を継続する。

既存の第8・9戦Contract検証は保持し、取り込みadapterの7試合固定を改善。追加試合は原記事の日程行と、必要な過去7/8試合の独立した終了証拠を一緒に検証して初めて受理する。引き分け・4勝到達・球場・移動日・nullを検証し、架空の第8/9戦は公開しない。第10戦以降、未対応の順延表構造、旧final訂正/削除は引き続き個別審査が必要。中止・順延をスコアや時計から生成しない。

出典：[記事改版](https://ja.wikipedia.org/w/index.php?oldid=111531245)／[日程改版](https://ja.wikipedia.org/w/index.php?oldid=111514888)。既存の[Wikimedia規約§7](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use)、[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)、[API方針](https://www.mediawiki.org/wiki/API:Etiquette)の条件B、著者・原改版・加工表示を維持。新しい配信許諾を推測しない。

## ドラフト

既存の許可済み公式APIを1回、2026-10-27T00:46:00.026Zに取得。会議5282993/revision111527305/hash `e3943971917e8f67d37b60ff1034bcb3e746abbcfadaa124c32a6bdc2188d883`、代表名簿5209342/revision111304047は不変。会議記事の[固定改版](https://ja.wikipedia.org/w/index.php?oldid=111527305)は同じCC BY-SA条件B。参照メディア本文を取得していない。

厳格parserのprivate監査は122候補行（支配下76/育成46）、5隔離、競合3組。**公開中の122件（支配下74/育成48）と同じ内容ではない。** 氏名・所属表記・個人記事リンク・証拠行が広範囲に変更され、既存`assertCarriedDraftEvidence`が旧証拠の消失を検出した。個人IDを同名/同slotだけで移し替えず、旧公開v4と全予想を保持。新候補をそのまま採用しない。

最新表の保留は巨人育成5位（所属注記の意味/資格）、中日育成1位（全体表との氏名不一致）、ソフトバンク育成9/13位（未対応行）、オリックス育成6位（所属の脚注を含む意味）。旧v4の訂正移行には、旧→新候補ごとの明示記事ID/所属根拠・証拠行の再審査と、予想bridgeの互換性確認が必要。今回、当選球団を色/太字/最終指名先だけから確定しない。新規指名採用0・旧予想変更0。

## Turso / 運用

実際のScheduled EOD [40422665796](https://github.com/tomoya41/baseball-notes/actions/runs/40422665796)は、2026-10-26T13:00:48.393Zの実際のBLOCKED観測（run40326949398）に基づく24時間抑制を復元し、`database_read_suspended`、DB read/write0、Source HTTP0、publish=false、Scheduled Fact evidence=falseで終了。失敗扱いは運用復旧の偽装を避けるため維持。猶予は2026-10-27T13:00:48.393Z（JST22:00:48）までで、期限到来は復旧証拠ではない。

今回の直接DBアクセス0。Account usage/リセット日/制限原因は未確認。復旧後は通常Scheduledの最小read→実際のrows-read→収集/整合性→暗号化バックアップ/復元→公開readbackの順で独立証拠を確認する。静的公開・エミュレーター・ローカルfixtureをProduction証拠へ転用しない。Currentの未完了6試合・partial5日・stale・HOT/Ranking非公開を維持する。

AIの採用判断は[再現評価](optional-ai-evaluation.md)、NPBの未収録分類はaudit script、Androidは[提出準備監査](android-submission-audit-2026-10-27.md)を参照。Pixel/TalkBack・署名継続性・Play所有者Gateは未解決。実際の最終tests/build/review/公開結果はdelivery PRへ記録する。

Rollbackは本変更のrevert。統計pin/過去immutable asset/Canonical DB/個人ストアは変更しない。追加月額費用¥0。
