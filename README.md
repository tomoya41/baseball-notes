# Baseball Notes — NPB / MLB Data App

Androidを主対象とする野球データアプリ。製品仕様は [SPEC.md](SPEC.md)、恒久ルールは [AGENTS.md](AGENTS.md)、重要な判断は [docs/decisions.md](docs/decisions.md) を参照。

## 現在できること

React + TypeScript strict + Vite + Capacitor Androidの構成。ホーム / 検索 / 分析 / 記録 / マイの5項目ナビ、NPB・MLB切替、選手・球団検索、選手詳細、端末保存のお気に入り、指標説明、stale表示を実装。Home / Player / 参考ランキングにLight/Dark対応のデザインシステムを適用しています。

**選手・Analysis等の既存UIは架空のサンプルデータです。NPB Homeの順位表のみ、日次Collectorが生成した実データPayloadを表示できます。** 実選手の今季成績はUIへ未接続です。ランキングはサンプル内の参考表示で、規定条件や公式順位ではありません。Analysis画面には共通フィルター・カテゴリー・詳細・状態表示を実装。MATCHUPは投手/打者の手動選択と対戦分析UI、WATCHはHomeの今日の試合から進むUI契約を実装しました。Retrosheet 2025年の歴史順位も別途生成できます。

- [アーキテクチャ](docs/architecture.md)
- [データ取得元の調査](docs/data-sources.md)
- [MLB / NPB Capability Matrix](docs/analysis-capabilities.md)
- [デザインシステム](docs/design-system.md)
- [日次データ基盤](docs/data-architecture.md)
- [NPBリモート収集・配信運用](docs/npb-remote-delivery.md)
- [NPB 1試合全出場者収集の検証](docs/npb-game-proof.md)
- [NPB別試合のEdge Case検証](docs/npb-game-edge-proof.md)
- [検証・整理記録](docs/verification.md)

## ブラウザで開発

Node.js 24 LTS推奨（`.nvmrc`）。現在のツール群に合わせNode 22.13以降が必要です。npmを使用し、lockfileをコミットします。

```powershell
npm ci
npm run dev
```

