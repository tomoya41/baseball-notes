# Batch G 完了報告 — NPB Data / Rights / Contract Freeze

検証日：2026-09-30 JST。公開データのeffectiveDate：2026-09-29。実装commit：`f56cb85f1eabca4769fe6d3e80af704e34e37cb1`。

今回の実装・棚卸し・契約凍結・公開は完了。AstraのUI再設計は開始していない。全選手の詳細プロフィールや画像を取り切ったという意味ではない。権利、canonical identity bridge、Source evidenceが不足する項目はOFF/nullのまま渡す。

## 指定62項目

| # | 項目 | 結果 |
| --- | --- | --- |
| 1 | NPB capability inventory | 55 data keys：available 20 / partially_available 8 / blocked_by_rights 18 / source_unavailable 5 / production_gate_pending 4。下表参照 |
| 2 | source_available_not_implemented | **0**。安全な実装可能グループは実装。Sourceにページがあるだけの18項目は権利不足に分類し、実装待ち扱いにしない |
| 3 | 今回実装したdata groups | 共通Player/Team catalog、reviewed CC0身長・体重、明示日付の年齢、membership/visual契約、12球団Season集計、data-keyed capabilities、静的Repository、再生成一致検証 |
| 4 | rights blocker groups | 投打の追加取得、背番号、draft、所属歴、transactions/FA/posting/retirement/prospects/camp/preseason、歴史Season/career/milestones、写真・ロゴ・公式色。nf3既存利用もprovisionalで、新しい包括許諾は未確認 |
| 5 | source unavailable groups | 採用済みの確実な粒度ではDirect BvP、pitchLevel、inningScore、strict substitution/relief orderの5。世界中にSourceが存在しないという断定ではない |
| 6 | Player count | **735**。保存済みPlayer一覧であり、現役登録名簿735人という意味ではない |
| 7 | position coverage | **3/735**。Game役割から守備位置を推測していない |
| 8 | bats coverage | **0/735** |
| 9 | throws coverage | **0/735** |
| 10 | birthDate coverage | **4/735** |
| 11 | height coverage | **3/735**：上原健太190、坂本誠志郎176、早川隆久180 cm |
| 12 | weight coverage | **2/735**：坂本78、早川76 kg。上原83/84の競合はnull |
| 13 | uniform coverage | **0/735**。membership内に値・observedAt・effectiveDateを予約、全null |
| 14 | draft coverage | year/roundとも**0/735** |
| 15 | team history coverage | **0**。空配列は所属歴なしという断定ではなくCapability unavailable |
| 16 | player photo候補 | Commons中島大輔のexact file、上原・坂本・早川のP18候補、公式球団写真。rights文書にURL/ownerを記録 |
| 17 | photo rights | 中島exact fileのCC BY-SA 4.0著作権許諾は確認。意図するアプリportrait用途の非著作権・会場等の条件は未確定。他のP18だけでは許諾扱いしない |
| 18 | photo Production | **NO**。全735 photo usage unavailable、URL null。権利不明URLのhotlinkもなし |
| 19 | team logo候補 | 球団公式のteam marks、Commonsの個別graphic候補 |
| 20 | logo rights | Hawksは無許可使用を禁止。他球団/Commonsはasset単位の許諾・商標確認未完了 |
| 21 | logo Production | **NO**。全12 logo unavailable/URL null。球団名・略称のtext fallback |
| 22 | team colors | official primaryColor null、colorRole neutral。既存UI色や任意の中立色を公式球団色と呼ばない |
| 23 | team master | **12/12** canonical ID・日本語名・短名/略称・セ/パ。公式home location/stadiumは未確認でnull |
| 24 | team season | 12/12 G/W/L/T/RF/RA +既存Batting/Pitching Aggregator。scope stored_final_games、Game/Fact Coverageを分離。下表参照 |
| 25 | historical NPB | 旧nf3/公式資料の存在を確認。大量保存・加工・公開許諾/全歴史Coverageが未確定、OFF |
| 26 | career | OFF。保存済み2026合計をNPB通算にしない |
| 27 | milestones | Career Coverage/再利用根拠がなくOFF。1000本安打等を保存期間から判定しない |
| 28 | transactions | 公示Sourceは存在するが権利・event identity/effective dateが不足、OFF |
| 29 | FA | 公式候補資料を記録。採用許諾なし、OFF |
| 30 | posting | 同上。Game Factsと混ぜない |
| 31 | draft/prospect | Source候補あり、公開再利用・identityの確認不足、OFF |
| 32 | preseason | 公式オープン戦/camp資料を確認。二次利用・無断転載禁止の表示あり。許諾なく収集しない、OFF。regularと混在なし |
| 33 | HOT readiness | **not_ready**。9/23–9/29 Coverage partial、candidate 434、Production eligible打者/先発/救援各0、保存診断のScheduled証拠false |
| 34 | HOT Gate変更 | **なし**。existing engineでread-only再計算しただけ |
| 35 | Ranking readiness | **not_ready**。counting未達、rate rule verifiedだがCoverage不足・qualifier computation未成立・public ranking disabled |
| 36 | Ranking Gate変更 | **なし**。雨天partialを除外して公開していない |
| 37 | Records | 2026 Season read modelのみ。Gate pending、637 bytes、独自計算/query追加なし。historical/careerと混同しない |
| 38 | rain-shortened | 5日6試合partialを維持。今回修復0・推測complete 0。9/28にも別の既存未検証がある（下記） |
| 39 | canonical tables/fields | **追加なし**。新規はderived public契約とreviewed CC0 registryのみ。canonical DB writes **0** |
| 40 | migrations | **なし**。schema v4を維持 |
| 41 | Data Contracts | League / Team / Player / PlayerProfile / PlayerVisuals / PlayerMembership / Game / GameDetail / Season / PlayerSeason / TeamSeason / Recent / Analysis / Ranking / Records / Favorite / Capabilities |
| 42 | nullable fields | 守備位置、投打、DOB/出生地/国籍、身長/体重/測定effective date、年齢、背番号と時点、draft、公式本拠地/球場/色、asset URL/credit/license、未知score/stat。nullを0にしない |
| 43 | visual contract | allowedならURL・attribution・licenseUrlすべて必須。unavailableならURL等は禁止。UIはproviderを知らずname/text fallback可能 |
| 44 | capability manifest | strict schemaVersion **1**。status/available/reasons/known/total、Coverage付き。全55項目を公開 |
| 45 | public payload | 新規 `/data/npb/catalog/latest.json`、`/data/npb/capabilities.json`、`/data/npb/teams/season/2026/latest.json`。既存Directory v2/Season v1/Game/Records v1は互換維持 |
| 46 | largest payload | **新規catalog 521,905 bytes**。新規計567,228 bytes。今回再生成Season 1,514,185 bytes。MLB既存巨大payloadを新規増量していない |
| 47 | Astra Handoff | `docs/astra-ui-redesign-handoff.md`。data/null/capability/rights/routes/endpoints/freshness/league差/native制約を記載 |
| 48 | Android regression | CI compile/debug APK/release unsigned APK/AAB/Capacitor sync **PASS**。secret scan PASS。debug APK 5,965,466 / unsigned APK 4,678,912 / AAB 4,396,482 bytes。署名/Firestore/Play操作なし |
| 49 | NPB regression | 全tests＋公開Home/Profile/Recent/GameLog/Analysis/Schedule/Game/Records/Myを確認。既存公開表示とexplicit partialを維持。new catalogは次UI用で現UIの大改修なし |
| 50 | MLB regression | Historical/Advanced/Ranking/Favorites等の既存tests PASS、公開代表画面回帰、Backup全13,046 Games/979,855 PA一致。Current取得なし |
| 51 | backup | NPB remote schema.sql/JSONL.gz/manifest/hashes **PASS**、17 tables、圧縮1,598,356 bytes、暗号化Artifact7日保持。MLB635files/65,518,293圧縮bytes、PASS |
| 52 | scratch restore | NPB counts/hashes一致、9/29 sampleGame batting28/pitching5/complete、standings12。MLB Game/Player/代表PA一致。CC0 registryとprojectionコードはGit、canonical新tableを作らないためDB backupへ重複保存なし |
| 53 | tests | **472 tests /49 files PASS**（新規11）。rights/nullable/unit/identity conflict/single fetch/3SELECT/team score/idempotencyを検証 |
| 54 | lint | **PASS** |
| 55 | typecheck | **PASS**、strict維持 |
| 56 | build | **PASS**。既存large chunk警告あり、failureではない |
| 57 | Vercel build | **PASS** |
| 58 | Pages Run | **36702674209 success**、workflow_dispatch。新3payloadとSeason/HOT HTTP200、effectiveDate9/29。手動公開をScheduled proofにしていない |
| 59 | 現Source/権利内でほぼ取り切ったか | **NO**。許諾を確認した4identityに限る安全拡張は完了したが、全735のプロフィールを確定できていない。nf3未拡張・写真/ロゴ等OFFという具体的限界あり。「全データ完備」とは報告しない |
| 60 | Astra全面UI再設計へ | **YES**。安定contract・rights-safe fallback・capabilities・Handoff・Regressionが揃った。データ不完全表示/Gateは維持 |
| 61 | Astraへ既知blocker | sparse Profile、写真/ロゴ/公式色なし、背番号/歴史/取引OFF、雨天6試合・9/28未検証3試合、HOT/Ranking/Records Gate、nf3provisional、正式package/署名/Firebase/App Linksは別manual gate |
| 62 | 新Source/許諾が必要 | roster/membership+背番号/投打/詳細Profile、過去全Season/career/milestones、取引/FA/posting/draft/prospects、preseason、雨天終了証拠、画像/商標/公式ブランドmetadata。既存ownerの明示許諾でも解決可能。今回追加collectorなし |

