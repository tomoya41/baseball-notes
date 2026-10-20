# 2026年ドラフト特集 / 開催前snapshotと確認済み結果

2026-10-21確認。追加月額¥0、DB要求・write 0。既存のNPB Current/Historical、CS、日本シリーズ、MLB、Facts、Gate、canonical Player identityは変更しない。

## Source / rights

- Wikipedia「[2026年度新人選手選択会議 (日本プロ野球)](https://ja.wikipedia.org/w/index.php?curid=5282993&oldid=111388948)」と「[2026年の野球日本代表](https://ja.wikipedia.org/w/index.php?curid=5209342&oldid=111304047)」。公開[利用規約§7](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use/ja)・[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)を確認。**B：条件付き採用**。正規APIによる取得、private archive保存、正規化、Web/Android表示と必要な派生JSON再配布は、執筆者へのrevisionリンク・ライセンス・変更表示・ShareAlikeを保持する。このdataset（独自案を含む）はCC BY-SA 4.0。アプリコードのライセンスとは別。
- [API etiquette](https://www.mediawiki.org/wiki/API:Etiquette)：連絡先User-Agent、maxlag=5、順次取得、private cache、上限500KB、retryなし。初回1要求は対象会議＋大会を調査（1タイトルmissing）、追加1要求で代表記事を取得。追加1要求で2025年会議記事を表形式の参考としてprivate取得（page 5129630 / revision 111214102、17,236文字）。116行を解析照合したがProductionへの取り込みは0。公開採用は上の2記事だけ。取得本文はprivate `.data`、Git/publicには入れない。revision/hashは`src/data/npb-draft-2026-sources.json`で固定。
- 大学代表表から明示的に4年生の18人だけを抽出。名簿は大会当時の所属・守備位置・投打の証拠であり、**プロ志望届、指名資格、現在所属や球団評価の証拠ではない**。高校の本塁打記録や未対応ページは候補認定に転用しない。
- 16:50の開始予定はユーザー提供の開催情報を[公式開催要項](https://draft.npb.jp/draft/2026/)で独立確認した最小限の日時metadata。NPB公式は閲覧導線に限り、結果表・記事・画像の自動取得や再配布は行わない。公式footerの二次利用制限を拡張解釈しない。
- 報道・各メディア予想：転載の根拠を確認できないため本文/予想表の取り込みはしない。アプリに載せるのは外部閲覧リンクのみ。独自案は報道予想の要約・再編集ではない。個々の球団の補強不足・獲得意向・競合確率を事実として主張しない。

## 予想とidentity

12球団に各1人の**独自1位候補案**。代表での守備位置・投打という明示的な情報から、ポジションを優先する編集上の仮説を提示する。球団取材やスカウティング、全候補の順位付け、確率モデルではない。志望届未確認のため、対象者が指名対象にならない可能性もある。

会議前の`2026-premeeting-v1` / createdAt / author / 12案を固定。公開pinはforecast hashも検証する。結果更新時にこの版を変更しない。結果と比べるのは**最終的な支配下1位指名との一致/相違**であり、最初の入札や抽選の的中率ではない。結果未収録は「答え合わせ待ち」。育成1位を支配下1位に混ぜない。

候補IDは`npb:draft:2026:` namespace。記事リンク先＋大会時所属の組をhash化。所属表記だけが違う同名/同記事の答え合わせは「照合確認中」であり、不一致と断定しない。名前だけのNPB canonical UUID照合・Current Player作成・入団認定はしない。所属表記が異なれば自動mergeせず別候補として保留できる。既存選手への橋渡しは将来、独立IDを確認する別のreviewで行う。

## 当日の更新手順（自動速報ではない）

1. `npx tsx scripts/fetch-npb-draft-candidate.ts --output=.data/draft-2026/new-archive.json`で同じ2記事を正規APIの1要求・最大500KB・retry 0でprivate保存。既存ファイルがあれば通信0でcacheを使い、明示的な`--refresh`のみ再取得する。候補取得であり、registryのadmissionや本番公開は行わない。revision/timestamp/hash/差分を人が確認してSource registryへ追加・固定する。元記事の結果掲載を公式発表直接確認と表現しない。
2. private review JSONにreviewedBy、reviewedAt、eventState、eventProof、selections、lotteriesを作成する。現在のadapterは**1行に球団・順位・記事リンク付き選手・所属・支配下/育成が独立した5セル**を持つ表と、2025年実表で確認した**球団見出し＋新人/育成区分＋順位/選手名/守備/所属/結果の5列**を対象とする。後者はproof.mode=`team_table`、proof.rowに`!1位`と次の選手行の2行を指定する。球団・大会区分・正確なヘッダーを独立に検証する。チームが列見出しだけのmatrix、rowspan、曖昧な氏名は未対応として止める。実際の当日表が別形式ならその形式のfixtureとadapterを先にreviewし、無理に正規化しない。
3. 開始・終了の明示的な過去形の1行をeventProofにする。「終了した後に開催予定」や予定日時から開催中・終了を作らない。抽選は実際の候補・参加球団・回次・当選を示す独立行が必要。未確認の当選はnull。
4. offlineで実行する：
   ```powershell
   npx tsx scripts/build-npb-draft.ts --archive=.data/draft-2026/new-archive.json --output=.data/draft-2026/v2 --review=.data/draft-2026/review.json --previous=.data/draft-2026/build/draft-2026.json --review-confirmed --tag=npb-draft-2026-20261022-v2
   ```
   取得・DB接続は0。Source行の完全一致、cellごとの対応、candidate identity、duplicate、時刻、支配下/育成分離、forecast不変を検証。既存結果の変更・削除は停止し、別の訂正reviewに分ける。
5. 新JSON/gzipの値・件数・identity・出典を確認。新しいimmutable Releaseを作り、旧pinを`npb-draft-retained-releases.json`へ追加して新pinへ切り替える。既存assetは上書きしない。全tests/build/review後、DBを読まない`preserve_published_only=true`でPages公開し、旧/新hashと画面をreadbackする。

review JSONの行（**架空fixture形式**、実データに使わない）:
```json
{"reviewedBy":"reviewer","reviewedAt":"2026-10-22T08:00:00Z","eventState":"in_progress","eventProof":{"pageId":5282993,"row":"2026年10月22日にドラフト会議を開始した。"},"selections":[{"teamId":"npb:team:tigers","type":"regular","round":1,"name":"架空一","article":"架空一","affiliation":"架空大学","proof":{"pageId":5282993,"row":"|阪神タイガース||1位||[[架空一]]||架空大学||支配下"}}],"lotteries":[]}
```

開催前・確認中・記事で開催中/終了確認を区別し、各指名行は確認済みだけを公開する。Coverageはunavailable/partialのみ。全件完了の独立した母集団証拠がないためcompleteは実装しない。時計だけで結果や開催状態を更新せず、最終確認時刻を表示する。会議後も古いsnapshotは「取得時点で開催前」のまま、リアルタイムを保証しない。

## 配信・rollback

初版は18候補 / 12独自案 / 指名0 / 抽選0、10,405 bytes JSON / 2,946 bytes gzip、1ファイル。Home追加fetch 0。特集のlazy routeだけで1回、SHA/size/schema確認後に既存offline response cacheへ保存。候補の個別Profile fetchは0。
先にinactive data/stagingを公開し、HTTP hash確認後に画面を公開する。rollbackはUI/pinのrevert、immutable assetは保持。既存Draft/Youngのqueryは維持。Physical Pixel/TalkBackと署名/Play Gateは独立し、未実施をPASSにしない。
