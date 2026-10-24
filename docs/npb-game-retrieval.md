# NPB試合詳細の障害と保存済み結果（2026-10-24）

## 公開環境で確認した問題

PR #72 / `50cf49e`を基準に、公開Homeから10月8日ヤクルト4–0阪神
（`npb:game:49a69ad2efd3bf67d3e5`）を開くと、画面全体が取得エラーになった。

| 層 | 実測・確認 | 判定 |
|---|---|---|
| Pages / 日程・結果 | recent、manifest、10/8 dated JSONが200。スコアとcanonical ID一致 | 結果データの消失ではない |
| Vercel / game-detail | 503 `game_detail_unavailable`、`no-store`、`Retry-After: 30`、CORS `*`、CDN MISS | 詳細APIが利用不能。CORS拒否・HTML誤配信ではない |
| Turso | 既存Owner Console調査でFreeのrows-read上限超過。最新の既存最小probeは39227277414で失敗 | 今回は追加DB probeなし。復旧・最新Canonical整合性は未確認 |
| API実装 | SQL read禁止時だけ30秒circuit、一般例外は1秒。この実応答はread禁止経路と整合 | 一般的な503から認証や障害を独断で断定しない。詳細は既存運用資料参照 |
| Cache | Pagesは保存済みindex、APIは別URL。既存端末の検証済みAPI応答のみ再利用できる | 初回利用者には詳細キャッシュがなく、全画面エラーになっていた |
| Contract | `detailAvailable`は保存Factsの存在でありAPIの稼働保証ではない | indexのcompleteをBox Score取得成功へ読み替えない |

最小HTTP診断のprivate記録は `.data/npb-game-retrieval/public-before.json`。
[既存Turso負荷対策・復旧手順](turso-postseason-readiness.md)を維持。
外部制限を迂回せず、DB修復・トークン変更・課金・高負荷診断を行わない。

## 変更

API成功（検証済み端末キャッシュを含む）は従来のBox Score/Recap/選手リンクを維持。
API例外時だけ、同じcanonical Game IDの公開済み日別結果を照合して表示する。
「保存済みの結果・更新未確認」と、個人成績の取得不能を明示する。
これはAPI復旧でも、個人成績の復元でもない。

空の打撃・投球Factsや合計0を作らず、別型の結果画面にする。
球団の選手一覧は出場選手一覧ではなく、保存済み所属から探す独立した導線。
日程へ戻ると同じ日付へ戻る。手動再読み込みでAPI成功時は従来の詳細画面へ戻る。
404はauthoritative missingとして扱い、過去のindexから復活させない。
不正な日付、異なるID、重複Game、異なる日別payloadは拒否する。
CS・日本シリーズの独立したadapter/Competition条件は変更しない。

## 古いURL・配信量・出典

新しい一覧リンクにはdate hintを付ける。dateなしの既存URLには、公開済み899 Gameの
ID→日付索引を遅延読み込みする。毎回200日分を探索せず、対象日1ファイルのみ取得する。
Homeの追加fetchは0。索引は40,593 bytes（改行を除く）、fallback時だけ取得。
既存の公開アプリJSONを再利用し、新しいSource取得・権利拡張はない。
新規の選手成績、未完了6試合のFacts、Coverage/Gateの更新は0。

索引の原本：`https://tomoya41.github.io/baseball-notes/data/npb/games/manifest.json`
および同じmanifestの200個の日別JSON。effectiveDate 2026-10-12、
generatedAt 2026-10-14T15:05:03.165Z。日時を現在へ書き換えない。
`scripts/generate-npb-game-date-index.ts`は自分の公開JSONだけを読み、同一snapshot・重複・
取得前後manifestの一致を検証。DB query 0。日別body hashはprivate captureへ記録する。
索引はGitの独立変更としてレビューでき、既存の公開immutableデータを上書きしない。
新しいGameはdate hintから開け、必要なら同じ検証手順で索引を更新する。

## 復旧・Rollback

DB制限の解除は推測しない。Owner側で解除が確認できた後、既存のconnection-only probeを1回、
成功後に対象Gameの通常APIを1回確認する。高負荷の全件診断を最初に実行しない。
既存APIの30秒cache・single-flight・read禁止circuitと最適化SQLを維持する。
公開結果の存在でHOT/RankingやFreshnessをhealthyへ変更しない。

今回のadapter/画面/リンク/索引は独立revert可能。DB migration、Canonical write、
既存projection変更、保存データmigrationは不要。
Pixel/TalkBackの物理確認は[実機結果票](android-physical-qa-results.md)で別管理する。
