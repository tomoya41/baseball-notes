# NPB第6弾：前日全試合Factの運用

2026年9月25日時点。前段のSourceはnf3のみ。公開HTMLは公式API・自由再配布ライセンスではない（[Source方針](data-sources.md)）。`NPB_NF3_ENABLED=false`でCollectorだけを停止できる。アプリの既存Payloadは保持する。

## 日付・対象と失敗

`previousJstDate()`は`Asia/Tokyo`の暦日から1日戻す。03:37から起動が遅れても、起動日のJST前日を対象とする。月次のGame Providerを先に完了させた後、Repositoryの対象日Gamesを列挙し、`final`だけPlayer Factsを収集する。`postponed`や`scheduled`は人数0のparser成功とは見なさず対象外にする。finalが0件ならDay=`no_games`。Game列挙Stage自体が不完全なら処理を開始しない。

各Gameは既存のlineup→出場者→打者・投手ログ→mapping→PA/BF・score・outs validation→Completeness Gateを使う。新規PlayerはSource ID、氏名、背番号、球団、プロフィールURLを照合し、既存同名があれば自動統合せずpartialとする。mapping、打撃・投手Facts、Game completeness、Game ingestion runは**1つのlibSQL write transaction**でcommitする。Parser/検算失敗時はFactを保存しない。1試合失敗しても他のcomplete Gameは保持し、Dayはpartial。Source訂正は安定keyでupsertする。投手のBB/HBPは合算のみ、appearanceOrderはnullを維持する。未知Tokenは正規値へ代入しない。

`npb_day_runs`（migration 004）はtrigger=`manual/scheduled/repair`、予定/終了/完了/部分/失敗Game数、打者/投手行数、mapping、HTTP/retry、Day status、Backup statusを保持する。`complete`は全final Game complete、`partial`は一部失敗、`no_games`はfinal 0、`failed`は日単位の列挙等が成立しない状態。Dayがpartialでも正常Gameを巻き戻さない。

## オペレーター手順

1. ローカルdry-run：`npm run collector:npb:day -- --date=2026-09-23 --dry-run --controlled-history --reuse-local-raw`。将来の日付では`--controlled-history`を外し、先にGames Stageを完成させる。
2. `Manual NPB full-day facts verification` Actionを`dry-run`でdispatchし、Game/Day complete、Source request/retry、未解決0を確認。DB書込なし。
3. 同Actionを`ingest`でdispatch。TursoへGame単位commitし、Repository readback、Export→Scratch Restore、暗号化Artifactの順で実施。暗号化鍵はGitHub Actions Secret `NPB_BACKUP_ENCRYPTION_KEY`（32 byteをbase64化した値）。DB秘密情報と同様、Git/ログへ置かない。
4. 同日`ingest`を再dispatch。Repository countの増殖がないことと、元の順位/試合/Factの保持を確認。
5. 必要なら既存`Daily NPB collector and Pages delivery`の`publish` manual modeで**最新日付**のPayloadを再公開し、effectiveDateを確認。過去日のGame FactをPagesへ公開しない。
6. 上記が通ってから、既存03:37 JST日次WorkflowへDay Factsを統合する。失敗時は`NPB_NF3_ENABLED=false`でSource取得を止め、対象日をmanual repairする。Game単位の既存controlled Collectorも残す。

public repositoryのActions Artifactはread accessのある人がダウンロードできるため、平文Backupはアップロードしない。ArtifactはAES-256-GCMで暗号化した`*.enc`のみ、retention 7日。これは長期・非公開のオフプロバイダー保管先ではない。復元時は同じ鍵で`npx tsx scripts/crypt-npb-backup.ts decrypt <encrypted> <archive.tar.gz>`、tar展開後に`npm run backup:npb:restore -- --from=<export-dir> --to=<empty-db>`を行う。暗号化鍵の紛失時はArtifactを復号できない。鍵の私有保管と永続Backup先は別タスク。

Backup Exportだけ失敗してもGame FactはRollbackしない。`npb_day_runs.operational_status=completed_with_warning`、`backup_status=failed`を記録してActionを失敗させる。公開Payloadは従来の順位・必要最小限のJSONだけ。全Player FactやRawはPagesへ置かない。

## 負荷と容量

第5弾の6試合実測は286ユニークページ。通常新規runnerでは数分の逐次取得を許容し、750ms間隔、最大1 retry、15秒timeout、500KB上限を維持する。Run内URL cacheで重複fetchしない。GitHub SecretsのDB credentialはAndroid/Webに渡さない。Fact数とmapping増加は`npb_day_runs`とRepository readbackで追う。DB容量はTurso dashboardまたは管理CLIで定期確認し、70/80/90%で確認・警告・再生成可能cache整理を検討する。Fact/順位履歴は削除しない。

Scheduled Runは遅延し得る。次回初回実行で、event=`schedule`、JST前日target、Game/Day status、Turso readback、Artifact、Pages payloadのeffectiveDateを確認する。正午までに更新されない場合のAlertは別タスク。
