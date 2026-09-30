# 日本語表示名 — 2026-09-30

対象はMLB Historicalの表示層。NPBの既存漢字・カタカナ表示、canonical ID、元の名前、保存Fact、順位・Coverage・Gateは変更しない。

- MLB全30球団を日本語表示。
- 2020〜2025収録の日本人選手23人を漢字表示（ダルビッシュ有を含む）。筒香嘉智のSource表示 `Yoshi Tsutsugo`、加藤豪将も含む。
- 選手全2,840人中2,577人の日本語表示名を収録。外国人はカタカナ。
- 未確認263人は原名を維持。そのうち19人はWikidataのIDとRegister側のWikidata IDの相違を検出し自動採用しない。これは表示名の参照不一致であり、canonical identityやFactの変更ではない。
- 日本語名と英字原名でSearch/BvP検索可能。大文字小文字、アクセント、空白、中黒を吸収。
- Profile、Game Detail、Records、My、BvPへ共通適用。成績・順位の並び・Favorite保存Keyは変わらない。

## 根拠・利用条件

参照日: 2026-09-30。

- [Wikidata Licensing](https://www.wikidata.org/wiki/Wikidata:Licensing): main namespaceの構造化データをCC0として利用。日本語labelのみ使用し、Wikipedia本文・写真等は取得しない。加工・公開利用可。アプリのData SourcesでCC0と出典を表示。
- [Wikidata Data access](https://www.wikidata.org/wiki/Wikidata:Data_access): 公開Query Serviceを明示更新時に1回利用しローカルcacheから生成。識別可能なUser-Agent、50秒timeout。通常表示やDaily処理では外部アクセス追加0。
- [Retrosheet person ID — P6976](https://www.wikidata.org/wiki/Property:P6976)、[MLB.com player ID — P3541](https://www.wikidata.org/wiki/Property:P3541): 採用済みChadwick Registerのexact IDに照合。名前検索からidentityを作らない。RegisterにQ IDがある場合も一致を要求。
- 日本人・一部主要選手の慣用表記はeditorial override。各表示名は既存canonical IDへ固定。[MLB Japan 日本人選手](https://www.mlb.com/ja/news/active-japanese-mlb-players)等を確認資料とし、Current成績を収集しない。
- sourceごとのevidenceを `src/data/mlb-japanese-names.json` に記録。Raw IDはUIへ公開しない。
- 慣用表記の追加確認: [ピート・アロンソ](https://www.mlb.com/ja/news/pete-alonso-sets-mets-all-time-home-run-record)、[ジュニア・カミネロ](https://www.mlb.com/ja/news/junior-caminero-2025-home-run-derby)、[DJ・ルメイヒュー](https://www.mlb.com/ja/player/dj-lemahieu-518934)、[エウヘニオ・スアレス](https://www.mlb.com/ja/player/eugenio-suarez-553993)。表示名のみ参照し、成績は取得しない。

## 明示更新

既存importの `.data/chadwick-register.zip` と `.data/mlb-public/data/mlb/historical/{manifest,players/index}.json` が必要。

```powershell
npx tsx scripts/update-mlb-japanese-names.ts --fetch > .data/mlb-japanese-names-report.json
```

ネット取得なしの再生成は `--fetch` を外す。生成したreference registryは差分をreviewしてcommitする。通常のData collectorには接続しない。日付・件数のdocsは更新時に実値へ追従させる。外部API不調・参照不一致でも原名が表示できる。自動音写で未確認の読みを作らない。

公開は既存MLB Historical workflowの `app-only` を使い、検証済みデータを維持したままアプリを更新する。Scheduled証拠やInfrastructure判定には使用しない。

## 検証

- 全433 tests / lint / typecheck / build / Vercel build PASS。
- 360pxで漢字検索 `大谷` と英語検索 `SHOHEI OHTANI` が同じcanonical Profileに到達。大谷翔平の55HR・727PA、BvP対フランバー・バルデス39PA/4H/1HR/AVG .125を維持。
- ページ幅345px（viewport 360px、scrollbarを除く）に対しscrollWidth345px。横方向のページoverflowなし。
- 名前辞書を含むMLB画面をlazy load。NPB側の初回main chunkは163.13KB gzip（変更前174.58KB）。MLB chunkは140.80KB gzip。読み込み中は既存Loading Skeleton。
- 通常表示でWikidata request追加0、DB write0。既存Favoritesのcanonical Key・NPB Facts・Coverage・HOT/Ranking/Infrastructure Gate変更0。
- Pages `app-only` [Run 36676324181](https://github.com/tomoya41/baseball-notes/actions/runs/36676324181) 成功（code `793ac23`、1分45秒）。全433 testsもCIでPASS。既存Historical公開データを維持し再importなし。
- 公開readbackは12 HTTPすべて200。大谷翔平の対フランバー・バルデス39PA等の集計値、2020〜2025のRate Gate、2026 Current unavailableを維持。NPB Recordsも公開不可の既存表示を維持。手動公開をScheduled証拠へ代用しない。
