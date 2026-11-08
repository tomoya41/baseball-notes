# 2027年への安全な入口

`#/NPB/season?season=2027` を「もっと見る」へ追加。年度を切り替えて2026年の保存済みホーム・試合・ポストシーズンへ戻れる。2026年ドラフト結果、出典付き選手動向、Myへの導線を維持する。

2027年の日程はアプリ未登録、結果・選手成績は未収録であり、試合なし・出場なし・0件の完全収録・正式開催前とは判定しない。公式カレンダーmetadataは作成しない。既存Current routeへの明示的な未来年度指定もadapter読込前に止める。共有/Deep Linkは未来年度の入口を保持し、2026年へ黙って置き換えない。既存パラメーターなしURLは2026年のまま。My、保存情報、2026年の過去記録は移行・削除しない。

新年度の実データを有効化するには、許諾されたSource、年度別calendar/competition、canonical照合、Coverage/公開条件、検証済みのsnapshotを別途レビューする。2026年のGateやnf3契約をコピーしない。バックエンドも未確認calendarをDB接続前に拒否する。

2026-11-06 JST。NPBは11月4日に[2027年のセ・リーグ公式戦日程](https://npb.jp/news/detail/20261104_03.html)を発表した。アプリの取得・保存・表示用のSourceとしては未採用。シーズン比較への明示的な2027年指定も、既存の年度入口で受け止める。2026年へ戻る操作では選手・球団ID、比較年度、役割、指標を引き継ぐ。年度別の配信先を追加する際は、採用済みデータでcalendar・Coverage・HOT/RecordsのGateを検証する。

## 2026-10-26 棚卸し（DB readbackではない）

公開済みDirectory/Catalogと現行immutable v8から既存の厳格auditを再実行した。Directory基準日は2026-10-12、Historical archive取得日は2026-10-17。

- 保存Directory740人、Historical照合579人、過去成績なし161人。1年度90人・複数年度489人。独立ID bridge未確定69人。Directoryは登録公示・現役確認ではない。
- Historical2000〜2025、600人、3,524球団別年度行（打撃1,927・投球1,597）。新規採用0。partialを維持。
- プロフィール収録: 生年月日667、投打671、守備位置520、身長584、体重487、ドラフト年623、学校456。現在の背番号・在籍時点を証明する完全な所属履歴は未収録。
- Regular quarantine59件（旧資料の55件から再計数）。5件は未対応表、残りは率/構成値の不整合や数値形式等。`2|19`、`0|0`の破損セル、WHIP/OPSの不一致を推測で受理しない。
- CSは12試合・179集計行。残る257観測は本人照合不足。明示リンク5人（フランミル・レイエス、ダーウィンゾン・ヘルナンデス、藤森海斗、アンダーソン・セベリーノ、ホセ・ルイーズ）にも独立bridgeが不足し、その他は省略名を根拠なく伝播できない。新たな独立証拠なしに再importしない。
- 未完了6試合は新しい終了証拠がないため復元0。Currentの最新canonical状態・Backup・Scheduled成功をこの静的auditから認定しない。

## 公式発表とアプリ収録の境界（2026-11-07確認）

セ・パ公式戦の2027年3月26日開幕予定と、11月4日のセ・リーグ公式戦・交流戦の発表を既存の年度入口で案内する。公式サイトで確認できる日程と、アプリへの採用、結果・成績の取得は別の状態。[年間行事予定](https://npb.jp/event/2027/)・[日程一覧](https://npb.jp/games/2027/)・[セ・リーグ発表](https://npb.jp/news/detail/20261104_03.html)・[交流戦発表](https://npb.jp/news/detail/20261104_02.html)

- 未承認年度では公式リンクのみ表示する。日程表、開始時刻、予告先発を取り込まない。手動の収集・日次収集・日次dry-runも、予定収集と同じ承認済み年度をDB初期化前に確認する。Historical Backfillは既存の2026年限定を維持する。
- 承認後は、年度と競技区分ごとに収集範囲、providerの年度識別、追加・延期・変更の証拠、Game/Fact/Dayの完全性を検証する。calendarの承認・一部日程・初回Factは、それぞれ単独ではCoverage、HOT、公式ランキングの公開根拠にならない。
- `npb-collector.ts`、`npb-day-collector.ts`、`npb-eod.ts` のnf3経路は確認済み2026年に限定。新年度のprovider採用後に年度引数を検証してから経路を拡張する。`generate-npb-season.ts`、`generate-npb-game-surface.ts`、`npb-records.ts` の2026固定の配信先・schemaは既存snapshot用に維持し、2027のProjectionは年度別pin・readbackとセットで追加する。

## Source / AI / owner gate

2026-10-26に [Retrosheet CSV配布](https://www.retrosheet.org/downloads/csvdownloads.html) と [利用条件](https://www.retrosheet.org/notice.txt) を再確認。条件付き再利用は可能だが、掲載された処理済みデータの上限は2025年で2026 Currentを供給しない。[MLBAM notice](https://gdx.mlb.com/components/copyright.txt) は現在の大量取得・再配信用途の根拠にならず、既存2026 Gateを維持する。Wikipediaの別記事を参照できても、全season/playerの収録許諾・同一性・完全性を代替しない。

AIは2026-10-26 UTCの既存実試行を再利用上限として保持し、新しい実呼出し0。無料枠・hash台帳・候補非公開を維持する。Pixel実機・TalkBack・署名継続性・Play公開は未検証の独立Gate。追加月額費用¥0。

Rollbackは本PRのrevertのみ。データ、DB、immutable release、個人ストアのmigrationはない。
