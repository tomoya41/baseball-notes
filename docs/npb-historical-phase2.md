# NPB Historical Phase 2 — 2026-10-16

基準: main `039ef851` / PR #33。2015〜2025 Regular の年度別集計のみ。2026 Current、試合Facts、MLB 2014〜2025、HOT/Ranking Gateを変更しない。追加月額¥0。

## 結果と収録範囲

v3 444選手 / 2,060行 → v4 **593選手 / 3,072球団別年度行**（打撃1,673、投球1,399）。149選手・1,012行増。うち既存アーカイブのparser改善は128選手・894行、Historical-only追加は21選手・118行。旧2,060行の欠落0、数値変更0、旧Identity変更0。すべての年度は **partial**。全選手、全Career、公式ランキング、規定資格、Recent/Game Factsの提供ではない。

| 年度 | v3行 | 打撃増 | 投球増 | v4行 |
|---|---:|---:|---:|---:|
| 2015 | 63 | +16 | +14 | 93 |
| 2016 | 76 | +21 | +18 | 115 |
| 2017 | 105 | +20 | +23 | 148 |
| 2018 | 126 | +22 | +35 | 183 |
| 2019 | 151 | +27 | +45 | 223 |
| 2020 | 178 | +24 | +54 | 256 |
| 2021 | 204 | +27 | +71 | 302 |
| 2022 | 250 | +34 | +81 | 365 |
| 2023 | 266 | +36 | +93 | 395 |
| 2024 | 298 | +41 | +116 | 455 |
| 2025 | 343 | +55 | +139 | 537 |

## Quarantine の監査

旧232件は232選手/行とは限らず、表停止の後ろに未解析行もあった。非公開 `quarantine-audit-before.json` に全件の記事・revision・表開始・問題行・年度・拒否理由を保存。既存アーカイブのローカル再処理であり、nf3再取得なし。

| 旧分類 | 件数 | 対応 |
|---|---:|---|
| 未対応数値 | 142 | `----`、`.---`、空欄をnull。明示0は0。Color red/blue、Nowrap、正しい桁区切りのみ解釈 |
| 表定義 | 52 | 既知templateのdefault/空league/NPB別名。明示foreign leagueは除外 |
| WHIP差異 | 10 | 許容差を広げず引き続き算術不一致を拒否 |
| SLG / OPS / OBP等 | 18 | 同じ算術検証を維持。数値修正なし |
| PA構成違反を含む複合問題 | 2 | 引き続き拒否 |
| 塁打違反 | 1 | 引き続き拒否 |
| 年表記 | 5 | 裸の4桁年のみ追加。foreign year markerは除外 |
| AVG差異 | 1 | 引き続き拒否 |
| 不明/非NPB球団 | 1 | NPB12球団に一致しない行は収録しない |

上の分類は重複しない原reportのreason集計。行数増と問題件数減を同一視しない。

原reasonの残り: SLG2、OPS6、OBP+SLG8、OBP2、PA+OBP+OPS2、TB1、AVG1、year5、team1、WHIP10、numeric142、table52 =232。

追加した安全な解釈: コメント付きcell属性、連続row separator、球団rowspan、同年度移籍の `'18計` 物理行を除外しつつrowspanを1行進める処理。球団別行は残し、合計行の二重加算を防ぐ。数値エラーのみなら既知の列構造を維持して次の行を検証できる。colspan/列数不一致はその表を停止する。

新reportは **73件**（旧記事71、新規OB記事2）。内訳: numeric20、table6、列数1、WHIP18、SLG2、OPS6、TB1、PA+OBP+OPS2、OBP+SLG9、OBP2、OBP+OPS1、AVG1、ERA3、分母なし率1。後続行も検査するため旧reportに現れなかった不整合もある。残る不一致を許容誤差変更で受理しない。

実形式fixture: `tests/fixtures/npb-historical/wikipedia-formats.json`。佐藤輝明・大山悠輔・伊藤光・陽柏翔・戸郷翔征の年度表の必要部分だけを抽出。記事/revision URL・CC BY-SA・変更説明を同梱。伊藤の2018複数球団/合計除外、戸郷の2019 WHIP拒否、後年の継続検査を固定する。その他の単体テストで不正pipe、未知template、colspan、0/null、IP .0/.1/.2を検証する。

## Historical-only Identity

公式Wikipedia APIで明示24記事、Wikidata APIで対応QIDのみ取得。キャッシュ・逐次取得・12記事単位・意味のあるUser-Agent・maxlag5・エラー時停止。新規OB取得のlive requestは4回（最初のWikidata応答にrevision情報が不足していたため修正版を1回取得）、template定義確認1回。以降の再検証はcacheのみ。アプリ/CIはWikimediaを呼ばない。

24人全員が独立ID照合を通過し、年度行を採用できた21人だけregistryへ採用。三浦大輔・黒田博樹・岩隈久志は今回のparser/対象年度で採用行なしのため追加しない。これを出場なしとは判定しない。DOB末尾の脚注は厳密な引用構文だけ除去し、別の日付や未知templateを許可しない。

