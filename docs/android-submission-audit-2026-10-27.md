# Android提出準備・更新互換性監査（2026-10-27）

基準main `b6e6a5c`。ストア提出・署名鍵の生成/変更・端末データ削除・Play Console操作は実施していない。追加月額¥0。

## APKの更新前チェック

`scripts/verify-android-apk.ts` はSDKの **aapt2** と **apksigner** を使う読み取り専用検証。APK全体のSHA256、package/version/SDK、実際のパッケージ権限、debuggable、暗号検証に成功した署名証明書SHA256、同梱native library件数を記録する。証明書DN・秘密鍵・パスワードは取得/保存せず、ツールの生stderrも公開しない。

```text
npx tsx scripts/verify-android-apk.ts --apk=<候補APK> --sdk-build-tools=<SDKのbuild-tools/36.0.0> --report=.data/android-apk-check.json
```

`--java=<JDKのjava実行ファイル>` を指定できる。`--baseline=<比較元APK>` を追加すると、**両APKの署名検証成功**、同一Application ID、完全一致する現署名者集合、versionCodeが同じか増加、を確認する。不一致/未知の鍵ローテーション/ダウングレードはexit 2で保留。検証・ファイル取得中にAPKが変わった場合も拒否する。レポートは新規のignored `.data/*.json` へだけ書き、既存ファイルを上書きしない。

同じ鍵のローカルAPK比較に成功しても、端末に実際に入っている版、更新ポリシー、Play App Signing、App Links、実機動作を確認したことにはならない。`installedDeviceVerified=false`、`storeSubmissionReady=false` は維持する。これはinstallやアンインストールを代行するスクリプトではない。

### 既存の署名差異

過去の非公開ローカル証拠には、初回APK SHA256 `3fc935e113aafa419a03efc084c9df36c0b0657b2a6b31378d0f15f35672ac09` の埋込公開証明書 `223912d3da4f0c257f9a849c05a6db9dabb11caa7b2d36fba92803ce00ce360f` と、後続APKの別証明書が記録されている。ただし、その旧手法は証明書の抽出であり暗号署名検証ではないため、更新許可の証拠には流用しない。

今回、初回APKの実在と上記ファイルSHA256、およびPR #85の保存APK SHA256 `b71ec2c7e06df8fa24168aa71e91f97cbacf12bb9af13af73a1ee5bbd0e981cf` をGet-FileHashで再確認。ローカルSDK/JDKが利用できないため、この2本のapksigner付き比較は未実施。新しいCIビルド自身の暗号署名検証と、初回APK/実機との更新互換性は別の確認事項として保持する。

GitHub-hosted runnerのdebug keyは実行環境依存で、異なるrunのdebug APKの更新互換性は保証できない。署名検証付き比較で一致を確認するまで更新インストールを行わない。保存データを守る解決には、所有者が初回署名鍵を保持していることの確認と、その正規の鍵を使ったビルドが必要。証明書から秘密鍵は復元できない。新規鍵生成・無断の署名差し替え・`adb uninstall`・`pm clear` では解決しない。

## 提出可否

| 項目 | 現状・残るGate |
|---|---|
| Application ID | `com.tomoya41.baseballnotes`を維持。namespace `jp.baseballdata.app`との違いは意図的で、IDを再採番しない |
| Version | code `1` / `0.1.0-beta.1`。最初の提出版と以後の増分は所有者確認が必要 |
| SDK | min24 / compile36 / target36。2026-08-31以降の新規/更新API36要件に合致。API24/OEM実機の完了証拠とは別 |
| AAB / release署名 | unsigned release AABのビルド経路を維持。release signing config・所有者承認済み鍵なし。**未提出・提出不可** |
| App Links | HTTPS manifestとroute検証は既存。正式app-signing certificateとhost-root `/.well-known/assetlinks.json`、端末上のverified状態は未確認。project subdirectoryへの配置や強制関連付けで代用しない |
| 権限 | source manifestはINTERNET/POST_NOTIFICATIONS。最終APKのmerged権限はSDK由来の追加も含め新チェックで記録。sourceだけから最終権限を断定しない |
| 通知 | FCM SDKは同梱、設定なし・auto-init/analytics無効。アプリ内Watchと常時Push配信は別。配信成功/バックグラウンド通知の提供は未確認 |
| Privacy / Data safety | local Favorites/Collections/Watchとネットワーク先、同梱SDKを最終版で確認。所有者名・連絡先・恒久公開URL・Console申告未完了。「local保存だから送信0」と一律に申告しない |
| 実機 / TalkBack | 今回`adb devices -l`は**0台**。Pixel/TalkBack/既存署名での更新は**NOT RUN**。エミュレーター結果で埋めない |
| Play Console | アカウント種別/本人確認/初回登録/テスター/掲載情報/提出は所有者Gate。費用の支払いや登録は行わない |

## 公式要件の再確認

確認日2026-10-27。規約・アカウント・支払いの承諾を代行していない。

- [Target API要件](https://developer.android.com/google/play/requirements/target-sdk)：2026-08-31以降の新規/更新はAPI36以上。
- [App Signing](https://developer.android.com/studio/publish/app-signing)、[apksigner](https://developer.android.com/tools/apksigner)：公開証明書の一致と正規の秘密鍵管理を区別し、SDKで署名を検証。
- [App Links検証](https://developer.android.com/training/app-links/verify-applinks)：host rootと実際のアプリ署名証明書を使う。
- [User Data policy](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en)、[Data safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en-en)：同梱SDKも含む実際のデータ取扱いの正確な申告は開発者の責任。所有者情報を推測で入力しない。
- [新規個人アカウントのテスト](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)：該当するアカウントは12人が連続14日間opt-inするclosed testとproduction access申請が必要。未実施。
- [登録・本人確認](https://support.google.com/googleplay/android-developer/answer/6112435?hl=en)：登録料US$25一回と本人/端末確認。費用承認・登録・支払いは未実施。

ビルド・エミュレーター・公開HTTPの最終実測結果は、この変更を含むdelivery PRに記録する。旧テスト結果を今回のPASSへ読み替えない。

## 実SDK出力への追従

PR初回CIは`invalid_apk_metadata`で停止し、エミュレーターは未実施だった。SDK36の`aapt2 dump badging`は旧` sdkVersion`ではなく`minSdkVersion:'24'`を出力するためで、証明書検証にはまだ到達していなかった。Google公式SDK repository XMLが示すbuild-tools36 Windows zip（58,699,878B、SHA1 `f16ccffd34de8790dede813a6c7d8e2c11a27b50`）を照合し、実際の初回APKで再現した。parserは二つの表記の合計が1行の場合だけ受理し、重複/矛盾/欠落は拒否する。新しい実出力fixtureを追加し、暗号署名検証は省略しない。初回失敗をPASSと読み替えず、修正版の実CI結果を別途確認する。
