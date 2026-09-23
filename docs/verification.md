# Foundation / Analysis A verification

実施日：2026-09-23。Node 24.19.0 / npm 11.17.0 / Windows。

## 自動検証

| 検証 | 結果 |
|---|---|
| `npm run lint` | 成功、warning 0 |
| `npm run typecheck` | strict / noUncheckedIndexedAccess / exactOptionalPropertyTypesで成功 |
| `npm test` | 5ファイル・58件成功 |
| `npm run build` | 成功、静的SPAを生成 |
| `npm run android:sync` | 成功、Preferences / App pluginを同期 |
| `npm audit --audit-level=moderate` | 脆弱性0件 |
| `git diff --check` | 成功 |
| `android/gradlew.bat -p android assembleDebug` | Java/JAVA_HOME未設定で停止。APK成功とは扱わない |

主な回帰・境界テスト：不正外部JSON、重複ID、リーグ/球団の不整合、欠測と0、二刀流、打率/OPS/防御率、投球回の1/3、cache再利用/期限境界/訂正/通信失敗/timeout/保存失敗、破損favorite保持/保存失敗/更新直列化、IndexedDB再接続。

Analysis：明示したカウント母集団、未知filter拒否、対象league/subject/season type/coverage、未確認の組み合わせ拒否、許諾未確認/prohibitedの無効化、カウントの不正値、7/14/30日、うるう年/月初/年跨ぎ/DST/未来日、母数0/不明/閾値境界/設定変更、座標定義比較、empty結果の出典/日時検証。

## ブラウザで確認したもの

Codex内ブラウザのlocalhostで実際に操作した。

- Home起動 → Players → 詳細 → 一覧へ戻る。
- NPB / MLB切替、読み方検索（「ケイシー」→Casey Demo）。
- お気に入り登録、再読込後も登録状態を復元。
- OPSの説明展開、NPB Barrel%の未提供理由、MLBサンプルBarrel%の表示。
- Casey Demoで打撃/投球を併記し、未算出AVG/OPSと実値HR=0、ERA=2.84、6回1/3を区別。
- 390px viewportで選手詳細の横overflowなし。検証後viewport override解除。

通信・容量制限・破損によるfallbackはRepository/Storageの自動テストで検証した。実機のオフライン起動、物理Back、文字拡大、Android Preferencesのプロセス終了後復元は**未検証**。ブラウザではService Workerがないため完全オフラインの再読込は保証しない。

ブラウザで見つかったfetchの不正なreceiver bindingを修正し、transport回帰テストを追加した。依存監査でCapacitor CLI 8.5系の推移依存に問題を検出したため、core/android/cliを8.4.3に固定し再監査した。ESLintは依存互換性を確認して10系に更新。

## 整理と残したファイル

削除前にrepository search、Java/TS import、package scripts、Gradle/build設定、tests、README/docs参照を確認した。

| 削除/整理 | 理由 |
|---|---|
| `android/app/src/test/java/com/getcapacitor/myapp/ExampleUnitTest.java` | テンプレートの2+2のテストのみ。アプリの挙動を検証していない |
| `android/app/src/androidTest/java/com/getcapacitor/myapp/ExampleInstrumentedTest.java` | テンプレートpackage名をassertする旧内容。今回のappIdと不一致 |
| 上記だけのJUnit/Espresso設定・version定数 | 削除したstarter test以外の利用がない |
| Google services用Gradle classpathと条件分岐 | Firebase/通知を導入しておらず、参照する設定ファイルもない |
| `res/layout/activity_main.xml` | MainActivityはCapacitorのBridgeActivityを継承。依存元の実装も調べ、独自の`capacitor_bridge_layout_main`を利用することを確認 |
| `res/drawable/ic_launcher_background.xml`、`res/drawable-v24/ic_launcher_foreground.xml` | Launcherの実際の参照は`@color/ic_launcher_background`と`@mipmap/ic_launcher_foreground`。この2つのdrawable版への参照はない |

削除後にlint/typecheck/test/build/Capacitor syncを再実行した。ネイティブGradleコンパイルは上記環境制約が残る。

`public/data`はUIと境界テストに使用する明示的なサンプルであり保持。Androidの密度/向き別アイコン・splash、FileProvider XML、Gradle wrapperはManifest/resource/buildから参照されるため保持。アイコンはテンプレートのままで、公開配布前に置換する。`WORK_PROMPT.md`は依頼の記録なので保持。Analysis B–G用の空moduleや投球イベントmockは作成していない。

`dist/`、node_modules、同期済みWeb assets、Gradle生成物、マシン固有設定、鍵はGit対象外。build/syncが生成する現在の実行用ファイルは正常な出力としてignoreし、旧版のbundleはVite/Capacitorが置換する。

## 残るリスクと停止位置

実Providerの契約、今季データの無料かつ適法な取得、Android実機検証、Provider差替え時のID対応は未解決。GitHub remote CIとVercelデプロイも未実施。Analysisのgate/結果schemaは純粋関数で検証し、実際のAnalysisProvider/Repositoryへつなぐ作業は残す。

次の1タスク：**契約テスト用の架空AnalysisProviderを1つ作り、admissionと結果validationを通す小さなapplication経路を検証する。** 実API収集、analysis cache保存、Analysis Bの集計UIへは進めない。
