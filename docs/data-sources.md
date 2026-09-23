# データ取得元の調査

確認日：2026-09-23。公式の公開資料を調査。ログイン・契約・APIキー発行・成績の自動収集は行っていない。以下の「未確認」は許諾と扱わない。アクセスできるURLやOSS wrapperが存在するだけでは、保存・再配布の許諾やAPIの保証にはならない。

## 今回の採用

実データProviderは未採用。`SampleProvider`が同梱JSONをHTTP/WebView経由で読み、検証→正規化→Repository→UIを通す。2リーグ・各2人、すべて独自に作った架空の選手・チーム・成績。画面に常時サンプル表示し、障害時に実データからサンプルへこっそり切り替えない。

## 候補別評価

### NPB公式サイト

- 対応：NPB。選手・球団、公式記録、シーズン打撃/投手成績。
- 無料枠・認証：Web閲覧は公開。アプリ向けの無料API枠は確認できず。
- 更新頻度：サイトに対象日表示あり。APIの更新保証は確認できず。
- 規約・保存：サイト末尾に二次利用・無断転載禁止の表示。無許諾の自動取得・保存・再配布には採用しない。
- 公式保証：公式Webサイトだが、一般公開のサポート付きAPI仕様は今回確認できず。
- 代替：権利者からの許諾・正規提供元を別途確認。許諾まで実データ表示を開放しない。
- 出典：[NPB公式](https://npb.jp/)、[公式チーム一覧](https://npb.jp/eng/teams/)。SPAIA等の非公開エンドポイント、出所不明GitHub CSV、スポーツサイトのスクレイピングを代替にしない。

### MLB Stats API

- 対応：MLB関連データの候補。人物・球団・成績・日程等の詳細範囲は正式な利用契約とschemaで確定する。
- 無料枠・認証・更新頻度：第三者アプリ向けに保証された無償枠、認証条件、SLAは公開資料で確認できず。
- 規約・保存：本アプリ向けの再利用許諾未確認。[利用規約](https://www.mlb.com/official-information/terms-of-use)を要確認。
- 公式保証：[公式ドメインのdocs入口](https://statsapi.mlb.com/docs/)はdocs.statsapi.mlb.comへ転送され、今回の閲覧では公開仕様本文を確認できなかった。「MLB公式APIが無制限・自由利用」と扱わない。
- 採否・代替：未採用。権利確認後に専用adapter。公開済み過去年はRetrosheetを候補とし、最新成績へ偽装しない。

### Baseball Savant / Statcast

- 対応：MLB。公式CSV説明に投球、打球、打者/投手/捕手ID、カウント、状況、期待値等が記載されている。
- 無料枠・認証：検索・leaderboardの公開閲覧とCSV仕様は存在するが、アプリ向けの無制限API枠を意味しない。
- 更新頻度：画面/項目/訂正に依存。1日1回の取得許諾・SLAは未確認。
- 規約・保存：自動取得、集計保存、アプリ再配布の具体的許諾を確認するまで未採用。
- 公式保証：公式データの説明資料はある。公開検索画面を非公開APIの保証とみなさない。
- 代替：許諾取得、または正式なライセンス契約が可能な提供元を評価。利用条件を満たさない場合は高度分析をunavailableのままにする。
- 出典：[CSV定義](https://baseballsavant.mlb.com/csv-docs)、[MLB利用規約](https://www.mlb.com/official-information/terms-of-use)。詳細な可否は[Capability Matrix](analysis-capabilities.md)。

### Retrosheet

- 対応：MLBを含む北米の歴史データ。公開済み年の選手/試合/打撃/投球/plays CSV。現在の案内は1897–2025を含む。
- 無料枠・認証：公開ファイル、キーなし、利用料なし。API quotaの契約ではない。
- 更新頻度：公開リリース・訂正単位。前日までの現行シーズンデータ提供元としては使えない。
- 規約・保存：配布元が再利用・商用利用を認め、所定のクレジット表示を要求。採用時は[notice](https://www.retrosheet.org/notice.txt)の表示を実装する。保存・加工したデータにも出典、公開版、訂正履歴を付ける。
- 公式保証：Retrosheet自身の公開フォーマットでありMLB公式APIではない。欠測・推定・訂正に注意。
- 採否・代替：許諾が明示された歴史データの有力候補。今回はDL/組込みを行わず、将来1年・1選手など小範囲から検証。未公開期間は「未提供」。
- 出典：[CSV案内](https://www.retrosheet.org/downloads/csvoverview.html)、[利用条件](https://www.retrosheet.org/notice.txt)。

### Lahman / SABR

- 対応：MLB等の長期の打撃/投手/守備・チーム・年別記録。現在の案内では1871–2025、2026-01-02公開版。
- 無料枠・認証：CSV/SQL等の公開download、APIキーなし。
- 更新頻度：年次リリースと訂正。日次の今季分析には不適。
- 規約・保存：配布ページだけで全収録データの再配布条件を一括確定しない。特に新収録データは別権利元に言及があるため、対象版同梱のライセンスを個別確認する。
- 公式保証：SABR配布データであり公式リアルタイムAPIではない。
- 代替：対象年・項目を限定したRetrosheet。今回は未採用。
- 出典：[SABR Lahman](https://sabr.org/lahman-database)。

### Wikidata

- 対応：NPB/MLB人物・チームの補助プロフィール候補。網羅的選手名鑑や最新所属、競技成績、投球計測を保証しない。
- 無料枠・認証：公開読み取りAPI、通常の読み取りにキー不要。利用マナー・rate limitに従う。無制限を保証する枠ではない。
- 更新頻度：共同編集に依存。競技日次更新のSLAなし。
- 規約・保存：structured dataはCC0で再利用・保存可能。画像・Wikipedia本文には別条件があり、自動的に同じライセンスと扱わない。
- 公式保証：Wikimediaの文書化API。野球リーグの公式提供ではない。
- 代替：既存キャッシュと明示した未提供。実選手ID対応表を確認してからadapterを追加。今回は未採用。
- 出典：[開発者案内](https://www.wikidata.org/wiki/Wikidata:For_developers)、[ライセンス](https://www.wikidata.org/wiki/Wikidata:Licensing)、[API](https://www.mediawiki.org/wiki/Wikibase/API)。

### API-SPORTS Baseball

- 対応：公式coverageにNPB・MLBあり。日程/過去試合/順位等。必要な選手別splitやpitch計測まで揃うことは未確認。
- 無料枠・認証：公式ページは100 requests/day、直接dashboardはUTC 00:00にquota reset。APIキー方式。無料での対象年/endpoint範囲と必要フィールドは契約前に確認する。
- 更新頻度：endpoint/大会依存。規約上、掲載頻度は保証ではない。
- 規約・保存：追加権利処理が必要な用途があり、アプリの集計保存・再配布・契約終了後保持は要確認。
- 公式保証：事業者の文書化API。リーグ公式無償APIではない。
- 採否・代替：未採用。現時点の不足を無料枠で解決できるとは判断しない。キーをWeb/Androidへ同梱しない。キー保護backendの0円運用とquota管理も未解決。
- 費用注意：直接契約は上限停止と記載される一方、RapidAPI経由は超過課金の可能性がある。本タスクでは登録なし。
- 出典：[coverage・料金](https://api-sports.io/sports/baseball)、[仕様入口](https://api-sports.io/documentation/baseball/v1)、[規約](https://api-sports.io/terms)。同名に近い別ドメインのサービスと混同しない。

### SportsDataIO / Sportradar

| 項目 | SportsDataIO | Sportradar |
|---|---|---|
| 対応 | MLB。NPBの必要粒度は未確認 | MLB、Global Baseball。NPBの対象大会/年/粒度は要確認 |
| データ | 選手/チーム/試合/成績など | MLB base、別packageのStatcast等 |
| 無料枠 | free trialはscrambled dataで、実分析には使えない | 原則30日trial。永続無料の本番提供ではない |
| 認証 | API key | API key、trial / productionの区別 |
| 更新 | feed/endpoint依存、実契約の条件を確認 | trialとproductionの更新頻度は基本同等、endpoint依存 |
| 規約/保存 | 再配布、キャッシュ期間は契約確認が必要 | 再配布、キャッシュ期間は契約確認が必要 |
| API保証 | 事業者の文書化API | 事業者の文書化API |
| 採否/代替 | 月額0円の現行実成績基盤には不採用 | 月額0円の継続基盤には不採用 |

出典：[SportsDataIO developers](https://sportsdata.io/developers)、[scrambled data](https://sportsdata.io/help/scrambled-data)、[Sportradar account / trial](https://developer.sportradar.com/getting-started/docs/your-account)、[Global Baseball endpoints](https://developer.sportradar.com/baseball/v1/reference/global-baseball-v1-endpoints)。試用開始・有料申込は行っていない。

## 実Providerを採用する前の確認

対象league/year/metricのレスポンス例、欠測定義、機械取得と保存・集計・再配布の許諾、認証/無料quota、更新周期、CORS/Android通信、ID対応を揃える。利用条件が未確定のProviderはコード上でも無効にし、「無料で取れた」だけで既定Providerにしない。
