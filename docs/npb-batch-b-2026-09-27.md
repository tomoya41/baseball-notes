# Batch B 実測報告 — 2026-09-27

Backfill経路・Season集計・UI・Ranking/Records基盤・公開は実装済み。**2026 Season Coverageは未完成**。安全に確認できない146日とpartial2日を残し、Production Ranking/HOTを公開していない。監査基準は2026-09-27 10:07 JST頃、effectiveDate2026-09-26。

1. **Backfill target期間**：2026-03-27〜2026-09-26。JST実行日の前日まで。Season予定終了10/7、未来11日は対象外。

2. **対象日数**：184日。

3. **Backfill前complete**：4日。

4. **Backfill前no_games**：0日。

5. **Backfill前partial**：0日。

6. **Backfill前unknown**：180日。

7. **Backfill後complete**：12日。

8. **Backfill後no_games**：24日。全12球団の保存/Source日程証拠による確認。Fact 0件だけでは認定しない。

9. **Backfill後partial**：2日：9/19、9/22。

10. **Backfill後unknown**：146日。failed 0日。

11. **unresolved dates**：末尾の日付別一覧を参照（unknown146 + partial2）。

12. **unresolved理由**：3/27〜3/31の5日：既存日程Parserの games page has no games。141日：既存投手参加者取得が直近2週間ページのため対象日なし。9/19：早川隆久のSource identity未解決。9/22：DeNA PA検証不一致。nf3全体に過去データがないと断定していない。

13. **Backfill Games追加**：806件。完全Fact追加とGameヘッダー追加を区別。

14. **最終Games**：846件（final801 / postponed40 / scheduled5）。実行対象期間のGameは841件。

15. **Batting追加**：1,205件。

16. **Batting総数**：1,723件。

17. **Pitching追加**：385件。

18. **Pitching総数**：546件。

19. **Source mappings**：384→1,290、+906件。GameとPlayer等を含む全mapping。

20. **identity conflicts**：未解決1選手：早川隆久 2026:E:uniform:21。既存Masterと名前だけで結合せず対象Game全体を非保存。verified identity mappingは変更なし。

21. **PA unknown**：0 / 1,723。

22. **battingOrder**：valid1〜9：1,723、missing0、invalid0。

23. **pitcher role**：starter120 / reliever426 / unknown0。

24. **validation**：現在Factでcomplete60試合、partial2、expected participant証拠なし739 final試合。再検証5 SELECT / 2028.2ms。9/25・9/26修復Gameともcomplete。

25. **HTTP requests**：本番Backfill2回と各replay：1,094。scratch pilot234を含め1,328。

26. **retries**：0。

27. **Provider errors**：HTTP失敗によるretry0。データ取得制約146日、identity/validation partial2日。

28. **elapsed**：本番2job wall合計46分53秒。初回収集処理合計32分59.883秒（replay/backup等除く）。pilot233.279秒。

29. **idempotency**：最終replay countsUnchanged=true / valuesUnchanged=true。batting・pitching・mappingの安定順SHA256一致。Day runは再試行履歴として増加する。

30. **resume**：day checkpointをtemp→rename。再開時complete/no_gamesを現在canonical Factと既存validatorで確認しskip。partial/unknownは再試行可能。全Season巨大transactionなし。

31. **limited degradation**：Batch Aのlimited insert-only / full authoritative correctionと回帰テストを維持。known値をlimited nullで上書きしない。

32. **Portable Export**：schema4、schema.sql / JSONL.gz / manifest / hashes。PASS。

33. **Scratch Restore**：PASS。Repository readback、12球団standings effectiveDate9/26一致。

34. **restore件数一致**：Game846 / batting1723 / pitching546 / mappings1290 / completeness62 / Day49。hash検証済み。7日保持encrypted artifact生成。

35. **Season batter**：既存Batter Aggregator：G PA AB R H 2B 3B HR RBI BB HBP SH SF SO SB CS AVG OBP SLG OPS。二刀流両役割を維持。

