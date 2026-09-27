# Batch B残件＋Batch C独立開発 — 2026-09-27

監査基準：2026-09-27 19:51 JST。対象Seasonは2026-03-27〜09-26、184日。
Coverage Closureは未完。独立Product Surfaceは公開済み。Scheduled Operationsの証拠確認・Infrastructure Phase再判定はこの作業で行わない。

## Coverage（報告1〜18）

1. 雨天コールド6試合は以下。canonical IDを対象識別子として監査し、Productionコードへの列挙はしていない。

|日付|canonical Game ID|ホーム|ビジター|スコア home–away|収集時参加者 B/P|保存B/P|状態|
|---|---|---|---|---|---:|---:|---|
|04-09|npb:game:2469292e18a73924f23c|阪神|ヤクルト|2–0|24/5|0/0|partial|
|04-14|npb:game:99b0c4913966af7674ad|ヤクルト|DeNA|5–3|23/4|0/0|partial|
|05-03|npb:game:e9a705d2e3ddfe1dabe8|阪神|巨人|3–0|20/3|0/0|partial|
|06-20|npb:game:b2f541664347c98a1f62|ヤクルト|広島|6–8|30/7|0/0|partial|
|09-09|npb:game:51c3f0f8dba6a7bb710e|ロッテ|楽天|10–4|23/9|0/0|partial|
|09-09|npb:game:645ed547effceffc5ca9|DeNA|ヤクルト|9–2|24/5|0/0|partial|

保存0/0は参加者が存在しない意味ではない。既存atomic Game writeがvalidation失敗を検出して、部分的なPlayer Factを保存していない。

2. 全6試合で不足しているのは、明示的な正式短縮終了状態・終了inning・両チームの実際の守備outsを投手集計とは別に確認する証拠。現failureは各試合の両チーム `pitchingOuts`。収集時の参加者、PA/BF、score/hits/HRチェックは通るが、通常終了のouts条件は通らない。
3. Complete条件：canonical headerと一致する正式shortened-final状態・最終score・終了inning（5以上）・独立した両軍守備outs・検証時刻/provenanceを確認する。投手outsをその守備outsと照合し、通常と同じ参加者、PA/BF、score/hits/HR、identity検証も通す。Game全体をatomicに保存する。投手outsから終了inningを推定しない。
4. nf3の公開result/schedule表、team総合表、先発一覧、公開navigationを追加調査した。result表は勝敗/score/先発IPを示すが、先発IPは試合終了inningではない。team総合表・先発一覧にもGameごとの正式called終了fieldは確認できない。公開navigationの一部は相対URL重複で404になり、利用可能な独立ending証拠は得られなかった。別Parserで同じ投手outsを読む方式は採用していない。
5. 一般ルールは既存 `src/domain/npb-game-completion.ts` の証拠schemaとvalidatorを再利用。独立evidenceがない場合はshortened validationへ進まずpartialを維持する。既存ledgerへの証拠保存にもcanonical header照合を要求する。今後のSource adapterが証拠を安全に取得できれば、Game別例外なしで利用可能。
6. 日付/Game IDを条件にしたcomplete hardcode：なし。手入力numeric patch・Source追加・validator緩和：なし。
7. Repair成功：0試合。
8. Repair不能：6試合。
9. 理由：採用済みnf3取得経路から必要な独立終了evidenceを確立できない。外部確認候補はNPB公式Game scoreページ（正式終了・inning別score）。手動の確認資料としては利用できるが、二次利用・転載注意表示があり、自動取得/collector利用許諾は確認できない。この作業ではcanonical collectorへ追加しない。
10. Before：complete154 / confirmed no_games25 / partial5 / unknown0。
11. After：同じ。監査対象184日。
12. Complete：154日。
13. Confirmed no_games：25日。
14. Partial：5日（上表6試合）。
15. Unknown：0日。
16. 現在Fact再validationは固定5SELECT、3,325ms。819試合complete、上記6試合のみ未解決。残るscheduled/postponed等をFinal Fact失敗として扱わない。品質：Batting22,590件、PA known22,590/unknown0/zero4,401、打順valid22,590/missing0/invalid0。Pitching6,848件、starter1,638/reliever5,210/unknown0。
17. Idempotency：今回のread-only生成/監査によるFact writeなし。前Batch backupと今回backupでGames/Batting/Pitching/Mappingsの全件SHA-256が一致。監査前後も870/22,590/6,848/1,627件で不変。Favoritesのduplicate addはlocal保存を増やさない。
18. Portable Export schema4・manifest/hash・Scratch SQLite Restore・Repository readback PASS。全table件数・代表Game値を照合。7日保持encrypted artifact生成済み（1,543,397 bytes）。これは手動公開/backup検証でありScheduled proofではない。

