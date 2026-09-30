# Batch E — MLB Historical Advanced / Ranking closure

監査基準: 2026-09-30 JST。対象はRetrosheet公式2020〜2025 regular-season releaseのみ。MLB Current、Statcast、Android、Push、NPB Operations判定は対象外。

## 全Season照合

| Season | 対象 / 再構成Games | Canonical PA | 開始状況unknown | Count形式既知PA | Coverage |
|---|---:|---:|---:|---:|---|
| 2020 | 898 / 898 | 66,506 | 1 | 47,991 | complete |
| 2021 | 2,429 / 2,429 | 181,818 | 9 | 128,280 | complete |
| 2022 | 2,430 / 2,430 | 182,052 | 5 | 127,934 | complete |
| 2023 | 2,430 / 2,430 | 184,104 | 8 | 129,626 | complete |
| 2024 | 2,429 / 2,429 | 182,449 | 10 | 127,444 | complete |
| 2025 | 2,430 / 2,430 | 182,926 | 9 | 128,228 | complete |
| 合計 | 13,046 / 13,046 | 979,855 | 42 | 689,503 | complete |

42打席はPA途中の打者/投手交代により開始状況を割り当てない保守的なnullable判定。対戦関係・結果・inningは既知。Outs/base/score分類では除外し、不明数をUIへ返す。Count形式の既知率は約70.37%であり、Count分析をProduction化する根拠にはしない。

BatterのPA/AB/H/2B/3B/HR/BB/HBP/SO/SH/SF、PitcherのBF/H/HR/BB/HBP/SOをGame × Team × Playerで全件照合。保存済みboxscoreのknown値を比較し、0PA/0BFも保持。最終score、守備outs、play間のouts/base/score連続性、保存打順も検査した。全Seasonでmetric mismatch / state issue / parser failure / skipped Game / identity unresolvedは0。未説明差分0。

Pilotで見つけた一般的問題は、NP（no play）を延長automatic runner配置前のPA開始として扱った4件のbase-continuity差分、および同一選手が両球団で出場するsuspended Gameでteamを省いた照合による4件の差分。NPは明示no-playとして扱い、照合keyへteamを含めて解消した。日付/Game別hardcode、boxscore数値変更はない。

## Ranking資格

[公式規定とSeason別一次資料](mlb-ranking-rule-2026-09-30.md)。AVG/OBP/SLGはAL/NLごとのRule 9.22(a)タイトル例外を個別評価。仮想hitless ABはread modelだけで使用し、元Factと表示元成績を変更しない。複数の不足PA候補が通常首位を上回る場合も、調整値が最も高い候補だけを例外対象とする。OPS/K9は通常PA/IP基準を用いるアプリのsample-qualified統計順位であり、公式タイトルではない。

| Season | qualified | qualified_by_exception | unqualified | unknown |
|---|---:|---:|---:|---:|
| 2020 | 640 | 0 | 6,212 | 0 |
| 2021 | 582 | 0 | 7,758 | 0 |
| 2022 | 600 | 0 | 7,560 | 0 |
| 2023 | 602 | 0 | 7,398 | 0 |
| 2024 | 608 | 0 | 7,414 | 0 |
| 2025 | 652 | 0 | 7,598 | 0 |
| 合計 | 3,684 | 0 | 43,940 | 0 |

件数はmetric × league × Player候補判定数であり、distinct Player数ではない。実データに例外適格者は0。規則Commentの490 PA / 440 AB / 165 Hへ不足12 ABを加える165/452の例、および例外失敗・指標別判定・複数候補比較をfixture検証。2020は60 Games、186 PA、180 outs。2021〜2025は各一次資料で162 Games、502 PA、486 outsを確認。未実施/cancelled Gameを理由に分母を減らさない。

## Performance / Storage

PAはTursoではなく既存MLBローカルrelease SQLiteへ保存。remote PA write / remote size増加は0。2つのmatchup indexのみ。PAテーブルはGame×sequenceのWITHOUT ROWID primary key、1 Gameのcorrectionをatomic replace。未変更のhash/reportはwrite 0。

