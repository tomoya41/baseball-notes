# 日本シリーズ更新・写真・診断（2026-10-25 JST）

## 更新判定

許可済みWikipedia APIを1回取得。観測 **18:49:15 JST**、記事 **5306035 / 111511916**（本文SHA256 `089ec3ac73f60c48e6f07bdc9dabacfdabe5ac2b886fe3ae963f47875911ab44`）、日程 **5307595 / 111501854**（SHA256 `fcf651e9fd6cf0ee98e563d9e5a256e4230ff1659331e29580ed55e0ebe7c167`）。第2戦の空欄イニング・仮0点・未完成選手表は終了証拠ではない。投手/捕手欄も予告先発発表として扱わない。

既存validatorで非公開scratch再構築・前版比較：**追加確定結果0、日程変更0、既存確定結果1を維持**。取得日時や未採用記事編集だけでは新releaseを作らない。公開v2は第1戦ソフトバンク **3–1** DeNA（延長11回）、勝敗 **ソフトバンク1勝／DeNA0勝**。次の収録予定は10月25日第2戦・横浜。他6試合の結果null、個人成績未収録、Coverage partial。この観測後まで確認済みとは主張しない。[次回の正式更新手順](japan-series-updates.md) は維持し、Homeの最新結果/勝敗/次戦は同じsnapshotから生成する。

予告先発は **未収録** のまま [NPB公式](https://npb.jp/announcement/starter/) へ接続。今回のtimeoutを未発表の証拠にしない。[NPB+規約](https://www.japan-baseball.jp/npb-plus/terms/) の収集/二次利用制限を確認したが別サイトへの適用を推測しない。Wikipedia途中表や既存nf3 Current権限を日本シリーズの予告先発へ拡張しない。予定する継続取得/保存/公開の十分な根拠を持つ別sourceは確認できず **C／保留**。

## Homeの情報量を減らす

[Apple Sports公式説明](https://www.apple.com/newsroom/2024/02/introducing-apple-sports-a-new-app-for-sports-fans/) はスコア/次戦への速いアクセスとお気に入りを重視。[スポナビ公式説明](https://sports.yahoo.co.jp/promo/app/bblive/) は試合の流れとフォロー球団へのアクセスを示す。これらは機能の一次情報であり、人気の因果証明ではない。

採用した設計判断：日本シリーズは短い結果/勝敗/次戦の一覧として保持し、注目選手・追加試合情報・出典は開いたときだけ表示する。CSデータも開くまで取得しない。英語の重複見出しを除き、見出し20→16px、スコア44→24px、縦余白を縮小。操作領域44px以上・端末文字拡大・Light/Darkは維持。公式戦スコア/フォロー導線を季節特集画像より前へ移動する。試合詳細/シリーズ画面の機能は削除しない。変更前360pxの日本シリーズsectionは **1,756px** あり、通常導線を押し下げていた。変更後は実画面で計測しPRに保存する。

## 写真・評価の保全

正木智也（2022年、CC BY-SA 4.0）／杉山一樹（2024年、CC0 1.0）を追加。[個別の権利/identity/hash](visual-assets-rights.md#2026-10-25-evening--masaki-and-sugiyama) を参照。既存7点は変更せず計9点、新規 **27,414 B**。撮影年/原写真履歴/作者/license/変更表示を維持しCC0にShareAlike義務を誤表示しない。写真は選考根拠や現在所属・背番号の証拠にしない。

PR #76の統計・選考条件は変更しない。正木のCS収録 **2試合8打数2安打3打点**、東の **1登板7回5安打2奪三振1失点1自責点** を照合。牧/杉山の公式戦partialとCSを分離、杉山のCS自責点nullを0にしない。日本シリーズ実績/公式表彰/公式順位と混同しない。

将来の日本シリーズ個人成績は、真のprovider/権利範囲、Game/date/stage、独立IDとcanonical照合、実際の打撃/投球outs、完了証拠/全参加者の収録範囲、訂正履歴を新たなadmitted contractで確認して接続する。日別MVPは同日全対象試合の完了/完全な試合別成績が必要。現時点は **選手成績未収録** で選出せず、CS/公式戦集計を日本シリーズFactsへ転用しない。

## Freshnessは別の障害

[Scheduled run 40176719722](https://github.com/tomoya41/baseball-notes/actions/runs/40176719722)、main `d7394c51d009f1c4d2ae87068dd77519f2bf55f4` の既存CIログだけを参照。DB再試行0。`diagnoseNpbIngestion` が **LibsqlError: BLOCKED / SQL read operations are forbidden** で診断JSON出力前に中断。別にScheduled開始遅延の下限約311分が記録された。日本シリーズ静的更新とは別問題。quota量/reset日/プラン原因は確定していない。

修正は診断の継続だけ。既存の1試行が失敗したら追加calendar照会を省略し接続を閉じる。URL/token/SQLを含み得る例外本文を出力せず固定の `ingestionError: {kind:database_read_blocked,code:BLOCKED}`、他のDBエラーはUNAVAILABLE。独立した公開Freshness/Scheduled診断は続ける。**`--require-healthy` はDB診断エラー時も失敗**、stale・未検証snapshot・Coverage・Backup・Gateを健康扱いしない。

無料枠回復は未確認。次の通常Scheduled証拠を使い強制rerun/全件監査/別DB迂回/課金をしない。[既存復旧手順](npb-freshness-operations.md) とキャッシュ/静的配信を維持する。最新Canonical integrity PASSやBackup成功、HOT/Ranking公開可能とは報告しない。

## 配信と残件

Canonical/Facts、既存統計pin/immutable assets、個人保存、PR #73の保存スコアfallbackは維持。rollbackは通常commit revert、以前の統計assetは削除しない。[ロゴ窓口・未送信文案](club-logo-permission-preparation.md) を準備し公式ロゴは0件のまま。追加月額 **¥0**。

テスト/build/Android 36/360px Light・Dark/HTTP/hash/公開画面/reviewの実行証拠はPRへ。Pixel実機・TalkBack・旧APKとの署名継続性は独立のNOT RUN／未解決としエミュレーターで代替しない。

### Local visual evidence

360 CSS px / normal font: Japan Series section **1,756→256px (−85%)**; score **44→24px**; regular-results area now starts at **392px**, without horizontal overflow. Before/After are real browser captures, not mockups: [before](assets/compact-home/before-360-light.png), [Light](assets/compact-home/after-360-light.png), [Dark](assets/compact-home/after-360-dark.png). Home starts without any portrait/CS feature mounted; expansion preserves exact-ID photo/stat navigation. Full local validation: **1,856 passed / 1 intentionally skipped**, lint/typecheck/Web/Vercel build passed. Android and publication receipts follow in the PR. Physical `adb devices -l` returned no connected device; Pixel/TalkBack remain NOT RUN and signing continuity unresolved.
