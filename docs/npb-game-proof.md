# NPB 1試合全出場者収集の検証

対象：2026-09-23、千葉ロッテ（ホーム）0–1オリックス（ビジター）、内部Game ID `npb:game:31c350227cecf978f3e8`。9回終了・DH制の標準的な1試合を選び、投手の打席と複雑な代打連鎖を最初の検証から外した。Sourceは第1弾と同じ公開nf3のみ。nf3は公式APIではなく、公開ページに明示禁止を確認できなかった状態であり、再利用の包括許諾を意味しない。[data-sources.md](data-sources.md)の停止条件を維持する。

`npm run collector:npb:game -- --fetch --dry-run`でSourceから再検証、`--fetch`でローカル書込み、`--offline-raw`で保存Raw再投入、`--verify-only`でRepositoryから永続結果を照会する。RemoteではGitHub Actionsの`Controlled NPB game completeness proof`を手動起動し、dry-run後にingestを選ぶ。日次Scheduleには組み込まない。`--require-remote`はローカルDBへの誤投入を拒否する。

Source URL patternは各球団の月間スタメン `stat_disp.php?y=0&leg=1&mon=9&tm={M|B}&stvst=all`、打撃名簿 `?y=0&leg=1&tm={M|B}&fp=0&dn=1&dk=0`、投手直近2週間 `/Pacific/{M|B}/t/pc_all_data_last2w_pn.htm`、選手月間打撃 `?fpnum={背番号}&tm={M|B}&mon=9&vst=all`、投手月間 `?pcnum=...`。`y=0`は2026年に限って検証済み。出場者探索は両軍9人のスタメンから開始し、個人行の交代参照を辿る。投手は日付別投球数リストで独立に列挙する。各URLを1回だけ取得し、逐次・750ms以上・最大2試行・15秒timeout・500KB上限。Player IDは背番号だけで永続化せず、`season:team:uniform`をSource mappingにしてUUIDのcanonical IDへ対応させる。名簿・個人ページの氏名/背番号不一致時は保存しない。

2026-09-24のローカル実証では**打者23/23・投手6/6、マッピング23/23・6/6**。ロッテは打者10・投手3、オリックスは打者13・投手3。ロッテ打撃は30 PA、28 AB、3 H、0 R、投手27 outs・32 BF・4 H・1 R。オリックス打撃は32 PA、31 AB、4 H、1 HR、1 R、投手27 outs・30 BF・3 H・0 R。両軍のPAは相手投手BFと一致し、H/HR/R/27 outs/先発各1人・打順1～9の照合も通った。交代出場はロッテ1人、オリックス4人を辿った。これはnf3ページ間の照合であり、公式Box Scoreへの独立照合ではない。

PAは打席内容の各トークンが `AB+BB+HBP+SH+SF` と一致し、四死の合算列とBB/HBPの内訳も一致する行でのみ導出した。妨害出塁など未対応の要素がある場合はnullにし、completeを拒否する。2B/3Bは打席結果トークンから明示的に数えるが、この試合の合計は両方0で、非ゼロ例の回帰検証は残る。投手の元欄は「四死」の合算だけなので、`walks`/`hitBatters`はnull、`walksAndHitBatters`のみ保存。投球回はアウト数整数、投球数と先発/救援・勝敗/セーブ/ホールド記号を保持する。投手の登板順と捕手はSourceから確定できずnull。交代選手の打順は元スタメンの枠を保持する。

`npb_game_completeness`はexpected/collected/mappedの打者・投手件数、各種検算、status、issues、検証日時を保持する。事前検証に失敗したRawからFactsを書かない。保存開始時はpending、全Fact保存・Repository再読込が成功するとcomplete。失敗時はfailed。完了済みFactは後日のSource訂正をupsert可能で、同一Raw再投入では行数が増えない。非対象試合や当日未終了試合を受け付けない。Source構造が変わればParser failureとし、0件を正常扱いしない。

Raw HTMLはローカル`.data/raw/nf3/`にgzipで既存方針どおり最大14日、GitHub Actions上では同一Runの再投入のためだけに保持する。最小化した実HTMLのtable行を`tests/fixtures/npb-game/`に置き、外部接続なしでParser回帰を検証する。Runner終了後のRemote Raw保管はない。Turso Freeの短いPITRを補う非公開のFact export・暗号化保管・復元演習を次の運用課題とする。公開Pages artifactにRaw/DB dumpを載せない。
