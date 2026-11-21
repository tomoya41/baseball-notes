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

APBC 2026の日本戦4試合、WBC 2023の7試合・2026の5試合、プレミア12 2024の9試合について、開催地の日付、ラウンド、ホーム・ビジター、確定得点を収録。APBC 2026は10月7日発表の選出28人も収録。日本語版Wikipediaの[版111791999](https://ja.wikipedia.org/w/index.php?oldid=111791999)の選手欄と公式代表一覧を照合し、監督・コーチを除外した。各選手の記事IDは大会側だけで使用する。登録・実出場・個人成績と今後の日程は未収録。

英語版Wikipediaの版指定付き記事を公開MediaWiki APIから取得。WBCとAPBCは個別のイニング表と最終得点、プレミア12は試合別結果行と照合した。APBCの概要表には月の不一致があるため、試合別イニング表の日付と公式日程を照合した。版番号と試合の対応は `src/data/international-japan-results.ts` に保持する。日時欄に実際の開始時刻を推定して入れない。

記事の数値を抽出・翻訳した結果データの取得・保存・加工・Web/Android表示・再配布には、著作者表示、原記事へのリンク、変更の明示と同一ライセンスを適用する。大会公式サイトは確認先として案内する。[Wikimedia利用規約 §7](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use#7._Licensing_of_Content)・[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)

## WBC 2023の日本代表通算成績

日本語版Wikipediaの[固定版109739294](https://ja.wikipedia.org/w/index.php?oldid=109739294)から、打撃16人・投球14人の大会通算成績を抜粋。公開MediaWiki APIの原文応答のSHA-256は `c870665f7a1bc56f5fd8503cda4c46c8947dada37a6678510f8640fe8b3109f6`。選手欄のリンク先の記事IDを照合し、大谷翔平の打撃と投球には同じ国際大会側IDを使用した。国内・MLBプロフィールとの本人照合は未実施。

打撃は出場試合数、打数、安打、本塁打、打点、投球は登板数、アウト数、失点、自責点、奪三振を照合。打率と防御率は構成値から計算。日本の打数221・安打66・本塁打9・打点55と、投球189アウトを確認した。髙橋宏斗の奪三振は資料間で差があり未収録とした。照合先は[WBC公式の打撃成績](https://www.mlb.com/world-baseball-classic/stats/japan/2023/)と[投球成績](https://www.mlb.com/world-baseball-classic/stats/pitching/japan/2023/)。

大会別データ第2版として日本代表の一部指標を収録し、試合結果7件は旧版の内容を維持する。試合ごとの出場、登録、選出、全参加国と全指標のCoverageは別管理とする。

## WBC 2026の日本代表発表と台日交流試合

日本語版Wikipediaの[固定版110704201](https://ja.wikipedia.org/w/index.php?oldid=110704201)から、[侍ジャパンの2月26日時点の発表](https://www.japan-baseball.jp/jp/team/topteam/2026/wbc/player.html)と一致する代表選手30人を収録。監督・コーチ、辞退者、サポートメンバー、招集されていない指名投手枠は含めない。背番号・氏名・役割を照合し、出典に記載された個々の選出発表日を保持する。名前と役割・発表日を抜粋・整形してCC BY-SA 4.0で収録する。取得応答のSHA-256は `117b935735c892988dcb03dc77659107821cce0a14164c21acde6409f8d9c7d8`。大会別データ第2版で選出を追加し、登録・試合出場・選手成績は未収録。5試合の結果は旧版の内容を維持する。

2027年3月6・7日の台日交流試合は、台北ドームでの開催予定を案内し、[侍ジャパンの11月18日発表](https://www.japan-baseball.jp/jp/news/press/20261118_1.html)へリンクする。日程や試合のデータは収録していない。

## データ採用の再開条件

- 大会ごとに取得、保存、加工、Web表示、Android表示、再配布を認める根拠とSourceの版を確認する。訂正時は旧版と出典を保持する。
- `complete`は対象（大会全体または代表チーム）、参加チーム一覧と出典、区分固有の期待ID一覧と出典、期待件数・収録件数を必要とする。許諾済みの参加チーム・期待IDを実際のユニークな行と照合する。日程、確定結果、選出、登録、確定試合の出場は別単位。大会通算の選手成績は出典・対象・役割ごとに検証し、全件の台帳が確認できるまで `partial` とする。
- APBCは最終確定した大会規則と試合終了の記録が必要。タイブレーク・コールドの適用、対戦国・日時変更、実出場、投球アウトと率の構成値を確認する。大会概要の暫定規則を完了証拠に使わない。
- 選手を既存プロフィールへ結ぶには、代表側ID・既存canonical IDをそれぞれ根拠行に固定する。許諾済みの異なる出典主体が作成した原資料と資料hash、両方で一致する発行主体付き選手識別子または生年月日・照合済み所属ID、レビュー担当・時点・結果・理由を保存する。URLやhashの差だけで独立性は確定しない。レビューで転載・同一主体の別サイト・同姓同名を除外し、実際のDirectory照合はデータ採用時に行う。未照合者は大会側IDで保持する。
- Home・My・Watchへの接続は確認済みの選出記録と本人照合が揃ってから行う。背景通知の実配信は別検証とする。

`international`は専用ID、試合・参加・出典の検証境界を使う。国内・MLB Historicalのcollector、Facts、HOT、公式ランキング、Record Watchに渡す経路は追加しない。DB、配信asset、個人保存のmigrationは不要。追加月額費用¥0。