| 項目 | 実測 |
|---|---|
| PA事前概算 | 約982,000 PA、rowのみ約315 MB。pilotのindex込み追加量から全体追加約735 MBへ更新 |
| PA実数 | 979,855 |
| SQLite before / after | 172,060,672 / 913,920,000 bytes、増加741,859,328 bytes |
| Batter/Pitcher indexes | 177,680,384 / 177,565,696 bytes |
| Portable gzip before / after | 16,238,916 / 65,518,293 bytes |
| PA全件再投入 | 74,084 ms、13,053 SELECT、write 0、HTTP 0、retry 0 |
| 新規PA logical writes概算 | 979,855 rows + 13,046 Game delete/upsert各1 = 1,005,947 statements。DDL別。再投入0 |
| Rate全Season生成 | 8 SELECT、4,927 ms、DB write 0 |
| Advanced全Season/範囲生成 | 13 SELECT、419,827 ms（ローカルOneDrive下の多数gzip出力込み）、DB write 0 |
| Advanced public audit | 11,521 files、13,010 ms、PA両role/partition/順位/ties/schema/private-field監査PASS |
| Historical public gzip総量 | 124,136,959 bytes、Coreからの増加73,919,597 bytes |
| Advanced最大gzip | 50,774 bytes |
| Historical全体最大gzip | 269,717 bytes（既存Player payload） |
| Raw PA public | 0。public preservation tarもaggregate/Game Core payloadのみ |

ローカル代表SQL（各1 SELECT、warm single-run measurement、rows-scannedはSQLite API非提供）:

| Query | 結果rows | DB read ms | aggregation ms | total ms | serialized bytes |
|---|---:|---:|---:|---:|---:|
| Ohtani × Valdez | 1 | 0.84 | 1.61 | 2.48 | 303 |
| Batter opponent list | 791 | 53.37 | 25.11 | 79.60 | 270,341 |
| Pitcher opponent list | 541 | 32.89 | 8.53 | 42.18 | 191,007 |
| Outs split | 3 | 42.05 | 0.13 | 42.21 | 1,113 |

EXPLAIN QUERY PLANは対戦pair/index SEARCH、opponent listはsubject先頭のindex SEARCH。上表のbytesはSQL診断のcount＋metric JSONで、公開gzipのtransfer sizeではない。公開はDB SELECT 0、選手/Seasonごとにaggregate 1 fetch。scope変更以外の相手検索/条件切替は追加HTTP/DB queryなし。高度分析は初期collapsedで遅延取得。

代表BvP: Shohei Ohtani × Framber Valdez、2020〜2025収録期間内。PA39 / AB32 / H4 / 2B1 / 3B0 / HR1 / BB6 / HBP0 / SO9、AVG .125 / OBP .263158 / SLG .250 / OPS .513158。PAとAB+BBが一致しない1打席は明示result `xi`（捕手干渉）1件で、AB対象外PAを残す公式processed flagsに従う。相手同Game出場だけから対戦を作らない。

無料構造: 公開repo標準Ubuntu Actions、無料Pages、ローカルSQLite、release時だけ明示import。新しい有料API/service/cronなし。archiveは6 Season ZIP＋Chadwickを再利用（既存download計81,168,942 bytes）。PAのGame別HTTPなし。Plain backupの重複Artifactを廃止し、NPB＋MLB combined encrypted portable backupに一本化、7日保持。Pages artifactは1日。公開aggregate保持archiveは同じpublic GitHub repositoryのcontent-addressed Release assetへ保存し、Pagesは約124 MBの画面用payload＋小さなSHA256 pointerのみとする。以前の約250 MBの二重配置を避ける。Release assetは2 GiB/file未満、GitHubの一次資料ではtotal size/bandwidth制限なし。旧Pages archiveも移行/rollback時はhash検証して読み取れる。[GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)参照。Artifact保管は時間積算なので、アカウント全体の別用途も含めた請求額保証とは分ける。[GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)、[Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)参照。追加recurring service cost ¥0。

## Backup / UI / Regression

Portable schema/hash/manifest/chunk照合、空Scratch restore、全table件数、代表Player/Game/Season/PA readback PASS。PA979,855、PA Game metadata13,046、Game13,046、Player2,840、mapping5,680を復元。Scratch SQLite879,386,624 bytes（fragmentationが違うためsource file bytesとの一致は条件でない）。代表PA `mlb:pa:e5e1f947-29d0-5976-9b72-2f6053d90b0b` の29 fields一致。schema SHA256 `58aa1ac62775bd4e0032d912e34a903a39df4ff586a254e4c1bfa619e6ea03ff`。

