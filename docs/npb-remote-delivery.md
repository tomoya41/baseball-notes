# NPB日次リモート運用（準備済み・未接続）

2026-09-24時点でコードと手動検証経路を用意した。**Turso DB、野球アプリ用GitHubリポジトリ、Pagesはまだ作成・接続されておらず、本番運用は未開始。** ローカル実データの検証結果は[第1弾の記録](npb-ingestion.md)、Sourceの利用条件は[data-sources.md](data-sources.md)を参照。公開ページに明示的禁止を見つけないことは、再配布の包括的許諾ではない。

## 選定と無料枠

既存の`@libsql/client`、SQLite互換Migration、Repository SQLを保つため、Remote DBは**Turso Freeを接続先候補として選定**。2026-09-24確認の[料金表](https://turso.tech/pricing)は100 DB、5 GB storage、月500M rows read、月10M rows written、月3 GB sync、1日PITR。Freeはクレジットカード不要だが、**Overagesが有効なら超過課金され得る**。登録時にFreeとOverages無効を画面で確認し、月額0円から逸脱する設定を使わない。実際の`@libsql/client`とのリモート互換性、Migration、transactional batchは実DBで未検証なので、接続後のゲートとする。

| 案 | 既存コードとの相性 | 配信・費用 | 判断 |
|---|---|---|---|
| Turso Free + GitHub Pages | SQLite/libSQL SQLを維持しやすい。GitHub Actionsからsecret接続 | DBはserver-sideのみ。公開repoのPagesで一括静的配信 | 第一候補。実接続テスト必須 |
| 自前libSQL server | SQLは維持 | 常時稼働ホストと保守が必要 | ¥0の持続可能な常設ホストがない |
| PostgreSQL系Free | SQL/Repository/Migrationを移植 | 別運用、休止・容量制限等を再評価 | 今回は不要な全面移行 |
| Cloudflare R2 | Raw/JSONのオブジェクト保存に向く | [無料枠](https://developers.cloudflare.com/r2/pricing/)超過で従量料金 | ¥0厳守のため未採用 |

公開配信は[GitHub PagesのActions artifact](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。同じ成果物にViteのWebアプリと`data/standings/npb/latest.json`を含める。Webは同一Origin、Androidはビルド時の公開URL`VITE_NPB_DATA_BASE_URL`から読む。DB認証情報をクライアントへ渡さず、アクセス時にSQL集計をしない。Pagesの公開リポジトリ・標準runnerはGitHub Freeの対象。公開repoにしたくない場合はこの¥0構成を有効化しない。

## 接続・段階的な有効化

1. 野球アプリ専用の**公開**GitHubリポジトリを作り、検証済みコードを既定ブランチへpushする。GitHub PagesのSourceを**GitHub Actions**にする。`github-pages` environmentは既定ブランチだけを許す設定にする。private repoはworkflowのjob条件で停止する。
2. Turso Free DBを作成し、Overagesが無効であることを確認する。GitHub repository secretsに`TURSO_DATABASE_URL`と書込権限を持つ`TURSO_AUTH_TOKEN`を設定する。URLもclient bundleには入れない。`.env.example`はキー名のみ。
3. `daily-collector.yml`を`workflow_dispatch`の`dry-run`で手動実行する。Sourceの17ページを逐次検証し、remoteへは`SELECT 1`以外を書かない。対象日は原則JST前日。任意の日付を指定する場合もnf3の現在順位ページを過去Snapshotへ偽装しない。
4. `ingest`を手動実行する。Migration 001/002、収集、Stage確認、Remote Repositoryでの12順位とGame/Fact件数確認、保存したRawによる同日再投入、件数一致、Payload検証、Web build、Pages artifact upload、Pages deployの順。途中失敗時は新しいPagesサイトを公開しない。前回の正常デプロイを維持する。
5. 公開Pages URLの`data/standings/npb/latest.json`と`#/NPB/home`を実ブラウザで確認する。Android build時に`VITE_NPB_DATA_BASE_URL=https://<owner>.github.io/<repo>/`を**ビルド環境にのみ**設定し、同じJSONの読出しを確認する。この値は公開URLでsecretではない。
6. 上記と再実行の重複なし・費用設定を確認した後に限り、Repository variable`NPB_COLLECTOR_ENABLED=true`を設定する。UTC 18:37、JST 03:37の日次scheduleが初めて有効になる。[GitHubのschedule](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)には遅延・不実行や公開repoの60日無活動停止があるため、Run/Stageの確認が必要。

Local開発は引き続き`file:.data/baseball.db`。Collectorは`TURSO_DATABASE_URL`と`TURSO_AUTH_TOKEN`があればRemoteへ切替え、`--require-remote`がLocal fallbackを拒否する。Web/AndroidにはDB credentialを含めない。`npm run verify:npb:remote -- --connection-only`は接続の読取検査、`npm run verify:npb:remote -- --date YYYY-MM-DD --payload-root .data/publish`はDBと生成JSONを照合する。GitHub Actionsの手動`ingest`は同じRawで再投入し、件数JSONの完全一致を検査する。

## Payload、障害、鮮度

`throughDate`/`effectiveDate`は順位の対象日、`collectedAt`はSource取得時刻、`generatedAt`はPayload生成時刻。nf3はSource側更新時刻を提供しないため`sourceUpdatedAt=null`。Payloadは12球団・セパ各6・rank/ID/日付をZodで検証し、一時ファイルを同じディレクトリでrenameしてからPages artifactへ含める。Pagesは完成artifactを一括デプロイする。取得または検証に失敗した日はデプロイせず、前日の公開Payloadを残す。クライアントはURL別に最後の正常Payloadを端末内キャッシュし、ネットワーク障害や破損Responseではこれを返す。UIは対象日がJST前日より古い場合に`更新待ち`を表示する。キャッシュもなければ既存の未提供/通信エラー状態になる。

## Raw、Backup、容量

Local Raw HTMLは従来通り`.data/raw/nf3/`にgzipで最大14日、DB manifestで期限管理。GitHub ActionsではRawをrunner上で一時保持し、同じRunの検証再投入にだけ使う。**runner終了後のRaw復旧保存は現時点でない**。公開ArtifactへHTMLを再配布することは利用条件の不確実性から行わず、Remote DBにも巨大TEXTを置かない。長期障害時のParser復旧には追加の許諾確認と無料の非公開保管先が必要。

順位履歴・試合・選手Fact・source mappingsは永久保持。`cleanupExpired`は既存の期限切れcache/derived/raw manifestのみ対象。容量不足ではtemp→期限切れraw→display cache→derived cacheの順に見直し、FactとSnapshotは削除しない。Turso FreeのPITRは1日なので、MigrationだけではFactを復旧できない。定期的なオフマシンFact exportと復元演習は公開運用前に解決すべきリスク。秘密・権利条件を確認せずにDB dumpを公開Artifactへ置かない。

Turso dashboardでstorage、月間rows read/write、Overages設定を週次確認する。DB側の概算サイズは`PRAGMA page_count`と`PRAGMA page_size`の積でも照合できるが、課金上の使用量はdashboardを正とする。5 GBの70%で確認、80%で警告、90%で新規収集停止を検討する。閾値は運用設定として変更可能。月間read/writeも同率で監視し、容量だけで判断しない。小さな日次JSON配信にR2・Vercel・独立APIを追加しない。

## 現時点の未検証ゲート

- Turso実DB作成・Free/Overages設定、`@libsql/client`のRemote接続とMigration/transaction検証
- GitHub専用repo・Secrets・Pages設定、manual dry-run/ingest、Remote重複なし、Pages URLとAndroidの読出し
- Remote Rawの復旧可能な保管先、1日PITRを補うFact backup/restore
- nf3公開再配布の利用条件・継続性。Source Registryを無効化すればCollectorを停止できる

これらを確認するまでschedule variableは設定しない。DBやPagesが作られていない状態を「本番経路完成」と扱わない。
