# ドラフト結果更新・日本シリーズ開幕準備

確認日：2026-10-21 JST。基準 main `3fba40a`。追加月額¥0、canonical DB requests/writes 0。

## 実データとSource

- [ドラフト公式開催要項](https://draft.npb.jp/draft/2026/)は10/22 16:50開始予定。10/21のWikipedia候補取得も開催予定を記載。結果・抽選の公開追加は0。会議前の12独自案、18人の大学代表名簿、志望届未確認の区別を維持する。
- [日本シリーズ公式開催要項](https://npb.jp/nippons/2026/information.html)は10/24開幕予定。Wikipedia本文・日程テンプレートには7予定試合と空欄のLinescoreがある。公開は従来の7予定 / 結果0 / 個人成績未収録のまま。開始時刻は採用済みWikipedia日程表にないためnullのまま。公式サイトから結果表・選手成績を取り込まない。
- 許可済みWikipediaのみ正規APIで各1回（計2 requests）、maxlag=5、User-Agent/contact、500KB/30秒、retry 0でprivate候補を取得。ドラフト page 5282993 revision **111459419**、代表名簿 page 5209342 revision **111304047**。日本シリーズ page 5306035 revision **111459627**、日程template page 5307595 revision **111415411**。新revisionは調査候補で、公開registry/pinへ自動採用しない。Rawは`.data/opening-readiness/`のみ。
- [Wikimedia利用規約§7](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use/ja) / [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) / [API etiquette](https://www.mediawiki.org/wiki/API:Etiquette)を同日再確認。従来の条件Bを維持し、revision/執筆者・license・変更表示・ShareAlikeを保持する。引用先メディア本文、写真、球団ロゴやNPB公式の転載許可に拡張しない。アプリコードのライセンスは別。

## ドラフト：会議前に完了できる範囲

既存の厳格な表parser、明示的な過去形・日付の開催証拠、確認者/確認時刻、支配下/育成・抽選の分離を再利用する。新しい公開提案には**現在のpinのbody SHAに一致するprevious JSON**が必要。保存済みforecastのhashを独立に検証し、公開済みtagの異なる内容での再利用を拒否する。出力はprivate `.data`内だけ。

`build-npb-draft.ts`は`review-report.json`も生成する。追加candidate/指名/抽選差分と12球団の答え合わせを確認する。画面の「選択理由・答え合わせ」には保存案と実際の支配下1位を名前・所属付きで並べる。育成1位は使わず、同名/同記事で所属表記が異なる場合は「照合確認中」。元の独自案は変更しない。

Source改版のadmission確認→既存のprivate review作成→`--previous=現在pinと一致するJSON --review-confirmed`付きbuild→差分確認→新immutable release/pin→旧pin retained→tests/review→preserve-only Pages→旧/新HTTP hash確認。この順序を維持する。詳細なreview形式は[既存手順](npb-draft-2026.md)。報道転載や自動速報・自動main mergeは導入しない。

## 日本シリーズ：結果更新と試合詳細

日程専用の旧モードは維持する。結果付き更新には、改版のrevision/hash admissionと、private reviewの**原記事に一意に存在する完全なLinescore block**が必須。

- Game ID/第n戦/球団を既存予定と照合。日付、独立した試合時間、日程表のスコア、連続した各回得点、合計を照合し、予定テンプレートの0や空欄から終了を作らない。
- `X`（攻撃なし）と`1x`等（サヨナラ）を区別して保持。整数得点はアウト数の証拠ではないため、投球アウト数やPlayer Factsを生成しない。
- [公式要項](https://npb.jp/nippons/2026/information.html)の第1–7戦は延長12回・引分け、4勝先取を検証規則として参照。CS advantageは0。引分けは勝数に加算せず、4勝後の追加finalを拒否する。第8戦以降や順延・中止の表形式は別のsource/fixtureレビュー待ちで、予定から自動生成しない。
- 前snapshotのfinal、完了証拠、canonical Game ID/対戦球団を変更・削除する更新を拒否する。訂正は別のreview/migration。
- 試合詳細は収録結果が存在する時だけ3列のイニング別得点と試合時間を表示する。360pxで横表を広げず、Xを0として見せない。結果がない現在の公開画面にはこの表を出さない。個人成績は独立したidentity/表の検証待ちで、現在は未収録と表示する。

取得（private候補のみ）：
```powershell
npx tsx scripts/fetch-npb-japan-candidate.ts --output=.data/japan-series/new-archive.json
```
既存ファイルがあれば通信0、明示的`--refresh`だけ再取得。revision/hash/rights/本文差分を確認するまでSource registryを更新しない。

結果build（**開催後に証拠が揃った場合だけ**）：
```powershell
npx tsx scripts/build-npb-japan-series.ts --archive=.data/japan-series/new-archive.json --cs=<現在pinのseries-2026.json> --output=.data/japan-series/new-version --review=.data/japan-series/review.json --previous=<現在pinのjapan-series-2026.json> --review-confirmed --tag=npb-japan-series-wikipedia-20261024-v2
```
private reviewは`reviewedBy`、取得後かつbuild以前の`reviewedAt`、`games:[{gameId,linescore}]`。`linescore`は原記事の完全一致block。出力JSON/gzipとproposed pinはprivateのままで、自動commit/upload/promotionはしない。全結果を再検証してpreviousと比較する。

新pinへ進む際は旧pinを`npb-japan-series-retained-releases.json`へ必ず追加。stagingと公開guardは旧assetも保持・hash確認し、旧APKの固定URLとrollbackを保つ。今回は新release/pin/公開payload変更0。

## Turso：復旧待ちを正確に管理

最新の実Scheduled [Calendar sync 39547617321](https://github.com/tomoya41/baseball-notes/actions/runs/39547617321)（10/21 05:05 UTC）も`SQL read operations are forbidden`。既存処理の1 readで停止、Source HTTP 0 / DB writes 0。runner開始はcron予定より約279分遅延。このログを接続成功・通常スキップ・Scheduled Fact成功に読み替えない。利用枠のreset/現在使用量は未確認。本バッチから追加probe/DB診断は実行しない。

復旧後は[既存手順](japan-series-release-readiness.md#turso復旧を確認する順序)どおり、手動connection-onlyの`SELECT 1`一回→Free残量100M以上を24時間以内のConsole値で確認→最大8 SELECT / 1万返却行 / 合計30秒 / retry 0のprojection。返却行数は課金走査行数ではない。Consoleの前後差とquery hash・キャッシュhit/同時集約を照合し、総read予算400M以下を評価する。scratch速度や30秒instance cacheだけで無料枠内を保証しない。

その後の実Scheduled収集、callback、暗号化Backup、独立restore、Coverage/Freshness/sample/metadata/identityのGateは別々の証拠が必要。repair・静的配信成功・readiness成功でHOT/Rankingを開かない。

## 検証・公開と残件

新しい結果の試験は明示的な架空fixtureのみ。未来日時、試合/Source不一致、X/サヨナラ/12回引分け、空欄・0、終了証拠不足、差分・再投入、forecast不変、UI結果比較、Current/CS/Regular分離を検証する。既存の公開23ファイル（Draftも含む）をbaselineとしてhash保護する。

全tests/lint/typecheck/Web/Vercel/Android packaging・エミュレーター・公開HTTPと実画面の証拠はdelivery PRに記録する。Pixel未接続なら物理QA/TalkBackはNOT RUN。Source不足、Turso、署名/Play Owner Gateを独立管理する。UI全面改修、source権利拡張、canonical DB write、課金は行わない。
