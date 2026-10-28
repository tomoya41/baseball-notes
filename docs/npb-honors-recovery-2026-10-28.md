# NPB表彰歴の再処理（2026-10-28）

既存の許可済みWikipediaアーカイブだけを再処理する。新規取得・DBアクセス・AI呼出し・問い合わせ・有料サービスはない。原記事改版・著者履歴・CC BY-SA4.0・加工表示を維持する。[既存の権利監査](baseball-honors-scoreboard.md)の条件Bと同じ用途・Sourceで、アプリのコードとデータ各部分のライセンスを混同しない。

## 追加できた実績

表彰リストの隔離17ブロックのうち、形式だけが原因だった14ブロックを解消し、12人・52件を追加する。NPBは682→734件、表彰収録選手140→142人。新しく表彰歴を持つ鈴木大地・佐藤都志也も既存Canonical IDへの照合済みで、新規選手IDではない。9人・41件は保存済みCurrent Directoryの既存ID、3人・11件は既存Historical-only ID。Directoryへの存在を現在の登録状態の証明にはしない。

| 選手・原改版 | 追加件数 |
|---|---:|
| [坂本勇人](https://ja.wikipedia.org/w/index.php?curid=739437&oldid=111196306) | 6 |
| [菊池涼介](https://ja.wikipedia.org/w/index.php?curid=2455687&oldid=111195684) | 10 |
| [浅村栄斗](https://ja.wikipedia.org/w/index.php?curid=1617856&oldid=109907016) | 10 |
| [鈴木大地](https://ja.wikipedia.org/w/index.php?curid=2444560&oldid=109776831) | 5 |
| [栗山巧](https://ja.wikipedia.org/w/index.php?curid=162895&oldid=111152646) | 4 |
| [中野拓夢](https://ja.wikipedia.org/w/index.php?curid=4244362&oldid=111227953) | 2 |
| [益田直也](https://ja.wikipedia.org/w/index.php?curid=2464168&oldid=110790942) | 2 |
| [山本祐大](https://ja.wikipedia.org/w/index.php?curid=3696738&oldid=111057765) | 1 |
| [佐藤都志也](https://ja.wikipedia.org/w/index.php?curid=4031306&oldid=111241891) | 1 |
| [内川聖一](https://ja.wikipedia.org/w/index.php?curid=184273&oldid=111388561) | 5 |
| [鳥谷敬](https://ja.wikipedia.org/w/index.php?curid=1182101&oldid=111253067) | 5 |
| [攝津正](https://ja.wikipedia.org/w/index.php?curid=1600224&oldid=110949278) | 1 |

年度別増分：2008年2、2009年1、2010年1、2011年3、2012年2、2013年7、2014年2、2015年2、2016年4、2017年5、2018年2、2019年4、2020年6、2021年3、2022年3、2023年1、2024年3、2025年1。成績の収録年度や統計行は追加しない。

## 判定規則と限界

- 明示的な守備位置ラベルごとに年リストを区切る。半角コロン前の空白、読点・空白・全角空白で区切られた部門、明記された年範囲を扱う。選手の現在の守備位置から推定しない。
- 親リストが年・回数を明示して完結している場合、子の別表彰リンクや説明文を回数に混ぜない。子に明示的な回数がある構造は子の合計も照合し、不明な部門・矛盾・重複は保留する。同じ年の投手部門と指名打者部門など、明示された別部門は区別する。
- 既知のR/Efn2注記だけを括弧の対応を確認してマスクする。内容を解釈・実行せず、注記内の偽リストを採用しない。未閉鎖・未知の年構文・末尾の読点・件数不一致・未確定表記は受け入れない。元の証拠hashは未加工の原文から取る。
- 2026年を含むライデル・マルティネス、髙橋遥人、鈴木昭汰の3ブロックは引き続き保留。カットオフ2025年を変えず、都合のよい過去年だけ抜き取らない。Historical成績の隔離件数とは別の監査である。
- 既存年度成績に当時の所属根拠がない内川聖一2008/2009年、菊池涼介2015年は所属・リーグをnullのまま保持する。現在の所属や通算から補わない。Coverageは一部収録、回数は収録分である。

## 保全・公開

独立した期待値一覧で追加52件の選手・年・表彰・部門を照合する。既存3971件のレコード・証拠hashは完全一致。既存本人照合・外部ID・Canonicalリンクは不変、MLB表彰3289件とスコアの655投影ファイルも不変。原入力20件のhashは同一で、再現用入力台帳にはDirectory・プロフィール索引・正規化データ・試合採用範囲を追加して全26件を記録する。

新immutable v5は907ファイル・21,355,133B（manifest込み）、gzip3,779,246B。最大payload209,858B。Homeの追加fetch0、必要な年度・選手bucketだけ取得する。既存64,820ファイル・340,887,323Bに対する追補後は65,727ファイル・362,242,456B。Rawは公開しない。

まずv4 activeを維持してv5をinactive retainedへ配信し、既存全件の保全と新hashの公開HTTPを確認する。別PRでv5をactiveにしてv3/v4をretainedへ保持する。Rollbackはpinのrevertで、旧assetやURLを上書き・削除しない。定義変更で既存統計・Favorites・Collections・Watch・Production Gateを変えない。検証・公開の実測証拠は各PRへ記録する。

## 独立した運用残件

最新の実Scheduled EOD [40657147919](https://github.com/tomoya41/baseball-notes/actions/runs/40657147919)は2026-10-28T08:29:48Z、`database_read_suspended`で失敗。実BLOCKED観測2026-10-27T16:37:34.787Zに基づく24時間抑止を復元し、`probeDue=false`、DB read/write0、Source HTTP0、公開なし、Scheduled Fact証拠false。期限2026-10-28T16:37:34.787Zの到来だけを復旧と扱わない。追加診断・制限回避・課金は行わず、HOT/Ranking Gateも維持する。今回の静的表彰更新をProduction DBの復旧証拠にはしない。Pixel/TalkBack・所有者署名は別の未確認Gate。追加月額費用¥0。
