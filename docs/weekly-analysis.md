# 週間レポートと任意AI選考

2026-10-26。PR #79の無料AI基盤とコンパクトHomeを継承。正式Fact、canonical ID、保存情報、NPB CurrentのCoverage/Freshness/HOT/Ranking条件は変更しない。

## 公開する分析

- `/MLB/weekly?season=2025&week=2025-09-22`。2014〜2025の収録年度・週を選択。`competition=postseason` は既存の独立したPostseason公開条件に従う。2026 Currentを取得しない。
- `/NPB/weekly?stage=regular`、`npb_cs_first`、`npb_cs_final`、`japan_series`。各区分を独立表示し、CSと日本シリーズも合算しない。
- 月曜〜日曜と直前の同じ7暦日。MLBは既存の試合記録の日付、NPBは保存された日本日付を使う。収録試合、1点差/引き分け、片側10得点以上、球団W/L/T・得失点・1試合あたり得点、両週の範囲確認時のみの前週差を集計する。
- イニング得点がある場合は「何回表裏に何点」を表示。勝因や個人の活躍を得点だけから推測しない。MLBのイニング別得点は現在の公開投影にないため生成しない。
- MLBはHistorical Formを再利用。打者20PA、先発15outs（5.0回）/1先発、救援6outs（2.0回）/2登板以上。打者OPS→PA/HR/H、投手ERA→K/9等の既存並び順。投手の打撃を通常打者欄へ混入しない。アウト数、nullの伝播、先発/救援不明時の抑止も維持する。
- 急上昇は両週で同じ母数を満たし、OPS差>=0.100またはERA改善>=1.00。率を単純平均せず構成値から再計算。短期の変化は能力向上や今後の活躍の保証ではない。母数・期間を併記する。
- シーズン境界/partialではMLBのHOTと前週評価を保留。NPBは日別の正式なcomplete/no_games証拠を使い、取得不能日をno_gamesにしない。CS/日本シリーズはpartialを維持。
- **NPBの週間選手評価は未公開。別名の選考やAIでHOT/Ranking Gateを迂回しない。** 試合/球団総括と分離する。

## データ・通信・出典

新しい第三者source、Raw収集、canonical write、DB問い合わせは0。既存の静的JSON/GZIPだけを読み、元のimmutable assetは変更しない。MLBはForm index/必要月、Directory、Chronology、該当2週のdate Scheduleを使用。Game詳細の大量取得はしない。ScheduleのID集合をChronologyと照合し、Formの世代・区分・期間・Games数も照合。月payloadは最大3、date payloadは最大14（同時4）。週の閲覧時のみ取得し、Homeはリンクだけで新規データfetchなし。

MLBは既存Retrosheet告知をそのまま表示し、ID照合のChadwick/日本語名Wikidataは既存Sourcesへ接続。NPB Wikipedia分は元記事revision・執筆者・CC BY-SA 4.0・抜粋/集計変更を保持する。既存9点の権利確認済み写真のみ再利用し、撮影年・出典を残す。公式ロゴや未許諾写真を追加しない。

MLBの収録最終日と検証世代を表示。payloadに更新日時がないため不足を明記し、閲覧時刻をデータ更新時刻にしない。NPBは採用済みsnapshot/日別公開データの時点を保持。offline fallbackから新しい収集証拠やWatch通知を作らない。

## AIは構造化した非公開候補

プログラムが数値と注目候補を集計した後、モデルへ短い候補参照（C1等）・指標ID・確認済み数値・許される理由分類を渡す。長いhash/canonical IDや数値の転記を要求しない。AIは最大3対象の参照・理由・根拠指標だけを返し、プログラムが正確なID・値・入力hashへ結び直す。

未知の対象、重複選択、不適合の理由、未知/不足の指標、追加文章を拒否。JSONまたは単一JSON code fenceのみを解析し、周囲の説明文は受理しない。失敗は固定コード（INVALID_JSON/SCHEMA_MISMATCH/UNKNOWN_CANDIDATE/UNSUPPORTED_REASON/UNSUPPORTED_METRIC等）で示し、無効な本文・任意エラー文・キーは保存しない。PR #79の失敗本文は未保存なので過去の具体的原因を断定せず、今後の切り分けを改善した。

接続、固定モデル `@cf/meta/llama-3.1-8b-instruct-fp8`、512出力tokens、20秒timeout、1試行、Free/規約確認flagと秘密情報保護は既存adapterを共有。[モデル](https://developers.cloudflare.com/workers-ai/models/llama-3.1-8b-instruct-fp8/)・[API](https://developers.cloudflare.com/api/resources/ai/methods/run/)・[料金](https://developers.cloudflare.com/workers-ai/platform/pricing/)を2026-10-26確認。Freeは日10,000 Neuronsで超過失敗。paid fallback・プラン変更・別アカウントによる回避はしない。

旧日本シリーズ文章と週間選考で**同じUTC日次marker、入力hash marker、Actions cache、concurrency group**を共有。失敗も使用済み。同じ入力の翌日再実行もskip。cache/markerを消して再試行しない。中断はATTEMPT_STARTED/requests:null。公開済み情報だけのreview artifactを7日保持し、公開repoで取得可能な前提で扱う。人の確認欄はNOT_RUNのまま、自動PASSにしない。

## 操作・月曜更新の準備

`Baseball optional AI editorial candidates`（既存 `npb-ai-insights.yml`）は手動のみ。`analysis=weekly`、年度、Monday、区分を指定し、`generate=false` で統計・候補を確認。`generate=true` はOwnerのFree/規約確認・Secretsと予算が揃った時だけ。旧経路は `analysis=japan_series` で保持。

```powershell
$env:WEEKLY_SEASON='2025'
$env:WEEKLY_WEEK='2025-09-22'
$env:WEEKLY_COMPETITION='regular'
npx tsx scripts/prepare-weekly-ai.ts
```

本番AI cron・自由文自動公開は無効。将来はJST前週決定→許諾済み新データの正式採用→未変更hashはskip→母数/範囲確認→1回選考→参照照合→編集確認→別のimmutable公開PR。MLB Historicalの同じ過去週を毎週再生成しない。NPBの個人成績が不足する間は選手候補を作らない。

Actionsの復元キーと有効な日次予約履歴を確認できない場合は `BUDGET_STATE_UNAVAILABLE`、0 calls。準備だけの新しいcacheを履歴の復元と見なさず、翌Runも自動で再開しない。cacheを消したり、空の予約を作って解除しない。cacheは永続台帳ではないため、cron有効化前にはレビュー済みの入力hash台帳・最新Runとの照合を追加し、履歴の欠落を回復可能にする。[復元キーの定義](https://github.com/actions/cache/blob/v4/restore/action.yml)を2026-10-26確認。

AI停止時も統計は動作する。rollbackは週間リンク/routeと任意選考を戻すだけで、データ・旧URL・保存情報のmigration/削除は不要。追加月額¥0。
