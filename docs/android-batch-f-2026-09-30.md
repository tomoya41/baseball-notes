# Batch F Android Beta 検証報告

基準日: 2026-09-30 JST。WebとAndroidは同じReactアプリを使用する。端末検証は無料のGitHub Actions上のAndroid 36 Google APIs x86_64 emulatorで実施した。実機全機種・Firebase実配信・署名・Play審査の完了を意味しない。

コード準備、unsigned build、端末テスト、外部設定を分けて判定する。手動CI/公開/バックアップをScheduled Production証拠に代用せず、Infrastructure Phaseを再判定しない。

## 1〜19: Toolchain / Navigation

| # | 項目 | 結果 |
|---|---|---|
| 1 | Capacitor | core/android/CLI **8.5.2** exact pin。 |
| 2 | Stable根拠 | 公式npm `latest=8.5.2`、next/nightlyは除外。[公式環境要件](https://capacitorjs.com/docs/getting-started/environment-setup)。確認日2026-09-30。 |
| 3 | Node | local 24.19.0、CI 24。最低22.13.0。 |
| 4 | Project | `android/`。 |
| 5 | applicationId | `com.tomoya41.baseballnotes`。 |
| 6 | ID確定 | **provisional**。FINAL PACKAGE ID CONFIRMATION REQUIRED BEFORE FIRST STORE RELEASE。 |
| 7 | min SDK | 24。 |
| 8 | target SDK | 36。 |
| 9 | compile SDK | 36。 |
| 10 | Toolchain | Android Studio 2025.2.1以上、AGP 8.13.0、Gradle 8.14.3、JDK 21。 |
| 11 | UI共有 | Vite outputから`/data`を除外してCapacitorへsync。Historical DB/PA rawはbundleしない。 |
| 12 | Platform | App/Network/Browser/Preferences/通知をadapterへ集約。Androidの公開データURLのみ既存Pages HTTPS originを使用。 |
| 13 | Back | dialog → router history → canonical親screen → root終了。dialog/historyは端末テスト、親routeはunit test。 |
| 14 | Deep Link | league + resource + canonical ID、optional season/date/asOfDate。受信URIを既存hash routeへ変換。Provider IDをrouteへ使わない。 |
| 15 | Scheme | `baseballnotes://`。 |
| 16 | App Links | `https://tomoya41.github.io/baseball-notes/` intent filter。host-root ownership/署名検証は外部Gate。 |
| 17 | assetlinks | generator準備済み。実SHA-256のみ受付。`https://tomoya41.github.io/.well-known/assetlinks.json`の配置・release certificateは未確定。偽fingerprintは公開しない。 |
| 18 | Debug link | 実際の大谷翔平canonical URIでPlayer/Analysis/BvPへ遷移。cold-start routeとrouter初期redirectの競合を修正。 |
| 19 | Release link | 同一コードでbuild可。release App Links実検証は署名/host-root設定待ち。 |

## 20〜41: Offline / Favorites / Notifications

| # | 項目 | 結果 |
|---|---|---|
| 20 | Offline shell | HTML/JS/CSSはAPK内。初期loadingも同梱、初回offlineはshellとoffline/未保存state。 |
| 21 | Cache | IndexedDB。64 MiB / 400件、1response最大2 MiB。localStorageへ大量responseを保存しない。 |
| 22 | 対象 | schema/identity検証済みcapability、directory、schedule、Player、Season、Records/Ranking等の公開GET。raw/PA/event archive除外。 |
| 23 | Stale | 「保存済みデータを表示しています」。invalid responseはknown cacheを上書きしない。404で削除。 |
| 24 | 初回offline | 白画面/ブラウザエラーではなくshellと通信状態を表示。 |
| 25 | Online復帰 | Network eventで必要なvisible stale screenを再取得。window全体reloadなし。初回nocache失敗もrefresh対象。 |
| 26 | Favorites migration | v1 canonical league/entityId contractを維持。Web既存local保存を削除しない。 |
| 27 | Android persistence | Capacitor Preferences。Activity/プロセス再起動後の大谷翔平favoriteを検証。Webとnative storageは別で自動転送なし。 |
| 28 | FCM採用 | 無料FCMのcode pathを採用。外部project/config未設定なのでProduction配信はdisabled。 |
| 29 | Pricing | [公式Pricing](https://firebase.google.com/pricing): Cloud Messaging no-cost。Spark/public Actionsを前提に新規月額費用なし。 |
| 30 | Permission | Android 13+ POST_NOTIFICATIONS。Myの説明付きON操作で要求、初回起動では要求しない。 |
| 31 | Topic | `npb-player-<canonical UUID>`。合法文字を検証、SDK上限2,000/installation。 |
| 32 | Subscribe | 通知ONかつNPB favorite追加時にSDK topic reconciliation。 |
| 33 | Unsubscribe | 解除/OFF時cleanup。SDK call前にpendingを永続保存し、timeout/process restart後の解除漏れを防ぐ。20秒でapplication側waitを打ち切り、復帰時再確認。端末receiverも現在のお気に入りを確認、OFFは先にlocal deliveryを停止。 |
| 34 | Token DB | TursoへFCM tokenを保存するtableなし。MLB Historical topics対象外。 |
| 35 | Producer | 公開済み日付のsaved Game Factsと公開Player名からEOD event候補を作成。 |
| 36 | 送信順 | validate → Pages publish → published ledger → isolated notification step。送信失敗はcollection/publishを失敗扱いにしない。 |
| 37 | Dedupe | date + canonical Player + event typeを送信前claim、端末側もdedupe。**at-most-once attempt**で、通信結果不明時は自動再送しないため欠落はあり得る。 |
| 38 | Tap | canonical NPB Player URI。評価文言なし、成績更新を通知。 |
| 39 | Secret | `FIREBASE_SERVICE_ACCOUNT_JSON`はActions Secretのみ。client configとprivate service keyを分離。 |
| 40 | 未設定 | CLIが`disabled`でDB open前に終了、端末statusはconfigured=false。アプリ/公開pipelineは動作可能。 |
| 41 | Production Push | **NO**。外部Firebase project/client config/Secret/実受信検証未完了。 |

## 42〜61: Lifecycle / Release / Privacy

| # | 項目 | 結果 |
|---|---|---|
| 42 | Cold | fresh offline起動とcanonical URI process restartをemulatorで確認。timingは後掲。 |
| 43 | Warm | Home→foreground、Activity再起動を確認。 |
| 44 | Background/foreground | App lifecycleでNetwork status再確認、stale dataだけrefresh。emulator foreground pathを確認。 |
| 45 | Notification open | native PendingIntent→canonical router実装済み。FCM実送信/tapは外部設定後のmanual Gate。 |
| 46 | Deep-link cold | native launch URLをHashRouter mount前に適用。実Playerで確認。 |
| 47 | Safe area | edge-to-edge/native insets + viewport-fit + CSS env。360/600幅、Light/Dark検証。 |
| 48 | Keyboard | adjustResize、既存Search UI共有。実機IME/font scalingの全組合せは未確認。 |
| 49 | Large screen | 600×1000 emulator、portrait lockなし。ページ全体overflowなし。 |
| 50 | Splash | 既存ball branding / Baseball Notes名。過剰animationなし、static boot loading同梱。 |
| 51 | 外部link | official Browser pluginでsystem browserへ。内部hash routerと分離。 |
| 52 | Secret scan | Web packaged assetsとAPK内assetsをscan。service key/Turso token/collector credential/DB rawなし。 |
| 53 | Debug APK | CIで生成・install・instrumentation PASS。後掲artifact。 |
| 54 | Release | unsigned release APK生成PASS。 |
| 55 | AAB | unsigned release AAB生成PASS。 |
| 56 | Signing | debug自動署名のみ、release署名なし。CI debug certificateはephemeral。配布更新用のstable signingはmanual Gate。 |
| 57 | CI | `android-beta.yml`: public repo無料Linux runner、build/scan/compile、manual emulator、artifact 7日。private repoではbuild停止。 |
| 58 | Play要件 | [公式target要件](https://developer.android.com/google/play/requirements/target-sdk) API36、AAB、64-bit/16KB、Data Safety/privacy/permissionを確認。native datastore `.so`の64-bit ABIとPT_LOAD 16KB alignmentを静的確認。16KB device実走は未確認。 |
| 59 | Privacy | Preferences favorites/settings、IndexedDB public cache、Pages/既存API接続、opt-in後Firebase installation/token/topics。`#/privacy`に棚卸し。Store用連絡先/宣言はowner確認待ち。 |
| 60 | Analytics | 追加なし、Firebase Analytics依存なし/collection disabled。 |
| 61 | Account | login/account/cloud favorites追加なし。 |

## 62〜79: Measurement / Regression

数値はemulator/ネットワーク/runner条件付きの測定で、実機SLAではない。画面見出し到達と実データ到達を区別する。installed総容量はOS管理領域を含む完全値を未測定。

| # | 項目 | 結果 |
|---|---|---|
| 62 | APK size | **5,965,466 bytes** debug、4,678,912 bytes unsigned release。 |
| 63 | AAB size | **4,396,482 bytes** unsigned。 |
| 64 | Installed | userdata `du` 6,016 KiB。APKサイズと合わせて参考表示、OSのfull installed accountingは未測定。main process PSS107,898 KiB / RSS225,616 KiB、WebView rendererを含む全process合算ではない。検証中FATAL crash 0。 |
| 65 | Cache | IndexedDB `du`620 KiB、WebView cache568 KiB、最大cached response218,268 bytes。上限64MiB、全Historical DBは保存しない。 |
| 66 | Cold | ADB Activity launch Total5,558ms / Wait5,613ms、instrumentation shell到達3,592ms。別起動試行の値で加算しない。 |
| 67 | Warm | 既存task foreground Wait602ms。 |
| 68 | Search | 313ms。見出し到達値でdirectory全件ロード時間とは異なる。 |
| 69 | Player | 4,867ms。大谷翔平実名/実profile到達。 |
| 70 | MLB BvP | 474ms。対戦投手検索UI到達。Analysis見出し13ms、Game Detail455ms。実集計のsemanticsは既存tests維持。 |
| 71 | Offline | Activity restart保存済みPlayer到達2,773ms。別の完全process restart canonical linkはActivity Total2,461ms / Wait2,503ms、保存済みprofile/favoriteをUIAutomatorと画像で確認。 |
| 72 | Accessibility | semantic headings/status/switch/labels、44px目安、ページoverflow検証。UIAutomator treeを保存。TalkBack読み上げと大きなfontの実機manual QAは未完。 |
| 73 | 360px | Android 36 360×800 / 600×1000、Light/Dark画像証拠。table内scrollは許可。 |
| 74 | Web | shared build/public Pages HTTPとNPB/MLB/Privacy表示を確認。 |
| 75 | NPB | Home/Search/Schedule/Player/Records not_readyを維持。公開effectiveDateは9/29に進行済み。 |
| 76 | MLB | Historical大谷Profile/Analysis/BvP/Game/Myをemulatorで確認、2026 Current未対応維持。漢字/カタカナ表示adapter継続。 |
| 77 | NPB Fact | **本BatchのFact write 0**。backup read-only。並行Production運用による累積増加を本Batch writeと混同しない。 |
| 78 | NPB Gate | Coverage/雨天partial/HOT/Rankingロジック変更なし。Infrastructure判定なし。公開HOT/Season Ranking not_readyを確認。 |
| 79 | MLB Current | 収集なし。Historical Fact/PA/BvP/Rate式の変更なし。 |

## 80〜95: Final Gates

| # | 項目 | 結果 |
|---|---|---|
| 80 | Recurring ¥0 | **YES（無料枠内の構成）**。FCM no-cost、public standard Linux Actions、既存Pages、paid hosting/backend/analyticsなし。Actions artifact/cacheは別のstorage allowanceがあるため、アカウントの無料枠内保持・支出上限0が運用前提。7日保持は無条件無料を保証しない。billing設定/請求実績は未確認・未変更。Play登録等のowner費用は本Batch未実行。 |
| 81 | Tests | **461 / 48 files PASS** + Android instrumentation **2 tests PASS**。 |
| 82 | Lint | PASS。 |
| 83 | Typecheck | PASS。 |
| 84 | Web build | PASS。既存main chunk575.28KB警告は残る。 |
| 85 | Vercel build | PASS。 |
| 86 | Android compile | JDK21/API36 CI PASS。localにはSDK/JDKを追加していない。 |
| 87 | APK | Debug/unsigned release生成PASS、debug emulator起動PASS。 |
| 88 | AAB | unsigned bundleRelease PASS、signed AAB **NO**。 |
| 89 | Pages | [Run36695452929](https://github.com/tomoya41/baseball-notes/actions/runs/36695452929) **success**、app-onlyで既存aggregate archiveをhash検証・維持。root/NPB HOT/Season/directory/MLB manifest/historical manifest各Public HTTP200。 |
| 90 | Android Beta Ready | **YES（Android36 emulatorで検証したdebug beta）**。Production Push/verified App Links/Store releaseとは分離。 |
| 91 | Notification Code Ready | **YES**。opt-in/permission/topic/producer/dedupe/disabled/isolation実装・tests/compile PASS。 |
| 92 | Production Push Verified | **NO**。外部設定なし。 |
| 93 | Play持込技術状態 | **NO（提出可能状態）**。unsigned AAB buildはYES。最終ID/署名/App Links/Privacy/Data Safety/実機QAなど下記manual Gateが必要。Play upload未実行。 |
| 94 | Manual blockers | final package ID、release signing/Play app-signing SHA、host-root assetlinks、Firebase project/client config/Secret、実push/permission/OFF/cold tap、実機TalkBack/IME/font/gesture/OEMbattery/16KB、owner privacy/contact/Store declarations、Actions storage無料枠と支出上限0のowner確認。 |
| 95 | 最終Releaseまで | stable署名のbeta配布→実機受入→Firebase no-cost設定→push EOD受入→App Links domain verification→Store declarations/listing→ownerの明示操作でPlay公開。 |

## Backup / safety evidence

最終Android [Run36695260597](https://github.com/tomoya41/baseball-notes/actions/runs/36695260597) **success**。検証コードSHA `862456270e892ab84a03de394c210240add36c92`。build jobでWeb checks/Capacitor sync/APK/AAB、emulator jobでAndroid36の2 instrumentation testsおよび完全process offline restart/reconnect/Light/Dark/600pxを通過。後続docs-only commitは実行コードを変更しない。

Debug APK SHA-256 `D6D3D3799731B47CBF2DDA16BD1A5B5B5EA2BB1E700894CB2C4B7F8B4F59626E`。unsigned AAB SHA-256 `5C821E435B450904089DE5032BB06FD990BE09AB71871CAD61A200269AADD467`。APK内assets13files / 1,143,015bytesのprivate credential pattern scan PASS。native各ABIのPT_LOAD alignment16,384を確認。パターン検査は未知のsecretの不存在を数学的に保証するものではない。

画像 `android-360.png` / `android-360-dark.png` / `offline-process-restart.png` とAPK/AABはローカル `.data` および7日保持Actions artifactsに保存、Gitへcommitしない。上記Actions Runの `android-emulator-evidence` / `android-beta-unsigned` artifactから取得できる。

NPB remote read-only backup/restore: [Run 36689543836](https://github.com/tomoya41/baseball-notes/actions/runs/36689543836) PASS。schema4、Games898 / batting22,804 / pitching6,913 / mappings1,656 / completeness833 / day records248 / permanent events13。compressed1,598,356bytes、manifest/hashes/scratch/repository readback PASS。代表9/29 Game28 batting / 5 pitching / complete。これは最新別運用時点のsnapshotであり、本BatchがFactを追加した証拠ではない。

MLB read-only portable export/scratch restore PASS: Games13,046 / Players2,840 / mappings5,680 / PA979,855 / PA game records13,046。635files / compressed65,518,293bytes。代表Game/PA比較PASS。MLB DBの追加importは行っていない。

Runtime dependency audit **0 vulnerabilities**。full dev auditのCapacitor CLI→xcode→uuidにmoderate3件が残る。Android runtime bundleへ同梱されず、無検証major overrideは行っていない。generated/cache/build/Google config/signing keysはGit対象外。

検証中に見つけた回帰は修正済み: Cordova dependency instrumentationまで無条件buildする問題、Android shellに同梱しないNPB bootstrapへの相対URL、native launch URIとroot redirect競合。古い失敗Runを成功証拠に置き換えず、修正後Runで再確認。

Data SourcesをManifest取得から独立させ、初回offlineでもRetrosheet/Chadwick attributionを表示する。通信中のfavorite解除については、pending SDK操作を永続保存し、端末receiverのcurrent-favorite確認も追加した。署名/送信を伴わないfixtureだけでProduction Push PASSとはしない。

詳しい手順・公式根拠・manual setupは[Android release preparation](android-release-2026-09-30.md)を参照。
