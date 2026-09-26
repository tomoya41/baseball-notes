# Batch A 完了記録 — 2026-09-27

監査基準: 2026-09-27 08:09:29 JST。実データ基準日: 2026-09-26。
この作業はInfrastructure Scheduled運用判定から独立している。手動実行をScheduled成功証拠には使用していない。

## Fact Integrityと修復（報告1–22）

| # | 項目 | 結果 |
|---|---|---|
| 1 | 根本原因 | limited/lookback Player logの不完全Factが、full Game collectionと同じ置換upsertを通り、既存PA/SH/SF等をnullで上書きした。 |
| 2 | 修正前write semantics | Game/Player unique keyの衝突時に、full・limitedの両方でincoming全fieldへ置換。 |
| 3 | 修正後write semantics | fullはauthoritative replace、limitedはinsert-if-missing。既存Factへのlimited更新は行わない。 |
| 4 | full/partial区別 | Repositoryの明示的writeModeとlimited Collector call siteで区別。fullによる実際の訂正・明示null訂正は維持。 |
| 5 | 保護field | 既存Fact全fieldとprovenance。PA/AB/R/H/2B/3B/HR/RBI/BB/HBP/SH/SF/SO/SB/CS/打順/starterを含む。0とnullを区別。 |
| 6 | Pitching | 同じlimited overwriteリスクを同じinsert-only方針で防止。starterのunknownをfalseへ変換しない。 |
| 7 | Schema | migration・table・Fact schema変更なし。API BundleへbatterRoleを追加。 |
| 8 | Repair対象 | canonical Game ID×Player IDで確定した10件。森下翔太5件、近本光司5件。 |
| 9 | 成功 | 10/10。既存full-detail Source 2ページから安全に確認した値のみ採用。 |
| 10 | unresolved | 0。identity追加・統合なし、verified identity mapping変更なし。 |
| 11–13 | 各Player・各日 | 下表参照。SH/SFは全10件ともSourceで0と確認。推測補完なし。 |
| 14 | 坂本誠志郎 | 9/25 DeNA戦 PA3/AB2/BB1を維持。打順8、先発。 |
| 15 | 修復前PA | known508、unknown10。 |
| 16 | 修復後PA | known518、unknown0、known率100%。 |
| 17 | PA=0 | 110件のまま。unknownと混同しない。 |
| 18 | 打順 | valid518、missing0、invalid0。 |
| 19 | limited再適用 | 実際のlimited parser rowsを修復対象へ再適用し、全Fact JSON比較で劣化0件。 |
| 20 | Idempotency | 同じrepairの2回目はchangedFacts0。件数も値も不変。 |
| 21 | completeness | 既存complete Gameを既存validationで再検証。9/23・9/25の証拠と保存Factの不一致を解消。古い未完全収集日を新たにcompleteとはしていない。 |
| 22 | 9/26正常Game | Hawks 4–0 Eagles、Batting23/Pitching7、complete。PA34/33、H9/2、HR3/0を維持。 |

| 日付 | 森下 PA / AB / BB / HBP | 近本 PA / AB / BB / HBP | SH / SF（両者） |
|---|---|---|---|
| 9/20 | 5 / 4 / 1 / 0 | 5 / 4 / 1 / 0 | 0 / 0 |
| 9/21 | 5 / 5 / 0 / 0 | 5 / 5 / 0 / 0 | 0 / 0 |
| 9/22 | 6 / 5 / 0 / 1 | 6 / 5 / 1 / 0 | 0 / 0 |
| 9/23 | 5 / 3 / 1 / 1 | 5 / 4 / 1 / 0 | 0 / 0 |
| 9/25 | 4 / 3 / 0 / 1 | 4 / 3 / 1 / 0 | 0 / 0 |

修復前後ともGames40・Batting518・Pitching161・Source mappings384。Batter starter330/substitute188/unknown0、Pitcher starter36/reliever125/unknown0。
9/25公開Game DetailはDeNA2–1阪神、PA33/36、H8/5、HR1/1、Batting27/Pitching5、complete。Team PAは個人打撃Factから表示可能になった。
公開30d集計も確認済み: 森下6試合/PA30/OPS.783、近本6試合/PA30/OPS1.513。PA/SH/SF/OPSのMetric Statusはcomplete。修復による公開値・可用性の変化は欠損Factの正常化によるもので、計算式変更ではない。Period Coverageは引き続きunknown。

安全性のためlimitedはfield patchではなく既存行を一切変更しない。limited内にnon-null値があっても、それだけではfull記録の訂正根拠にならないため採用しない。limitedで初めて挿入した不完全行を改善する場合もfull-detail経路を使用する。この制約を隠していない。

