# NPB公開データ鮮度監視と日次運用

2026-09-25時点。Collectorの既存JST 03:37 scheduleとは別に、Freshness workflowをJST 12:17（UTC 03:17）へ設定する。GitHubの起動遅延はあり得るため、03:37開始の遅れだけを失敗とはしない。判定期限はRepository variable `NPB_FRESHNESS_DEADLINE_HOUR_JST`（未設定時は`12`、0–23の整数）で変更可能。監視はnf3へアクセスせず、公開Pages JSON、Tursoの読取メタデータ、GitHub Actions APIだけを参照する。

## 判定とログ

`expectedEffectiveDate`は実行時点の`Asia/Tokyo`暦日の前日。GitHub Pagesの`data/standings/npb/latest.json`を`no-store`、no-cache header、時刻入りquery parameterでHTTP取得し、既存Zod Schemaで12球団・日付・IDも検証する。HTTP失敗/通信失敗=`unreachable`、JSON/Schema不正=`invalid_payload`、期待より古い=`stale`、未来=`future_date`、一致=`fresh`。0試合の日も日次順位Snapshotがその日付なら`fresh`で、Player Factが0件でも異常にはしない。

公開FreshnessとデータHealthは別。`fresh`かつ対象Dayが`complete`または`no_games`、順位Snapshotが期待日、処理が成功し、Factのある日はBackup Export成功なら`healthy`。日付は新しいがDayが`partial`、Backup失敗、対象Day Run不在、暗号化Artifact欠落等は`warning`。期限以降の古い/到達不能/不正/未来Payloadは`unhealthy`。期限前の古いPayloadは更新待ちの`warning`とし、手動Checkは失敗にしない。到達不能・不正・未来日は期限前でも手動Checkを失敗させる。正午帯の定刻Checkは`healthy`以外をGitHub Actions failureにし、正常時はIssueを作らず静かに成功する。自動再収集はしない。

Tursoから最新scheduled Day Run、最新Day Run、期待日のDay Run、最新成功targetDate、最新順位Snapshot日を読取る。公開が古く、Tursoも古ければ`likelyFault=collector`、Turso順位が期待日に達していれば`likelyFault=publish`。JSON取得/検証の失敗は`delivery`。GitHub Actions APIで最新`event=schedule`のRun結果と同Runの`npb-facts-encrypted-<runId>` Artifactも確認する。Artifactは公開リポジトリでダウンロード可能な**暗号文**であり、7日後に期限切れとなる。DBの`backup_status=exported`はExport成功であり、暗号化・Artifact uploadまで保証する値ではないため、両者を分けて読む。

ログにはUTC/JST双方の検査時刻、期待/公開日付、HTTP状態、Day状態・試合/Fact件数、Backup状態、GitHub scheduled RunとArtifact状態をJSONで残す。Turso SecretやBackup鍵はログへ出さない。GitHub Actions failureを第一通知として使い、Issue自動生成はしない。

## 実行と修復

ローカルの公開URL確認：`npm run monitor:npb:freshness`。GitHubでは`NPB published data freshness`を`workflow_dispatch`で起動し、TursoのSecretを含めた診断を確認する。正午の定刻Workflowは独立しているためDaily CollectorにRun自体が無くても公開日付の遅れを検知できる。

異常時は以下の順に確認する。

1. `freshness.status`と`expectedEffectiveDate`/`publishedEffectiveDate`、HTTPコード、UTC/JST時刻を見る。Pagesの[実JSON](https://tomoya41.github.io/baseball-notes/data/standings/npb/latest.json)もcache-bypass付きで開く。
2. `ingestion.latestStandingsDate`、対象日のDay Run、最新scheduled Runの`dayStatus`、complete/partial/failed Game数、Backup状態を見る。GitHubの[Daily Workflow](https://github.com/tomoya41/baseball-notes/actions/workflows/daily-collector.yml)でCollector・readback・Pages deployのどのStepが失敗したか確認する。
3. Tursoに期待日の正常SnapshotがありPagesだけ古い場合は、Daily Workflowの`workflow_dispatch`で`mode=publish`を選ぶ。これはnf3へアクセスせず最新Remote dataを検証して再公開する。公開HTTPの`effectiveDate`を再確認する。
4. JST前日分のCollectorが失敗した場合は、Daily Workflowの`mode=ingest`、`target_date`にその前日を指定し再実行する。同日の再実行はupsertで重複しない。Game Stageが既にcompleteでPlayer Factsだけpartialの場合は`Manual NPB full-day facts verification`の`mode=dry-run`で原因確認後、`mode=repair`、`target_date`を指定する。これはGame単位の検証/Transaction、Turso readback、暗号化Backupを再実行する。
5. **過去日の順位を現在の無日付Sourceページから復元しない。** 前日を過ぎ、当日のRaw Captureもない場合、既存Collectorはその日のStandings/Game Stage修復を拒否する。Fact修復も対象日のGame Stageがcompleteであることを要する。この場合は未復元日として記録し、公開Payloadを偽って進めない。

Source停止はRepository variable `NPB_NF3_ENABLED=false`、Day Factsだけを止める場合は`NPB_DAY_FACTS_ENABLED=false`。正午監視の停止はFreshness workflowを無効化する。停止中も最後の正常なPages Payloadと永久Factを削除しない。

## 実測と次回確認

全試合化後の`event=schedule` Runは2026-09-25 09:26 JST時点で**未発生**。公開APIで見える唯一のscheduled Daily Runは[2026-09-25 06:44 JST開始のRun](https://github.com/tomoya41/baseball-notes/actions/runs/36063406351)で、03:37予定より約3時間7分遅れたが成功した。ただしこれは`NPB_DAY_FACTS_ENABLED=true`設定前の限定収集であり、全試合無人運用の証拠ではない。

[Freshness手動Run #1](https://github.com/tomoya41/baseball-notes/actions/runs/36077514185)は2026-09-25 09:26 JSTに成功。Scheduleを追加した最終版の[手動Run #2](https://github.com/tomoya41/baseball-notes/actions/runs/36077856430)も09:30 JSTに成功した。Pages実HTTP 200、期待/公開`effectiveDate=2026-09-24`、Turso対象Day=`complete`、終了2/完了2/部分0/失敗0、打者53・投手13、`backup_status=exported`を診断した。対象Dayはmanual runであり、最新scheduled Day Runはまだnull。ローカルでは期限を0時にした存在しないURLへのHTTP 404が`unreachable`/exit 1になることも確認した。GitHubのFreshness Workflowは`active`で、JST 12:17のscheduleを設定済み。次回の全試合化後scheduled Daily Runでは、trigger=`schedule`、JST前日target、全final GameとFactのreadback、暗号化Artifact、Pages deploy後の公開日付を確認し、無人End-to-End成立を記録する。

暗号化Backup Artifactは7日保持のみで、長期の別事業者保管ではない。GitHub schedule自体の不実行や監視Workflow自身の不実行を別途保証する外部watchdogは¥0構成に含まれない。Actions failure通知がアカウントで届く設定も運用者が確認する。
