# NPB保存済みGame Fact品質監査（2026-09-27 JST）

監査時刻は2026-09-27 07:42 JST（2026-09-26T22:42:10Z）。[手動Read-only監査Run](https://github.com/tomoya41/baseball-notes/actions/runs/36277111778)でTursoに10 SELECTを発行し、40 Games、518 Batting Facts、161 Pitching Facts、384 Source mappingsを読み取った。監査所要1,867 ms。前後の4テーブル件数はすべて同一。`plate_appearances`と`pitcher_appearances`はともに0件。監査用JSON Artifactは1日保持で、認証情報・raw HTMLは含めない。

この監査は9/26の手動修復済みFactを含む。Daily `event=schedule` Run 36273112894の失敗は手動修復で相殺しない。Infrastructure PhaseはNOのまま、HOT Production Gateにも変更はない。

## PAと打順

| 項目 | 実測 |
|---|---:|
| PA known / unknown | 508 / 10（known 98.07%） |
| PA = 0 | 110（unknownとは別） |
| 欠損PAのAB/BB/HBP known | 10 / 10 |
| 欠損PAのSH/SF known | 0 / 10 |
| 保存済み証拠だけで安全にPA再構成 | 0 / 10 |
| 打順1–9 valid / missing / invalid | 518 / 0 / 0 |
| starter / substitute / unknown | 330 / 188 / 0 |
| 同一Game×Team×打順に複数Player | 18 Games、88枠、276 Facts |
| 厳密な打者出場順 | 0 / 518（canonical列なし） |

PA unknownは阪神の森下翔太・近本光司の各5件だけで、9/20、21、22、23、25の各試合に1件ずつ存在する。どれも`ab`、`walks`、`hbp`はknownだが、`sacrifice_hits`と`sacrifice_flies`がnull。現canonical Factだけで0とみなして`AB+BB+HBP`をPAにすることはできない。現行Game Parserは打席詳細トークン数、未対応イベント、四死合算も検査してからPAを確定する。古い限定選手収集経路はSH/SFとPAを保存しないため、この10件は改善分類B（既存Sourceを再検証するParser/Collector経路の改善が必要）。Aは0件。Source自身の不足（C）や別Source必須（D）と断定する証拠はない。

特に9/23と9/25は`npb_game_completeness.game_status=complete`かつ`plateAppearancesKnown=true`を記録しているが、森下・近本の現在のFactはPA=nullである。9/25の検証時刻は2026-09-25T23:59:17Z、該当Factの`collected_at`は後の2026-09-26T21:29:51Z。後者は9/27 Daily Runの先行する限定収集ステップの時刻と一致する。`daily-collector.yml`は全試合収集より前に`collector:npb --fetch`を実行し、この経路はデフォルト3日lookbackで選手Factをupsertする。`saveBatting`はnull PA/SH/SFも上書きする。これは完了時の検証証拠と現在の保存値が乖離する原因として、コードと時刻が一致する。**今回、CollectorやDBは変更していない。** 完全性を現在値の保証として利用する前に、この上書きを別タスクで止め、対象Gameを再検証する必要がある。

打順は518件すべて既知で、starter/substituteも518件すべて明示される。同一打順内の先発は識別できるが、交代者が複数いる38枠では第1・第2交代者の順番をcanonical Factだけで確定できない。例えば9/25 DeNAの9番は石田裕太郎の後に井上朋也・浜地真澄・神里和毅がいることまでは分かるが、3人の正確な時系列は不明。raw Sourceの交代参照はCollector内部で辿るが、出場順・交代理由・時刻はcanonicalへ保存されない。Source側で完全な時系列が得られるかは未実証。

## 投手と重点試合

投手roleは既存`classifyPitcherRole`基準で先発36、救援125、unknown 0（known 100%）。`appearance_order`は161件すべてnull。先発を最初の投手と認識できても救援の第2・第3投手という順序は分からない。現在使うnf3投手使用表は背番号順で、登板順の根拠にならない。救援順を勝敗、投球回、球数、HLD/SVから推測しない。

- 9/25 DeNA 2–1 阪神（`npb:game:32c76ee9e92f7408892c`）：打者27、投手5、Game検証記録はcomplete。DeNAの現在の打撃Fact PA合計33、DeNA投手BF合計36。阪神の現在の打撃PA合計は2件nullのため不明、阪神投手BF合計33。検証時の阪神PA=36という証拠は残るが、現在の個人Factだけでは再現できない。坂本誠志郎はPA3/AB2/BB1、8番先発でknown。DeNAのレイノルズ等、PA=0の交代出場も保存される。
- 9/23 広島1–2巨人（`npb:game:838179e9f7cb8080304b`）：投手9人。竹丸和幸17 outs=5.2回、中川皓太1 out=0.1回、堀田賢慎0 outs=0.0回。HLDとSVの記録あり。先発/救援は分かるが、救援の正確な登板順は不明。
- 9/26 ソフトバンク4–0楽天（`npb:game:bc2263e9378878e3fbe9`）：打者23/23、投手7/7、PA unknown 0、Game complete、issues 0。ソフトバンク打撃PA34=楽天投手BF34、楽天打撃PA33=ソフトバンク投手BF33。緒方理貢・川村友斗・田中貴也はPA=0。R.オスナの投球Factはcanonical ID `a4d2116b-07d3-4a7a-8f8e-32f6d28759e4`に1件あり、Source mappingも存在する。既存J.オスナへの統合はしていない。

## 保存済みFactのcapability

`available`は保存済み行でその情報を直接読める状態、`partial`は欠損・期間不足・EOD限定などの制約を持つ状態。画面での提供可否とは区別する。

| 領域 | available | partial | unavailable |
|---|---|---|---|
| Game Detail | Game日付/チーム/status、final 32件のscore、保存済み打撃AB/H/HR/RBI/BB/HBP/SO/SB/CS、投球outs/BF/H/HR/SO/R/ER/pitches、role、W/L/HLD/SV、打順1–9、starter/substitute区別 | scoreは32/40、Game completeness記録18/40、個人PA・2B/3B/SH/SFは508/518、投手「四死」は158/161 | inning-by-inning score、厳密な打者出場順・救援登板順、交代種別・時刻、打席/投球単位の結果 |
| WATCH | 過去Gameの結果・打順・先発/救援・保存済みpitch count | 過去記録からのブルペン使用量（収集Coverage制約）、交代者の有無 | live score/試合状態、現在inning/outs/runners/得点差、今日の確認済み打順、next batter/next 3の実時間確定、厳密な交代・救援順、pitch-by-pitch |
| MATCHUP | 保存済み選手のrecent form、Home/Away・Opponent・打順・投手role | recent PA欠損と期間Coverage、保存済み期間内だけの条件別成績 | 投手対打者の直接履歴、左右、球種、球速、count、location/zone heatmap、各球結果 |

`plate_appearances`と`pitcher_appearances`は予約済みテーブルだが両方0件。投手×打者ペアを表すcanonical行はなく、Game内で両者が出場したというだけでは直接対戦を確定できない。球種、球速、カウント、コース、各球結果のcanonical保存もない。今日の予定・打順・ライブ状況は前日までのEOD Game Factから生成できない。

次のデータ改善は、(1) 完了済みFactを限定収集でnull上書きしない保護と現在値の再検証、(2) PA検証済み内訳とprovenance、(3) 明示的な打者交代順・投手登板順、(4) 許諾と粒度を確認した打席単位の投手×打者Fact、の順が妥当。今回これらの収集・Backfill・UI接続は行っていない。