## Source境界と確認先

確認日：2026-09-27。

- [nf3公開top](https://nf3.sakura.ne.jp/)
- [nf3 team総合表](https://nf3.sakura.ne.jp/Stats/team_etc.htm)
- [nf3先発一覧](https://nf3.sakura.ne.jp/Stats/Starter.htm)
- [nf3公開schedule/result表](https://nf3.sakura.ne.jp/php/stat_disp/stat_disp.php?y=0&leg=0&mon=0&tm=T&vst=all)
- [NPB公式4/9試合確認資料](https://npb.jp/scores/2026/0409/t-s-03/)：手動参照のみ。本文の公開再配布・新規自動収集は行わない。

同一Provider内でも、独立してGame終了を表すstatus/inning/line-score fieldなら証拠になり得る。一方、投手成績の同一値を別ページ・別Parserで読むだけでは独立守備outs証拠にはならない。現在の通常9回/延長/ホームリード時終了ルールも変更しない。

## Game Surface（報告19〜32）

19. Read model：canonical Game ID/date/gameNumber/JST開始時刻/status/home-away canonical Team metadata/nullable score/completeness/打撃・投球Fact availability/detail availability。Zod strict schemaで公開形を検証。
20. Public schemaVersion1：`data/npb/games/manifest.json`、`games/dates/YYYY-MM-DD.json`、`games/recent.json`。Recordsは `data/npb/records/2026/latest.json`。
21. 分割：manifest1個＋選択日1個。195日分を生成するがClientへ全日ロードしない。recentは最大6Gameのmetadataだけ、Home表示は最大2。Game Detailは既存Game-specific APIを利用。Raw Player Facts全シーズンJSONを新設しない。
22. 日程URL：[日程・結果](https://tomoya41.github.io/baseball-notes/#/NPB/schedule?date=2026-09-25)。
23. 日付input・前日/翌日・URL queryを共有し、既存Season metadataの範囲内で移動。JSTの保存日付をUTCローカル暗黙変換でずらさない。キーボードEnterで翌日移動も確認。
24. Confirmed no_gamesだけ「試合なし」。4/6実データで確認。unknownは収集状況未確認として分離。
25. Partialは「一部データ確認中」。9/9の6試合を消さず表示し、該当2試合にも状態を付ける。
26. Detail URL：`#/NPB/games/{encodedCanonicalGameId}`。例：[9/25 DeNA–阪神](https://tomoya41.github.io/baseball-notes/#/NPB/games/npb%3Agame%3A32c76ee9e92f7408892c)。直アクセス、日程、既存Player Game Logから利用可能。
27. Batting：打順/name/先発・途中出場/AB/H/RBI/HRを第一表示、展開でPA/R/2B/3B/BB/HBP/SH/SF/SO/SB/CS。Nullableは「—」。坂本誠志郎PA3/AB2/BB1、阪神PA36/H5/HR1、DeNA PA33/H8/HR1を公開画面で確認。
28. Pitching：role/name/IP/H/R/SO・保存decision、展開でBF/HR/ER/pitchCount/四死。W/L/HLD/SVは既存decisionを保存意味のまま表示。WHIPなし、internalはoutsRecorded、表示のみ6.0/5.2/0.1/0.0等。
29. 同打順の複数canonical Playerを保持。代走等のPA0/AB0も「打席なし」で表示。9/25植田海等を確認。交代順を推測せず、その限界を表示。
30. 救援順を推測しない。先発/救援分類とstable fallback表示は正確な登板順を意味しない旨を明示。投球回やHLD/SVから順序を作らない。
31. 選手名はcanonical Player Profileへリンク。Game→坂本誠志郎→Game Logの既存metadata一致を公開画面で確認。
32. Inning score/PBPなし。雨天Gameは保存headerと利用可能Sectionだけ表示し、保存Factなしを0成績へ補完しない。

## Favorites / My（報告33〜39）

33. 既存Preferences/SettingsStore＋Favorite serviceを再利用。Webはlocal-first storage、Repository境界を維持。Account/cloud/backend tableなし。
34. Keyはleague/kind/canonical Player ID。名前・現在球団で保存しない。
35. Profileの既存Favorite操作をcanonicalデータで利用。坂本誠志郎の追加・解除を公開UIで確認。
36. Search各rowに独立Favorite buttonを追加。リンク内へbuttonを入れない。中島大輔の追加・解除を公開UIで確認。
37. Myは保存IDを実Directoryと照合しname/team/known position＋Profile linkを表示。Position未登録は省略。Bottom Nav5項目を維持。
38. Reload後も坂本誠志郎を保持することを公開UIで確認。テスト追加分は解除済み。
39. 壊れた/未登録IDは「選手情報を確認できません」と解除操作を表示。Profileを捏造せず、画面全体をErrorにしない。Duplicate add・reload・remove・broken IDをtestsで確認。

## Home / Records（報告40〜44）

40. Homeに最新結果最大2件＋日程への入口、お気に入り最大2件＋My入口。ニュースfeedや大きなNavigationを追加しない。NPB sample Player card・sample Analysis/Records/Myへのfallbackを除き、実データ/明示状態へ接続。
41. HOT「ランキング準備中」を維持。Engine/score/ranking/Gate変更なし。
42. Recordsは既存Season aggregateから生成したcapability read model。Not readyなら「2026年シーズン集計を確認中」、展開で理由/coverageを確認。Loading/Error/Emptyを区別。
43. 現state：not_ready / coverage partial / qualifier unknown。HR/H/RBI/SB/SO/W/SV/HLDカテゴリを定義するが、閉じたGateでは公開rowsをすべて空にする。内部候補の漏出をschemaでも拒否。
44. Gateが開けば大規模コード変更不要：YES。Verified complete coverage/qualifierを満たすready payloadで既存カテゴリUIが値・ties・canonical Player linksを表示することをfixture検証。現在は公開順位なし。

## Watcher（報告45〜52）

45. 既存Watcher regression PASS。毎時17分/Asia-Tokyo/start+120分、前時刻・ongoing・既収集Final・mixed/no_games/延期・partial/all-terminalケースを維持。
46. Source HTTP behavior変更なし。Status/schedule軽量チェックだけ。Game Surface生成は保存済みDB readのみで外部Sourceへアクセスしない。
47. Full collectionはnewly final＋未completeのみ。毎時全detail取得はしない。
48. 全予定Gameがterminal＋現在Fact validation成功の新Day complete時にpublish。既publish日はskip、通常1日1回。手動再publishは別。
49. 03:37 JST Daily cron維持。Safety Net公開でGame Indexを現在DBから再生成する処理のみ追加し、cron/collector semanticsを変更しない。
50. 12:17 JST Freshness変更なし。
51. 今回のmanual workflow_dispatchをScheduled proofとして扱わない。
52. Infrastructure Phase再判定なし。Operations監視は別トラック。

## Performance（報告53〜60）

53. Game Index repository固定5 SELECT＋effectiveDate取得1＝生成全体6 SELECT。人数/Game数に応じた追加SQLなし。Client表示はDB queryなし。
54. 本番生成1,335ms、DB read761ms。Current Fact validationは別5 SELECT/3,325ms、品質監査別11 SELECT/2,709ms。
55. 全195 date payload合計320,739 bytes、最大1日2,184 bytes。9/25は1,825 bytes・HTTP200/fetch555ms、4/6は128 bytes/206ms、9/9は2,168 bytes/209ms（単回実測、SLAではない）。
56. Game Detailは既存固定6 SELECT、未存在IDはheader1 SELECTで404。Playerごとの追加queryなし。
57. 9/25代表Game response10,533 bytes。
58. Public API HTTP200/client fetch65ms（cache hitを含む）。Server-Timingに記録された生成時DB1,439ms/projection28ms。両者を同じ計測区間として混同しない。
59. Favorites操作はlocal set membership/storageのみ、operationによるnetwork0。Directoryの初回取得は表示用で別。Add/remove idempotent、canonical IDを保持。
60. Recordsは生成済みSeason JSONを再利用し追加DB SELECT0、payload637 bytes、HTTP200/fetch210ms。

## Quality（報告61〜69）

61. 360px Light：公開日程/Box Score/Profile/Search/My/Recordsを確認。横overflowなし（viewport360、document scrollWidth345、scrollbar除く）。9/25の打撃詳細を展開して確認。
62. 360px Dark：同じbuilt UI＋既存Dark CSSをlocal QAで強制適用して日程/Box Score/Recordsを確認。CSS media内の既存値を利用し、新しいProduction theme設定は追加していない。Public API/公開date payloadを使用。412×915 Android幅も確認（scrollWidth397）。QA HTML/CSSはignored dist内のみ。
63. 明示home/away/score/role labels、buttonのFavorite aria label/pressed、日付label、details/summary、keyboard Enter、canonicalリンク、5項目Bottom Nav。主要button/summaryは44px以上の設計。色のみの比較なし。実screen reader音声の操作テストは行っておらず、AX/DOM labelを確認した。
64. 全341 tests/41files PASS。新13tests＋既存Game Detail/Recent/Analysis/Favorites/Watcher/Shortened Evidence回帰。Ready/not_ready/unknown/duplicate/doubleheader/nullable/固定SELECTを検証。
65. Lint PASS。最終QA時の一時scriptを削除して再実行済み。
66. Typecheck PASS。
67. Build PASS。既存main bundle約561KBのwarningは残る（本作業で無関係な分割は行わない）。
68. Vercel build PASS。
69. Pages manual Run [36313869271](https://github.com/tomoya41/baseball-notes/actions/runs/36313869271) PASS（adb1700）。Game Index/Records/Season public HTTP200、encrypted backup/restoreも同Run PASS。最終小修正の再公開Runは末尾に追記する。

## 判定（報告70〜76）

70. Coverage Closure完了：NO。6試合の独立ending evidence未取得。推測complete0件。
71. Coverage未完でも独立Batch C部分完成：YES。日程/結果・Game Detail導線・Favorites/My・Home・Records capabilityを実装。
72. NPB Game browsing Production利用可能：YES。Partialを明示し利用可能データのみ表示する。完全Box Scoreがない6試合も試合を消さない。
73. Favorites/My Production利用可能：YES。Local-first、canonical保存、reload/壊れたID対応。
74. Records Gate付きProduction-ready：YES。ランキング自体はnot_ready、暫定順位を通常順位として出さない。
75. 独立Game browsing/Favorites/Records状態UIを止めるblockerなし。全Seasonランキングには6試合の完了証拠/atomic FactsとCoverage、qualifier computation、Production readinessが必要。HOT正式Scheduled Operations proofも別Gate。
76. 次の統合Batch候補：利用条件を確認できるshortened終了evidence adapter→6試合repair/backup→Season Counting/Rate qualifier再評価、別OperationsでWatcher/Daily/Freshness Scheduled証拠、UI bundle performanceの小さな改善。MLB/Android/PBP/Cloud Favoritesへ自動で進まない。

## Hygiene / Security

新規公開payloadにraw HTML、nf3 source ID/URL、Turso credential、内部stackなし。既存canonical IDのみ。Source/Parser/Collector/identity/Analysis/HOT Engineは変更しない。既存mainの変更はfetchして保持。新規Source収集なし、Fact writeなし、schema migrationなし。生成物・encrypted backup・QA screenshotはignored `.data`/`dist`に置きGitへ含めない。New scriptsはworkflow/testsから参照される。Public publishを行う各workflowは新payloadを再生成またはpreserveして削除を防ぐ。