360px DarkでBvP検索/range、投手の被打撃表示、outs/RISP切替。360px Lightで2020 Rate/AL/NL/ERA切替、412px幅、keyboard Tabとlabelを確認。controlsは44px以上、page scrollWidthはclientWidthと一致、chips/table内部のみ横スクロール。42 nullable contexts、null metric、小sample、件数0/emptyを明示。MLBにのみ高度分析を表示し、NPBのAnalysisに空のBvP UIを足さない。

NPB code、Fact、Coverage、雨天partial、HOT/Ranking Gate、Infrastructure Phaseは変更しない。公開時のNPB読み取り・payload保持とbackupはread-only。別Operations trackでの並行更新がある場合、今回の変更と混同しない。MLB Current API、API-SPORTS、Savant等へのアクセス0。

## 完了報告78項目

| # | 項目 | 結果 |
|---:|---|---|
| 1 | 公式一次資料 | 2025/2020 Official Baseball Rules 9.22(a)/Comment/(b)＋各年MLB schedule一次資料。上記provenance doc |
| 2 | Batting rule | league予定Games×3.1を四捨五入。AL/NL別 |
| 3 | 不足PA例外 | AVG/OBP/SLG別に仮想hitless AB追加後のleague最高値で判定。Fact未変更 |
| 4 | Pitching rule | ERAは予定Games相当IP。outs≥Games×3 |
| 5 | 2020 | 60 Games / 186 PA / 180 outs |
| 6 | 資格件数 | qualified3,684 / exception0 / unqualified43,940 / unknown0。metric別候補数 |
| 7 | Rate Production | YES（検証済みHistorical） |
| 8 | 公開Season | 2020〜2025、AVG/OBP/SLG/OPS/ERA/K9。OPS/K9はsample-qualified app stats |
| 9 | PBP source | Retrosheet公式各年csvs.zip内plays CSV |
| 10 | 対象Games | 13,046 |
| 11 | 再構成Games | 13,046 |
| 12 | PA rows | 979,855 |
| 13 | identity unresolved | 0 |
| 14 | parser failures | 0 |
| 15 | skipped Games | 0 |
| 16 | Batter PA | 全件照合、mismatch0 |
| 17 | Batter AB | 全件照合、mismatch0 |
| 18 | H/2B/3B/HR | 全件照合、mismatch0 |
| 19 | BB/HBP/SO | 全件照合、mismatch0 |
| 20 | SH/SF | 全件照合、mismatch0 |
| 21 | Pitcher BF | 全件照合、mismatch0 |
| 22 | Pitcher counts | H/HR/BB/HBP/SO全件照合、mismatch0。PA由来ERA/R/ERを捏造しない |
| 23 | mismatch総数 | 0（修正後） |
| 24 | reason内訳 | 残件全category0。pilotのNP semantic4 / team-less validator4を一般修正 |
| 25 | unexplained | 0 |
| 26 | Direct BvP | YES |
| 27 | BvP Season | 2020〜2025＋明示収録期間合計 |
| 28 | 代表BvP | Ohtani × Valdez、上記実測 |
| 29 | multi-season | PA39、複数Season/gameのexact relationを合算 |
| 30 | BvP performance | pair1 SELECT / 2.48ms local、公開はDB0 / aggregate1 fetch |
| 31 | inning | 1〜3/4〜6/7〜9/延長、全PA既知 |
| 32 | outs | 0/1/2、42開始context不明PA除外 |
| 33 | base-state | empty/runners、42除外 |
| 34 | RISP | YES、開始base maskの2/3塁。推測なし |
| 35 | score differential | ahead/tied/behind、player所属team基準、42除外 |
| 36 | TTO PoC | source先発×lineup-slot再訪回数。代表Game first18 / second16 / third+1 |
| 37 | TTO Production | NO。公式/共通TTO定義と全variation検証未完、UIなし |
| 38 | Count | evaluate。形式known689,503/979,855、coverage不足、Productionなし |
| 39 | Advanced UI | MLB Playerのcollapsed高度分析、相手検索（40件上限）、期間/situation/二刀流role切替 |
| 40 | Capability manifest | directBvp/situations ready、TTO/count evaluate、Statcast unavailable、Current unavailable |
| 41 | Raw PA Pages | 非公開。aggregateだけ |
| 42 | estimated PA | 約982,000 |
| 43 | actual PA | 979,855 |
| 44 | DB before/after | 172,060,672 / 913,920,000 bytes、Turso増加0 |
| 45 | Backup before/after | 16,238,916 / 65,518,293 bytes compressed |
| 46 | import runtime | final全件74.084秒（hash/validation/parse込み、再投入） |
| 47 | idempotency | full reimport0 writes、DB値・件数・size不変 |
| 48 | indexes | batterId/pitcherId/season、reverse各1。query plan使用確認 |
| 49 | BvP queries | pair/opponent-list各1 SELECT、上表 |
| 50 | Situation queries | outs1 SELECT42.21ms local、UI条件追加query0 |
| 51 | Rate queries | 全Season8 SELECT4.927秒、公開UI1 static fetch/Season |
| 52 | Portable backup | PASS、NPB＋MLB combined encrypted export |
| 53 | Scratch restore | PASS、全table件数/hash照合 |
| 54 | 代表PA restore | PASS、上記29 fields一致 |
| 55 | NPB Regression | 全既存NPB testsを含むcheck。公開Smoke結果は下記release evidence |
| 56 | NPB Facts | 今回write0 |
| 57 | NPB Coverage | ロジック/record変更なし |
| 58 | NPB HOT Gate | 変更なし |
| 59 | NPB Ranking Gate | 変更なし |
| 60 | Infrastructure | 再判定/変更なし。manualをScheduled proof扱いしない |
| 61 | MLB Current | 収集0 |
| 62 | recurring¥0 | YES（新規recurring service/remote PA costなし、artifact時間積算は上記） |
| 63 | 360 Light | PASS、2020 threshold/rate UI |
| 64 | 360 Dark | PASS、BvP/状況別、table内部scrollのみ |
| 65 | accessibility | label/aria state/keyboard/44px control/page overflow確認PASS |
| 66 | tests | 426 tests / 45 files PASS |
| 67 | lint | PASS |
| 68 | typecheck | PASS |
| 69 | build | PASS。既存main bundle >500kB warningは残る |
| 70 | Vercel build | PASS（build-recent-api含む） |
| 71 | Pages | release evidence節にRun/status/public HTTPを記録 |
| 72 | Historical Advanced | YES、検証済み範囲のBvP/状況別 |
| 73 | BvP Production | YES |
| 74 | Rate Production | YES |
| 75 | Situation範囲 | inning/outs/bases/RISP/scoreのみ。nullable context除外 |
| 76 | Android/Release開発へ | YES。実行はしない。NPB Operations Gateとは分離 |
| 77 | 残blocker | TTO定義/全validation、Count coverage、NPB雨天6Game証拠/Operationsは別track |
| 78 | 次統合Batch | Release UX/性能/アクセシビリティ整備、Android設計をユーザー指示後に。Statcast/Currentは未着手 |

