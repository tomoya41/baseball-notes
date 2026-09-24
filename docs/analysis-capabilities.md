# Analysis Data Capability Matrix

確認日：2026-09-24（NPBの実Parser結果を追加）。対象は「月額0円で、本アプリが機械取得・集計・保存・再表示できるデータ」。Web画面で見える項目を、そのまま本アプリで取得可能とは判定しない。選手・Analysis UIは引き続き架空サンプルで、NPB Homeの順位表のみ検証済み静的JSONから実データを表示する。

## NPB実収集で検証した範囲

### 第2弾：1試合限定の完了ゲート

2026-09-23のロッテ対オリックス1試合では、両軍スタメンと交代参照、日付別投手使用ページを突合し、打者23/23、投手6/6のGame Factを検証した。下記は**この試合だけの実測Capability**であり、全NPBゲーム・Analysis UIの機能を開放しない。詳細は[npb-game-proof.md](npb-game-proof.md)。

| 項目 | 実測 | 判定 |
|---|---|---|
| playerGameBatting、出場者・先発/交代・打順1–9 | 23人、交代出場5人をSource間照合 | **available for verified game** |
| PA、BB/HBP、SH/SF | 打席トークンと四死合算列が全行で整合し、PAは両軍で相手BFと一致 | **available for verified game**。未対応打席結果はnull/partial |
| 2B/3B | 当該試合は両軍とも0、トークンから0を検算。非ゼロ例は未検証 | **conditional**。非ゼロ実例のParser回帰が必要 |
| playerGamePitching、outs、BF、投球数、先発/救援 | 6人、両軍各27 outs、BF/PA一致 | **available for verified game** |
| 投手BB/HBP単独 | nf3の対象欄は「四死」合算のみ | **unavailable**。合算値だけ保存 |
| appearance order / catcher | 対象Sourceで確定不能 | **unavailable** |

### 第3弾：異なる実試合のEdge Case

2026-09-23の**ソフトバンク10–3西武**を同じ手動Pipelineで確認した。打者27/27・投手8/8をSource IDからcanonical IDへ対応付け、両軍のbatting/pitching/game completenessは`complete`。ただし実証範囲はこの試合だけであり、Analysis UIや全試合収集のCapabilityは開放しない。[検証記録](npb-game-edge-proof.md)。

| 項目 | この試合の実測 | 判定 |
|---|---|---|
| 2B | 柳町達1、牧原大成2、平沢大河1等。選手打席トークンから直接取得、両軍合計3/4 | **verified for selected game**。独立したチーム2B総計照合は未検証 |
| 3B | 両軍0 | **unverified for nonzero** |
| PA・打者BB | 近藤健介4 AB+1 BB=5 PA、笹川吉康0 AB+1 BB=1 PA。全員のPAが相手BFと一致 | **verified for selected game** |
| 打者HBP・SH・SF | この試合はすべて0。合成変更によるParser testのみ | **unverified for nonzero** |
| 0 AB・途中出場・打順 | 岸潤一郎0 AB/0 PA/1 R、笹川吉康0 AB/1 PA。途中出場9人は元の1～9番枠 | **verified for selected game** |
| 救援・投球数・W/L | 救援投手各3人、上沢91球/勝、武内88球/敗 | **verified for selected game** |
| 端数投球回・HLD・SV | この試合に該当者なし。合成変更によるParser testのみ | **unverified on live edge game** |
| 投手BB/HBP | Sourceは「四死」合算 | **source-combined-only**。単独値はnull |
| appearanceOrder | 使用表は背番号順で登板時系列を確定できない | **unavailable from current source**。null |

### 第4弾：手動2試合の実記録Edge Case

2026-09-23の広島1–2巨人とDeNA4–3中日を同じGame完全性Pipelineで検証した。順に打者33/33・投手9/9と打者40/40・投手16/16、両試合ともmapping/打撃/投手/Gameの状態は`complete`。以下の`verified`は**選択した実試合での非ゼロ確認**を意味し、全試合日次収集やAnalysis UIのCapabilityを開放しない。[詳細な検算と限界](npb-game-phase4-proof.md)。

