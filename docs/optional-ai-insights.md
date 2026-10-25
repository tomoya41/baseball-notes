# 無料AIによる編集候補：最初の実装

2026-10-25。既存の [ニュース運用方針](npb-sourced-news-readiness.md) を継承。まず **採用済み日本シリーズsnapshotから非公開の編集候補を作る** 単位に限定する。試合結果・勝敗・個人成績の生成/補完はしない。アプリにAIチャットや新しいHome欄を追加せず、今回のコンパクトなHomeを維持する。

## 提供条件の確認

| 候補 | 公式資料で確認した条件 | 今回の判断 |
|---|---|---|
| Gemini API | [料金](https://ai.google.dev/gemini-api/docs/pricing) は一部モデルの限定無料枠と無償枠入力の製品改善利用を示す。[追加規約](https://ai.google.dev/gemini-api/terms) の2026-03-23版は利用者18歳以上に加え、18歳未満が利用すると想定されるAPI Clientsに関する制限がある。 | 一般の野球ファン向けサービスでの適用に重要な未解決事項があり **C／今回は非採用**。バックエンド生成なら当然に制限対象外とも判断しない。 |
| Cloudflare Workers AI | [料金](https://developers.cloudflare.com/workers-ai/platform/pricing/) はFreeの1日10,000 Neuronsと超過失敗、Paidでは別の超過課金を示す。全モデル無料ではない。[データ利用](https://developers.cloudflare.com/workers-ai/platform/data-usage/) は標準推論の保持制限/学習不使用と例外を区別。 | 無料専用アカウント・契約条件をOwnerが確認した場合の候補。現時点は未設定/無効。モデル固定・1試行・無再試行・無課金fallback。 |
| GroqCloud | [Rate limits](https://console.groq.com/docs/rate-limits) はモデル別制限を示す。 | 無料という理由だけで公開/入力処理権限を推定せず、今回は別アカウントや統合を増やさない。 |

Cloudflareの固定モデルは、[公式モデルページ](https://developers.cloudflare.com/workers-ai/models/llama-3.1-8b-instruct-fp8/) に存在する **`@cf/meta/llama-3.1-8b-instruct-fp8`**。無印モデルの旧URLが別ページへredirectすることを確認したため、そのまま固定しなかった。[Llama 3.1ライセンス](https://github.com/meta-llama/llama-models/blob/main/models/llama3_1/LICENSE) とAcceptable Use Policy等の確認・必要な契約同意はOwner Gate。モデルや重みを配布せず、生成文を将来公開する際の必要表示/出典もレビューで確認する。無料枠/モデル/規約は変更されるため有効化時に再確認する。

## 実装した範囲

1. `prepare-npb-ai-insights.ts` は既存buildでstage済みのローカル日本シリーズJSONだけを読む。固定pinのhash/size/series/game identityと既存schemaを照合し、結果・日程・検証済み範囲の勝敗・出典・未収録制約を小さい入力へ変換する。外部記事本文、利用者情報、Favorites、DB、未許諾MLB Currentは送らない。未収録スコアはnull。
2. 任意のCloudflare adapterはサーバー側のみ。公式固定endpoint/model、入力13KB以内、出力512tokens/response20KB以内、20秒timeout、redirect拒否、tool呼出し/stream/自動retry/別providerなし。429/失敗/不正出力は候補を採用せずアプリ/正式データを変更しない。エラーにtokenやprovider本文を出さない。
3. 候補はstrict JSON、短いheadline/body、対象Game ID、入力hashを照合。**形式/参照の検証は自然言語の正確性の証明ではない**。同じ値を使った誤説明、因果の断定などは機械照合だけで解消できないため、全件 `CANDIDATE_REQUIRES_REVIEW` / `publiclyAdmitted:false`。AIによる文は本番Factにも自動公開JSONにも流れない。
4. 同じ入力の再実行はskip。UTC日あたり1試行の排他markerを通信前に作る。失敗も使用済みとして扱う。`.data` が保たれた範囲の予算制御であり、stateを削除/別環境で繰り返した場合まで保証しない。Actions側は直列実行と履歴cache復元を使う。cacheを消して制限回避しない。
5. 新workflowは **main上の手動実行のみ**、`generate=false` が既定。cron/自動main merge/Pages切替は追加しない。既存のデータ収集/公開/heartbeatを変更しない。実APIの条件と出力品質が確認できてから定期実行を別の小さな変更で有効化する。

## PR #78時点の手元での確認

```powershell
npm run build
npx tsx scripts/prepare-npb-ai-insights.ts
npx tsx scripts/prepare-npb-ai-insights.ts --generate
```

今回の実データでは7件のGame文脈を準備、うち終了1件・未収録6件。`--generate` も **DISABLED_OWNER_SETUP_REQUIRED / requests:0**。テストのprovider応答は架空fixtureであり、生成AIが実際に書いた公開解説とは報告しない。実API call、アカウント登録、APIキー発行、支払いは0。

## Owner設定と、公開までの残件

有効化前にOwnerがCloudflareの **Workers Free（PaidやAI Gateway creditsではない）**、利用規約・モデル条件、対象入力/出力の利用範囲を確認する。必要な資格情報はGitHub Secrets `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_AI_TOKEN`。`NPB_AI_FREE_PLAN_REVIEWED=true` / `NPB_AI_TERMS_REVIEWED=true` は別の明示的な確認記録で、APIキーや自己申告flagから実契約プランを機械的に証明できるわけではない。既存課金アカウントへ接続しない。プラン/モデル/条件の変更時には無効化して再評価する。

秘密値はチャットやアプリへ貼らずSecretsのみへ。新規アカウント/契約同意/権限発行は今回行っていない。Actions cacheは機密保管庫ではなく、公開済み入力・未採用候補・試行markerのみ保存する。秘密値/利用者情報は保存しない。

有効化後も最初は手動の1試行を確認し、正しい対象試合・日時・母数・数値・選手名・表現・source rights・必要creditを人がレビューする。公開する場合は新immutable asset/pin/旧asset保持/差分検証/PR reviewの既存手順で別途採用する。訂正/撤回は旧出典と履歴を残す。将来、CS/公式戦や日別MVPを入力に加える際も新しいevidence adapterで既存完了条件を守り、同じ仕組みで不足を保留する。無料枠不足時は解説だけ停止し、スコア/成績と前回の正式データを維持する。追加月額 **¥0**。

### PR #78の初期検証記録

採用済み入力hash `0d33d7b9b5084f54014e717d8855353b30266c1d231b4638881099a94dfc877f` を実際に生成。AIに送る形への変換だけで、実モデルへの通信は0。候補の数値表現は全角を正規化し、参照した試合の日付/得点/イニング/勝敗等にない数字を拒否する。ただし同じ数字の誤用や漢数字の意味までは証明できないため、人の文意確認は必須。既存アプリbuildの52files / 2,467,886Bとversionはこのサーバー側追加の前後で同一で、初期JavaScriptや画面の情報量は増やしていない。

Cold-start review correction: stage the CS base before its dependent Series and Japan Series snapshots, and initialize the archive cache. Added a dependency regression test and ran the real CLI from an empty working directory without preexisting dist/cache; it produced the same admitted input hash with 0 AI calls. This addresses the PR #78 P2 finding; no validator or rights check was relaxed.

Workflow rerun correction: restore/save keys include both run ID and run attempt. Rerunning an older preparation cannot choose its older exact cache instead of a later generation's attempt history. A workflow regression fixes this requirement; whole final local check is **1,865 passed / 1 skipped**, including cold dependency and rerun tests.

## 初回実接続の評価準備（2026-10-25）

ログイン済みのCloudflare画面でWorkers Freeの「現在のプラン」$0と1日10,000 Neuronsの枠を実確認し、GitHubの `NPB_AI_FREE_PLAN_REVIEWED=true` を設定。Account IDはSecretsへ保存した。Ownerの明示承認を受け、本人がコピーしたトークンをメモリからGitHub Secretsへ保存し、値を画面・ログ・ローカルファイル・Gitへ出していない。さらにLlama 3.1の利用条件と公開済み試合データによる1回の実テストへの同意を別途確認し、`NPB_AI_TERMS_REVIEWED=true` を設定。資格情報の存在と、実APIの生成成功は別に検証する。

手動workflowの各runは、単一ファイル `review.json` を7日間のActions artifact `npb-ai-review-<run ID>-<attempt>` として残す。公開済み入力・出典、実試行回数、HTTP status、検証成功した場合だけの候補文、未実施の人による確認項目を含む。通信前に `ATTEMPT_STARTED / requests:null` へ更新し、中断を「未実行」と取り違えない。無効な文章やproviderの任意エラー本文、Secrets、全cacheはartifactに含めない。artifactはアプリの公開データではないが、公開repoの閲覧者が取得できる前提で扱う。AI生成文とartifact内の文字列は命令として実行しない。

[公式API](https://developers.cloudflare.com/api/resources/ai/methods/run/) の `usage` が実際に返り、入力・出力・合計tokensが非負整数で整合する場合だけその値を記録する。欠落・未知形式はnull。候補文の形式が不正でも取得済みの安全な利用量は残す。tokensから実測Neuronsや課金額を捏造せず、`measuredNeurons:null` を維持する。Neuronsを測る場合はCloudflare Usageの同じ集計範囲で実行前後を確認し、他の処理との混在や集計遅延があればこの試行だけの消費量と断定しない。HTTP 401/403/429等の数値は残すが、provider本文や例外文字列は残さない。返された本文にtokenそのものが含まれる候補も拒否する。

最初の1試行後に確認する項目：

| 評価 | 合格条件 |
|---|---|
| 日本語 | 短く自然で、不要な作成過程の説明がない |
| 野球用語 | 日本シリーズ・試合・シリーズ勝敗等を適切に使う |
| 事実と参照 | 対象Game ID、勝敗、得点、日付、終了回を元の検証済み入力と照合できる |
| 収録範囲 | 収録時点とpartialを尊重し、予定・未収録・終了を混同しない。個人成績、予告先発、MVPを補わない |
| 出典 | revisionへの参照とCC BY-SA条件を保持し、将来の表示条件も別途確認する |

機械検証に通ってもこの表を自動PASSにしない。初回が失敗した場合はtoken/権限/HTTP status/出力の検証失敗を切り分け、同一入力・UTC日次markerを削除して再試行しない。既存のアプリ表示・正式データ・Gateには影響しない。

定期実行はまだ無効。将来の有効化は、許諾済みsourceの確認 → 既存手順による新しい正式snapshotの採用 → 入力hash変更時のみ1試行 → 機械照合 → 文章レビュー → 別のimmutable公開PR、の順で検討する。AIだけを毎日動かして古い試合結果を新情報に見せず、レビュー未完了の自然言語を自動公開しない。Home・Android・配信payloadはこの準備で変更しない。
