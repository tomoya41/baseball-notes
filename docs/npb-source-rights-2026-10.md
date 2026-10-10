# NPB Source / Rights Resolution — 2026年10月

確認日：**2026-10-10 JST**。基準：最新main `20d0e6084faa5c543ea1b467726a7b5a21794211`（origin/mainと照合）。[Product Completion Inventory](product-completion-inventory.md)とその追補、[SPEC](../SPEC.md)、[decisions](decisions.md)、既存Source資料、provider・competition validator・Capabilities・workflowを確認した。

本書は**Source / Rights Audit**。collector、scraper、PoC、DB migration、Product UI、public payload、Production Gateは変更していない。契約・無料trial登録・問い合わせ送信もしていない。追加月額費用は**¥0のまま**。以下の外部資料は特記がない限り同日に閲覧した。記載価格は閲覧プランとデータ利用許諾を区別する。

## 1. Executive Summary

**新しくNPB Current Postseason・日次Transactions・Historical/Career全量を取得・保存・公開できる、無条件の無料Sourceは確認できなかった。** データの所在は確認できたが、公開アプリの利用許可、取得方法、完全性のいずれかが不足する。

| 結論 | 現時点で可能な範囲 / 次の判断 |
|---|---|
| GREEN | WikidataのCC0構造化データ、条件を満たすWikipedia由来データ。個別プロフィール・identity・確認できる履歴等の補完に限定。日次公式feedや全Season Statsの代替ではない |
| 最優先の許諾候補 | **SIJ / 野球DB**。低価格の閲覧案内はあるが、アプリ公開には別途許諾が必要。NPB Current Postseason、年度別・Game単位成績、継続保存、公開JSONの可否を一括で確認する |
| 公式情報の所在 | NPB公式にCS日程・Game投打成績・公示・年度別成績・オープン戦資料が存在。しかし二次利用禁止の表示があり、今回のProduction収集は許可待ち |
| 限定的な低コストAPI候補 | TheSportsDBの有料開発プラン。NPB日程・結果の候補だが、Player Stats・全Round・完全性・静的再配布は未確認。無料APIは公開ストアアプリへ使えない |
| 法人候補 | Data Stadium、Sportradar、Stats Perform、Goalserve、DELTA Premium。NPBの対象粒度と利用権を契約で確認。安価な閲覧会員の代替として自動採用しない |
| nf3 | 現行Regularの**provisional**を維持。新規範囲の権利はUNKNOWN。運営者は**2028-01-24閉鎖予定**を公表しており、代替は期限付きの課題 |
| 新たなContract上の確認事項 | **2026 CS Finalは条件付き2勝アドバンテージ・最大7試合**。現在の1勝限定validator等は、許諾後のNPB接続時に追加対応が必要。今回は変更しない |

優先する次Trackは **NPB Current Competition Completion**。ただし今すぐcollectorを作るのではなく、先にSIJ・NPB/権利窓口へ対象範囲の許諾を確認する。許諾待ちの間、既存のrights-clearedプロフィール・履歴補完は独立して進められる。

## 2. 判定方法・調査の境界

| 分類 | このプロジェクトでの意味 |
|---|---|
| GREEN | 指定したデータ・用途に限り、現在の条件で取得・保存・加工・公開が成立する。品質・identity確認は別途必要 |
| YELLOW | 許諾窓口、API利用規約、または契約経路があるが、このアプリの用途・上流権利・対象範囲の確認が必要 |
| RED | 現行閲覧/開発プランをそのままProduction Sourceとして使わない。個別許諾後の再評価まで禁止 |
| UNKNOWN | 再利用条件、適用範囲、上流権利の証拠が不足。許可された扱いにしない |

分類はSource全体の抽象的な合法性ではなく、**本アプリのsystematic ingestion・継続保存・加工・公開表示/JSON**に対する採否。公開された個々の事実が一律に著作物である、という法的断定ではない。引用・リンク・私的閲覧の可否と、データベースとしての取得/再公開を分ける。

robots許可、API key、購読、手入力、Codexによる目視転記、非営利運営のどれも、再利用許諾の代替ではない。原本からderivedに加工しても、契約の公開制限が自動的に消えるとは判定しない。human reviewはidentity/date/definitionの品質確認であり、rights回避手段ではない。

調査は公開の規約・料金・サービス案内・代表ページの閲覧とrobots metadataの有限GETのみ。会員ページ、非公開endpoint、全選手/全試合の収集、認証API呼び出しは行っていない。JS依存で本文が得られないページ、API競技別coverage、ログイン後価格、契約条件は未確認と明記する。全WebにSourceがないことを証明する調査ではない。

### 2.1 現行実装から継承する境界

- NPBは保存済み2026 Regular、MLBは2020–2025 Historical Regular/Postseason。MLB Currentへ調査範囲を拡張しない。
- 現行Directory universeは739選手。identity bridge 667、未照合72、Human Review Queue 400は別Data Quality Track。過去バッチの735人を最新人数として使わない。
- current uniform number・current registration class・明示的NPB debut/join yearには不足がある。latest stored affiliationを現在のroster証拠にしない。
- NPB Postseason Capabilitiesは `Unavailable / Source rights pending`。HOT/Ranking/Infrastructure Scheduled証拠は独立。今回再判定しない。
- 既存Regular Fact、雨天partial、canonical ID、MLB semantics、プロフィールprovenance/CC BY-SA層、NPB Export制限を維持する。

## 3. Source Matrix

`不明`は未確認であり、許可・禁止・不存在を推定しない。更新頻度は公表/ページ上の性質でありSLAではない。歴史の年数は記載資料の範囲で、全Player/Gameの完全性を保証しない。