## Analysis基盤と実データ（報告23–36）

| # | 項目 | 結果 |
|---|---|---|
| 23 | Context | Player identity、asOfDate、30日batting/pitching Fact＋Game metadata、7/14/30 Coverage。Application内で共通readerを各projectionへ渡す。Raw FactsはClientへ送らない。 |
| 24 | 統合前 | 過去の独立HomeAway/Opponent経路は各約9 SELECTという設計だった。タスク開始時checkoutにはBundle共通化・打順・投手roleが既に実装されていたため再作成していない。 |
| 25 | 統合後 | 実測Bundle Service7 SELECT、APIは最新standings1 SELECTを加えて計8。今回のbatterRole追加は+0 SELECT。条件数に比例したFact readなし。 |
| 26–27 | Regression | 中島・坂本・佐藤・上原で、公開の独立期間比較/HomeAway/Opponent APIとBundleを比較し、calculatedAt以外の全結果が一致。Metric Status/Coverageも一致。 |
| 28 | 打順 | 保存済み1–9のみ分類。unknownは別診断。Selectorは1→9、初期値は最新記録。率は既存aggregateBattingで算出、Sample G/PAと30日classified Totalを表示。 |
| 29 | multi-order | 中村晃: 3/7/9番。初期7番。公開Selectorを3番へ変更するとOPS .000→1.000、PA1→2。各打順1試合、計3試合/PA4。 |
| 30 | 打者role | 保存nullable starter=trueを先発、falseを途中出場、nullをunknown。中島・坂本・佐藤は先発のみ、中村は途中出場3試合/PA4/OPS.500。0PAもGに含む。 |
| 31 | 投手role | 既存canonical helper・aggregatePitchingを維持。上沢直之: 先発1/GS1/IP6.0/BF22/ERA1.50/K9 12.0。鈴木昭汰: 救援3/IP2.2/BF13/ERA6.75/K9 6.75/HLD1/SV0。両role Playerは実データになくfixtureで検証。 |
| 32 | 中島大輔 | 3試合、すべてビジター・1番・先発、PA16/AB15/BB1/OPS.321/AVG.133。Opponentは日本ハム・ソフトバンク。 |
| 33 | 坂本誠志郎 | 2試合、ビジター・8番・先発、PA7/AB5/BB2/OPS.829。対DeNA。9/25単独PA3/AB2/BB1を維持。 |
| 34 | 佐藤輝明 | 3試合、ビジター・4番・先発、PA14/AB9/BB4/OPS1.571。OpponentはDeNA・ヤクルト。複数打順なし。 |
| 35 | 上原健太 | 2登板すべて救援、4outs=IP1.1、BF6/H2/SO2/ER0/27球、ERA0/K9 13.5。先発Empty、打順UI非表示。 |
| 36 | 早川隆久 | Fact0。Profile identityを維持し、分析Empty。Mock fallbackなし。 |

全打順Fact件数: 1番48、2番45、3番54、4番41、5番39、6番51、7番54、8番61、9番125（計518）。
打順とroleのCounting Stats合計はclassified Totalと整合するfixtureを追加。分類不能のFactは黙って捨てない。率を足してTotalにする処理はない。
打者は全count/rate、投手はappearances/GS/outs/BF/H/HR/SO/R/ER/pitchCount/W/L/HLD/SV/ERA/K9を既存Aggregatorから提供。WHIPは既存Aggregatorのunavailable値のままで、新規算出・比較・UI表示には使用しない。
Coverageはsplitごとに新設せず既存30dを共有し、unknownを明示。Metricのpartial/unavailableを完全値として扱わない。

## 性能・UI・検証（報告37–54）

公開Vercel API Server-Timing（ms）。最初のstandings queryとサーバー開始処理はAPI totalには含まれるがContext dbには含まれない。HTTP/CDN cacheのある取得ではClient時間と生成時Server-Timingは異なる。

| Player | DB read | Context | Partition | Aggregation | Serialization | API total | Response bytes |
|---|---:|---:|---:|---:|---:|---:|---:|
| 中島大輔 | 773.4 | .02 | .51 | 38.6 | .34 | 2013.0 | 61,122 |
| 坂本誠志郎 | 798.7 | .03 | .48 | 20.2 | .40 | 2056.7 | 56,850 |
| 佐藤輝明 | 763.2 | .02 | .40 | 42.7 | .36 | 1904.6 | 61,072 |
| 上原健太 | 774.7 | .03 | .67 | 21.4 | .35 | 1930.2 | 48,717 |
| 早川隆久 | 770.2 | .03 | .40 | 15.8 | .16 | 1870.5 | 19,039 |
| 中村晃 | 775.3 | .03 | .57 | 41.3 | .78 | 1922.0 | 76,856 |

