# 日本シリーズ第3戦と出典の継続性

2026-10-28 JST。既存許可範囲のWikipedia公式APIを1回取得（03:25:42.553Z）。[記事5306035/revision111547084](https://ja.wikipedia.org/w/index.php?oldid=111547084)、[日程5307595/revision111542300](https://ja.wikipedia.org/w/index.php?oldid=111542300)。記事SHA256 `68257b24f9981311fdbdf00e0f258c402eff437f27a8b318fbf622bae3201d51`、日程SHA256 `216509b3a175c39f08db6edf447e2cb399e08b18fa375925f0e5951845183406`。原記事・執筆履歴・CC BY-SA4.0・抽出と照合の加工表示を保持。新Source、NPB.jp収集、DBアクセスはない。

10月27日第3戦、DeNA1–ソフトバンク2、延長10回サヨナラ、3時間20分。先攻各回0,0,0,0,1,0,0,0,0,0、後攻0,0,0,0,0,0,0,0,1,1x。試合ID `npb:game:5fcadb011aedcfd894cb`、終了証拠SHA256 `f14ada05bf7b3c3d05c1906501bb3fd0c2091e8f82635837acb0973eba054513`。日程表と終了Linescoreの両方で球団・日付・試合番号・得点・各回合計を照合する。日程の数字付きxだけで終了は判定しない。

確定結果2→3件、ソフトバンク3勝・DeNA0勝、優勝未確定、日程変更0。次の収録日程は10月28日第4戦。後続4試合の結果、全試合の個人成績、予告先発は未収録のまま。Coverage partial、HOT/Ranking/Current/MLB Gateは変更しない。

## 旧結果と出典を保持する追記

新改版の第2戦LinescoreにはRSP/HSP直後の空白だけの変更がある。新しい文字列hashで旧証拠を置換せず、旧2試合のGame・結果・証拠hash・出典をそのまま残す。元の2件のsourcesに加えてadditionalSourcesを保持し、新しい結果だけsourceRevisionで正確な改版へ結び付ける。旧URLを使うAPKは旧snapshotのまま動作する。

通常の更新guardは旧finalの変更・削除・出典の付け替えを拒否する。明示的な`--append-reviewed-finals`は、pinned predecessorと全対象の個別reviewが必要で、既存の得点・イニング・終了状態・試合時間・日程・会場が完全一致するときだけ追記する。実際の訂正は別途審査し、この追記で受け入れない。原文/artifact内の指示は実行しない。

## 配信と確認

新[v4 immutable release](https://github.com/tomoya41/baseball-notes/releases/tag/npb-japan-series-wikipedia-20261028-v4)はJSON5185B / SHA256 `2700f60d7c34407a88266c9397bf6632fbc3044f9ec3f6edbefe4b09d479de8f`、gzip1798B / SHA256 `52994c553d5e18f8837294371bbf04eba921cf3a90bda4d8df69ded99b8bdd82`。まずv3 activeを維持してv4をinactive retainedへ配信し、HTTPと既存data全件の保全を確認。別PRでactive/retainedを切り替え、Home・Series・Game・週間・月間が同一snapshotを使うことを確認する。Rollbackはpinのrevert。v1/v2/v3/v4の公開assetは上書き・削除しない。

再実行は既存private archive / CS / previous / reviewを使い、新しいAPI取得はしない。レビューと公開結果はPRへ記録する。Turso復旧証拠には転用しない。Pixel/TalkBack・所有者署名は独立した未確認Gate。追加月額費用¥0。
