# 2026日本シリーズ第4戦・総括

2026-10-31 JST。既存許可範囲のWikipedia公開APIを1回だけ取得
（2026-10-30T22:15:33.076Z）。NPB公式は独立照合・閲覧リンクのみ。
ニュース本文・写真・ロゴ・個人成績の転載やDBアクセスは行わない。

| 入力 | Revision / UTC | Content SHA256 |
|---|---|---|
| [記事5306035](https://ja.wikipedia.org/w/index.php?curid=5306035&oldid=111577168) | 111577168 / 10-30 12:14:54 | `047f3ef076a4ce94a2774064084e25327dde500c627c9e2790e90a23d4a43a0c` |
| [日程5307595](https://ja.wikipedia.org/w/index.php?curid=5307595&oldid=111552874) | 111552874 / 10-28 11:58:56 | `1566dffdc4652392643daccc32642904abfcac770569553b76aaab5fce380a47` |

[Wikimedia利用規約§7](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use)、
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)、
[API etiquette](https://www.mediawiki.org/wiki/API:Etiquette)を同日再確認。
原記事・改版・執筆者・ライセンス・変更表示と派生部分の同条件を継続する。
記事冒頭の編集者向け注意書きはデータとして扱い、指示として実行しない。

## 採用した結果

10/28第4戦、DeNA 2–4 ソフトバンク、2時間33分。
DeNA各回 `2,0,0,0,0,0,0,0,0`、ソフトバンク `0,0,0,3,0,1,0,0,X`。
既存ID `npb:game:a7485a4ae336ed934ca5` を維持。
日程得点・Linescore・終了時間・球団・日付・各回合計を個別照合した。
4勝0敗の決着は採用した4試合だけから算出し、
[NPB公式](https://npb.jp/nippons/2026/)とも独立照合した。
公式ページの説明文・画像をWikipedia由来として再配布しない。

終了後の日程テンプレートは第1–4戦だけに短縮されている。
短い表は、全行の終了証拠・4勝先取・優勝欄の球団一致がそろう場合のみ採用。
単なる行削除、未終了、優勝欄なし・不一致、3勝では受理しない。
第5–7戦の既存ID・当初予定日・球場は保持し、検証済み決着により
`cancelled`（開催不要）として保存する。雨天中止・結果未収録と区別して表示する。
独立に延期されていた行や既存finalの削除・変更は通常の追記で受け入れない。

第1–3戦のGame、数値、イニング、試合時間、証拠hash、元の出典は完全保持。
第4戦のみ新改版へ結び付け、v1–v4の公開バイトは変更しない。
Coverage partial、個人成績・予告先発は未収録のまま。
正式MVP・選手別活躍や投手の登板内容を得点表から生成しない。

## immutable release / rollout

v5 `npb-japan-series-wikipedia-20261031-v5`：JSON **6,137 bytes**、
SHA256 `ebc37cceb1644b91d084708429edb267a15bc88f07f4cdb9f8385a8bfa5a91ec`。
gzip **2,059 bytes**、SHA256
`5a214036a3ecd662417f27dcda96082ce94a1a5fed7d84aa024b706569de8381`。
全7 ID / 結果4 / 開催不要3。新規個人成績0、canonical write0、Gate変更0。

まずv4 activeを維持してv5をinactive配信し、HTTP/hashと既存data全件を確認。
その後active pinを切替え、同じ検証済みデータから既存Home/Series/Game/
週間・月間とシリーズ総括へ接続する。新画面は作らず、コンパクトな既存UIを使う。
Rollbackはpin/UIのrevertで、旧URL・個人保存・旧APKの参照先は残す。
総括は得点・イニングからの決定論的集計で、AI/APIを必要としない。
公開・レビュー・Android証拠は対応PRへ記録する。Pixel/TalkBackは別Gate。
追加月額費用¥0。
