# MLB 2026 Source / Rights gate

確認日: 2026-09-27。Batch DのMLB全シーズン収集・Public static payload再配布についての判断。APIの接続可否と、収集・永続化・公開の許諾は別。

| 候補 | 出所 / 認証 / 制限 | 2026 Core / 公開・再配布 / Actions | 判断 |
|---|---|---|---|
| MLB Stats API | MLBサーバー。認証不要アクセスは許諾を意味しない。公式一般向けrate limit / SLAは未確認 | MLBAM告知は個人・非商用・非大量利用に限定。それ以外は書面許諾が必要。全試合Backfill / Pages再配布 / 公開アプリの許諾を確認できない | 未採用。Collector / Backfill / 静的成績配信なし |
| Retrosheet | 独立非営利団体、認証不要。商用を含む再利用を認め、所定の目立つ表示を要求。rate SLAは未確認 | 確認したCSV範囲は1897–2025。2026更新日やcopyrightは2026試合提供の証明ではない。既存2025 historical standingsを維持 | 歴史Sourceは利用可能だが2026 Coreを提供しない |
| API-SPORTS Baseball | 第三者 / API key / Free 100 requests/day、UTC 00:00 reset。無料条件の変更可能性あり | 契約はデータの出版ライセンスを付与しない。競技等の権利は利用者の責任。MLBの公開・再配布許諾は未確認。無料枠だけでは全シーズン取得にも不向き | 未採用。アカウント・課金・secrets追加なし |
| SportsDataIO | 第三者 / API key。無料Trialはscrambled data、Discovery Labは過去シーズンの個人非商用利用 | 公開アプリは対応ライセンスが必要。無料2026実成績公開の条件を確認できない | 未採用。Trial値をFactにしない |
| Baseball Savant / Statcast | MLB系。CSV項目の公式説明あり。大量取得・再配布の許諾は未確認 | 列の存在と利用権は別。CoreをStatcast待ちにはしない | 調査・将来案のみ。取得・保存・公開なし |

Actionsから同じAPIを呼んでも許諾問題は解消しない。WrapperのOSSライセンスはデータ再配布許諾ではない。無料個人利用を公開サイトの大量配信へ読み替えない。今回はProduction取得Workflow、DB migration、MLB snapshotを追加しない。

一次資料:

- [MLBAM copyright notice](https://gdx.mlb.com/components/copyright.txt)
- [MLB Terms of Use](https://www.mlb.com/official-information/terms-of-use)
- [Retrosheet use notice](https://www.retrosheet.org/notice.txt) / [CSV distribution](https://www.retrosheet.org/downloads/csvdownloads.html)
- [API-SPORTS Terms](https://api-sports.io/terms) / [Baseball Free plan](https://api-sports.io/sports/baseball)
- [SportsDataIO trials](https://sportsdata.io/help/scrambled-data) / [Data rights](https://sportsdata.io/help/data-rights-and-licensing-questions)
- [Baseball Savant CSV fields](https://baseballsavant.mlb.com/csv-docs)

## 2026 qualifier確認

[2026 Official Baseball Rules](https://mktg.mlbstatic.com/mlb/official-information/2026-official-baseball-rules.pdf) Rule 9.22(a)(b)、冊子144–145頁 / PDF155–156頁。原文転載せず事実ルールを整理。

- 打撃タイトル: 所属リーグの各Clubに予定されたシーズン試合数 × 3.1 PA、最近整数へ丸める。162試合なら502 PA。
- 防御率タイトル: 同じ予定試合数以上の投球回。162試合なら486 outs。161 2/3 IPは未達。
- 不足PAの打撃タイトル例外は全未達者を通常qualifiedにするものではない。必要PAを加算しても首位になる場合のタイトル判定。未実装。
- OPS / K9を公式タイトルと呼ばない。比較sample policyは別。

以上はシーズンタイトル基準。途中時点のランキング閾値へ無条件適用しない。2026の全予定試合数・移籍の扱い・途中時点policy・完全なsample / Coverageを未取得のため、実Playerのqualified判定は実施しない。Rate rankingはnot_ready、qualifier computationはunknown。

MLB PAには妨害等による出塁も含まれる。将来Providerの明示PAを優先し、NPBのAB+BB+HBP+SH+SFだけで逆算しない。既存率Aggregatorは変更しない。

## 許諾後の取得量見積り（実測ではない）

30球団 × 162試合 ÷ 2 = 2,430試合を規模の算定例とする。実際の2026予定・final件数ではない。1 box-score request/Game、date-batched schedule、batched Masterという最低構成でも約2,600〜3,000 requests。追加detail / rosterが必要なら増える。平均HTTP 0.5〜2秒を仮定すると約22〜100分＋待機・retry・処理時間。実コストは許可後の小規模pilotで測る。

今回のMLB ingestion HTTP requests / retry / DB read / DB writeはすべて0。許諾前の試験的大量取得もしていない。

## 将来canonical設計の境界

- Team / Player / Gameは `mlb:{kind}:{opaque UUID}`。Provider数値IDをrouteにしない。NPB既存IDは変更しない。
- 内部mappingはprovider namespaceとentity kindを分離。名前ではmergeしない。今回mapping行は作っていない。
- Provider公式Game日付を保持する。JSTや一律New York日付へ暗黙変換しない。suspended / postponedをfinalにまとめない。
- 明示PA、個別BB / HBP、outsRecorded、nullable、二刀流、doubleheaderを保持する。validationはProvider保証に合わせ、NPB validatorをそのまま流用しない。
- 既存の単一pitcher decisionが複数decision同時表現に十分か、許可Sourceの仕様から確認する。曖昧なflagsへ圧縮しない。
- Shared Context / 既存Aggregator再利用は候補。MLB実データのRecent、split、Seasonは未実装。NPBやfixture成績をMLB実績にしない。

Statcast将来案はcanonical Game / PA / Pitch参照、投球sequence、nullable pitch type、速度と単位、位置と座標系、投球前count、結果、provenance。Provider IDsは内部mappingで解決する。配布条件・historical range・取得量は未確定。今回migration / pitch保存は行わない。
