# Product Completion Inventory / Remaining Roadmap

Delivery追補：本inventoryは下記基準mainでの監査snapshot。Draft/Young PlayerとHistorical Product Track 2に続く2016〜2019拡張は[Integrated source/history delivery](integrated-source-history-delivery.md)を参照。過去の2020〜2025件数を最新Production件数として読み替えない。

確認日：**2026-10-10 JST**。対象main：`8632e20f47c43523ae12f90769fc2bbd65e4f50c`（local mainとGitHub mainを照合）。公開版：[Baseball Notes](https://tomoya41.github.io/baseball-notes/)。これは現状確定の監査であり、機能実装、canonical DB write、collector実行、公開データ変更、Gate解除、デプロイは行っていない。

## 1. 判定方法と結論

現在のアプリは、**保存済みNPB 2026 RegularとMLB Historical 2020–2025 Regular/Postseasonを探す・比較する・整理するプロダクト**として広く実装されている。一方、当初構想の選手ライフサイクル（Draft → Prospects → Career → 移籍・FA・Posting）、NPB Postseason、MLB Current、完全なCareer記録、投球・トラッキング分析、確実な端末外通知は完成していない。

§4の150項目の集計：**COMPLETE 42 / PARTIAL 45 / NOT IMPLEMENTED 12 / SOURCE BLOCKED 15 / RIGHTS BLOCKED 29 / DEFERRED 7**。集計・公開34payloadのSHA-256/bytes・プロフィールcount・read-only DB countを[機械検証evidence](product-completion-inventory-evidence.json)へ保存した。個人profile rawやsecretは含めない。

画面・予約schema・workflowの存在を完成証拠にしない。判定は現在のcomposition root、routeから到達する実装、Domain計算・validator、tests、公開payload、実際の公開表示を優先する。過去バッチの数値はその時点の証拠として分離した。**Aは記載したLeague/time scope内のProduct価値の完成であり、全リーグ・全年代・rightsの無条件保証ではない。** 特に既存nf3経路には後述のprovisional rights riskが残る。

| 分類 | 定義 |
|---|---|
| A COMPLETE | 記載した対象範囲で、実データと到達可能な機能が価値を十分提供する |
| B PARTIAL | 実装はあるがCoverage、対象、指標、品質、運用証拠に重要な不足がある |
| C NOT IMPLEMENTED | 必要な保存済みデータが存在し、安全な実装・検証で進められるProduct残件 |
| D SOURCE BLOCKED | 採用済みの信頼できるデータに必要な範囲・粒度・確定情報がない |
| E RIGHTS BLOCKED | Source候補は存在するが、今回の取得・保存・公開・再配布を許す条件が確定していない |
| F DEFERRED / NOT NEEDED | 構想にあるが任意・優先外・代替済み。今回のv1完成条件に自動追加しない |

EとDが併存する場合は、具体的な候補があり権利が先の障害ならEを主分類にした。Production Gate待ちは実装済みBとし、Source不足と区別する。Cにも通常のテスト・sample/definition検証は必要であり、「即公開してよい」の意味ではない。

## 2. Original Visionの復元

一次仕様は[SPEC.md](../SPEC.md)。初期のPhase 0説明は現在の進捗表示として使わないが、§3–28の構想と§30のAnalysis承認範囲は依然として評価対象である。[decisions.md](decisions.md)の変更（MLB Current不採用、Historical先行、Capacitor、¥0、source-specific capability、自然なdocument scroll）を合わせて読む。

目標は、一般の野球ファンが毎日、試合・選手・球団を確認し、最近の変化や記録を理解し、必要なら高度分析まで掘れるAndroid-firstアプリ。単なる成績表ではなく、以下の三つの価値を含む。

1. **現在と最近**：今日／次戦／結果、Recent、Trends、Streaks、HOT、Ranking、Preview/Recap、フォロー対象の変化。
2. **選手の歩みと季節**：選手図鑑、年度・Career・記録、Draft/Prospects、FA/Posting/移籍、Preseason、Postseason、年齢・同期比較。
3. **自分で探索・追跡**：Explorer、Compare、Favorites/Collections/Saved Views、Activity/Watch、説明、共有、Android/offline。

当初構想にはさらにPitch arsenal、左右・Count、捕手／battery、守備・走塁・Statcast、season baselineとの差、optional AIがある。これらを「MLB Advanced完成」の一言で消さない。ライブ一球速報、汎用ニュースreader、アカウント・クラウド同期、iOSは現在の必須範囲ではない。

## 3. Current Implementationと実データ基準

### 3.1 証拠の範囲

公開HTTP **34 payload、すべて200**。Directory/Catalog/Capabilities/Team Season、Postseason capability、MLB Historicalの対象payloadを既存validatorで検証し、関連projectionの世代を照合した。監査snapshot取得時刻は`2026-10-09T21:55:15.467Z`。確認に使用した一時script/log/snapshotはignored `.data/product-inventory/`に置き、rawプロフィールを新しくpublic repoへ転載していない。

MLBの既存local release DBはSQLite read-onlyで件数を確認し、ファイルsize/mtime不変を検査。Tursoへの直接書込みは0。公開画面ではNPB Homeの10/10と結果更新10/7の分離、NPB Postseason unavailable、MLB Postseason 2025の実Series、MLB検索の確認済み日本人23人、MLB Profile/Recent/Analysis/実対戦相手の40人bounded表示、MLB達成記録のComing Soonを確認した。全主要routeの実機Final QAを今回実施済みとはしない。

根拠となる主なコード：

- 接続・route：[`services.ts`](../src/app/services.ts)、[`App.tsx`](../src/ui/App.tsx)、[`npb-routes.tsx`](../src/ui/npb-routes.tsx)、[`mlb-foundation.tsx`](../src/ui/mlb-foundation.tsx)。SampleProviderをProduction fallbackには使わない。
- UI contract：[`npb-product-contract.ts`](../src/domain/npb-product-contract.ts)、[`mlb-historical-public.ts`](../src/domain/mlb-historical-public.ts)、[`competition.ts`](../src/domain/competition.ts)、[`postseason-capabilities.ts`](../src/domain/postseason-capabilities.ts)。
- Product：[`product-daily.ts`](../src/domain/product-daily.ts)、[`team-hub.ts`](../src/domain/team-hub.ts)、[`player-period.ts`](../src/domain/player-period.ts)、[`player-trends.ts`](../src/domain/player-trends.ts)、[`data-explorer.ts`](../src/domain/data-explorer.ts)。
- ローカル追跡：[`personal-library.ts`](../src/application/personal-library.ts)、[`personal-watch.ts`](../src/application/personal-watch.ts)、[`watch-observations.ts`](../src/application/watch-observations.ts)、[`platform.ts`](../src/app/platform.ts)。
- 未実装導線：[`future-features.ts`](../src/presentation/future-features.ts)、[`future-surfaces.tsx`](../src/ui/future-surfaces.tsx)。Coming Soonはデータ提供の証拠ではない。
- Audit/境界：[`product-completion-audit.md`](product-completion-audit.md)、[`astra-product-final-handoff.md`](astra-product-final-handoff.md)、[`final-product-design.md`](final-product-design.md)。

### 3.2 NPB Current Regular（2026）

公開Directoryは**739選手・12球団**。Directory、Catalog、Capabilities、Season MilestonesはeffectiveDate **2026-10-07**、generatedAt **2026-10-07T23:20:10.052Z**で整合。Season/Recent/HOT/Team Seasonはそれぞれの生成時刻を持つため、すべて同じgeneratedAtとは要求しない。

Seasonの日別Coverageは195日：**164 complete / 25 noGames / 6 partial / 0 unknown / 0 failed**。noGamesは欠損ではない。6雨天短縮Gameの既存partialは維持されている。最新7日（10/1–10/7）はcomplete、14日（9/24–10/7）は13 complete + 1 partial、30日（9/8–10/7）は28 complete + 2 partial。

**HOT**：公開`not_ready`。7日Coverageがcompleteでも、`scheduledProductionEvidence:false`、`scheduled_production_evidence_pending`と`display_metadata_unavailable`が残る。内部candidateの各category readyと公開ランキングのGateは別。公開配列は空。**NPB Records/Counting/Rate Ranking**：Season Coverage partial、qualifier verifiedだが計算・公開Gate not_ready。Explorerのユーザー指定sortは公式Rankingとして表示しない。

| NPB profile/membership field | 現在のknown / 739 | 定義・不足 |
|---|---:|---|
| primary position | 518 | 全員の現在主ポジションではない |
| bats / throws | 667 / 667 | 未照合・未取得を推定しない |
| birthDate | 665 | ageは基準日から計算。未知はnull |
| birthPlace / originPlace | 571 / 629 | 出生地と出身地を同一視しない |
| nationality | 662 | 表記を国籍変更の推定に使わない |
| height / weight | 584 / 486 | 過去値・定義差のconflictを上書きしない |
| draftYear / draftRound | 623 / 602 | 完全な当年Draft結果ではない |
| draftTeamId / draftType | 33 / 601 | 前身球団を現球団へ雑に対応させない |
| joinedYear / explicit NPB debutYear | 0 / 0 | generic professional debutYear 604とは別 |
| source-listed knownPositions | 583 | capability 620はprimary positionを含むunion。583人全員を「現在の副守備位置」とは呼ばない |
| source-listed schools | 456 | capability 653はamateurHistoryのschoolを含むunion。卒業確認とは別 |
| affiliation/history | 562 | 部分的な球歴。完全Career timelineではない |
| career identity bridge | 667 | 成績利用の許可・Careerデータ取得完了とは別 |
| latest stored affiliation | 739 | verified current rosterではない |
| current uniform number / registration class | 0 / 0 | current evidenceなし。過去番号を現在として使わない |
| photo / official team logo / official team colours | 0 / 0 / 0 | 中立monogram・アプリaccentは公式素材ではない |

現在の未照合は**72人**。以前のFree Completion Phase 2は**735人/未照合68人**のsnapshotであり、増分4人を含む現在へそのまま転用しない。profile capabilityは668/739。Human Review Queueは**400件**（既存記録の396 source conflict + 4 definition）。Human-reviewedは**0**。過去Phase 2の候補field record数14,927（automated 13,029 / codexAssisted 20 / prior sourceVerified 1,878）は適用済みの人・field件数ではない。既存85 conflictを含む保留を勝手に解消しない。

### 3.3 MLB Historical Regular / Postseason（2020–2025）

| Season | Regular Games | Regular season players | Postseason Games | Series | Coverage |
|---|---:|---:|---:|---:|---|
| 2020 | 898 | 1,289 | 53 | 15 | 両scope complete |
| 2021 | 2,429 | 1,508 | 37 | 9 | 両scope complete |
| 2022 | 2,430 | 1,495 | 40 | 11 | 両scope complete |
| 2023 | 2,430 | 1,457 | 41 | 11 | 両scope complete |
| 2024 | 2,429 | 1,454 | 43 | 11 | 両scope complete |
| 2025 | 2,430 | 1,470 | 47 | 11 | 両scope complete |
| 合計 | **13,046** | unique **2,840** | **261** | **68** | manifestとlocal DB照合 |

Postseason uniqueは994人、Regularとの共通992人＋Postseason-only 2人。検索のunion **2,842人**とRegular index 2,840人の違いは重複・identity破壊ではない。local PAはRegular **979,855**、Postseason **19,771**、reconstructed gamesは全対象Game数と一致。既存release検証記録のBatting/Pitching FactsはRegular 383,219 / 112,569、Postseason 8,244 / 2,664（今回全nested Fact行を再検算した件数ではなく、[Core/Postseasonのrelease証拠](postseason.md)として扱う）。

Direct BvPはcanonical pitcher+batter PAから集計、両scope ready。Situationalもreadyだが、Regular **42 PA**はmid-PA substitutionによりouts/base/score開始contextをunknownとして除外する。0や完全sampleへ置換しない。Game result・exact matchup・inningは利用可能。TTO/Countはevaluate、Count coverage約70.37%という[Batch E](mlb-batch-e-2026-09-30.md)の証拠はProduction Count readinessではない。Statcastはunavailable。

Rate/Counting RankingはRegular各年ready。Rule 9.22のAVG/OBP/SLG不足PA例外をmetric別・AL/NL別に判定。2020はscheduled 60試合、186PA/180outs、2021–25はscheduled 162試合、502PA/486outs。年の実schedule structureによる分母であり、実消化数を同じ意味として使わない。OPS/K9はアプリのsample-qualified指標で、公式タイトルではない。Postseasonは別のLeaders/記述的rateで、Regularのqualificationを流用しない。

MLB Current 2026は公開manifest `not_ready` / `source_permission_required`、Postseasonも`Source rights pending`。HistoricalをCurrentにfallbackしない。Retrosheet 2026 Original Scheduleは当初予定であり、Current結果として取り込んでいない。

## 4. 全機能の6分類

以下のI001–I150を**唯一の集計母集団**とする。同じ画面でもLeague/time scope・data valueが異なる場合は分離した。細分化の仕方で件数は変わるため、件数そのものを完成率として使わない。各行の根拠は§3、コード参照、§5のCapability、§6のSource、§10の運用証拠に対応する。

### Core / Current / Recent

| ID | 項目とscope | 分類 | 現在の価値／残件 |
|---|---|---|---|
| I001 | Home/Today：NPB Current Regular | B | JST今日・結果更新日を分離、Favorite/Watch導線あり。日次失敗・予定window不足で今日の全予定を保証しない |
| I002 | Home：MLB Historical Regular/Postseason | A | 選択保存年・日本人・Favorites・過去結果。Currentと誤表示しない |
| I003 | Games/Schedule：NPB Regular | B | 保存結果・bounded予定・日付検索。最新Schedule Sync失敗と全期間未保証 |
| I004 | Games/Schedule：MLB Historical Regular | A | 2020–25、Season/date、保存試合へ到達 |
| I005 | Player Directory：NPB | A | 739 canonical選手、検索・Profile・Compare・整理へ接続。profile充足とは別 |
| I006 | Player Directory：MLB Historical | A | Regular/Postseason identity、年・Team・日本人・verified alias検索 |
| I007 | Player Profile/Encyclopedia：NPB | B | 各成績画面とprofile field部分充足。current roster/番号/Careerなし |
| I008 | Player Profile：MLB Historical | B | 過去成績・PA分析は充実。全Career、現所属・背番号・完全な百科情報はない |
| I009 | Team Hub：NPB Regular | B | W/L/T/得失点・保存選手・最近試合。Season partial、verified current rosterではない |
| I010 | Team Hub：MLB Historical | A | 保存年Team contributions・試合・出場選手・Postseasonへ接続 |
| I011 | NPB順位表・Team Season record | B | 公開snapshotあり。保存時点の順位とFact由来partial集計、freshnessを分離 |
| I012 | MLB Historical公式地区順位/タイブレーク | C | GameからW/Lは作れるが現行Team Hubは公式順位表でない。公式tie/rule provenanceの確認が必要 |
| I013 | Search/Discovery：両league保存scope | A | Player/Team/指定日Game/Series、Favorites/Activity/Explorer入口 |
| I014 | My：両league | A | Player/Team Favorites、Collections、Saved Views、Activity、Watchへの入口 |
| I015 | NPB Recent 7/14/30・今月・Season | B | read-only集計あり。window別Coverage、14/30 partial。unknownを0にしない |
| I016 | MLB Historical Recent 7/14/30 | A | 選択Season/asOf contextの過去window、Regular/Postseason分離 |
| I017 | Trends/rolling 5/10 appearances：NPB | B | 保存順序・sample内のweighted推移。bounded Game LogとpartialによりCareer連続性は保証しない |
| I018 | Trends/rolling：MLB Historical | A | 保存scopeの打撃rate・投手登板推移、端数outs・zero outs対応 |
| I019 | 安打/出塁/HR Streak：NPB | B | 保存appearance streak。PA0・欠測・truncatedで継続の断定を抑える |
| I020 | 安打/出塁/HR・無失点登板Streak：MLB Historical | A | chronology/sample-aware、同一scopeから決定論的算出 |
| I021 | 正確な連続無失点イニング・PA途中のR帰属 | D | appearanceのR0と別。現在のProduct Fact粒度では完全なinning streakを保証しない |
| I022 | HOT：NPB | B | 計算・candidate proofはあるが公開Gate closed。7日completeだけでは開かない |
| I023 | HOT：MLB Current | E | Current Sourceの公開再利用条件未確定。Historical Recent探索で代替可能な範囲のみ |
| I024 | Counting Ranking/Season Records：NPB | B | 実装・UIあり、Season partialとGateにより公開順位なし |
| I025 | Rate Ranking：NPB | B | qualifier確認あり、complete Coverage不足とProduction Gate閉鎖 |
| I026 | Counting/Rate Ranking：MLB Historical Regular | A | 2020–25 ready、Rule/sample semanticsを分離 |
| I027 | Today/notable players：NPB | B | 保存Recent/Streak/Recap/Favoritesから客観的表示。HOT公式順位ではなく鮮度も限定 |
| I028 | MLB Current results/player stats/today | E | 2026 Currentを収集・表示しない。APIから返ることは利用許可の証拠でない |

### Analysis / Compare / Explorer

| ID | 項目とscope | 分類 | 現在の価値／残件 |
|---|---|---|---|
| I029 | Player Compare：NPB | B | 2–4人、role分離、Season/Recent/基本Splits。Coverage partial・PA situationsなし |
| I030 | Player Compare：MLB Historical | A | 2–4人、Season/windows/Situational/BvP、scopeとsampleを維持 |
| I031 | Team Compare：NPB | B | 保存Season/basic team statsと14日final results。team Recent打撃投球/HomeAwayは未接続 |
| I032 | Team Compare：MLB Historical | A | 2–4Teams、Regular/Postseason、window/HomeAway、指標と図示 |
| I033 | Player/Team Season Compare：MLB Historical | A | 最大6保存年、年度推移・前年差、Careerと呼ばない |
| I034 | Season Compare：NPB Historical | E | 現在2026のみ。Source候補のHistorical利用条件未確定 |
| I035 | Data Explorer：NPB Season | B | 保存集計を条件search/sort、sample/partial明示、公式順位を迂回しない |
| I036 | Data Explorer：MLB Historical Season/Postseason | A | league/role/team/year/scope/指標/filter/Compare、complete保存scope |
| I037 | 全選手Recent Explorer：NPB | B | 7/14/30のread-only projection、一window一fetch。期間Coverageに依存 |
| I038 | Recent Explorer：MLB Historical選択選手 | B | 最大12人選択式。全選手Recent横断にはなっていない |
| I039 | 全選手Recent Explorer：MLB Historical | C | 保存Game Factsからbounded aggregate projectionを作れる。raw全profile fetchは禁止 |
| I040 | Season Explorer：MLB Historical | A | 同一選手年度履歴、Regular/Postseason、Game Log/Analysis/Compare接続 |
| I041 | Season Explorer：NPB | B | 2026だけ正しく表示。過去year selectorの接続データなし |
| I042 | HomeAway/Opponent/Order/Role Splits：NPB | B | 基本Game Factsから生成。partial・bounded対象を明示 |
| I043 | HomeAway/Opponent/Order/Role Splits：MLB Historical | A | 保存scopeの実Game Factsに基づく |
| I044 | Inning/Outs/Base/RISP/Score split：MLB Historical | B | Production可。42 Regular PAのunknown開始contextを除外・sample表示 |
| I045 | Situational/PA analysis：NPB | D | 採用SourceのPA開始状態・exact matchupが不足 |
| I046 | Direct BvP：MLB Historical Regular/Postseason | A | exact pitcher+batter PA、sample/収録期間を明記 |
| I047 | 選手横断MATCHUP入口：MLB Historical | C | Player内BvPはあるがglobal MATCHUPはComing Soon。既存PA aggregateへ接続可能 |
| I048 | Direct BvP：NPB | D | 同じGameへの出場だけで対戦にしない。exact PA関係がない |
| I049 | Game Log：NPB | B | 保存試合別成績・canonical Gameへ遷移。bounded履歴、全Careerではない |
| I050 | Game Log：MLB Historical Regular/Postseason | A | 選択保存Seasonの打撃・投球分離 |
| I051 | AVG/OBP/SLG/OPS/ERA/K9等の基本計算・説明 | A | metric欠測・分母・outs・Glossaryを管理。利用可能fieldだけ表示 |
| I052 | NPB WHIP/BB9/投手BB率 | D | 与四球と死球の独立値不足。四死合算をBBへ代用しない |
| I053 | MLB Historical WHIP/BB9/K%/BB%等の追加表示 | C | 必要なH/BB/PA/BF/outsはあるがCoreはWHIPを明示除外。定義・sample/nullable検証後に別追加 |
| I054 | MLB Times-through-order | B | PoC/evaluate。先発、交代、batting around、definition全件検証がProduction前提 |
| I055 | MLB Count splits | B | rawに一部countあり、全期間quality/coverage不足。evaluateをProductionとは扱わない |
| I056 | 月別・任意期間・season baseline差の統合UI | C | MLB日付/Game Facts、NPB今月・期間集計はある。現在の保存scopeでdefinition/sampleを検証して接続できる |
| I057 | Pitch arsenal/velocity/movement/zone/whiff/CSW | E | Statcast/Savant等のrights未採用。Retrosheet PAは計測pitch-levelではない |
| I058 | Exit velocity/launch/barrel/xBA/xwOBA/bat speed | E | tracking Source rightsとcomplete測定データが必要 |
| I059 | WAR/wOBA/percentile/リーグ基準の高度指標 | D | 必要係数・守備/走塁/母集団のvalidated input不足。basic ratesを代用しない |
| I060 | 捕手/battery/framing/blocking/pop time | E | 詳細イベント・tracking候補はあるがrights未採用。捕手との同時出場だけでbattery評価しない |
| I061 | 守備OAA/arm strength/Sprint Speed | E | 計測データのSource/rights待ち |
| I062 | Stat Glossary/その場のmetric説明 | A | 使用指標の定義・式・scope/sample、dialog focus、難指標から到達 |
| I150 | 打席時の左右別分析：NPB/MLB | D | 現在のcanonical PA/NPB Factには完全な打席時handednessがない。profileのswitch hitterを各PAの左右へ推定しない。Retrosheet原資料の列・coverageの追加確認後、再分類可能 |

### Historical / Career / Records

| ID | 項目とscope | 分類 | 現在の価値／残件 |
|---|---|---|---|
| I063 | MLB保存Season history 2020–25 | A | Regular/Postseason分離、実データ年度推移 |
| I064 | MLB収録期間合計 2020–25 | A | collected-range aggregate。Full Careerとは別 |
| I065 | MLB追加Historical年代/Full Career接続 | C | rights-clear Retrosheet配布の追加年代を未import/未validation。年代別coverage Gate後、career全期間が揃った選手だけFull Career化可能 |
| I066 | NPB Historical seasons/Career stats | E | 候補サイトの歴年データ再利用条件未確定 |
| I067 | NPB過去所属/学校/球歴 | B | 部分構造化masterあり。562 affiliation、653 school union、現所属証明ではない |
| I068 | 完全Career timeline/受賞履歴：NPB/MLB | D | 完全所属期間・入団/debut・awardイベント未整備。画面の存在で補わない |
| I069 | MLB保存年度のTeam/player timeline | C | 保存year/team履歴を年表として描ける。全Career timelineとは明確に分離 |
| I070 | 同年齢時Career比較 | D | Career全期間＋出生date coverageが必要。2020–25だけを同年齢通算としない |
| I071 | 確認済みDraft同期の保存Season比較 | C | known draftYearをcohortにし、既存Compareへ接続可能。全Draft class収録と偽らない |
| I072 | NPB Season milestone proximity/到達 | B | 保存Season checkpoints、partial/scope caveat、official career達成ではない |
| I073 | MLB Season milestone Watch | B | Watchの保存Season checkpoint計算あり。専用Milestones画面は未接続 |
| I074 | MLB保存Season Milestones一覧/Profile入口 | C | Season factsとcheckpoint計算を再利用可能。`/MLB/milestones`はComing Soon |
| I075 | Career milestones/歴代記録：NPB | E | 完全Career・historical Sourceの利用許可が必要 |
| I076 | Career milestones/All-time records：MLB | D | 2020–25外が未収録。完全Career達成・全時代leaderと呼べない |
| I077 | 年代/現役/年齢/Position別の全史Records | D | 全史・所属/年齢coverage不足。保存Season内のfilterのみ拡張可 |

### Game / Postseason

| ID | 項目とscope | 分類 | 現在の価値／残件 |
|---|---|---|---|
| I078 | Game Preview：NPB Regular | B | 公開scheduled game＋試合前14日cutoff。予定・先発の保証なし |
| I079 | MLB Historical「試合前」再構成Preview | F | 全て過去結果。現行Recapを優先し、当時未確定情報を作らない |
| I080 | Game Recap/key performers：NPB | B | 決定論的複数安打/HR/投球・Favorite結果。partial Game制御あり |
| I081 | Game Recap/key performers：MLB Historical | A | 実Factsの主要数字、因果自由作文なし |
| I082 | Game Detail/lineup：NPB Regular | B | score/打撃/投球/打順/role。6partialと交代時系列・inning score不足 |
| I083 | Game Detail：MLB Historical Regular/Postseason | A | canonical Game、score、打撃投球・lineup、PA分析導線 |
| I084 | NPB CS First Stage Current | E | round contractあり。現在Source利用範囲未確認、collectorなし |
| I085 | NPB CS Final Stage Current | E | rule advantage別表現あり。実Series/Gameデータなし |
| I086 | NPB Japan Series Current | E | contract/UI unavailable、Source rights pending |
| I087 | NPB Historical CS/Japan Series | E | 公開過去ページの存在は保存・再配布許可にならない |
| I088 | MLB Historical Wild Card | A | 2020–25各年の形式に沿うSeries・Game |
| I089 | MLB Historical Division Series | A | 同上 |
| I090 | MLB Historical ALCS/NLCS | A | 同上 |
| I091 | MLB Historical World Series | A | 同上 |
| I092 | MLB Historical Series state/bracket/advancement | A | 68Series、決着、各Game・leaders。Currentの進行と偽らない |
| I093 | MLB Historical Postseason player stats/analysis | A | Regular独立aggregate、Game Log、BvP/Situational、descriptive Leaders |
| I094 | MLB 2026 Current Postseason | E | safe Current Sourceなし。Historical結果を混ぜない |
| I095 | NPB CS Final advantage rule contract | A | played wins/advantage winsを分離、架空Gameなし。データ対応完了とは別 |
| I096 | Current Postseason Home promotion/notifications | D | contract接続可能だが採用Current競技データ未存在。Push検証とも別 |

### Draft / Prospects / Hot Stove / Preseason

| ID | 項目とscope | 分類 | 現在の価値／残件 |
|---|---|---|---|
| I097 | NPB Player profileのDraft履歴field | B | 年623/round602/team33/type601、partial provenance付き |
| I098 | NPB確認済み選手のDraft history探索 | C | 既存CC0/CC BY-SA masterのyear/round/学校をProduct化できる。新規候補者データは不要 |
| I099 | NPB Current Draft/event/results全件 | E | 公式等の候補はあるが利用許可・全指名identityが未確定 |
| I100 | NPB Prospects/farm成績 | E | 二軍/学生/独立Leagueのfree production Source rightsとcoverageが未確定 |
| I101 | MLB Draft/prospect/minor league本体 | E | Retrosheet MLB Game scopeと別。候補データのrights未確認 |
| I102 | DOB基準の若手Discovery | C | 665 known DOB等をselected-date age filterとして利用可能。rookie/prospect認定はしない |
| I103 | 正式rookie資格/rookie watch | D | prior career/service/登録等の資格根拠がない。若い・初Draft年だけで新人にしない |
| I104 | Draft予想メディア集約 | E | 報道文・予想転載/抽出許可と継続Sourceが必要 |
| I105 | Draft候補からprofessional playerへの一貫lifecycle | D | prospect identity/event/domainデータが未整備。名前のみ新規merge禁止 |
| I106 | Transactions/登録・抹消/育成支配下移行 | E | 日付・membership eventの公示Source rights未採用 |
| I107 | FA資格/宣言/契約status | E | イベントSource利用条件と正確な資格データが未整備 |
| I108 | Posting手続き/締切/決着 | E | 公式発表Source rights、日付・identity証拠待ち |
| I109 | Trade/signings/releases/retirement | E | 候補公示・公式サイトからの体系的データ再利用未確認 |
| I110 | 新外国人/球団IN-OUT/offseason ledger | E | 国籍profileだけで新加入eventを作れない。上記movement feedが必要 |
| I111 | NPB current uniform/current roster class | E | current season/team/dateのrights-clear証拠不足。known past番号を流用しない |
| I112 | join year/explicit NPB debut year | D | 採用licensed master内で直接確定できる証拠0。generic pro debutを変換しない |
| I113 | NPB camps/spring/open games | E | competition別Source rightsとfully validated Factsなし |
| I114 | MLB Historical spring training | E | Retrosheet regular/postseason importと別。候補rights/coverage未採用 |
| I115 | Preseason vs Regularの予測/相関・role競争 | D | 複数年PreseasonとRegular/rosterの対応データ不足 |

### Personalization / Sharing / Notification

| ID | 項目とscope | 分類 | 現在の価値／残件 |
|---|---|---|---|
| I116 | Player Favorites：NPB/MLB保存選手 | A | league+canonicalPlayerId、再読込・native Preferences/Web保存、既存互換 |
| I117 | Team Favorites | A | kind区別、Team Hub/Home/Games/Myに接続 |
| I118 | Collections CRUD/Compare送信 | A | Favoritesと別、ローカル分類、schemaVersion/上限/破損隔離 |
| I119 | Collections Watch Dashboard | B | ページ12人・bounded Recent/Trends・保存Season。Milestones等はscopeに依存 |
| I120 | Saved Views/portable条件 | A | filter/sort/sample/metric/year/scopeの復元、local IDは公開共有しない |
| I121 | Activity/Recently Viewed | A | canonical entity/Explorer、重複整理・上限・expiry、検索文字列を蓄積しない |
| I122 | Watch Center/Since Last Visit | B | baseline→前回確認とのdiff、Rules/hidden/read/dedup。NPB truncated Streak/MLB全選手Saved View検出など未対応 |
| I123 | Alert/Theme Preferences | A | role/season-awareローカル設定、安全なdefault、reset/保存失敗を扱う |
| I124 | canonical Share/Deep Link：Web | A | Player/Team/Game/Series/Compare/Explorer条件、hash routeを保持 |
| I125 | Custom scheme/Android Deep Link | B | canonical URI translation/Back/launch code・testsあり。署名済release実機確認は別 |
| I126 | Android HTTPS App Links | B | intent/config pathあり。実release fingerprintとhost-root assetlinks verificationは未完了 |
| I127 | MLB表示済み派生結果CSV/table/text export | A | bounded display aggregateのみ、Retrosheet/Chadwick attribution保持 |
| I128 | NPB成績export/元データ再配布 | E | nf3 export権利を拡張しない。URL共有とbulk data exportは別 |
| I129 | Browser notification | F | in-app更新差分で代替。今回構成でbackground配信を保証しない |
| I130 | Native FCM push | B | Android opt-in/topic/producerコードはある。Firebase external setup/Production Pushは未検証・本番化していない |
| I131 | reliable background delivery | B | 既存FCM設計のexternal setup/delivery証拠なし。静的Pages・foreground Watchだけでは保証不能。アプリ更新時検出と背景配信を分離 |
| I132 | local notification | F | 現行Watchで十分。fake push/pollingを追加しない |

### Platform / Operations / Complementary Vision

| ID | 項目とscope | 分類 | 現在の価値／残件 |
|---|---|---|---|
| I133 | Web/GitHub Pages配信 | A | latest main app-only deploy成功、公開HTTP/Contract可読 |
| I134 | Android package/debug/unsigned AAB | B | Capacitor 8.5.2・latest main CI成功。formal package ID、release署名、実機QA未完 |
| I135 | Android offline shell/cache | B | HTML/JS同梱、last-successful response fallback。device eviction/real lifecycleのFinal QAが残る |
| I136 | Web完全offline cold start/reload | C | IndexedDBデータcacheとapp-shell cacheは別。既存assetsで実装可能だがService Workerによる起動保証はない |
| I137 | Favorites/library/watch persistence境界 | A | bounded・versioned・corruption/quota/future schema隔離、共有account不要 |
| I138 | Accessibility/360px/Light-Dark | B | focus/dialog/labels/reduced motionと過去visual proof。real TalkBack・拡大text全routeQAは未完 |
| I139 | Performance/bounded fetch/render | B | route lazy/in-flight/cache・bounded queries。initial JS479KB、全device性能は未証明 |
| I140 | Scheduled Daily/Freshness/Schedule monitoring | B | workflows/watcherあり。直近失敗・stale公開、完了Scheduled proofなし |
| I141 | Portable backup/hash/scratch restore | B | code/tests/既存演習あり。最新Dailyのbackup fetch failure、長期非公開保全は未閉鎖 |
| I142 | Release QA/signing/Store readiness | B | CI/未署名artifactは成立。manual signing/App Links/privacy/実機・Store QA残り |
| I143 | player photos/team logos/official colours | E | availability URLのみで使用しない。現在approved登録0、中立fallback |
| I144 | Japanese names/verified alias discovery | B | 日本人漢字・外国人カタカナ/英名検索、日本人MLB cohort。全選手alias品質の保証はしない |
| I145 | contextual sourced news | E | general news readerを作らず、必要eventの再利用許可・provenance待ち |
| I146 | Optional AI explanations/prediction enrichment | F | coreはAIなしで成立。source factsの代用・推測補完をしない |
| I147 | live WATCH/pitch-by-pitch速報 | F | core outside scope。旧観戦WATCH入口はComing Soon、Watch Centerとは別 |
| I148 | account/cloud sync/iOS | F | ローカル優先・Android-first・¥0。今回必須ではない |
| I149 | 2026 MLB Original Schedule UI | F | 当初予定はCurrentでない。利用価値を見て別Capabilityとして将来判断 |

## 5. League / Data Capability Matrix

ここはProduct分類A–Fと別の**データ状態**。`partial`は欠測を許した実scope、`rights pending`は候補をProductに未採用。N/Aを0やデータありへ置き換えない。

| Capability | NPB Current Regular 2026 | NPB Historical | NPB Postseason | MLB Current 2026 | MLB Historical Regular 2020–25 | MLB Historical Postseason 2020–25 |
|---|---|---|---|---|---|---|
| canonical player/team identity | available、profile bridge partial | partial bridgeのみ | モデルのみ／rights pending | identity bridgeのみ、Current roster unavailable | available | available、Regular identity共有 |
| schedule/results/game | partial（保存結果あり・freshness/window限定） | rights pending | rights pending | rights pending | available complete | available complete |
| batting/pitching Game Facts | partial（6 partial game） | rights pending | rights pending | rights pending | available | available |
| Season aggregates | partial | rights pending | rights pending | rights pending | available | available、独立scope |
| Recent/基本Splits | partial、window別completeあり | unavailable | unavailable | unavailable | available historical context | available historical context |
| team season record | partial、公式順位snapshot別 | unavailable | unavailable | unavailable | available contributions | available contributions/Series |
| profile/draft/positions/history | partial、§3.2参照 | partial masterのみ | identityに付随、競技statsなし | current profileとしてはunavailable | partial encyclopedia、historical identityあり | shared identity |
| uniform/current roster | rights pending | source evidence不足 | rights pending | rights pending | historical roster appearancesのみ、current不可 | historical participantsのみ |
| PA exact matchup | unavailable | unavailable | unavailable | rights pending | available 979,855 PA | available 19,771 PA |
| BvP | unavailable | unavailable | unavailable | unavailable | available | available |
| inning/outs/base/RISP/score | unavailable | unavailable | unavailable | unavailable | partial contexts（42unknown）、validated scope ready | available |
| TTO/Count | unavailable | unavailable | unavailable | unavailable | partial/evaluate | evaluate、Production未承認 |
| pitch-level/tracking/Statcast | unavailable | unavailable | unavailable | rights pending | unavailable（Retrosheet≠Statcast） | unavailable |
| Counting/Rate Rankings | data partial・public Gate pending | unavailable | unavailable | unavailable | available、qualification別 | Leadersのみ、rate title不可 |
| HOT | dataあり、Production Gate pending | unavailable | unavailable | unavailable | Historical Recentのみ。Current HOTなし | Current HOTなし |
| milestones | partial saved Season checkpoints | Career rights pending | Career unavailable | unavailable | Watch checkpointsあり、専用UI未実装 | Career milestone不可 |
| Career/full timeline/all-time records | rights pending | rights pending | unavailable | rights pending | collected-rangeのみ、full unavailable | collected-rangeのみ |
| transaction/FA/posting/roster events | rights pending | rights pending | unavailable | rights pending | unavailable | unavailable |
| draft/prospect class/farm | partial profile、class rights pending | rights pending | N/A | rights pending | class dataset unavailable | N/A |
| camps/preseason | rights pending | rights pending | N/A | rights pending | unavailable／候補rights未採用 | N/A |
| Series/bracket/rules | regular N/A | unavailable | contractあり、actual rights pending | rights pending | regular N/A | available |
| photos/logo/official colours | rights pending | rights pending | 同じasset制限 | rights pending | rights pending | rights pending |

Public NPB manifestの`available`は採用範囲内のfield存在を指し、Season Coverage completeやrights waiverを意味しない。`source_unavailable`は採用Sourceに必要粒度がない状態で、世の中にデータ自体が存在しないという断言ではない。profile coverageはfield単位で、画面全体のavailable一個へ丸めない。

## 6. Source / Rights Matrix

### 6.1 採用Source

Retrosheet notice、Chadwick README、Wikidata licensing、Wikimedia Termsは今回一次資料をread-onlyで再確認。その他候補は下記dated rights調査の範囲であり、この監査で新たな利用許可が出たとは扱わない。「可」はlicense条件・site policy・対象データ範囲を満たす場合に限る。技術的取得可・robots許容と再利用可は別。

| Source / primary terms | 用途・license | Automation | Storage/加工 | 再配布/Public app | 現在の使用 | Future potential / 制約 |
|---|---|---|---|---|---|---|
| [Retrosheet notice](https://www.retrosheet.org/notice.txt) | Historical game/processed CSV/PBP。自由利用・販売・配布を指定credit付きで許可 | 公式season/release downloads。siteに負荷をかけないbulk files、per-Game取得なし | 可、download hash/releaseを保持 | 可、commercial含む、指定creditを目立つData Sourcesへ | 2020–25 Regular/Postseason、Season/PA/aggregate、bounded derived export | 追加公開年代は可。ただし未import/validation。Current/live/pitch trackingの供給を意味しない。accuracy保証なし |
| [Chadwick Public Register](https://github.com/chadwickbureau/register/blob/master/README.md) / [ODC-BY](https://opendatacommons.org/licenses/by/1-0/) | identity UUID/Retrosheet/MLBAM等、ODC Attribution | 公開release download可、API保証ではない | 可、attribution・mapping revision・merge/splitを追跡 | 可、license/attribution条件を保持 | Historical identity bridge、必要profile facts | 外部サイトIDはそのサイトdata rightsではない。current membership証明でもない |
| [Wikidata licensing](https://www.wikidata.org/wiki/Wikidata:Licensing) | 構造化namespace CC0 | 公開API/query policyとrate limit内 | 可 | 可。provenanceを自前で保持 | NPB identity/profile、verified field補完 | field coverage・identity証拠が必要。画像P18/参照先のlicenseを自動継承しない |
| [Wikipedia/Wikimedia Terms §7](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use#7._Licensing_of_Content) | article由来structured facts、CC BY-SA等（個別例外確認） | 公開API・取得policy内、revisionを指定 | 条件付き可、文章大量転載を避ける | attribution/article+revision/license/変更表示・share-alike等を満たす | NPB Codex-assisted master、学校/Draft/球歴等 | profile事実の構造化をrights回避にしない。写真・ロゴは別個のasset license |
| nf3（[既存採用根拠](npb-batch-g-rights.md)、[Source registry](data-sources.md)） | NPB Regular、**provisional**。明確な包括的open-data license未確認 | 既存bounded adapterに限定。明示禁止未発見≠積極的許可 | 現在の限定運用は既存判断。包括的許可は未確定 | 現在の公開scope以上の再配布・export許可は確定していない | NPB standings/schedule/regular Game Facts | Career/Postseason/transactions/assetへ拡張しない。既存運用自体の権利リスク解消、Source longevityの代替計画が必要 |

Retrosheet指定creditは既存Data Sourcesに実装されている。ChadwickはregisterとODC-BYリンク。Wikipediaはfield provenanceのarticle/revision/license、CC BY-SA表示と出典導線を維持する。WikidataをCC0と呼べるのは構造化dataだけで、任意のWikimedia文章・画像ではない。

### 6.2 不採用・限定候補

詳細の既存証拠：[NPB Batch G rights](npb-batch-g-rights.md)、[Free expansion](npb-free-data-expansion.md)、[Free Phase 2](npb-free-completion-phase2.md)、[MLB source evidence](mlb-historical-source-evidence-2026-09-30.md)、[Postseason](postseason.md)。不採用は永久的禁止を新たに宣言するものではなく、現時点のProduction採用条件を満たさないという意味。

| Source候補 | 想定用途 | Automation / Storage / 再配布 / App表示の判定 | current usage / future |
|---|---|---|---|
| NPB公式 | roster/背番号/成績/公示/Draft/Postseason | termsの無断転載・二次利用制限。体系的取得・保存・public redistributionを許すgrant未確認 | source evidence参照とrules確認のみ。collector新規採用なし、許諾track |
| 各球団公式（12球団） | current profile/写真/logo/所属/加入 | 球団ごとのcopyright/terms、媒体許可とデータ再利用を分離。一括open licenseなし | individual facts候補、正式許可なしにbulk master複製しない |
| baseball-data.com | NPB成績・profile・historical | robots/access条件とupstream/再配布rights未確定 | Production未採用 |
| SIJ/野球DB、NPB Visualization/Store等 | Draft/球歴/選手DB | copyright/独自DB、公開CSV/APIがあってもopen grant未確認 | Production未採用 |
| GitHub NPB datasets（npbnoitall/npbdata、armstjc、wocchi、nyk510等） | CSV/JSON/公開scrapers | repo code MIT等とSPAIA/Yahoo/NPB等のupstream data licenseは別。許可連鎖が未証明 | コピー・Source採用なし |
| 学術/Zenodo/public sports dataset、OOTP | historical/player/stats | 個別licenseを確認。metadata license≠data、OOTP個人非商用条件≠公開app | 現在scopeを満たす完全なNPB dataset未発見 |
| Snowflake/DataStadium sample、CKAN等 | licensed NPB game/roster | public listing/sample/教育用途≠保存・加工・公開再配布許可。upstream contract待ち | 有料契約/Trial追加なし |
| 自治体/e-Gov/学校/大学Open Data | 出身・学校・Draftプロフィール | 対象文書のCC/利用規約とactual fields/identity確認が必要 | 確認した範囲で735/739 player補完のcomplete licensed sourceなし。個別licensed facts候補 |
| MLB Stats API/MLBAM | MLB Current regular/postseason | endpoint到達可≠automation/storage/public redistribution license。未確定 | collector不採用、identity ID参照のみ |
| API-SPORTS | MLB Current | free quotaだけで必要rights・継続¥0を満たすと確定していない | 未採用、account/Trial作成なし |
| Baseball Savant/Statcast | pitch/tracking/current | CSV column docs≠grant。bulk/public product利用未確認 | 未採用、計測値は公開payloadなし |
| Baseball-Reference/FanGraphs | career/advanced/link identity | 外部IDやページ閲覧とDBの保存再配布許可は別 | register ID bridgeのみ。成績転載なし |
| SABR/Lahman | season/career補助 | 無料公開/open-source collectionでも現在版に別途licensed data。edition/redistribution確認必要 | 使用していない。Retrosheetで保存Season集計成立 |
| Wikimedia Commons portraits/logos | visual assets | **個別file** license、attribution/SA、肖像・商標等、利用目的を別確認。hotlinkも無条件許可でない | approved photo/logo登録0。URLを見つけただけで投入しない |

nf3について「禁止が見つからないから安全なopen source」と言い換えない。これが現行NPB経路のRights backlog最優先であり、製品機能の充実度とは独立したrelease判断材料。既存scopeを今回停止・拡大・再承認していない。

## 7. Route / Data / Persistence boundaries

Primary destinationsは**Home / Games / Players / Records / My**。現在のDesign Systemは[final-product-design.md](final-product-design.md)と実際のCSS/componentを基準にし、初期[design-system.md](design-system.md)の色/旧sample navを現在値と誤読しない。自然なdocument縦scrollがユーザー承認済み。新機能を追加しても全面再設計は再実施しない。

| 画面群 | 公開hash route（`/:league` = NPB/MLB） | 主な読出し/意味 |
|---|---|---|
| Core | `/home`, `/schedule`, `/search`, `/records`, `/my` | NPB Current vs MLB selected Historical。date/year/competitionはvalidate |
| Detail | `/players/:canonicalId`, `/teams/:canonicalId`, `/games/:canonicalId` | provider IDでrouteを作らない。不存在IDはsafe empty/unavailable |
| Analysis | Player内analysis/BvP/Game Log、`/compare`, `/team-compare`, `/season-compare` | league/role/year/scope/asOf/sampleを明示。Compare URLはcanonical IDs |
| Explorer | `/data`, `/history`, `/glossary` | RecentはData Explorer period state。query/filters/sort/sampleをportableにする |
| Competition | `/postseason`, `/postseason/series/:canonicalId` | season query、series rule/advantage、Regular aggregateと独立 |
| Personal | `/library`, `/watch-center`、My内Favorites | local collection/view IDは他人の共有URLに使わない |
| Future | `/talent`, `/moves`, `/preseason`, `/matchup`, `/watch`, `/milestones`等 | leagueで実装が異なる。NPB Milestonesは実装済み、MLBはComing Soon |

NPBは公開static projection + SELECT-only Vercel API、collector/Turso secretを端末へ渡さない。MLBはseason release SQLite → aggregate gzip/static/Release分割。PA rawをPages/端末全体へ配らない。公開payloadのvalidator・capability/provenance・coordinated publishのcontractをUI都合で変更しない。

| 境界 | 現在の上限・処理 | 残るQA/制約 |
|---|---|---|
| Recent Explorer | NPB一window一projection、40結果render。MLB recent選択12人 | MLB全選手化は新aggregate projectionが必要、全profile総当たり不可 |
| Collections | 最大20collection、100人/collection、ページ12人、Trends一対象展開 | localのみ、最新全員monitorではない |
| Saved Views/Activity | 20view、Activity60件/90日、library約250k文字上限 | 共有は条件だけ、自由検索語の分析保存なし |
| Watch | 12players/4teams/6views、100alerts/240observations/800dedup ID、300KB/90日 | 正常なbounded omissionを画面で示す。背景配信ではない |
| Response cache | IndexedDB、64MB/400entries/一response2MB、in-flight dedupe | last successful fallback、schema検証。OS eviction/新規offlineは別 |
| Favorites/settings | Web localStorage、Android Preferences、schema互換/保存直列化 | Webとnativeはorigin別。cloud syncや自動Web→native移行ではない |

Corruption、quota、unknown future versionを一つのnamespace内で隔離し、全app起動不能にしない実装・testsがある。実端末でOSのstorage eviction、process death、large text、TalkBackを一通り実施した証拠は別Manual QAとして残す。

## 8. Backlogの切り分け

### Product backlog（既存データで進められる）

1. **確認済みNPB Draft / young-player discovery**：known year/round/type/school、DOBの基準日age。既存選手限定・known/total表示・null維持、同期をCompare/Collectionへ。full current draft/prospect/rookie eligibilityとは別。
2. **MLB Season Milestones surface**：既存Season/checkpoint計算を一覧/Profileに接続。保存範囲・scope・達成日未確定を正確表示。Career記録は追加しない。
3. **MLB全選手Recent projectionとMATCHUP入口**：既存Game/PAからbounded projection、exact pair/sample、share条件を再利用。Hot/Rankingタイトルを回避しない。
4. **比較・文脈の残件**：NPB Team CompareのRecent打撃投球/HomeAway、MLBの保存年度Team/player timeline、既知draft cohort compare、月/任意期間・baseline変化、入力の揃う追加basic metrics。各機能ごとにdefinition/sample regressionが必要。
5. **説明の小さな不整合**：公開NPB HomeのHOT文言「直近7日分のデータが揃うと表示」は、現在7日completeでもScheduled proof等でclosedという実態を十分説明しない。Gate理由との表示整合を後続の小fixで直す。今回はUI変更しない。
6. **未importだがrights-clearなHistorical/Platform拡張**：Retrosheet追加年代は既知Sourceから取り込めるC残件。全Career/全史の完全性はimport後に判定する。Web shellのoffline再読込もSource待ちではなくService Worker未実装のC残件で、T6に独立したcache-version/update QAを置く。

### Data Quality backlog（既存Source/registry内で進められる）

- 現在739人に対する72未照合と400 review queue。Phase 2の735/68を現在の分母に上書き表示しない。
- field-level current/historical、birthplace/origin、school attendance/graduation、generic professional debut/NPB debutを区別。knownを上書きせずconflict evidence/date/definitionを残す。
- Draft team canonical 33/739。前身franchise mappingと直接対応の証拠を整える。許諾Sourceから採れるnullのみ補完。
- NPB雨天6partialを通常Rankingのためにcompleteとしない。正当な終了証拠が得られた場合だけ独立評価。
- MLB 42 PA unknowncontext、TTO/Countは必要なdefinition/full validationを独立実施。no inferred matchupを保持。
- fullname/日本語/外国人aliasのverified mapping品質。名前一致だけでcanonical mergeしない。

### Source backlog（データそのもの・範囲が必要）

- NPB exact PA/BvP/Outs/RISP/Score/Count、投手BB独立値（WHIP）、詳細inning/relief/substitution chronology。
- NPB/MLB Full Career、all-time records、same-age career、Career timeline、career milestones。MLBはrights-clear Retrosheet追加年代が候補だがreleaseごとcoverage/import検証が必要。
- 正式rookie eligibility、farm/minor league/prospect performance、Preseason長期比較、current roster/date evidence。
- 安定したcurrent scheduled competitions。Currentデータ未採用の領域にHistoricalで代替しない。

### Rights backlog（許可・契約条件が先）

- **既存nf3 provisionalの明確化と継続性**。historical/Postseason/roster/transactions/exportへの拡張は別許可。既存rights evidenceで明示する将来終了予定に対する代替planも必要。
- NPB公式・球団・二次DBのHistorical、CS/日本シリーズ、Draft、公示、FA/Posting、Preseason。public listingとproduct reuseを混同しない。
- MLB Current/Current Postseason、Statcast/pitch/tracking、Savant/third-party APIのautomation/storage/redistribution/free cost。
- NPB成績export、photos/logos/official colours、記事/予想集約、Lahman edition/upstream。

### Manual QA backlog

- real Androidのcold/warm start、background/foreground/process restart、cache eviction/offline/reconnect、通知tap（Push本番化する場合のみ）、scheme cold launch、Backのmodal/history/parent/root。
- 360px Light/Dark、tablet/desktop、TalkBack、font scaling、keyboard/focus/dialog、cutout/edge-to-edge、soft keyboard、long/null-heavy/foreign names。
- package ID final confirmation、release keystore私有保管、signed AAB、release fingerprint/App Links host-root assetlinks、privacy/Data Safety、device performance。
- Android/Web local favorites origin差、installation/uninstallation/clear data、namespace reset、quota failure時の利用者向け表示。
- Firebase external setup/Production Push Verifiedはoptional別Gate。in-app Watch完成を理由にPush成功と報告しない。

## 9. 価値・実現性に基づく優先順位

評価はユーザー価値/当初構想重要度を高・中・低、工数を小（単一surface）・中（projection＋複数導線）・大（source/競技/多年代）で示す。数字による見せかけのconfidenceは使わない。

| 優先 | 対象 | 価値/構想重要度 | 既存data | 工数 | Rights risk / Quality risk | 波及効果 |
|---|---|---|---|---|---|---|
| P0 運用 | Daily backup failure・freshness・schedule metadata境界の修復/証拠再取得 | 高/高 | 既存pipeline | 中 | 既存nf3 risk / 世代・時刻検証 | 今日/Recent/Watch全体。Product開発とparallel track |
| P0 rights | 既存nf3 scopeの許可・継続性判断 | 高/高 | terms evidence追加が必要 | 外部依存 | 高 / 新Sourceは要validation | NPB release/source strategy。独立Productを止めない |
| P1 product | **NPB known Draft & young-player lifecycle discovery** | 高/高 | あり、partial licensed master | 中 | 条件保持で低 / 欠測・franchise/date注意 | 当初Phase5へ初めて本体接続、Compare/Collections/Player |
| P1 product | MLB保存Season Milestones | 中/高 | あり | 小〜中 | 低 / seasonとcareer/dateを区別 | Record Watch/Profile/My |
| P2 product | MLB all-player Recent & global MATCHUP | 高/中 | あり | 中 | 低 / PA sample・payload budget | Explorer/BvP/Watchへの候補。ranking gate維持 |
| P2 quality | Draft team mapping/72 identity/400queue | 中/高 | 個別evidenceあり/不足混在 | 中、bounded | source別 / conflict判定 | Profile/Draft品質。未解決で上記全体を止めない |
| P2 context | Team Recent splits/month/baseline/timeline/basic metrics | 中/中 | 多くはあり | 中 | 現行scope内 / 各definition | Compare/Explorer/Watch |
| P3 conditional | NPB Career/Current Postseason/Transactions/FA/Posting/Preseason | 高/高 | 未採用 | 大 | 高 / 完全性・event dates | 本来の季節・選手lifecycle completion |
| P3 conditional | MLB additional Historical年代/Full Career | 高/高 | Retrosheet追加年代候補 | 大 | license条件保持 / 年代別missing | Career/同年齢/全史記録 |
| P4 | Statcast/battery/tracking | 中/中 | rights未採用 | 大 | 高 / measurement coverage | 将来Deep MLB、v1必須にしない |

**次に当初構想へ最も近づけるProduct実装は「NPB確認済みDraft情報を起点にした選手ライフサイクル探索」**。既知623人のyear等を使い、現在の`/talent`をpartialな実機能へ接続できる。一方「今年のドラフト全件」「プロスペクト」「新人資格」「未来の移籍」は同Batchで推測追加しない。運用P0はreleaseを守る独立修復trackとして先行または並行し、新しいsource採用と無関係なProduct作業を長期停止させない。

## 10. Operational Completion / 現在の証拠

最新mainに対する以下はGitHub APIで状態を確認した。成功deployは安定Scheduled EODの証拠を代替しない。

| Evidence | 結果 | 評価 |
|---|---|---|
| [Foundation CI 37993266522](https://github.com/tomoya41/baseball-notes/actions/runs/37993266522) | success、push、main `8632e20` | tests/buildのCI証拠 |
| [Android 37993266608](https://github.com/tomoya41/baseball-notes/actions/runs/37993266608) | success、push、同main | workflowはdebug APK/release APK/unsigned AAB/sync/asset scan。signed store/device proofではない |
| [Pages 37993282689](https://github.com/tomoya41/baseball-notes/actions/runs/37993282689) | success、workflow_dispatch、同main | app-only公開。manualをScheduled proofにしない |
| [Daily 37859966186](https://github.com/tomoya41/baseball-notes/actions/runs/37859966186) | failure、schedule | target10/8の1/1Game/Day complete、batting36/36/pitching9/9、issue0の後、`Backup warning: TypeError: fetch failed`でexit1・publish skipped。未収集Gameが原因と決めつけない。fetch失敗の下位原因は未確定 |
| [Freshness 37918727496](https://github.com/tomoya41/baseball-notes/actions/runs/37918727496) | failure、schedule | expected10/8、published10/7、stale |
| [Schedule Sync 37893502993](https://github.com/tomoya41/baseball-notes/actions/runs/37893502993) | failure、schedule | target10/9、`Schedule date outside season metadata`。season end/competition境界のreviewが必要 |
| [EOD Watcher 37989994068](https://github.com/tomoya41/baseball-notes/actions/runs/37989994068) | success、schedule | watcher自身のsuccess。全pipeline/Infrastructure Phase YESとは別 |

今回`npm run check`は**86 test files / 980 tests PASS、lint/typecheck/Web build PASS**。`npm run vercel-build` PASS。初期JSは**479.04KB / 148.42KB gzip**、Historical reader chunk431.75KB / 132.58KB gzip。旧handoffの初期1.15MBは現在値ではない。route splitting改善はあるが、large historical chunkのdevice parse性能は継続計測対象。

Androidは上記**最新main CI証拠**を使用し、この文書のみの変更のため新Android build・emulator・署名・公開を実行していない。backupもwriteを伴う再drillは今回未実施、read-only DB件数と既存演習・testsを確認した。新source/analytics/paid serviceなし、追加月額¥0を維持する構成。これは各accountの請求書・free quota消費の今回の実測保証ではない。

**Infrastructure Phase/HOT/Ranking等の既存Gate値は変更しない。** 直近failureとstaleがある以上、日次運用完全達成という新しい判定は出せない。修復・再run・data backfillはこの監査の対象外。

## 11. Remaining Roadmap — 6 Tracks

Trackは数か月分を一度に実装する約束ではなく、review/revertできる小Batchのまとまり。Source待ちtrackからProduct trackへ戻るとき、採用・rights・coverage Gateを明示する。

| Track / 順序 | Goal | Included | Excluded | Required data / Blockers | Complexity |
|---|---|---|---|---|---|
| T1 **Saved-data lifecycle discovery** / 次のProduct Batch | 当初Draft/選手の歩みへ既存dataを接続 | known Draft year/round/type/school/Team mapping、基準日age discovery、同期Compare/Collection、MLB saved Season milestones | 当年Draft全件、prospects認定、新人資格、Career milestones | 既存licensed master/Season。partial人数・provenance・franchise注意、unknown維持 | 中。Draft探索→同期導線→milestone別review unit |
| T2 **Historical exploration/context closure** / T1後 | 既存HistoricalとCompare価値を取り切る | MLB all-player Recent projection、global BvP入口、保存year timeline、Team Recent/HomeAway、月/baseline/basic metrics。TTOは検証後独立判定 | rawPA配布、Pitch tracking、official順位の代用、Full Career命名 | Game/PA/read modelsあり。payload budgets、TTO/Count definition、MLB official tie ruleは追加一次資料 | 中。projection、UI、validationを順次 |
| T3 **Data Quality bounded completion** / 並行 | identity/masterの不確実性を減らす | 72未照合、400queue、Draft franchise、profile null補完、current/歴史/definition整理 | 名前だけmerge、conflict自動上書き、人間未reviewをhumanReviewed化 | rights-clear既存資料。例外のみ人間判断、6partialは正当な証拠のみ | 中、対象ごとの小review unit |
| T4 **Source / Rights / Current competition** / 並行、採用後のみ機能化 | NPB provisionalリスクとCurrentの穴を解消 | nf3許可・継続性、NPB Current Postseason/roster、MLB Current候補、NPB export/assetsの判断 | 契約・Trial無断登録、rights推測、Current偽データ、既存Gate解除 | affirmative reuse条件、automation/storage/redistribution、¥0とsource longevity。独立provider adapters | 外部依存・大。Rights未解決でもT1/T2は進行可 |
| T5 **Seasonal / Career expansion** / Source解放されたreview unitだけ | Original visionの未完成領域を順次埋める | (a) admitted Draft/Prospects、(b) transactions/FA/posting/Team IN-OUT、(c) Preseason、(d) NPB Historical/CareerまたはRetrosheet追加年代 | 全領域の一括実装、source未承認news、追跡/速報 | T4のSource採用・competition/type・event dates/identity・年代coverage、Career全期間証明 | 各(a–d)大、年/competition/import単位で分割。順序は採用Sourceと季節価値で決定 |
| T6 **Operations / release quality** / 運用P0は即、Final QAはscope freeze後 | 正常な無人更新とrelease可否を閉じる | latest failures修復、Scheduled/backup/HTTP proof、free quota、package/signing/App Links/privacy、実機/TalkBack、既存全機能回帰、Web offline shellを採用するならversion/update QA、最後一度のAstra polish→Final QA | Google Play自動公開、Firebase Production必須化、source blockersをUIで隠す | owner manual gates、device、release certificate、freshness/coverage proof。旧Infrastructure値と分離し正規の手続きで評価 | 中、外部QAあり |

T5全体を次の巨大Batchにしない。特にCurrent Postseason、Historical Career、TransactionsはSource/rules/qualityが別であり、使える一つだけを独立追加する。**現在のUI/Design Systemに統合し、全面Astra再設計を再計画しない。** 最後のpolishはProduct追加完了後の一回とし、contract/payload/rights/local namespacesは変更しない。

## 12. Completion EstimateとRelease Candidate

完成率は契約・release判定ではなく計画用の概算。I001–I150の単純A割合でも、DB行数の比率でもない。domainを等しく見てA=満足、B=不足量に応じて一部、C/D/E=未達、F=現行必須外として判断した。細分化による見せかけの小数精度を避けて5%程度へ丸める。

| 評価 | 目安 | 対象・根拠 |
|---|---:|---|
| **Product / UX completion** | **85%**（80–90%） | 現在採用dataで実現するcore/exploration/compare/personal/gameに限定。機能接続は広いがglobal BvP/all-player MLB Recent/known Draft/Season milestoneの未接続、Gate説明、実機UXQAが残る |
| **Original vision completion** | **55%**（50–60%） | §2の三価値。現在と探索は強いがCurrent MLB、HOT/NPB Ranking、full lifecycle/Career/Draft/Hot Stove/Preseason/push/deep measured analysisが未達 |
| **Data completion** | **50%**（45–55%） | 六League/time scopeとprofile/competition/season/PA/lifecycle/history/trackingを評価。MLB Historical denseでもNPB/MLB Currentの他scopeへ加点しない |
| **Operational completion** | **60%**（55–65%） | Web/CI/build/backup-codeは成立。直近Scheduled failure/stale、長期backup、nf3 risk、unsigned/real-device/App Links/privacy/Store QAが残る |

**今は「実装済み保存データscopeのWeb preview / Android beta基盤」と呼ぶのが正確で、当初構想全体を満たすFinal Release Candidateとは呼ばない。** CI PASSだけでDaily信頼性やrights・signed device validationを置き換えない。

Final QAは削除しない。次の三段階を分ける。

1. **現在実装済み範囲の安定性確認**：今回のread-only audit/tests/build、各fix/Product Batchのregression/public HTTP。すぐ継続する。
2. **v1 Final QA**：v1に含めるT1/T2等のProduct scopeと、残すunavailableを明示してfreeze → source/rights release判断・Scheduled修復証拠 → 必要な一度のAstra polish → signed Android/実機＋Web全route/360px Light-Dark/offline/persistence/accessibility/privacyを確認。その後に限定scopeのRCを宣言する。Source探しを無限に続けてQAを延期しない。
3. **Original vision全体の最終QA**：将来T4/T5のCareer/Current/seasonal領域まで含めた機能完成時に別途行う。v1の明示的未対応と、構想を永久削除することを混同しない。

Pushは外部設定・配信verifiedを別に扱い、in-app Watchのみのv1を許容する。Play実公開はrelease ownerの明示指示で行う。残source領域のComing Soon/unavailable表示を完全機能へ偽装しない。

## 13. 古い文書・証拠との差分と監査の限界

2026-10-10 Product Track 2: T1のDraft/若手探索後、自然な日本語copyへ整理。
T2のMLB全選手Recent 7/14/30、横断MATCHUP、Season節目、保存済み年度/球団履歴、
MLB-only WHIP/BB9/K%/BB%を実装。既存Historicalのみで、Source/Gate/Career範囲は
拡張しない。個別の配信・検証証拠は`docs/historical-product-track-2.md`とDelivery PR。
以下の当初監査値は監査時点のsnapshotとして保持する。

- `README`/`architecture.md`/`data-architecture.md`/`analysis-capabilities.md`/旧`design-system.md`の初期sample・Phase 0・one-game proof説明は履歴であり、current implementation一覧ではない。現在composition root/routes/published manifestsと最新decisionsを優先する。
- 過去735人・68未照合・affiliation608等と、現在739人・72未照合・affiliation562を混ぜない。減少の原因をこのread-only auditで勝手にmaster修正しない。field定義・生成条件の差はData Quality follow-upとして保持。
- Team Favoritesは初期Compare報告に「未追加」とあっても現在実装済み。MLB Rate閉鎖の旧記述は現在records readyで更新されている。初期JSは旧handoffより改善済み。
- NPB HomeのHOT説明と実Gate理由には§8の文言gapがある。画面がprepareと表示するだけで「収集完全なら開く」と結論しない。
- 公開HTTPはselected34件・schema/generation確認、DBはread-only件数。全remote DB hash、全試合nested Fact再validation、全route全端末のManual QA、source licenseの法律相談、account請求検査を今回実施したとはしない。
- main commitと公開snapshotは確認時点の値。別のscheduled runが後にデータを更新した場合は新しいsnapshotで再評価する。今回のdoc変更をdata correction/publish runと扱わない。

本監査のtracked変更対象はこの文書とその集計・hash evidenceのみ。Facts、canonical ID、Coverage、Production Gate、Capabilitiesの意味、Regular/Postseason、NPB Current/MLB Historical、provenance/export制限、完成UI、Android、local保存契約を変更していない。次Batchを自動実行せず、ここで棚卸しを終える。
