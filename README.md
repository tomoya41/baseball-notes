# Baseball Notes — NPB / MLB Data App

Androidを主対象とする野球データアプリ。製品仕様は [SPEC.md](SPEC.md)、恒久ルールは [AGENTS.md](AGENTS.md)、重要な判断は [docs/decisions.md](docs/decisions.md) を参照。

## NPB Schedule-aware EOD運用

`NPB_EOD_ENABLED=true` のrepository variableで予定同期と毎時17分JSTのWatcherを有効化します。`NPB_MONITOR_OFFSET_MINUTES` は初期120分。最初に `npb-schedule-sync.yml` を手動でdaily/weekly/monthly/seasonのいずれかで実行してください。通常は毎朝09:27、月曜08:37、毎月1日08:47 JSTに同じServiceを使用します。

Watcherの手動初期値は `fixture_only=true`（Source/DBへアクセスしません）。`false` は当日の予定を読み、監視時刻を過ぎたGameだけ両球団の日程ページを照合します。新たなFinalだけ既存full collectionを実施し、全Game確定・現在Fact検証・順位表整合後に公開。成功はHTTP確認後に既存イベント台帳へ記録されます。03:37 Dailyと12:17 Freshnessは維持します。停止は `NPB_EOD_ENABLED=false`、永久Factの削除は不要です。

nf3更新遅延とGitHub待ち時間があるため実際の終了から60分以内を保証しません。短縮試合の証拠がnf3から取得できない場合はpartialのままです。詳細・制約は [Batch B-3報告](docs/npb-batch-b3-2026-09-27.md) を参照。

## 現在できること

React + TypeScript strict + Vite + Capacitor Androidの構成。ホーム / 検索 / 分析 / 記録 / マイの5項目ナビ、NPB・MLB切替、選手・球団検索、選手詳細、端末保存のお気に入り、指標説明、stale表示を実装。Home / Player / 参考ランキングにLight/Dark対応のデザインシステムを適用しています。

NPBはcanonical Player検索・プロフィール・Recent・Game Log・Game Detail・Player Analysisを保存済み実データへ接続しています。Analysisは共通30日Contextから期間比較、ホーム／ビジター、対戦相手、打順、出場形態を集計します。Playerの2026シーズン成績も既存Aggregatorで算出し、Coverage不足とMetric欠損を区別します。Home HOTはStatic JSONを参照し、Production Gateが閉じている間はランキング準備中です。Career、MATCHUP、WATCH、既存の参考ランキング等にはサンプル／未接続領域が残ります。保存済み成績を公式順位や最終成績と扱わないでください。Retrosheet 2025年の歴史順位も別途生成できます。

- [アーキテクチャ](docs/architecture.md)
- [データ取得元の調査](docs/data-sources.md)
- [MLB / NPB Capability Matrix](docs/analysis-capabilities.md)
- [デザインシステム](docs/design-system.md)
- [日次データ基盤](docs/data-architecture.md)
- [NPBリモート収集・配信運用](docs/npb-remote-delivery.md)
- [Player Recent実データ接続](docs/player-recent.md)
- [NPB 1試合全出場者収集の検証](docs/npb-game-proof.md)
- [NPB別試合のEdge Case検証](docs/npb-game-edge-proof.md)
- [検証・整理記録](docs/verification.md)

## ブラウザで開発

Node.js 24 LTS推奨（`.nvmrc`）。現在のツール群に合わせNode 22.13以降が必要です。npmを使用し、lockfileをコミットします。

```powershell
npm ci
npm run dev
```

