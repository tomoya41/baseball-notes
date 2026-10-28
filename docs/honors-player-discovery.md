# 選手別の表彰歴

2026-10-28 JST。既存の許諾済み3971件（NPB682 / MLB3289）を選手単位で探索する追補。新しい試合・成績・受賞・本人照合・Canonical IDは作成しない。

## Data-first staging

新しいv4は、既存v3の542 payloadをbyte-for-byte保持し、選手索引2件とsource-recipient別bucket359件を追加する。NPB140人、MLB1022人。MLB609人のプロフィール未収録と本人未確定を混同しない。索引とbucketはsourceのrecipient IDで参照し、名前では統合しない。bucket用のハッシュは配信先の振り分けでありCanonical IDではない。

初回はv3をactiveのままv4をinactive retained assetとして配信する。コードのレビューと公開HTTP確認後、別の変更でv4をactiveへ切り替え、v3をretainedへ移す。既存APKは旧v3 URLを引き続き利用できる。Rollbackはactive pin / UIのrevertで、immutable assetは上書き・削除しない。

v4は904 files / 21,141,356 bytes、gzip 3,759,002 bytes。最大payload209,858 bytes、索引はNPB28,654 / MLB189,919 bytes。選手探索に必要な索引・bucketだけ取得し、初期JS・Homeに全記録を含めない。既存データ総量319,628,328 bytesに対する追補後は340,769,684 bytes。無料運用を維持する。

## Source / integrity

[既存の権利監査](baseball-honors-scoreboard.md)と同じarchive/input hashを使用。Wikipedia由来はCC BY-SA4.0、Lahman由来はCC BY-SA3.0、Chadwick本人照合はODC-BY1.0。原改版・著者・加工表示・各部分の再利用条件を維持する。新Source取得0、AI呼出0、DB read/write0。出典の原文や法的クレジットは変更しない。

全3971件と既存本人照合・年別／profile別・inning payloadに変更0。Coverage partial、回数は収録分、年齢・現在所属・未収録年度の成績を推測しない。配信時は現行63915 data filesの保全と新namespaceのhashを比較する。Tests / CI / native / Pages証拠は実行後にdelivery PRへ記録する。Pixel/TalkBackは実機なしではNOT RUN。
