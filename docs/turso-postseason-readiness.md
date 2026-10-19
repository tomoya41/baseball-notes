# Turso・ポストシーズン統合品質（2026-10-19）

## Baseline and scope

`39d4128` / PR #51。UI全面再構成はPR #26、重点改善は #27で実施済み。
今回は再設計を繰り返さず、API読み取り負荷とポストシーズンの接続を改善する。
NPB Current、MLB Historical 2014–2025、既存の出典・Coverage・Gate・保存状態を保護する。

## Turso: confirmed versus unknown

2026-10-19のEOD run `39208922455` は `SQL read operations are forbidden`。
これはproviderによる読み取り拒否の証拠であり、無料枠超過・請求状態・アカウント制約のどれが原因かは未確定。
最新Usage/リセット時刻は未取得で、Owner Consoleでの確認が必要。接続成功だけでもDB全体の整合性PASSとはしない。

確認日2026-10-19の[公式料金](https://turso.tech/pricing)は無料枠 $0、月間500M rows read。
[公式の使用量説明](https://turso.tech/blog/tips-for-maximizing-your-turso-billing-allowances-48a0fca163e9)では、返却行数だけでなく走査した行もread量に関係する。
プラン変更・課金・別アカウントによる制限回避は行わない。

## API mitigation

公開用7 endpoint（Recent、Analysis、Analysis Bundle、Home/Away、Opponent、Game Log、Game Detail）だけに、検証済みqueryをkeyとする30秒メモリキャッシュを追加。
同じqueryの同時実行は1回に集約する。上限32件・合計8MiB・1レスポンス2MiB、同時distinct query上限32。
明示的なread禁止だけを検出し、30秒間新規DB試行を抑止、503 + `Retry-After`を返す。
400/404/503は`no-store`。通常のネットワーク例外をquota制限と決めつけず、エラー本文・認証情報は公開しない。
正常なキャッシュでも元の基準日・Coverage・Freshnessは書き換えない。

これはwarm serverless instance内だけの最適化。複数instance全体の回数制限や、providerの拒否解除は保証しない。
Collector、Scheduled evidence、Backup、Production Gateには適用しない。
静的配信済みのNPB Historical/CS/選手イベント、MLB HistoricalはDBを必要としない。

## Minimal diagnosis

`NPB period batch read-only verification`の`connection_only=true`は既存`SELECT 1`検査だけを1回実施。
表走査・Facts取得・HOT診断・公開生成は実施せず、結果は認証情報を含まないJSONで記録する。
拒否時は失敗として残し、retryを自動増殖させない。従来の完全診断は明示的に通常modeを選んだ場合だけ。

実行 `39227277414`（2026-10-19 09:04 UTC）は1 query / write 0 / table scan 0で `reads_blocked`。
最新でも読み取り拒否が継続している。リセット日や正確な超過量は未確認。最新Canonical integrityはNOT VERIFIED。

## Licensed CS series evidence

既存CS v4の原本アーカイブを再利用し、新規Source取得なしで4シリーズの勝敗を抽出した。
原本取得2026-10-18 05:41:42.885 UTC。

- [パ・リーグ記事 revision 111417089 / 執筆者](https://ja.wikipedia.org/w/index.php?curid=5301694&oldid=111417089)
- [セ・リーグ記事 revision 111424439 / 執筆者](https://ja.wikipedia.org/w/index.php?curid=5302364&oldid=111424439)
- [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)

変更内容はinfoboxのシリーズ勝敗・順位別勝敗数の正規化と、既存Game IDへの照合。
記事の明示的勝敗、12試合のスコア、独立した順位別勝敗数を既存[2026 CS規則](https://npb.jp/games/2026/info_cs.html)validatorへ入力し、3者の不一致を拒否する。
パFinalは試合3勝＋advantage 2勝、セFinalはDeNAの試合4勝対阪神のadvantage 1勝。
AdvantageからGameを生成せず、First→Finalの進出関係だけを正規化する。
日本シリーズの試合・成績・優勝結果は未収録。CS決着の確認と大会全体の完全収録は別。

新規namespaceは`baseball-notes:npb:series:v1:2026:<pageId>:<stage>`のSHA-256からUUID形式へ固定。
記事revision・勝者変更で再採番せず、既存Game/Player/Team IDは一切変更しない。
既存CS v4の249,383 bytes・12 Game・179 aggregate・185 per-game observationは不変。
sidecarは6,674 bytes・4 seriesの1ファイル。既存アーカイブを変更せず、新しいimmutable asset/pinとして先に配信する。
データのlicenseはCC BY-SA 4.0、アプリコードとは区別する。SourcesリンクをHub/Seriesから保持する。

## Release sequence

1. API・最小診断・series schema/parser・inactive sidecar stagingをレビュー／merge。
2. Pagesへsidecarを先行配信し、body hash・参照Game hash・既存payload不変を確認。
3. Hub/Series UIを別commit/PRで有効化。旧APKのCS v1–v4は保持する。
4. Android/公開HTTP/実画面確認。APIはVercel側のdeployment状態を別途記録する。

## Device/release gates

今回のADB inventoryでは物理端末0台。Pixel・TalkBackはNOT RUN。
エミュレーターと署名・Play公開のOwner Gateを混同しない。
署名キー・App Links・Play登録・支払い・保存データ削除は行わない。

## Rollback

API変更はhandler/cacheを独立revert可能。DB migration/write、Source取得方式、既存公開payloadの変更は不要。
Vercel APIとGitHub Pagesは別deployment。Web/Vercel build成功をAPI本番反映済みとは扱わない。
