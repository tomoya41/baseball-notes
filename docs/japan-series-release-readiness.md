# 2026 日本シリーズ・無料DB復旧準備

調査日 2026-10-20 JST。基準 PR #53 / main `2678401`。UIの全面再設計は行わない。

## 採用Sourceと許諾

条件B（出典・変更表示・継承付き利用）として、日本語Wikipediaの本文・日程テンプレートを採用。
[Wikimedia利用規約§7](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use)、各ページfooter、[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)、[API etiquette](https://www.mediawiki.org/wiki/API:Etiquette)を同日確認。
自動取得・保存・加工・Web/Android表示はこのライセンス範囲で行い、revision/執筆者リンクと変更内容を保持する。第三者の写真・ロゴ・引用先ニュース本文・NPBサイトのデータ再配布権へ拡張しない。

| 正式なWikipedia APIで取得した入力 | Revision / 時刻 UTC | Content SHA256 |
|---|---|---|
| [2026年の日本シリーズ / page 5306035](https://ja.wikipedia.org/w/index.php?curid=5306035&oldid=111450971) | 111450971 / 2026-10-20 09:54:31 | `9f8b1c68ad66c575d05767558ad3272b196d567e4941cbc3114aca46ec8ece85` |
| [Template:2026年の日本シリーズ / page 5307595](https://ja.wikipedia.org/w/index.php?curid=5307595&oldid=111415411) | 111415411 / 2026-10-17 09:06:54 | `63ffaa714cf251ef7a892e6e2404b8069f8f18353b420d6d4a70601c137f71a7` |

Source取得は順次2 API requests、User-Agent/contact・maxlag・private cache付き。最初の応答約13KB、次の応答約2KB。追加記事・メディア本文・画像は取得しない。
日程は本文へのtransclusionなので、テンプレートも独立revision/hashで固定する。NPB公式は[開催要項](https://npb.jp/nippons/2026/information.html)の独立照合・閲覧導線に限定し、providerをWikipediaと偽装して公式データを取り込まない。

## 開幕前の採用範囲

DeNA対ソフトバンク、10/24・25・27・28・29・31・11/1の第1–7戦と明示的な主催・球場。
日程表のrowspanはその範囲だけ引き継ぎ、欠損球場を推測しない。開始時刻は今回のWikipedia表にないためnull。
第5戦以降は4勝先取に応じた開催条件を明示し、追加試合・順延日を生成しない。
元記事の開幕前LinescoreにはRR/HR/H/Eの0があるが、予定表の「-」と終了証拠不足を確認し、スコア・勝者・個人成績には採用しない。

新規sidecarは7予定試合 / 結果0 / Player Stats unavailable、Coverage partial。予定の収録と結果・全選手の完全性は別。
4勝先取、CSアドバンテージ加算なし。結果用Contractはイニング合計・終了証拠・観測日時と勝敗数の検証を持つが、今回のadapterは開幕前の確認済み日程専用。
結果の掲載された新版をこのadapterへ渡すと停止する。開幕後の結果・選手成績は別途、明示的な終了証拠・identity・算術を確認してimmutable新版へ追加する。予定を試合終了・0成績・出場なしへ自動変換しない。
閲覧時点が取得日を過ぎても当日の実況や開催確認とは表示せず、取得時点・未収録状態を示す。

Series IDは既存factoryのpage 5306035 / japan_series。Game IDは`baseball-notes:npb:japan-series:v1:2026:5306035:<第n戦>`のSHA256先頭20桁。
日付・球場・revision・勝者では再採番しない。既存CS・Regular・MLB IDは不変。
球団の正式記事リンク・日程表の明示的チームと、既存の独立したCS Final勝者2球団を照合する。Player identity追加0、名前一致merge 0。

## リリースとロールバック

新しいimmutable `npb-japan-series-wikipedia-20261020-v1` は3,526 bytes JSON / 1,196 bytes gzip、1 public file。既存CS v1–v4、CS series v1、NPB Current/Historical、MLB 2014–2025は上書きしない。
先行PRでschema/parser/staging・inactive pinを配信し、HTTP hash readback後にUIを有効化する。Androidは公開済みの同一hashだけを読む。
Home追加fetch 0、全選手Profileの追加fetch 0。日本シリーズ画面はbounded sidecarのみ（CS進出検証が必要なHubは既存seriesも取得）。
ロールバックはUI/pinのrevert。公開済みassetは残し、既存APKのURLを壊さない。Raw wikitextはprivate `.data`、公開するのは必要な予定aggregateのみ。

UIはCS Hub→日本シリーズ→各試合予定へ接続。Searchのシリーズ・試合にも追加し、Japan Seriesのstage付きURL、Back、Reload、Activityを維持する。
CSと日本シリーズのSourceエラーは分離し、追加Source失敗時も既存CSを隠さない。未開催用の勝敗0–0をメイン画面に出さず「取得時点で開幕前」「結果未収録」と表示する。
360px実画面で、日程行の状態文が細い列に過度に折り返す問題を確認し、行は「第n戦・予定」、全体と詳細画面で結果未収録を説明する構成へ整理した。

再生成はネットワークもDBも使わない：
```powershell
npx tsx scripts/build-npb-japan-series.ts --archive=.data/japan-series/archive.json --cs=dist/data/npb/competitions/9dc4b97286fac0c1976c6d7c58ff69db428571045804e1688d894ee91e1aa0a4/series-2026.json --output=.data/japan-series/replay
```

## Turso復旧を確認する順序

前回Owner Console：Free、561,729,860 / 500,000,000 rows read。10/20 Scheduledもread-blocked。リセット日時・復旧を推測しない。
今回新規DB要求0、canonical write 0。既存SQLのscratch回帰と静的配信を継続する。

1. Owner Consoleで実際の使用量・リセット状況を確認する。トークン・個人情報は記録しない。
2. `NPB bounded recovery readiness`の既定connection modeで`SELECT 1`を1回だけ。失敗したら停止し、大きな診断へ進まない。
3. Free残量1億行以上（使用4億行以下）を24時間以内に確認できた場合だけprojection mode。owner値は手動attestationであり、provider計測やScheduled成功の代わりではない。
4. 実際のGame IndexとCalendar queryを、最大8 SELECT・戻り1万行/要求・retry 0のread-only wrapperで実行。SQL hash・返却行数・時間のみをprivate artifactへ記録する。表内容・認証情報は出力しない。
5. clientは走査行数を公開しないため、返却行数を課金read量とみなさない。Console Analyticsの前後差・対象queryを確認し、改善前の19.28M / 6.10M / 3.35M平均readと独立に比較する。
6. 小さな確認が安全なら、完全Integrity Auditを1回。次いで実Scheduled収集→完了callback→暗号化Backup→独立scratch restore→公開整合性を既存手順で確認する。
7. HOT/Rankingはこのreadiness結果では開かない。Freshness・Coverage・sample・metadata・identity・Scheduled・Backupの全Gateを個別に満たす必要がある。

既存period-batch workflowも既定をconnection-onlyへ変更し、明示的full modeでも最初にprobeを要求する。Collector/Gateの意味は変更しない。
新readiness workflowにschedule・書込み・公開callback・新Secretsはない。既知のblocked中は実行を増やさない。
実行中HTTP要求にも共有30秒deadlineを適用し、AbortSignalとclient closeで中断する。並行要求の一つが失敗しても、残った要求へのdeadlineは解除しない。サーバー内部の処理・課金走査を完全に取り消せる保証ではなく、継続試行や「readable」誤判定を防ぐ上限である。

## 再超過の防止と限界

- 相関Fact走査をGROUP BY一括集計へ置換済み。SELECT-only guardは維持。schema/index変更なし。
- 公開API7本は30秒cache/同時query集約/明示的block時30秒circuit。これはwarm instance単位で、全instanceのquota上限を保証しない。
- NPB Historical/CS/日本シリーズ/選手イベントとMLB Historicalは静的配信。Home追加fetch 0を維持し、診断のために全選手を個別取得しない。
- 高負荷診断をcronへ追加しない。再実行前に前回run/SHAを確認。通常の監視を停止したり、失敗を正常化して費用削減の証拠を作らない。
- 月間read予算は400M以下を運用目標、100Mを余裕として残す。1回の走査量×定期実行回数×日数をConsole実測で評価する。返却件数やlocal速度だけから達成を宣言しない。
- [公式料金](https://turso.tech/pricing)は2026-10-20再確認：Free $0/月、500M rows read。プラン・Overages設定は変更しない。
- Consoleのリセット日・複数instanceの総read量・無料枠復旧後のproduction効果は未確認。課金・別アカウント回避・有料fallbackを行わない。

Pixel/TalkBackは接続環境がある場合だけ別QA。署名・保存データ削除・Play公開は行わない。追加月額費用¥0。