表示されたlocalhost URLを開きます。APIキー・環境変数・課金サービスは不要です。Viteの既定は5173、使用中の場合は次の空きポートを表示します。

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run preview
```

一括実行は `npm run check`。watchは `npm run test:watch`。previewはbuild後に実行してください。

## Android

`android/`はCapacitorで生成したネイティブプロジェクトを管理しています。clone後に `cap add android` を再実行する必要はありません。

前提：Android Studio 2025.2.1以降、JDK 21、Android SDK Platform 36。minSdkは24です。詳細は [Capacitor環境要件](https://capacitorjs.com/docs/getting-started/environment-setup) と `android/variables.gradle` を確認。

```powershell
npm ci
npm run android:sync
npm run android:open
```

Android StudioでSDKを設定し、端末またはエミュレーターを選択してRunします。CLIでdebug APKを作る場合：

```powershell
.\android\gradlew.bat -p android assembleDebug
```

JDKの場所を `JAVA_HOME` に、SDKの場所をAndroid Studioまたは `android/local.properties` に設定します。マシン固有のパスや署名鍵はGitへ追加しません。

**この作業環境ではJava/Android SDKを確認できず、APKビルド・実機動作は未検証です。** Web build、Androidプロジェクト生成、`cap sync android`まで確認しました。Windowsの日本語/OneDrive配下でAndroid Gradleがpath errorを出す場合は、ASCIIの短いパス（例：`C:\dev\baseball-data-app`）へcloneして再試行してください。チェックを無効化して回避しません。

## データ・保存

`SampleProvider` → wire validation → normalization → domain validation → Repository → UI。外部Provider追加時は `src/app/services.ts` の組立て箇所を変更します。UIに外部APIを直接つながないでください。

歴史順位のCollectorは別経路です。Retrosheetの許諾済み2025年ZIPを明示的に取得し、ローカルSQLite互換DBへ入れます。DB、archive、生成した静的JSONはGit対象外です。

NPB実データ第1弾はnf3公開ページを1日1回、逐次・少数アクセスして収集します。NPB公式ページは二次利用・無断転載禁止のためCollectorに使いません。2026年9月時点で確認したnf3の公開ページには明示的な禁止を見つけていませんが、再利用許諾を保証するものではありません。詳細は[Source記録](docs/data-sources.md)。選手ログは阪神の検証済み4選手だけで、完全なリーグ収集ではありません。

```powershell
npm run collector:npb -- --fetch --date 2026-09-23
npm run collector:npb -- --offline-raw --date 2026-09-23 --dry-run
```

通常は `npm run collector:npb:daily` が日本時間の前日を対象にします。Raw HTMLは`.data/raw/nf3/`にgzipで14日保存し、DB・生成PayloadとともにGit対象外です。ローカル生成Payloadは`public/data/standings/npb/latest.json`です。本番WebはGitHub Pagesの同一Origin、Androidは公開Pages URLをRepository経由で参照します。公開URLは`VITE_NPB_DATA_BASE_URL`で上書きできます。GitHub Actionsの定期実行は手動のdry-run・remote ingest・Pages配信を検証後、2026-09-24に`NPB_COLLECTOR_ENABLED=true`で有効化しました。初回の自動schedule実行結果は未確認です。過去日の順位は当日のRaw Captureなしに再構築できないため、現在ページを過去日に偽装するBackfillを拒否します。

```powershell
npm run collector:import -- --date 2025-06-01 --fetch --dry-run
npm run collector:import -- --date 2025-06-01 --zip .data/raw/2025csvs.zip
```

`--dry-run`はFact/Snapshotを書きません。2行目は再取得せず、保存・静的Payload出力まで実行します。出力先は`public/data/standings/mlb/2025-06-01.json`。Retrosheetの指定クレジット原文をPayloadに含めていますが、公開画面では目立つ表示も必要です。`TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN`はCollector専用で、remote DBはTurso Freeの東京リージョンに作成済みです。詳細は[データ基盤](docs/data-architecture.md)。

- お気に入り：Android Preferences / Web localStorage。アプリ削除やサイトデータ削除で消えます。同期機能なし。
- キャッシュ：IndexedDB、正規化済みcatalogをリーグ・Provider別に保存。期限切れ/通信失敗を表示し、取得時刻と元データ更新時刻を分離。
- AndroidはWeb assetsを同梱。ブラウザの完全オフライン起動はService Worker未導入のため保証しません。
- `public/data/*.json`は実装とテストが使う架空データで、不要mockではありません。
- 実ProviderやDBのAPI keyを `VITE_*` やAndroidバンドルへ入れないでください。これらは秘密を保持できません。現在 `.env` は不要です。

## Analysis A

`src/domain/analysis.ts`：Query / Capability / Result / Split / SampleSize / 座標定義。
`src/domain/analysis-query.ts`：前日までの暦日窓、Capability admission、query identity。
`src/app/analysis-policy.ts`：母数警告値と現在のProviderの無効化manifest。

日本向けの表示ルールは `SPEC.md` §31。`src/presentation/formatters.ts` が数字・単位・日本時間・名前・母数の表示を担当し、`src/domain/metrics.ts` と `src/domain/baseball-terms.ts` が指標・守備位置・球種の定義を持ちます。高度指標の説明は画面のⓘで任意表示。サンプルの検索用別名は検証済み日本語表示名として扱いません。

Capabilityはリーグ名のif文ではなく、データ条件・実装状態・対象期間・主体・season type・指標・フィルターの組み合わせを検証します。未確認なら無効。AnalysisProviderは契約のみで実データの実装はありません。現在の選手サンプルを分析データの存在証明には使いません。

Analysis基盤の次の候補タスクは、架空の集計結果だけを返す契約テスト用AnalysisProviderを1つ作り、`AnalysisQuery → admission → result validation` の経路を検証することです。日時/母数/empty/unavailableを確認し、実API接続やAnalysis Bへは広げません。

## GitHub / プレビュー / 0円制約

ローカルGitと作業ブランチを作成済み。公開GitHubリポジトリへpushしました。GitHubリポジトリへ追加する際は、既存ブランチをレビューし `npm run check` を通してください。

`.github/workflows/check.yml` はpublicリポジトリの標準無料runnerでlint/typecheck/test/build/Capacitor syncを行います。privateではjobをskipします。private CIはアカウントの無料枠と課金停止設定を確認するまでローカルチェックを使います。公開repoのFoundation checksは成功しました。

Vercelは必須ではありません。必要な場合だけ個人・非商用Hobbyの静的プレビュー（build=`npm run build`、output=`dist`）として利用できます。HashRouterなのでrewriteは不要です。上限・適格性を確認し、有料プランや超過課金を自動導入しません。バックエンド、DB、Cron、通知、AIには接続していません。

## 今回の停止位置

Phase 0の骨格＋縦方向実装、Analysis Aの契約、Design Aと代表画面、Capabilityに従うAnalysis / MATCHUP / WATCH UIまで。Hot、正式な記録・ランキング、ドラフト、FA、Prospect、通知、AI、実データのAnalysis/MATCHUP集計および今日の日程/打順取得は未実装です。次Phaseへ自動的に進みません。
