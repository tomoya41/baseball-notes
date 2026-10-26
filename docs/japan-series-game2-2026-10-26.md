# 日本シリーズ第2戦：検証済み更新（2026-10-26）

既存の許可済みWikipedia公式APIを1回だけ取得。観測2026-10-26T05:27:20.937Z、記事5306035/revision111523167、日程5307595/revision111514888。新SourceやNPB.jp収集は行っていない。原記事・著者履歴・CC BY-SA 4.0と加工表記を維持する。

- [記事revision](https://ja.wikipedia.org/w/index.php?oldid=111523167)／[日程revision](https://ja.wikipedia.org/w/index.php?oldid=111514888)。記事hash bbe0504e5835d9ac2947bdb79c1ed185bea52c79686ee6e32becf1dbe6585cfb、日程hash ffea197acc5c240ebdeb325dbaf00147c111b27429ae5b94e5de5f8f1666f34f。転載疑惑/copyvioタグなし。
- 第2戦10月25日、ソフトバンク4–3DeNA、延長10回、3時間36分。両表の球団・試合番号・日付・得点と各回合計を照合。後攻最終回は完了。第1戦のGame・結果・終了証拠hashは完全一致。
- 第2戦ID npb:game:8aabfefe82d76006b9a9。先攻各回0,0,1,1,0,0,0,0,1,1／後攻0,0,0,0,0,0,0,3,0,0。終了証拠hash 3e290f5bfbe76386b44713c7377321c3554e5b0d3b099e7b708865e20eb165ab。
- 限定差分は確定結果1→2件、ソフトバンク1→2勝・DeNA0勝、日程変更0、優勝未確定。次の収録日程は10月27日第3戦・みずほPayPayドーム福岡。先発時刻/予告先発/個人成績は未収録、5試合の結果null、Coverage partial。

既存builderでpinned CS/前版/完全一致Linescore reviewを照合。旧finalの訂正・削除、曖昧なidentityやスコアのみの完了判定は受け入れていない。canonical DB/Facts書込み0、Current Gate変更0。

新immutable assetは [v3](https://github.com/tomoya41/baseball-notes/releases/tag/npb-japan-series-wikipedia-20261026-v3)。gzip1533B/hash c65e35006e2f6f8470e5cf20d819d914a1024a4fe41af2d71ee6614d7eb6ef1f、JSON4341B/hash fd2531eb575f406be481fd7b3ec912e51d0f7a38d486de2fba9c1ea40a37a5d7。v1/v2を上書き・削除しない。

まずinactive retained assetとしてPagesに配信し、旧版v2の画面とapp pinを維持する。HTTP/hash確認後に、別のレビュー可能なpin更新でHome・Series・Game・週間分析を同じv3 snapshotへ切り替える。配信・切替の証拠はPRへ記録する。未収録個人成績からMVP/HOTを作らない。追加月額¥0。