`npb-historical-only-identities.json` に各選手のNPB ID、QID、Wikipedia page ID/revision、Wikidata revision、両方の取得時刻、生年月日を固定。WikipediaのNPB IDとWikidata P4260、正確なjawiki sitelink、日精度Gregorian P569とinfobox生年月日の一致を必須化。複数候補/片側一致/既存bridgeとの衝突は拒否。名前で照合しない。今回未確定Identity0（候補24人の範囲のみ。既存Current未照合全体の解消ではない）。

新IDは `baseball-notes:npb-historical-only:v1:<NPB ID>` からUUIDv8を生成。既存bridgeのUUID/NPB ID/QIDすべてとの衝突を検査し、旧UUIDは変更しない。独立したread-only registryでありcanonical SQLへの登録・writeではない。将来のCurrent登録はこのregistryの外部IDも照合し、同一人へ再採番しないこと。

## 利用条件と出典

確認日2026-10-16。新Sourceや問い合わせなし。Wikipediaは既存の[利用規約7条](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use#7._Licensing_of_Content)と[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)を維持。年度表の抽出/正規化部分とfixture抜粋に適用し、アプリ独自コードのlicenseと区別する。raw記事/画像/ロゴ/第三者素材は公開しない。[Wikidata structured data](https://www.wikidata.org/wiki/Wikidata:Data_access)はCC0。NPB IDは照合用であり公式サイトからの統計取得許諾ではない。

[API etiquette](https://www.mediawiki.org/wiki/API:Etiquette)に従う。数値の編集・補完はせず、missing marker/単位/表構造だけ正規化。選手一覧、同年比較、年度比較、収録年合計の各表示に原記事のoldid付き執筆者リンクとCC BY-SAリンクを維持。原記事の取得時刻とdataset組立時刻を分離する。

## 配信・Product・rollback

旧v3 assetを上書きしない。v3の既存12 URLはbyte-identicalで維持する。v4は `data/npb/historical/<release-sha256>/` の12ファイルへ配信し、新APKだけがこのnamespaceを読む。旧APKの300KB bound/旧input hashとの互換性を守る。新reader/manifestは500KBまで、輸送hash・scope・Identity区分・組立世代を検証してからoffline cacheへ保存する。

v4 gzip202,493 bytes、展開1,183,581 bytes。公開世代12ファイル合計2,068,517 bytes、最大348,520 bytes。旧世代込み24ファイル3,365,557 bytes。初回Historyは2取得、年度比較は追加最大4（最悪manifest込み6）、30選手/page、比較4人/4年度。Home追加Historical fetch0。初期JSに統計datasetを入れない。DB増分0、Scheduled負荷増0。生成約0.2秒。

Historyの検索は現在年の結果に加え、manifest内の別年度一致を最大10人示す（追加通信0）。OBはHistoryで閲覧し、2026 Currentプロフィールへのリンクを作らない。既存Favorite storageを再利用し、Myから過去年度へ戻れる。Historical-only Favorites/Collection IDsはCurrent Watch対象にしない。Recordsから年度探索へ接続するが、Current Ranking Gateを迂回しない。完全Career/公式記録は未実装。

rollbackはコードrevertと旧pinを利用。旧v3ファイルとrelease assetは残す。将来v5を追加する際も既公開のhash namespaceを消さず保持すること。

## Turso / Current

2026-10-15T21:43:19ZのScheduled Daily [38811960068](https://github.com/tomoya41/baseball-notes/actions/runs/38811960068)は最初のDB readで `BLOCKED: SQL read operations are forbidden`。nf3取得0、DB write0。先のfreshness [38705013529](https://github.com/tomoya41/baseball-notes/actions/runs/38705013529)も同じserver error。単なるparser失敗や認証401とは異なる。課金/使用量のOwner管理画面を見ていないため、プラン上限・アカウント制約のどれかは未確定。大量retry、支払い、別アカウント利用なし。

PCにTurso credentialsはなく、本番SQLの最新readbackは未実施。最新Production integrity PASSとは扱わない。最後に確認されたPending6/partial5、stale、HOT/Ranking非公開を変えない。独立したstatic HistoricalのSQLite scratch readback/idempotency/全行検証と、公開payload不変検証を分けて扱う。

## 検証・Delivery

実行手順:

```powershell
npx tsx scripts/import-npb-historical-wikipedia.ts .data/npb-history-phase2/combined-archive.json .data/npb-history-phase2/v4
npx tsx scripts/verify-npb-historical-expansion.ts .data/npb-history-pilot/v3/npb-historical-wikipedia.json.gz .data/npb-history-phase2/v4/npb-historical-wikipedia.json.gz .data/npb-history-phase2/expansion-verification.json
npx tsx scripts/verify-npb-historical-publication.ts
```

Full tests / lint / typecheck / build / vercel-build、Android APK/unsigned AAB、Android36 Emulator、大文字Light/Dark、公開後検証の最終証拠はPRとActionsおよび本書のdelivery追記を参照。未実施をPASSにしない。

物理PixelはADB一覧に存在せず、新APK更新/実操作/TalkBackはNOT RUN。署名・Play/App LinksのOwner Gateはそのまま。実機操作票は `android-device-qa.md` / `android-physical-qa-results.md` を継続利用する。

次段階は残る73件のうち、独立した列定義が確認できる形式だけを小単位で回収する。さらに古い年度、全Career/球団年度成績/完全ランキングは今回の完了範囲外。