| ID / Source・運営者 | 一次資料 / 対象 | Current / Historical / 更新 | public access / login | API / rate limit | 安定性・終了risk / current usage |
|---|---|---|---|---|---|
| S01 nf3 / 個人運営えるてん | [index](https://nf3.sakura.ne.jp/)、[公示履歴](https://nf3.sakura.ne.jp/Stats/kouji.htm)、[2025](https://nf3.sakura.ne.jp/2025/index.html) | 2026 Regular、CS概要。過去年あり、完全範囲未確定。手集計更新 | 公開 / 不要 | 公開API・数値制限は不明 | 個人・二次Source・SLAなし。現行Regularのみprovisional。閉鎖日が公表済み |
| S02 NPB公式 / 一般社団法人日本野球機構 | [CS](https://npb.jp/games/2026/info_cs.html)、[公示](https://npb.jp/announcement/2026/)、[年度別](https://npb.jp/bis/yearly/) | Current・過去成績/名簿/公示。年度index 1936–2026。試合/公示ごと更新、SLA不明 | 公開 / 基本不要 | 一般開発者用の公開data API・rateは未確認 | 公式証拠として優先。HTML/URL変化risk、app reuse契約なし。新規収集なし |
| S03 12球団公式 / 下表 | 選手・球団発表・schedule・camp | 当該球団Current中心、historyはサイト別。発表/試合単位 | 公開news等は基本不要、会員コンテンツは別 | 公開data API・rateは未確認 | 再編/退団時ページ消失、12社別許諾。新規収集なし |
| S04 Wikidata / Wikimedia Foundation・community | [Licensing](https://www.wikidata.org/wiki/Wikidata:Licensing)、[Data access](https://www.wikidata.org/wiki/Wikidata:Data_access) | Profile・外部ID・個別履歴claim。community更新、NPB全集保証なし | 公開 / 読取基本不要 | documented API/SPARQL/dumps。入口別制限、429/Retry-After、UA/maxlag等 | CC0の既存採用。値・qualifier・reference・identity確認が必要。Query service負荷risk |
| S05 Wikipedia / Wikimedia Foundation・community | [Terms §7](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use)、[API etiquette](https://www.mediawiki.org/wiki/API:Etiquette) | 個別profile/所属/移動等。revision単位、Current即時/完全性保証なし | 公開 / 読取基本不要 | MediaWiki API、UA/負荷制御。共通の固定req/minは不明 | 既存CC BY-SA provenanceを維持。削除/修正/矛盾risk。画像は別ライセンス |
| S06 SIJ / 株式会社エス・アイ・ジェイ | [商品案内](https://sij.co.jp/product/detail/id=753)、[野球DB案内](https://jp.yakyudb.com/about/)、[規約](https://jp.yakyudb.com/tos/) | 無料profile/通算等、PRO 2005年以降Game/打席/スタメンを案内。日次更新の説明、競技別完全性は未確認 | 無料部分公開 / 詳細は会員課金 | 公開API・export・rateは不明 | [2026更新告知](https://sij.co.jp/news/detail/id=778)あり。ただし全2026試合更新を未検証。料金・購読期間の説明差あり。未採用 |
| S07 DELTA / 株式会社DELTA | [プラン](https://1point02.jp/op/reg/guide_reg_description.aspx)、[規約](https://1point02.jp/op/service.aspx)、[特商法](https://1point02.jp/op/commerce.aspx) | Class10は2014年以降、Class20はfarm 2020年以降追加を案内。分析指標、更新SLA不明 | 無料一部 / 詳細有料会員 | 公開再利用API・rateは不明。自動取得禁止 | 規約改定2026-08-31。変更/終了条項、上流licensed data。閲覧会員未採用、Premiumは問合せ候補 |
| S08 baseball-data.com / プロ野球データFreak（法人名不明） | [about](https://baseball-data.com/about.php) | Current成績/profile、過去ページあり、全集/年数未確定。更新SLA不明 | 公開 / 基本不要 | 公開API・rateは不明 | **DataFreakと同一Source**。copy許可ではない。二次Source/停止risk、未採用 |
| S09 Data Stadium / データスタジアム株式会社 | [data service](https://datastadium.co.jp/services/NGKKLc3A)、[feed/widget](https://datastadium.co.jp/services/ZZ-ZXimy)、[NPB提供事例](https://datastadium.co.jp/works/Qpp8M3ZU) | NPB media向け供給の実績。年度・Postseason・event・選手粒度は個別見積で確認 | marketing公開 / data契約認証 | feed提供経路あり。API/CSV仕様・rateは契約確認 | 法人供給候補。SLA/保管/終了時権利は不明。未採用 |
| S10 API-SPORTS / 同ブランド（契約法人名不明） | [Baseball](https://api-sports.io/sports/baseball)、[Docs](https://api-sports.io/documentation/baseball/v1)、[Terms](https://api-sports.io/terms) | NPBを競技一覧に掲載。日程/結果等、Player boxscoreは未確認。年別coverageはAPI確認待ち | marketing公開 / API登録key | Free 100 req/day、UTC日付でreset。paid枠はプラン別。公開APIあり | as-is、coverage/update保証なし、権利苦情で停止等。未採用 |
| S11 TheSportsDB / TheDataDB Ltd | [Terms](https://api.thesportsdb.com/docs_terms_of_use.php)、[料金](https://www.thesportsdb.com/docs_pricing.php)、[NPB 2026](https://www.thesportsdb.com/season/4591-nippon-baseball-league/2026) | NPB 2026 event一覧あり、練習/オープン/Regularの分類要確認。Player Stats/各Round完全性は未確認。community更新 | website公開 / API key、paid契約あり | official API。Free 30/min、Single Developer 100/min、Small Business 120/min | 規約2026-09-17。訂正/欠損/第三者素材risk。未採用 |
| S12 Sportradar / group（US規約はSportradar US LLC、実契約法人は確認） | [Global Baseball](https://developer.sportradar.com/baseball/reference/global-baseball-overview)、[competition](https://developer.sportradar.com/baseball/reference/global-baseball-competitions)、[FAQ](https://developer.sportradar.com/baseball/reference/global-baseball-faq) | Global Baseball v2はNPB対象。score等、Player detailはcoverage matrix/契約で確認。historical resultsあり、NPB年数不明 | docs公開 / data key・契約 | APIあり、quotas契約別。TTL 300sはcache指示でrateではない | 法人供給候補。NPB coverageの目標値は全項目保証ではない。未採用 |
| S13 Stats Perform / group（契約法人はWork Order確認） | [Opta](https://www.statsperform.com/products/opta-data/)、[NPB 2024例](https://origin-msmc-showcase.statsperform.com/en_GB/baseball/npb-2024/3bkuef322oqf9e8th9sf0tuc/results)、[MLA](https://www.statsperform.com/legal/mla-december-2025/) | NPB 2024/2025 showcaseあり。2026・年別・Postseason・player粒度は契約確認 | showcase公開 / feed契約 | 法人feed、仕様・rateは不明 | 第三者権利・競技条件・停止risk、検索/比較機能の許可も必要。未採用 |
| S14 Goalserve / Fandata Systems Limited | [Baseball料金](https://goalserve.com/en/sport-data-feeds/mlb-api/prices)、[coverage](https://www.goalserve.com/it/sport-data-feeds/MLB-api/coverage)、[Terms](https://www.goalserve.com/en/terms-and-conditions) | NPB掲載。2010年以降historyはサービス広告でNPB全量証拠ではない。MLB Stats案内をNPBへ流用しない | marketing公開 / feed契約認証 | data feedあり、NPB仕様・rateは不明 | 規約表示2020-11-30、as-is/終了条件。細粒度・保持・公開許諾不明、未採用 |

### 3.1 12球団公式の適用範囲

選手・発表等の候補ページは存在しても、球団公式全体にOpen Data licenceがあるとは確認できなかった。下表のREDは**記載したページ/サービス規約の範囲**。app/member/shopの規約を公開website全体へ勝手に拡張しない。いずれも公開資料の閲覧は原則¥0、data reuse料金・保持・APIは不明。記事の自由文・顔写真・ロゴは転載しない。

| 球団 / 運営主体 | 一次URLと確認した制約 | 判定・保留 |
|---|---|---|
| 巨人 / 株式会社読売巨人軍 | [公式](https://www.giants.jp/)のcopyright、提供元表示。公開siteのdata再利用許可は未確認 | UNKNOWN。shop規約を根拠に全siteを判定しない |
| 阪神 / 株式会社阪神タイガース | [公式](https://hanshintigers.jp/)、[mobile規約](https://m.hanshintigers.jp/rules.html)は私的利用範囲 | 公開site UNKNOWN / mobile契約の無許可転用RED |
| DeNA / 株式会社横浜DeNAベイスターズ | [公式](https://www.baystars.co.jp/)、[mobile規約](https://sp.baystars.co.jp/terms/au.html)は転載・複写・蓄積等を制限 | 公開site UNKNOWN / mobile RED。330円閲覧はデータlicenseではない |
| 広島 / 株式会社広島東洋カープ | [公式](https://www.carp.co.jp/)、[scheduleページ](https://www.ticket.carp.co.jp/calendar/search.html?month=7&year=2025)には無断転載禁止表示 | 公開data全般の許可UNKNOWN / 禁止表示の対象の転載RED |
| 中日 / 株式会社中日ドラゴンズ | [FAQ](https://www.dragons.jp/faq/)は非営利でも写真・成績転載を認めない旨を案内 | RED、明示的許諾なしに転用しない |
| ヤクルト / 株式会社ヤクルト球団 | [website規約](https://www.yakult-swallows.co.jp/company/terms)は私的利用を超える利用に許諾を要する | RED、別許諾待ち |
| ソフトバンク / 福岡ソフトバンクホークス株式会社 | [著作権](https://www.softbankhawks.co.jp/company/copyright.html)は無断使用・転載を制限 | RED、別許諾待ち |
| 日本ハム / 球団・ファイターズ スポーツ＆エンターテイメント（対象データの契約法人は確認） | [球団情報](https://www.fighters.co.jp/company/)、[app規約](https://www.fighters.co.jp/expansion/app/termsofuse.html)は私的利用範囲 | 公開site UNKNOWN / app RED。グループ内の権利主体も確認する |
| ロッテ / 株式会社千葉ロッテマリーンズ | [公式](https://www.marines.co.jp/)、[会員規約](https://www.marines.co.jp/fanclub2026/rule/)、[mobile規約](https://www.marines.co.jp/signup/terms_au.html) | 公開site UNKNOWN（本文取得にも制限）/ mobile等の転用RED |
| オリックス / オリックス野球クラブ株式会社 | [site policy](https://www.buffaloes.co.jp/company/sitepolicy.html)は情報・写真等の転載に許可を要する | RED。リンク方針も別確認 |
| 西武 / 株式会社西武ライオンズ | [copyright](https://www.seibulions.jp/expansion/copyright.html)は非営利でも無断転載禁止 | RED、別許諾待ち |
| 楽天 / 株式会社楽天野球団 | [FAQ](https://www.rakuteneagles.jp/answers/)は掲載content使用の事前確認を案内 | RED、包括的reuse許可なし |

球団発表はtrade/signing/retirement/campの一次証拠候補。ただしannouncement dateとregistration/effective dateを別扱いし、球団名・player nameだけで既存canonicalへmergeしない。全12社を定期収集するcollectorは今回作らない。

## 4. Rights Matrix

凡例：**可**＝記載範囲で明示、**条件**＝現行license要件を満たす必要、**要許諾**＝現在のplanのみでは採用不可、**不明**＝肯定証拠なし。ローカル保存は継続的なデータ保存であり、一時的なbrowser cacheのことではない。

| Source / plan | automation / retrieval | local / private DB | 加工・derived | public web / Android表示 | raw再配布 | commercial / attribution | 総合 |
|---|---|---|---|---|---|---|---|
| nf3 新規範囲 | 不明 | 不明 / 不明 | 不明 | 不明 | 不明 | 不明 / creditのみで許可にならない | UNKNOWN。既存Regularはprovisional |
| NPB公式 | 不明、サイトからのsystematic取得を許可済みにしない | 要許諾 / 要許諾 | 要許諾 | 要許諾 | 無許可不可 | commercial許可不明 / 指定credit不明 | RED、許可を得た範囲のみ再評価 |
| 12球団 | site/service別 | 不明または要許諾 | 不明または要許諾 | 上表の対象は要許諾 | 不明または無許可不可 | 不明 / 個別指定 | RED/UNKNOWNを分離 |
| Wikidata 構造化層 | documented interfaceで条件 | 可 / 可 | 可 | 可 | 可 | 可 / CC0上credit必須ではないがsourceを残す | GREEN、identity/claim範囲 |
| Wikipedia 対象article data | API policy遵守 | 条件 / 条件 | 条件 | 条件 | 条件 | CC BY-SA 4.0、article/revision・license・変更・ShareAlike等 | GREEN、個別素材の条件を満たす場合 |
| SIJ PRO閲覧 / 無料公開部分 | automation不明 | app用保存は要許諾 / 要許諾 | 有料規約§9は要許諾 | 有料規約§9は要許諾 | 許可不明 | 私的使用を超える利用は要許諾 / 指定credit不明 | 閲覧plan RED、個別許諾経路YELLOW、無料部分単独UNKNOWN |
| DELTA Class10/20 | scraping・AI/OCR等禁止 | systematization禁止、手作業も回避不可 | 個人的一時分析等とapp用を分離 | 無許可公開不可 | 無許可不可 | 商用は別契約 / creditだけでは不可 | RED。Premium契約経路YELLOW |
| DataFreak | bot制限、積極的許可なし | 不明 / 不明 | 不明 | 不明 | 不明 | 不明 / link freeはcopy freeではない | UNKNOWN |
| Data Stadium | 契約feed仕様確認 | 契約確認 / 契約確認 | 契約確認 | 契約確認 | 契約確認 | 契約確認 / 指定credit不明 | YELLOW |
| API-SPORTS standalone | API plan内は可 | 永続保持・private DB不明 | app加工の範囲確認 | **公開licenseを提供しない** | direct resale禁止、公開dump不明 | 上流競技権利は別取得 / 不明 | RED、key/Freeだけでは不可 |
| TheSportsDB | **official APIのみ**。website scrape不可 | copy/modify可、永久保管・再配布範囲は確認 | API条件・第三者権利を確認 | paid app/service条件、storeはpaid必須 | API再販不可、static dumpは確認 | third-party rightsを別確認 / TheSportsDB source credit | YELLOW |
| Sportradar | Product/SOW内 | SOW確認、終了後archiveも確認 | 対象use caseの確認 | 指定properties/権利範囲内 | SOW確認 | league等の必要license確認 / 指定credit | YELLOW |
| Stats Perform | Work Order内 | DB/search/複数年利用は**書面確認** | aggregate/第三者data混在も確認 | 指定用途のみ | Work Order確認 | 追加Data Use License等 / 指定credit | YELLOW、showcase転載はRED |
| Goalserve | feed契約内 | 不明 / 不明 | 不明 | 具体的app用途確認 | 不明 | third-party/commercial権利・credit不明 | YELLOW、購読だけで包括許可としない |

### 4.1 判断の一次根拠と過去不採用理由の再評価

- **NPB公式**：[CS等のfooter](https://npb.jp/games/2026/info_cs.html)に情報・画像・映像の二次利用/無断転載禁止表示。情報の所在は十分でも、現行app用途の許諾がないという理由は残る。問い合わせ窓口は[公式フォーム](https://npb.jp/form/inquiry/)。フォームがdata licenceを発行できるとは未確認。
- **nf3**：[運営者の説明](https://note.com/nulspo/n/n039a116e6dfc)はSportsnavi等からの手集計・再計算による二次Sourceと明言。ページ追加をlicenseと見なさない理由は残る。作者の許可を得ても、上流権利の範囲確認は別に必要。
- **SIJ**：[規約§1/§9](https://jp.yakyudb.com/tos/)は有料コンテンツ会員を対象に私的使用を超える利用・二次創作物の許諾を求める。低価格=public app可という過去の障害は解消していない。公開無料部分に自動的なopen licenceを広げない。
- **DELTA**：[現行規約§6](https://1point02.jp/op/service.aspx)は無料/有料双方に適用。自動取得、手入力による体系的DB化、無許可公開等の制限が明確。研究や個人分析の例外を公開アプリへ転用しない。一般閲覧planの不採用は継続。
- **API-SPORTS**：[Terms「Service & data」](https://api-sports.io/terms)はapp/websiteへのdata公開licenseを提供せず、competent authoritiesへの確認を利用者に求める。Freeやpaid APIをNPBの再利用許可とはできない。
- **TheSportsDB**：[2026-09-17 Terms](https://api.thesportsdb.com/docs_terms_of_use.php)はAPIとwebsiteを区別し、store公開appはpaid subscription必須。画像のCC flagはlicense証明ではない。以前の「無料APIで全platform対応」と読める期待は採用しない。
- **Sportradar**：[Non-Betting Master Terms](https://developer.sportradar.com/sportradar-updates/page/master-terms-and-conditions-for-non-betting-services)と[その他Product条件](https://developer.sportradar.com/sportradar-updates/page/terms-and-conditions)は適用契約を確認する。必要な競技権利、利用properties、archive条件等をSOWで確定する。trialはproduction許可ではない。
- **Stats Perform**：[MLA December 2025 §4](https://www.statsperform.com/legal/mla-december-2025/)ではdatabase・search/compare・複数年/累積・第三者data混在等が書面許可事項になる。このappのExplorer/Compareを契約説明から省かない。別競技のBasic Data例をNPBへ流用しない。
- **Goalserve**：[Terms](https://www.goalserve.com/en/terms-and-conditions)でサービス責任・終了等は確認できるが、永続DB/公開JSON/上流NPB権利の範囲は確定できない。定額feed購入のみでGREENにしない。
- **Wikimedia**：[Wikidata licence](https://www.wikidata.org/wiki/Wikidata:Licensing)のCC0構造化層と[Wikipedia Terms §7](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use)の条件付き再利用を分離。identity bridge先の別サイトの成績・写真にこのlicenseを伝播させない。

### 4.2 robots / automation policy metadata

観測：`2026-10-10T09:11:12.745Z`、25 originにrobots.txtを各1回GET。認証なし、retryなし、データ取得なし。metadata/hashはignored `.data/npb-source-rights/robots-2026-10.json`。robots原文をpublic source datasetとして保存していない。

| Source / origin | 観測 | 解釈・運用 |
|---|---|---|
| nf3・npb.jp | 404 | 許可の証拠ではない。automation licenceは不明 |
| SIJ jp.yakyudb.com | 200、空Disallow | robots上の禁止なしでも§9の許諾が必要 |
| DELTA 1point02.jp | 200、agent別制約・例外 | ChatGPT-User/Claude-User等にroot禁止と限定例外。一般AllowをTermsのscraping禁止より優先しない |
| baseball-data.com | 200、bot別root禁止 | GPTBot/ClaudeBot等に制約。botを偽装して迂回しない |
| Wikidata / ja.wikipedia.org | 200、複数path/agent条件 | documented API・[Wikimedia API Guidelines](https://foundation.wikimedia.org/wiki/Policy:Wikimedia_Foundation_API_Usage_Guidelines)・maxlag/429等を守る。サイト全体を自由crawlしない |
| Data Stadium | 200 | marketing site用。data feedの契約許諾とは別 |
| API-SPORTS | 200 | website用。API quotas・公開rightsは別 |
| TheSportsDB www host | 200、GPTBot制約 | official API hostとscopeが異なる。website robotsをAPIの禁止/許可証拠に流用しない |
| developer.sportradar.com | 200、一部path禁止 | developer siteとauthenticated feedを分離 |
| Stats Perform | 403 | 本文不明、迂回しない。公開検索で得たprimary資料と契約確認に限定 |
| Goalserve | 200、/getfeed/制約・agent別例外 | 対象agent/契約endpointを個別確認。feed licenceの代替ではない |
| Giants | 403 | 不明、迂回なし |
| Yakult / DeNA / Carp | 200 | Yakultのcamp PDF制約、bingbotのcrawl-delayはそのagentのみ。他agentへ一律転用しない |
| Tigers / Dragons / Hawks / Fighters / Marines / Buffaloes / Lions / Eagles | 404 | open licenceではない |

bot向け取得許可はSourceのTermsと両方成立する必要がある。API規約が許すofficial endpointと、website scrapeを区別する。robots結果はこの時刻の観測で、将来の固定policyではない。

## 5. Cost Matrix

円換算・税・為替手数料・上流license・最低契約額を含む**実際のapp利用額**が確定するまで、有料採用は決めない。今回調査の予算帯は将来候補の評価であり、支出承認ではない。

| 予算帯 | 確認できた案内 | 公開appの利用料としての結論 |
|---|---|---|
| ¥0 | Wikidata / 条件付きWikipedia | licence条件内の個別補完は可能。完全Current feed等には不足 |
| ¥0閲覧 | nf3 / NPB / 球団 / DataFreak / SIJ無料部分 | Production data reuseが¥0とは未確認 |
| ～¥500/月の閲覧候補 | SIJ商品ページは**100円/月・税別**、野球DB aboutは**300円/月・税込** | **公式資料間の不一致**。現在の適用plan/checkout・app licence料金は問い合わせ必要。安い方を確定価格にしない |
| ～¥1,000/月の閲覧 | DELTA Class10 **1,000円/月** | retailはRED、app licenceは別。税込総額/契約時価格も再確認 |
| ～¥2,000/月の閲覧 | DELTA Class20 **2,000円/月** | retailはRED、Premium価格はASK。上限内でapp公開可能とは判定しない |
| ～¥2,000/月の可能性 | TheSportsDB **Single Developer $9/月** | [料金ページ](https://www.thesportsdb.com/docs_pricing.php)。総額換算が上限内か確認必要。税/手数料込み換算係数が222.22円/$以下なら算術上2,000円以内。為替の現値を測った数字ではない |
| 要為替・条件確認 | TheSportsDB **Small Business $20/月**、API-SPORTS paid | TheSportsDBは同係数100円/$以下でなければ2,000円を超える。API-SPORTSはFree 100/day以外の現請求通貨/総額を未確定、安価なlicense済みplanとはしない |
| それ以上の価格帯候補 | Goalserve Baseball Live Score **$100/月**（$550/6ヶ月、$900/年）、MLB Live Data **$250/月** | [公式料金](https://goalserve.com/en/sport-data-feeds/mlb-api/prices)。NPBの詳細statsがMLB planと同粒度とは未確認。為替/税別途、個人低予算候補として優先しない |
| 法人向け参考 / 金額不明 | SIJ個別許諾、NPB/球団、DELTA Premium、Data Stadium、Sportradar、Stats Perform | 公開app向けNPBの定価を確認できない。高額とも低額とも断定せず見積待ち。trial/registerは行わない |

**¥2,000/月以内で実装まで進められることが確定した新NPB Sourceは0。** 可能性を確認する価値が高いのはSIJ個別許諾とTheSportsDBの限定event利用。費用が低くてもrights/coverageが満たされなければ採用しない。

## 6. Product Capability Matrix — Source available と rights available

凡例：**V**＝公開の代表資料で所在を確認、**M**＝提供元のサービス案内のみ、**?**＝対象競技/粒度未確認、**—**＝今回所在を確認できない（不存在の断定ではない）、**P**＝個別の疎な情報。表は**利用可能性の調査結果**であり、採用済みCapabilityのtrueではない。

| Source | Current Postseason | Historical / Career | Transactions | FA / Posting | Current roster / number | Preseason | Draft | このアプリで今すぐ使える範囲 |
|---|---|---|---|---|---|---|---|---|
| nf3 | V概要 / Player detail ? | V過去年、全Career ? | V公示history | ? | 保存所属V / 現在証拠? | ? | ? | 新規取得はなし、既存provisionalのみ |
| NPB | V First Game投打 / Final・日本S日程 | V年度/通算 | V公示/Trade | V各区分 | V名簿/登録/背番号 | Vオープン戦/camp | V | 許諾待ち。単なる参照とapp ingestionを分離 |
| 12球団 | V個別日程/記事、全集? | P | V発表 | P | V個別profile、観測日要確認 | Vcamp/日程、practice stats ? | V発表 | 許諾待ち、全社統合feedなし |
| Wikidata | — | P履歴/identity、Stats全量— | P | P | P、現在証拠は別途 | P開催情報 | P | CC0 claimの限定補完、完全Current扱い不可 |
| Wikipedia | P概要 | P年度記述/履歴 | P | P | P、current proof不足の場合null | P | P | revision/licence/identity確認済みの限定curation |
| SIJ | ? | M年度/通算/Game/打席 | ? | ? | Mprofile/球歴 | ? | M | 許諾・現在料金・coverage回答待ち |
| DELTA | ? | M 2014+分析、全Career ? | — | — | M選手情報 | ? | ? | retailでは新規利用不可 |
| DataFreak | ? | V成績/過去年、全Career ? | ? | ? | Vprofile、current proof ? | ? | ? | 権利不明 |
| Data Stadium | M NPB feed、Round/Player ? | M / 範囲? | ? | ? | M /範囲? | ? | ? | 契約・仕様確認待ち |
| API-SPORTS | M NPB events、全Round? / Player ? | M /年数? | ? | ? | ? | ? | — | standalone公開licenseなし |
| TheSportsDB | V NPB events / Postseason全量? | V年別events / Career— | ? | ? | P | V混在events、分類? | — | paid APIの限定利用・再配布条件確認待ち |
| Sportradar | M NPB live、Round/Player ? | M results /年数? | ? | ? | Mprofile、current証拠? | ? | ? | SOW・competitions coverage待ち |
| Stats Perform | ?（2026未確認） | V 2024/25例、全年度? | ? | ? | ? | ? | ? | Work Order・Data Use License確認待ち |
| Goalserve | M NPB events、Round/Player ? | M general history /NPB年数? | ? | ? | ? | ? | — | feed・上流権利・保持条件確認待ち |

Career aggregateだけあるSourceを、yearly Game Logやfull Career Timelineまで作れるSourceと扱わない。名前・外部IDがあることも、Career Stats取得権利とは別。

## 7. Priority 1 — NPB Current Postseason

### 7.1 粒度と2026年の観測範囲

| 候補 | Series / round | schedule / score / status | player batting / pitching | advantage / 決着 | 採否 |
|---|---|---|---|---|---|
| NPB公式 | CS区分、日本S案内あり | [2026-10-10 First Game](https://npb.jp/scores/2026/1010/g-db-01/)で結果・finalを確認 | 同Gameの[boxscore](https://npb.jp/scores/2026/1010/g-db-01/box.html)に投打表が存在。全指標/全試合検証は未実施 | [2026 CS rule](https://npb.jp/games/2026/info_cs.html)が一次資料 | 最有力の公式証拠だがRED/別許諾待ち |
| nf3 | indexにCS First/Final状況 | indexに日程・概要。日別Player Statsの全量は未確認 | ? | advantage概要あり、正規化の完全性未検証 | UNKNOWN、provisional拡張しない |
| SIJ | 対象に含むか不明 | Game data広告あり、2026 CS/日本Sは問合せ | Game投打/打席data広告あり、Postseason区分・完了証拠は未確認 | rule metadataの提供は不明 | YELLOW、まず対象競技と許諾を確認 |
| TheSportsDB / API-SPORTS | NPB掲載とround fieldの保証は別 | events/score候補、全Postseason coverage未確認 | NPB player boxscoreは未確認 | 公式advantage/rule未確認 | schedule/score候補とPlayer Stats候補を分離 |
| Data Stadium / Sportradar / Stats Perform / Goalserve | 契約とNPB coverage matrixで確認 | feed候補 | 詳細粒度は未確認 | 独自計算だけで公式決着を推測しない | YELLOW、個別見積・仕様・権利待ち |

2026-10-10時点でCS Firstの代表Gameは存在する。一方、Finalと日本シリーズの未来の実績を検証したとはしない。[日本シリーズ2026](https://npb.jp/nippons/2026/)は日程等が公開されているが、将来の参加球団/終了結果/Player Factsを作らない。過去日本シリーズarchiveへのリンクは存在しても、全Game Statsの再利用は未許諾。

### 7.2 2026 CS Final ruleと既存Contractへの影響

[NPBの2026-08-24告知](https://npb.jp/games/2026/info_cs.html)に基づく差分：通常Finalは1勝advantage・最大6試合・4勝先勝。**1位とFirst勝者のRegularゲーム差が10以上、またはFirst勝者のRegular勝率が.500未満**なら2勝advantage・最大7試合・5勝先勝になる。

取得後に必要な検証は、実試合勝利とrule advantageの分離、公式順位/ゲーム差/勝率の証拠、同点・中止時の上位seed優先による決着、stage/seasonごとのrule version。先勝勝数だけからSeries completeを判定しない。2勝の架空Gameは絶対に作らない。

コード上の接続準備はまだ完全ではない：

1. `src/domain/competition.ts`の `seriesSchema` はadvantage非0をNPB Finalの**1のみ**に制限している。
2. 同schemaのGame/Team ID形式はUUID/MLBを中心に定義され、`src/domain/cross-league.ts`が許す既存NPB `npb:game:<20hex>` / `npb:team:<slug>` をそのまま受け付けない。
3. `postseasonHubSchema`はMLB/2020–2025/Retrosheet限定。NPBの新providerをこのvalidatorへ無理に流さず、互換性を保つ追加schema/adapterが必要。

これは**将来NPB Current接続の設計blocker**。今はNPB unavailableであり、既存公開MLBの変更・migration・Gate解除理由にはしない。許諾後の独立実装でvalidator/ID/rule testsを追加する。

## 8. Priority 2–3 — Transactions / FA / Posting

NPB公式の[公示index](https://npb.jp/announcement/2026/)には出場登録/抹消、支配下/育成、新規契約、自由契約、任意引退等の区分がある。[Trade公示](https://npb.jp/announcement/2026/pn_traded.html)は公示日・選手・旧/新球団等の事実候補。[Postingによる自由契約](https://npb.jp/announcement/pn_released_posting.html)も独立資料。これらは本文転載を要しないevent化の候補だが、systematic保存/公開は許諾待ち。

| domain | Source候補 / 現在の到達点 | 不足する証拠・権利 |
|---|---|---|
| 日次登録/抹消・支配下/育成 | NPB公示・[roster](https://npb.jp/announcement/roster/)、nf3公示history | 自動取得/保持/公開許諾、取消訂正、identity、effective date。日次feedとしてWikimediaで代用しない |
| Trade / Signings / Releases | NPB公示、当該2球団の発表、法人feed要問合せ | 発表と登録を別eventにする。source/destinationの確定、契約日不明はnull |
| Retirement | 任意引退/自由契約公示、選手/球団発表、個別Wikipedia revision | 任意引退・自由契約・本人引退表明を同義にしない。最終出場日を発表日から推測しない |
| FA | NPBの取得資格/宣言/契約区分、球団発表 | 資格取得≠FA宣言≠移籍合意。残留も別status。公開newsリンクだけを自社event DB許可としない |
| Posting / overseas | NPB posting release、球団/受入球団発表、Wikimedia個別履歴 | 申請≠交渉≠海外契約≠NPB自由契約。移籍先・effective dateが未確定なら残す |
| Hot Stove | 確定した上記eventのみ | rumor/報道予測は採用しない。記事全文や画像のfeedを作らない |

**HUMAN-REVIEW OPTION**は、Wikipedia等の既に再利用可能な個別revisionで、identity・event種別・日付・定義が確認できる低頻度eventに限る。別サイトを人が読んで全件手入力すれば許される、とはしない。これを公式全件日次Transactions/roster Capabilityへ昇格させない。

### 8.1 許諾後のschema sketch（実装なし）

```text
eventId: canonical event identity（announcement IDとの対応をprovenanceへ）
league / playerId / eventType
sourceTeamId / destinationTeamId: nullable
announcementDate: evidenceに記載された日付
effectiveDate: explicit evidenceのみ、なければnull
status: announced / registered / completed / withdrawn 等、source定義に従う
sourceEvidence: URL / source identifier / revision / observedAt
verificationMethod / correctionOf / rightsScope
```

同名mergeなし、既存canonicalを保つ。異なるSourceの同じeventは多数決mergeせず、公式証拠とprovider責任・訂正履歴を残す。過去所属一覧を日次movement履歴へ変換しない。

## 9. Priority 4 — Historical / Career

| Source候補 | yearly / Career / Game粒度 | identity・完全性 / 採否 |
|---|---|---|
| NPB公式 | [年度別index](https://npb.jp/bis/yearly/)1936–2026、[代表Player年度/通算](https://npb.jp/bis/players/41845139.html)。年度と通算の所在を別確認 | NPB player URL IDは一意照合候補、外部ID参照とdata licenceは別。全年Game/全fieldの存在を保証しない。別許諾待ち |
| SIJ | 案内上はprofile/通算、PROは2005年以降Game打席/スタメン | 年度별投打export、廃止球団・全retired player・NPB初年/最終年・各competition・訂正方式を確認。公開app/継続保存は別許諾 |
| DELTA | 2014+analysis、farm 2020+案内 | 全NPB Careerの代替とはしない。retail自動/手動DB化は不可、Premiumなら対象要確認 |
| nf3 / DataFreak | 過去Season・成績ページの所在 | 年数/完全性/継続性/rights不足。閉鎖前の全archive取得を勝手に行わない |
| Wikidata / Wikipedia | 個別profile、NPB ID等、team history・年次記述 | sparseなidentity/履歴補完のみ。全Career totalsや全Season Statsは別Source待ち |
| 法人feed | Historical results/Statsの提供候補 | NPB年度・Player/Team粒度・archive licence・退会後利用を個別確認。MLB coverageをNPBへ流用しない |

yearly batting/pitchingについてはPA/AB/H/HR/RBI/BB/SO、投手outs/H/BB/HBP/BF/ER等の**定義とnull**を確認する。Career合計しかないと年度推移、Game Logs、Recent、PA分析は復元できない。Historicalを追加した後も収録期間合計とFull Careerを別Capabilityにする。career milestonesは選手の全対象期間がcompleteと証明できるまで作らない。

## 10. Priority 5 — Preseason

| 区分 | 公式所在 / 候補 | competition factsとしての到達点 | 結論 |
|---|---|---|---|
| 春季キャンプ | [NPB camp guide 2026](https://npb.jp/camp/2026/)、球団案内 | 場所・日程等の情報。Game/Player statsではない | 低頻度calendar候補、reuse許諾またはrights-cleared個別資料が必要 |
| 練習試合 | 球団schedule/news、TheSportsDBの混在event候補 | 全Game status/Player boxscore/competition境界が未確認 | BLOCKED。記事のスコアだけをcomplete Factにしない |
| オープン戦 | [NPB preseason 2026](https://npb.jp/preseason/2026/)、[打撃成績例](https://npb.jp/bis/2026/stats/bat_op.html) | 日程/結果/Team/Player statsの所在あり。規定到達一覧だけで全選手Coverageとしない | IMPLEMENT AFTER PERMISSION。Regularから明確に分離する |
| preseason roster / movement | 球団camp発表、公示、法人feed候補 | camp参加≠登録、登録≠opening roster。dated evidenceを要する | 現在の公開ingestionはBLOCKED/許諾待ち |
| opening day roster | NPB登録資料、球団正式発表 | 指定日スナップショットの候補。latest profileだけで復元不可 | 許諾後、日付付きrosterとして実装候補 |

既存`regular/postseason`へオープン戦を無理に入れない。採用が決まった時点でcompetition追加を互換に設計する。春季教育リーグ、farm、日本シリーズ、練習試合も別区分。今回schemaを増やさない。

## 11. 追加無料Source探索と採用しなかった理由

GitHub/Open Data/公開CSV等も探索したが、repository licenceとupstream data rightsを分離した。今回、新たにGREENと判定できた全量NPB datasetはない。

| 候補 | licence / upstreamで確認できたこと | 結論 |
|---|---|---|
| [tokuchi765/npb-analysis](https://github.com/tokuchi765/npb-analysis) | MIT code、NPB公式由来の取得/分析。upstream再利用許可の証拠なし | UNKNOWN。MITをNPB data licenceと扱わない |
| [yasumorishima/npb-prediction](https://github.com/yasumorishima/npb-prediction) | MIT code、baseball-data.com/NPB由来 | UNKNOWN。モデル/codeとraw/元データを分離 |
| [Nippon-Baseball-Data-Repository](https://github.com/armstjc/Nippon-Baseball-Data-Repository) | repo licence、既存調査ではSPAIA上流。上流の公開app grantなし | UNKNOWN、無料API/CSVの存在だけでは採用しない |
| [2010公開dataset投稿](https://www.japanesebaseball.com/forums/17/64293) | 作者がCC BY-NC-SAを案内、Yahoo由来・欠落等を記載 | 上流permission UNKNOWN、NCは将来広告/有料利用に不適合。完全Careerを作れない |
| [baseball-data.jp](https://baseball-data.jp/data) | 2016+成績/Career等の無料marketing、advanced loginあり | `.com`とは別Source。運営/上流/licence未確定、UNKNOWN |
| [npbdata.jp](https://npbdata.jp/) | Sportsnavi由来を記載、2021–26表示 | UNKNOWN。二次整形は上流reuseの許可にならない |
| 公的/学術/自治体・CC dataset方向 | 既存調査と追加検索で今回の領域を満たす一次licence＋上流＋全量NPB feedを確認できず | 具体的URL/licence/粒度が得られるまでBLOCKED。研究利用許可を一般公開許可へ流用しない |

[Data Stadiumの学術向けサービス](https://datastadium.co.jp/news/etJl6dB5)や[Sports Data Live案内](https://datastadium.co.jp/news/rXRO7hrX)は用途別候補。研究者/配信者向け閲覧・画面利用と、個人appのprivate DB/JSON再配布は異なる。無料または2,000円以内の一般data licenceとしては未確認。

## 12. nf3 replacement strategy

[2026-04-14の運営者告知](https://note.com/nulspo/n/n039a116e6dfc)は**2028-01-24に活動終了・閉鎖**を予定する。日付を2028シーズン終了等と読み替えない。継続性と二次Sourceのrightsは別riskで、現在動作していることを採用継続の十分条件にしない。

| risk | 現状 | 推奨する対応（今回未実行） |
|---|---|---|
| reuse grant不足 | 現行Regularはprovisional、Postseason等の拡張許可なし | 作者・上流権利者の範囲を確認。既存利用/保存/公開/終了後保持についても解決する |
| closure | 2028-01-24予定、個人運営・SLAなし | 2027年中に代替を評価できるよう許諾/見積を先行。閉鎖前mass archiveで回避しない |
| upstream dependence | 手集計二次Source | 書面でNPB供給・公開アプリ権限を持つproviderを優先 |
| semantics/identity migration | providerをUIへ露出しない既存adapter基盤 | source ID→既存canonical bridge、competition/field意味を契約ごと確認。canonical再採番なし |
| corrections / coverage | 既存partialや欠落を含む | 許諾後のみshadow検証。count/hash/score/outs/null/scopeを照合、差は原因別記録し多数決上書きしない |
| licences / retention | 現行private/public境界あり | raw・backup・archive・解約後保持・既存公開の撤回要否を契約で確認。制約に合わないならpublic payload経路を使わない |

代替優先順位：**SIJ個別許諾 → NPBの許諾/窓口案内・Data Stadium → 法人feed**。TheSportsDBはschedule/scoreの補助候補であり、現行NPB Game Player Factsの代替が成立したとはしない。API-SPORTSも上流公開licenseがないまま代替採用しない。

## 13. Recommended Source Stack / Architecture impact

| layer | 推奨 | 接続条件 |
|---|---|---|
| profile / low-frequency history | 既存Wikidata CC0 + 条件付きWikipedia | verified identity、field-level provenance、revision/licence、conflict保留、current evidence |
| identity | 既存canonical、検証済み外部ID、既存Chadwick cross-reference範囲 | 外部IDの存在はその先のdata取得権ではない。名前だけmergeなし |
| Current Regular | nf3現行provisional、replacementの許諾確認を優先 | 勝手な範囲拡張なし。replacementのrights未解決を隠さない |
| Current Postseason | 第一候補SIJ/NPB許諾、次にNPB供給事業者 | CS/JapanS・Player boxscore・rule/完了証拠を含むpermissionとcoverage |
| daily roster / official movement | NPB公示の許諾、または許諾済みevent feed | event date/definition/訂正とall-event coverageを分離 |
| FA / Posting / retirement | 上記＋rights-cleared個別curationの補助 | announced/registered/completed、明示日付。完全feedのように見せない |
| Historical / Career | SIJ/公式/法人の年度別供給とarchive権 | season-by-season・全career範囲・解約後保持・aggregate公開許諾 |
| Preseason | 同じproviderでも別competition scope | open games/practice/camp/rosterの粒度を区分、Regularへ混入させない |

新licensed Sourceの基本構成（設計案のみ）：

```text
licensed source
  → contract-permitted private collector
  → private raw archive / private DB（保持期限・backup条件内）
  → permitted derived aggregate + field provenance
  → validated, coordinated public projection（許可された場合だけ）
  → existing Web / Android repository adapter
```

**public GitHub repoにrawを置く必要はない。** Source credentials、原本、license契約本文を不用意にpublic repo/artifactへ含めない。private DBにしただけで権利問題は解消しない。継続保存・加工・バックアップの許可も必要。

GitHub Pages JSONは誰でも機械取得でき、offline cache・Share・CSV/表copyは再配布形態にもなる。「画面表示のみ許可」の契約では同じ公開経路を採用できるとは限らない。permitted outputのfield/件数/期間/遅延/credit/export/cacheを契約へ明記し、生成・保持・exportにrights allowlistを置く必要がある。JSONが禁止され追加private配信が必要なら、無料hosting/requests/機能制約を再見積し、¥0を崩す導入を自動実行しない。

## 14. Implementation decision / Blockers

| 領域 | 現時点の実装判断 | 解除に必要なこと |
|---|---|---|
| CC0 profile/identity、再利用条件を満たす個別履歴 | **IMPLEMENT NOW**（将来の小バッチとして。今回は実装なし） | canonical照合、qualifier/revision/date/coverage、既知値・conflict維持 |
| rights-cleared個別FA/退団/移籍履歴のcuration | **HUMAN-REVIEW OPTION** | CC BY-SA等の条件、event identity/date/meaning確認。Codex-assistedと実human reviewを区別。full feed認定なし |
| Current Postseason schedule/score/player Stats | **IMPLEMENT AFTER PERMISSION**、現在ProductionはBLOCKED | 書面permission＋取得方法＋全Roundの粒度/完了検証＋2026rule/NPB ID Contract追加対応 |
| 日次Transactions / registration | **IMPLEMENT AFTER PERMISSION**、現在BLOCKED | 対象feed・automation/private保存/公開条件・event訂正/日付/identity |
| FA / Posting / overseasの全件Current feed | **IMPLEMENT AFTER PERMISSION**、現在BLOCKED | 公式区分と公示/球団発表の利用権、取消/完了state、coverage |
| Historical / Career Stats | **IMPLEMENT AFTER PERMISSION**、現在BLOCKED | 年別data・必要inputs・archive/派生公開権、full player範囲、identitybridge |
| Career milestones / full timeline | **BLOCKED** | rights解決後も全対象careerの完全性が必要 |
| オープン戦Game/Stats | **IMPLEMENT AFTER PERMISSION**、現在BLOCKED | 正式competitionのPlayer/Game全量、許諾と独立coverage |
| camp metadata | **HUMAN-REVIEW OPTION**はrights-clearな個別資料のみ | 公式資料の体系的転載には別許可。Game Facts/Current roster扱い不可 |
| 練習試合Stats / full preseason roster | **BLOCKED** | Source粒度・完全性・rights不足。newsのみで補完しない |
| API-SPORTS standalone、DELTA retail、NPB等の無許諾bulk | **BLOCKED** | 安い料金/robots許可では解除できない |

新規のProduction Capabilityは今回0。Current Postseason、Career全量、日次movement等のSource/rights待ちをProductの既存機能完成度と混同しない。無料探索は具体的な新license/対象scopeが提示されるまでこの到達点で区切る。

## 15. 問い合わせ案 — 未送信

SIJを最優先とする理由は、NPBのprofile/成績・Game単位・過去年を案内し、規約が二次利用の問い合わせ経路を示しているため。安い閲覧料金でアプリlicenseも買えると期待している、という意味ではない。公式contactは[商品ページ](https://sij.co.jp/product/detail/id=753)の`info@athletedb.net`、[about](https://jp.yakyudb.com/about/)の`info@yakyudb.com`に記載。連絡先の現有効性も送信時確認する。

### 15.1 SIJ宛の短い問い合わせ文

> 件名：個人開発の野球データアプリでのNPBデータ利用許諾・料金の確認
>
> 個人開発の「Baseball Notes」（https://tomoya41.github.io/baseball-notes/）で、NPBデータの利用を検討しています。GitHubの公開コード＋GitHub Pagesの公開JSONをWeb/Androidで表示する無料アプリです。原本・認証情報は非公開に分離する予定です。現在は広告・有料機能なしですが、将来の広告/有料化の条件も確認したいです。
>
> 2026 CS/日本シリーズの試合・選手投打成績、年度別/Career成績、登録・移籍等のevent、オープン戦の提供範囲をご教示ください。API/CSV等による自動取得、private DB・backup・訂正履歴保存、個々の選手成績と派生集計の表示、検索・比較、公開JSON・端末cache・表示範囲のexportはどこまで許可されますか。原本の大量再配布は予定していません。契約終了後の保存/表示、必要credit、上流NPB等の追加許諾、利用上限も確認したいです。
>
> 商品ページの月額100円（税別）と野球DB案内の300円（税込）の適用関係、および個人アプリ用途の許諾料金を教えてください。無料または月額2,000円以内で成立する範囲があれば希望します。無断取得は行っておらず、許諾・取得方法・費用を確認してから導入を判断します。

回答が「個人閲覧のみ」「記事内限定」「APIなし・自動化不可」「derivedも不可」「static JSON不可」「上流許諾は別」ならその範囲を記録する。曖昧な口頭了承を全用途のGREENにしない。許諾者・対象data・用途・費用・期間・終了後義務を文書で確定する。

### 15.2 他窓口へ確認すること

- **NPB/球団**：公示eventとCS/JapanS投打成績の取得・private保存・集計表示/公開JSON・current roster、適切な権利/供給窓口。公式[問い合わせ](https://npb.jp/form/inquiry/)で対応可能かも確認する。
- **Data Stadium**：個人/非営利・遅延EOD・必要な数値だけの最小feed見積、2026各Round・Historical・公示・Preseason、upstream許諾とstatic出力。Sports Data Live/研究サービスの利用範囲をapp DBへ流用しない。
- **TheSportsDB**：NPB 2026全PostseasonとGame status/boxscore粒度、public static derived JSON・永続private保存・契約終了後cache、第三者data rights、$9 planでのWeb＋Android用途と税込み価格。画像は今回対象外。
- **DELTA/Sportradar/Stats Perform/Goalserve**：NPBだけ・非betting・EOD/過去・最低field・機械可読公開/検索比較・複数年・バックアップ・解約後利用の契約条件。現行retailを先に購入しない。
- **nf3**：現行provisional利用を含む明示範囲、上流権利、終了後archive/public use。Postseason拡張を前提に質問せず、許可されない場合は採用しない。

## 16. Next Action / 残りTrack

1. **Permission Resolution**：SIJに§15の内容を人間が確認して送付するか判断。NPBへの権利窓口確認は独立して進める価値がある。本監査では誰にも送信していない。
2. **Current Competition Completion**：許諾が得られたSourceの2026 CS/JapanS粒度を最初に検証。2026rule・NPB canonical IDを受ける追加Contract、Regularからの分離、独立Postseason coverage/運用Gateを小さいreview unitで実装する。既存Scheduled/HOT/Ranking/Infrastructureを再利用・解除しない。
3. **Event / Offseason Track**：許可された公示/発表eventから登録・Trade・FA・Posting等を別種別で追加。完全feedと限定curationを分ける。Current roster/jerseyのdated evidenceにも接続できるが推測しない。
4. **Historical / Preseason Track**：yearly/全Career/オープン戦の実際の供給scopeを得た後に別バッチ。未収録year・未確認fieldはnull/partial。camp/practiceはより低い優先度。
5. **nf3 replacement / Release rights**：遅くとも2027年中に代替評価を進める。既存provisionalも解決してから商用/正式公開のrights完了と呼ぶ。費用が発生する契約は別途明示承認後のみ。

¥0で独立して進められるのは、**既存CC0/CC BY-SAの条件を満たすprofile・identity・個別履歴/低頻度eventの限定補完**。Source待ちを理由に既存実データを活用するProductやFinal QAを止める必要はない。一方、当初構想へ最も大きく近づく新data領域はCurrent Postseasonであり、現状はrights解決が先。

## 17. 検証・変更範囲

本書の追加だけを変更対象とする。コード、workflow、lockfile、Android、public payload、canonical DBは変更しない。外部raw datasetを取得/追加していない。robots metadataはignored作業成果であり公開しない。

docsのみのためfull tests/lint/typecheck/Web/Vercel/Android build・公開Smokeは今回実行していない。以前のPASSを今回の実行結果として転載しない。文書の必須13領域・8件のlocal link参照・table行の形式を検査しPASS。外部リンクは96参照/77 unique URLで、全リンクへの一括再取得を行ったという意味ではない。primary evidenceと判定を再読して確認した。

基準mainとの差分で、`src` / `scripts` / `public` / `.github` / `android` / package files / `SPEC.md` / `docs/decisions.md`に変更なし。変更対象は本書1件だけ。Git whitespace checkもPASS。canonical DBへのwriteは0、公開データ変更・Gate変更・契約・問い合わせ送信は0。PR/merge/Pages公開は本監査の依頼範囲に含まれない。

関連資料：[既存rights監査](npb-batch-g-rights.md)、[Historical discovery](npb-historical-discovery.md)、[無料補完Phase 2](npb-free-completion-phase2.md)、[Postseason](postseason.md)、[Product Inventory](product-completion-inventory.md)。過去資料は当時の証拠として残し、本書の新確認事項（価格不一致、規約更新、2026 CS rule、閉鎖期日）で読み替える。