36. **Season pitcher**：既存Pitcher Aggregator：G(登板) GS outsRecorded BF H HR SO R ER pitchCount W L HLD SV ERA K9。IPはoutsの表示変換のみ。WHIPなし。

37. **Season Coverage**：partial。184日中 complete12 / no_games24 / partial2 / unknown146。最終成績とは表示しない。

38. **Metric Status**：Coverageから独立。complete / partial / unavailableを値とともに保持。null→0なし。Payload validatorがcomplete-null矛盾等を拒否。

39. **Player Season UI**：概要/成績に2026シーズン成績・保存済み成績・effectiveDate。独立Loading/Error/Empty。選択Playerのみ既存Season読取API、固定11SELECT、全選手再集計なし。

40. **sample players**：中島：G8 PA37 OPS.366 AVG.147 HR0 RBI2。坂本：G9 PA33 OPS.392 AVG.083 BB6。佐藤：G12 PA56 OPS.850 AVG.255 HR2 RBI8。上原：登板4 GS0 8outs=2.2IP BF13 SO3 ERA3.38 K9 10.1。早川：Fact0・Profile維持・Season Empty。

41. **Ranking Engine**：Season aggregateからcomplete metricだけ候補抽出。counting降順、ERA昇順、K9降順、canonical Player IDでstable tie-break。未qualified rate候補は内部診断専用。

42. **Counting rankings**：打者AVG/OPS/HR/RBI/H/SB、投手ERA/SO/W/HLD/SV/K9の内部候補構造。公開ranking arraysは空。Counting candidate HR/RBI/H/SB各322。

43. **rate-stat qualifier**：pending。公式規定打席/投球回を推測しない。信頼できるmetadata/運用方針を確定してからGateを開く。

44. **Ranking Production readiness**：NO / not_ready：season_coverage_not_complete、official_qualifier_unverified、public_ranking_not_enabled。Counting readinessもCoverage不足でnot_ready。

45. **Records read model**：HR H RBI SB SO W SV HLDのSeason counting候補を再利用。career/all-time/streak/award/projectionなし。

46. **Public Season Payload**：https://tomoya41.github.io/baseball-notes/data/npb/season/2026/latest.json。424選手、batter322 / pitcher204（両役割あり）。Aggregateのみ・Raw Factsなし。

47. **schemaVersion**：1。strict Zod validation、duplicate Player、nullable、Metric Status、Coverage件数/日付整合を検査。

48. **payload size**：762019 bytes（UTF-8、非圧縮）。生成13SELECT、DB 1012.3ms、aggregation 11.1ms、serialization 4.7ms、total 1290.7ms。

49. **public HTTP**：Season / HOT JSON HTTP200、Season schema validation PASS、effectiveDate2026-09-26。Pages公開アプリにSeason section表示済み。

50. **最新7d Coverage**：9/20〜9/26：complete6、partial1（9/22）、no_games0、unknown0、overall partial。

51. **HOT candidates**：466。eligible Batter0 / Starter0 / Reliever0、completePlayers0。

52. **HOT Production readiness**：NO / not_ready。

53. **HOT closed理由**：coverage_not_complete / no_production_eligible_players / scheduled_production_evidence_pending。公開3ランキング空。

54. **Scheduled proof**：別トラックの正式証拠は未確認。今回manual backfill/publishをScheduled proofとして扱っていない。

55. **Infrastructure Phase**：今回再判定・変更なし。別トラックのNOをmanual成功でYESへしない。

56. **Profile regression**：中島・上原・坂本・佐藤・早川のcanonical Profileを維持。Mapping拡張なし。

57. **Recent regression**：実APIで5PlayerのRecent7d=Analysis7dの各metric一致。Backfillにより追加Factの自然なaggregate変化のみ。

58. **Game Log regression**：実API HTTP200、9/25坂本PA3/AB2/BB1維持。Game Detail metadataと整合。

59. **Home/Away regression**：公開APIでclassified counting合計=30d Total、既存tests PASS。

60. **Opponent regression**：公開APIでclassified total=30d Total、canonical IDs維持、tests PASS。

