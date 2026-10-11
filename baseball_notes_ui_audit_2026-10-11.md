# Baseball Notes｜全画面UI/UX監査・競合リファレンス・再設計方針

**作成日:** 2026-10-11  
**対象:** `tomoya41/baseball-notes`、main `c2a7f493470b897ab6fd35a35e3e7515b1bf7e98` を基準とした静的監査  
**目的:** 既存のFact/権利/運用を変えず、AI生成テンプレートに見える印象を解消し、野球ファンにとって「かっこよく、ひと目で分かり、深く調べられる」体験を定義する。  
**監査上の限界:** GitHubに公開された実装コード、CSS、ルーティング、設計文書と、競合各社の公式紹介・画面例を調査。**Baseball Notesの公開アプリをブラウザで実描画し、全画面のスクリーンショットを撮る操作は未実施**。この文書の「現状」はコード構造から確認した事実または設計上のリスクであり、各解像度の実見え・実際の操作感は後続のvisual QAで検証する。外部アプリもインストールによる実機操作は行っていない。

---

## A. エグゼクティブ結論

- **主原因は画像不足ではなく、全画面に似た見出し・表・フィルター・補足文を均等配置する「フラットな情報編集」。** 見せたい主役が弱く、利用者は「野球を見に来たのに管理画面を操作している」感覚になりやすい。
- `styles.css` 約62 KBに`final-design.css`約25 KBを上書きする多層CSS。見た目の一貫性を狙う一方、画面固有のデザインを作りにくく、後続変更で局所的な競合が起こりやすい。
- `final-design.css`に `body { font-size:.8125rem }`（16px基準で約13px）、Bottom Nav `font-size:.625rem`（約10px）、多くの補助文字 `.6875rem`（約11px）がある。**文字サイズと主従比率は最優先の是正候補。** 実測のアクセシビリティ合否は別途検証。
- テキスト・モノグラム中心なのは写真・ロゴの使用許可を守る適切な制約。ただし代替の**独自ビジュアル言語**（スコアバグ、数字主体の編集レイアウト、実データからの可視化）が弱い。
- 日次/currentのNPBと2016–2025 historicalのMLBは異なる時間感覚。共通コンポーネントの使い回しではなく、**NPBの「直近の試合」／MLBの「過去年度の発見」**のストーリーを変えるべき。
- 推奨方向は **「スポーツ中継の即時性 × スカウティングレポートの読み応え」**。Apple Sportsの瞬時の視認性、NPB+ / スポナビの野球固有の文法、FotMob/Sofascoreの階層、FanGraphs/パ・リーグ.comの集計表現を**パターンとして学ぶ**。コピーや公式素材の無断流用は禁止。

## B. 調査した競合UI：何を取り入れ、何を持ち込まないか

