# NPB日次リモート運用

2026-09-24に[公開GitHubリポジトリ](https://github.com/tomoya41/baseball-notes)とTurso Freeの東京リージョンに`baseball-notes-npb`を作成し、PagesのSourceをGitHub Actionsにした。Freeプランで支払い方法は未登録。手動収集と公開Payloadの検証結果は下記に記録する。ローカル実データの検証結果は[第1弾の記録](npb-ingestion.md)、Sourceの利用条件は[data-sources.md](data-sources.md)を参照。公開ページに明示的禁止を見つけないことは、再配布の包括的許諾ではない。

## 選定と無料枠

既存の`@libsql/client`、SQLite互換Migration、Repository SQLを保つため、Remote DBに**Turso Freeを採用**。2026-09-24確認の[料金表](https://turso.tech/pricing)は100 DB、5 GB storage、月500M rows read、月10M rows written、月3 GB sync、1日PITR。Freeはクレジットカード不要だが、**Overagesが有効なら超過課金され得る**。現アカウントはFreeかつ支払い方法なしを画面で確認した。有料プランや支払い方法は追加しない。`@libsql/client`とのRemote接続、Migration 001/002、再投入は手動ingestで検証済み。

| 案 | 既存コードとの相性 | 配信・費用 | 判断 |
|---|---|---|---|
| Turso Free + GitHub Pages | SQLite/libSQL SQLを維持しやすい。GitHub Actionsからsecret接続 | DBはserver-sideのみ。公開repoのPagesで一括静的配信 | 採用。GitHub Actionsで実接続を検証 |
| 自前libSQL server | SQLは維持 | 常時稼働ホストと保守が必要 | ¥0の持続可能な常設ホストがない |
| PostgreSQL系Free | SQL/Repository/Migrationを移植 | 別運用、休止・容量制限等を再評価 | 今回は不要な全面移行 |
| Cloudflare R2 | Raw/JSONのオブジェクト保存に向く | [無料枠](https://developers.cloudflare.com/r2/pricing/)超過で従量料金 | ¥0厳守のため未採用 |

公開配信は[GitHub PagesのActions artifact](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。同じ成果物にViteのWebアプリと`data/standings/npb/latest.json`を含める。Webは同一Origin、Androidは既定の公開Pages URLから読む（`VITE_NPB_DATA_BASE_URL`で上書き可能）。DB認証情報をクライアントへ渡さず、アクセス時にSQL集計をしない。Pagesの公開リポジトリ・標準runnerはGitHub Freeの対象。公開repoにしたくない場合はこの¥0構成を有効化しない。

## 接続・段階的な有効化

1. 野球アプリ専用の**公開**GitHubリポジトリを作り、検証済みコードを既定ブランチへpushする。GitHub PagesのSourceを**GitHub Actions**にする。`github-pages` environmentは既定ブランチだけを許す設定にする。private repoはworkflowのjob条件で停止する。
2. Turso Free DBを作成し、Freeで支払い方法が登録されていないことを確認する。GitHub repository secretsに`TURSO_DATABASE_URL`と書込権限を持つ`TURSO_AUTH_TOKEN`を設定する。URLもclient bundleには入れない。`.env.example`はキー名のみ。
3. `daily-collector.yml`を`workflow_dispatch`の`dry-run`で手動実行する。Sourceの17ページを逐次検証し、remoteへは`SELECT 1`以外を書かない。対象日は原則JST前日。任意の日付を指定する場合もnf3の現在順位ページを過去Snapshotへ偽装しない。
4. `ingest`を手動実行する。Migration 001/002、収集、Stage確認、Remote Repositoryでの12順位とGame/Fact件数確認、保存したRawによる同日再投入、件数一致、Payload検証、Web build、Pages artifact upload、Pages deployの順。途中失敗時は新しいPagesサイトを公開しない。前回の正常デプロイを維持する。
5. 公開Pages URLの`data/standings/npb/latest.json`と`#/NPB/home`を実ブラウザで確認する。Android buildの公開URLを確認し、同じJSONの読出しを確認する。この値は公開URLでsecretではない。
6. 上記と再実行の重複なし・費用設定を確認した後に限り、Repository variable`NPB_COLLECTOR_ENABLED=true`を設定する。UTC 18:37、JST 03:37の日次scheduleが初めて有効になる。[GitHubのschedule](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)には遅延・不実行や公開repoの60日無活動停止があるため、Run/Stageの確認が必要。

Local開発は引き続き`file:.data/baseball.db`。Collectorは`TURSO_DATABASE_URL`と`TURSO_AUTH_TOKEN`があればRemoteへ切替え、`--require-remote`がLocal fallbackを拒否する。Web/AndroidにはDB credentialを含めない。`npm run verify:npb:remote -- --connection-only`は接続の読取検査、`npm run verify:npb:remote -- --date YYYY-MM-DD --payload-root .data/publish`はDBと生成JSONを照合する。GitHub Actionsの手動`ingest`は同じRawで再投入し、件数JSONの完全一致を検査する。

## 2026-09-24手動検証

- [dry-run #1](https://github.com/tomoya41/baseball-notes/actions/runs/35940905282)：Remote `SELECT 1`とnf3の17ページを検証。順位12、試合25、打撃8、投手3、エラー0。DBへの収集書込なし。
- [ingest #2](https://github.com/tomoya41/baseball-notes/actions/runs/35959237321)：Migration 001/002をRemote Tursoに適用。順位12、試合25、打撃Fact 8、投手Fact 3。`standings`/`games`はcomplete、選手ログ2種は意図どおりpartial。同じRawの再投入後も件数が完全一致し、重複なし。
- [publish #3](https://github.com/tomoya41/baseball-notes/actions/runs/35959839104)：nf3へ再アクセスせずRemote Repositoryを再検証し、WebとJSONを一括再公開。12球団と修正済みの`nf3`出典を公開JSONで確認した。
- 同Runで検証済みPayloadとWeb buildを単一artifactとして[GitHub Pages](https://tomoya41.github.io/baseball-notes/#/NPB/home)へデプロイ。公開JSONは2026-09-23終了時点、12球団（セ・パ各6）、首位ゲーム差0。ブラウザのNPB HomeがこのJSONを読み、勝敗・ゲーム差を表示した。PagesのJSONレスポンスは`Access-Control-Allow-Origin: *`で、Android WebViewの公開URL読出しに必要なCORSヘッダを確認した。APK実機試験は未実施。
- Pagesの`github-pages` environmentは`main`のみデプロイ許可。Repository secretsは`TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN`の2つ。トークンはDB限定・read/writeで、Gitとクライアント配布物には含めない。
- UI・出典表記のみの更新は`workflow_dispatch`の`publish`を選ぶ。最新Remote SnapshotとStageを再検証してPayload/Webを再公開し、nf3へはアクセスしない。指定日が最新Snapshotと違えば停止する。
- 2026-09-24にRepository variable`NPB_COLLECTOR_ENABLED=true`を設定し、JST 03:37の日次scheduleを有効化した。初回の自動schedule実行結果はまだ確認していない。

## Payload、障害、鮮度

`throughDate`/`effectiveDate`は順位の対象日、`collectedAt`はSource取得時刻、`generatedAt`はPayload生成時刻。nf3はSource側更新時刻を提供しないため`sourceUpdatedAt=null`。Payloadは12球団・セパ各6・rank/ID/日付をZodで検証し、一時ファイルを同じディレクトリでrenameしてからPages artifactへ含める。Pagesは完成artifactを一括デプロイする。取得または検証に失敗した日はデプロイせず、前日の公開Payloadを残す。クライアントはURL別に最後の正常Payloadを端末内キャッシュし、ネットワーク障害や破損Responseではこれを返す。UIは対象日がJST前日より古い場合に`更新待ち`を表示する。キャッシュもなければ既存の未提供/通信エラー状態になる。

## Raw、Backup、容量

Local Raw HTMLは従来通り`.data/raw/nf3/`にgzipで最大14日、DB manifestで期限管理。GitHub ActionsではRawをrunner上で一時保持し、同じRunの検証再投入にだけ使う。**runner終了後のRaw復旧保存は現時点でない**。公開ArtifactへHTMLを再配布することは利用条件の不確実性から行わず、Remote DBにも巨大TEXTを置かない。長期障害時のParser復旧には追加の許諾確認と無料の非公開保管先が必要。

順位履歴・試合・選手Fact・source mappingsは永久保持。`cleanupExpired`は既存の期限切れcache/derived/raw manifestのみ対象。容量不足ではtemp→期限切れraw→display cache→derived cacheの順に見直し、FactとSnapshotは削除しない。Turso FreeのPITRは1日なので、MigrationだけではFactを復旧できない。定期的なオフマシンFact exportと復元演習は残る運用リスク。秘密・権利条件を確認せずにDB dumpを公開Artifactへ置かない。

Turso dashboardでstorage、月間rows read/write、Overages設定を週次確認する。DB側の概算サイズは`PRAGMA page_count`と`PRAGMA page_size`の積でも照合できるが、課金上の使用量はdashboardを正とする。5 GBの70%で確認、80%で警告、90%で新規収集停止を検討する。閾値は運用設定として変更可能。月間read/writeも同率で監視し、容量だけで判断しない。小さな日次JSON配信にR2・Vercel・独立APIを追加しない。

## 残る運用リスク

- GitHub scheduleは遅延・欠落、公開repoの無活動停止があり得る。`NPB_COLLECTOR_ENABLED`を有効化した後もRunとStageの日次確認が必要。
- Remote Rawの復旧可能な非公開保管先と、Turso Freeの1日PITRを補うFact backup/restoreは未整備。TursoのSQLite exportは可能だが、手動ダウンロードは自動バックアップではない。
- nf3公開再配布の利用条件・継続性。Source Registryを無効化すればCollectorを停止できる。ソースが更新されない日に当日分として古い順位を記録する可能性は、提供元更新日時がないため監視で補う。
- Androidの公開URL・CORSは確認したが、署名付きAPKの実機通信は未試験。必要なら別のAndroid検証タスクで行う。
