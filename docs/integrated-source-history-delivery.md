# Integrated Source / Historical Delivery

基準main：`20d0e6084faa5c543ea1b467726a7b5a21794211`。確認日：2026-10-10。無料運用、既存NPB Source・canonical・Production Gateを維持する。

## NPB Source / daily readiness

[API audit](npb-free-api-validation-2026-10.md)に公式資料、操作別rights、12回の少量developer API検証を記録した。TheSportsDBはTECHNICAL_ONLY（日別3件・Season15件、Androidストア公開には有料subscriberが必要、長期保存/public JSON権限未確定）。API-BaseballとAPI4Sportsは無料NPB範囲不明・BLOCKED_CREDENTIALS。新規登録、trial、契約、Source切替、collector/Secret追加は行わない。

`source-readiness.ts`の証拠contractと純粋な日次assessmentを追加。JST、再取得、partial、identity不足、Source conflict、correction、retry budget、staleをfixturesで検証する。正式Source専用shadow modeは未導入。NPB 2026 CS Finalの条件付き2勝advantageは[公式規定](https://npb.jp/games/2026/info_cs.html)に基づく準備用rule fixtureのみ。本番series/Competition Gateは変更しない。

## MLB 2016–2019追加

既存Retrosheet公式processed CSVと固定済みChadwick Registerを利用する。既存[rights evidence](mlb-source-rights-2026-09-27.md)とRetrosheet指定credit / Chadwick ODC-BYを維持。新しいSource・Statcast・Current API・画像は追加しない。

| 年 | Regular Games | Batting Facts | Pitching Facts | Regular PA | Postseason Games | Postseason PA |
|---|---:|---:|---:|---:|---:|---:|
| 2016 | 2,428 | 70,451 | 20,159 | 184,580 | 35 | 2,587 |
| 2017 | 2,430 | 70,743 | 20,517 | 185,295 | 38 | 2,825 |
| 2018 | 2,431 | 71,590 | 21,197 | 185,139 | 33 | 2,570 |
| 2019 | 2,429 | 71,685 | 21,429 | 186,517 | 37 | 2,792 |
| 追加合計 | 9,718 | 284,469 | 83,302 | 741,531 | 143 | 10,774 |

Postseason追加Batting Facts 4,486 / Pitching Facts 1,398 / Series 36。全10年Regular：22,764 Games、3,781 Players、1,721,386 PA。Postseason：404 Games、1,290 Players、30,545 PA。全追加年/scopeのidentity unresolved、parse failures、skipped games、Game Fact/PA mismatch、state issueは0。再import canonical writesは両scopeとも0。

2018年の2試合のGame 163はRetrosheet `playoff`種別だがRegular Season決着試合として扱う（64 Batting、22 Pitching、137 PA）。[MLB公式tiebreaker history](https://www.mlb.com/news/history-of-mlb-tiebreaker-games-c202246862)と公式CSVを照合。2016–2019 Wild Cardは1試合制、全9 Series/年。[MLB postseason format](https://www.mlb.com/news/mlb-playoff-format-faq)を参照し、2020/2022以降のformatとは分離する。

## 検証と既存データ保全

追加8年/scopeのPlayer Season集計を公式CSVの独立sumとcanonical bridgeで照合した。名前によるmergeはしない。既存6年はlocal DBのGame/PA hash、mapping、releaseと公開Profile既存Facts/totalsの一致を検証した。既存PAのlocal検証報告は、内容hashが一致する過去の全件検証を再利用している。公開生成は全10年のPA集計を再照合する。

OS/zlibの差で同一JSONのgzip bytesが変わること、同名選手のSeason行順序が変わることを確認した。`preserve-verified-mlb-baseline.ts`は全既存immutable payloadのdecoded完全一致を先に確認し、その後にのみ旧bytesを再利用する。Season行だけは一意なcanonical Player IDで順序正規化する。値、null、identity、行数が変われば公開前に停止する。Recentは旧Game bytesからfingerprintを生成し、月別projection/indexも同じ内容の場合のみ旧bytesを維持する。内容変更を圧縮差として隠さない。

Year Recordsはimmutable。収録期間/年代Recordsは意図的な追加集計で、広告する年度とSeason Factsから再計算した結果を両scopeで検証する。Regular単独releaseでPostseasonの集計やmanifestを変更しない。年度selectorは実際のscope manifestに従う。新しい年をUIの固定値だけで公開扱いにしない。

## Productと公開境界

Search、Profile、Game Log、Season/Recent Explorer、Compare、収録済みシーズン履歴、MATCHUP/BvP、Situational、Season Milestones、Year Rankings/Recordsを実際のmanifestへ接続する。Recordsは単年・2016–2025収録期間合計・2010年代/2020年代収録分のcountingのみ。Career、all-time、公式通算ではない。Rate qualificationの意味は維持する。

年齢を比較するためのverified birthDateは既存MLB Historical masterにないため、同年齢Season比較を実装しない。2010–2015は今回追加しない。次の年代追加は同じ完全性・容量・運用時間gateを通す。

最終local preservation：25,393 immutable payloadのSHA一致、3,834 Profileの既存identity/Facts/Season totals一致、6 Postseason Hubの意味一致。新規込みpayloadは52,985 files / 228,996,360 compressed bytes、最大269,712 bytes。1,094 tests（92 files）、lint、typecheck、Web/Vercel build PASS。公開CI/HTTPの結果はPR/Run evidenceを参照する。

公開はSeason/Player/Game/advanced aggregate/Recent月別にpartition。PA raw rows、event dump、Chadwick full dump、SQLite DBはPagesへ出さない。Home追加fetchは0。全年Profileの総当たり取得はしない。

## 実測（local、Windows / OneDrive）

追加4 ZIPは4 HTTP downloads、40,284,242 compressed bytes。既存6年とChadwickはcache再利用。全10年cache抽出量1,284,603,677 bytes。

Regular DB：913,920,000 → 1,535,451,136 bytes。Postseason DB：19,386,368 → 29,192,192 bytes。これは隔離したlocal/release DBで、Tursoへの新規canonical writeは0。Regular game import 296.7秒、CSV parse 36.8秒。初回PA/advanced生成は端末負荷依存。advanced全10年生成は34分26秒、22 SELECT、DB write 0。batch aggregateの不適切なopponent index走査を除き、temporary sortをmemoryにする。個別BvP用既存indexは維持する。

代表Ohtani–Valdez（収録期間）：48 PA、39 AB、5 H、1 HR、8 BB、12 SO。SQL read 1.14ms、合計2.62ms、334 bytes。打者相手一覧108.96ms、投手相手一覧65.38ms、outs split74.11ms。rows scannedは取得不能。Linux CIの時間・最終artifact量・公開結果はDelivery時のRunで確認する。

Regular/Postseason portable backupとscratch restore、代表PAの一致をlocalで検証した。combined NPB remote backupは公開workflowの既存暗号化経路で検証する。個別SQLiteは本番Tursoへ移さない。Android debug APK/unsigned release AABはCIで検証する。実機/TalkBack/署名/Production Pushは別manual QA。

## Review / Release

PR #19の指摘：scopeをまたぐ未監査Records生成、集計periodのimmutable hash対象誤り、未公開年selector、古い運用文書。scope別生成、両scope再計算検証、Year hash保全と期間aggregate検証の分離、manifest年度selector、README/decision更新で対応する。

再レビューでTeam/chronology生成前の保全順序と年代Recordsリンクの範囲変更も修正した。derived生成 → decoded比較/旧bytes再利用 → Recent生成の順をworkflow testで固定。年代Recordsの選手は同じ年度・competition・role・metricのSeason Compareへ開き、全収録期間合計へ黙って変更しない。

P1/P2、rights不明、データ差分、公開不整合が残ればmerge/publishしない。NPB APIの認証/権利保留は独立したMLB公開を止めない。ReleaseはPR review、Web/Android CI、coordinated expansion publish、HTTP contract/hashと360px Light/Dark smokeの順で行う。
