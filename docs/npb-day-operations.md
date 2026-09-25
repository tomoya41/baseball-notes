# NPB第6弾：前日全試合Factの運用

2026年9月25日時点。前段のSourceはnf3のみ。公開HTMLは公式API・自由再配布ライセンスではない（[Source方針](data-sources.md)）。`NPB_NF3_ENABLED=false`でCollectorだけを停止できる。アプリの既存Payloadは保持する。

## 日付・対象と失敗

`previousJstDate()`は`Asia/Tokyo`の暦日から1日戻す。03:37から起動が遅れても、起動日のJST前日を対象とする。月次のGame Providerを先に完了させた後、Repositoryの対象日Gamesを列挙し、`final`だけPlayer Factsを収集する。`postponed`や`scheduled`は人数0のparser成功とは見なさず対象外にする。finalが0件ならDay=`no_games`。Game列挙Stage自体が不完全なら処理を開始しない。

各Gameは既存のlineup→出場者→打者・投手ログ→mapping→PA/BF・score・outs validation→Completeness Gateを使う。新規PlayerはSource ID、氏名、背番号、球団、プロフィールURLを照合し、既存同名があれば自動統合せずpartialとする。mapping、打撃・投手Facts、Game completeness、Game ingestion runは**1つのlibSQL write transaction**でcommitする。Parser/検算失敗時はFactを保存しない。1試合失敗しても他のcomplete Gameは保持し、Dayはpartial。Source訂正は安定keyでupsertする。投手のBB/HBPは合算のみ、appearanceOrderはnullを維持する。未知Tokenは正規値へ代入しない。

`npb_day_runs`（migration 004）はtrigger=`manual/scheduled/repair`、予定/終了/完了/部分/失敗Game数、打者/投手行数、mapping、HTTP/retry、Day status、Backup statusを保持する。`complete`は全final Game complete、`partial`は一部失敗、`no_games`はfinal 0、`failed`は日単位の列挙等が成立しない状態。Dayがpartialでも正常Gameを巻き戻さない。

## オペレーター手順

1. ローカルdry-run：`npm run collector:npb:day -- --date=2026-09-23 --dry-run --controlled-history --reuse-local-raw`。将来の日付では`--controlled-history`を外し、先にGames Stageを完成させる。
   既存ローカルDBをBackup drillへ使用する場合は先に`npm run db:npb:migrate`でmigration 004を適用する。Remoteの実投入CLIはmigrationを自動適用する。
2. `Manual NPB full-day facts verification` Actionを`dry-run`でdispatchし、Game/Day complete、Source request/retry、未解決0を確認。DB書込なし。
3. 同Actionを`ingest`でdispatch。Tursoの重要Table件数を保存前・保存後に比較し、Game単位commit、Repository readback、Export→Scratch Restore、暗号化Artifactの順で実施。暗号化鍵はGitHub Actions Secret `NPB_BACKUP_ENCRYPTION_KEY`（32 byteをbase64化した値）。DB秘密情報と同様、Git/ログへ置かない。
4. 同じ`ingest` Action内で保存済みRawを再利用して同日再投入する。Repositoryの1回目・2回目のJSONを照合し、件数増殖がないことを確認する。Run全体を再dispatchする必要がある場合も同じ対象日を指定する。
5. 必要なら既存`Daily NPB collector and Pages delivery`の`publish` manual modeで**最新日付**のPayloadを再公開し、effectiveDateを確認。過去日のGame FactをPagesへ公開しない。
6. 上記を確認して2026-09-25に`NPB_DAY_FACTS_ENABLED=true`を設定し、既存03:37 JST日次Workflowへ統合した。停止時はRepository variable `NPB_DAY_FACTS_ENABLED=false`でDay Factsだけを無効化できる。nf3全体を止める必要がある場合は`NPB_NF3_ENABLED=false`を使い、対象日をmanual repairする。Game単位の既存controlled Collectorも残す。