61. **Batting Order regression**：公開APIでclassified total=30d Total、zero PA/substitute含む、tests PASS。

62. **Appearance Role regression**：公開APIでclassified total=30d Total、投手0-out/outs表示含むtests PASS。

63. **tests**：274 tests / 36 files PASS。Historical resume/no_games/future/current-year alias、Season nullable/Coverage/readiness/Records追加。

64. **lint**：PASS。

65. **typecheck**：PASS。

66. **build**：PASS。既存550KB chunk warningあり（失敗ではない）。

67. **Vercel build**：local npm run vercel-build PASS、実Production deployment READY。https://baseball-notes-recent.vercel.app。

68. **Pages Run**：https://github.com/tomoya41/baseball-notes/actions/runs/36284545656 success。修正前Read-only監査投影のstatus欠落を直して再実行、60 complete確認。

69. **Turso write**：実データのnet追加：Game806 / Batting1205 / Pitching385 / mappings906。Full correction可、limited保護。最終metadata収集first passのみSQL計測：2398 SELECT、1697 write statements / affected rows。初回大型Fact収集・replay・backupを含む全SQL総数は未計測。Day/stage履歴もwriteされるためnet Fact追加とwrite総数は別。Schema変更・Derived table追加なし。

70. **security**：credential/token、Raw HTML、internal Source IDsをSeason JSONへ含めず検査PASS。Raw backupは暗号化Artifactのみ、Pages未配布。月額追加0円、新Provider/有料APIなし。Daily/Freshness/Backup schedule変更なし。既存publish workflowにSeason JSON維持の1step追加、ingestion/HOTロジック変更なし。

71. **2026 Production Ranking使用**：NO。Season Coverageとofficial qualifier/public ranking policyが未確定。

72. **HOT Gateを開けるか**：NO。7d partial、Scheduled production evidence未確認。

73. **Batch Cへ進めるか**：NO（Batch BのSeason Coverage完成条件が残る）。UI仕上げ基盤はあるが次Batchは開始していない。

74. **残blocker**：146 unknown dates、9/19 verified identity、9/22 PA source検証、公式qualifier/public policy、別トラックScheduled proof。安全に確定不能なPlayer/PAを強制補完していない。

75. **次Batchでまとめるタスク**：まずBatch B残課題：既存Provider内のhistorical参加者取得経路検証＋146日収集、9/19 identity根拠確認、9/22実イベントfixture/PA解決、Coverage再監査。次にqualifier確認とGate再評価。Batch CのHome/Search/Records/UI仕上げはそれらの結果を踏まえて別指示で実施。

## 実行証拠

- Inventory: https://github.com/tomoya41/baseball-notes/actions/runs/36281511399
- Scratch pilot: https://github.com/tomoya41/baseball-notes/actions/runs/36281513147
- Historical collection: https://github.com/tomoya41/baseball-notes/actions/runs/36281845024
- Historical metadata/resume/replay: https://github.com/tomoya41/baseball-notes/actions/runs/36282882395
- Final read-only validation / backup / publish: https://github.com/tomoya41/baseball-notes/actions/runs/36284545656

既存nf3 current-year alias `y=0` は2026年JST内でのみこのBackfillに利用する。年が変わったらfail closed。

360px Lightは公開Pages、Darkは同一build＋実公開APIを使用したローカルDark media previewで目視。横幅overflowなし。Season詳細はnative details、Enter開閉確認、Coverage注記は文字で表示。実Android端末では未検証。

## 未解決日付一覧