## 機械的Capability inventory

| 分類 | keys |
| --- | --- |
| available (20) | teams, standings, schedule, results, teamSeasonRecord, game, score, gameStatus, battingFacts, pitchingFacts, battingOrder, batterRole, pitcherRole, playerMaster, recent, homeAway, opponent, battingOrderAnalysis, roleAnalysis, season |
| partially_available (8) | completeness, playerTeam, position, birthDate, birthPlace, nationality, heightCm, weightKg |
| blocked_by_rights (18) | bats, throws, uniformNumber, draft, teamHistory, transactions, FA, posting, retirement, prospects, preseason, camp, historicalSeason, careerStats, milestones, playerPhoto, teamLogo, officialTeamColors |
| source_unavailable (5) | directBvP, pitchLevel, inningScore, substitutionOrder, reliefOrder |
| production_gate_pending (4) | hot, countingRanking, rateRanking, records |

`playerTeam`は保存済み最新所属でありCurrent rosterの独立確認ではない。Game/Fact availableは「全Game complete」の意味ではない。利用可能な値にもCoverageを添える。blocked_by_rightsの候補は[権利監査](npb-batch-g-rights.md)参照。

## Current Fact / Coverage read-only監査

| Metric | Before | After |
| --- | ---: | ---: |
| Games | 898 | 898 |
| Batting Facts | 22,804 | 22,804 |
| Pitching Facts | 6,913 | 6,913 |
| Source mappings（全件） | 1,656 | 1,656 |

