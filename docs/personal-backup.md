# 個人保存のバックアップ

対象：SPEC R09の個人保存の持ち運び、J06/J07。既存Myの「設定・バックアップ」へ追加する。R09全体（背景通知・実配信）やAndroid署名問題の解決ではない。

## 提供範囲

| 保存する | 保存しない |
|---|---|
| NPB/MLBのお気に入り（league/kind/canonical ID/登録時刻） | Facts、Raw、成績、レスポンスキャッシュ、出典付き本文 |
| コレクションとメンバー参照 | Watchの観測値・確認履歴・アラート本文 |
| 明示して保存した検索/比較条件 | 検索操作を勝手に履歴へ追加しない |
| 最近の閲覧履歴（既存の90日・60件） | 表示設定、端末の通知許可、Push購読情報、秘密鍵・認証情報 |
| Watchの個人設定 | 完全通算・新しい達成/通知を復元から生成しない |

JSONの`format=baseball-notes-personal-backup / version=1`を固定し、UTF-8で1MB以下。許可したschema、既存の件数上限、leagueとcanonical ID、URL条件、時刻、SHA-256を検証する。checksumは破損検出であり、発行者の署名ではない。表示名から既存の選手を統合しない。ファイルは自動送信しない。内容を確認できる本人用のファイルとして保管する。

ファイル選択→件数のプレビュー→追加/置換→確認チェック→取り込み。プレビューで書込みは発生しない。確認後に保存内容が変わった場合、5分を超えた場合、キャンセルした場合は再確認する。

追加ではお気に入り・履歴・同一内容を重複させない。同じコレクションID/名前ならメンバーを追加し、同じIDで別内容なら個人項目のIDだけを新規発行する。canonical IDは変えない。Watch設定は移行先を維持する。置換は対象の個人保存とWatch設定のみ。移行先に既にあるWatchの既読・アラート履歴は保持し、持ち運ぶ保存内容が変わった場合は数値baselineを再確立する。初回観測から新しい活躍通知を生成しない。

Webはブラウザーのダウンロード、AndroidはStorage Access Frameworkの保存先選択を使う。ブラウザーの「保存開始」とAndroidの実書込み完了を区別する。Androidの取込みは既存のファイル選択機能を利用し、追加のストレージ権限を要求しない。オフラインでも個人保存の処理は端末内で完結する。

## 失敗・更新互換性

既存の3保存キー・schema/versionは変更しない。共通の保存adapterが通常の編集も直列化し、複数キーの復元にはpending/committedのローカルjournalを使う。pending中は全体の旧状態、commit後は全体の新状態を読み、途中の物理書込みを画面へ混ぜない。次の編集で回復・cleanupする。journalの形式破損は自動リセットせず保持してエラーにする。

既存Androidの通知受信処理も同じ保存キーを直接読むため、一つのPreferences snapshotで復元journalの有無を確認する。journalが存在する間は新しい通知配信を許可せず、部分書込みのFavoriteを購読根拠にしない。既存の通知設定・重複抑制・権限・Firebase未構成Gateは変更しない。

WebではWeb Locksを利用可能なら同じoriginの現行クライアント間でも直列化する。Androidは共有adapterのプロセス内queueとjournalを利用する。WebViewに存在するWeb Locksのfacadeがcallbackを呼ばず、既存のお気に入り保存まで待機させる実測不具合を検出したため、nativeではブラウザー間用のlockを要求しない。古いキャッシュ版の同時編集やWeb Locksのない複数ウィンドウとの排他までは保証しない。最初の書込み前にも読み取った値を再照合する。利用中の旧画面は閉じて移行する。Android/PWAの保存領域は独立したままで、署名差異を消去・無断アンインストールで迂回しない。

rollback：成績データ・immutable assetは一切更新しない。旧コードへ戻す前に新adapterでjournalの回復/確定を完了させる。pendingのままadapterだけを外すと物理的な途中状態が読まれ得るため、単純revertで済ませない。ユーザーのバックアップや保存内容を手作業で削除しない。

## スマホの設計参照

