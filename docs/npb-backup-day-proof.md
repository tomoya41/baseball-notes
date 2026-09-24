# NPB第5弾：Portable Backupと1日全試合dry-run

検証日：2026-09-25。Sourceは既存nf3のみ。日次Workflowの対象は従来の限定選手のままで、全試合Fact投入・Backfill・R2導入は行っていない。

## Export / Restore

`npm run backup:npb:drill`はローカルDBを、`npm run backup:npb:drill -- --require-remote`はGitHub Secretsで接続したTursoを読み、`.data/backup-drill-*/export/`へPortable Exportを作る。同じ実行で新規Scratch SQLiteへ復元し、全行の件数・SHA-256・migration versionを照合してRepositoryを読む。既存DBを復元先にする操作は拒否する。既に手元に退避したExportは`npm run backup:npb:restore -- --from=<export-dir> --to=<new-scratch-db>`で再検証できる。

形式は`schema.sql`、Table別`*.jsonl.gz`、`manifest.json`。Manifestは生成日時、Source DBの**種別ラベル**、schema/migration version、対象Table、各件数、圧縮後byte数・SHA-256、展開後SHA-256、schema checksumを持つ。URL/token/.envは含めない。`schema_migrations`、`data_sources`、`ingestion_runs`、`game_facts`、`standings_daily`、`player_game_batting`、`player_game_pitching`、`pitcher_appearances`、`plate_appearances`、`master_history`（球団・選手を含む）、`permanent_events`、`season_finals`、`source_entity_mappings`、`npb_games`、`npb_ingestion_stages`、`npb_game_completeness`の16 Tableを必須保全とした。`derived_payloads`、`display_cache`、`raw_response_manifest`はschemaのみ復元し、内容は再生成・期限管理対象として除外する。