PA known22,804 / unknown0 / PA=0 4,440。打順valid22,804 / missing0 / invalid0。打者先発14,886 / 途中7,918 / unknown0。投手先発1,654 / 救援5,259 / unknown0。救援登板順known0。四死combined fieldは6,911/6,913 known、残2nullを0にしない。

ユーザー提示の3/27–9/26（184日）：154 complete /25 no_games /5 partial /0 unknownはその範囲で維持。最新保存範囲3/27–9/29（187日）は**156 complete /25 no_games /6 partial /0 unknown**。新しい3日分が別trackで既に存在しており、Batch Gが追加収集したのではない。

現在Fact validator：**827 complete /6 partial /3 unverified**。6雨天Gameはatomic保存前に検証で止まったため保存batting/pitching各0。現在Factをそのまま検証した80 failed checksは参加者未保存の派生エラーも含み、80独立parser bugという意味ではない。別の9/28の3final headersにはcompleteness証拠がなく、各`expected_participants_unverified`。今回これを自動修復せず既存状態を公開contractへ反映。

| date | canonical Game ID | home–away / score | 維持した問題 |
| --- | --- | --- | --- |
| 4/9 | npb:game:2469292e18a73924f23c | 阪神–ヤクルト 2–0 | 短縮終了inning等の独立証拠不足 |
| 4/14 | npb:game:99b0c4913966af7674ad | ヤクルト–DeNA 5–3 | 同上 |
| 5/3 | npb:game:e9a705d2e3ddfe1dabe8 | 阪神–巨人 3–0 | 同上 |
| 6/20 | npb:game:b2f541664347c98a1f62 | ヤクルト–広島 6–8 | 同上 |
| 9/9 | npb:game:51c3f0f8dba6a7bb710e | ロッテ–楽天 10–4 | 同上 |
| 9/9 | npb:game:645ed547effceffc5ca9 | DeNA–ヤクルト 9–2 | 同上 |
| 9/28 | npb:game:7978b5cc540f0334e2d7 | 保存final header | expected_participants_unverified |
| 9/28 | npb:game:5956839637147e5631b2 | 保存final header | 同上 |
| 9/28 | npb:game:fd5f433285c5557b67a6 | 保存final header | 同上 |