## Release evidence

2026-09-30 JSTの[manual release Run 36665572619](https://github.com/tomoya41/baseball-notes/actions/runs/36665572619)はsuccess。03:42:02〜03:56:01 UTC（12:42:02〜12:56:01 JST）、約13分59秒。Core source取得7 requests / 81,168,942 bytes、Core import91,235 ms、PA cold import253,934 ms / 1,005,947 logical writes、DB169,160,704→905,998,336 bytes。既存archiveを利用するPA工程の追加HTTPは0。Advanced aggregate生成161,455 ms / 13 SELECT、audit12,291 ms。全Seasonのmismatch/identity/parser/skippedは0。CI代表pair1 SELECT / 1.53 ms、相手一覧batter54.94 ms / pitcher28.04 ms、outs15.61 ms。

同RunでMLB portable export/Scratch Restore/代表PA29 fieldsとNPB remote export/restoreがPASS。combined encrypted artifact66,546,058 bytes、保持7日。NPB readback Games898 / Batting22,804 / Pitching6,913 / mappings1,656、target2026-09-29。NPB writeなし。最初のPages artifact251,066,286 bytesには旧保持archiveが重複するため、次のapp-only publishでRelease assetへ移す。UI-only更新はPA再importせず、公開されたaggregateをSHA256検証して保持する。

最終app-only公開HTTP/Run結果は下記へ追記する。manual成功をNPB Scheduled Production証拠として扱わない。
