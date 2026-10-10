# NPB Free API Validation / Daily Readiness

確認日：2026-10-10 JST。基準main：`20d0e6084faa5c543ea1b467726a7b5a21794211`。
この監査は[Source / Rights audit](npb-source-rights-2026-10.md)の追補。新規登録・trial・契約・課金・問い合わせ送信は行っていない。nf3、本番Turso、Production Gate、公開NPBデータを変更しない。

## 判定

| Source | 無期限無料 | NPB無料範囲 | 実取得 | 全試合 | 保存 / 公開 | 結論 |
|---|---|---|---|---|---|---|
| TheSportsDB / TheDataDB Ltd | 現行developer無料枠 YES。将来継続保証なし | league 4591、2026のイベントを確認 | 正式v1 developer key 123、下記8 calls | 日別3件 / Season15件。欠損なく取得できることを証明できない | API developer PoCの取得・加工は許容。長期DB・public JSON・第三者権利は未確定。ストア公開アプリは有料subscriber必須 | TECHNICAL_ONLY / 本番保留 |
| API-Baseball / SC Sattina Softacular Concept SRL | UNKNOWN。「Start free」とplan依存trial案内を区別 | UNKNOWN | BLOCKED_CREDENTIALS | 未検証 | provider Termsにデータの保存・移転・配布許容。ただし公開用途の対象plan・第三者権利・NPB無料範囲は未確認 | BLOCKED / 認証と無料scope確認待ち |
| API4Sports / 同社 | limited free tierは存在。NPBを継続取得できる枠はUNKNOWN | UNKNOWN | BLOCKED_CREDENTIALS | 未検証 | 同様のデータ保存・移転・配布許容条項あり。NPB、無料planの商用/公開範囲と上流権利は未確認 | BLOCKED / 認証と無料scope確認待ち |

API-Baseball (`api-baseball.com`) は既存監査の **API-SPORTS (`api-sports.io`) とは別サービス**。API4Sportsと運営者は同じで、独立した複数供給元の証明にはならない。認証鍵は既存環境に見つからず、認証回避・無許可のキー試行はしていない。

## 公式資料

