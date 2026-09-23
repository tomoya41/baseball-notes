# Analysis Data Capability Matrix

確認日：2026-09-24（打順・点差・イニングを再確認）。対象は「月額0円で、本アプリが機械取得・集計・保存・再表示できるデータ」。Web画面で見える項目を、そのまま本アプリで取得可能とは判定しない。契約済みの実Providerはまだなく、現行アプリは架空サンプルのみ。

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
