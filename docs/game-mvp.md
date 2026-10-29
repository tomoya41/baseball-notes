# 試合別MVP

R02/R08、J01。既存の試合詳細に小さなMVP枠を加える。新規画面・URL・統計データは追加しない。既存のコンパクトな見出し15px、選手名13px、44px操作領域を再利用する。

## 選考する範囲

「この試合のMVP（独自選出）」は、その試合の両チームの打撃・投手成績を確認できた場合だけ選出する。同じ日の別試合が未収録でも選出できる。日別MVPは従来どおり日付全体のCoverageと全試合の照合が必要で、条件は緩和しない。日別と試合別は同じ採点関数を利用する。

- 打者：安打＋本塁打×3＋打点。
- 投手：整数アウト数÷3＋奪三振÷2−失点×2。
- 同点は併記。勝利チームだけに限定せず、名前・写真の有無を加点しない。守備・走塁・打席の重要度は未評価。公式表彰や勝利貢献度の推定ではない。

試合終了、両チームの収録完了、canonical ID、所属球団、選考指標の整数・算術整合性を確認する。NULLを0にせず、不明選手・重複・片方の球団の欠損・将来の日付は保留。出典は既存のその試合のボックススコアと共通で、選考のためのSource/DB/API通信は0。未収録の個人成績は生成しない。

NPB公式戦は取得済みの完全なGame Detailから選ぶ。Turso停止中のスコアfallbackでは選手成績を持たないため保留。CSの部分成績、日本シリーズの個人成績未収録も「この試合」の未収録表示にし、架空のMVPを作らない。NPB HOT/RankingのProduction Gateは変更しない。

MLBは採用済み2014–2025 Historicalのみ。公式戦とポストシーズンのGameを別々に選考し、選手リンクに年度・試合区分を保持する。2026 Currentの取得・Gateは変更しない。既存のRaw/JSON、統計、ID、URL、Favorites/Collections/Watch/バックアップ形式は変更しない。

## 検証

試合単位と日別の独立性、欠損/null/0、重複、本人・球団の不整合、未来/未終了、投球アウト、同点、MLB Postseasonの年度リンクをテストする。公開済み実Gameでの選出結果、360px Light/Dark、Android回帰、全チェック・公開後の保全は配信PRに記録する。Pixel/TalkBack・正式署名は独立した未検証Gate。

rollbackは通常のアプリrevert。データasset/pin・保存schema・外部Source契約の変更はない。追加月額費用¥0。

2026-10-29ローカル：215 test files、2,091 PASS＋Windows既存条件の1 SKIP（Linuxで全2,092）。Lint/typecheck/Web/Vercel build成功。[360px Light](assets/game-mvp/360-light.png)・[Dark](assets/game-mvp/360-dark.png)は実アプリ。公開済み2024-05-27のマーリンズ対パドレス（Retrosheet、打撃30行/投球9行）ではマイケル・キングの5回/7奪三振/1失点（自責1）、独自指標6.5を選出。日本語名は既存の本人対応表による。新たな成績取得・補完は0。

NPB運用の別制約：Scheduled EOD [40797169920](https://github.com/tomoya41/baseball-notes/actions/runs/40797169920)は`database_read_suspended`、DB/Source通信0。抑止予約は2026-10-28T21:03:29Zから24時間（実BLOCKED run 40768632414）。解除時刻は復旧の証拠ではない。NPB HOTは最低母数・Coverage・Scheduled本番証拠の条件を維持し、公開候補の別名表示は行わない。試合別MVPの機能追加をHOT復旧と呼ばない。
