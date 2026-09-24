# NPB実データ収集 第1弾（2026-09-24）

> 第6弾の前日全試合Fact手順・Day completeness・repair・Backup・失敗時対応は[日次運用手順](npb-day-operations.md)を参照。本稿の少数選手Collectorの説明は第1弾時点の履歴である。

## Source・範囲

NPB公式Webページは二次利用・無断転載の明示的禁止があるため取得・保存しない。使用するのは公開HTMLの[nf3順位表](https://nf3.sakura.ne.jp/Stats/Standing.htm)と球団別日程・選手別月間試合行。確認したページには明示的な機械取得/再利用禁止を見つけず、robots.txtは404だった。ただしnf3は公式APIではなく、作者が複数媒体から集計・再計算した二次Source。保存/公開の権利を法的に保証するものではない。利用条件変更時は`src/data/source-registry.ts`のstatusを無効化すればCollectorを停止できる。作者の[お知らせ](https://note.com/nulspo/n/n039a116e6dfc)では2028年1月24日の終了予定が記載されている。

2026年9月の実証では、順位表1ページ、12球団の当月日程、事前に氏名・背番号・チームを確認した阪神の打者2人/投手2人の月間ログ計4ページを取得した。通常17ページ/日を逐次取得、最低750ms間隔、最大2試行、15秒timeout、500KB/ページ上限。ユーザーの画面表示時にはnf3へアクセスしない。球団ページは`/php/stat_disp/stat_disp.php?y=0&leg={0|1}&mon={月}&tm={チームcode}&vst=all`、打者/投手ログは同じ公開ページに`fpnum`/`pcnum`を指定する。2026年の`y=0`のみ検証済み。ページ構造や年が変われば停止・再確認する。

## 流れとID

`scripts/collect-npb.ts` → `runNpbCollector` → nf3 Adapter Parser → Team/Player/Game正規化・Zod検証 → `NpbRepository` → SQLite/libSQL → 静的順位JSON → HomeのRepository。Source IDは`source_entity_mappings`へ置く。12球団は`npbTeams`でcanonical ID、正式日本語名、短縮名、所属リーグ、nf3 codeを明示的に対応させる。選手は名前推測で作らず、事前確認した4人だけを対象にし、ページ上の氏名/背番号を毎回照合する。内部playerIdは初回にUUIDを発行し、Source IDと別に保存する。名前正規化は照合用で、表示名を書き換えない。曖昧/未知の選手は未解決としてStage errorに残す。

Gameは日付・canonical home/away team ID・同日対戦順から内部IDを作り、Source側のチームcode入りrecord IDとは別に保存する。試合開始時刻の変更では別Gameを作らない。ダブルヘッダーは同日対戦順で区別する。選手Factの試合紐付けは日付と両チームを使い、複数候補があれば開始時刻で解決し、それでも曖昧なら保存を拒否する。日付＋チーム名だけを最終キーにしない。

## 品質・保持・訂正

順位はセ・パ6球団ずつ、rank、チームID一意、W/L/T非負、試合数合計、勝率0〜1、首位ゲーム差0を検証。首位の画面上の`-`は内部0へ変換し、表示Formatterで`—`にする。順位はsnapshot date×league×group×teamの主キーで毎日別行として永久保存し、休養日も同じ表を保存可能。現在順位と日付別順位をRepositoryから照会できる。nf3順位ページに過去as-of指定がないため、現在ページを過去日に使うBackfillは拒否する。過去日のRaw Captureがあれば`--offline-raw`から同じpipelineで再投入できる。

試合は`scheduled`/`final`/`postponed`を実Parserで確認。`canceled`/`suspended`はDomainの受け皿だけで、今回のHTMLパターンでは未検証。日程→結果は同一Gameをupsertし、訂正はcontent hashの差分で更新。異なる球団ページで同一Gameのscore/statusが矛盾したらStageを失敗にし、既存Gameを保つ。直近3日＋当日予定を再読込し、全シーズンを毎日は巡回しない。月境界では該当する2か月ページを取得する。前日の予定試合が未結果なら順位Snapshotは書かない。

打撃/投手は永久Factテーブルへupsertする。打撃PA/2B/3Bは未取得でnull、BBとHBPは詳細内訳と合計が一致した場合のみ数値化。投手の「四死」はBB/HBP内訳不明なので`walks=null`。IPのcanonical値は`outs recorded`で、`0.1`は1アウト、`0.2`は2アウト。選手ページの取得を4人に絞るため`batting`/`pitching` Stageは常に`partial`で、全選手取得済みとは表示しない。全選手ログを揃えるには取得件数/利用条件/別Sourceを改めて評価する。

Raw HTMLはgzipで`.data/raw/nf3/<対象日>/<URL hash>.html.gz`に最大14日保存し、`raw_response_manifest`で期限を管理する。`cleanupExpired`はこのRawと期限切れcache/derivedだけを消し、Factと順位履歴は消さない。これはローカル障害に対するバックアップではない。クラウド稼働前に無償上限、継続配信、オフマシンバックアップ/復元、Source権利のレビューが必要。

`ingestion_runs`は日付・開始/終了・件数・status・errorを記録し、`npb_ingestion_stages`はstandings/games/batting/pitchingを別に管理する。一部Sourceが失敗しても独立した正常Stageは保持する。Raw responseはDBへ巨大Textとして入れない。Sourceの更新時刻は提供されていないため`collectedAt`と`effectiveDate`を区別し、偽の`sourceUpdatedAt`を作らない。

## 実行と公開

2026-09-23実収集：17ページから順位12、対象windowの試合25、確認済み打者ログ8、投手ログ3。9月23日の6試合はfinal。2回目は保存済みRawからdry-runと再投入し、DB件数が増えないことを確認した。`public/data/standings/npb/latest.json`はローカル生成物でGit対象外。Homeは自前`StaticStandingsRepository`がこのJSONを検証して表示し、未生成なら未提供状態にする。Android同梱bundleやGitHub Actionsの実行結果を自動配信する経路はまだない。

`.github/workflows/daily-collector.yml`はUTC 18:37（JST 03:37）の予定枠のみ。`NPB_COLLECTOR_ENABLED=true`を設定するまでは起動しない。リモート永続DB、無料枠超過停止、バックアップ、生成JSONの公開先、Source条件の再確認を行ってから有効化する。Schedulerの遅延・休止があり、日次完全性を保証しないためIngestion Stageと履歴を監視する。
