# NPB Historical — Source assessment and first admission

確認日 **2026-10-15 JST**。Baseline `0f341356ea1b18069f81392d8285be01cbdf935b` / PR #32。SPEC、Completion Inventory、Source/Rights Audit、NPB Season/Recent/Publication contractsと現行コードを確認。追加支出・登録・問い合わせ・契約は **0**。

## 結論

**Wikipediaの既存APIアーカイブから、2015–2025の球団別年度集計を部分収録する。** 出典revision・著者へのリンク・変更表示・CC BY-SA 4.0を維持する。全選手一覧、公式ランキング、全Career、球団Season総計、Game/Recent/PAを得たとは扱わない。既存2026集計に足し込まない。

2023–25のリーグ全選手を一括導入できる、公開条件まで確認済みの無料/予算内datasetは今回確認できなかった。これはWeb上の全候補の不存在や、客観的数値の利用がすべて禁止であることを意味しない。部分収録できるB候補を実装し、C/D候補の再収集は行わない。

## 1. 判定と法的・契約上の境界

- A: 当該取得・保存・公開方法に十分な根拠。B: 守れる条件付き。C: 重要な条件が未確定。D: 予定する方法が明示制限に反する。
- [著作権法](https://laws.e-gov.go.jp/law/345AC0000000048)第2条1項1号・第10条2項、第12条の2を参照。事実/数値そのもの、創作的な表現、データベースの選択・体系的構成を区別する。記事の事実が保護されないことと、サイト全体の体系的複製や利用契約の可否は別。
- 文化庁の権利制限をWeb/Android再配布への包括許可としない。私的使用・学術目的・非享受の研究と、ユーザーが成績を閲覧する公開アプリは別用途。
- APIやrobotsの技術的許可、GitHubのコードlicense、低価格の閲覧会員を、上流データの公開許諾に置き換えない。逆に、明示licenseがないだけで個別事実の参照をすべてDともしない。
- 判断は以下の**予定用途**について。法的判断の完全な保証ではない。Cは理由を列挙し、今回の本番利用を保留する。問い合わせは送らず、文案も作らない。

## 2. Source / cost / coverage matrix

URLは2026-10-15確認。年数は資料・release名で確認した範囲で、各年の完全性を保証しない。ログイン不要の公開資料のみ調査。未採用候補の成績本体は一括downloadしていない。

| Source / 運営・由来 | 年度・粒度・identity | 費用 / 方法 | 判定・具体的理由 |
|---|---|---|---|
| [日本語Wikipedia](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use#7._Licensing_of_Content) / Wikimedia・執筆者 | 選手記事のNPB一軍年度別投打表。選手により期間/表形式が異なる。既存NPB ID + Wikidata ID + canonical bridgeで照合 | ¥0、[Action API policy](https://www.mediawiki.org/wiki/API:Etiquette)。今回は既存667記事の取得済みrevisionをoffline replay、新規記事取得0 | **B・採用**。§7のCC BY-SA、著者/原記事・revision・変更・licenseを表示。表の数値のみ。転載疑惑等のwarning、未対応表、矛盾は除外。写真・記事本文・Game/公式通算は使わない |
| [Wikidata](https://www.wikidata.org/wiki/Wikidata:Licensing) / community | CC0 structured identity/profile、外部ID。年度別打撃/投球を網羅するSourceではない | ¥0、documented API/dumps | **A・既存identityのみ**。外部IDはリンク先サイトのdata reuse許可ではない。今回はclaim追加0 |
| [NPB公式年度別](https://npb.jp/bis/yearly/)・[2025](https://npb.jp/bis/2025/stats/)・[選手例](https://npb.jp/bis/players/41045153.html) / 日本野球機構 | 1936以降の年度index、個人年度/通算、球団、Game等。詳細の全量coverage未検証。独立NPB選手IDあり | 閲覧¥0、再利用料金不明。公開HTML | **D・無許可のsystematic保存/再表示案は不採用**。選手ページ末尾に情報等の二次利用/無断転載禁止を実確認。客観的な個別数値自体が一律著作物という断定ではない。診断用の少量閲覧だけを使用。問い合わせなしで全DB利用の十分な根拠は今回得られず |
| [nf3](https://nf3.sakura.ne.jp/)、[2025](https://nf3.sakura.ne.jp/2025/index.html) / えるてん、参考サイトから独自集計 | 過去年のSeason・Game・投打log候補。既存Source IDは年度/球団/背番号pathなので年度横断同一人を保証しない | 閲覧¥0、公開HTML。API/SLAなし | **C・新年度採用保留**。免責・独自再計算の説明は保存/公開の包括許可ではない。既存2026 provisionalの範囲を拡張しない。2028-01-24閉鎖予定リスクを継承 |
| [baseball-data.com](https://baseball-data.com/about.php) / データFreak | 過年度の投打/球団/profile。別候補の作成元資料では2015–25 | 閲覧¥0、HTML。公開APIなし | **C**。aboutに自由リンクの説明はあるが、体系的取得・保存・公開DBの条件は確定せず。リンク可を複製許可にしない。数値の独立利用の余地と、DB複製の採否を分離 |
| [Nippon Baseball Data Repository](https://github.com/armstjc/Nippon-Baseball-Data-Repository) / Joseph Armstrong、主にSPAIA由来 | Release名でGame stats/PBP 2019–26、roster/schedule/standings 2018–26、Draft 2004–25。CSV/Parquet/JSON。API docs風のendpoint表はSPAIAの公式public API許諾ではない | ¥0、GitHub Releases（metadataのみ検査） | **C**。READMEはコードMITとデータのcredit要求を別記。作者のdata reuse意向は確認できるがSPAIA/第三者の再許諾権限、取得契約との関係が未確定。元サイトを避けてreleaseを読むだけで解消したとはしない |
| [npb-prediction](https://github.com/yasumorishima/npb-prediction)、[DATA_SOURCES](https://github.com/yasumorishima/npb-prediction/blob/main/DATA_SOURCES.md) / yasumorishima | 2015–25投打CSV、詳細打撃・球団等。dataFreakとNPB公式をHTML取得。名前中心の行をcanonicalへ直接merge不可。予測値は実績ではない | ¥0、GitHub公開。文書に打者3,780/投手3,773行の説明（本体未検証） | **C**。rootにdataset再配布を明確化するLICENSEを確認できず。creditは上流条件の代替でない。モデル予測/独自補正は成績Factsに採用しない |
| [SPAIA利用規約](https://spaia.jp/terms) / グラッドキューブ・licensed providers | NPB年度/選手/Gameデータ。公開範囲の正確な年数は未確認 | 一部閲覧¥0、再利用feed料金不明。内部endpointは利用しない | **C**（将来商用無許可転用は**D**）。§7(11)商業利用制限、§9の利用許諾と知財使用許諾の区別。無料endpoint発見だけでは保存/再配布権を満たさない |
| [Ramos-Ramos/npb](https://huggingface.co/datasets/Ramos-Ramos/npb) / contributors | metadataで2024/2025等のGame/PA CSV。revision `9764a85ab1b57c0136767104f8cb6a87410699c9`。選手ID/元Source/完全性未検証 | ¥0公開metadata API。データ本体未取得 | **C**。API metadataにdata license/cardを確認できず。Hugging Faceの公開hosting条件はdataset licenseではない。原取得元・権利連鎖不明 |
| [wocchi09/npb-data](https://github.com/wocchi09/npb-data) / wocchi09 | NPB/Yahoo由来の2026中心、profile年度/通算。研究・個人用途の説明。全Historicalのrelease保証なし | ¥0公開repo | **C**。READMEの加工結果公開推奨は上流許諾でない。公開アプリを許すdataset license/取得契約を確認できず |
| [dentearl/npb-data](https://github.com/dentearl/npb-data) / dentearl | READMEで2021–26 Regular日程/結果・順位、NPB公式から取得。player statsは対象外 | ¥0公開JSON | **C**。コード/データlicense・上流再利用条件を確認できず。READMEの各年858試合保証は独立品質検証をしていない |
| [nyk510/baseball-dataset](https://github.com/nyk510/baseball-dataset) / nyk510 | NPBデータ取得module、第三者サイト由来。現在の2023–25完全dataset・独立IDを保証しない | ¥0公開repo | **C・今回は不採用**。取得コードの公開とdataの再利用条件を分離。上流契約・品質根拠不足 |
| [2010 NPB dataset](https://www.japanesebaseball.com/forums/17/64293) / Michael Eng | 2010のGame/roster/PA/pitch/ID、Yahoo等をscrape/copyと本人説明。欠損/誤りを明記 | ¥0、旧Google Docs配布リンク（実データ未取得） | **C**。BY-NC-SAという配布意向はあるが、上流許諾・欠損・古いdownload継続性・将来収益化の制限が未解決。NCをcommercial可としない |
| [Data Stadium](https://datastadium.co.jp/academic-data)、[札幌CKAN掲載](https://ckan.pf-sapporo.jp/dataset/baseballdata) / データスタジアム | 年度/試合/プレー等の法人・学術供給。対象年・fieldsは契約確認 | **有償・価格非公開**。¥5,000買切/¥1,000月額以内と確認できず | **C**。学術向け販売を個人公開app licenseとしない。問合せなしで購入条件を確定できず、未購入 |
| [野球DB PRO商品案内](https://sij.co.jp/product/detail/id=753)、[規約](https://jp.yakyudb.com/tos/) / SIJ | 2005年以降Game/全打席・名鑑/通算という案内。閲覧用途 | 商品案内は**月額100円・税別**（当該ページの表示。現在の決済額/課金継続条件は未検証） | **D・当該閲覧プランの無許可公開利用は不採用**。有料規約は私的使用外・二次創作に許諾を要する。無料ページへの適用を一律断定せずC。今回問い合わせ・課金なし |

最大3候補の比較では、**即時採用はWikipediaのみ**。次点のNippon Repositoryは粒度・公開形式が有用だが上流権利がC、nf3は既存互換性が高いが範囲/長期継続性がC。無理に3つ採用しない。Wikidata/Chadwickはidentity補助で成績Sourceの代替ではない。

## 3. 操作ごとのRights matrix

「不明」は禁止と断定せず、今回のProduction実施を保留する意味。公開WebとAndroidの利用条件を同じdata licenseの範囲で評価し、写真/商標はすべて別。

| Source / 予定用途 | 自動取得 | private保存/backup | 加工/派生統計 | Web / Android表示 | Raw再配布 / 収益化 | attribution / 終了時 |
|---|---|---|---|---|---|---|
| Wikipedia記事の年度表 | API policy内で条件付き。今回は再取得0 | CC BY-SAで可 | 抽出/正規化・再集計可、変更表示 | 条件付き可 / 可 | license条件下で可。今回は数値集計だけ公開、本文dumpなし。commercialもlicense上可 | 著者の分かる原記事revision・license・変更。データ層をCC BY-SA、appコードのlicenseを変更しない。pin済みlicenseは規定に従い継続 |
| Wikidata structured data | documented API条件 | CC0で可 | 可 | 可 / 可 | 可 | 出典は保持。linked media別 |
| NPB公式systematic mirror | 明示grantなし | 予定用途は不採用 | 加工だけで制限を消さない | 無許可の二次利用は不採用 | 不採用 | 少数の診断閲覧/リンクとmirrorを分離 |
| nf3過去年度・dataFreak | 不明 | 不明 | 不明 | 不明 / 不明 | 不明 | creditのみで許可化しない。サービス終了後の保持条件も不明 |
| Nippon Repository / npb-prediction / HF / その他GitHub | 配布metadata閲覧とdata取得を分離 | 上流条件不明 | 不明 | 不明 / 不明 | 不明 | 作者のcredit/コードlicenseを上流権利まで拡張しない |
| SPAIA | 正式public API grant未確認 | 不明 | 不明 | 不明 / 不明 | 無許可commercial制限 | §7/9、第三者licensed content、終了条件のapp用途は不明 |
| Data Stadium / SIJ閲覧 | 契約による / automation未確認 | 個別契約 / 閲覧を越える保存未許諾 | 個別契約 / 二次創作要許諾 | 個別契約 / 閲覧契約だけでは不可 | 別条件、購入しない | 再利用料金・契約終了後の保持は未確認 |

robotsは今回の採用根拠にしていない。新collectorを作らず、既存Wikipedia APIアーカイブをreplayする。将来更新時はUser-Agent、serial/batch request、cache、maxlag、429/Retry-Afterを守る。robots許可をlicenseと呼ばない。

## 4. Data Contract・identity・import

`src/domain/npb-historical.ts`はCurrentの`npbSeasonPayloadSchema`と別contract。`league=NPB / temporalScope=historical / competition=regular / granularity=season_aggregate / coverage=partial`を固定。2026を拒否。row keyは `(playerId, season, teamId, role)`、同年移籍は別行。通算行・NPB以外・国際大会表は解析しない。

| 種類 | 今回 |
|---|---|
| A Historical Season Aggregate | 2015–25の検証済み球団別年度行、nullable metrics |
| B Historical Game | 未導入。年度表から生成しない |
| C Historical Game Facts | 未導入。Game/PA/Recent/登板roleを捏造しない |
| D Historical Team | 行ごとの当該年度球団IDのみ。球団W/Lや全所属rosterを生成しない |
| E Historical Player Metadata | 既存canonical橋 + 記事名/NPB ID/Wikidata ID。年を越えて最新所属を付与しない |
| F Career Aggregate | 未導入。UIの合計は選択年度・収録球団行の範囲のみ |
| G Coverage / Provenance | global partial、archive hash、revision/timestamp/content hash、license/transformation。Current publication proofとは独立 |

`parseWikipediaHistorical`は明示NPBテンプレート、column count、year/team cell、rowspan、厳格な数値表記を扱う。未対応表・不明球団・複雑なセル・同一scope重複をquarantine。invalid spanning row以降は推測せずtable処理を停止する。先に検証済みの行はその球団別rowとして残すが、完全な年度総計とは呼ばない。

IPは整数outsへ変換（例150.1→451 outs）。BBとIBBを二重加算せず、HBPをBBへ混ぜない。AVG/OBP/SLG/OPS、ERA/WHIPの成分を照合し、不一致を拒否。合計は率を平均せず成分から再計算し、一つでも必要値不明なら率をnullにする。Current NPB WHIP capabilityを開かず、今回の画面は既存AVG/OPS/ERA等を主表示する。

source tableが算術整合することは公式記録全量との独立照合完了ではない。手動spot checkは[佐藤](https://npb.jp/bis/players/41045153.html)・[牧](https://npb.jp/bis/players/13115153.html)・[宮城](https://npb.jp/bis/players/71875151.html)の2023–25代表値を少量の研究閲覧で確認。NPB本文やtableを新しい入力datasetには使用していない。

## 5. Admission・容量

入力archive `.data/npb-free2/wikipedia.json` は既存の667 verified bridgesと一致。取得時刻2026-10-02T22:34:47.574Z、SHA256 `0c0a312ecc4d65c582a0e203df316f590209d31849184a53b4f75bfe75c976f7`。今回の統計parser/rights審査は2026-10-15。取得日と審査日を同一にしない。

| 年 | 打撃行 | 投球行 |
|---|---:|---:|
| 2015 | 38 | 25 |
| 2016 | 51 | 25 |
| 2017 | 66 | 39 |
| 2018 | 80 | 46 |
| 2019 | 95 | 56 |
| 2020 | 117 | 61 |
| 2021 | 133 | 71 |
| 2022 | 169 | 81 |
| 2023 | 175 | 91 |
| 2024 | 202 | 96 |
| 2025 | 224 | 119 |

計444 canonical選手・2,060行。Game追加0、canonical DB/Facts/identity mapping追加変更0。**2026現役universeの既存橋だけ**なのでOB全員の収録ではない。archive667人のうち当該期間の採用行なし223人を未照合や出場なしとは分類しない。232 issuesはplayer数とは異なる。未対応数値142、表形式52、WHIP差10等。非公開quarantine reportに理由を残す。

scratch SQLiteはメモリ内の専用aggregate table。2回insert→全行readbackを比較して重複なし。canonicalへの接続/認証/writeは不要。今回本番DBへのbackup/restoreや新規migrationは実施しない。

実測：変換319ms、正規化JSON 785,125 bytes、公開release gzip 144,138 bytes、SHA256 `03a51fb6c39c31dedcf72e2e2d013f61bf637b96f9c3924e41dc8b392a3c5047`。配信用は11年+manifestの12 JSON、合計1,296,458 bytes、最大206,726 bytes。Gitにはdata本体/生成物を追加せず、pin metadata・コード・検証・docsのみ。GitHub releaseに許された数値集計を置く。raw記事/画像/Chadwick full dumpなし。

## 6. Product / delivery boundary

`/NPB/history?season=2025`から年度・投打・球団・名前、30選手/page、2–4人の収録分比較。同一canonical選手は最大4年度の推移と選択範囲合計。Playerの操作メニュー、既存Search/Data Explorerのhistory導線から接続。Profileへの戻り先は明示的に2026年と表示し、過去数値をCurrentタブへ誤って渡さない。

初回はmanifest+選択年の2 payload、比較時は追加で最大4年度（選択中の年度は再利用、異なる4年を選んだ最悪時はmanifest込み6取得）。全profile/PA fetchなし。Home追加fetch0、初期JSへ成績datasetをbundleしない。既存Public Response Cacheへschema/identity/hash検証後だけcommit。Web/Androidで同じreaderを使い、Android shellへHistorical DBをbundleしない。

`npm run build`はpin済み小型releaseをSHA検証し、年別公開JSONを生成する。checksum付きローカルcacheを再利用でき、ビルド時にWikipediaへアクセスしない。どの既存Pages workflowからbuildしても新しいHistoricalが消えない。

既存Player Directory publish workflowに`preserve_published_only`を追加。trueではDB・Source取得・profile再投影をskip、CurrentのgeneratedAtを更新せず既存公開familyとMLB archiveを維持。repairやHistorical追加をScheduled Fact証拠にしない。

2026 Current HOT/Rankingは非公開のまま。2026 pending6/partial5の最終確認済み値を変更する操作なし。**最新scheduled freshness run 38705013529はTursoがSQL readをBLOCKEDとして失敗**。現在のremote DB再readbackはできないので、最新canonical count/integrity PASSとは報告しない。料金変更・retry大量実行・staleのhealthy化を行わない。

## 7. 再現方法・rollback・次の範囲

```powershell
npx tsx scripts/import-npb-historical-wikipedia.ts .data/npb-free2/wikipedia.json .data/npb-history-pilot
npx tsx scripts/stage-npb-historical.ts --input=.data/npb-history-pilot/npb-historical-wikipedia.json.gz
npm run check
```

archive本体はこの公開repoに同梱しない。既存archiveがない環境ではpin済み派生releaseからbuildできる。Dataset revisionが変わる場合は新release/hash/再検証が必要で、無断で同tag assetを上書きしない。

Rollbackは今回のapp/build変更をrevertし、独立`data/npb/historical` familyを次のartifactから外す。canonical migrationなし。Current/MLB/persistenceは触らない。

次はquarantineの表形式を個別に確かめ、既存記事から同一基準で追加できる行を増やす。その後OB identity橋を独立証拠付きで追加する。未採用datasetのlicenseを流用した全量import、2026 Gate解除、公式Career/歴代ランキング化は行わない。

最終のtests/build/実画面/PR/公開結果はdelivery追補へ記録する。設計資料を実施済みQAの代替にしない。

公開前自己監査: 投手表の無四球欄は `noWalkGames`（無四球試合）と明記し、quality start等と混同しない。先行prereleaseの曖昧なkeyをv2で訂正し、旧assetは上書きしない。採用pinは `npb-history-wikipedia-20261015-v2`。既存Facts・数値・件数には変更なし。

### Review修正

PR #33のCodex ReviewでP1（比較カードが検索/年度/pageの外にある場合に個別著者・revision creditが欠落）が指摘された。選手比較と年度比較/合計に、それぞれ独立した出典欄を追加。検索で全カードが消えるケース、選択選手が当該年度にいないケースを回帰テストで固定。出典修正前の状態でPagesへ公開していない。

新しいAndroid instrumentation項目はHistorical deep link、partial文言、年度合計、出典link、150%/200%の実OS fontScaleと横overflowを検証する。公開後にemulatorで実行するまでPASSとは扱わない。今回のAPKを接続Pixelへ再インストールした/物理端末で新Historicalを確認したとは報告しない。
