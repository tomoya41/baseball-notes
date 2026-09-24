# NPB第4弾：2試合限定の実記録Edge Case検証

確認日：2026-09-24〜25。主Sourceは従来のnf3のみ。利用条件・停止条件は[データソース記録](data-sources.md)を継承する。公開ページに明示的な禁止を見つけていないことは、包括的な再配布許諾を意味しない。日次Collectorの対象人数・試合数は変更せず、手動の固定試合選択だけを追加した。

## 対象と選定

| 対象 | 2026-09-23の終了済み公式戦 | 選定理由 |
|---|---|---|
| Primary | 広島1–2巨人（広島ホーム、`npb:game:838179e9f7cb8080304b`） | セ・リーグ投手の打順入り、実際の犠打、竹丸和幸5回2/3、中川皓太1/3回、0アウト降板の堀田賢慎、勝・敗・複数ホールド・セーブ、非ゼロ投手四死を同一試合で検証できる |
| Supplemental | DeNA4–3中日（DeNAホーム、`npb:game:b37526c92a94ecb96bf7`） | 林琢真の「中３」、筒香嘉智・石伊雄太の「死球」、36/33アウトの延長ホーム勝利形、両軍8投手ずつを検証できる |

各試合とも `--fetch --dry-run` → `--fetch` → `--offline-raw` → `--verify-only` の順で実行。`--offline-raw`は同じgzip Rawを再投入する。1ページごとの待機を既定750ms、ネットワーク再試行を最大1回に制限する。1試合を通さない試合の個別データはFact化していない。

## 完全性と保存値

| 検算 | 広島 | 巨人 | DeNA | 中日 |
|---|---:|---:|---:|---:|
| 打者 expected / collected / mapped | 16 / 16 / 16 | 17 / 17 / 17 | 20 / 20 / 20 | 20 / 20 / 20 |
| 投手 expected / collected / mapped | 3 / 3 / 3 | 6 / 6 / 6 | 8 / 8 / 8 | 8 / 8 / 8 |
| PA / 相手投手BF | 36 / 36 | 32 / 32 | 44 / 44 | 52 / 52 |
| AB / H / 2B / 3B / HR | 32 / 6 / 0 / 0 / 1 | 29 / 5 / 1 / 0 / 0 | 40 / 7 / 3 / 1 / 1 | 45 / 11 / 2 / 0 / 1 |
| R / 最終スコア | 1 / 1 | 2 / 2 | 4 / 4 | 3 / 3 |
| BB / HBP / SH / SF | 3 / 0 / 1 / 0 | 2 / 0 / 1 / 0 | 3 / 1 / 0 / 0 | 6 / 1 / 0 / 0 |
| 自軍投手outs / BF / H / R | 27 / 32 / 5 / 2 | 27 / 36 / 6 / 1 | 36 / 52 / 11 / 3 | 33 / 44 / 7 / 4 |
| 自軍投手SO / 球数 / 四死合算 | 3 / 128 / 2 | 11 / 135 / 3 | 6 / 195 / 7 | 7 / 184 / 4 |

両試合とも batting / pitching / game completeness は `complete`。各軍の打順1–9の先発、交代出場者、日付別投手使用表を独立に列挙した。Source ID→canonical Player IDは計98件の打撃/投手出場行すべてで解決し、同一選手の打撃・投手行は同じ内部Player IDへ対応する。別球団を含め、背番号・氏名・SourceプロフィールURLを照合する。名簿に`31ff_stat.htm`のような英字suffixが現れたため、URLの安全な形式だけを拡張し、背番号やSource ID自体にはsuffixを混ぜない。

PAは元SourceのABと四死合算列、打席トークン中のBB/HBP/SH/SFを突合した場合だけ確定した。広島・床田寛樹は1 AB + 1 SH = 2 PAで「捕犠打」、DeNA・筒香嘉智は3 AB + 1 HBP = 4 PAで「死球」、中日・石伊雄太は4 AB + 1 HBP = 5 PAで「死球」。両試合の全打者PAが相手投手BF合計に一致。未知の打席イベントが出てPAを確定できない場合はnullとなり、Gameは`partial`に留まる。犠飛の非ゼロ実例はこの2試合にはなく、合成変更テストだけで実データCapabilityを開放しない。

DeNA・林琢真の「中３」は選手Factの3B=1として保存し、同軍の選手別合計も1。各打者の打席内容トークンとH列の整合、および各軍のH/HRと相手投手H/HR、全選手の`2B+3B+HR<=H`を検算した。ただしnf3の当該Gameの日程/結果欄に独立したチーム2B/3B総計はなく、**独立長打総計による検算は利用不可**。選手別値の単純合計を独立ソースと呼ばない。