| Source | 一次資料 |
|---|---|
| TheSportsDB | [Documentation](https://www.thesportsdb.com/documentation)、[Terms (2026-09-17更新)](https://www.thesportsdb.com/docs_terms_of_use.php)、[Pricing](https://www.thesportsdb.com/api.php) |
| API-Baseball | [Docs](https://www.api-baseball.com/docs)、[Terms](https://www.api-baseball.com/terms)、[Pricing](https://www.api-baseball.com/pricing) |
| API4Sports | [Baseball](https://www.api4sports.com/products/baseball-api)、[Terms](https://www.api4sports.com/terms)、[Pricing](https://www.api4sports.com/pricing) |

API-Baseball / API4Sports Copyright節の許容文には “distribution, transfer and storage of the data provided by the Service are allowed” とある。APIデータと、personal/non-commercialに限定するwebsite素材の条項を混同しない。ただしデータ許容文だけで第三者のNPB権利や選択planのscopeまで確認済みとはしない。サービスの再販売には別許可が必要。画像・ロゴ・動画は別権利であり、今回は取得・使用しない。

## 操作別権利

ALLOWEDはproviderが示した当該用途の範囲に限る。第三者権利は別列で扱う。

| 操作 | TheSportsDB free | API-Baseball | API4Sports |
|---|---|---|---|
| 正式API自動取得 | developer endpoint限定 ALLOWED | key/plan取得後の正式API。今回は認証なし | 同左 |
| 少量PoC | ALLOWED / 実施 | key未設定 / 未実施 | key未設定 / 未実施 |
| 永続保存 / 非公開DB | UNKNOWN（copy許容から長期蓄積を断定しない） | provider storage ALLOWED、対象plan/上流権利は未確定 | 同左 |
| 長期蓄積 / 契約終了後保持 | UNKNOWN | 明示的retention条件 UNKNOWN | UNKNOWN |
| 分析 / derived aggregate | developer modify ALLOWED、public用途 UNKNOWN | providerデータ利用条項あり、対象plan/上流範囲 UNKNOWN | 同左 |
| 公開Web表示 | developer freeをProduction公開許可に読み替えない / UNKNOWN | distribution許容条項と対象planを確認する必要あり | 同左 |
| Androidストア公開 | freeはDENIED、有料subscriber必須 | UNKNOWN | UNKNOWN |
| raw JSON再配布 | UNKNOWN | provider distribution許容、NPB上流権利 UNKNOWN | 同左 |
| 画像 / ロゴ | 個別asset license・第三者許可が必要 | 第三者権利別確認 | 同左 |
| 将来収益化 | free Production権限未確認 | APIのresaleとアプリ広告を区別して問い合わせ | 同左 |

No FULL_READY / SCORE_READY Source。三者とも新しい本番collector、shadow adapter、Secret、canonical write、public payloadは追加しない。

## 少量実API PoC

実行：`npx tsx scripts/probe-npb-free-api.ts`。正式base：`https://www.thesportsdb.com/api/v1/json/123/`。
8 requests / 1実試合のdetail関連endpoint、2日分の日程と1Seasonを確認。初回4 callsを含め、この調査で計12 calls。再実行も同じ上限内。取得レスポンスそのものは保存しない。ignored `.data/integrated-history/npb-api-probe.json` はHTTP status・件数・存在field名・sample event IDだけの診断記録。公開appに利用しない。

| Endpoint | HTTP / 件数 | 確認範囲 |
|---|---|---|
| `lookupleague.php?id=4591` | 200 / 1 | NPB league identity。外部IDでcanonicalを自動生成/mergeしない |
| `eventsday.php?d=2026-09-25&l=4591` | 200 / 3 | 日付、home/away、score、status、postponed等のfield。日別capのため全6試合は保証不可 |
| `eventsday.php?d=2026-10-10&l=4591` | 200 / 2 | CS開始日のイベントが存在。Round・Series rule・全CS/日本シリーズStatsは未検証 |
| `eventsseason.php?id=4591&s=2026` | 200 / 15 | Season capを確認。年間全件取得の証明にならない |
| `lookupevent.php?id=2391026` | 200 / 1 | 代表試合のdetail。スコアだけでBox/PBP completenessとは判定しない |
| `lookupeventstats.php?id=2391026` | 200 / 0 | このサンプルでは個人成績なし |
| `lookuplineup.php?id=2391026` | 200 / 0 | このサンプルではlineupなし |
| `lookuptimeline.php?id=2391026` | 200 / 0 | このサンプルではPA/eventなし |

TheSportsDB official free limitは30 requests/minute。日/月request quotaは明示確認できずUNKNOWN。応答上限とHTTP request上限を区別する。過去日lookupは正式API範囲だが、延長・引分・雨天・DH・交流戦・日本シリーズの30–50試合照合は今回成立していない。スコア一致率は計算していない。inning score / H-E / batter-pitcher Game Stats / exact PA availabilityは未検証またはサンプルなし。

API-Baseball base：`https://api.api-baseball.com/api/baseball`。API4Sports base：`https://api.api4sports.com/api/baseball`。両者とも全requestにX-Api-Keyが必要。docsのgames endpointはfrom/to（最大6か月）・team/league・paginationを持つが、無料NPB Season範囲、quota、過去日、2027継続性、実Stats品質はkey/planなしで確認できない。marketingの「NPB/lineups/events」は検証済みFact capabilityではない。

## Daily readiness（実装済み準備、収集運用ではない）

`src/domain/source-readiness.ts`：Source・league/competition/season・fields・permissions・cost・coverage・provenanceをZodで検証。FULL_READY/SCORE_READYに無料・完全coverage・取得/保存/公開/再配布の許容を要求。score-onlyをFULL_READYへ昇格しない。既存sourceRegistry/collector/Production Gateとは独立した入力証拠contractで、既存nf3のprovisional scopeを変更しない。

純粋なshadow assessmentはJST日付、再取得idempotency、scheduled/postponed/suspended、partial Game/Player Stats、null score、identity/team不足、異なるSource/competition、correction、stale observation、invalid schemaをquarantineする。retry上限は2。ネットワーク実行・DB書込・source多数決mergeは含まない。fixturesはテスト専用で、本番Mockではない。

2027 Productionには、無料planとNPB範囲・長期保存/公開許諾、正規キー（必要ならユーザー自身の登録）、全試合/player-stat sample照合、Source専用adapter、shadow run、budget/freshness監視、独立Production Gateの証拠が必要。Scheduled proofは既存Operations Trackのまま。

## CS Finalルールfixture

[NPB公式 2026 CS規定](https://npb.jp/games/2026/info_cs.html)を2026-10-10再確認。通常は1勝advantage・最大6実試合・4勝到達。1位との10ゲーム差以上、またはFirst Stage勝者の勝率5割未満なら2勝advantage・最大7実試合・5勝到達。勝率は引分を除くW/(W+L)。不足evidenceなら判定不能。架空Gameは生成しない。

`npbCsFinal2026`は**準備用rule metadata / fixtureのみ**。既存series validatorの1勝限定は変更しない。NPB Current Postseasonのrightsが得られた際、rule evidenceを伴うversioned contract対応と引分/早期決着の検証が別途必要。本番NPB Postseason capabilityはSource rights pendingを維持。
