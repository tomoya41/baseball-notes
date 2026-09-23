# Baseball Notes — NPB / MLB Data App

Androidを主対象とする野球データアプリ。製品仕様は [SPEC.md](SPEC.md)、恒久ルールは [AGENTS.md](AGENTS.md)、重要な判断は [docs/decisions.md](docs/decisions.md) を参照。

## 現在できること

React + TypeScript strict + Vite + Capacitor Androidの最小構成。Home / Players / 選手詳細 / お気に入り、NPB・MLB切替、名前・読み・チーム・守備位置の検索、指標説明、保存済みデータの再利用とstale表示を実装。

**現在はすべて架空のサンプルデータです。実選手・今季成績・ライブAPIは接続していません。** 実データへの利用許諾が未確定のまま取得しないための意図的な境界です。AnalysisはAの仕様・型・Capability判定・期間/母数検証まで。分析画面・集計・日次取得は未実装です。

- [アーキテクチャ](docs/architecture.md)
- [データ取得元の調査](docs/data-sources.md)
- [MLB / NPB Capability Matrix](docs/analysis-capabilities.md)
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

- お気に入り：Android Preferences / Web localStorage。アプリ削除やサイトデータ削除で消えます。同期機能なし。
- キャッシュ：IndexedDB、正規化済みcatalogをリーグ・Provider別に保存。期限切れ/通信失敗を表示し、取得時刻と元データ更新時刻を分離。
- AndroidはWeb assetsを同梱。ブラウザの完全オフライン起動はService Worker未導入のため保証しません。
- `public/data/*.json`は実装とテストが使う架空データで、不要mockではありません。
- 実ProviderのAPI keyを `VITE_*` やAndroidバンドルへ入れないでください。これらは秘密を保持できません。現在 `.env` は不要です。

## Analysis A

`src/domain/analysis.ts`：Query / Capability / Result / Split / SampleSize / 座標定義。
`src/domain/analysis-query.ts`：前日までの暦日窓、Capability admission、query identity。
`src/app/analysis-policy.ts`：母数警告値と現在のProviderの無効化manifest。

日本向けの表示ルールは `SPEC.md` §31。`src/presentation/formatters.ts` が数字・単位・日本時間・名前・母数の表示を担当し、`src/domain/metrics.ts` と `src/domain/baseball-terms.ts` が指標・守備位置・球種の定義を持ちます。高度指標の説明は画面のⓘで任意表示。サンプルの検索用別名は検証済み日本語表示名として扱いません。

Capabilityはリーグ名のif文ではなく、データ条件・実装状態・対象期間・主体・season type・指標・フィルターの組み合わせを検証します。未確認なら無効。AnalysisProviderは契約のみで実データの実装はありません。現在の選手サンプルを分析データの存在証明には使いません。

次の小タスクは、架空の集計結果だけを返す契約テスト用AnalysisProviderを1つ作り、`AnalysisQuery → admission → result validation` の経路を検証することです。日時/母数/empty/unavailableを確認し、実API接続やAnalysis Bへは広げません。

## GitHub / プレビュー / 0円制約

ローカルGitと作業ブランチを作成済み。remote作成・push・公開はしていません。GitHubリポジトリへ追加する際は、既存ブランチをレビューし `npm run check` を通してください。

`.github/workflows/check.yml` はpublicリポジトリの標準無料runnerでlint/typecheck/test/build/Capacitor syncを行います。privateではjobをskipします。private CIはアカウントの無料枠と課金停止設定を確認するまでローカルチェックを使います。remote CIはまだ実行していません。

Vercelは必須ではありません。必要な場合だけ個人・非商用Hobbyの静的プレビュー（build=`npm run build`、output=`dist`）として利用できます。HashRouterなのでrewriteは不要です。上限・適格性を確認し、有料プランや超過課金を自動導入しません。バックエンド、DB、Cron、通知、AIには接続していません。

## 今回の停止位置

Phase 0の骨格＋縦方向実装、Analysis Aの仕様・モデル・検証まで。Hot、記録、ドラフト、FA、Prospect、通知、AI、Analysis B–Gは未実装です。次Phaseへ自動的に進みません。
