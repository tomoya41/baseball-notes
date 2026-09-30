# MLB Historical Core 完了報告 — 2026-09-30

Production release: [workflow_dispatch 36657679928](https://github.com/tomoya41/baseball-notes/actions/runs/36657679928), commit `dbed004`。開始2026-09-30 10:59:06 JST、完了11:02:50 JST、success。これはScheduled Operationsの証拠ではない。

## Source / License（1〜6）

1. Retrosheetは自由利用・加工・再配布・商用製品利用を明示的に許可し、指定creditを要求する。一次資料の現在の文面、URL、2026-09-30のaccessed dateは[Source evidence](mlb-historical-source-evidence-2026-09-30.md)へ記録した。訂正可能性・無保証を保持。
2. `#/MLB/sources`へ指定creditを全文・正確に表示。Home / Player / Recordsから到達可能。通常画面を権利文で埋めない。
3. Chadwick Public RegisterはOpen Data Commons Attribution License 1.0。UUIDとRetrosheet IDの照合に限定。外部サイトのデータ利用許可とは扱わない。
4. Data SourcesにChadwick Registerの名称・元データ・ODC-By 1.0へのリンクとattributionを表示。
5. Lahmanは利用していない。
6. Lahmanの再配布権利に依存する処理はない。

## Import / Quality / Cost（7〜24）

|Season|regular Games|Batting Facts|Pitching Facts|Players|Coverage|
|---|---:|---:|---:|---:|---|
|2020|898|26,721|7,959|1,289|complete|
|2021|2,429|71,621|21,541|1,508|complete|
|2022|2,430|70,911|20,878|1,495|complete|
|2023|2,430|71,144|20,630|1,457|complete|
|2024|2,429|71,272|20,693|1,454|complete|
|2025|2,430|71,550|20,868|1,470|complete|
|合計|13,046|383,219|112,569|2,840 distinct|6 Seasons|

7. Imported seasonsは2020〜2025のregular season。postseasonを混ぜない。
8. distinct Players：2,840。
9. Chadwick mappings：2,840。Retrosheet mappings：2,840、計5,680。名前によるmergeなし。Team/Gameもopaque canonical IDsを用いる。
10. unresolved identity：0。次releaseでChadwick bridgeが変わる／消える場合、Fact correction前のpreflightで停止しidentity reviewを要求する。
11. Games：13,046。
12. Batting Facts：383,219。
13. Pitching Facts：112,569。
14. 各SeasonのCoverageは上表。公式配布CSVのregular Game一覧を基準とし、全Gameの参加者・保存成績・teamstatsを照合したHistorical release coverage。現在シーズンのschedule coverageではない。
15. validation issues：0。Player/Game uniqueness、team consistency、score、PA・H・outs・BFのteam totals、相手PA/BF、decision flagsを検証。全13,046試合でPA/BF不一致0。
16. Download：6つの公式Season CSV ZIP＋Chadwick Register ZIP。各Seasonはgameinfo / teamstats / allplayers / batting / pitching / fielding / playsを含む。fielding/PBP全量をcanonical DBへ投入しない。
17. Successful releaseのcompressed download：81,168,942 bytes。
18. extracted bytes：761,243,576（archive全体、PBP/fieldingを含む）。
19. Successful cold release：HTTP downloads 7、retry 0。Game単位HTTPなし。cache再利用の再importはHTTP 0。公開前に旧Runを1回取消し修正後Runへ置換したため、Batch全体の転送はこの1回分だけではない。
20. GitHub runner parsing：14,533ms。
21. GitHub runner import / aggregate / payload生成を含むruntime：87,784ms。backup / build / deployを含むworkflowは224秒。個別Season aggregate全量の独立timerは未設置。
22. Cold importのlogical DB row writes：21,573。既存DBへの再import：0。DDLをrow writesへ含めていない。読取は固定batch中心（importer 11 SELECT）、PlayerごとのDB Queryなし。
23. Fresh SQLite：169,160,704 bytes。MLBはrelease時のlocal SQLiteで正規化・backup・static生成するため、remote TursoへのMLB size delta / writesは0。既存NPB schemaへのmigrationなし。
24. 同じ2020〜2025 archivesを再importし、Games / Players / Facts / mappings / content hashes不変、DB writes 0。訂正時はGame全体のauthoritative JSONをatomicに更新する。既存NPB limited insert-only semanticsは変更していない。

## Product（25〜40）

25. Seasonは既存Batting/Pitching Aggregatorを再利用。counting＋AVG/OBP/SLG/OPS/ERA/K9、Metric Statusを保持。IPはoutsRecordedから表示時だけ変換。HLD・pitchCountはnull/unavailable、WHIPは出力しない。2025大谷：158G / PA727 / H172 / HR55 / OPS1.014、14G/14GS / 141outs=47.0IP / SO62 / ERA2.87。
26. Career相当は**収録期間合計 2020–2025**。全MLB careerではない。大谷：打撃813G / H847 / HR240、投球90G / SO607。Full Careerと断定しない。
27. `#/MLB/search`：実Player index、Season、case/space/accent normalization、canonicalリンク、Favorites。全量2,840人のindexは113,529 bytes gzip、表示は100件まで。Team/positionは保持済みmetadata、検索画面の追加filterは今回必須にしていない。
28. `#/MLB/players/{canonicalPlayerId}`：name、bats/throws、known positions、収録Seasons、球団context、Season / collected-range / Game Log / Analysis。未取得生年月日・写真等を補完しない。
29. `#/MLB/schedule?season=2025&date=2025-09-28`：Season / date selector、前日・翌日、Home/Away score、doubleheader、Gameリンク。2026 Currentへfallbackなし。
30. `#/MLB/games/{canonicalGameId}`：score、final、known innings、両軍batting/pitching。canonical Playerリンク、nullable-safe、0PA/0outs保持。Retrosheetの明示sequenceのみ使用。inning別scoreは作っていない。
31. Player Game Log：選択Seasonの最新30試合、日付・相手・Home/Away・個人成績、Game Detailへのリンク。two-wayは同Gameの投打両方を表示。
32. 7/14/30：選択Season＋asOfDateをsource-local日付で集計。大谷2025-09-28基準：7日5G/PA23/OPS0.971、14日12G/PA54/OPS1.162、30日26G/PA120/OPS1.112。
33. Home/Away：同一取得済みPlayer Factをメモリpartition。14日Home：7G/PA31/OPS1.308を公開UI切替で確認。
34. Opponent：同じContextをpartition、保存済みcanonical opponent selector。追加DB Query/HTTPなし。
35. Batting Order：canonical slotのみ。大谷の保存済み1・2番を確認。途中出場のslotも利用。
36. Batter role：source `b_seq`の明示starter/substitute。0PAをunknownへ混同しない。
37. Pitcher role：source `p_seq`の先発/救援。0outs保持。厳密な明示sequenceを利用し、IPやdecisionから推測しない。
38. Historical **counting rankings ready**（H/HR/RBI/SB/SO/W/SV）。Rate rankings not_ready。tiesは競技順位、stable name/canonical-ID tie order。2025 HRのCal Raleigh60 / Kyle Schwarber56 / Shohei Ohtani55を公開確認。
39. [MLB公式qualification](https://www.mlb.com/glossary/standard-stats/rate-stats-qualifiers)を記録。通常規定：2020=186PA/180outs、2021–2025=502PA/486outs。qualified/unqualified/unknownを区別。Rule9.22(a)不足PA title例外が未実装・未reviewのため公開Rate Gateは閉じる。OPS/K9を公式タイトルと呼ばない。
40. `#/MLB/records`：6Seasonのcounting read model、実Player navigation。率指標の確認中表示、provisional rate順位を公開しない。

## PBP / Capability / UX（41〜50）

41. 公式plays CSVにbatter / pitcher / inning / outs / result / batting order / substitutions / runners等が存在。archiveとして取得済み。PBP全量のcanonical persistence/UIは今回行っていない。
42. Direct BvP PoC：2025最初のregular 3試合を機械的に選択。手入力Game例外なし。explicit PA終端のpitcher/batter関係から再構成。
43. 3GameのPA=74/79/87、合計240。Game別pair数51/66/59。missing relation0、個人PA不一致0、AB/H/2B/3B/HR/BB/HBP/SOを含む9成績の不一致0。同Gameの同席だけで対戦を推定していない。数Game PoCのためProduction Direct BvP Gateはまだ開けない。
44. Situational：inning/outs/score contextはPoCで利用可能、source base-state/substitution情報あり。times-through-order等は追加再構成検証が必要。大規模UI未実装。
45. Statcast pitch type / velocity / exact location / exit velocity / launch angle / barrel / xwOBAは保存・公開していない。Retrosheetのpitch stringをStatcast能力と扱わない。
46. MLB Homeと2026指定Scheduleで「2026年の試合結果・選手成績は未対応」。架空・2025置換表示なし。MLB Stats API / MLBAM / API-SPORTS / Savantへの取得0。
47. 2026 Original Scheduleは利用していない。
48. 当初予定UIは未追加。将来もCurrentとは別Capability。
49. Cross-league Favorites契約を維持。canonical ID＋league、既存v1 NPB storageを保持。公開Mike Trout追加→reload保持→My→解除を確認し、検証前の保存状態へ戻した。local操作で追加networkなし。
50. MLB Home：Historical entry、最新import2025の日程・結果、Player Search、Favorites、Data Sources。ニュースFeed／Current Scoreなし。

## Delivery / Regression / Validation（51〜71）

51. `data/mlb/historical/`：manifest、Player index＋個別Player、Season別aggregate/records、Season＋date scoped schedule、個別Game。gzip。whole-season Factsを1ファイルにしない。継続するNPB Pages publishはhash検証したhistorical archiveを保存する。
52. Payload16,879 files、合計50,217,362 bytes。Pages upload artifact全体101,737,004 bytes（NPB/app/MLB preservation archive込み）。
53. 最大payload269,717 bytes gzip（2021Season、実HTTP200確認）。代表Game1,917、日付1,251、大谷Player36,935 bytes。
54. Recurring cost ¥0：新paid API/サービスなし、MLB Turso容量増加0、日次MLB collectorなし。manual release workflow224秒、公開repoの既存Actions/Pagesと7日artifactを利用。転送やartifactは無制限とは主張せず、release更新時の測定を継続する。
55. MLB portable export：schema.sql / JSONL.gz / manifest / SHA256、約16.24MB。NPB remote export/restoreもPASS。両exportを含むencrypted artifactは17,691,486 bytes、7日保持。
56. Scratch restore：MLB5 tables件数一致、代表Player/Game readback、6Season Game countsとrelease table一致。NPB schemaVersion4、repository readbackもPASS。
57. NPB Home / Search / Profile / Recent / Season / Game Log / Game Detail / My / Gate付きRecords回帰を確認。公開坂本Profile→9/25 Game Detailで阪神1/DeNA2、阪神PA36、坂本PA3/AB2/BB1維持。既存Analysis等は全testsで回帰確認。
58. 今回のNPB Fact write0。公開時remote read/backupのみ。最新保存NPBは別運用の進行でGames898 / Batting22,804 / Pitching6,913 / mappings1,656となっている。
59. 今回のNPB Coverage write0。元の6雨天コールドGameは全件partial維持。最新公開baselineは9/29、187日=complete156 / no_games25 / partial6 / unknown0。対象期間が9/26から延びた別運用の差分であり、このBatchのrepairではない。
60. NPB HOT Engine/Gate変更なし、public not_ready維持。
61. NPB Ranking Engine/Gate変更なし、public not_ready維持。
62. Infrastructure Phaseを再判定・変更していない。manual releaseをScheduled proofへ代用していない。
63. 360px Light：実Light tokensを使う生成専用QA stylesheetでSchedule/Game/Profileを目視確認。OS設定/Production CSSを変更しない。page overflowなし、table内部scroll。
64. 360px Dark：公開Schedule/Game/Profileを目視確認、document scrollWidth345≤360。412px Homeもoverflowなし。
65. heading / team sections / score labels / player links / controls / favorite pressed状態、keyboard Enter詳細展開を確認。Loading/Error/Empty/Not Foundを分離。Screen reader実機の読み上げ試験は未実施。
66. 全378 tests / 43 files PASS。
67. lint PASS。
68. typecheck PASS。
69. build PASS。既存約597KB JS chunk size warningは非fatalで残る。
70. Vercel build PASS。Vercel Production deploymentを今回行ったとは主張しない。
71. [Pages Run36657679928](https://github.com/tomoya41/baseball-notes/actions/runs/36657679928) success。公開manifest / Player / Game / Schedule / Records / NPB Season / HOTすべてHTTP200。代表fetch：Player218ms / Game187ms / date190ms、単発測定でSLAではない。local30d Context read/parse2.82ms / partition1.07ms / aggregate1.75ms / total5.68ms、result3,875 bytes。split切替の追加HTTP・DB Queryは0。

## 判定（72〜78）

72. **MLB Historical Core Production利用：YES**。2020〜2025 Game / Player / aggregates / counting Records。Rate Ranking・PBP UIを含む全高度機能の完成を意味しない。
73. **Recurring cost ¥0：YES**。既存無料構成のまま。
74. **RetrosheetだけでSeason/Careerを成立：YES**、成績はRetrosheetから生成しChadwickはidentityのみ。ただしCareer表示は**収録期間合計**、Full Careerではない。
75. **Direct BvPをProductionへ進められる：NO（PoC PASS）**。1Season全量照合・訂正/継投/例外検証・canonical PA契約が必要。
76. **MLB Currentを一切収集していない：YES**。
77. 残blocker：Rule9.22(a)例外の公開qualification policy、Direct BvPの全Season検証とcanonical persistence、Full Career範囲外。NPB雨天コールド・Operationsは別Trackとして維持。
78. 次の統合Batch候補：Historical qualification完成＋2025 Direct BvP全量validation/PAモデル＋UI payload/chunk optimization。Statcast / MLB Current / Androidには自動で進まない。

Public entry：[MLB Historical Home](https://tomoya41.github.io/baseball-notes/#/MLB/home)。
