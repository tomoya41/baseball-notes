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

APBC 2026の日本戦4試合、WBC 2023の7試合・2026の5試合、プレミア12 2024の9試合について、開催地の日付、ラウンド、ホーム・ビジター、確定得点を収録。対象は日本戦の結果のみ。選手登録・出場・個人成績と今後の日程は未収録。

英語版Wikipediaの版指定付き記事を公開MediaWiki APIから取得。WBCとAPBCは個別のイニング表と最終得点、プレミア12は試合別結果行と照合した。APBCの概要表には月の不一致があるため、試合別イニング表の日付と公式日程を照合した。版番号と試合の対応は `src/data/international-japan-results.ts` に保持する。日時欄に実際の開始時刻を推定して入れない。

記事の数値を抽出・翻訳した結果データの取得・保存・加工・Web/Android表示・再配布には、著作者表示、原記事へのリンク、変更の明示と同一ライセンスを適用する。大会公式サイトは確認先として案内する。[Wikimedia利用規約 §7](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use#7._Licensing_of_Content)・[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)

## データ採用の再開条件

- 大会ごとに取得、保存、加工、Web表示、Android表示、再配布を認める根拠とSourceの版を確認する。訂正時は旧版と出典を保持する。
- `complete`は対象（大会全体または代表チーム）、参加チーム一覧と出典、区分固有の期待ID一覧と出典、期待件数・収録件数を必要とする。許諾済みの参加チーム・期待IDを実際のユニークな行と照合する。日程、確定結果、選出、登録、確定試合の出場は別単位。成績行の契約と照合が加わるまで選手成績は `uncollected` のみ。
- APBCは最終確定した大会規則と試合終了の記録が必要。タイブレーク・コールドの適用、対戦国・日時変更、実出場、投球アウトと率の構成値を確認する。大会概要の暫定規則を完了証拠に使わない。
- 選手を既存プロフィールへ結ぶには、代表側ID・既存canonical IDをそれぞれ根拠行に固定する。許諾済みの異なる出典主体が作成した原資料と資料hash、両方で一致する発行主体付き選手識別子または生年月日・照合済み所属ID、レビュー担当・時点・結果・理由を保存する。URLやhashの差だけで独立性は確定しない。レビューで転載・同一主体の別サイト・同姓同名を除外し、実際のDirectory照合はデータ採用時に行う。未照合者は大会側IDで保持する。
- Home・My・Watchへの接続は確認済みの選出記録と本人照合が揃ってから行う。背景通知の実配信は別検証とする。

`international`は専用ID、試合・参加・出典の検証境界を使う。国内・MLB Historicalのcollector、Facts、HOT、公式ランキング、Record Watchに渡す経路は追加しない。DB、配信asset、個人保存のmigrationは不要。追加月額費用¥0。