| 参考サービス／公式リファレンス | 観察できるUX・UI上の特徴 | Baseball Notesに採用 | 採用しないもの |
|---|---|---|---|
| **NPB+**（[2026/9大型更新・KONAMI公式](https://pawaspi-point.konami.net/news/detail?content_id=KON_news_1bd7753941be7bad7e3443befa79705a)、[App Store](https://apps.apple.com/jp/app/id6746151454)） | 試合一覧に順位、予告先発、球場、現在の投手/打者、責任投手を集約。勝利側得点を強調。日付スワイプと常時スコアボード。 | **試合カードは結果・日時・両軍識別・状況・確実な根拠を先頭に。** 日付操作は大きく、状態はスコアから分かる。 | 権利未確認の球団ロゴ・動画・リアルタイムトラッキング。保存済みデータを速報化しない。 |
| **スポナビ 野球速報**（[App Store](https://apps.apple.com/jp/app/id720087913)、[LINEヤフー公式 2026](https://www.lycorp.co.jp/ja/news/release/020134/)） | 試合から打席・選手成績へ、走者・配球・ポジションなど野球固有の図解。フォロー球団の優先表示。 | 日程→Game→Box Score→Playerの**奥へ掘り進む導線**、Follow優先、信頼できる数値の視覚化。 | 未収録の一球速報/走者/球速を描いたダミー演出。ニュースの転載、素材流用。 |
| **パ・リーグ.com**（[公式 成績ページ](https://pacificleague.com/stats)） | チーム順位、打撃/投球ランキングを分離し、まず代表的な指標を出す。数字の整列と単位別の一覧が明快。 | Recordsの**指標プリセット＋TOP5→全件**、リーグ・期間切替、左右が読める成績表。 | 全指標を同時に詰め込んでスマホの第一画面を表だらけにすること。 |
| **ベースボールLIVE**（[Google Play](https://play.google.com/store/apps/details?id=jp.softbank.mb.baseball&hl=ja)） | 配信/ハイライトを軸に試合へ直行するメディア構成。日程・成績が補助。 | 試合中心の強い入口、情報の優先順位を理解する参考。 | 動画/ライブ機能や有料配信があるように見せるカード。 |
| **Apple Sports**（[日本公式 2026](https://www.apple.com/jp/newsroom/2026/05/apple-sports-expands-to-more-than-90-new-countries-and-regions/)） | お気に入り・スコアが一目で分かる。対戦の対称性、視線移動を減らすシンプルなスコア表現。 | 試合結果・勝敗・数値の一瞬の理解、優先対象の固定、節度ある空白。 | Appleの画面そのものの模写。データ不足の空白を無理に埋めること。 |
| **FotMob**（[公式プレビュー](https://www.fotmob.com/download)） | 日付→試合→試合詳細→統計の層が整理される。イベントの集約と展開の分離。 | 自然なナビ、試合単位の進み方、試合面の「概要から詳細へ」。 | サッカー固有のフォーメーション等、野球に関係ない図解。 |
| **Sofascore**（[2025公式Home redesign](https://www.sofascore.com/news/sofascores-new-home-screen-a-smarter-faster-way-to-follow-sports)） | お気に入りのリーグを前面へ、タブとfilterの階層、コンパクトなbottom nav。 | Homeを個人/今日/注目に優先づけ。複雑なfilterを段階表示。 | 「トレンド」など根拠がない人気順位、未提供の通知。 |
| **MLB公式**（[Google Play](https://play.google.com/store/apps/details?id=com.bamnetworks.mobile.android.gameday.atbat)） | 試合、GameDay、ロスター、選手成績、打撃/投球/守備の統計切替。 | 機能と役割に応じた統計分類、Game→選手導線。 | 公式映像/ライブ/現在データの印象を持ち込むこと。 |
| **FanGraphs**（[公式Quick Leaderboards](https://blogs.fangraphs.com/fangraphs-app-update-weve-added-quick-leaderboards/)） | 重要指標のTOP5から開始し、同じ指標の全件・条件付き一覧へ展開。成績の意味・母数を保つ。 | **「まず上位選手を見る」→「専門家は細かく探索」**の2レベル構造。HOT/Records/Exploreに有効。 | フィルターが最上段を占有するヘビーユーザー前提の初期画面。 |
| **Baseball Savant**（[MLB公式の記事](https://www.mlb.com/news/baseball-savant-statcast-player-pages-new-look)） | Profile上部でプレイヤーの特徴を視覚的に要約し、詳細メトリクスに進める。 | **選手ごとに違う数値の「顔」**を用意する。比較バーや実測推移を主役に。 | 根拠のないパーセンタイル/Zone/球種/球速の描画。 |

**ベンチマークの優先度:** 国内日常利用は **NPB+・スポナビ**、記録一覧は **パ・リーグ.com・FanGraphs**、第一印象と画面設計は **Apple Sports・Sofascore**、Player固有の視覚化は **Baseball Savant**。これらを全画面で同じように模倣するのではなく、目的別に切り分ける。

## C. 全画面静的監査（実装経路単位）

優先度は今後のUI改修での優先度。**P0=第一印象/重大な導線、P1=頻繁な画面、P2=高度機能または補助画面。**「観察」はコードから確認可能な構造と、そこからのUX仮説を分離して記す。

| 画面群（実装route / component） | 現状構造・注目点 | 懸念と改善方向 | 優先 |
|---|---|---|---|
| **全体Shell・ナビ**（`App.tsx`, `design-system.tsx`） | 5目的地（ホーム/試合/選手/記録/My）、NPB/MLB切替、共通ヘッダー/フッター。 | リーグ切替、目的地、補助exploreの優先関係を明確に。画面の主役よりヘッダーが強くならないこと。底部10px相当の文字は拡大候補。 | P0 |
| **NPB Home**（`npb-product.tsx`, `daily-dashboard.tsx`） | スコア/順位表/フォロー切替。日程、最近、フォロー選手、節目など。 | 「この時間に知りたい事実」を最上段へ。スコア/結果の強い表現、フォロー優先。補助文とステータスが主役を押しのけないこと。未ready HOTを大きな空カードにしない。 | P0 |
| **MLB Historical Home**（`mlb-historical.tsx`） | シーズン選択、日本人選手注目、最近の保存試合、HOT/月間候補リンク。 | 今日の速報でなく**選んだ年のスポーツ誌の表紙**として構成。選手の特徴値／その年の強い打撃・投球成績を主役に。年・Historical区別は常に見える。 | P0 |
| **NPB日程・結果**（`npb-game-surface.tsx`） | 年月/日付ナビ、試合一覧、Postseason/preseason状態。 | 試合カードをスコア中心に短く強く。日付移動・過去試合/次戦の位置固定。状態は情報のない部分だけ補助に。 | P0 |
| **MLB日程・結果**（`mlb-historical.tsx`） | Season/competition/date、ScoreboardRow。 | NPBとスコアの見た目は共通、操作の時間軸はHistoricalで明確に分ける。保存範囲外の年を迷わない操作に。 | P1 |
| **NPB Game Detail**（`npb-game-detail.tsx`, `game-story.tsx`） | ScoreHero / BoxScore / Preview / Recap。 | ビジターとホーム、結果、勝敗、主な活躍→成績表の順。レース/速報を想起させる推測プレー図は使わない。 | P0 |
| **MLB Game Detail**（`mlb-historical.tsx`） | Game score、2チームの打撃/投球表と詳細。 | モバイルでの表→カード化は行間・数値比較が難しい可能性。チーム別切替と打撃/投球プリセット、一貫した見出しで比較を助ける。 | P1 |
| **NPB選手検索・球団検索**（`npb-player-search.tsx`, `discovery.tsx`） | 検索と条件、文字マーク＋名前行。 | 名前の大きさ、役割/所属を視覚的に区別。未確認データは一覧の主役にしない。検索入力を最優先、推奨導線は2番目。 | P1 |
| **MLB選手検索**（`mlb-historical.tsx`） | Historicalを対象、名前、年、ロール、Japanese focus等。 | NPBと共通の選手リスト形、検索条件は必要時展開。Historical対象年を上部で強く。 | P1 |
| **NPB Player Profile**（`npb-player.tsx`） | Profile header, 5 tabs, facts, Recent, conditional analysis, lifecycle。 | **代表画面として先行再設計**。Hero=大きな名前+検証済み番号/属性+役割に合う主要3指標。概要で情報を均等タイル列にしない。次の行動を「最近の成績」「試合別」へ。 | P0 |
| **MLB Player Profile**（`mlb-historical.tsx`） | モノグラムHero、Season、Regular/Postseason、5 tabs、多数の過去統計。 | 役割別 hero（打者はOPS/HR/PA等、投手はERA/K/IP等）、年で切替。二刀流は2領域で正しく見せる。収録年とCareerを区別。 | P0 |
| **Player成績・試合別**（`player-season.tsx`, `player-game-log.tsx`, `stat-table.tsx`） | 大量の統計セル、細かい説明、試合別。 | 基本/詳細/比較を分離、行タイトルと数値の揃いを確保。投手の打撃は一覧標準から別フィルター、二刀流は両方。Player内で記録は隠蔽しない。 | P1 |
| **Player分析・Trends**（`npb-player-analysis.tsx`, `analysis.tsx`, `player-trends.tsx`） | home-away、打順、相手、先発救援、Recentなど多数。 | 最初は**1行の結論＋2～3つの比較図**。フィルター・母数/計算式は二段目。グラフは実測時のみ。過密な指標タイルは減らす。 | P1 |
| **週間HOT・月間MVP・上昇下降**（`historical-form.tsx`, `npb-hot.tsx`） | MLB Historicalは7/14/30、月間、変化の期間/カテゴリー/条件切替。NPB公開Gateは別。 | **アプリの看板画面に格上げ**。1位/候補TOP3はスポーツ特集風、以下は高密度行。評価理由を数字と短いラベルで表示。NPB未readyを実ランキングとして見せない。 | P0 |
| **MLB Records / Ranking**（`mlb-historical.tsx`） | role/counting-rate/group/metric chipsとleaderboard。 | **TOP5カード→指標ごとの全件へ**。フィルターは段階表示、順位/選手/値が横一直線。公式資格・独自最低母数は詳しい説明へ。 | P0 |
| **NPB Records / Milestones**（`npb-game-surface.tsx`, `npb-milestones.tsx`） | NPB Ranking gate closed、Season節目は別機能。 | 使える節目・事実を主役に。制限理由の説明は必要だが大きな空白の代わりに正常な次の行動を提供。Gateは変更禁止。 | P1 |
| **Postseason Hub / Series**（`postseason.tsx`） | MLB保存Series、NPB未提供状態、Seriesルール差。 | **ラウンド進行図・対戦ペア・勝敗の視覚表現**。条件付きアドバンテージを事実と分離。NPB unsupportedには誤解しない導線を。 | P1 |
| **Team Hub / Team roster**（`team-hub.tsx`, `npb-product.tsx`） | モノグラム、球団識別、チーム比較/所属選手。 | 球団の識別性が弱い場合は、公式色を借りずアプリ独自の識別バッジ＋成績の数字。所属履歴と現役名簿を混同しない。 | P1 |
| **ドラフト/若手/出身校/経歴**（`npb-lifecycle.tsx`） | 年・指名順位・出身校/若手、学校→ドラフト→所属→Season。 | 絞り込みより「同年ドラフト」「出身校」を入り口に。経歴は**タイムライン**で見せる。推測年は補わない。 | P1 |
| **全選手データ探索・Recent**（`data-explorer.tsx`） | 高度な絞り込み/最低サンプル/保存条件/ページング。 | 簡単モード（打撃/投球×代表指標×期間）と詳細条件を分離。スマホ行とデスクトップ表を意識的に使い分ける。 | P1 |
| **Season Explorer/Timeline**（`season-explorer.tsx`, `mlb-historical-expansion.tsx`） | 収録年の変更、選手履歴、比較導線。 | 2016–2025の**年選択を整理**。期間連続を視覚的に示すが完全Careerに見せない。 | P1 |
| **BvP/MATCHUP**（`mlb-historical-expansion.tsx`, `matchup.tsx`） | 投手/打者選択、exact PA分析。 | 2人の名前が対峙する専用Hero、実際のPAと主要結果3指標、詳しい打席/年は下層。サンプルが少なければ強い優劣演出をしない。 | P1 |
| **Player Compare**（`player-compare.tsx`） | 指標比較/role/season/選手選択。 | **VS構図 + 行別差分**。2人のIdentityを横並び、数字の左右一致、比較母数。4人時は選択一覧に切替。 | P1 |
| **Team/Season Compare**（`team-season-compare.tsx`） | 球団対球団、年度間の比較。 | 小さい画面で比較相手と期間を固定表示。棒の色の意味、数値ゼロ起点と差を明示、横幅だけに依存しない。 | P1 |
| **Search Discovery / Explore**（`discovery.tsx`, `future-surfaces.tsx`） | 入口が複数・機能カタログ/準備中ページがある。 | 機能名の羅列より**「何を知りたいか」**の導線。未実装項目をHomeの目立つ場所に置かず、後続の情報に埋める。 | P1 |
| **My / Favorites**（`npb-routes.tsx`, `mlb-historical.tsx`） | Myにお気に入り、Library、Watch、Theme/Notification等の操作が混在。 | 最初に**自分の追うチーム/選手**、次に保存条件・コレクション。設定類を末尾の独立領域へ。 | P1 |
| **Watch Center**（`personal-watch.tsx`） | ユーザー起動型差分確認・履歴・設定・詳細diagnostics。 | 「更新を確認」「新しく変わったこと」を主役に。**プッシュではない**。`Watch Center`/`Alert`/`Recent`等の内部語を人に伝わる日本語へ。設定は二段目。 | P1 |
| **Library / Collections / Saved Views / Activity**（`personal-library.tsx`, `collection-dashboard.tsx`） | 細かな整理とクエリ、保存一覧。 | 「今持っているもの」→「ここから続ける」。英語の`Collection`等は画面タイトルに出さない。カード乱用を避ける。 | P2 |
| **Glossary / Data Sources / Privacy / Settings**（`stat-glossary.tsx`, `mlb-historical.tsx`, `runtime-status.tsx`） | 指標説明、出典、ライセンスと保存規則。 | 安全性を損なわず、各画面ⓘからContextualに到達。内容は維持しつつメインコンテンツの上に常駐しない。 | P2 |
| **Coming Soon / Unsupported / Loading / Offline**（`future-surfaces.tsx`, `components.tsx`, `runtime-status.tsx`） | 共通DataState、利用可能性/エラー/未収録を分離。 | 文言は具体的に、視覚的強さは状況に比例。空画面の大量出現がAIプロトタイプ感を増やすため、利用可能機能への戻り先を明示。 | P1 |

### 設計上とくに気になる実装上の根拠

- `src/main.tsx`は`styles.css`→`final-design.css`の順で読み込む。既存スタイルを後から上書きした箇所が多く、**UI overhaul時はトークン/コンポーネントの整理が必要**。ただし一度に全routeのDOMを置換しない。
- 共通`SectionHeader`/`PageHeading`/`MetricGrid`/`DataState`は有用だが、Home、Profile、HOTで「誰・いつ・どれだけ」を強く見せる専用表現が別途必要。
- ラベルは日本語化が進む一方、`Watch Center`、`Game Preview`、`Recent`、`Series`、`Coverage`、`MLB · HISTORICAL`など内部語が残る。略語はファンに定着したものだけ許し、初出で分かる説明へ。
- `final-design.css`のモバイル`StatTable`行は3列Gridでラベル/値が繰り返される。便利な場合と、**投手の試合別比較のように列一致を保ちたい場合**を分けて検証する。
- 画面の見た目だけでなく、**「順位→選手」「試合→結果→Hero→Box」「HOT→選手の期間分析」まで2〜3タップ**の利用シナリオで評価する。

## D. 今後のデザインの「統一原則」

**Design North Star: _Broadcast × Scouting_ — 直感的な試合速報の読みやすさと、専門家レポートの質感を同居させる。**

1. **主役1個、補助3個:** 各画面の最上部は**一つの結論（試合結果/選手/首位/候補）**。補助は期間・対象・代表値など少数に絞る。フィルターや注意書きを主役にしない。
2. **役割で変える:** Home/Game/Player/HOTは専用デザイン、Data Explorer/Compare/Recordsは正確な数値の密度を優先。全画面「同じカード12枚」を禁止。
3. **野球らしい視覚言語:** スコアボードの数字と線、イニングの区切り、VS、ダイヤモンドの**控えめな幾何**、実測値の前後比較。根拠のない球場/球種/ヒートマップは表示しない。
4. **文字の序列:** 標準本文14–16px、ナビ12–13px、主な人名16–22px、Game/Statsの主役26–42pxを目安に再調整。実際には端末・可読性テストで決める。サブ11pxを大量に使用しない。
5. **色は意味＋ブランド:** 2〜3個の主色、試合勝敗と上下変動の意味色、役割識別を控えめに。公式チーム色と誤認されるブランド模写はしない。ダークモードは単なる明暗反転でなく、数字と面のコントラスト設計。
6. **画像は選択的に:** 写真・公式ロゴは個別ライセンス確認後。現段階はオリジナルSVG＋未使用のスペースを生かすタイポグラフィー。背景画像はHeroのみに限定し、表・分析の背後に置かない。
7. **デフォルトを完成させる:** 開いた直後に「選択してください」ではなく、意味のある収録範囲内の初期選択。熟練者向け条件は開閉式にする。
8. **内部状態を二層化:** ユーザーは試合と数字を見る。正確性/rights/coverage/samplesは短いステータスとⓘで確認可能にする。not_readyをreadyに見せることは禁止。
9. **日本語の自然さ:** `探索 / 比較 / 最近の成績 / 試合別 / 経歴 / お気に入り / 更新を確認`を主な言語とし、`Coverage / Collection / Alert / historical`を主要見出しにしない。`HOT`、`OPS`、`ERA`等ファン用語は文脈に応じ保持。
10. **スクロール自然:** 以前のユーザー指示どおり単一の縦スクロール。無理な画面内pagination/複数の入れ子スクロールを再導入しない。テーブルの横スクロールは必要な場合にのみ明示する。

## E. 画面別「完成イメージ」の構図案

### Home（NPB）
1. 最初の見出しは`2026 NPB`＋収録更新時刻（小さく）。
2. 最上位に**日付＋試合結果の短いスコア行**。フォロー球団がある場合は最上位（スコアと相手を示す）。
3. その下に**注目**（安全な範囲のFact起点。HOT Gateが閉じたままならランキングではなく試合の主な成績）。
4. 順位表TOP/全体、フォロー選手、節目は順序をユーザー目的に合わせる。
5. 未実装のCurrent Postseason/速報/通知を主要枠に出さない。

### Home（MLB Historical）
1. `2024シーズン｜過去の記録`がまず明確。
2. **その年の印象的な選手・シーズン記録**を実Factから抜き出し、強い数字と名前で見せる。
3. `この年のHOT / 月間MVP候補 / 伸びた選手`へコンテキスト付き入口。
4. `選手 / 球団 / 対戦 / Postseason`の発見導線。今日の速報と思わせない。

### Player Hero
- トップに**大きい名前**と信頼できるrole／チーム。背番号が証拠付きである場合だけ番号。
- 主要数字3件。打者／投手／二刀流で変える。シーズン指定はHero直下に見える。
- 写真なしでも存在感がある。巨大な空モノグラムを主役にはしない。比較、お気に入り、試合別へ近距離。

### HOT / 月間候補
- トップ1人は数字の強い特集行、次の2人はコンパクトな注目行、それ以下はTOP10+全件。
- `今週`という言葉はNPBで実際にfreshな時だけ。MLB Historicalは必ず `2024年8月20日時点` と明記。
- 「注目理由」を短く：OPS、PA、前期間差など、**実際に計算した数値**だけ。
- 打者/先発/救援を明確に分ける。二刀流は事実と基準に従う。打撃一覧の通常投手は二次フィルターで表示。

### Game
- **スコア中心・勝敗の即時判読** → 両チームの表 → 主な活躍 → 打撃/投手別Box Score。
- NPB+の「一画面で必要な状況を把握」を構造として学ぶが、実データがない投球変化・責任投手は出さない。

### Records / Explorer / Compare
- Records: 打撃/投球 → HR/AVG/ERAなど指標プリセット → TOP5 → 詳細条件。
- Explorer: 「簡単条件 + 結果先出し」→ 高度フィルター。表の軸・数字の意味を固定。
- Compare: 対戦する2名を常に認識できる。左右の成績を位置揃え。絶対値と変化率を混同しない。

## F. 推奨実施順序（Codex/Astraへの引き継ぎ）

**現在の主機能・Source/rights制約は維持。先に大画面3種でビジュアル品質を定義し、その後全routeに展開。**

- **Phase 0: Screen Capture & Usability Baseline（必須）**：同じmainをモバイル360/390px Light/Dark・768px・1440pxで実描画し、NPB/MLBの全route familyのトップ/スクロール中/空状態/データ状態/詳細タブを撮影。Tap pathと可読性・overflowを記録。公開を実際に描画できなければその理由を記録し、テストfixtureで同じ画面を再現。いずれも架空統計を実データとして公開しない。
- **Phase 1: Style & Editorial Prototype（Home, Player, HOT）**：既存実装を無理に全改変せず、先に代表3画面で見た目の選択肢を2つ提示。選ぶのは `Broadcast × Scouting`の完成度で、単なる色違いは禁止。実画面で文字サイズ/視線/「何をすればよいか」を確認。**ユーザーの承認を経てから全画面展開**すると好みの取り違えが減る。
- **Phase 2: Game, Records, Search, Compare & deep sections**：代表画面に合わせてデザインを実装。ナビ5個、scroll、routing、戻る挙動、pre-existing stateを守る。CSSの重複整理は回帰が少ない単位で進行。
- **Phase 3: My, Watch, Draft, Explorer, Postseason, empty/error states**：すべての画面で同じデザイン品質。内部語や説明の過剰露出を整理。操作性とデータの意味は保持。
- **Phase 4: Multi-device QA & publish**：全route検証、権利、NPB Gate、Data Contract、初期fetch、prefers-reduced-motion、視線誘導、WCAGコントラスト、Tab/Back/Focus、状態別UI、Screenshots、Android実機/TalkBack。実機依存は未検証なら明記。PR→レビュー→修正→Pages smoke。

**評価の仕方:** 利用者が「3秒でその画面の主役を認識できる」「2タップ程度で最近活躍する選手や試合詳細に進める」「選手の代表指標を説明なしに見つけられる」「技術的なデータ注意書きをクリックせずに最低限の意味が伝わる」をシナリオで確認。主観的なかっこよさはライト/ダークの実画面A/Bで比較する。

## G. 改修の非交渉条件

- 新しいロゴ・写真・動画を権利確認なしに導入しない。既存のRetrosheet/Chadwick/Wikimedia attributionを維持。
- canonical ID / Facts / Coverage / Gate / provenance / qualification / role認定 / Regular/Postseason / Historical vs Currentを変更しない。
- NPB Ranking/HOT Gateを見た目のために解放しない。null・unknownを0へ変えない。
- カードの見栄えのために架空プレイヤーや「今週の注目」をでっち上げない。
- 既存の`hash route`、deep link、URL state、favorites、saved views、collections、Watch baseline、Android Back / dialogsを維持。
- 追加コスト0円、初期ロードを悪化させない。巨大画像、外部Web Font、全量Historicalロードは禁止。

## H. 検証待ち（現段階で「確認済み」と呼ばない）

1. 公開Baseball Notesの**全routeの実キャプチャ**とスクロール・リンク操作。
2. 低速端末での描画、初期ロード、SVG・画像の実負荷。
3. Native Android実機、TalkBack、通信断/オフライン再開。
4. 実際の利用者による可読性・「かっこよさ」比較。今回の診断の主観的部分はここで確かめる。

---

## 参照した実装の主な場所

- [App shell](https://github.com/tomoya41/baseball-notes/blob/main/src/ui/App.tsx)
- [UI tokens/base stylesheet](https://github.com/tomoya41/baseball-notes/blob/main/src/ui/styles.css)
- [Current visual override](https://github.com/tomoya41/baseball-notes/blob/main/src/ui/final-design.css)
- [NPB routes](https://github.com/tomoya41/baseball-notes/blob/main/src/ui/npb-routes.tsx)
- [MLB routes](https://github.com/tomoya41/baseball-notes/blob/main/src/ui/mlb-historical.tsx)
- [HOT/MVP UI](https://github.com/tomoya41/baseball-notes/blob/main/src/ui/historical-form.tsx)
- [Original vision](https://github.com/tomoya41/baseball-notes/blob/main/SPEC.md)
- [Design decisions](https://github.com/tomoya41/baseball-notes/blob/main/docs/final-product-design.md)
- [Prior UI reference review](https://github.com/tomoya41/baseball-notes/blob/main/docs/sports-ui-research.md)
- [Integrated HOT source/UX decisions](https://github.com/tomoya41/baseball-notes/blob/main/docs/integrated-form-discovery.md)

**この文書は「静的全画面監査と次のビジュアル方向性」の決定材料。実機・ブラウザ上で全画面を見たという実証報告ではない。**

## 追加付録｜参考画面の実画像（引用元を明示）

下記は**第三者サービスの公式・公開記事にあるUI参考画像**へのリンク。デザイン検討時の閲覧用であり、画像ファイルをアプリに同梱・流用する許諾ではない。

| 参考ビジュアル | 画像参照 | 学ぶ具体的要素 |
|---|---|---|
| Apple Sports：試合一覧 | [Apple Support公式画像](https://help.apple.com/assets/668C5633A9EDE2F7000E4A31/668C5634A9EDE2F7000E4A37/en_US/7c41b38d0bb9cc76387ce2ce91473a89.png) | スコア優先順位、対戦の横並び、結果/時間の中央配置、1画面で一覧が読める密度。 |
| NPB+：試合画面 | [Sony発表のUI画像](https://www.sony.co.jp/news-release/202510/25-038/cl60q50000000ys5-img/02.png) | ダークベースの野球スコアボード、チーム識別、試合から詳細への入口。 |
| NPB+：選手の成績 | [アプリブ掲載UI画像](https://appliv-domestic.akamaized.net/v1/760x/s1bb/s3-ap-northeast-1.amazonaws.com/img.app-liv.jp/articles/155705/17085912_1772446422_001744100_0_1080_1081.png) | プロフィールを年度別/指標別に分割し、比較グラフを適切に挿入。 |
| スポナビ野球速報：試合画面 | [野球速報UI紹介](https://sports.yahoo.co.jp/promo/app/bblive/) | 一球速報に至る文脈、試合状況から追加詳細への情報階層。データ/画像自体は流用しない。 |
| Sofascore：フィルター階層 | [公式Home UI画像](https://files.sofascore.com/news/2025/10/New-Home-screen-6-819x1024.jpg) | 第一画面には結果を置き、複雑なfilterはアクションから展開する。 |
| FanGraphs：Quick Leaderboards | [公式解説と画像](https://blogs.fangraphs.com/fangraphs-app-update-weve-added-quick-leaderboards/) | トップ5で内容を掴み、詳細ランキングへ移動。 |

**ビジュアル模写は禁止:** コピーするのは画像・色・ブランドではなく「どの情報を主役にし、利用者をどう誘導するか」という設計ロジック。
