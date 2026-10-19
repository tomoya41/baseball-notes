# Turso・ポストシーズン統合品質（2026-10-19）

## Baseline and scope

`39d4128` / PR #51。UI全面再構成はPR #26、重点改善は #27で実施済み。
今回は再設計を繰り返さず、API読み取り負荷とポストシーズンの接続を改善する。
NPB Current、MLB Historical 2014–2025、既存の出典・Coverage・Gate・保存状態を保護する。

## Turso: confirmed versus unknown

2026-10-19のEOD run `39208922455` は `SQL read operations are forbidden`。
その後、既存GitHubログインでOwner Consoleのread-only確認ができた。
ConsoleはFreeプランのrows-read上限超過によるアカウントブロックを明示している。
月間使用量561,729,860 / 500,000,000行、DB storage 15.89MB。単なる認証エラーとは扱わない。
Billing画面はprovider側の表示エラーで、正確なリセット日時は未確認。支払い・プラン変更・制限回避はしていない。
接続成功だけでもDB全体の整合性PASSとはしない。Console screenshotはprivate `.data/`のみとし公開repoに含めない。

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
最小queryでも読み取り拒否が継続している。リセット日は未確認。最新Canonical integrityはNOT VERIFIED。

### Repeated scan root cause

Owner ConsoleのAnalytics「Top Queries / 今月」で、以下の実SQLと平均read量を確認。

| Query | 平均rows read（Console丸め値） | 実行回数 |
|---|---:|---:|
| Integrity auditのGameごとの相関Fact count/SUM | 19.28M | 17 |
| Calendar lifecycleのGameごとのFact count | 6.10M | 16 |
| Game indexのGameごとのFact EXISTS | 3.35M | 34 |

これらは呼び出し回数が少なくても、投球表等をGameごとに繰り返し走査する。
`npbGameFactCountsCte`で打撃・投球をそれぞれ一括materializeしてjoinし、既存の判定式・日付条件・query数を維持した。
COUNTの欠損groupは0、SUMの欠損／全nullはnullを維持し、球団不一致Factsも総件数には保持する。
Scratchの旧SQL/新SQL結果一致、query planからFact相関走査が消えること、既存pending/Coverage/完了証拠の回帰を検証する。
DB index/schema/Facts変更は0。Productionでの削減後使用量と復旧は、quota解除後の別証拠が必要。

API公開後smokeで、circuit応答のCache-Controlに大小文字の異なる重複keyが残る問題を検出。
`Headers.set`で`no-store`を単独設定する修正と回帰テストを追加した。

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

先行PR #52は`5a2bf31`へmerge、Codex Review対象`b262552`は指摘なし。
Pages `39228386376`成功。公開23 HTTPで保護対象20payloadのhash/size不変、sidecar 6,674 bytesと参照12 Game/185 observationsの一致を確認した。
APIの最初のdeploymentは`dpl_3hh6UBSzcVFrgDqa4K52wyggoSp6`、READY／既存production aliasへ反映。
400/503の実応答を確認し、上記header修正を追加したため最終API再deploymentと再smokeを別途行う。

## Device/release gates

今回のADB inventoryでは物理端末0台。Pixel・TalkBackはNOT RUN。
エミュレーターと署名・Play公開のOwner Gateを混同しない。
署名キー・App Links・Play登録・支払い・保存データ削除は行わない。

## Rollback

API変更はhandler/cacheを独立revert可能。DB migration/write、Source取得方式、既存公開payloadの変更は不要。
Vercel APIとGitHub Pagesは別deployment。Web/Vercel build成功をAPI本番反映済みとは扱わない。
