# 日次データ基盤（2026-09-24）

NPB実データ第1弾は既存のSQLite/libSQL・Migration・Source Registry・Raw Retentionを再利用して追加した。`migrations/002_npb_daily.sql`はsource ID mapping、日程/結果、Stage別完了状態を追加し、既存の選手試合Factテーブルを必要な列だけ拡張した。外部nf3 HTMLは`src/data/npb-nf3.ts`で列とページfingerprintを検証してからDomainへ正規化する。`src/data/npb-repository.ts`がtransactional batch upsert、履歴照会、試合/選手紐付けを担い、`src/data/npb-collector.ts`が逐次取得とSource/Stage単位の失敗分離を担う。Rawは既存ローカルArchiveの`.data/raw/nf3/<date>/<sha>.html.gz`に14日置き、manifestで期限管理する。概要は[NPB収集記録](npb-ingestion.md)。

次タスクでTurso FreeのRemote DBとGitHub Pagesの公開Payload配信を追加した。Object Storageは採用せず、Remote Rawはrunner内の一時保存に限る。詳細は[リモート運用](npb-remote-delivery.md)。GitHub Actionsの予定枠はJST 03:37のままで、`NPB_COLLECTOR_ENABLED=true`まで無効。今季選手全員の収集はアクセス負荷とID検証の問題から未実装で、選手Stageは常にpartialと記録する。

## 現在の到達点

この段落は先行実装したMLB歴史データの説明。NPBの限定実収集は冒頭と[NPB収集記録](npb-ingestion.md)を参照。2025年Retrosheet試合結果の **許諾済み歴史データ** を収集可能。`scripts/collect-standings.ts` は公式配布ZIP内の `2025gameinfo.csv` をProviderとして解析し、外部球団IDを内部IDへ変換し、2,430試合FactをSQLite互換DBへupsertする。指定日までに終了した試合からMLBの6地区・30球団の順位を算出し、`standings_daily`へ永久Snapshotとして記録する。`public/data/standings/mlb/<date>.json`は自前の静的読出しPayloadで、`StaticStandingsRepository`がアプリ側で検証して読む。NPB Homeの順位だけ実Payloadへ切り替え、Player/Ranking/Analysis/MATCHUP/WATCHの架空サンプルは維持している。Androidは公開Pages JSONを参照する構成にしたが、既に配布済みの古いバンドルは更新されない。

流れ：Retrosheet ZIP → CSV parser → wire validation → team ID normalization → GameFact validation/quality gate → libSQL/SQLite repository → StandingsSnapshot calculation → DB → static JSON → app repository。外部SourceのURL・ID・列名はProvider内に閉じる。ユーザーのページ閲覧時にはRetrosheetへアクセスしない。

## Sourceと利用条件