表示されたlocalhost URLを開きます。APIキー・環境変数・課金サービスは不要です。Viteの既定は5173、使用中の場合は次の空きポートを表示します。

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run preview
```

一括実行は `npm run check`。watchは `npm run test:watch`。previewはbuild後に実行してください。

## Android

`android/`はCapacitorで生成したネイティブプロジェクトを管理しています。clone後に `cap add android` を再実行する必要はありません。

前提：Android Studio 2025.2.1以降、JDK 21、Android SDK Platform 36。minSdkは24です。詳細は [Capacitor環境要件](https://capacitorjs.com/docs/getting-started/environment-setup) と `android/variables.gradle` を確認。

```powershell
npm ci
npm run android:sync
npm run android:open
```

Android StudioでSDKを設定し、端末またはエミュレーターを選択してRunします。CLIでdebug APKを作る場合：

```powershell
.\android\gradlew.bat -p android assembleDebug
```

JDKの場所を `JAVA_HOME` に、SDKの場所をAndroid Studioまたは `android/local.properties` に設定します。マシン固有のパスや署名鍵はGitへ追加しません。

**この作業環境ではJava/Android SDKを確認できず、APKビルド・実機動作は未検証です。** Web build、Androidプロジェクト生成、`cap sync android`まで確認しました。Windowsの日本語/OneDrive配下でAndroid Gradleがpath errorを出す場合は、ASCIIの短いパス（例：`C:\dev\baseball-data-app`）へcloneして再試行してください。チェックを無効化して回避しません。

## データ・保存

`SampleProvider` → wire validation → normalization → domain validation → Repository → UI。外部Provider追加時は `src/app/services.ts` の組立て箇所を変更します。UIに外部APIを直接つながないでください。

歴史順位のCollectorは別経路です。Retrosheetの許諾済み2025年ZIPを明示的に取得し、ローカルSQLite互換DBへ入れます。DB、archive、生成した静的JSONはGit対象外です。

NPB実データはnf3公開ページを1日1回、逐次・少数アクセスして収集します。NPB公式ページは二次利用・無断転載禁止のためCollectorに使いません。2026年9月時点で確認したnf3の公開ページには明示的な禁止を見つけていませんが、再利用許諾を保証するものではありません。詳細は[Source記録](docs/data-sources.md)。従来の`collector:npb`が取得する選手ログは阪神の検証済み4選手だけです。前日終了済み全試合のFact収集は別の[Day Collector](docs/npb-day-operations.md)が担当します。

```powershell
npm run collector:npb -- --fetch --date 2026-09-23
npm run collector:npb -- --offline-raw --date 2026-09-23 --dry-run
```

通常は `npm run collector:npb:daily` が日本時間の前日を対象にします。Raw HTMLは`.data/raw/nf3/`にgzipで14日保存し、DB・生成PayloadとともにGit対象外です。ローカル生成Payloadは`public/data/standings/npb/latest.json`です。本番WebはGitHub Pagesの同一Origin、Androidは公開Pages URLをRepository経由で参照します。公開URLは`VITE_NPB_DATA_BASE_URL`で上書きできます。GitHub Actionsの定期実行は手動のdry-run・remote ingest・Pages配信を検証後、2026-09-24に`NPB_COLLECTOR_ENABLED=true`で有効化しました。初回の自動scheduleは約3時間遅延したものの収集・Pages公開まで成功しています。過去日の順位は当日のRaw Captureなしに再構築できないため、現在ページを過去日に偽装するBackfillを拒否します。

重要FactのPortable Export/Restoreと、1日限定manual dry-run：

```powershell
npm run backup:npb:drill
$npbBackupDir = (Get-ChildItem .data -Directory -Filter 'backup-drill-*' | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
npm run backup:npb:restore -- "--from=$npbBackupDir/export" --to=.data/new-scratch.db
npm run collector:npb:day:dry-run -- --date=2026-09-23 --reuse-local-raw
```

TursoのExport drillはGitHub Actionsの`NPB portable backup restore drill`を手動起動し、SecretsでRemote DBへ接続する。Backup本体はrunner終了時に消え、Pages/Gitには出さない。復元先は必ず新規SQLiteファイル。全試合dry-runはRepositoryから対象Gameを列挙してFact書込みをしない。詳しい結果・限界・次のGateは[第5弾記録](docs/npb-backup-day-proof.md)。

```powershell
npm run collector:import -- --date 2025-06-01 --fetch --dry-run
npm run collector:import -- --date 2025-06-01 --zip .data/raw/2025csvs.zip
```

`--dry-run`はFact/Snapshotを書きません。2行目は再取得せず、保存・静的Payload出力まで実行します。出力先は`public/data/standings/mlb/2025-06-01.json`。Retrosheetの指定クレジット原文をPayloadに含めていますが、公開画面では目立つ表示も必要です。`TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN`はCollector専用で、remote DBはTurso Freeの東京リージョンに作成済みです。詳細は[データ基盤](docs/data-architecture.md)。

- お気に入り：Android Preferences / Web localStorage。アプリ削除やサイトデータ削除で消えます。同期機能なし。
- キャッシュ：IndexedDB、正規化済みcatalogをリーグ・Provider別に保存。期限切れ/通信失敗を表示し、取得時刻と元データ更新時刻を分離。
- AndroidはWeb assetsを同梱。ブラウザの完全オフライン起動はService Worker未導入のため保証しません。
- `public/data/*.json`は実装とテストが使う架空データで、不要mockではありません。
- 実ProviderやDBのAPI keyを `VITE_*` やAndroidバンドルへ入れないでください。これらは秘密を保持できません。現在 `.env` は不要です。

## Analysis A

`src/domain/analysis.ts`：Query / Capability / Result / Split / SampleSize / 座標定義。
`src/domain/analysis-query.ts`：前日までの暦日窓、Capability admission、query identity。
`src/app/analysis-policy.ts`：母数警告値と現在のProviderの無効化manifest。

日本向けの表示ルールは `SPEC.md` §31。`src/presentation/formatters.ts` が数字・単位・日本時間・名前・母数の表示を担当し、`src/domain/metrics.ts` と `src/domain/baseball-terms.ts` が指標・守備位置・球種の定義を持ちます。高度指標の説明は画面のⓘで任意表示。サンプルの検索用別名は検証済み日本語表示名として扱いません。

Capabilityはリーグ名のif文ではなく、データ条件・実装状態・対象期間・主体・season type・指標・フィルターの組み合わせを検証します。未確認なら無効。AnalysisProviderは契約のみで実データの実装はありません。現在の選手サンプルを分析データの存在証明には使いません。

Analysis基盤の次の候補タスクは、架空の集計結果だけを返す契約テスト用AnalysisProviderを1つ作り、`AnalysisQuery → admission → result validation` の経路を検証することです。日時/母数/empty/unavailableを確認し、実API接続やAnalysis Bへは広げません。

## GitHub / プレビュー / 0円制約

NPBの前日全試合Fact収集・manual検証・復旧手順は[docs/npb-day-operations.md](docs/npb-day-operations.md)を参照してください。Remote手動dry-run・実投入・再投入・暗号化Backup・公開検証を通過し、既存のJST 03:37日次Workflowで`NPB_DAY_FACTS_ENABLED=true`に設定しました。統合後のmanual runは成功済みで、次回scheduled runの運用確認が残ります。

公開NPBデータの正午JST鮮度監視は[docs/npb-freshness-operations.md](docs/npb-freshness-operations.md)を参照してください。`npm run monitor:npb:freshness`は公開JSONの日付を検査し、GitHub ActionsではTursoのDay状態と暗号化Backupも診断します。監視はnf3へアクセスしません。

保存済みNPB Player Game FactsのRead-only集計と収集Coverageは[docs/player-period.md](docs/player-period.md)を参照してください。`npx tsx scripts/verify-player-period.ts --date=2026-09-24`でローカルFactを読み、集計前後の件数を照合できます。Player Recent / Seasonは公開Read-only APIへ接続しています。構成は[docs/player-recent.md](docs/player-recent.md)を参照してください。

2026 Historical Backfillは `npx tsx scripts/backfill-npb-season.ts --from=2026-03-27 --to=2026-09-26 --mode=inventory` で棚卸し、`--mode=dry-run` でRemote ExportをScratch DBへ復元して検証、`--mode=ingest` で明示的に本番投入します。Remote接続の環境変数が必要です。完了済み日の現在Factを再検証して再利用し、日付単位で再開できます。nf3の公開「全表示」日程と投手一覧・「全投球成績」を利用し、同一run内ではURL/解析結果を再利用します。退団・移籍の明示プロフィール識別子は区別し、不明な参加者・identity・validationはreason code付きで未完了に残します。独立manual workflow `npb-historical-backfill.yml` と `npb-season-publish.yml` を用意しています。Seasonの公開JSONは `/data/npb/season/2026/latest.json`、Raw Factや内部Source IDは含めません。規定打席・投球回の一次資料と資格判定方針は `docs/npb-ranking-qualifiers.md`。manual成功はScheduled運用証拠ではありません。
Player画面の「試合別成績」は保存済みFactとGame情報だけをVercelのRead-only APIで読み、最新10件を表示します。取得経路と欠損値・二刀流・ダブルヘッダーの扱いは[docs/player-game-log.md](docs/player-game-log.md)を参照してください。

ローカルGitと作業ブランチを作成済み。公開GitHubリポジトリへpushしました。GitHubリポジトリへ追加する際は、既存ブランチをレビューし `npm run check` を通してください。

`.github/workflows/check.yml` はpublicリポジトリの標準無料runnerでlint/typecheck/test/build/Capacitor syncを行います。privateではjobをskipします。private CIはアカウントの無料枠と課金停止設定を確認するまでローカルチェックを使います。公開repoのFoundation checksは成功しました。

Player Recentだけ、Vercel FreeのServerless APIからTursoを読みます。読み取り専用トークンはVercelのサーバー環境変数に保持し、クライアントへ入れません。アプリは公開APIを読むだけです。Cron・通知・AIはVercelへ追加しません。

## 今回の停止位置

Batch BでHistorical Backfill経路、Season aggregate、Player Season UI、Ranking readiness / Records read model、公開Season JSONを実装。Batch B-2ではhistorical日程・参加者取得を一般化し、2026-03-27〜09-26の184日を再処理しました。Coverageはcomplete 154日 / confirmed no_games 25日 / partial 5日 / unknown 0日です。残る5日は雨天コールド6試合で参加者・終了回等のSource証拠が不足し、Production Ranking / HOTはnot_readyを維持しています。[Batch B報告](docs/npb-batch-b-2026-09-27.md)と[Batch B-2実測・残課題](docs/npb-batch-b2-2026-09-27.md)を参照してください。Infrastructure Scheduled証拠は別トラックです。Batch C、Direct BvP、pitch-level、Live WATCHへ自動的に進みません。

NPBの日程・結果は `#/NPB/schedule?date=2026-09-25`、試合詳細は `#/NPB/games/{canonicalGameId}`。公開Game metadataは `/data/npb/games/manifest.json`、`dates/YYYY-MM-DD.json`、`recent.json` に分割します。`npx tsx scripts/generate-npb-game-surface.ts` はTursoをSELECTだけで読み、既存Season JSONからGate付きRecords payloadも生成します。Season/EOD publishで生成し、他の公開経路では既存payloadをschema検証して保持します。

NPB選手のお気に入りはSearch/Profileから追加・解除し、Myで表示します。端末内Preferences保存のみでAccount/Cloud syncはありません。RecordsはProduction Gateが閉じていれば「2026年シーズン集計を確認中」と表示し、内部候補ランキングは公開しません。

## MLB Source gate / Cross-league foundation

MLB routes now show the real availability state instead of fictional sample rankings or NPB schedule data. `npm run build` generates the small `/data/mlb/manifest.json` automatically. The actual 2026 MLB Collector / Backfill / Player statistics remain unimplemented because bulk acquisition and static redistribution rights are not established. See [MLB source assessment](docs/mlb-source-rights-2026-09-27.md).

Favorite v1 already stores league and canonical entity ID; no destructive migration is needed. NPB Favorites remain in the same local storage. MLB/My retains even unmapped saved IDs and allows removal. No credentials, extra paid service or cloud Favorites are added.

## MLB Historical release import

MLBの公開画面はRetrosheetの2020〜2025年公式戦を対象にします。2026 Currentの試合結果・選手成績は未対応です。権利根拠と指定creditは [Historical source evidence](docs/mlb-historical-source-evidence-2026-09-30.md) を参照してください。Chadwick Registerは選手ID照合だけに使用します。Lahmanは不要です。

`npx tsx scripts/import-mlb-historical.ts --download --cache .data --db .data/mlb-historical.sqlite --output .data/mlb-public` で公式Season ZIPとRegisterを取得し、ローカルSQLiteへcanonical Game/Player/Fact/mappingを保存します。ダウンロード済みarchiveは再利用します。Game・Playerのcontent hashが同じならDBを書きません。`npx tsx scripts/backup-mlb-historical.ts` はschema・JSONL.gz・manifest/hashを出力し、空のScratch SQLiteへ復元して検証します。

手動の `mlb-historical-publish.yml` はrelease import・検証・NPB/MLB両方のBackup/Restore・Pages公開を行います。MLB daily collectionはありません。公開payloadは `/data/mlb/historical/` 下のmanifest、Player別、日付別、Game別、Season別、Records別gzipです。Raw全量やSource IDは公開しません。Playerの合計は「2020〜2025収録期間合計」であり、MLB通算ではありません。Counting recordsと率指標の公開資格は独立しています。

Batch Eの高度分析は以下の順に明示実行します。既存のSeason ZIPを再利用し、新たなGame別HTTPやMLB Current収集は行いません。

```sh
npx tsx scripts/import-mlb-plate-appearances.ts --db .data/mlb-historical.sqlite --cache .data
npx tsx scripts/generate-mlb-rate-rankings.ts --db .data/mlb-historical.sqlite --output .data/mlb-public
npx tsx scripts/generate-mlb-advanced.ts --db .data/mlb-historical.sqlite --output .data/mlb-public
npx tsx scripts/verify-mlb-advanced-performance.ts
npx tsx scripts/backup-mlb-historical.ts
```

PAはローカルrelease SQLiteに保存し、Tursoへ投入しません。Game単位hashによる再投入はwrite 0、訂正時はそのGameのPAをatomicに置換します。BvP・状況別の公開には全Seasonのboxscore照合と状態検証を要求し、Clientへは選手・Season別のaggregateのみ返します。MLB RecordsのAVG/OBP/SLGはRule 9.22の不足PA例外を個別評価。OPS/K9は通常規定相当のsample条件を使うアプリ統計で、公式タイトルとは区別します。[公式規定の根拠](docs/mlb-ranking-rule-2026-09-30.md)と[Batch E検証報告](docs/mlb-batch-e-2026-09-30.md)を参照してください。

同workflowの `mode=app-only` はUI更新用です。既に公開されたHistorical aggregate archiveのhashを検証して保持し、archive再取得・PA再import・DB writeを行いません。新しいRetrosheet releaseを取り込む場合は既定の `mode=release` を使用してください。
