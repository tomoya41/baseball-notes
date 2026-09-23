# Design System — Android-first preview

## 目的と現在の境界

方針は **Modern / Sports / Data / Clean**。最初の画面で「今見るもの」を示し、一覧は行、数値は小さな指標群、詳細は選手内タブへ進む。操作方法の長文は置かず、ラベル・Chevron・選択状態・48px以上の操作領域で伝える。色は情報を補助し、状態は必ず文字でも示す。

現在の実データProviderは未採用。Homeの日程・HOT・記録・シーズン、Analysis/Records/MATCHUP/WATCHは状態を明示しており、架空データから事実を推測しない。Rankingは**同梱サンプル内の参考表示**で、規定条件未判定を常時表示する。実データ用のランキング資格判定は後続タスク。

## トークン

`src/ui/styles.css` のCSS custom propertiesが唯一のスタイル値。端末の `prefers-color-scheme` に従い、手動テーマ保存は未追加。

| 用途 | Light | Dark |
|---|---|---|
| 背景 | `#f4f7fb` | `#091725` |
| Surface | `#ffffff` | `#102338` |
| Elevated | `#ffffff` | `#172d45` |
| Text | `#15253b` | `#f0f5fa` |
| Muted | `#52667e` | `#b3c4d5` |
| Border | `#d9e3ee` | `#2d435b` |
| Brand link/selected | `#15568e` | `#8ac4fb` |
| Primary CTA | `#103e69` | `#347ab9` |

Positive、negative、warning、neutral、chart primary/secondary/gridも両テーマで独立定義。球団色は細い識別線とマークにのみ使い、アプリの主色を変えない。間隔は4/8/12/16/24/32px、角丸は8/12/16px、基本操作領域は48px。数字はtabular-nums。日本語は端末システムフォントを優先し、Web Fontの外部取得はない。`prefers-reduced-motion` でアニメーションを停止する。

## アイコン・権利

一般操作は [Lucide](https://lucide.dev/) のSVGを単一セットとして使用（ISCライセンス）。野球固有の野球球・バット・ホームベースは `src/ui/baseball-icons.tsx` の独自SVG。写真・公式リーグ/球団ロゴ・それに似せた生成ロゴは使わない。

`src/ui/branding.tsx` はリーグを文字マーク、架空球団をモノグラムとして表示する。公式ロゴ型には許諾記録が必須で、現在の登録はゼロ。将来、権利と対象範囲を確認したアセットだけを登録し、コンポーネント外にlogo pathを分散させない。球団名と識別マークは別の情報。

## 主要画面

- **Bottom Nav**：ホーム / 検索 / 分析 / 記録 / マイ。選手詳細・球団詳細・参考Rankingでは「検索」を選択状態にする。リーグ切替は上部で継続し、詳細から切り替えると検索へ戻る。
- **Home**：縦スクロール。今日の試合 → お気に入り → サンプル選手 → HOT → 今日の注目 → 記録目前 → シーズン。各節は短く、データがない節は原因を短く明示。観戦入口は将来「今日の試合」へ置き、Bottom Navを増やさない。
- **検索**：選手/球団を二択で切替。名前、球団、守備位置を探す。結果は写真不要の行、球団識別マーク、名称、守備位置、Chevron。球団詳細では同じマークと登録選手を表示。
- **Player**：名前と番号を中心にした小さなヘッダー。概要 / 成績 / 分析 / その他の4タブ。概要は主要指標、成績は基本値→高度指標を段階表示。高度指標のⓘは短いDialog。分析・記録・経歴の未実装状態は明示する。
- **Ranking**：カードではなく3列の一覧。指標Chipで切替、順位・選手・値の順。サンプル内の参考表示だけを提供し、公式順位・HOT・規定条件の判定は行わない。

共通部品は `src/ui/components.tsx` のSectionHeader、PlayerRow/Avatar、TeamRow、MetricGrid、FavoriteButton、DataState、LoadingSkeleton。見た目の部品はProviderレスポンスを読まず、正規化されたカタログとFormatterを使う。

## 状態と将来のAnalysis

Loadingはページ骨格を残すSkeleton。No data、Provider非対応、取得失敗、未実装、少サンプルは別の文言と視覚状態にする。0は欠損ではない。Sample bannerとstale/更新時刻は通常画面から見つけられる位置に保持する。

Analysisは `AnalysisCapability` の `status` と `implementation` を見て表示を決める。リーグ名だけで高度UIを決めない。`src/ui/analysis.tsx` は概要→カテゴリー→詳細を一画面ずつ描き、球種割合を横棒、percentileを細い横棒、splitを行、zoneを座標由来の3×3として表示する。比較値には母集団、期間、サンプル数を伴わせる。現行サンプルにはAnalysis観測値がないため、実数値・ヒートマップセルは描画しない。

MATCHUPは同じchip/行/指標/母数/球種色を使用し、投手・打者のペアを選択した後、概要→直接対戦/球種/カウント/変化へ段階的に表示。データのあるセクションだけを描画する。WATCHはHomeの「今日の試合」から入る縦スクロールで、チームカード・打順行・選択式の3打者・ブルペン事実値を表示。今日の次打者や登板可否は推測しない。実Providerがない現在、両画面は未提供状態と手動選択導線を示す。

## 次の最小タスク

次は許諾済み履歴データから、特定選手の限定期間・1種類のsplitを作る小さなProvider adapterを検証する。現在のサンプル名鑑に実データを紛れ込ませない。
