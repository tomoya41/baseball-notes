# NPB選手動向の未対応記録回収

## 対象・権利・本人照合

R03/R07、J05。新しい画面・MLB拡張は追加しない。既存の許諾Source、Wikipedia「2026年の日本プロ野球」page 5145794、[改版111560963](https://ja.wikipedia.org/w/index.php?curid=5145794&oldid=111560963)、取得2026-10-29T05:13:42.178Zの保存原本を再処理する。新たなSource API取得0。利用条件は[同日確認の監査](npb-offseason-20261029.md)を継承し、CC BY-SA 4.0、原記事・執筆者・改版・変更・再利用条件の表示を維持する。記事本文を参照した新聞等の第三者素材の利用許諾は継承しない。

22人の追加本人照合は、既存canonical UUID/NPB ID/QIDと、保存済みWikipedia記事のQID＋一意のNPBプロフィール/テンプレートIDの一致による。記事名・改版・本文hashは`npb-offseason-recovery-identity-registry.json`へ固定。原本692記事archive SHA256 `d4946a34dd2c2c72bc10ee0a2bf0b2336690a705f51d38198d00bb35f9f9b092`、取得時点2026-10-17T05:17:30.261Z。全22記事のnamespace/page ID/QID/NPB ID/改版/時刻/内容hashを再照合し、UUID/NPB ID/QID/記事の重複0。名前一致による統合・新しいcanonical発行・現在所属や背番号の更新0。

## 回収した形式

- 選手本人による、明示された球団と記事リンクを持つ今季限りの引退発表。
- 全文が一義的な2人の引退発表。両方の独立した本人記事が確認できる場合だけ2行へ分け、同じstatement hash/出典を保持する。片方が名前のみ・不明記事・同じID・予想なら全体を保留する。
- 育成選手と成立した支配下契約の「支配下契約」「結んだと」の表記差。
- 来季契約を行わない明示通知の助詞「へ」と、通知/通告の固定表現。共有通知は従来どおり明示された人数を照合し、未照合者はhash-only quarantineへ残す。

育成契約の打診、支配下だけの契約不更改、ポスティングやコーチ退団が混ざる文、交渉・見込み、名前だけ、無関係な脚注、引用・余分な前置きは新たに受理しない。戦力外通告を自由契約・FA・引退へ変換しない。発表日・実施日を推定しない。

## 実データ候補

既存39件/39人→**62件/62人**。追加23件＝引退発表3、戦力外通告12、支配下契約8。旧39件の削除・本文/statement hash・本人情報の変更0。照合pool155→177、曖昧な記事対応0。隔離は105診断（本人リンク65、脚注31、未対応文法1、共有通知の一部未照合7、混在節の一部未照合1）。診断件数は追加可能な人数ではない。全体Coverageはpartial。

| 記載日 | 記事記録 | 選手 |
|---|---|---|
| 10/7 | 戦力外通告 | 東妻勇輔・菊地吏玖・石垣勝海 |
| 10/1 | 戦力外通告 | 知野直人 |
| 9/30 | 戦力外通告 | 辻本倫太郎・ブライト健太 |
| 9/29 | 戦力外通告 | 田口麗斗・長谷川宙輝・山野辺翔・福敬登・三浦瑞樹・尾田剛樹 |
| 9/24 | 引退発表 | 山田修義・西野真弘 |
| 7/20 | 引退発表 | 角中勝也 |
| 3/24–7/31 | 支配下契約 | 廣澤優・佐藤爽・金子京介・モンテル・松岡洸希・笹原操希・森脇亮介・鈴木大和 |

引退3人の[ロッテ告知](https://www.marines.co.jp/news/detail/202600893548.html)・[山田修義告知](https://www.buffaloes.co.jp/news/detail/202600805215.html)・[西野真弘告知](https://www.buffaloes.co.jp/news/detail/202600805219.html)、および[中日9/30告知](https://dragons.jp/news/2026/26093001.php)の存在も2026-10-29に閲覧確認した。これは品質確認の補助で、公式本文・写真・ロゴの転載許諾や公式Sourceとしての新規取り込みではない。公開行はすべて従来どおり`encyclopedia_record`であり、公式認定へ昇格しない。

契約更改の記録は同じ原本内で0のまま。更改なし・未発表と断定しない。成績や年俸・契約年数を生成しない。

v6候補：body 47,651 bytes / gzip 9,960 bytes、body SHA256 `9e334e8a29d12ab7e09d1bf21b620682e5a2dab88ba73ee69c88b39ea44daaff`、gzip `64b176c873b6d265c61de432e1277f806f4ae23917786b646d2084b48a9ddffe`、identity input `30afa530273fce33d76ab4676100178daf8dc016b97733de1f485b3500ef5b68`。同一原本・同一入力で再現一致。既存v1–v5を上書きせず、新しいimmutable releaseをinactiveで配信・HTTP照合してから別のアプリpinで有効化する。

[immutable v6 release](https://github.com/tomoya41/baseball-notes/releases/tag/npb-events-wikipedia-20261029-v6)は、Source/本人/原本再現の検証とcore `4a4cd53`のCodex Review後に固定した。このデータ先行PRではretainedへv6を追加し、active v5/39件を維持する。最初の217 test filesは2,128 PASS＋Windows既存1 SKIP（Linux2,129）。配信アプリの非data 62ファイルは前回公開と全byte同一。inactive公開HTTPと既存65,728データファイルの保全結果は実行後にPRへ記録する。

## 運用と検証

最新Freshness run [40854179731](https://github.com/tomoya41/baseball-notes/actions/runs/40854179731)の報告は`unhealthy/stale`、公開effective date 2026-10-12、`database_read_blocked`。24時間の予約を復元し、`probeDue=false`、retryAfter 2026-10-29T21:03:29.727Zを維持。期限到来を復旧証拠にはしない。今回のDB probe/write、Source API、AI呼出し0。NPB HOT/Ranking、NPB個人成績未収録試合のMVP保留は維持する。

新fixtureは合成の人物/脚注だけを使い、実データとして公開しない。新形式の正例、2人の引退の本人/重複/脚注/予測、共有通知の人数・部分未照合、育成打診/混在節の拒否を検証する。今回のnode-only段階ではactive pinはv5/39件で、配信アプリのbyte一致を確認してからデータ先行公開する。切替後は既存Moves・Player記事履歴・検索・フォロー・Source/ライセンス・Androidを別に確認する。Pixel/TalkBack・署名互換性は未検証。追加月額費用¥0。

## v6表示への切替

core/data先行は[PR #104](https://github.com/tomoya41/baseball-notes/pull/104)、main `1a1e455`。別の表示PRでactive pinをv6/62件にし、v5をretainedへ移してv1–v5のURLとbodyを保持する。データは既に固定したものと同一で、表示のためにSourceを再取得しない。Movesは従来の15件/ページ、Home/Player初期表示のイベント取得0を継続する。開いたイベント本文のみ30,608→47,651 bytes。新規画面・文字/余白の再設計・写真/フォントの追加0。

表示切替のAndroid回帰では、従来の各種事象/Deep Link/Back/文字拡大・保存・オフライン検証に加え、実データの角中勝也（7/20引退発表）と佐藤爽（4/30支配下契約）を本人IDで絞って確認する。source revisionと記事日、支配下契約/契約更改/現在の状態の区別を維持する。先行公開の全既存data hash・新v6のHTTP照合が成功するまで、nativeが参照する未配信assetで試験を代用しない。実行結果は表示PRで記録する。

先行Pages run 40872219575は成功。旧65,728 data files/362,273,064 bytesの変更・欠落0、新v6 JSON1件のみ追加し、全65,729 files/362,320,715 bytes。旧v5と新v6のHTTP/body hash、アプリ非data 62ファイルのbyte一致も確認した。

ローカル実データの360px [Light](assets/npb-event-recovery/retirement-360-light.png)・[Dark](assets/npb-event-recovery/retirement-360-dark.png)、[支配下契約](assets/npb-event-recovery/registration-360-light.png)で、62件表示、引退/支配下契約の名前検索・本人IDリンク・記事日、横溢れなしを確認。通常の行見出しは15px、既存の操作領域を維持する。この画像は実アプリの検証記録であり、新たなアプリ用画像素材ではない。公開環境の最終画面は表示PRの公開後に別途確認する。