`src/data/source-registry.ts`に候補のleague、source type、priority、URL、確認日、更新頻度、利用状態、対象categoryとnotesを集約し、DBの`data_sources`へ同期する。MLBで有効なのは[Retrosheet 2025 CSV](https://www.retrosheet.org/downloads/csvdownloads.html)。NPBにはnf3の限定実証を追加した。[利用通知](https://www.retrosheet.org/notice.txt)は商用を含む再利用を許し、**指定文の目立つ表示**を要求する。Payloadに原文を含めたが、順位画面を公開する際はUIにも目立つ位置で表示すること。Retrosheetは訂正可能で、MLBの現行シーズンを日次提供するものではない。

NPB公式、MLB Stats、Baseball Savantはこの経路で停止。nf3は2026-09-24に公開ページの明示的禁止を確認できない範囲で限定実証へ変更した。公式→二次Sourceというpriorityは保存するが、自動fallbackで出典を混在させない。新Source採用時は権利、認証、無償上限、更新、項目欠損、canonical ID対応、異常時の停止を確認し、Provider単位で有効化する。NPBの試合日程・結果と確認済み選手の打順は限定取得できたが、全選手と高度投球分析は未解決。

## SQL、Archive、費用

選定した形式はSQLite互換SQL。実装は`@libsql/client`のローカル`file:`、本番相当のリモート接続はTurso Free。同じMigration/Repository SQLを使う。Turso Freeは[現行料金](https://turso.tech/pricing)で5 GB・月500M行read・10M行write・100 DB。アプリに認証tokenを配らず、GitHub Secretsでcollectorだけが書き込み、アプリは静的JSON/将来の自前APIを読む。Turso DBは東京リージョンに作成済みで、Freeかつ支払い方法未登録。容量/行数の監視と上限時停止を条件にする。

[Supabase Free](https://supabase.com/pricing)はPostgres 500 MB、非アクティブ1週でpause、無料自動backupなし。SQL/APIは有用だが、この小規模・書込み1回/日・静的配信優先の構成ではTurso候補を優先する。どちらも無償枠が将来変わり得る。[Cloudflare R2 Standard](https://developers.cloudflare.com/r2/pricing/)は10 GB-month、月100万Class A/1000万Class Bが無料だが、超過すると従量料金が発生する。月額0円を絶対条件とするため**今回は採用・作成しない**。保存形式だけ`ArchiveStore`で分離し、実装は`.data/archive/retrosheet-csv/2025-game-facts.json.gz`のローカルgzip。これは同一マシンの障害に弱い。オフマシンの恒久バックアップは未実装で、クラウド稼働中も残るリスク。

Migrationは`migrations/001_data_foundation.sql`。`schema_migrations`でバージョン管理し、DBへ手動だけの変更をしない。`game_facts`が恒久Fact、`standings_daily`が恒久Snapshot、`derived_payloads`が再生成可能な集計、`display_cache`が短期Cache。選手試合打撃/投球、投手登板、打席、master history、transactions等のイベント、season final用テーブルは保存先だけ確保し、未確認Sourceからは書き込まない。全投球をApp DBへ投入しない。`ingestion_runs`は取得・追加・更新・スキップ・失敗を区別し、`raw_response_manifest`が期限付きの取得ファイルを管理する。

Retentionは設定値`src/data/retention.ts`に置く。Fact、順位履歴、最終成績、歴史記録は削除しない。season-total diagnosticは30日、raw responseは14日、display cacheは7日、temporary importは3日を初期値とする。`cleanupExpired`は期限付きraw manifest/derived/cacheだけを対象とし、raw object pathが指定root外へ出る場合は全削除を拒否する。ファイルarchiveの正規化Factは期限付きrawとは別物。temporary importの実運用削除は未実装。

## Collector、品質、訂正、Backfill

`npm run collector:import -- --date 2025-06-01 --zip .data/raw/2025csvs.zip --dry-run` でDBの事実を変えずに検証。`--dry-run`を外すとDB/Archive/静的Payloadへ書く。`--fetch`を明示したときだけ配布元へ1回アクセスし、20 MB上限・30秒timeout。正常な2,430試合、30球団、ソース内GameID一意、成績非負、既存より試合が欠落していないことを確認してからFact/Snapshotをトランザクションでupsertする。異常入力は既存の正常Factを保持し失敗ログへ記録する。同じソースHashの再投入ではFact更新0件。訂正があれば最も早い影響日以降の既存Snapshotを再計算する。`--date`を変えて同じpipelineを繰り返せば日付単位の過去SnapshotをBackfillできる。別年の球団対応は検証前に開放しない。

`standings_daily`は日付＋league＋地区＋球団を主キーにし、履歴を上書きせず日付ごとに保存する。順位は地区内勝率順の**再構築値**で、MLB公式の同率時タイブレーク順位ではない。ゲーム差は`(首位勝数−当該勝数＋当該敗数−首位敗数)/2`。中断試合は完了日に反映する。日次収集は前日終了分だけを対象とし、将来の許諾済みProviderでも同じFact→Snapshot処理を使う。

`.github/workflows/daily-collector.yml`はUTC 18:37（JST 03:37）の1日1回予定。公開repoかつ`NPB_COLLECTOR_ENABLED=true`の時のみNPB限定Collectorを開始する。手動dry-run、Remote ingest/replay、Pagesの公開JSON読出しを確認してから有効化する。オフマシンFact backupは未実装の運用リスクとして監視する。従来の`collector:daily`はRetrosheet履歴用のskipped経路として残す。GitHubは[公開repoの標準runnerを無料](https://docs.github.com/en/actions/concepts/billing-and-usage)とする一方、[scheduleの遅延/不実行や60日非アクティブ停止](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)があり、厳密な時刻保証はない。private repoのrunnerは既定で使わない。

DBを替える際はMigrationと`StandingsRepository`を保持してSQL adapterを交換する。GameFactの出典/一意キーを維持して再投入し、SnapshotとPayloadを再生成する。古いDBからの退避はFactのJSON.gz exportとMigrationを一緒に保管する方針だが、現時点のlocal archiveは自動オフサイトbackupではない。オフマシンのFact backup/リストア演習は今後の運用課題。
