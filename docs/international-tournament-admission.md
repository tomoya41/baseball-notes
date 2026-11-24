# 国際大会の公式情報と収録条件

既存のNPB「日程・結果」内に「侍ジャパン・国際試合」を折りたたんで表示する。通常の試合一覧・詳細URLと年別データを継続利用できる。外部リンクは利用者が開いたときに公式サイトへ移動する。

| 大会 | 2026-11-07時点の確認範囲 |
| --- | --- |
| APBC 2026 | 11月12〜15日、東京ドーム。決勝・3位決定戦の対戦国は確認時点で未確定。[大会概要と試合日程](https://www.japan-baseball.jp/jp/games/apbc2026/)・[日本代表選手の発表](https://www.japan-baseball.jp/jp/games/apbc2026/player_jpn.html) |
| WBC 2023・2026 | 侍ジャパンの大会ページを案内。[2023](https://www.japan-baseball.jp/jp/team/topteam/2023/wbc/overview.html)・[2026](https://www.japan-baseball.jp/jp/games/wbc2026/) |
| プレミア12 2024・2027 | 2024年は大会ページ、2027年はWBSCの開催方針を記した理事会議事録へ案内。[2024](https://www.japan-baseball.jp/jp/games/2024premier12/)・[2027開催方針](https://static.wbsc.org/uploads/federations/0/cms/documents/b5b2592b-3a2b-515b-a001-1e72e5a80911.pdf) |
| 強化試合 | 侍ジャパンシリーズ2026名古屋を最初の参照例として掲載。[大会ページ](https://www.japan-baseball.jp/jp/games/nagoya2026/) |

このPRの実大会情報は開催案内とリンク。試合表、登録名簿、画像、個人成績の収録は0件。侍ジャパンのサイト方針とMLBの使用条件には複製・再配布の制限がある。WBSCについてもアプリ収録を許可する条件を確認できていない。[侍ジャパンのサイト方針](https://www.japan-baseball.jp/jp/summary/sitepolicy/)・[MLB使用条件](https://www.mlb.com/official-information/terms-of-use)

## 2026-11-20の結果収録

APBC 2026の日本戦4試合、WBC 2023の7試合・2026の5試合、プレミア12 2024の9試合について、開催地の日付、ラウンド、ホーム・ビジター、確定得点を収録。APBC 2026は10月7日発表の選出28人も収録。日本語版Wikipediaの[版111791999](https://ja.wikipedia.org/w/index.php?oldid=111791999)の選手欄と公式代表一覧を照合し、監督・コーチを除外した。各選手の記事IDは大会側だけで使用する。初版の範囲はここまで。追加収録した項目は下記の各節に記載。

英語版Wikipediaの版指定付き記事を公開MediaWiki APIから取得。WBCとAPBCは個別のイニング表と最終得点、プレミア12は試合別結果行と照合した。APBCの概要表には月の不一致があるため、試合別イニング表の日付と公式日程を照合した。版番号と試合の対応は `src/data/international-japan-results.ts` に保持する。日時欄に実際の開始時刻を推定して入れない。

記事の数値を抽出・翻訳した結果データの取得・保存・加工・Web/Android表示・再配布には、著作者表示、原記事へのリンク、変更の明示と同一ライセンスを適用する。大会公式サイトは確認先として案内する。[Wikimedia利用規約 §7](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use#7._Licensing_of_Content)・[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)

## WBC 2023の日本代表通算成績

日本語版Wikipediaの[固定版109739294](https://ja.wikipedia.org/w/index.php?oldid=109739294)から、打撃16人・投球14人の大会通算成績を抜粋。公開MediaWiki APIの原文応答のSHA-256は `c870665f7a1bc56f5fd8503cda4c46c8947dada37a6678510f8640fe8b3109f6`。選手欄のリンク先の記事IDを照合し、大谷翔平の打撃と投球には同じ国際大会側IDを使用した。国内・MLBプロフィールとの本人照合は未実施。

打撃は出場試合数、打数、安打、本塁打、打点、投球は登板数、アウト数、失点、自責点、奪三振を照合。打率と防御率は構成値から計算。日本の打数221・安打66・本塁打9・打点55と、投球189アウトを確認した。髙橋宏斗の奪三振は資料間で差があり未収録とした。照合先は[WBC公式の打撃成績](https://www.mlb.com/world-baseball-classic/stats/japan/2023/)と[投球成績](https://www.mlb.com/world-baseball-classic/stats/pitching/japan/2023/)。

大会別データ第2版として日本代表の一部指標を収録し、試合結果7件は旧版の内容を維持する。試合ごとの出場、登録、選出、全参加国と全指標のCoverageは別管理とする。

## WBC 2026の日本代表発表と台日交流試合

日本語版Wikipediaの[固定版110704201](https://ja.wikipedia.org/w/index.php?oldid=110704201)から、[侍ジャパンの2月26日時点の発表](https://www.japan-baseball.jp/jp/team/topteam/2026/wbc/player.html)と一致する代表選手30人を収録。監督・コーチ、辞退者、サポートメンバー、招集されていない指名投手枠は含めない。背番号・氏名・役割を照合し、出典に記載された個々の選出発表日を保持する。名前と役割・発表日を抜粋・整形してCC BY-SA 4.0で収録する。取得応答のSHA-256は `117b935735c892988dcb03dc77659107821cce0a14164c21acde6409f8d9c7d8`。大会別データ第2版で選出を追加し、登録・試合出場・選手成績は未収録。5試合の結果は旧版の内容を維持する。

2027年3月6・7日の台日交流試合は、台北ドームでの開催予定を案内し、[侍ジャパンの11月18日発表](https://www.japan-baseball.jp/jp/news/press/20261118_1.html)へリンクする。日程や試合のデータは収録していない。

## APBC 2026の本塁打・勝利投手と大会MVP

[英語版Wikipediaの固定版1385998229](https://en.wikipedia.org/w/index.php?oldid=1385998229)の各試合欄・表彰欄を、[侍ジャパン大会公式](https://www.japan-baseball.jp/jp/games/apbc2026/)と[11月12日](https://www.japan-baseball.jp/jp/team/topteam/score/20261112_2/)・[13日](https://www.japan-baseball.jp/jp/team/topteam/score/20261113_2/)・[14日](https://www.japan-baseball.jp/jp/team/topteam/score/20261114_1/)・[15日](https://www.japan-baseball.jp/jp/team/topteam/score/20261115_2/)の確定記録で照合した。日本の本塁打は順に3・4・3・2本。勝利投手4人と大会MVPの宗山塁は、既存の大会内選手IDと照合した。11月14日のオーストラリア戦は7回で終了した試合。試合日は各試合欄と公式記録、先攻・後攻はイニング表で確認した。

大会別データ第2版で本塁打・勝利投手・MVPを追加。日本戦4試合のスコアと選出28人は同じIDを維持する。確定した日本の勝利試合に収録範囲を限定し、相手の個人成績、大会通算の率、全選手の出場記録、NPBプロフィールとの本人照合は別管理とする。公式の試合記録は照合と閲覧案内に使用し、収録データは上記固定版から抜粋・翻訳・整形してCC BY-SA 4.0で提供する。

## プレミア12 2024の日本代表通算成績

[日本語版Wikipediaの固定版111780580](https://ja.wikipedia.org/w/index.php?oldid=111780580)から、野手15人と投手13人の主要成績を抜粋。MediaWiki API応答のSHA-256は `0cab4a752ca32fd8ef3b70d5345a2092bc562b963f8745b15134d9f7c4caa133`。成績欄のリンク先の日本語版記事IDを使い、既存NPB・MLB選手IDとの結合は行わない。

[WBSC公式資料の日本の個人成績（決勝前の8試合）](https://static.wbsc.org/uploads/federations/0/documents/82f90f98-607b-6a2c-59ba-47dbefdf741f.pdf#page=91)に[日本代表公式の決勝記録](https://www.japan-baseball.jp/jp/team/topteam/score/20241124_1/table.html)を加え、野手は出場試合数・打数・安打・本塁打・打点、投手は登板数・投球アウト・失点・自責点・奪三振を1人ずつ照合した。日本の打数302、安打90、投球243アウト、奪三振113を確認。WBSC資料の別ページにあるチーム集計は打数・安打で差があり、照合には使っていない。打率と防御率は構成値から計算する。

大会別データ第2版で採用済み指標を追加し、日本戦9試合の結果を保持する。収録範囲は日本代表の大会通算の一部指標。選出・登録・試合ごとの出場は別管理とする。収録データは上記固定版から抜粋・整形し、CC BY-SA 4.0で提供する。

## WBC 2026の試合別本塁打・勝敗投手

日本戦5試合で、日本の本塁打10本と勝利投手4人・敗戦投手1人を照合した。準々決勝のベネズエラ戦は現地3月14日、日本時間3月15日。公式の投打成績へのリンクは日本時間の試合ページを使用する。[3月6日](https://www.japan-baseball.jp/jp/team/topteam/score/20260306_1/table.html)・[7日](https://www.japan-baseball.jp/jp/team/topteam/score/20260307_1/table.html)・[8日](https://www.japan-baseball.jp/jp/team/topteam/score/20260308_1/table.html)・[10日](https://www.japan-baseball.jp/jp/team/topteam/score/20260310_1/table.html)・[15日](https://www.japan-baseball.jp/jp/team/topteam/score/20260315_1/table.html)

既存の英語版Wikipediaの試合別イニング表を出典とし、氏名と件数を抜粋・整形してCC BY-SA 4.0で提供。試合IDと5試合のスコア、代表選出30人の第2版の記録を保持し、試合別の記録を第3版で追加した。3月6日の日本の安打数は照合資料と差があり採用対象外。大会通算成績と全出場の網羅性、登録や国内の選手IDは別管理とする。[1次ラウンド固定版1370352167](https://en.wikipedia.org/w/index.php?oldid=1370352167)・[準々決勝固定版1378823437](https://en.wikipedia.org/w/index.php?oldid=1378823437)

## APBC・WBC 2026の確認済み出場試合

収録済みの本塁打と勝敗投手の記録から、該当選手がその試合に出場した事実を追加した。APBC 2026は9人・14件、WBC 2026は11人・14件。同一選手・同一試合は1件とし、日本戦の試合IDと現地日付、各試合の固定版の出典を保持する。画面では選出と出場の確認を別々に開ける。

出場記録は日本代表の一部収録。全出場、登録、出場なしの判定、大会通算指標、NPB・MLB選手IDとの結合は別管理とする。既存の選出記録と試合結果を維持し、APBCは第3版、WBC 2026は第4版に更新した。

APBCの第4版で、日本語版Wikipediaの選手記事とChadwick Registerの `key_npb`、既存Directoryの本人照合を通った9人をNPBプロフィールへ接続した。記事固定版、Chadwickのコミット、資料のハッシュはデータとともに保持する。

第5版では[日本語版Wikipediaの固定版111828931](https://ja.wikipedia.org/w/index.php?oldid=111828931)から日本戦4試合の投手・捕手を抜粋した。侍ジャパン公式の各試合のバッテリー欄で照合し、日本側投手のアウトは日付順に27・27・21・27。11月14日は7回コールド、11月13日の中森俊介は0アウトで降板した登板も含む。同一試合・選手を統合して20人・31件となり、新たに出場が確認できた11人も同じ方法で本人照合し、合計20人をNPBプロフィールに接続した。代表選出28人とスコアを保持する。全打者・個人成績・登録は引き続き別管理とする。[11月12日](https://www.japan-baseball.jp/jp/team/topteam/score/20261112_2/)・[13日](https://www.japan-baseball.jp/jp/team/topteam/score/20261113_2/)・[14日](https://www.japan-baseball.jp/jp/team/topteam/score/20261114_1/)・[15日](https://www.japan-baseball.jp/jp/team/topteam/score/20261115_2/)

APBCの第6版では、同じ固定版から日本代表13投手の登板16件と投球回を収録した。投手別のアウト合計を対戦相手のイニングスコアと照合し、順に27・27・21・27アウト、合計102アウト（34回）を確認した。中森俊介の11月13日の登板は0アウト。防御率・奪三振・打撃の大会通算成績は未収録のままとし、NPBの成績やランキングとは別の大会記録として扱う。[固定版111828931](https://ja.wikipedia.org/w/index.php?oldid=111828931)

WBC 2026の第5版では、出場を収録した11人のうち、種市篤暉・周東佑京・森下翔太・伊藤大海・隅田知一郎・金丸夢斗の6人を公開済みのNPBプロフィールへ接続した。日本語版Wikipediaの選手記事とChadwick Registerから同じNPB選手IDを確認し、既存Directoryに一意に対応する行だけを採用。金丸夢斗はAPBCとWBCの両方を表示する。公開NPB Directoryとの照合が成立しない5人の出場記録は大会側IDで保持した。

## 過去大会の成績とNPB選手プロフィール

両大会の第3版で、プレミア12 2024の全28人とWBC 2023の18人、重複を除いて41人について、収録済みの大会通算成績を既存のNPB選手プロフィールへ接続した。原資料の成績表にある選手記事リンクを確認し、日本語版Wikipediaの選手記事とChadwick RegisterのNPB IDを公開済みDirectoryのIDに一意に照合した。既存のNPBプロフィールと照合できなかったWBCの11人は、大会成績を表示したままリンクを保留する。NPB公式戦の成績・各試合の出場・代表登録の収録範囲は変更しない。

プレミア12の清水達也は、旧版で大会側IDが同名の曖昧さ回避ページを指していた。成績表がリンクする中日の投手本人のページへ訂正し、第2版の数値とNPB canonical IDを維持した。大会データに旧版番号と訂正根拠を記録している。[大会の成績表](https://ja.wikipedia.org/w/index.php?oldid=111780580)・[侍ジャパンの本人プロフィール](https://www.japan-baseball.jp/jp/profile/201705001.html)・[選手記事の固定版](https://ja.wikipedia.org/w/index.php?oldid=111617830)

## データ採用の再開条件

- 大会ごとに取得、保存、加工、Web表示、Android表示、再配布を認める根拠とSourceの版を確認する。訂正時は旧版と出典を保持する。
- `complete`は対象（大会全体または代表チーム）、参加チーム一覧と出典、区分固有の期待ID一覧と出典、期待件数・収録件数を必要とする。許諾済みの参加チーム・期待IDを実際のユニークな行と照合する。日程、確定結果、選出、登録、確定試合の出場は別単位。大会通算の選手成績は出典・対象・役割ごとに検証し、全件の台帳が確認できるまで `partial` とする。
- APBCは最終確定した大会規則と試合終了の記録が必要。タイブレーク・コールドの適用、対戦国・日時変更、実出場、投球アウトと率の構成値を確認する。大会概要の暫定規則を完了証拠に使わない。
- 選手を既存プロフィールへ結ぶには、代表側ID・既存canonical IDをそれぞれ根拠行に固定する。許諾済みの異なる出典主体が作成した原資料と資料hash、両方で一致する発行主体付き選手識別子または生年月日・照合済み所属ID、レビュー担当・時点・結果・理由を保存する。URLやhashの差だけで独立性は確定しない。レビューで転載・同一主体の別サイト・同姓同名を除外し、実際のDirectory照合はデータ採用時に行う。未照合者は大会側IDで保持する。
- Home・My・Watchへの接続は確認済みの選出記録と本人照合が揃ってから行う。背景通知の実配信は別検証とする。

`international`は専用ID、試合・参加・出典の検証境界を使う。国内・MLB Historicalのcollector、Facts、HOT、公式ランキング、Record Watchに渡す経路は追加しない。DB、配信asset、個人保存のmigrationは不要。追加月額費用¥0。