実装前に専用画像生成ツールで作成・確認した[Light/Darkコンセプト](assets/personal-backup/concept.webp)を使用。元画像：`C:/Users/tomoy/.codex/generated_images/01a0cd55-189d-70f0-8032-fbb04166d904/exec-a36d4fb8-a750-42b0-be6f-35d58181de02.png`。生成画像は設計資料であり、本番のボタン・文字を画像化していない。

生成指示の要点：承認済みBaseball Notesのコンパクトな日本語スマホUI、My設定の保存/ファイル選択、件数の取込みプレビュー、追加/置換と明示確認をLight/Darkの2画面で表現する。通常の見出し・本文を大きくせず、操作領域を確保する。実在の顔・ロゴ・野球成績を含めない。イメージの新規タブや余白はそのままコピーせず、既存My disclosureと文字階層を再利用する。参考画像の「かっこいい・使いやすい・見やすい・直感的」という方針を今後も継続する。

## 検証と公開

同一性とURL、追加/置換、上限、破損・不正参照、期限、確認後の変更、同時編集、保存失敗/途中中断、Watch初回通知抑止をテストする。360px Light/Dark、Androidの実保存先選択・キャンセル・再取込み、150%/200%を確認する。実施したrun・画面・公開後データ保全を追記する。Pixel・TalkBack・正規署名付き更新は独立した未検証Gateのまま。

PR #99のローカル結果：213 test files、2,079 PASS / Windows専用の既存条件で1 SKIP（計2,080）。Lint、typecheck、Web/Vercel build成功。取込専用の35テストには全書込み段階の中断/再起動、commit応答喪失、上限時の追加失敗→削除なしで置換を選択する回帰、応答しないWeb Locksをnativeで要求しない回帰を含む。

実画面：[変更前360px Light](assets/personal-backup/before-360-light.png)、[変更後Light](assets/personal-backup/after-360-light.png)、[変更後Dark](assets/personal-backup/after-360-dark.png)。変更後の取り込み検証は隔離したlocalhostの個人項目fixtureを用い、公式データや実ユーザーの保存内容は操作していない。見出し15px、ボタン13px/高さ44px、プレビュー表12px。横はみ出しなし。別環境のファイルを選択→確認→保存→Myの件数更新→PWA更新後の保存維持、再取込時の重複なしを実操作で確認した。ローカルに未配置の球団/日程データの失敗表示を、Production障害・試合なし・成績ゼロへ読み替えない。

初期JavaScriptの静的import全体（3ファイル合算、同じNode gzip条件）は525,486→535,348 bytes、gzip 163,178→164,667 bytes（+1,489 bytes）。単体entryの増分には共通chunk間の移動が含まれる。取込UI（JS6,681/CSS1,197 bytes）はMyで遅延読込み。データファイル・追加API/Source・DB読取り/書込み・AI呼出し・月額追加費用はいずれも0。

配信サーバーを停止したlocalhostで、既存service workerのアプリ本体からMyを再起動し、保存情報の維持・JSON保存・実ファイルの再プレビューを確認した。PC全体のネットワーク切断やPixelのオフライン検証の代替証拠にはしない。

Android v2実行：[standard](https://github.com/tomoya41/baseball-notes/actions/runs/40774384043)、[16KB](https://github.com/tomoya41/baseball-notes/actions/runs/40774390720)は各34件中2件FAIL（お気に入り保存待ち、保存pickerへ未到達）。この失敗は公開せず、nativeのlock選択を修正した。修正後の固定実行・確定結果・公開後HTTP/65,727ファイル保全は[PR #99の検証記録](https://github.com/tomoya41/baseball-notes/pull/99)を参照する。Pixel/TalkBackは未実施（ローカルADBの接続端末0台）、正規署名による更新互換性・Play提出は未完了。

修正後の機能commit `16476d769f010c3d8b1bfc1ad9b83b086d7788b4`：[standard v3](https://github.com/tomoya41/baseball-notes/actions/runs/40777200157)、[16KB v3](https://github.com/tomoya41/baseball-notes/actions/runs/40777204761)。fixtureを保存する実行先は破棄可能なCIエミュレーターのみ。