public repositoryのActions Artifactはread accessのある人がダウンロードできるため、平文Backupはアップロードしない。ArtifactはAES-256-GCMで暗号化した`*.enc`のみ、retention 7日。これは長期・非公開のオフプロバイダー保管先ではない。復元時は同じ鍵で`npx tsx scripts/crypt-npb-backup.ts decrypt <encrypted> <archive.tar.gz>`、tar展開後に`npm run backup:npb:restore -- --from=<export-dir> --to=<empty-db>`を行う。暗号化鍵の紛失時はArtifactを復号できない。鍵の私有保管と永続Backup先は別タスク。

Backup Exportだけ失敗してもGame FactはRollbackしない。`npb_day_runs.operational_status=completed_with_warning`、`backup_status=failed`を記録してActionを失敗させる。公開Payloadは従来の順位・必要最小限のJSONだけ。全Player FactやRawはPagesへ置かない。

## 負荷と容量

第6弾の[GitHub Actions manual dry-run #1](https://github.com/tomoya41/baseball-notes/actions/runs/36073742099)は2026-09-23をRemote Repositoryから列挙し、6 final/6 complete、打者185/185、投手65/65、mapping候補78、HTTP 286、unique page 286、retry 0、処理218.521秒でPASS。Fact書込なし。Local Raw再利用dry-runも6 complete、HTTP 96、retry 0、73.438秒。これらは同じDateのデータ品質確認であり、Remote実投入の証拠ではない。
Migration 004適用後のLocal Portable Backup/Scratch Restore drillもschema v4、圧縮合計180,160 byteでPASS。

同日の[manual real ingestion](https://github.com/tomoya41/baseball-notes/actions/runs/36074811850)は6 final/6 complete、打者185/185、投手65/65、Tursoへの新規Factは打者60・投手24、mapping新規78、HTTP 286、retry 0、Collector処理314.739秒でPASS。同じAction内で同日をRaw再利用して再投入し、Repository JSONの一致とUnique件数不変を確認した。最初のmanual real試行は作業ディレクトリ`.data`不足で**DB書込み前に停止**し、ディレクトリ作成を修正して再実行した。Export→空のSQLiteへのRestoreはPASS、暗号化Artifactのみ7日保持した。

[既存日次Workflowのmanual publish](https://github.com/tomoya41/baseball-notes/actions/runs/36075922369)でPages配信を確認後、Day Facts flagを有効化した。[統合済み日次Workflowのmanual run](https://github.com/tomoya41/baseball-notes/actions/runs/36076130302)はJST前日2026-09-24のfinal 2/complete 2、打者53/53・投手13/13、Turso新規Fact 53+13、mapping新規24、HTTP 78、retry 0、Day処理88.409秒。Repository readback、schema v4 Backup Export/Scratch Restore、暗号化Artifact、Pages deployまでPASS。Remote Repositoryの対象日は2 Game・打者53・投手13、累積はstandings_daily 24、npb_games 30、打者Fact 244、投手Fact 79、Source mapping 285。公開順位JSONは`effectiveDate=2026-09-24`で12球団だった。**全試合化後の次回scheduled runはまだ未確認**で、次回はtrigger=`schedule`、JST前日、Day状態、Turso読戻し、Backup Artifact、Pages公開日付を照合する。

第5弾の6試合実測は286ユニークページ。通常新規runnerでは数分の逐次取得を許容し、750ms間隔、最大1 retry、15秒timeout、500KB上限を維持する。Run内URL cacheで重複fetchしない。GitHub SecretsのDB credentialはAndroid/Webに渡さない。Fact数とmapping増加は`npb_day_runs`とRepository readbackで追う。DB容量はTurso dashboardまたは管理CLIで定期確認し、70/80/90%で確認・警告・再生成可能cache整理を検討する。Fact/順位履歴は削除しない。

Scheduled Runは遅延し得る。次回初回実行で、event=`schedule`、JST前日target、Game/Day status、Turso readback、Artifact、Pages payloadのeffectiveDateを確認する。正午の独立Freshness監視と手動修復は[日次Health運用](npb-freshness-operations.md)を参照。