GitHub read-only検証ではDB read338–604ms、projection1–14ms。追加roleで固定Query数は変化しない。Payloadには集計と既存Coverageの重複があり、Raw Factを送っていないが将来compact化余地はある。性能は従来の約0.8–3秒範囲に収まる。

| # | 項目 | 結果 |
|---|---|---|
| 37–41 | 性能 | 上表。Context・partition・aggregation・serialization・API totalを個別計測。 |
| 42 | 360px Light/Dark | 公開PagesのLightを目視。Darkは同じ公開build/APIと実際の既存Dark CSS変数を使用するローカル検証harnessで目視。OS設定は変更していない。横はみ出しなし（viewport360、content345）。 |
| 43 | Accessibility | native details/summaryをEnterで開閉、label付きselect切替、role別group/heading、数値とSampleを文字で表示。summary/detailは48px touch target。色のみの比較なし。 |
| 44 | Tests | 34 files / 259 tests PASS。full→limited null/non-null、0/null、full訂正、pitching保護、role/zeroPA、shared fetch、既存HomeAway/Opponent/Game Log/敬遠等を含む。 |
| 45 | lint | PASS。 |
| 46 | typecheck | PASS。 |
| 47 | build | PASS。既存の500KB超bundle警告は残る。 |
| 48 | Vercel build | npm run vercel-buildおよび本番build PASS、production READY。 |
| 49 | Pages | 下記Publish Run success。公開HTTP200、最新assetsで新UI表示。 |
| 50 | Turso write | canonical pairで指定した10 Batting Factのみfull-detail値へ修復。2回目変更0、limited replay変更0。Games/Pitching/Mappings件数不変。AnalysisはRead-only。 |
| 51 | schedules | Daily/Freshness/Backup schedule変更なし。manual-only repair workflowを追加。 |
| 52 | HOT | Engine/Payload/Home ranking logic変更なし。修復後の自然な集計値変化のみ許容。公開Gateを開いていない。 |
| 53 | Scheduled proof | Repair/Backup/Pagesすべてmanual evidence。Scheduled成功とはしていない。 |
| 54 | Infrastructure | 今回再判定していない。別トラックのNO判定を置換しない。 |

BundleはprojectionごとにPromise.allSettledでready/errorを返し、1splitの失敗で全Resultを消さない。共通Fact read失敗は共通取得errorとして扱う。Loading/Empty/ErrorはMockへfallbackしない。最近の成績→条件別(HomeAway/Opponent/打順/出場形態)のaccordion構成で、打順は打者のみ。

## Runと公開先

- [Repair dry-run](https://github.com/tomoya41/baseball-notes/actions/runs/36278444182): success。
- [Repair + second repair + limited replay + audit](https://github.com/tomoya41/baseball-notes/actions/runs/36278516070): success。
- [Portable Export / Scratch Restore / Repository readback](https://github.com/tomoya41/baseball-notes/actions/runs/36278737218): schemaVersion4、PASS。
- [Pages publish](https://github.com/tomoya41/baseball-notes/actions/runs/36278735659): success。
- Vercel production deployment: `dpl_GfKfno5ezGMZUqpsvtfQWgqgJ4bY`、READY。
- [公開Player Analysis](https://tomoya41.github.io/baseball-notes/#/NPB/players/06a3e027-7a73-4792-9c91-8ecc3c1da36a/analysis)
- [公開Analysis API](https://baseball-notes-recent.vercel.app/api/npb/analysis-bundle?playerId=06a3e027-7a73-4792-9c91-8ecc3c1da36a)

## 最終Gate（報告55–58）

55. **partial collectionがverified Factを再劣化させないか: YES**。今回の明示limited persistence経路では既存行を変更しない。authoritative fullによる正当な訂正は別経路として維持。
56. **同じ30d Factを再取得せずAnalysisを拡張可能か: YES**。共通Context内のprojection追加で対応できる。
57. **次BatchのProduction HOT/Rankingへ進める状態か: NO**。Fact IntegrityとAnalysis基盤は完了し、Coverage/Backfill計画には進めるが、現状の不足Coverage・別トラックのScheduled運用証拠を満たさずにProduction Gateを開くことはできない。
58. 残blocker: 最新7d Coverageはcomplete4/unknown3、30dはcomplete4/unknown26。シーズン網羅性と無人Scheduled成功証拠は別途必要。appearance order・pitch-level・Direct BvPも未保存であり、本Batchでは補完していない。次の最小タスクはSeason Coverageの不足日棚卸しと、安全なBackfill対象・Source能力・運用証拠の計画化。次Batchを自動実行しない。