|日付|状態|原因 / Game|
|---|---|---|
|2026-03-27|unknown|nf3 games page has no games|
|2026-03-28|unknown|nf3 games page has no games|
|2026-03-29|unknown|nf3 games page has no games|
|2026-03-30|unknown|nf3 games page has no games|
|2026-03-31|unknown|nf3 games page has no games|
|2026-04-01|unknown|nf3 pitch usage date missing: 2026-04-01|
|2026-04-02|unknown|nf3 pitch usage date missing: 2026-04-02|
|2026-04-03|unknown|nf3 pitch usage date missing: 2026-04-03|
|2026-04-04|unknown|nf3 pitch usage date missing: 2026-04-04|
|2026-04-05|unknown|nf3 pitch usage date missing: 2026-04-05|
|2026-04-07|unknown|nf3 pitch usage date missing: 2026-04-07|
|2026-04-08|unknown|nf3 pitch usage date missing: 2026-04-08|
|2026-04-09|unknown|nf3 pitch usage date missing: 2026-04-09|
|2026-04-10|unknown|nf3 pitch usage date missing: 2026-04-10|
|2026-04-11|unknown|nf3 pitch usage date missing: 2026-04-11|
|2026-04-12|unknown|nf3 pitch usage date missing: 2026-04-12|
|2026-04-14|unknown|nf3 pitch usage date missing: 2026-04-14|
|2026-04-15|unknown|nf3 pitch usage date missing: 2026-04-15|
|2026-04-16|unknown|nf3 pitch usage date missing: 2026-04-16|
|2026-04-17|unknown|nf3 pitch usage date missing: 2026-04-17|
|2026-04-18|unknown|nf3 pitch usage date missing: 2026-04-18|
|2026-04-19|unknown|nf3 pitch usage date missing: 2026-04-19|
|2026-04-21|unknown|nf3 pitch usage date missing: 2026-04-21|
|2026-04-22|unknown|nf3 pitch usage date missing: 2026-04-22|
|2026-04-23|unknown|nf3 pitch usage date missing: 2026-04-23|
|2026-04-24|unknown|nf3 pitch usage date missing: 2026-04-24|
|2026-04-25|unknown|nf3 pitch usage date missing: 2026-04-25|
|2026-04-26|unknown|nf3 pitch usage date missing: 2026-04-26|
|2026-04-28|unknown|nf3 pitch usage date missing: 2026-04-28|
|2026-04-29|unknown|nf3 pitch usage date missing: 2026-04-29|
|2026-04-30|unknown|nf3 pitch usage date missing: 2026-04-30|
|2026-05-01|unknown|nf3 pitch usage date missing: 2026-05-01|
|2026-05-02|unknown|nf3 pitch usage date missing: 2026-05-02|
|2026-05-03|unknown|nf3 pitch usage date missing: 2026-05-03|
|2026-05-04|unknown|nf3 pitch usage date missing: 2026-05-04|
|2026-05-05|unknown|nf3 pitch usage date missing: 2026-05-05|
|2026-05-06|unknown|nf3 pitch usage date missing: 2026-05-06|
|2026-05-08|unknown|nf3 pitch usage date missing: 2026-05-08|
|2026-05-09|unknown|nf3 pitch usage date missing: 2026-05-09|
|2026-05-10|unknown|nf3 pitch usage date missing: 2026-05-10|
|2026-05-12|unknown|nf3 pitch usage date missing: 2026-05-12|
|2026-05-13|unknown|nf3 pitch usage date missing: 2026-05-13|
|2026-05-14|unknown|nf3 pitch usage date missing: 2026-05-14|
|2026-05-15|unknown|nf3 pitch usage date missing: 2026-05-15|
|2026-05-16|unknown|nf3 pitch usage date missing: 2026-05-16|
|2026-05-17|unknown|nf3 pitch usage date missing: 2026-05-17|
|2026-05-19|unknown|nf3 pitch usage date missing: 2026-05-19|
|2026-05-20|unknown|nf3 pitch usage date missing: 2026-05-20|
|2026-05-21|unknown|nf3 pitch usage date missing: 2026-05-21|
|2026-05-22|unknown|nf3 pitch usage date missing: 2026-05-22|
|2026-05-23|unknown|nf3 pitch usage date missing: 2026-05-23|
|2026-05-24|unknown|nf3 pitch usage date missing: 2026-05-24|
|2026-05-26|unknown|nf3 pitch usage date missing: 2026-05-26|
|2026-05-27|unknown|nf3 pitch usage date missing: 2026-05-27|
|2026-05-28|unknown|nf3 pitch usage date missing: 2026-05-28|
|2026-05-29|unknown|nf3 pitch usage date missing: 2026-05-29|
|2026-05-30|unknown|nf3 pitch usage date missing: 2026-05-30|
|2026-05-31|unknown|nf3 pitch usage date missing: 2026-05-31|
|2026-06-02|unknown|nf3 pitch usage date missing: 2026-06-02|
|2026-06-03|unknown|nf3 pitch usage date missing: 2026-06-03|
|2026-06-04|unknown|nf3 pitch usage date missing: 2026-06-04|
|2026-06-05|unknown|nf3 pitch usage date missing: 2026-06-05|
|2026-06-06|unknown|nf3 pitch usage date missing: 2026-06-06|
|2026-06-07|unknown|nf3 pitch usage date missing: 2026-06-07|
|2026-06-09|unknown|nf3 pitch usage date missing: 2026-06-09|
|2026-06-10|unknown|nf3 pitch usage date missing: 2026-06-10|
|2026-06-11|unknown|nf3 pitch usage date missing: 2026-06-11|
|2026-06-12|unknown|nf3 pitch usage date missing: 2026-06-12|
|2026-06-13|unknown|nf3 pitch usage date missing: 2026-06-13|
|2026-06-14|unknown|nf3 pitch usage date missing: 2026-06-14|
|2026-06-16|unknown|nf3 pitch usage date missing: 2026-06-16|
|2026-06-17|unknown|nf3 pitch usage date missing: 2026-06-17|
|2026-06-19|unknown|nf3 pitch usage date missing: 2026-06-19|
|2026-06-20|unknown|nf3 pitch usage date missing: 2026-06-20|
|2026-06-21|unknown|nf3 pitch usage date missing: 2026-06-21|
|2026-06-22|unknown|nf3 pitch usage date missing: 2026-06-22|
|2026-06-23|unknown|nf3 pitch usage date missing: 2026-06-23|
|2026-06-24|unknown|nf3 pitch usage date missing: 2026-06-24|
|2026-06-25|unknown|nf3 pitch usage date missing: 2026-06-25|
|2026-06-26|unknown|nf3 pitch usage date missing: 2026-06-26|
|2026-06-27|unknown|nf3 pitch usage date missing: 2026-06-27|
|2026-06-28|unknown|nf3 pitch usage date missing: 2026-06-28|
|2026-06-30|unknown|nf3 pitch usage date missing: 2026-06-30|
|2026-07-01|unknown|nf3 pitch usage date missing: 2026-07-01|
|2026-07-02|unknown|nf3 pitch usage date missing: 2026-07-02|
|2026-07-03|unknown|nf3 pitch usage date missing: 2026-07-03|
|2026-07-04|unknown|nf3 pitch usage date missing: 2026-07-04|
|2026-07-05|unknown|nf3 pitch usage date missing: 2026-07-05|
|2026-07-07|unknown|nf3 pitch usage date missing: 2026-07-07|
|2026-07-08|unknown|nf3 pitch usage date missing: 2026-07-08|
|2026-07-09|unknown|nf3 pitch usage date missing: 2026-07-09|
|2026-07-10|unknown|nf3 pitch usage date missing: 2026-07-10|
|2026-07-11|unknown|nf3 pitch usage date missing: 2026-07-11|
|2026-07-12|unknown|nf3 pitch usage date missing: 2026-07-12|
|2026-07-14|unknown|nf3 pitch usage date missing: 2026-07-14|
|2026-07-15|unknown|nf3 pitch usage date missing: 2026-07-15|
|2026-07-16|unknown|nf3 pitch usage date missing: 2026-07-16|
|2026-07-17|unknown|nf3 pitch usage date missing: 2026-07-17|
|2026-07-18|unknown|nf3 pitch usage date missing: 2026-07-18|
|2026-07-19|unknown|nf3 pitch usage date missing: 2026-07-19|
|2026-07-20|unknown|nf3 pitch usage date missing: 2026-07-20|
|2026-07-21|unknown|nf3 pitch usage date missing: 2026-07-21|
|2026-07-22|unknown|nf3 pitch usage date missing: 2026-07-22|
|2026-07-23|unknown|nf3 pitch usage date missing: 2026-07-23|
|2026-07-24|unknown|nf3 pitch usage date missing: 2026-07-24|
|2026-07-25|unknown|nf3 pitch usage date missing: 2026-07-25|
|2026-07-26|unknown|nf3 pitch usage date missing: 2026-07-26|
|2026-07-31|unknown|nf3 pitch usage date missing: 2026-07-31|
|2026-08-01|unknown|nf3 pitch usage date missing: 2026-08-01|
|2026-08-02|unknown|nf3 pitch usage date missing: 2026-08-02|
|2026-08-03|unknown|nf3 pitch usage date missing: 2026-08-03|
|2026-08-04|unknown|nf3 pitch usage date missing: 2026-08-04|
|2026-08-05|unknown|nf3 pitch usage date missing: 2026-08-05|
|2026-08-06|unknown|nf3 pitch usage date missing: 2026-08-06|
|2026-08-07|unknown|nf3 pitch usage date missing: 2026-08-07|
|2026-08-08|unknown|nf3 pitch usage date missing: 2026-08-08|
|2026-08-09|unknown|nf3 pitch usage date missing: 2026-08-09|
|2026-08-11|unknown|nf3 pitch usage date missing: 2026-08-11|
|2026-08-12|unknown|nf3 pitch usage date missing: 2026-08-12|
|2026-08-13|unknown|nf3 pitch usage date missing: 2026-08-13|
|2026-08-14|unknown|nf3 pitch usage date missing: 2026-08-14|
|2026-08-15|unknown|nf3 pitch usage date missing: 2026-08-15|
|2026-08-16|unknown|nf3 pitch usage date missing: 2026-08-16|
|2026-08-18|unknown|nf3 pitch usage date missing: 2026-08-18|
|2026-08-19|unknown|nf3 pitch usage date missing: 2026-08-19|
|2026-08-20|unknown|nf3 pitch usage date missing: 2026-08-20|
|2026-08-21|unknown|nf3 pitch usage date missing: 2026-08-21|
|2026-08-22|unknown|nf3 pitch usage date missing: 2026-08-22|
|2026-08-23|unknown|nf3 pitch usage date missing: 2026-08-23|
|2026-08-25|unknown|nf3 pitch usage date missing: 2026-08-25|
|2026-08-26|unknown|nf3 pitch usage date missing: 2026-08-26|
|2026-08-27|unknown|nf3 pitch usage date missing: 2026-08-27|
|2026-08-28|unknown|nf3 pitch usage date missing: 2026-08-28|
|2026-08-29|unknown|nf3 pitch usage date missing: 2026-08-29|
|2026-08-30|unknown|nf3 pitch usage date missing: 2026-08-30|
|2026-09-01|unknown|nf3 pitch usage date missing: 2026-09-01|
|2026-09-02|unknown|nf3 pitch usage date missing: 2026-09-02|
|2026-09-03|unknown|nf3 pitch usage date missing: 2026-09-03|
|2026-09-04|unknown|nf3 pitch usage date missing: 2026-09-04|
|2026-09-05|unknown|nf3 pitch usage date missing: 2026-09-05|
|2026-09-06|unknown|nf3 pitch usage date missing: 2026-09-06|
|2026-09-08|unknown|nf3 pitch usage date missing: 2026-09-08|
|2026-09-09|unknown|nf3 pitch usage date missing: 2026-09-09|
|2026-09-10|unknown|nf3 pitch usage date missing: 2026-09-10|
|2026-09-11|unknown|nf3 pitch usage date missing: 2026-09-11|
|2026-09-12|unknown|nf3 pitch usage date missing: 2026-09-12|
|2026-09-19|partial|identity未解決：早川隆久 / npb:game:a887632b93b68faeaae2|
|2026-09-22|partial|plateAppearancesKnown / PA:baystars / npb:game:4bbbebab56219fb9f303|
