# NPB Player「最近の成績」実データ接続

対象はcanonical Player IDのNPB選手ページ内「最近の成績」のみ。7日・14日・30日は選択基準日を含むJST暦日で、既存の`PlayerPeriodService`が保存済みGame Factsから読み取り時に再計算する。Career、Season、Analysis、HOT等は接続しない。実選手の一覧検索は今回の対象外なので、検証選手はcanonical URLで開く。

`src/server-recent.ts`の公開Read-only APIはVercel Free上で動作し、Tursoの読み取り専用トークンをサーバー環境変数`TURSO_DATABASE_URL`と`TURSO_AUTH_TOKEN`から取得する。クライアント・GitHub Pages・AndroidバンドルにDBトークンを入れない。APIはPlayer IDと期間だけを受け、Repository、Period Service、Coverage Repositoryの結果を検証済みJSONで返す。Vercel側の最新Standings Snapshotの日付を完了済み基準日とする。Sourceへはアクセスせず、FactやDerivedをDBへ書かない。Vercel APIは公開読み取り口なので、将来大量アクセスが問題になればレート制限または生成Payloadを検討する。

Web/AndroidのComposition Rootは公開API URLを`VITE_NPB_PLAYER_API_BASE_URL`で上書きでき、既定値は`https://baseball-notes-recent.vercel.app/`。これは公開URLでありSecretではない。通信失敗や不正JSONではRecentセクションにエラーを出し、架空データへ切り替えない。期間変更中はRecentのみSkeletonにし、同一画面で取得済みの期間は再利用する。Factなしは出場なしとして表示し、0 PA出場はG=1の実データとして扱う。

主要指標を先に、詳細を開閉で表示する。Metric Statusがunavailableなら`—`。Period Coverageがcompleteなら注記なし、unknownなら「収集済みデータから算出」、partialなら「一部データ未収集」、unavailableなら「収集状況を確認できません」と表示する。Coverageは率の数学的完全性と別。NPB投手のBB/HBP分離が未確認なのでWHIPは表示しない。基準日と実際のfrom/toはセクション単位で表示する。

公開APIの再デプロイは、Git管理外の`api/npb/recent.js`を`npm run vercel-build`で作成してから`vercel deploy --prod --yes`を実行する。Secret値をローカル引数やログへ出さない。生成JS、`.vercel/`、`.env.local`はGit対象外。GitHub Pagesは既存のDaily Workflowの`publish`モードで同じWebソースを再ビルド・配信でき、Collector定義を変更しない。Vercel API側とPages側は別配信なので両方の公開URLで確認する。

2026-09-25の実HTTP検証（asOf 2026-09-24）：中島大輔は7/14/30日ともG2、PA12、AB11、H2、BB1、AVG .182、OBP .250、SLG .182、OPS .432。上原健太は同期間ともG2、4 outs=IP1.1、BF6、H2、SO2、ER0、27球、ERA 0.00、K/9 13.5、WHIP unavailable。両選手のCoverageは古い日付の収集証明がないためunknown。これらの期間の数値が同じなのは保存Factが同じ2試合だからであり、期間を無理に差別化しない。

今後の制約：実選手の検索導線、完全なプロフィール、Season totals、端末オフライン表示は未実装。API不達時、同じページで既に表示した値は残せるが、新規選手を開くためのオフラインキャッシュはない。期間集計は1選手単位のRead-only計算で、全選手事前計算をしていない。