| 項目 | 今回の実測 | 判定 |
|---|---|---|
| 2B | 巨人1、DeNA3、中日2。各打席の「２」トークンを直接計数 | **verified for selected games**。独立Team 2B総計は未取得 |
| 3B | DeNA・林琢真の「中３」1本。選手Factと同軍の選手別合計1 | **verified for selected game**。独立Team 3B総計は未取得 |
| 打者BB | Primaryで広島3・巨人2、SupplementalでDeNA3・中日6 | **verified for selected games**。四死合算列とトークンを照合 |
| 打者HBP | 筒香嘉智と石伊雄太が各1死球、各PAに含める | **verified for selected game** |
| SH | 床田寛樹と竹丸和幸が各1犠打。ABに含めずPAに含める | **verified for selected game** |
| SF | 対象2試合は0。合成変更によるParser testのみ | **unverified for nonzero** |
| PA | 全73打者の確定PAが相手投手BF合計と一致。未解釈打席はnull/partial | **verified for selected games** |
| 0 AB・途中出場 | 対象試合に存在し、元の打順枠へ対応付けた | **verified for selected games** |
| 端数投球回 | 竹丸5.2→17 outs、中川0.1→1 out。0アウト投手も保持 | **verified for selected game**。0.2の非ゼロ実例は未確認 |
| 救援・W/L・HLD・SV | 巨人・竹丸の勝、広島・床田の敗、巨人の複数HLD、マルティネスSVを実測。DeNA–中日は両軍8投手 | **verified for selected games** |
| 投手四死合算 | 床田2、竹丸2、堀田1ほか。BB/HBP単独は分離できない | **source-combined-only**。単独値はnull |
| appearanceOrder | 投手使用表は背番号順。全登板順の明示がない | **unavailable from current source**。null |
| 終了形 | 27/27、36/33アウトの通常/延長ホーム勝利形 | **verified for selected games**。独立した最終回欄は未取得、コールド等は未確認 |

以下の第1弾表は当時の限定範囲の記録であり、第2弾の実証後も全リーグ対応を意味しない。

| 項目 | 2026-09-23 nf3 Parser結果 | 製品Capability |
|---|---|---|
| セ・パ順位、W/L/T、試合数、勝率、ゲーム差 | 各6球団、計12件を検証。首位`-`→内部0、1.5等を数値化 | **available**（当日Raw Captureを持つ日次Snapshotのみ） |
| 試合日程・結果 | 球団12ページから直近3日＋翌日、重複を統合して25試合。9/23の6試合はfinal、9/24の2試合はscheduled | **available**（検証済みwindow。延期は`postponed`へ正規化） |
| 打者の試合別AB/H/HR/R/RBI/SO/SB/CS、打順 | 確認済み2選手の計8行。BB/HBPは詳細内訳が一致した行のみ | **conditional**（2選手だけ。全リーグの提供ではない） |
| 投手の試合別IPアウト数/BF/投球数/H/HR/SO/R/ER、先発・救援 | 確認済み2投手の計3行。`0.2`→2アウト、`6`→18アウト | **conditional**（2投手だけ。四死合算のためBB単独は不可） |
| PA、二塁打、三塁打、投手BB単独、全選手ID、全リーグ試合ログ | 今回のParserでは未取得・未検証 | **research / unavailable**。値を0で代用しない |
| Pitch-level、Statcast相当、打席状況、点差、投手×打者 | 今回のSource/Parserで未取得 | **unavailable** |

以下の従来表は**一般的なSource候補の評価**を記録したもので、NPB公式の禁止は公式経路に限る。nf3の限定実証結果がアプリ全選手のCapabilityを自動的にtrueにすることはない。`source=public/no explicit prohibition found`は権利保証ではなく、条件が変われば停止する。SourceのURL・制約は[data-sources.md](data-sources.md)。

## 分類

- **取得可能**：対象範囲の公開データ・利用許諾を確認。実装済みを意味しない。
- **条件付きで可能**：公開済みの年、必要な列・coverage・欠測・母数を確認した範囲でのみ可能。
- **現状取得不可**：現在採用中のProviderにデータがなく、確認済みの代替経路もない。世の中にデータが存在しない、という意味ではない。
- **利用条件上使用不可**：調査対象の経路を無許諾で使えない。
- **要追加調査**：計測/表示は確認できても、取得契約・保存・再配布・粒度等が未確定。