ローカルdrillはschema v3、圧縮合計178,998 byte、standings 42、games 25、batting 131、pitching 42、mappings 178、completeness 4でPASS。Tursoへの[GitHub Actions manual drill #2](https://github.com/tomoya41/baseball-notes/actions/runs/36068698789)もPASS。Remote Exportは41,274 byte、schema v3、standings 24、games 30、batting 131、pitching 42、mappings 183、completeness 4。すべてのTableのchecksum/件数が新規Scratch SQLiteで一致した。Repository読戻しは最新順位12件・指定日順位12件（2026-09-24）、試合1件、当該試合の打撃40・投手16、completeness=`complete`。専用復元CLIでも別の新規Scratch DBへの再現にPASS。LocalとRemoteで件数が異なるのはDBの用途・収集履歴が異なるためであり、**各Exportとその復元先**を比較した。

`.data/`はGit対象外。Manual Actions runner上のExport/Scratchはジョブ終了とともに消え、ArtifactsやGitHub Pagesへは公開しない。これは復元可能性の演習であり、持続的なオフプロバイダー保管ではない。今後は非公開の保管先・アクセス制御・世代保持・定期Restore drillを別タスクで決める。PITR 1日だけに依存しないため、実運用で保持したいExportは安全な私有領域へ移す必要がある。

## 2026-09-23 全6試合manual dry-run

Game Repositoryの当日finalを列挙して6試合を逐次処理した。1回目は2試合partialとなり、旧Collectorの役割別Player IDとのAlias、nf3プロフィールの英字suffix、選手ページ識別の問題を発見。チーム・背番号・氏名・元URLをすべて照合する汎用Alias規則と、プロフィールからのQuery ID抽出を追加した。打撃ログのない途中出場者は「打者Fact」と区別する構造も追加した。修正後、未知の投手結果記号・特殊PAイベントを正常値へ黙って変換しない検査を追加して最終再実行した。

表の打者/投手は「Expected / Collected / Mapped」。

| Game（Away → Home） | 打者 | 投手 | Game |
|---|---:|---:|---|
| 西武 3–10 ソフトバンク | 27 / 27 / 27 | 8 / 8 / 8 | complete |
| 阪神 8–4 ヤクルト | 35 / 35 / 35 | 10 / 10 / 10 | complete |
| 巨人 2–1 広島 | 33 / 33 / 33 | 9 / 9 / 9 | complete |
| オリックス 1–0 ロッテ | 23 / 23 / 23 | 6 / 6 / 6 | complete |
| 楽天 5–3 日本ハム | 27 / 27 / 27 | 16 / 16 / 16 | complete |
| 中日 3–4 DeNA | 40 / 40 / 40 | 16 / 16 / 16 | complete |

Dayは6 expected/6 processed/6 complete/0 partial/0 failedで`complete`。打者185、投手65、未解決Player 0、同名の新規Mapping候補衝突0、Validation error 0、Parser failure 0。PA/BF、打者得点/最終スコア、相手投手失点、安打/本塁打、守備outsの既存Game Gateは全6試合でPASS。事前登録済み以外のPlayerは実ソースの出場・氏名・背番号と既存Master衝突を検査してdry-run IDを付与した。最終実行のMapping予測74件は旧役割別IDのAlias候補を含まない旧計測で、Alias4件も新規Source Mappingとして必要。実装は両方を報告するよう修正済み。**Fact/Mapping/収集履歴など保護8 Tableの前後ハッシュは同一**で、dry-runのDB変更なし。

対象日は1球団あたり143試合の2026年公式戦のうちの1日であり、日付や6試合をcollectorへ固定投入するコードではない。Repositoryから当日finalを列挙し、今回のmanual CLIだけを2026-09-23に制限している。

最終実行のSource metricsはunique page 286、HTTP 96、ローカル保存Raw再利用190、retry 0、処理72.987秒。Rawなしの初回は279 HTTP/211.261秒で2試合partialだった。完全な日次実行を新規runnerで行う場合は、おおむね286ページの逐次Requestと3～4分の処理を見込む（推定）。同一URLを1回の処理で重複fetchしない。HTTPは最大1 retry、request間隔750ms、500KB上限、15秒timeout。RunnerのRawは現状消えるため、Parser回帰時の再現性には非公開・短期のRemote Raw保管を検討する価値がある。ただし本タスクでは新サービスを導入しない。

非ゼロSFは楽天–日本ハム戦で計1件、投手の`x.2`は対象日の計5投手で確認した。PA不一致や未知PA tokenがあればGameはpartialにする。予期しない投手役割/結果マーカーはParser errorとして記録し、`none`へ偽変換しない。独立したTeam 2B/3B総計はnf3の本経路から得られず、引き続き未検証。試合終了の最終回自体もSource別欄がないため、outs判定は妥当な終了形の検証であり完全なイニング監査ではない。

## 増加量と運用Gate

この6試合を未保存DBへ投入するなら打撃185・投手65、1試合につきcompleteness 1とingestion run 1。現在のTursoとの差分予測は打撃約60・投手約24、Mapping約78（74新規候補＋4 Alias候補）、completeness 2件追加/4件更新、ingestion最大6件。これはdry-runの概算で、本番書込み数ではない。2026年公式戦が[各球団143試合](https://npb.jp/games/2026/schedule_note_cl.html)なら全12球団で858試合。今回の6試合平均をそのまま当てた**推測**は打撃約26,455行、投手約9,295行/season。毎日12件の順位Snapshotを約200日保存する仮定なら約2,400行/season。均等な月30日でもGame Factは最大約7,500行/月相当で、[Turso Freeの月10M rows written・5GB](https://turso.tech/pricing)に比べ小さい。ただしDB実容量、index、訂正再投入、外部Sourceの負荷は別途監視し、Overagesは有効にしない。

**Gate: YES。** Portable Export・Scratch Restore・Repository読戻し、全6試合のGame/Day complete、未解決0、DB無変更、逐次低負荷取得を確認した。次タスクの最小範囲は「前日JSTの全final Game Player FactsをScheduled Collectorへ組み込む」のみ。まず既存の限定Scheduleと分離した手動実行・再投入・Turso読戻しを行い、失敗Gameがあれば日次をpartialにする。全シーズンBackfill、HOT、Analysis、R2は同時に行わない。公開Payloadの遅延を正午時点で検知するFreshness watchは有効だが、今回未実装。Schedulerの約3時間遅延をCollector失敗と混同せず、公開されたeffectiveDateを見る。
