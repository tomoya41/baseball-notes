# 2026年オフシーズンの選手動向

## v5の実データと採用条件

出典は既存許諾SourceのWikipedia「2026年の日本プロ野球」だけ。page 5145794、改版[111560963](https://ja.wikipedia.org/w/index.php?curid=5145794&oldid=111560963)、改版時刻2026-10-29T05:04:33Z、取得2026-10-29T05:13:42.178Z。公式MediaWiki APIで1回取得しキャッシュ、以後は原本の再処理。リンク先の新聞本文・写真は取得しない。問い合わせ・課金・アカウント追加0。

権利確認2026-10-29：[Wikimedia利用規約§7/§12](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use)、[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)、[API etiquette](https://www.mediawiki.org/wiki/API:Etiquette)。判定B：取得・保存・抜粋分類・Web/Android/公開JSONは帰属・原版/著者へのリンク・改変表示・同一条件での再利用を維持する範囲で採用。本文・分類データのCC BY-SAとアプリコードは区別する。新聞等の第三者素材を許諾済みと扱わない。

新しい表現は、意味の一つに定まる来季契約の非更改通知と、独立した自由契約通知の固定文法だけを追加。複数選手では明示リンクと人数を照合し、未照合者はIDを生成しない。混在するポスティング容認・コーチ退団、育成契約の打診、引用や未関連の脚注を流用しない。戦力外通告を自由契約・引退へ変換しない。

新しい10人の本人照合は、既存のcanonical UUID/NPB ID/QID bridgeと、保存済み692記事archive内の該当ページのQID＋一意のNPBプロフィール/テンプレートIDを独立に照合した。正確な記事リンク・改版・本文SHAは`npb-offseason-event-identity-registry.json`に固定。原本archive SHA256 `d4946a34dd2c2c72bc10ee0a2bf0b2336690a705f51d38198d00bb35f9f9b092`、取得時点2026-10-17T05:17:30.261Z。名前一致は採用根拠にしない。現在所属・背番号・登録状態は更新しない。

## 確認した増分

既存28件/28人→39件/39人。旧28件の削除・意味変更・本人情報変更は0。追加は戦力外通告の**記事記載11件**。独立照合poolは145→155、曖昧な記事対応0。未解決118診断（本人リンク79、脚注31、未対応文法2、共有通知の一部未照合5、混在節の一部未照合1）はhash-only quarantineで保持する。診断件数は追加可能な選手数ではない。

| 記載日 | 追加された選手 | 記事に記載された球団 |
|---|---|---|
| 10/29 | 緒方理貢 | ソフトバンク |
| 10/26 | 茶野篤政・青山美夏人・糸川亮太 | 西武 |
| 10/26 | 岩井俊介・中村稔弥 | ソフトバンク |
| 10/26 | 茂木栄五郎・小澤怜史・北村恵吾 | ヤクルト |
| 10/25 | 愛斗 | ロッテ |
| 10/25 | 川越誠司 | 中日 |

すべて`encyclopedia_record`。公式発表を直接確認したという表示、実施日・契約解除日・現在所属の推定はしない。原記事の著者・改版・CC BY-SAは各行から確認できる。

## 段階的な配信

v5 `npb-events-wikipedia-20261029-v5`：39件/39人、body 30,608 bytes / gzip 6,674 bytes。gzip SHA256 `f8fbc1ca88f75a117d168df216022bedd1ffcd0f3f475331193311ef81cd72b5`、body `791dbbca29071f69ae128192ce18313a6ff4925169d814a208f71723aa7bc490`、identity input `ad41801b59f538d058bd30b4caba18ce7e5d2866af3d967c2269b5c765269f54`。

まずinactive retained assetとして配信し、active pinはv4/28件を維持する。公開HTTP/hashを確認してから別PRでv5へ切替える。旧v1–v4のURL/bodyは保持する。データだけの段階では新しい画面・アプリ機能・HOT Gate・Canonical DB・保存情報は変更しない。

契約更改の記載は今回の原本内で0。0件を「更改なし」「未発表」と表示せず、未収録として扱う。年俸・推定額・実際の契約期間を生成しない。以降のUI/分類対応は独立したレビュー単位で進める。

データ先行段階のローカル検証：214 test files、2,087 PASS＋Windows既存1 SKIP（Linux全2,088）。Lint/typecheck/Web buildとSource/Coverage/旧release検証成功。新しい10記事のページID/QID・NPB ID・改版時刻・本文hash、原本archive hashと全28旧statement hashも再照合した。配信アプリ本体61ファイルは公開main `23ddeb3`と全byte同一。新inactive JSON以外の保護データ、表示機能、既存nativeコードに変更はない。

## v5表示への切替と契約更改の入口

データ先行[PR #101](https://github.com/tomoya41/baseball-notes/pull/101)と[Pages run 40844207981](https://github.com/tomoya41/baseball-notes/actions/runs/40844207981)は完了。公開HTTPの39件JSONは上記body hashと一致し、旧65,727ファイル・362,242,456 bytesの欠落/変更0、新規JSON1ファイル30,608 bytesのみ。次のアプリ更新でv5をactiveとし、v4もretainedへ移して旧URLを保持する。

既存Homeへ「移籍・退団・引退」「契約更改」の2本の入口を追加。Homeのイベント取得0、既存Moves内の種類切替はURL条件・選手/球団/フォローを保持する。既存の13px文字と44pxタップ領域を使い、新画面や全面再設計は追加しない。選手から記事記載・元改版・ID照合記事・ライセンスへの経路を維持する。

`contract_renewal`は契約発表、戦力外、自由契約と独立。固定文法の成立済み更改だけを認識し、交渉予定、保留、打診、見込み、推定年俸、名前のみ、無関係な脚注は受理しない。契約年数・推定額・登録状態は付加しない。現原本の更改記録0件は「未収録」と表示し、なし/未発表と断定しない。

契約更改欄には12球団の公式ニュースへの外部リンクを設置。ドメインは[NPBの球団案内](https://npb.jp/teams/)と球団自身のナビゲーションで確認（2026-10-29）。11球団のHEADは200、巨人は自動HEAD403だが公式ドメインのニュース導線として保持。日本ハムの`/news/`はメディア出演ページへ転送されるため、公式ナビの[すべてのニュース](https://www.fighters.co.jp/news/list/)を採用した。これは閲覧先の案内であり、記事本文の取得・複製・Source採用許諾ではない。球団ロゴ、本文、写真の新規転載0。

変更後parserで同じ保存原本を再処理して39イベント・39人の内容/ID/statement hashが完全一致。identity input digestはGitのregistryファイルのbyte表現を含むため再処理時のdigestを新たに記録し、既存v5のdigest/assetを上書きしない。旧28件からの差分11件、訂正/削除0という人による確認結果も維持する。

NPB HOTは従来のCoverage・最低母数・Scheduled証拠がそろうまで非公開。試合別MVPとオフシーズン記事はHOTの代替ランキングではない。Tursoの24時間読み取り抑制中のprobe/DB書込み0、追加費用¥0。実機Pixel/TalkBack/署名互換性は別の未検証Gate。