表の略号：**可**=取得可能、**条件**=条件付きで可能、**不可**=現状取得不可、**禁止**=利用条件上使用不可、**調査**=要追加調査。

根拠：R=[Retrosheet列定義](https://www.retrosheet.org/downloads/csvcontents.html) / [利用条件](https://www.retrosheet.org/notice.txt)、S=[Savant CSV](https://baseballsavant.mlb.com/csv-docs)、E=[期待値leaderboard](https://baseballsavant.mlb.com/leaderboard/expected_statistics)、N=[NPB公式](https://npb.jp/)、A=[API-SPORTS coverage](https://api-sports.io/sports/baseball) / [規約](https://api-sports.io/terms)。認証・quota・更新・代替は[data-sources.md](data-sources.md)。

## 基本成績

MLBの「可」は**Retrosheet公開済み年の履歴データ**。現行2026シーズンを前日まで取得可能とする評価ではない。NPBの「禁止」は公式サイトの無許諾再利用経路に対する評価。他社契約まで一律禁止という意味ではない。

| 項目 | MLB | NPB | 判断・必要データ |
|---|---|---|---|
| AVG | 可（履歴R） | 禁止（N） | H / AB、0 ABは未算出 |
| OBP | 条件（R） | 禁止（N） | H、BB、HBP、AB、SFのcoverageが必要 |
| SLG | 条件（R） | 禁止（N） | 単打〜本塁打、ABから集計 |
| OPS | 条件（R） | 禁止（N） | OBPとSLGの同一期間・対象集団 |
| HR | 可（履歴R） | 禁止（N） | 公開打撃CSV |
| RBI | 可（履歴R） | 禁止（N） | 公開打撃CSV |
| BB | 可（履歴R） | 禁止（N） | 敬遠の扱いも表示 |
| SO | 可（履歴R） | 禁止（N） | 公開打撃/投手CSV |
| K% | 条件（R） | 調査（A等） | 打者PA / 投手BFを区別、分母欠測時不可 |
| BB% | 条件（R） | 調査（A等） | BB / PAまたはBF、定義を固定 |
| ERA | 条件（R） | 禁止（N） | 自責点 / アウト数。欠測/推定を明示 |
| WHIP | 条件（R） | 調査（A等） | 被安打、与四球、アウト数 |
| K/9 | 条件（R） | 調査（A等） | SO × 27 / アウト数 |
| BB/9 | 条件（R） | 調査（A等） | BB × 27 / アウト数 |

## Split

| 項目 | MLB | NPB | 判断・必要データ |
|---|---|---|---|
| 左右別 | 条件（R） | 調査 | 打席時点の左右、打席結果の揃う年 |
| ホーム / ビジター | 条件（R） | 調査 | 試合/チーム情報との結合 |
| イニング別 | 条件（R） | 調査 | playsの対象年coverage |
| カウント別 | 条件（R）/調査（S） | 不可 | pitch列のcoverageを要確認、到達打席と投球反応を分離 |
| 走者状況別 | 条件（R） | 調査 | 打席/投球の直前状態を区別 |
| 得点圏 | 条件（R） | 調査 | 2塁または3塁に走者 |
| アウト数別 | 条件（R） | 調査 | 0/1/2アウトと観測時点 |
| 月別 | 条件（履歴R） | 調査 | 試合日がある公開済み期間 |
| 直近7/14/30日 | 条件（履歴R） | 調査 | 過去の基準日でのみ。今季の日次提供は未確認 |
| 打順別 | 条件（履歴R） | 調査 | R `plays.lp` / `batting.b_lp`。代打・途中交代時の打順を保持。SのCSV項目だけで打順を推定しない |
| 打席開始時点の点差別 | 条件（履歴R） | 調査 | R `plays.score_v/score_h` と攻守チームから打席開始時点の符号付き点差を導出。Sの`bat_score_diff`は投球前で、同一PA内の変化に注意 |
| 打者の試合イニング別 | 条件（履歴R） | 調査 | R `plays.inning`。1–3/4–6/7–9/延長の表示帯と元の回を別保持 |
| 投手の試合イニング別 | 条件（履歴R） | 調査 | R `plays.inning` と投手ID。登板内イニング順とは別 |
| 投手の登板内イニング順別 | 条件（履歴R） | 不可 | Rでは試合ID・投手ID・回から登板ごとの登板第n回を導出可能な年だけ。途中交代、欠測、連続性を検証。Sの`n_thruorder_pitcher`は打順何巡目であり代用不可 |

この5項目の「条件」はRetrosheetの**公開済み履歴**に限る。現行の同梱サンプルには観測値がなく、今季前日分を表示できるという意味ではない。Retrosheetは利用・製品化を許可する一方、指定の著作権表示を要求する（[利用条件](https://www.retrosheet.org/notice.txt)）。[parsed playsの列定義](https://www.retrosheet.org/downloads/plays.html) と [daily batting列定義](https://www.retrosheet.org/downloads/csvcontents.html) で根拠を確認。Savantの[CSV列定義](https://baseballsavant.mlb.com/csv-docs)は利用許諾の確認とは別で、現行Providerには接続しない。NPBは許諾済み機械取得元のsplit粒度が未確認で、現行サンプルでは全項目を非対応にする。

## Pitch-level

Savantの項目説明は、機械取得・再配布の許諾とは別。以下はすべて未接続。NPBのHawk-Eye等も一般公開API・保存許諾を確認できず、別サイトの内部APIで補完しない。

| 項目 | MLB | NPB | 根拠・留意点 |
|---|---|---|---|
| 球種 | 調査（S） | 不可 | pitch_type、分類版も必要 |
| 球速 | 調査（S） | 不可 | release_speed、計測位置/年代差 |
| 回転数 | 調査（S） | 不可 | spin項目、旧deprecated列に注意 |
| 縦変化量 | 調査（S） | 不可 | pfx_z等、重力含む/除くの区別 |
| 横変化量 | 調査（S） | 不可 | pfx_x、単位・視点を保持 |
| 投球位置 | 調査（S） | 不可 | plate_x/z、2026年に仕様変更 |
| Swing | 調査（S） | 不可 | descriptionからの分類ルールが必要 |
| Whiff | 調査（S） | 不可 | 空振り / swing、投球数との混同禁止 |
| Chase | 調査（S） | 不可 | outside-zone swing / outside-zone pitch |
| Zone | 調査（S） | 不可 | zone判定/座標基準/欠測 |
| Called Strike | 調査（S） | 不可 | 投球結果から分類 |
| CSW | 調査（S） | 不可 | called strike + whiff / pitches |
| 投手ID | 条件（R）/調査（S） | 調査 | Provider IDを内部IDへ写像 |
| 打者ID | 条件（R）/調査（S） | 調査 | 同上 |
| 捕手ID | 条件（Rの出場情報）/調査（S） | 不可 | Sのfielder_2は投球前捕手。実際の配球要求者は断定不可 |

## Batted-ball

| 項目 | MLB | NPB | 根拠・留意点 |
|---|---|---|---|
| Exit Velocity | 調査（S） | 不可 | launch_speed、計測/推定を区別 |
| Launch Angle | 調査（S） | 不可 | launch_angle |
| Hard-Hit% | 調査（S） | 不可 | 閾値と計測済みBBE母数 |
| Barrel% | 調査（S） | 不可 | 分類定義とBBE母数 |
| xBA | 調査（S/E） | 不可 | 打球ごと期待値と打席集計値を区別 |
| xSLG | 調査（E） | 不可 | 任意splitのxSLG用構成要素は追加確認。xBAから推定しない |
| xwOBA | 調査（S/E） | 不可 | 分母、四球等の扱い、年ごとの係数 |
| 飛距離 | 調査（S） | 不可 | projectedと実測を混同しない |
| 打球方向 | 調査（S） | 不可 | hc_x/yと投球座標は別座標系 |

## Defense / Running

| 項目 | MLB | NPB | 根拠・留意点 |
|---|---|---|---|
| OAA | 調査 | 不可 | [公式説明](https://www.mlb.com/glossary/statcast/outs-above-average)、一般CSVから再計算できるとは限らない |
| Framing | 調査 | 不可 | [Savant framing](https://baseballsavant.mlb.com/leaderboard/catcher-framing)、球審・zone定義・年差 |
| Blocking | 調査 | 不可 | [Savant blocking](https://baseballsavant.mlb.com/leaderboard/catcher-blocking)、対象機会と期待値 |
| Pop Time | 調査 | 不可 | [公式説明](https://www.mlb.com/glossary/statcast/pop-time)、母数・送球対象を保持 |
| Arm Strength | 調査 | 不可 | [公式説明](https://www.mlb.com/glossary/statcast/arm-strength)、捕手と野手の集計条件を分離 |
| Sprint Speed | 調査 | 不可 | [Statcast context](https://baseballsavant.mlb.com/statcast-metrics-context)、適格走塁の母数 |
| Run Value | 調査 | 不可 | [Savant Run Value](https://baseballsavant.mlb.com/leaderboard/swing-take)、値の向き・基準集団 |
| Bat Speed等 | 調査 | 不可 | [Statcast context](https://baseballsavant.mlb.com/statcast-metrics-context)、対象年・coverage・許諾が未確定 |

## 座標・年代差の確認結果

公式CSV定義では、plate_x / plate_zの計測基準が2025年までの本塁前面から2026年以降は本塁中央へ変更されている。sz_top / sz_botも2026年からABS基準。この境界を跨ぐraw座標は同じセルに単純集計しない。モデルに座標系version、単位、視点、計測面を保存し、比較には変換検証を必須とする。Sの打球座標を投球位置として使わない。

## 実装側の判定

共通化できるのはQuery、期間、状況、母数、欠測/少標本表示、取得契約、結果/説明の構造。MLB高度分析は許諾済みProviderのCapabilityが揃った時だけ開放する。NPBは基礎成績と許諾確認できたsplitを順次開放する。

現行`sample-v1`は試合別/投球別の実データを持たないため、Analysisの全機能を`data=unavailable, implementation=not-implemented`として登録。選手画面のサンプル成績表示は継続する。「この条件では0件」「提供元にデータなし」「規約未確認」「機能未実装」を分離する。Matrixの歴史データ評価だけで本番Capabilityをtrueにしない。

## MATCHUP / WATCH追加確認（2026-09-24）

下表のMLB「条件」はRetrosheet公開済み履歴（現時点のCSVは1897–2025年）で、**今日の試合の提供ではない**。列があるだけで利用可能とせず、ID対応、欠測、適用年、Retrosheet指定の著作権表示を検証する。MLB.comの[利用規約](https://www.mlb.com/official-information/terms-of-use)は自動スクリプトによるサイト収集を禁じているため、公式Web画面をスクレイピングして日程/打順/投球を埋めない。[Retrosheet CSV範囲](https://www.retrosheet.org/downloads/csvdownloads.html)、[列定義](https://www.retrosheet.org/downloads/csvcontents.html)、[利用条件](https://www.retrosheet.org/notice.txt)。

| 項目 | MLB | NPB | 現行Provider | 根拠・代替 |
|---|---|---|---|---|
| 直接対戦 | 条件（履歴R） | 調査 | 不可 | R playsの投手・打者IDと打席結果を結合。欠測年は除外。許諾済みNPB feedを待つ |
| Pitch Arsenal × 打者球種 | 調査（S） | 不可 | 不可 | 投手/打者それぞれのpitch-level許諾と共通球種分類が必要 |
| カウント対戦 | 条件（履歴R）/調査（S） | 不可 | 不可 | pitch-at-countと到達PAを分離。Rのpitch列coverageを検証 |
| 直近30日対戦 | 条件（公開済み履歴） | 調査 | 不可 | 今季の日次feedではない。期間と対象試合のcoverage必須 |
| 今日の日程・先発予定 | 調査 | 調査 | 不可 | 当日再利用可能な契約/認証/更新頻度は未確定。Web表示の転用は禁止 |
| 今日の打順 | 調査 | 調査 | 不可 | 予定/発表済みを区別。Rの履歴lineupは今日の打順に代用不可 |
| ブルペン直近登板 | 条件（履歴R）/今季調査 | 調査 | 不可 | Rのpitching/game logで履歴導出可能。前日終了までの今季feed未確認 |

UIは`directMatchup`、`pitchTypeMatchup`、`countMatchup`、`recentMatchup`および独立したWatch `schedule`、`lineup`、`bullpenUsage` capabilityを見る。現行サンプルは両リーグともすべてunavailable。許諾済みfeedがない節は隠すか短い未提供表示にし、架空値や「MLBだから利用可能」の分岐は置かない。
