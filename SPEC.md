# Baseball Notes — Product Specification

Status: 完成版要件の統合基準（2026-10-28）。実装・収録・本番運用・正式リリースがすべて完了したという意味ではない。まず [§0 完成版の要件](#completion-baseline) を読む。機能別の詳細契約は後続節、実施順と確認済み範囲は [完成までの作業計画](docs/product-completion-plan.md) にまとめる。

Competition scope: Regular Season and Postseason are first-class, separate scopes. Absent legacy scope means Regular Season. Postseason has canonical Series, explicit rounds, rule advantages and independently admitted stats/analysis; its numbers never enter regular Season/Recent/Records/rankings. NPB CS Final advantage is not a played Game. Current/Historical availability depends on each league's verified source rights. See `docs/postseason.md`.

Historical honors are independent annual source records, not inferred rankings or new season statistics. Supplemental inning scoreboards preserve existing Game identities and totals; unknown innings never become zero. See `docs/baseball-honors-scoreboard.md`.
Honors can be explored by year or by independently identified source recipient, including winners without a collected statistics profile. Recipient history does not create a canonical player, complete career, or missing season statistics. See `docs/honors-player-discovery.md`.

---

<a id="completion-baseline"></a>

## 0. Completion baseline — 完成版の要件

### 0.1 製品の軸と仕様の読み方

**NPBに特化し、好きな選手の今・変化・歩みを一年を通して追える野球アプリ。** NPBの現役選手を中心に、試合、過去成績、比較、記録、ドラフト、移籍・退団・引退、契約更改をつなぐ。MLB Historicalは補助機能として既存データ・機能を維持する。一球速報は中心機能にしない。

開発・情報設計・完成判定はNPBを最優先とする。当面はNPBのHOT・試合別MVPを実際のNPB成績で利用できる状態と、移籍・退団・戦力外・自由契約・引退・契約更改の出典付き実データを優先する。NPBの一部が外部制限中でも、他の独立したNPB開発を進める。単独のMLB新機能・収録拡張は、ユーザーが明示的に求めた場合を除き優先しない。共通処理の検証や既存MLBの回帰・保守は継続するが、MLBでの成功をNPBの実データ・母数・Coverage・本番証拠の代用にしない。

初回起動・既定ホーム・主要な利用体験はNPBを基準とする。明示的なMLBのURL、保存済み情報、既存の収録範囲と権利Gateは維持する。この優先順位を理由にNPBの未収録データを生成したり、HOT/RankingやMVPの選考条件を緩和したりしない。

本節が現在の製品優先順位・提供範囲・完成判定の基準。従来の節番号と技術契約は保持する。§27/§29の初期タスク境界、日付付き実証記録、旧画面案を現在の進捗や実装制限へ読み替えない。Source、Canonical identity、Facts、Coverage、Production Gate、保存形式、immutable assetの保護は引き続き有効で、本節を理由に緩和しない。実装済みの機能を重複開発せず、既存の導線と計算を接続・完成させる。

### 0.2 提供範囲と完了状態

- **本体要件（R01–R12）**：完成版が提供する体験。データや所有者操作の不足で満たせない項目は未完了として残す。画面、型、workflow、fixtureがあるだけでは完了しない。
- **条件付き拡張**：MLB Current、球種・計測・守備・走塁・捕手の詳細、網羅的な二軍/マイナー、全選手写真・公式ロゴ。Source・粒度・identity・権利が確認できた範囲から採用する。機能を構想から削除せず、本体と別に提供可否を記録する。
- **任意の強化**：生成AIの候補選択・短い説明。統計、検索、比較、記録、通知の根拠処理はAIなしで成立させる。クラウド同期・アカウント必須化も本体の前提にしない。
- 各リリースはLeague / season / competition / stage / 対象選手・試合 / 指標 / 更新時点 / Coverage / Sourceを宣言する。古い一部収録データを最新Current、収録分合計を完全通算、収録内順位を公式・歴代ランキングと呼ばない。
- 部分収録でも根拠付きの表示・比較は可能。ただし、完全性を必要とするランキング・記録達成・対象日全体の選考は、その個別条件を満たすまで公開しない。本体の不足を「条件付き拡張」へ黙って移して完成扱いにしない。
- Web/PWA公開、機能の完成、継続運用の確認、Android正式リリースは別の判定。未解決の必須要件がある段階では、実際に満たした対象範囲のみを公開・報告する。

### 0.3 完成版の機能要件

| ID | 要件 | 完成条件 |
|---|---|---|
| R01 | 自分向けのホームと年間体験 | お気に入り球団・選手の結果、次戦、最近の変化へ短い導線で進める。春・公式戦・CS/日本シリーズ・ドラフト・FA期の内容が利用者の関心と時期に合い、特集が通常導線を圧迫しない。対象外・未収録・更新失敗を「試合なし」「変化なし」にしない。 |
| R02 | 試合・シリーズ | 一覧→試合詳細→出場選手・個人成績→選手分析がつながる。公式戦、オープン戦、CS First/Final、日本シリーズ、MLB Historical Postseasonを独立した成績範囲で扱う。試合結果、イニング別得点、シリーズ勝敗・勝ち上がり、次戦を同じ検証済み根拠から表示し、未収録の個人成績・予告先発を補わない。 |
| R03 | 選手の歩み | プロフィール、年度別成績、推移、自己ベスト、通算/収録分、表彰、所属履歴、経歴を既存の選手identityで接続する。現在の球団・背番号・登録状態には独立した根拠と確認時点が必要。Historical-only選手を現役Directoryへ混入させず、受賞年の成績がなくても表彰歴のみを表示できる。 |
| R04 | 比較・変化の理解 | 同年度、過去の本人、日本の同学年、ドラフト同期、同年齢シーズン、移籍前後を比較できる。年末年齢による年度比較と誕生日到達時点の比較は別の定義とする。必要な日別Factsがないときに年度合計を誕生日までの成績へ変換しない。比較ごとの期間、母数、球団、欠損、基準を確認できる。 |
| R05 | 記録・表彰・Record Watch | 検証済みの完全通算を持つ対象では通算記録への接近・達成を追える。収録分の節目は別表示とし、完全通算Record Watchの代用で完了扱いにしない。歴代・年代・現役別の比較は母集団・資格・収録範囲を明示する。正式表彰とアプリ独自選出を分け、同時受賞、当時の球団・部門・制度名、出典を保持する。 |
| R06 | ドラフトから成長を追う | 候補→予想→指名→入団→収録済みの二軍/一軍成績・成長へたどれる。高校・大学・社会人・独立リーグの資格を区別し、名前だけで既存選手へ統合しない。予想は確認時点・版を固定し、実結果を混ぜず答え合わせする。二軍/マイナーの不足や新人資格未確認を、成績ゼロ・正式な新人資格へ置き換えない。 |
| R07 | オフシーズン・球団情報 | FA、ポスティング、移籍、入団、退団、戦力外、自由契約、引退を別の事象として時系列と球団別IN/OUTで探索できる。Official / Reported / Encyclopedia record / Predictionを区別し、出典・確認時点・訂正を残す。記事にある移籍観測から現在所属や契約確定を推測しない。球団から所属時点・年度成績・選手へ進める。 |
| R08 | 週間・月間・シーズンの発見 | 既存の検証済みデータから結果、得失点、成績推移、注目理由と母数を示せる。HOT/急上昇/日別MVPは既存の最低母数・対象範囲・Gateを守る。イニングスコアから出場経過・打席内容・因果関係を生成しない。AIは構造化した候補・指標参照の選択に限定し、未知の選手・数字・試合を足さない。 |
| R09 | My・通知・保存情報の持ち運び | Favorites、Collections、保存した比較/検索条件、Watchを接続する。アプリ内の確認差分とバックグラウンド配信を分け、後者は実配信証拠が必要。種類・頻度/時間帯・停止、重複抑制・訂正を扱う。アカウントなしでも個人保存の安全な書出し/復元/移行ができる。 |
| R10 | データの信頼性・継続運用・年度切替 | 許された取得・保存・加工・Web/Android表示の範囲だけを採用する。本人照合、率の構成値、整数アウト、球団別行、未収録/null/0、SourceとCoverageを維持する。正常Scheduled、整合性、バックアップ/新規scratchへの復元、公開readbackの実証を得る。2027年等へ切り替えても旧年度・ID・URL・保存情報を保持する。 |
| R11 | スマートフォンの体験品質 | 既存のコンパクトなデザイン・5つの主要導線を再利用する。新規画面は画像生成→既存UIとの照合→実装→実画面比較を必須にする。通常サイズの360–390pxで文字・余白・情報量を確認し、Light/Dark、150%/200%、Back、キーボード、表・グラフの代替テキストも検証する。写真/ロゴは個別に利用可能な素材だけを使う。 |
| R12 | 配布・更新・正式リリース | Web/PWAのホーム画面起動・更新・保存済みオフライン表示と、Androidパッケージの署名付き更新を別に検証する。データ更新とアプリ本体更新を混同しない。Pixel/TalkBack、正式署名、App Links、Privacy/Data Safety、所有者のストア手続きは実際の証拠が必要で、エミュレーターやunsigned AABで代用しない。 |

### 0.4 一連の体験としての受け入れ条件

各体験は実際の採用データで検証する。fixtureで境界値を試せても、未開催・未収録の実データや本番成功の証拠にはしない。

| ID | 利用者が完結できること | 重要な境界 |
|---|---|---|
| J01 | ホーム→試合→選手→年度推移→比較→フォロー→次回の変化確認 | 年度・試合区分・選手IDを保持。未収録の成績は短い状態表示と利用可能な移動先を示す。 |
| J02 | 公式戦/CS/日本シリーズ/オープン戦を選び、試合・シリーズと選手成績を調べる | データがない試合区分を利用可能に見せない。スコアだけの試合でも、その事実と未収録の詳細を区別する。 |
| J03 | 年度、同学年、同期、同年齢、移籍前後で選手を比較し、条件を保存して再訪する | 学年・年齢・資格が不明なら一致を推測しない。率を年度の単純平均にせず、リーグ・時代・期間差を明示する。 |
| J04 | 通算記録の対象選手を選び、節目の根拠・達成・表彰歴・受賞年度へたどる | 完全通算と収録分、公式表彰と独自評価、成績未収録の受賞年を区別する。 |
| J05 | ドラフト候補→保存予想→実結果→入団→成長→移籍/FA/引退を追う | 候補identity、プロ入り後のCanonical ID、事象の確定度、出典、訂正を保持。経路の予約だけでは完了しない。 |
| J06 | 保存情報を書き出し、別環境で検証・確認して復元し、元の条件で再開する | 全個人保存の対象/除外を宣言。schema/version/サイズ/参照を検証し、重複・マージ/置換を確認する。失敗時は旧状態を維持。秘密・制限付きFacts/Raw/キャッシュを混ぜない。 |
| J07 | 更新失敗/オフライン/新年度/アプリ更新後も、保存情報と以前のデータへ戻る | 未取得・stale・no_gamesを分離。署名不一致をアンインストール・データ削除・無断再署名で突破しない。 |

J05は発生済みの段階だけを扱い、後続段階は別の実在選手の事例でも検証できる。2026年指名選手が引退するまで完成を待つ設計にはせず、将来の入団・FA・引退や、保存していない事前予想は作らない。J06のWatch数値baseline・統計を含む本文にはSourceのexport条件を適用する。可搬にできない場合は個人設定・参照ID・既読状態等の許される範囲を移行し、baselineを再確立する。復元直後の初回観測を新たな活躍・達成として通知しない。

### 0.5 完成・公開の判定

1. **機能**：対象R/Jごとに、実際の導線、採用範囲、未対応範囲、関連テスト、実画面の証拠を記録する。公開URL・型・画面の存在だけを完了根拠にしない。
2. **データ**：Source条件、本人照合、Coverage、統計検証、採用version/hashを確認する。独立した対象母集団がない場合にcompleteを宣言しない。公開前後で既存immutableデータ・ID・参照・保存形式を照合する。
3. **運用**：既存Production Gateが要求する実Scheduled・バックアップ/復元・readbackの証拠を確認する。DB制限中は最後の検証済み公開データを扱い、制限回避・無制限リトライをしない。期限到来や静的公開成功をDB復旧と呼ばない。
4. **UI/端末**：通常サイズの実画面と文字拡大を別々に評価する。機能テストだけで見た目を合格にしない。エミュレーター、Pixel、TalkBack、署名付き更新を別に記録し、未実施は未実施のまま残す。
5. **配布**：Web/PWA公開済み、Android engineering-ready、実機確認済み、正式署名/ストア提出可能、正式公開済みを分離する。所有者操作が残る段階ではストア提出可能・全体完成と報告しない。

各項目の状態は「未着手 / 実装・接続中 / 検証待ち / 外部依存で保留 / 宣言した範囲で完了」で管理し、保留には不足証拠と再開条件を付ける。条件付き拡張の不採用と、本体要件の未完了は別に記録する。古い棚卸しの完成率やPASSを新しい版へ流用しない。

### 0.6 固定条件と実施方針

- 追加月額¥0。支出・有料API・継続課金・契約/鍵/署名/アカウント等の所有者操作は既存の事前承認条件を維持する。問い合わせ・許諾申請は原則行わず、公開条件で評価する。
- NPB Current、MLB Historical、Canonical ID、Facts、Coverage、Production Gate、HOT/Ranking Gate、出典、個人保存、既存URLとimmutable assetを保全する。新要件が追加されてもGateを開ける根拠にはしない。
- AI候補と公開済み統計を分離し、失敗履歴・入力hash・無料枠を維持する。未検証候補の自動公開や有料fallbackを導入しない。
- 初期表示で全年度・全選手・全競技区分を読み込まない。既存reader/cache/集計を再利用し、取得回数・容量・初期表示を変更前後で測る。公開可能な個人保存と、再配布が制限された成績データのexportは別扱いにする。
- 実装は小さく独立してレビュー・テスト・revertできる単位に分割する。外部Source/DB/実機待ちで独立作業を停止せず、未解決依存を推測で突破しない。現在の承認済みUIの全面再設計を再開しない。

---

## 1. Product vision

Create an Android-smartphone-first baseball data application for NPB and MLB fans, distributed through Web/PWA and the maintained native Android foundation. Prioritize NPB active-player context and year-round discovery; retain MLB Historical and legitimately richer MLB capabilities. The current completion baseline is §0, not the initial Phase 0 task description.

The product should answer questions such as:

- Who is performing best right now?
- Who has become hotter or colder recently?
- What does this statistic actually mean?
- How does this player compare with peers, past seasons, or historical players?
- Which milestones are approaching?
- What happened to past draft classes?
- Which draft prospects, prospects, rookies, FA players, posting candidates, or preseason performers are worth watching?
- What does the richer MLB data reveal that ordinary box scores do not?

The app is deliberately **not** a pitch-by-pitch速報 product. Live pitch-by-pitch usage is left to established速報 apps. The product concentrates on data, interpretation, discovery, historical context, and seasonal baseball stories.

---

## 2. Primary audience

Primary user:
- A normal baseball fan.
- Interested in statistics and player performance.
- Does not necessarily know sabermetric terminology.
- Wants deeper information without needing a specialist analytics site.

Design rule:
> Keep the data rich, but make the meaning understandable.

Advanced metrics must not be hidden merely because they are advanced. Instead, provide accessible explanations.

Example:

**Barrel% — 17.8%**
- What it measures: percentage of batted balls with an ideal combination of exit velocity and launch angle.
- How to read it: higher is generally better for power production.
- Context: show percentile or league-relative context when reliable data permits.

---

## 3. Hard constraints

1. Android smartphone app first.
2. Preserve both NPB and MLB support; prioritize NPB active-player completion and retain MLB Historical without artificial feature parity.
3. Additional recurring monthly operating cost must remain ¥0 unless explicitly approved later.
4. Use only data sources whose use is compatible with the intended application.
5. Do not rely on prohibited scraping, reverse engineering, or undocumented private APIs.
6. AI is optional and must never be required for the core product to work.
7. Implementation must be incremental and reviewable.
8. The codebase must be designed so data providers can be replaced.
9. No requirement for pitch-by-pitch速報.
10. Repository cleanup is part of normal completion of every task.

---

## 4. Product principles

### 4.1 Rich data, simple presentation
Store and support useful permitted data, prioritizing NPB active players and retaining MLB's legitimately richer historical data. Progressively disclose it in the UI.

### 4.2 MLB can be richer than NPB
Do not reduce MLB to artificial parity with NPB.

If MLB legitimately provides:
- Statcast metrics,
- detailed batted-ball metrics,
- pitch metrics,
- defense,
- running,
- rolling windows,
- historical datasets,
- prospect information,

the app should be capable of using them.

### 4.3 Never fabricate missing parity
If an NPB equivalent is unavailable, show that the metric is unavailable for that league/source. Do not estimate or invent it merely to fill the screen.

### 4.4 Historical accumulation is an asset
Daily or periodic snapshots should be stored where practical so the app can compute:
- 7-day,
- 14-day,
- 30-day,
- monthly,
- season,
- trend,
- delta,
- streak,
- and historical comparisons.

### 4.5 Seasonal relevance
The app should change emphasis across the baseball calendar rather than present a static home screen all year.

---

## 5. Navigation concept

Final navigation may evolve during UI design, but the information architecture should support:

Implemented redesign (2026-09-30): Home / Games / Players / Records / My. Player-context tabs contain Analysis; Explore and Profile contain structured future destinations marked Coming Soon. MLB emphasizes verified Japanese-player discovery within its imported historical scope. See `docs/ui-redesign.md`. This supersedes prior screen/card layouts, not data capabilities or source rights.

Sports-data refinement (2026-10-01): aligned scoreboards, ruled metric/leaderboard grids and compact season context replace decorative hero copy. Metric labels provide local tap/keyboard explanations; qualification and uncertain data remain separately discoverable. See `docs/sports-ui-research.md`.

- Home
- Hot / Rankings
- Players
- Records
- Future / Draft / Prospects
- Seasonal modules
- My / Favorites

Search must be easily accessible.

NPB / MLB filters should be available globally where appropriate.

---

## 6. Home

Home combines personalized and timely information.

During the 2026 Japan Series editorial period, the admitted static series snapshot appears before Regular controls: collected latest result, scoped series wins, next recorded schedule, and probable-starter availability/link. Missing results and starters are never inferred. This feature may add one bounded static JSON fetch, without querying Current APIs or changing production gates. See `docs/japan-series-home.md`.

Core sections:

### 6.1 My
Favorite teams and players.

Examples:
- recent performance,
- ranking position,
- milestones,
- noteworthy movement,
- seasonal status.

### 6.2 Hot
Recently strong players.

Default windows:
- 7 days
- 14 days
- 30 days
- current month
- season

### 6.3 Now
Current relevant baseball information, not pitch-by-pitch速報.

Examples:
- completed game results,
- standout performances,
- milestone achievements,
- notable recent statistical changes.

### 6.4 Season
Dynamic seasonal module.

Examples:
- preseason in spring,
- MLB draft,
- NPB draft,
- pennant/record races,
- FA/posting/hot stove in the offseason.

---

## 7. Hot / recent-form analysis

This is a core product feature.

### 7.1 Periods
Support where data permits:
- today / most recent game,
- 7 days,
- 14 days,
- 30 days,
- calendar month,
- season.

### 7.2 Hitter rankings
Examples:
- AVG
- OBP
- SLG
- OPS
- HR
- RBI
- hits
- runs
- walks
- strikeout rate
- stolen bases
- situational stats where reliable

### 7.3 Pitcher rankings
Examples:
- ERA
- WHIP
- wins
- saves
- holds
- strikeouts
- K/9
- BB/9
- opponent AVG
- quality starts where available
- recent-start / recent-appearance performance

### 7.4 Hot / rising / cooling signals
The app should calculate changes such as:
- recent window vs season baseline,
- current month vs prior month,
- recent 30 days vs previous 30 days,
- rolling trend changes.

Labels such as “hot”, “rising”, or “cooling” must be based on transparent statistical rules rather than arbitrary AI judgment.

### 7.5 Qualification
Rankings must provide appropriate minimum-sample options such as:
- all players,
- qualified / qualification-equivalent,
- minimum plate appearances / innings / appearances.

The rule must be visible.

---

## 8. Player directory and player profiles

### 8.1 Search
Search NPB and MLB players by:
- Japanese name,
- romanized / English name where available,
- team,
- position.

### 8.2 Profile overview
Use permitted structured sources where possible.

Potential data:
- name,
- name readings / English name,
- date of birth,
- age,
- birthplace,
- nationality where appropriate,
- height,
- weight,
- bats / throws,
- position,
- jersey number,
- current team,
- previous teams,
- amateur history / school history where available,
- draft information,
- professional debut,
- awards,
- career timeline.

### 8.3 Statistics tabs
Suggested presentation:
- Overview
- Season
- Recent
- Career / yearly
- Records
- Advanced
- Career / timeline

### 8.4 Metric explanations
Every unfamiliar statistic should expose an info action containing:
- name,
- full name if abbreviated,
- plain-language definition,
- interpretation,
- rough context or league-relative percentile when defensible,
- caveats.

---

## 9. MLB advanced data

Use useful permitted MLB data as broadly as practical.

The exact data source and licensing/usage conditions must be verified before production use.

Potential categories include:

### 9.1 Hitting / batted ball
- Exit Velocity
- Max Exit Velocity
- Launch Angle
- Hard-Hit%
- Barrel%
- xBA
- xSLG
- xwOBA
- wOBA where available
- Bat Speed
- squared-up / swing-related metrics where available
- home-run distance
- spray / batted-ball distributions where permitted

### 9.2 Pitching
- pitch velocity
- max velocity
- spin rate
- pitch movement
- pitch usage
- whiff rate
- chase rate
- strikeout / walk metrics
- expected statistics
- pitch-type performance

### 9.3 Defense
- OAA and related permitted metrics
- position-based defensive metrics

### 9.4 Running
- Sprint Speed
- baserunning metrics where available

### 9.5 Trend analysis
Advanced MLB data should support:
- recent rolling windows,
- changes from season baseline,
- player percentile context,
- year-over-year changes,
- “what changed recently?” views.

Advanced metrics must remain understandable to non-experts.

---

## 10. Records

### 10.1 Historical rankings
Support NPB and MLB historical rankings where reliable and permitted.

Examples:
- HR
- hits
- RBI
- runs
- stolen bases
- wins
- saves
- strikeouts
- games
- rate statistics where qualification is valid.

### 10.2 Filters
Where meaningful:
- all-time
- active players
- league
- position
- age
- season
- era / date range.

### 10.3 Record Watch
Show approaching milestones.

Examples:
- 2,000 hits
- 200 / 300 / 500 HR
- 200 wins
- 2,000 strikeouts
- league-specific significant thresholds.

Example:
> 200 HRまであと3

### 10.4 Achievement integration
When a milestone is reached:
- update player record status,
- create a notification if enabled,
- show historical context.

---

## 11. Comparisons

### 11.1 Player vs player
Compare:
- recent 7 / 14 / 30 days,
- season,
- career,
- age-equivalent point,
- advanced MLB metrics where both players have data.

### 11.2 Same-age comparison
Examples:
- career HR through age 26,
- hits through age 25,
- wins through age 27.

### 11.3 Draft-class comparison
Compare players from the same draft class over time.

---

## 12. Streaks

Potential streaks:
- consecutive games with a hit,
- consecutive games with HR / RBI where useful,
- consecutive scoreless innings,
- winning streaks for pitchers where contextually meaningful,
- on-base streaks,
- other measurable streaks.

Streak logic must be deterministic and test-covered.

---

## 13. Draft

Draft modules are seasonal but historical draft data remains accessible.

### 13.1 NPB Draft
Support:
- draft date / event overview,
- notable prospects,
- prospect profiles,
- position,
- school / university / club,
- physical profile,
- available statistics,
- recent performances,
- draft history,
- favorite prospects.

### 13.2 Draft prediction aggregation
Do not present AI-generated guesses as fact.

Preferred approach:
- aggregate clearly sourced media predictions where reuse is permitted,
- show number of sources linking a prospect/team,
- show change over time,
- distinguish official, reported, and prediction information.

### 13.3 Draft day
When official results become available:
- attach drafted player to team,
- preserve pre-draft profile,
- continue the player lifecycle into professional data.

### 13.4 Historical draft
Allow exploration by year:
- team selections,
- round,
- later career results,
- draft-class rankings/comparisons.

### 13.5 MLB Draft
Support MLB draft/prospect information where reliable permitted data is available.

---

## 14. Prospects / farm / minors / rookies

Support progressively:
- NPB farm players,
- MLB minor-league prospects,
- prospect lists where permitted,
- recent prospect performance,
- rookie watch,
- transition from draft prospect to professional player.

Avoid editorial claims such as “will definitely be promoted.” Show the underlying performance and sourced reporting instead.

---

## 15. Offseason / Hot Stove

### 15.1 FA
Track:
- eligibility,
- declaration,
- status,
- official signing,
- previous team,
- new team,
- recent/career stats.

### 15.2 Posting
Track:
- official posting process,
- dates / deadlines,
- official result,
- NPB-to-MLB history,
- related sourced reporting.

### 15.3 Movement
Support:
- trades,
- released players,
- retirement,
- active-player draft where applicable,
- new foreign players,
- team additions and departures.

### 15.4 Information confidence
Clearly separate:
- Official
- Reported
- Prediction / rumor

Never render rumor as confirmed fact.

### 15.5 Team IN / OUT
Provide a team-level offseason ledger:
- additions,
- departures,
- draft,
- FA,
- trades,
- foreign players,
- retirement/release.

---

## 16. Preseason / open games / spring

### 16.1 Current preseason
Show:
- team records,
- standings,
- hitter performance,
- pitcher performance,
- rookies,
- new foreign players,
- roster competition.

### 16.2 Historical comparison
Compare:
- preseason ranking vs regular-season finish,
- preseason player performance vs regular-season performance,
- historical outcomes for preseason leaders.

### 16.3 “Does preseason predict the season?”
Create data-driven historical views rather than unsupported conclusions.

Examples:
- average regular-season finish after top-3 preseason finish,
- preseason batting leader’s eventual regular-season line,
- year-by-year comparison.

### 16.4 Position competition
Where data permits, compare players competing for similar roles without making unsupported roster predictions.

---

## 17. Favorites / My Baseball

Initial version:
- no account required,
- local device persistence.

Allow favorite:
- teams,
- players,
- draft prospects where applicable.

My view should surface:
- recent-form changes,
- ranking positions,
- record milestones,
- official movement,
- seasonal updates.

---

## 18. Notifications

Notifications are in scope.

Do not build generic pitch-by-pitch scoring alerts as the primary notification system.

Categories may include:
- milestone achieved,
- milestone approaching,
- favorite player enters a defined recent-form leaderboard,
- significant hot/rising signal,
- official FA signing,
- official posting update,
- official draft selection,
- favorite team significant roster movement,
- preseason / rookie / prospect event where rules are clear.

Users must be able to enable/disable categories.

Notifications should be event/rule-driven where possible, not dependent on AI.

---

## 19. News / sourced information

This app should not become a generic news reader.

Use news/sourced content primarily when it adds context to:
- players,
- draft,
- FA,
- posting,
- roster movement,
- prospects,
- significant records.

Prefer:
- headline,
- source,
- date,
- short permitted summary,
- link to original.

Do not reproduce full copyrighted articles.

---

## 20. AI

AI is optional enhancement.

Potential later uses:
- “Explain this stat simply.”
- “Why is this recent performance notable?” using supplied data.
- concise summaries of already-sourced information.
- explain differences between advanced metrics.

Rules:
- never fabricate missing statistics,
- never convert rumor into fact,
- always ground summaries in supplied data/sources,
- core functionality must work with AI disabled,
- free quota constraints must be respected.

Google AI Pro subscription used by the developer is not assumed to equal production API quota. Production AI integration must use a legitimate API/free tier if implemented.

---

## 21. Data strategy

### 21.1 Provider abstraction
The product should define internal domain models independent of individual providers.

Suggested layers:
1. provider adapters
2. validation/normalization
3. internal domain models
4. derived-stat calculation
5. cache/persistence
6. UI

### 21.2 Data categories
Separate:
- relatively static profile data,
- historical datasets,
- season totals,
- daily snapshots,
- derived rolling metrics,
- seasonal/event information,
- news/source references,
- advanced MLB data.

### 21.3 “Use all useful data” interpretation
The goal is broad data coverage, not uncontrolled ingestion.

Store/use data when:
- it is permitted,
- useful for current or plausible future product features,
- economical within the ¥0 constraint,
- and storage/processing is reasonable.

Do not automatically persist enormous raw pitch/event feeds merely because they exist if the product does not use them.

### 21.4 Snapshots
Where permitted and practical, record periodic player/team snapshots to make later rolling-window calculations possible without repeatedly requesting old data.

### 21.5 Staleness
Every remotely updated dataset should support:
- last updated timestamp,
- stale/error state,
- graceful fallback to cached data.

---

## 22. Data-source requirements

Before a provider becomes production-critical, document:
- provider/source,
- league coverage,
- fields/endpoints used,
- authentication,
- quota,
- update frequency,
- licensing/terms considerations,
- caching allowance,
- fallback plan,
- replaceability.

NPB and MLB may use different providers.

No production architecture should be tightly coupled to one undocumented endpoint.

---

## 23. Infrastructure / zero-cost requirement

The architecture must be capable of operating at additional recurring monthly cost of ¥0 for the intended initial personal/small-user use.

Potential free-tier components may include:
- static/web preview hosting,
- serverless functions,
- local device storage,
- free database/storage tiers,
- push-notification free tiers,
- free AI API tier if used.

The architecture task must verify current quotas/terms before selecting any cloud dependency.

Do not treat a developer subscription such as Google AI Pro as an application backend entitlement unless its terms explicitly allow that usage.

---

## 24. App / web development direction

Android smartphones are the primary use case. Retain the existing Web/PWA and Capacitor Android paths, with separate update and release acceptance under R12.

Established implementation:
- TypeScript web UI for fast iteration,
- Capacitor for Android packaging,
- browser preview during development,
- GitHub for source control,
- Vercel may be used for free previews or developer/admin views if useful.

The initial architecture choice is historical, not an instruction to reselect the stack on each task. Any material architecture change needs a documented reason, affected areas, migration risk and rollback path before implementation.

---

## 25. Offline / local behavior

At minimum:
- favorite settings should survive app restarts,
- recently fetched/cached content should remain viewable where feasible,
- stale content must be labeled,
- network failure must not crash primary navigation.

---

## 26. Accessibility / usability

- Touch targets appropriate for smartphones.
- Respect system font scaling; validate normal, 150% and 200% separately.
- Do not communicate important state by color alone.
- Support dark and light themes in every delivered scope.
- Charts/tables must have readable textual context.
- Japanese-first UI, while MLB names/terms may retain appropriate English labels.

---

## 27. Phased implementation

Historical implementation sequence: these phase headings are retained for traceability, not a current progress report or a new instruction to stop at Phase 0. Use §0 and the completion work plan for current priorities. Source/identity/coverage gates and incremental review remain required.

All phases are part of the long-term product. They are **implementation order**, not abandoned scope.

### Phase 0 — Architecture and proof of data
Goal: prove the foundation before building product breadth.

Deliverables:
- chosen technical architecture,
- source tree,
- provider adapter interfaces,
- data-source feasibility notes for NPB and MLB,
- normalized player/team/stat domain models,
- local persistence approach,
- basic navigation shell,
- CI/check commands,
- documented decisions.

Do not implement the full product.

### Phase 1 — Core player foundation
- NPB / MLB league handling
- player directory/search
- player detail
- season and career/basic yearly stats
- metric explanation framework
- favorites
- cached/offline-safe basic behavior

### Phase 2 — Hot / rankings
- 7/14/30 days
- current month
- season
- hitter rankings
- pitcher rankings
- filters / qualification
- rising/cooling calculations
- test coverage for rolling windows

### Phase 3 — Records / history
- career records
- active-player records
- Record Watch
- milestones
- streaks
- player comparison
- same-age comparison

### Phase 4 — Personalization / notifications
- My view
- configurable notifications
- milestone / rankings / movement events
- robust local settings

### Phase 5 — Draft / prospects
- NPB draft
- MLB draft where feasible
- prospect profiles
- prediction aggregation with source/confidence distinction
- draft history
- draft-class follow-up
- rookies/farm/minors progressively

### Phase 6 — Offseason
- FA
- posting
- trades
- release/retirement
- active-player draft
- foreign-player additions
- team IN/OUT

### Phase 7 — Preseason
- current preseason standings/performance
- player performance
- historical preseason-vs-season comparisons
- rookies/new players
- position competition views

### Phase 8 — Deep MLB
- additional Statcast/advanced metrics
- rolling advanced trends
- percentile/context views
- year-over-year advanced changes
- richer pitch/batted-ball/defense/running data as permitted

### Phase 9 — Optional AI enrichment
- simple metric explanation
- grounded performance explanations
- sourced summary assistance

---

## 28. Phase completion rule

A phase is not complete merely because screens exist.

Before advancing:
- relevant functionality works,
- external data failures are handled,
- calculations are tested,
- type/lint/build checks pass,
- major UI flows are manually verified,
- durable decisions are documented,
- obsolete task-related files and old implementation remnants are safely cleaned after reference verification,
- no new recurring paid dependency has been introduced.

---

## 29. Initial Work task boundary

Historical boundary for the first architecture task only. It does not limit ongoing authorized completion work; current product scope and acceptance are in §0. The original text remains below for traceability.

The first Work/Codex task must **not** implement the full roadmap.

It should:
1. read this specification,
2. verify current technical/data-source assumptions,
3. choose and document architecture,
4. create the stable project skeleton,
5. implement only enough vertical functionality to prove the foundation,
6. run checks,
7. clean obsolete task-related files safely,
8. stop and report what is ready for the next small task.

The foundation should make later phases easy to add without forcing a rewrite.

---

## 30. Analysis — approved product scope

Added 2026-09-23. This section extends the roadmap; it does not authorize implementing all analysis phases at once. Analysis explains why a player is performing well, their strengths, and their tendencies to ordinary fans. Rich metrics remain welcome; unfamiliar metrics expose meaning and interpretation on demand, while all analysis values retain denominators, limitations, and a league/player baseline when a reliable comparison exists. AI is not required.

### 30.1 League and provider capabilities

Separate common analysis contracts, MLB advanced analysis, and feasible NPB analysis. Do not implement league checks throughout the UI. An `AnalysisCapability` manifest per provider/league governs controls and availability. Track data access (`available`, `conditional`, `unavailable`, `prohibited`, `research`) separately from implementation (`implemented`, `not-implemented`). Conditional or unverified permission is not permission to fetch.

The source-backed feasibility matrix is in `docs/analysis-capabilities.md`. Review each metric/filter against actual provider documentation, coverage years, authentication, quota, caching and redistribution rights before enabling it. Missing observations, zero observations, unsupported capabilities, unverified rights, and unimplemented features are different states.

Common candidates: AVG, OBP, SLG, OPS, HR, RBI, BB, SO, K%, BB%, ERA, WHIP, K/9, BB/9; handedness, home/away, inning, count, base state, RISP, outs, monthly and recent splits where licensed data supports them. A historical release is not a source of yesterday's current-season statistics.

NPB uses only permitted basic statistics and available recent/handedness/monthly/situation splits. Pitch-level and Hawk-Eye data remain disabled unless machine access, storage, aggregation and reuse are explicitly permitted. Do not infer missing NPB tracking data. MLB can expose richer licensed data independently.

### 30.2 Daily data and time semantics

Analysis uses completed games through the previous day, normally refreshed at most once per day. It is not an in-game feed. Every result must expose:

- source update time, fetch time, aggregation time and revision;
- the actual complete-through baseball date and its named IANA timezone;
- the resolved inclusive date interval, completeness, freshness and warnings;
- an understandable label such as 「分析データは前日終了時点」, plus the actual cutoff when delayed.

Use provider game dates, not the device's timezone, for baseball grouping. Date windows must survive timezone/DST, month/year boundaries and leap days. Never pull today's incomplete games into a trailing window. If the first day of a month has no completed days for that month, show an empty period, not last month's totals. Date-only month/year arithmetic must not be implemented with local-hour subtraction.

Daily aggregation/scheduling is a future implementation task. Do not add paid Cron infrastructure. Corrected data replaces the same aggregate's revision. Fetching old source data must not reset its source-age warning.

### 30.3 Shared AnalysisQuery

One query contract and validator must be used across screens and future adapters. Include league, subject (batter/pitcher/matchup), reference date/timezone, season type, requested metric IDs, grouping, and filters:

| Dimension | Options |
|---|---|
| Period | Season, last 7/14/30 calendar days, current month, previous month, custom inclusive dates |
| Opponent | All, vs RHP/LHP or RHB/LHB, specific pitcher, specific batter |
| Base state | All, empty, runners on, RISP, loaded |
| Outs | All, 0, 1, 2 |
| Count | All, first pitch, pitcher ahead, batter ahead, two strikes, full count, exact balls/strikes |
| Pitch | All, pitch type, configurable velocity interval |
| Context | Home/away, inning or inning band, lead/tied/behind, catcher when supported |

Provider Capability must cover every selected filter, grouping, metric, period and their combination. An unsupported filter must not be ignored or silently widened to All. Unsupported inputs are disabled with a reason. Velocity intervals use explicit units and non-overlapping lower-inclusive / upper-exclusive bounds. Preset thresholds can change without changing stored metric meanings.

### 30.4 Pitcher analysis

When permitted: handedness, recent and monthly form, innings, situations, 7/14/30 days and season baseline comparison.

MLB Pitch Arsenal, per pitch type: Usage%, average/max velocity, spin, vertical/horizontal movement, Zone%, Swing%, Whiff%, Chase%, Called Strike%, CSW%, opponent AVG/SLG, xBA/xSLG/xwOBA and Run Value where available. Retain useful licensed aggregates and their definitions; do not invent a field not provided by the source.

Default inning groups are 1–3, 4–6 and 7+, with individual innings in detail. Representative count groups are first pitch, pitcher ahead, batter ahead, two strikes and full count; exact 0-0 through 3-2 in detail. These groups overlap and must not be summed as a partition. Count is **pre-pitch**. Include handedness, base state, outs and score state only where observed.

### 30.5 Batter analysis and count semantics

Pitch-type candidates: PA, pitches, AVG, SLG, OPS, HR, K%, Whiff%, xBA/xSLG/xwOBA, exit velocity, Hard-Hit%, Barrel%. Do not label strengths/weaknesses from AVG alone. Later deterministic rules must consider league baseline, player baseline and sample size, with a visible rule version.

Count analysis has two distinct populations:

1. `plate-appearance-reached-count`: final outcomes of distinct plate appearances that reached the count, counted once per PA even if multiple foul balls occur at that count.
2. `pitch-at-count`: responses to pitches thrown at that pre-pitch count, counted per pitch.

Never compute the former by treating each pitch row as a PA. Pitch-type batting-result aggregates require an explicit PA attribution rule (for example terminal pitch) and separate pitch-response populations. Combined filters are enabled only when the adapter defines their meaning. RISP, outs, home/away, innings, handedness and lead/tied/behind require the relevant pre-event context.

### 30.6 Velocity and zone

Velocity-band analysis is configurable. Initial UI candidates for four-seam pitches: below 92, [92,95), [95,97), [97,99), 99+ mph. These are examples, not domain constants. Batter/pitcher results may include AVG, xwOBA and Whiff% when valid.

Later heatmaps may show pitch location/usage, Whiff%, opponent xwOBA; batter AVG/xwOBA/Whiff%/Swing%/HR/exit velocity. Keep coordinate system ID/version, units, viewpoint, measurement plane, strike-zone definition and season coverage. Savant's 2026 location/zone changes require a validated conversion or separate comparisons. Do not combine pitch coordinates and batted-ball plot coordinates. Model the coordinate definition now; defer grids, rendering and transforms.

### 30.7 MATCHUP

Entry points: today's games when a permitted schedule/lineup provider exists, player pages, and manual pitcher/batter selection. Direct matchups show PA, AB, H, HR, SO, BB, AVG, OPS when supplied, with a small-sample warning. Separately align the pitcher's actual arsenal usage with the batter's performance against those pitch types; this is contextual comparison, not direct head-to-head evidence.

The basic count UI compares responses to pitches at a pre-pitch count, separately for pitcher and batter; it never calls these final PA outcomes. Later location and velocity-band overlays require aligned coordinates/units and adequate samples. Show population, date window and baseline on each side. Similar pitch shape based on velocity/movement rather than pitch-name alone belongs to a late phase. Do not interpret matchup analysis as certainty about a game's result.

### 30.8 Catcher / battery

Name the feature **「捕手別バッテリー配球傾向」**. When observed catcher ID is available, group pitcher × catcher: usage, first pitch, two-strike counts, hitter handedness, innings, RISP and results. Do not state that the catcher requested a pitch; observed pairing does not identify decision-making causality. Leave room for Framing, Blocking, Pop Time, Arm Strength and other licensed catcher-defense metrics.

### 30.9 Watch integration

Use previous-day analysis to support watching, without pitch-by-pitch速報: today's starter × lineup, three hitters selected from the known batting order, later times through order (1st/2nd/3rd+), and bullpen prior appearance dates/pitch counts/consecutive days. A lineup is labelled confirmed or planned; the app does not infer the live next batter. Today's schedule/lineup is separate from the analysis cutoff and has its own freshness. Do not assert that a reliever will pitch today.

### 30.10 Recent change

Later compare last 30 days vs season, current vs previous month, recent vs previous 30 days. Batter candidates: AVG/OPS/K%/BB%/Hard-Hit%/Barrel%, pitch-type and velocity-band performance. Pitcher candidates: velocity, usage, Whiff%/K%/BB%/xwOBA, movement and pitch-type results. Use configurable deterministic rules, comparison scope and denominator; no AI requirement. Period overlap (last 30 vs season) must be disclosed.

### 30.11 Sample size and metric definitions

Every split/result retains denominators: PA, AB, BF, pitches, swings, outside-zone pitches, BBE, outs/innings, matchups as applicable. Unknown is not zero. Every derived percentage must retain its denominator population and definition version. League-relative values must identify the comparable baseline and its sample size.

Initial configurable warning candidates:

| Context | Warn below |
|---|---|
| batting split | 20 PA |
| pitch-level | 50 pitches |
| batted-ball | 20 BBE |
| pitcher × catcher | 100 pitches |

Show 「サンプルが少ないため参考値」 below the selected threshold; unknown sample size gets a distinct message. Warnings do not automatically remove data. Ranking qualification is a separate policy. Do not mix denominator thresholds with eligibility rules.

### 30.12 Storage and extension contracts

Prefer permitted raw data → bounded aggregation → needed aggregate cache. Do not permanently mirror every MLB pitch into a cloud database. Future aggregates include PitchMix, CountSplit, Batter/PitcherPitchTypeSplit, BatterySplit, ZoneSplit, VelocitySplit and MatchupSplit.

Cache identity must include provider and source revision, schema and aggregation/metric-definition versions, canonical query with all filters, daily reference date, resolved interval, source cutoff, and coordinate definition when applicable. Retention follows the license; enforce a size/entry bound before enabling an analysis cache. Retain counts needed to recompute rates; never average split rates without their proper denominators.

Analysis A originally introduced AnalysisQuery, AnalysisCapability, AnalysisResult, Split, SampleSize, shared freshness, minimal CountState/BaseState and coordinate metadata. Full PitchEvent/BattedBallEvent and detailed PitchMetrics/PitchMix/Battery/Zone/Velocity models still wait for an actual adapter and calculation. Use separate AnalysisProvider and player-directory contracts; no destructive migration of existing favorites/catalog caches.

### 30.13 Implementation sequence and stop rule

- **Analysis A**: feasibility matrix, Query, Capability, Split, SampleSize, freshness and validation. No real-data access without permission.
- **Analysis B**: pitcher pitch mix/results, inning/count/handedness.
- **Analysis C**: batter pitch-type/count/handedness/situation.
- **Analysis D**: direct matchup, arsenal vs batter, count and velocity.
- **Analysis E**: heatmap, trends, recent changes and percentiles.
- **Analysis F**: catcher/battery and defense.
- **Analysis G**: watching integration.

This order guides analysis work inside the existing product roadmap; it does not replace prior features or authorize automatic phase advancement. The initial Analysis A task stopped after architecture review, source matrix, contracts and regression checks. Analysis A was not a claim that daily acquisition or all analysis screens were implemented.

---

## 31. Japanese-first terminology and presentation

### 31.1 Language and explanation density

Japanese is the default UI language. Prefer terms natural to Japanese baseball fans; keep familiar abbreviations such as AVG, OBP, SLG, OPS, ERA, WHIP, WAR, K%, BB%, xwOBA and OAA. Do not translate established abbreviations merely to make every label Japanese. Compact cards emphasize value, short label and trustworthy context. They must not repeat paragraphs explaining AVG, HR, RBI, OPS, ERA, WHIP, strikeouts, wins or saves.

Unfamiliar metrics (for example xBA, xSLG, xwOBA, wOBA, wRC+, Barrel%, Hard-Hit%, Whiff%, Chase%, CSW%, OAA, Run Value, Framing and Sprint Speed) offer a small optional `ⓘ` action. On a phone it opens a short accessible dialog/sheet with Japanese name, what it measures, how to read high/low, and only essential caveats. Do not expand explanations by default. Detailed formulas belong in a later searchable glossary, backed by the same versioned MetricDefinition catalogue. No per-metric AI explanation button; later AI may synthesize a player's traits, recent changes or a MATCHUP, but fixed metric definitions work offline.

When legally available and comparable, place rank, top percentage, league average, positional average or period delta near the value before adding prose. Every comparison names its population, period, season and relevant baseline. Never invent a rank or percentile without a defined comparable population. Convert a percentile to `MLB 上位8%` only after confirming whether its source percentile ranks raw values or performance and whether high/low is favorable. Otherwise show the source's verified label or omit the relative claim.

### 31.2 Units, precision, dates

Keep each provider's original value and unit in domain/source provenance. Presentation converts velocity to km/h (usually one decimal), distance to m or cm, height to cm and weight to kg. Show mph/feet/inches/pounds secondarily only when useful. A shared formatter owns constants, rounding and missing-value behavior. Never overwrite a source mph value with a derived km/h value. AVG/OBP/SLG/OPS normally use three decimals without leading zero (`.318`); ERA two decimals (`2.35`); percentages normally one (`18.2%`); integer counts no decimals. MetricDefinition can set precision for detailed analysis. Missing/unsupported is `—`, not `null`, `undefined`, `NaN` or zero.

Internally distinguish an absolute timestamp from a baseball calendar date and its source time zone. Japanese UI normally displays instants in Asia/Tokyo: `2026年9月23日`, `9月23日`, `18:00`; label local MLB time explicitly if shown. Date-only values do not shift between time zones. Render innings as `1回表`, `1回裏` and so forth, retaining provider top/bottom codes internally.

### 31.3 Names, teams, positions, pitch types

Player identity is stable and distinct from canonical source name, verified Japanese display name and English display name. NPB Japanese names are primary. For MLB, prefer a trusted curated Japanese name where explicitly available; otherwise use the source English name. Search aliases alone do not license an automatically generated katakana display name. Preserve both scripts for profile/search where supported.

Keep team canonical name, Japanese full name, short name and abbreviation/code as separate fields. Use Japanese NPB names and trusted Japanese MLB names when available; fall back without inventing a translation. Full names fit profiles; short names fit compact cards; codes fit dense comparisons.

Normalize provider positions to canonical codes before UI. Use P/C/1B/2B/3B/SS/LF/CF/RF/DH on compact screens, adding OF only when a source says merely “outfielder”. Detail can show `P 投手`, `SS 遊撃手`, etc. SP/RP/CP are roles only when the provider definition supports them, not substitutes for a fielding position. A two-way hitter/pitcher must not be inferred to be DH. Pitch types likewise have canonical identities distinct from source codes and Japanese display names (フォーシーム, シンカー, スライダー, スイーパー, カーブ, チェンジアップ, スプリット, カットボール). Future adapters map provider-specific codes; UI does not display raw provider labels.

### 31.4 Analysis context and scope

Every Analysis/Split value retains its denominator and definition. Show a concise sample next to granular results (`.667 · 3打数2安打`, `Barrel% 18.2% · 87計測打球`) when available. Small samples receive `参考値` or `サンプル少`; unknown denominators are distinct from small denominators. Tapping can reveal the policy threshold and reason. These configurable warnings remain separate from ranking eligibility. Labels such as `得意`, `苦手`, `好相性` or `苦戦` require a documented deterministic rule using a relevant metric, league baseline, player baseline and sufficient sample size; otherwise use neutral wording or `参考値`. AI impression alone is insufficient.

Centralize locale, numbers, units, dates, names, positions, pitch types and metric definitions. Do not hardcode each screen. The Japanese presentation foundation preceded the representative design work in section 32. A glossary screen and the advanced MATCHUP/heatmap phases remain separate work; the MATCHUP/WATCH shell is in section 34.

---

## 32. Android-first design system and representative screens

The approved compact smartphone presentation remains the baseline for all subsequent screens. Before coding a new screen, create and inspect an actual image-generated phone concept that follows this design; retain its reference with the implementation evidence. A desktop mockup or a claim that an image was generated is not sufficient. Reuse the existing mobile type scale and controls, keep ordinary headings/numbers compact, and verify the real implementation at 360–390px in Light/Dark before delivery. Native 150%/200% enlargement is a separate accessibility check and must remain enabled. Detailed workflow and sizes are in `docs/design-system.md`.

The approved visual direction is Modern / Sports / Data / Clean, with usability before ornament. The first visible layer is conclusion or important value; detail appears through clearly labeled rows, tabs, chips and optional explanations. Primary navigation uses five destinations: ホーム / 試合 / 選手 / 記録 / My. Analysis and Watch remain secondary destinations in Player/Home/My context, not additional primary tabs. Player groups overview, recorded seasons/statistics, analysis and career/records through clear existing secondary routes. All routes retain global NPB/MLB switching. Existing bookmarked `/players/:id` URLs remain valid; legacy `/players` and `/favorites` redirect to the new Search/My routes.

The design token layer defines light/dark backgrounds, surfaces, borders, text, brand, semantic states, charts, spacing, radius, typography, elevation, icon sizes and touch targets. Default theme follows the device. Use deep navy/blue sparingly for CTA, links and selection; team color is a small identity accent, not the application theme. Normal UI icons use one SVG set; required baseball-specific icons are original vectors. No official NPB/MLB/team logo is bundled without reviewed application-use permission. Shared Team/League branding chooses a permitted logo or a clearly nonofficial badge/text/monogram fallback. Do not generate confusingly similar official marks or depend on player photos.

Home is a short vertical feed: today's games, favorites, a small relevant discovery set, HOT, Now/Record Watch and season information. Each section exposes only a few items and a clear destination. When a data source is absent, show the correct unavailable state instead of invented games, trends or records. Search finds players and teams; results favor simple rows with name, team, position and league context. Ranking uses a readable list/table with rank, person, value and qualification note, not many cards. Current synthetic ranking is labeled as a sample-only reference; no official/qualified ranking is claimed until denominators and qualification rules exist.

State UI distinguishes loading, empty results, not supported by a provider, source error, feature not implemented and small sample. A displayed zero remains a value. Use Skeleton for structural loading, concise empty copy with one action, and text plus icon/position rather than color alone. Components use normalized domain data and shared Japanese Formatters. Metric explanations remain optional for advanced metrics. Section 33 adds the Analysis UI foundation; section 34 adds the MATCHUP/WATCH shell. Full charts remain future work. See `docs/design-system.md` for tokens and implemented component rules.

---

## 33. Analysis UI — Summary, category, detail

Analysis reuses the section-32 tokens, Japanese Formatters, MetricDefinition, navigation and data states. On Player, show a small summary first, then a limited set of category chips and one detail category at a time. Batters use 概要 / 球種 / カウント / 状況 / 打球・コース / 変化; pitchers use 概要 / 球種 / 配球 / 状況 / コース / 変化. Handedness, base/outs, batting order, score differential, game inning and appearance inning belong under 状況, not top-level tabs. Ball-in-play and recent-change categories are links/sections only when a compatible provider supplies validated aggregates. Never derive a trait claim such as 「得意」「苦戦」「接戦に強い」 from a single rate or a small sample.

Each split shows its sample and a configurable small-sample badge. Granular rows open on demand; pitcher pitch mix uses horizontal usage bars and named, theme-aware pitch colors. Count views keep **PA final outcome after reaching a pre-pitch count** separate from **response to pitches thrown at that count**. Show representative count groups first and exact counts in detail. Relative comparisons require a named population/season, a verified metric direction and source-provided baseline; missing comparison is omitted, never estimated. A 3×3 zone view requires coordinate provenance compatible with the aggregation and shows no fabricated cells.

AnalysisQuery v2 keeps `battingOrder` (1–9), `scoreDifferential` (signed raw runs or named display bucket at PA start), `gameInning` (actual game inning) and `appearanceInning` (the pitcher's nth inning in that appearance) distinct. Times through the batting order is a separate future dimension. Adapters must preserve the raw game inning and pre-event score, identify the pitcher appearance before deriving appearance inning, and record missing/deduced coverage. Capability and validated feature combinations gate each grouping/filter for each provider, league, period, subject and metric. A documented historical MLB field does not enable current-season or NPB UI. Analysis retains the previous-day cutoff, source update time, stale state and sample policy; it does not require live pitches or a cloud raw-pitch archive.

This phase supplies contract-ready UI and an honest unavailable adapter for the current synthetic catalog. Real event-level data, battery defense and AI explanation remain separate work. Section 34 defines the later MATCHUP/WATCH UI task.

---

## 34. MATCHUP / WATCH UI — previous-day context, no live feed

MATCHUP reuses Analysis Query, Result, MetricDefinition, SampleBadge, metric display, pitch color, capability gates and freshness. Routes accept an optional pitcher and batter ID, so player pages can preselect either side; manual search selects the other. A future permitted game/lineup provider can link to the same route. The first view shows the players, direct history and a deterministic attention pitch only when both pitch-type aggregates have at least 50 pitches. It makes no `得意`/`苦戦` claim without a separately documented baseline rule. Direct PA below 20 is labelled `参考値` rather than hidden.

Direct history, pitcher arsenal, batter pitch-type response, count and recent comparisons are independently gated and loaded only for the selected view. The arsenal pairs canonical pitch-type IDs, not name strings, and does not treat each side's season sample as head-to-head evidence. Count means pitch-at-count response; reached-PA outcome remains a distinct Analysis population. Relative values appear only with supplied comparison scope. When one source section fails, available sections remain visible. `AnalysisQuery` and daily cutoff form the future on-demand aggregate/cache key; no all-pairs precomputation or raw-pitch cloud mirror is introduced.

WATCH enters from Home's `今日の試合`, never a sixth bottom tab. A separate WatchProvider supplies schedule, each team's lineup and bullpen usage with separate capabilities/freshness. `今日` uses Japan calendar time; MLB's local game date is retained independently. A game page shows teams, planned starters, a lineup when supplied, a selectable three-hitter window in batting order, links to MATCHUP/Analysis, and prior-day bullpen facts. It does not identify the live next batter, current count, fatigue, or today's reliever availability. Bullpen `completeThrough` must precede today. Missing schedule, lineup and bullpen are separate states, never fictional data.

The current sample source has no real schedule, lineup, appearance log or matchup/pitch observations. Both leagues' live capability flags therefore remain unavailable. MLB public historical Retrosheet files may support bounded retrospective direct matchups and bullpen logs through their released seasons, with required attribution and coverage checks; they do not establish current-day feed rights. MLB.com automated collection is not an adopted path. NPB machine-readable reuse permission remains unverified. The fixture-only test data never reaches production UI. Similar pitch quality, complete location/velocity overlays, times-through-order, live play-by-play, predictions, battery matchup and notifications are out of this phase.

---

## 35. Daily data foundation

The intended production flow is permitted external source → daily collector → validated, normalized facts → own SQL storage → versioned derived aggregates → bounded app payload. User page opens do not trigger source collection. Analysis and MATCHUP use completed games through the previous baseball day. Source permission and coverage are mandatory gates; a historical release never becomes a current-season feed merely because the collector runs daily.

Store game, player-game, appearance, plate-appearance, roster/transaction, milestone and season-final facts long-term where the source permits. Store daily standings snapshots permanently with date, season, division/group, team, rank, W/L/T, percentage, games behind, streak, source and collection time. Rebuild mutable season totals from game facts when possible. Derived splits/HOT/MATCHUP and display payloads remain replaceable. Separate raw source response retention from permitted normalized fact archives. Do not mirror all MLB pitches into the app SQL database; aggregate useful permitted pitch data and keep any bounded archive in a separately reviewed object store.

Each collector run records fetched, inserted, updated, skipped and failed counts. Import is idempotent by source identity, and source corrections update facts and recompute affected snapshots. Validate record shape, known teams, complete-season counts and duplicate IDs before commit; a rejected release cannot overwrite a valid one. Source registry tracks permission state and priority. Candidate sources with unverified automated access or redistribution stay disabled. Backfill uses the same pipeline by explicit season/date range. Retention classes and cleanup never target permanent facts or standings.

Initial proof uses Retrosheet's permitted 2025 MLB gameinfo release, with its required prominent attribution, to construct historical division standings; it does not supply 2026 daily data. SQLite-compatible migrations and repository ports allowed local storage before the remote deployment in section 37; that initial proof did not create an account or publish a site. Local gzip archives and generated static JSON prove the data path. The later remote deployment and its remaining archive, source-permission and backup risks are specified in section 37. See `docs/data-architecture.md`.

## 36. NPB real-data ingestion: bounded first slice

### 36.0 Schedule-aware EOD extension (Batch B-3)

The provisional nf3 adapter may refresh published schedules in daily, weekly, monthly or explicit season ranges. A sequential hourly watcher checks only team schedule/status pages after each canonical JST start plus a configurable 120-minute offset. This overrides the initial at-most-daily request restriction only for bounded schedule/status checks. Score alone is not a new-final signal: both teams must confirm the final result marker and score. Full Player detail is collected only for previously unvalidated final Games. No live UI/feed capability is implied.

All scheduled Games must be terminal and current canonical Facts must pass the existing validator before EOD publication. Independent standings W/L/T must agree with paired schedules before stamping the effective date. Publication is recorded only after public HTTP/schema/date verification. All DB-writing/publishing workflows share one concurrency group; 03:37 JST Daily and 12:17 JST Freshness remain safety paths. A successfully EOD-published/currently valid Day skips Daily reingestion/deployment. Failed publication remains retryable, separate from Fact collection.

Shortened final Games need independent explicit ending evidence (provider, final status, inning/end outs, teams, score and verification time), not inferred fewer pitcher outs. The existing permanent event ledger retains evidence without a schema migration. Participant coverage, PA/BF, runs/hits/HR and other checks remain mandatory. Until a permitted adapter provides evidence, historical rain-called Games remain partial. No Game-ID/date exceptions or NPB official automated ingestion are adopted.

Hourly scheduling offers a best-effort check within the next clock hour after the source exposes a final result; it cannot guarantee 0–60 minutes after actual play ends. Source latency, GitHub queue delay and validation failures remain constraints. GitHub supplies cron but no intended trigger instant: inferred cron-slot delay is a lower bound, with run creation → runner start separately measured. HOT/Ranking readiness and Scheduled proof remain separate gates.

The first NPB production-shaped collector preserves the existing provider → normalization → validation → SQLite/libSQL repository boundary. It must never ingest NPB official Web pages while their footer prohibits secondary use and unauthorized reproduction. A currently public nf3 page without an explicit prohibition may be assessed as `public/no explicit prohibition found`, not as a general legal license; each provider can be disabled at the Source Registry. The provider is not an official or guaranteed API. Keep requests sequential, bounded and at most daily. Do not crawl all players to claim a complete league feed.

For a captured JST business date, store all 12 Central/Pacific standing rows permanently even on a rest day, preserving rank, W/L/T, winning percentage and numeric games behind; display the leader's source dash via Formatter, with canonical zero in storage. Normalize scheduled/final/postponed games to one canonical Game ID, retain source mapping and corrections, and recheck a bounded lookback window. Player game batting/pitching Facts may be imported only for explicitly resolved players and unambiguous games. Baseball innings use integer outs. Missing PA, extra-base hits or walks breakdown remains null. Track standings, games, batting and pitching completion separately; the curated player subset is partial, not a complete NPB capability.

The Home standings slice reads generated and validated own JSON, not nf3 at page-open time. Include source attribution and effective date. The locally generated asset is distinct from the later Pages delivery in section 37. Date-stamped raw captures may be replayed for corrections; never label today's undated standings page as a past day's snapshot. Keep GitHub daily scheduling opt-in until manual remote storage and public-payload verification pass; retain backup and source-condition risk as explicit operations work. See `docs/npb-ingestion.md` for the verified fields and limits.

## 37. NPB daily remote persistence and delivery

The first NPB slice now runs on a public GitHub repository with GitHub Actions and a Tokyo-region Turso Free SQLite-compatible database. Collector-only secrets connect to the remote DB; Android and Web receive no database credential. A validated current-standings JSON and the Web app publish together as one GitHub Pages artifact after collection, stage verification and idempotent replay succeed. The Web app reads same-origin JSON; Android reads the public Pages URL through the same repository adapter. The published payload carries effective date, collection time, generation time and null source update time where nf3 supplies none. On source failure, the previous successful Pages deployment remains; clients may show their last successful local payload with stale status.

The scheduled collector targets the previous completed JST day at approximately 03:37 JST, not live games. GitHub Actions schedules can be delayed or missed, so the ingestion run and freshness must be monitored. `NPB_COLLECTOR_ENABLED` gates the schedule until manual dry-run, remote ingestion, duplicate check and delivery verification pass. Permanent standings/game/player-game facts and source mappings are never retention-cleaned. Local raw responses retain a maximum of 14 days; the remote runner's raw capture is transient and excluded from public artifacts and SQL text columns. A private off-machine Fact backup beyond Turso Free's one-day PITR remains an operations risk, as does nf3's non-guaranteed availability and unconfirmed general redistribution license. No new NPB fields, player-wide crawl, Analysis feed or real-time service is enabled by this deployment. See `docs/npb-remote-delivery.md`.

## 38. NPB one-game participant completeness proof

Before broadening NPB player-game collection, a manual-only collector must demonstrate complete participation for one final game. The selected 2026-09-23 Marines–Buffaloes game is the initial bounded proof. Discover nine starters per team from lineup pages, follow all substitution references in each player game row, and independently enumerate every pitcher with a dated usage page. Resolve each source uniform ID and verified name to a canonical player ID; never silently create an identity from an unmatched name. Preserve batting-order slot, starter/substitute, baseball innings as integer outs, and source provenance. This is an exact-game proof, not a league-wide capability.

Declare a game complete only when all discovered participants map and yield one valid Fact each, starter slots are 1–9 on both teams, pitcher starters and outs are plausible, and player/team totals reconcile with the final score and opposing pitching totals. Store separate batting, pitching and game statuses with expected/collected/mapped counts and failed checks. A missing participant, parser mismatch, unresolved mapping or unverified denominator cannot be labelled complete. Validated Facts are corrected by upsert, never appended as duplicates. PA may be derived from AB+BB+HBP+SH+SF only when every event token and the source's combined walk/HBP column reconcile; otherwise keep null. Pitcher combined walks+HBP must not be split by guess. A verified zero for doubles/triples in one game does not prove nonzero parsing league-wide.

This proof runs only via a separate manual GitHub workflow; it does not change the JST 03:37 daily collector or ingest other games. Raw source captures remain local or runner-temporary under the existing 14-day policy; a small source-derived parser fixture remains in tests. Current remote Fact backup and restore risks persist. See `docs/npb-game-proof.md`.

## 39. NPB controlled edge-game proof

Before enabling all-game collection, apply the same participant and completeness pipeline to one different completed 2026 game that contains an explicit nonzero double. The reviewed 2026-09-23 Hawks–Lions 10–3 game is the second manual-only target. Verify all discovered batters and pitchers, source-to-canonical mappings, substitution slots, PA/BF, final runs, hits/home runs, and game-specific defensive outs before saving Facts. The visiting team in a home win with no bottom ninth may record 24 pitching outs; never require 27 outs for every final game. Source-observed two-base hits may be marked verified only for that game. A zero triple, HBP, SH, SF, hold or save does not verify nonzero parsing in production data.

Keep the existing daily four-player subset, Repository, migrations and nf3 Source Registry gate. The extra target remains a fixed manual workflow choice with an exact game identity and final-score check. Do not enable all-game daily collection from this proof alone. Missing independent team extra-base totals, fractional relief innings, rare scoring cases and off-machine Fact backup remain explicit risks. See `docs/npb-game-edge-proof.md`.

## 40. NPB bounded edge-case proof before all-game ingestion

Use at most two additional completed official games as manual targets to verify nonzero 3B/HBP/SH/SF where observed, fractional pitching innings, relief decisions, combined pitcher four-dead-ball counts, and nonstandard final-out shapes. The existing nf3 provider, canonical mapping, game completeness gate, repository and Turso schema remain authoritative. Do not add per-game parsing exceptions, another source, new migrations merely for these observations, or all-game collection to the daily workflow.

A complete game requires all independently discovered batters and pitchers to map and yield one valid Fact each, reliable PA for every batting row, PA/BF and score reconciliation, one starter pitcher per club, and a plausible completed-game defensive-out shape. For normal away wins or ties, both staffs record the same whole-inning total of at least 27 outs. For home wins, the visiting staff may record one to three fewer outs than the home staff, including a skipped home ninth or a walk-off. Without an independently published final-inning field, this is a plausibility gate rather than an exact inning audit; shortened, suspended or otherwise ambiguous games remain partial. Missing or unknown PA event tokens also keep the game partial. Do not infer individual pitcher BB/HBP from a combined nf3 value, appearance order from uniform-number order, or a team 2B/3B total from the same player rows used for parsing.

The selected 2026-09-23 Carp–Giants and BayStars–Dragons proofs, their observed fields, tests, source limitations and remote verification are recorded in `docs/npb-game-phase4-proof.md`. Observed nonzero records change only the bounded source Capability evidence; they do not enable NPB Analysis or all-game player-Fact collection. Keep the daily scheduled workflow limited to its existing curated subset until its own scheduled execution and durable backup/restore operations are verified.

## 41. Portable Fact backup and one-day full-slate dry-run

Before changing the daily scheduled collector to all-game player Facts, export Turso's canonical masters, permanent Facts, historical snapshots, source mappings, provenance/ingestion records and migration state to a portable, checksummed, compressed format. Restore into a new empty SQLite/libSQL database, compare every protected table's row count and values, then read standings, game player Facts and completeness through the existing Repository. Generated Pages JSON, caches and expired Raw are regenerable and excluded from protected data. Never publish backup content to Pages or commit it to Git; a runner-local export is a drill, not durable off-provider storage.

The manual 2026-09-23 full-day proof must enumerate final games from the Game Repository, run the existing nf3 participant and completeness pipeline serially with a shared page cache, and perform no DB writes. Each Game and the Day have independent complete/partial/failed outcomes. Parser errors, unsupported PA events, unresolved identities and unknown pitcher result markers must remain visible instead of becoming zero or a valid default. Verify protected DB tables are unchanged before and after the dry-run. Passing this gate permits a separate future task to integrate the previous JST day's games into the scheduled collector; this task does not change the current four-player schedule, perform a season backfill or enable Analysis data.

## 42. NPB scheduled collection and freshness monitoring

The existing 03:37 JST GitHub Actions workflow collects the preceding JST day's final NPB games, verifies complete Games through the remote Repository, exports a portable Fact backup and publishes the validated standings payload. The all-game path is controlled by `NPB_DAY_FACTS_ENABLED`; a failed Game does not roll back complete Games. The public repository may retain only encrypted backup Artifacts for a short period, never plaintext Facts or raw source responses.

An independent lightweight workflow checks the actual published standings JSON after a configurable JST noon deadline. Its expected effective date is the previous Asia/Tokyo calendar day, including days with no games. Missing, invalid, old and future-dated payloads are distinct failures. Freshness of the published date is separate from Day completeness and backup health: a fresh payload with partial ingestion or failed backup requires an operational warning. Turso's latest standings snapshot and Day-run metadata distinguish collection failures from publication failures; GitHub Action and encrypted Artifact metadata support further diagnosis. The monitor never triggers nf3 collection or automatic retries. A failed GitHub Action is the initial alert channel; manual repair remains bounded by available dated Game/Raw evidence. See `docs/npb-freshness-operations.md`.

## 43. Read-only Player Game Fact period aggregation — first slice

For a canonical NPB player ID and a Japan-calendar `asOfDate`, `7d` means the seven inclusive calendar dates ending on that date. This is neither seven games nor the AnalysisQuery convention that excludes its reference day. The caller must choose a completed `asOfDate`; a later app-facing adapter must enforce its previous-day cutoff. Read saved Player Game Facts in one player/date-range Repository query and calculate in the domain/application layer. Do not fetch nf3, change the collector, or persist these derived results as permanent Facts.

Sum nullable counting fields only when every retrieved Fact has a value; otherwise report metric-level partial/unavailable coverage with no misleading complete subtotal. Zero is valid. `G` counts distinct Game IDs, including zero-PA/zero-AB participation, while pitcher appearances count Fact rows. AVG is H/AB; OBP is `(H+BB+HBP)/(AB+BB+HBP+SF)`; SLG uses explicit H/2B/3B/HR total bases divided by AB; OPS is OBP+SLG. Rates are unavailable at zero denominator. Sum integer pitching outs before deriving ERA=`ER*27/outs` and K/9=`SO*27/outs`; never compute WHIP or BB/9 from nf3's combined BB+HBP field. Overall result status describes coverage of *retrieved* Facts and metrics, not proof that every scheduled Game in the seven-day span has been ingested. See `docs/player-period.md`.

## 44. Read-only 7/14/30-day aggregation and collection coverage

The same resolver and formulas support inclusive Japan-calendar `7d`, `14d`, and `30d` windows ending on `asOfDate`. They are calendar-day spans, not recent-game counts. A result has separate metric/Fact `dataStatus` and collection `coverage`. Coverage is proven from dated Day runs, completed Game enumeration, final Games and their batting/pitching completeness; a verified `no_games` day is complete even without Player Facts. Known failed or partial collection yields partial coverage, absent historical proof yields unknown, and inaccessible coverage metadata yields unavailable. A player's nonappearance is not a collection gap. Derived values remain read-only and unpersisted, with no UI or HOT rollout. See `docs/player-period.md`.

## 45. NPB Player Recent Form delivery

Only the Player page's Recent section reads saved NPB Game Facts through the period service and a server-side read-only API. Android and Web clients must not receive Turso credentials. Show 7/14/30 calendar-day selections, the completed as-of date, important batting or pitching metrics before optional details, and collection Coverage independently from metric availability. Unavailable values use a dash; no Fact rows use a no-appearance state, while a 0-PA appearance remains an appearance. API failure stays within the Recent section without substituting sample stats. Formal WHIP remains hidden while pitching BB and HBP are combined in nf3 Facts. Season, career, HOT, Analysis, MATCHUP and WATCH remain outside this connection.

## 46. Canonical NPB Game browsing and local Player Favorites

NPB Home links to a small recent-result index and secondary `日程・結果` route; the five bottom tabs remain Home/Search/Analysis/Records/My. A season manifest selects a date-scoped metadata payload, never an all-season raw Fact download. Unknown schedule is distinct from confirmed no-games. Partial final Games retain known teams/score and their canonical detail route; missing Box Score is explicit. Game Detail reuses the read-only API and preserves nullable stats, shared role classification, and canonical Player navigation. Display order is not exact substitution/bullpen order. No inning score is fabricated.

Player Favorites use canonical IDs in the existing SettingsStore/Capacitor Preferences repository. Search and Profile may toggle them; My resolves display metadata from the real Directory and gracefully retains unresolved IDs. No account, sync, backend table or network write is added. Records uses a small aggregate capability payload. Closed Production Gate means no ranking candidates in that public payload; verified ready payloads render without a UI rewrite. Source permission, Fact validation, Ranking/HOT and Scheduled Operations gates remain independent. This surface may ship with partial historical Coverage.

## Product Expansion Batch 4: local organization and Recent exploration

All-player NPB Recent exploration is a read-only, coverage-aware projection, separate from HOT/ranking. Versioned local Activity, Saved Views and Collections supplement Favorites without changing canonical data or competition semantics. See `docs/product-personalization.md`.

## Product Expansion Batch 5: comparisons and portable views

Support bounded 2–4 Team comparisons, saved-season Player/Team comparisons, local Collection dashboards and canonical-condition URL sharing. Displayed MLB aggregate CSV exports are bounded and credited; provisional NPB data is not exported. Preserve Regular/Postseason, historical/current, null, Coverage and ranking boundaries. See `docs/product-comparison-sharing.md`.

### NPB active-player / competition extension (2026-10-16)

Saved Directory identities can open a dedicated year/competition view from Player. Historical Regular and explicitly labelled NPB postseason aggregates use separate versioned contracts and bounded readers. Their source, coverage, year and stage stay visible; no automatic addition to Current, Regular or full Career. Only admitted player/stage combinations enable 2026 CS choices; uncollected Preseason/Japan Series choices remain disabled. CS observations are partial collected-game aggregates, not full tournament totals or proof of advancement. The independently evidenced conditional CS 2026 rule remains separate from observed results. See docs/npb-active-player-expansion.md and docs/npb-completion-next.md for admitted years, sources, gaps and release evidence. Existing Current and MLB data/gates are unchanged.

### Collected NPB progression and published-response fallback (2026-10-16)

Historical Regular year comparisons show up to four selected years, missing-year gaps, club-year observations and collected-range best values with explicit rate-sample thresholds. They are not complete Career totals or official qualified rankings. Older years are admitted only for independently bridged saved Directory identities; no name-only merge or implied current registration.

When the NPB period API is unavailable, Player/Recent may read already published, validated season or exact 7/14/30-day projections. Show their original dates, partial coverage and inability to verify current freshness. Do not invent daily coverage from a summary, use this fallback as new collection evidence, or feed it into Watch/HOT/Ranking gates. No monthly fallback without a matching published month projection. Home adds no requests.


### NPB peer analysis (2026-10-18)

Historical Regular supports one-season peer discovery by explicit birth year or draft year, with 2–4 canonical players, per-player samples and source credits. Unknown metadata never becomes a matched cohort; no rookie/roster/official-ranking qualification is inferred. Adjacent single-club year observations may show metric differences without inferring transfer timing or causation. See docs/npb-cohorts-and-evidence.md for licensed immutable releases, scope, preserved URLs and operating gates.

## NPB collected player story and year-end age comparison

NPB Historical supports a maximum four-player comparison of seasons where each player's verified birth date makes them the selected age at December 31. This is a collected Regular Season comparison, not cumulative Career through an age/birthday, official qualification or era-adjusted ranking. The existing manifest, Catalog and bounded annual readers preserve identity/null/sample/provenance. Explicit Saved Views retain conditions; automatic Activity does not. Player annual stats also connect confirmed school/Draft/affiliation metadata to actually collected season links on explicit story expansion. See `docs/npb-player-story-age-comparison.md` for unfinished original-vision areas and evidence.

User clarification: the main NPB peer entry groups the same Japanese school grade by verified birthdays **April 2–April 1**, rather than calendar-year births. The complete birth range is displayed; actual school enrollment/graduation is never inferred. `schoolYear` is additive and existing `birthYear` URLs retain their original meaning. Year-end age-season comparison remains a separate analytical view.


### 日本語表記と独立した試合の読みどころ（2026-10-25）

一般画面の投打は共通表示処理で throws→bats の順に統一する（右投左打等）。不明な側を推測せず、公式戦・CS・日本シリーズ・MLB固有シリーズを文脈に応じて表記する。出典の原文・ライセンス文言と内部データ契約は変更しない。

CS・日本シリーズの注目選手は、収録済みCSの試合別観測を根拠とする実績と、保存済み公式戦からの独自の注目を分ける。対象ステージ・試合・母数・部分収録・出典を示し、個人成績未収録の日本シリーズの実績とは称しない。

日別MVPは公式表彰ではない独自選出。公式戦の当日の全終了試合が収録完了で、保存済み試合別成績・日付・ID・球団・スコアを照合できる場合のみ判定する。新規DB読み取りを増やさず、既存の公開レスポンスキャッシュから確認し、不足時は選出保留。CSの部分収録・日本シリーズの個人成績未収録からMVPを捏造しない。HOT/Ranking Gateとは独立する。詳細は docs/baseball-language-and-postseason-readings.md。

### 任意AIの編集候補（初期基盤）

AIは正式Factや公開Gateの根拠にせず、採用済みimmutable snapshotから小さい編集候補を作るサーバー側の任意機能とする。無料プラン/利用条件/資格情報が未確認なら通信せず、quota/出力検証失敗時も通常表示を維持する。候補の入力hash・対象試合・数値・出典を照合しても文意の正しさは保証できないため、別途人のレビューを必須とし自動公開しない。まず日本シリーズ結果/日程だけを対象にし、個人成績未収録のMVP・予告先発・未知の結果を生成しない。詳細は docs/optional-ai-insights.md。

### 週間分析（2026-10-26）

月曜〜日曜と直前の同じ7暦日をleague/season/competition/stage別に集計する。MLB Historicalは既存FormのHOT/上昇基準・母数・null/役割検証を再利用し、収録境界/partialでは評価保留。NPBは保存済みの試合/球団総括のみ公開し、HOT/Rankingを別名の選考で迂回しない。AIは用意された候補参照・理由・根拠指標のみを選び、hash/ID/集計値はプログラムが保持する。統計はAIを必要とせず、AI候補は検証・編集確認前に自動公開しない。詳細は docs/weekly-analysis.md。

月曜の定期処理は、正式に公開されたNPB静的snapshotから前週のレビュー用統計を準備するだけとする。未変更内容・範囲外・取得失敗・結果未収録を区別し、AI/DB/公開callbackは呼ばない。AIの実試行は既知hash/UTC日をレビュー済み台帳とcacheの双方で保護し、出力形式の改善を理由に同一入力を再試行しない。AI cronと自由文自動公開は品質確認前に有効化しない。