巨人・竹丸和幸は17 outs・89球・勝利、広島・床田寛樹は18 outs・93球・敗戦。巨人・中川皓太は1 out・13球・ホールド、田中瑛斗と森田駿哉もホールド、マルティネスは3 outs・12球・セーブ。堀田賢慎は0 outs・4球・四死1として残した。投手のBB/HBPはnf3の「四死」合算のみ。単独BB/HBPはともにnullとし、分割推定しない。使用表は背番号順であり、明示的な登板順がないため`appearanceOrder=null`を維持する。

守備アウト検算は1試合ごとの例外定数を廃し、最終スコアと両軍のoutsから通常終了として成立する形を確認する。アウェイ勝利・引き分けは両軍同じ3の倍数で27以上、ホーム勝利はホーム守備側が27以上の3の倍数、アウェイ守備側がそれより1～3アウト少ない形。これで9回裏なし、9回・延長のサヨナラ形を扱う。Primaryは27/27、Supplementalは36/33。**nf3の日程行に独立した終了回がないため、記録された実際の最終回を別表と照合したものではない。** コールド・中断再開等の非標準終了は安全側で`partial`とし、次フェーズで独立した終了回情報を検討する。

最終スコアは選手別R合計と相手投手R合計に一致。RBIはRと一致を要求しない。救援投手の投球数・SO・R・ER・被安打は各Source行から保存したが、独立したチーム投手総計がない列については選手行の合計以上の保証をしない。

## 回帰・運用上の境界

実ページの対象日1行と必要ヘッダーだけを切り出した8個のfixtureを`tests/fixtures/npb-game/primary-*`と`supp-*`に追加。3B、HBP、SH、5.2/0.1 IP、HLD、SV、0アウト投手・非ゼロ四死を外部通信なしで検査する。SFは実例未取得のため合成変更テストのみ。2試合のローカル初回挿入は打撃33+40件、投手9+16件。同一Raw再投入で新規挿入0/0、Repositoryの件数も不変。3B/HBP/SH/SFとHLD/SV/球数の訂正upsertはメモリDBのcontrolled testで検証し、本番Factを故意に書き換えない。

Raw HTMLは`.data/raw/nf3/2026-09-23`にgzipで最大14日。GitHub Actions Runner上のRawは引き続き一時的で、Remote archive、長期Fact backup、復元演習は未整備。全試合日次収集へ拡大する前に、少なくとも定刻Scheduleの実走とPrivateなFact export/restore方針を確認する。ゲーム単位Manual workflowは`primary`/`supplemental`を追加するが、既存JST03:37の日次Workflowには参加者全件収集を追加しない。

## Remote検証・定刻実行

2026-09-25にGitHub Actions上で[Primary dry-run](https://github.com/tomoya41/baseball-notes/actions/runs/35989234299)、[Supplemental dry-run](https://github.com/tomoya41/baseball-notes/actions/runs/36063045169)が成功した。[Primary Turso実保存](https://github.com/tomoya41/baseball-notes/actions/runs/36063469191)はRepositoryで打者33件・投手9件を読戻し、同じRawの再投入後も同件数・完全性`complete`を確認した。[Supplemental Turso実保存](https://github.com/tomoya41/baseball-notes/actions/runs/36063808741)は初回に打者40件・投手16件を挿入し、Repository読戻し、同一Rawの再投入、再読戻しの全ステップが成功した。再投入後も打者40件・投手16件かつ各選手IDは重複なしで、完全性`complete`を維持した。両Runとも固定した1試合以外の参加者収集を有効にしていない。

[初回Scheduled Run](https://github.com/tomoya41/baseball-notes/actions/runs/36063406351)は予定の2026-09-25 03:37 JSTから約3時間遅れて06:44 JSTに`event=schedule`で開始し、CollectorとPages deployが成功した。対象日は2026-09-24。Collectorは順位12件・対象範囲内の試合24件を取得し、Repository読戻しは順位12件・累積Game30件、打撃Fact58件・投手Fact17件。`standings`/`games` stageは`complete`、限定対象の`batting`/`pitching`は`partial`であり、全出場者を日次収集したという意味ではない。公開JSONの`effectiveDate`は2026-09-24、`generatedAt`は2026-09-24T21:45:36Z、順位12件を確認した。GitHub Actionsのscheduleイベントには遅延・ドロップの可能性があるため、定刻保証はできない。運用上は未到達日の検知と手動再実行手順を残す。