9/28 day recordのverified final count=0から試合なしとは推測しない。Latest7dはpartialで、古い“latest7d complete”の報告を再利用しない。Infrastructure Phaseは再判定せず、Scheduled監視/待機をしなかった。

## Team Season（保存final scoreに基づく、公式完全Seasonではない）

| Team | G | W | L | T | RF | RA |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| DeNA | 141 | 69 | 69 | 3 | 550 | 509 |
| オリックス | 142 | 65 | 75 | 2 | 483 | 599 |
| 広島 | 138 | 58 | 76 | 4 | 411 | 507 |
| 中日 | 141 | 59 | 80 | 2 | 474 | 488 |
| 楽天 | 138 | 55 | 82 | 1 | 457 | 543 |
| 日本ハム | 142 | 77 | 62 | 3 | 588 | 528 |
| 巨人 | 140 | 76 | 62 | 2 | 481 | 432 |
| ソフトバンク | 139 | 89 | 47 | 3 | 693 | 442 |
| 西武 | 141 | 77 | 60 | 4 | 493 | 463 |
| ロッテ | 136 | 61 | 72 | 3 | 482 | 563 |
| ヤクルト | 138 | 59 | 77 | 2 | 435 | 552 |
| 阪神 | 136 | 76 | 59 | 1 | 502 | 423 |

G=W+L+T、league RF=RAを確認。Batting/Pitchingの集計はFactが存在する試合のみ、gamesWithFactsとCoverageで区別。`observedHomeVenues`は保存試合の球場であり、正式本拠地の推測ではない。

## Public / Performance / Idempotency

Base：`https://tomoya41.github.io/baseball-notes/`。以下は全部HTTP200/effectiveDate2026-09-29。Windowsでの単発cold HTTP測定でありSLAではない。

| Path | Bytes | Fetch ms |
| --- | ---: | ---: |
| data/npb/catalog/latest.json | 521,905 | 415 |
| data/npb/capabilities.json | 7,597 | 208 |
| data/npb/teams/season/2026/latest.json | 37,726 | 211 |
| data/npb/season/2026/latest.json | 1,514,185 | 367 |
| data/npb/hot/latest.json | 700 | 213 |

Team projection **3 SELECT**、全Game surface生成**9 SELECT**。Game index195 date files計330,291 bytes/max2,184 bytes、generation4,979.56ms。新catalogはProfile基本情報を一度の共有取得で返し、concurrent呼出しをdedupe、bounded IndexedDB cacheを再利用。ゲーム毎/球団毎/Profile毎のSQL追加なし。Records追加SELECT0。新規raw Source HTML/Provider ID/credential/public PA追加なし。

同じprojectionを2回生成し新3fileのSHA256完全一致、canonicalwrites0。監査11SELECT/3,573ms、現在Fact再validation5SELECT/4,508ms。HOT既存batch6SELECT、read863ms/aggregation8ms/total1,523ms。既存集計式をコピーせずAggregatorを利用した。

## Quality / Operations boundary

[Foundation checks 36702625521](https://github.com/tomoya41/baseball-notes/actions/runs/36702625521)、[Android build 36702625673](https://github.com/tomoya41/baseball-notes/actions/runs/36702625673)、[Pages/remote監査/Restore 36702674209](https://github.com/tomoya41/baseball-notes/actions/runs/36702674209) success。

公開360px Darkは代表画面と横幅計測でpage overflowなし。semantic headings/skip link/favorite labelを確認。今回はUI/CSS変更0でLight/large-font/TalkBackの新しい実機試験は行っていない（Batch F実機検証を置き換える主張はしない）。Astra再設計後はLight/Darkと実機の再検証が必要。

Repo hygiene：生成/Source response/Backup/DB/APK/screenshotはignored `.data`/build artifactのみ。新contract・adapter・manual review・preservation・testsの参照を確認、無関係なcleanupなし。既存obsolete不明fileを推測で削除していない。月額追加費用**¥0**。新たなAndroid UI、final package、release signing、Firebase設定、Play公開、MLB Current、Statcastなし。

停止地点：Batch G実装完了／**Astra ready YES**／全NPB Profile・Visual完備NO。次Batchはユーザーの明示指示後。Rights blockerは許諾/新source・identityの別課題、9/28と短縮試合のdata issueも別Trackで扱う。
