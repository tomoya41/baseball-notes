# NPB第3弾：別試合のEdge Case検証

2026-09-24に、[第2弾の完了ゲート](npb-game-proof.md)を2026-09-23の**福岡ソフトバンク10–3埼玉西武**（ソフトバンクがホーム、内部ID `npb:game:7625951a1eb2412e96c1`）へ適用した。nf3の実打席行で柳町達の「左２」、平沢大河の「右２」を事前確認でき、代打・0打数・複数救援投手も含むため選んだ。Sourceは従来のnf3だけ。公開ページの取得・再利用について包括許諾が確認されたわけではなく、[Source利用条件と停止条件](data-sources.md)を維持する。

手動コマンドは `npm run collector:npb:game -- --target=edge --fetch --dry-run` → `--fetch` → `--offline-raw` → `--verify-only`。GitHub Actionsの手動Workflowも`target=edge`を選び、dry-runの成功後だけingestする。`baseline`は第2弾の試合のまま。どちらも固定ID・日付・両軍・最終スコアを照合し、日次Collectorに組み込まない。

## 検証結果

| 項目 | ソフトバンク | 西武 |
|---|---:|---:|
| 打者 expected / collected / mapped | 13 / 13 / 13 | 14 / 14 / 14 |
| 投手 expected / collected / mapped | 4 / 4 / 4 | 4 / 4 / 4 |
| PA / 相手投手BF | 42 / 42 | 36 / 36 |
| AB / H / 2B / 3B / HR | 40 / 16 / 3 / 0 / 3 | 33 / 6 / 4 / 0 / 1 |
| 選手別R合計 / 最終スコア | 10 / 10 | 3 / 3 |
| 自軍投手outs / 被安打 / 失点 | 27 / 6 / 3 | 24 / 16 / 10 |

両チームの打撃・投手・Game completenessはすべて`complete`。先発打者は各9人で、途中出場者9人も元の1～9番枠へ対応付けた。西武・岸潤一郎は**0打数・0打席・1得点**、ソフトバンク・笹川吉康は**0打数・1四球・1打席**として保存した。Source IDからcanonical Player IDへの対応は35/35、同姓同名・移籍者を名前だけで統合しない既存規則を維持する。Game IDはSourceの同日同カード連番を含み、日付＋球団ペアだけを一意キーにしない。

柳町達は5打数3安打のうち左二塁打1本、牧原大成は二塁打2本、平沢大河は右二塁打1本。両軍の選手Factの二塁打合計は3本と4本で、各選手の打席結果トークンを直接数えた。独立したnf3チーム別二塁打総計との照合は今回できていないため、その独立検算は未検証とする。三塁打は両軍0本で、非ゼロ例の検証は残る。各選手の2B+3B+HRがHを超えないことを完了ゲートに追加した。

PAは`AB+BB+HBP+SH+SF`と打席トークン数が一致し、さらにBB/HBP内訳とSourceの四死合算欄が一致する場合だけ確定する。近藤健介は4 AB+1 BB=5 PA、笹川吉康は0 AB+1 BB=1 PAを実測した。全員のPAが確定し、両軍合計は相手投手BFと一致した。この試合にHBP、SH、SFの非ゼロ例はない。これらのParser分岐は合成変更テストで回帰を確認したが、実データCapabilityは非ゼロ未検証のままとする。投手のBB/HBPはSource「四死」合算しかなく、`walks=null`、`hitBatters=null`、`walksAndHitBatters=実値`を維持する。

上沢直之は18 outs・91球・勝利、武内夏暉は12 outs・88球・敗戦。両軍で救援投手各3人を保存し、投球数・BF・H・HR・SO・R・ERを照合した。ソフトバンクは27 outs、西武はホーム側の9回裏がないため**24 outs**。第2弾の一律27 outsチェックを、固定対象試合で確認した守備アウト数へ変更した。端数投球回、ホールド、セーブはこの試合に存在せず、既存Parserと合成変更テストに留まる。投手使用ページは背番号順で登板順を確定できず、`appearanceOrder=null`を維持した。

Box Scoreの最終10–3と選手別R合計、自軍投手の失点合計、両軍の被安打・被本塁打、PA/BF、アウト数が一致した。RBIは得点と常に一致する必要がないため、完了ゲートに`RBI=R`判定は置かない。Sourceの独立したチームRBI/2B/3B総計は確認できず、選手行の単純合算以上の保証はしない。

テスト用には、実ページの対象日1行と必要ヘッダーだけを切り出した7個のHTML fixtureを`tests/fixtures/npb-game/edge-*`として追加した。Raw全ページは従来どおり`.data/raw`のgzipに最大14日置き、Runner終了後のRemote保管はない。Fixtureで2B、BB、0 AB、W/L、四死合算、ParserのSH/SF/HBP/HLD/SV分岐を回帰検証する。後者の合成変更テストは実データでの提供確認ではない。

ローカル初回は打撃27件・投手8件を挿入。保存Rawの同一Game再投入では新規挿入0/0、Repositoryのdistinct件数27/8を確認した。既存Factの2Bと投球数を更新するupsert訂正テストも実施した。[GitHub Actions手動dry-run](https://github.com/tomoya41/baseball-notes/actions/runs/35964730669)は成功。[Remote Turso実投入・Repository再読込・同一Raw再投入・再照合](https://github.com/tomoya41/baseball-notes/actions/runs/35986739327)も全Stepが成功した。Turso上の当該GameのFactは打撃27件・投手8件、distinct件数も27/8で、Game completenessは`complete`。再投入後も件数が増えないことを確認した。公開GitHub APIからは各Stepの集計JSONログ本文を取得できないため、Remoteの新規INSERT件数そのものはWorkflowの成功判定とRepository件数から区別して記録する。

2026-09-24 19時台JSTの確認では、JST 03:37の日次Workflowに`event=schedule`の履歴はまだなく、既存Runは手動実行のみ。次回定刻の到来前であり、失敗したScheduled Runはない。

今回の結果は**2種類の試合で1試合単位の完了を実証した**ことを意味するが、端数投球回、HBP、SH/SF、非ゼロ3B、HLD/SV、通常以外の試合終了形、独立したチーム別長打総計は残る。全試合日次収集のGo判定にはまだ足りない。Remote Fact backup・Raw archive・復元演習は別タスクで対処し、今回の公開PagesにFact/Rawを含めない。
