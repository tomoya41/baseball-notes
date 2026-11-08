# NPB球団比較の公開世代修復

2026年の公開版はCatalogとTeam SeasonがともにHTTP 200、基準日は10月12日。10月18日のプロフィール更新がCatalog・Directory・関連表示を進めた際に、Team Seasonだけが10月14日の世代に残った。クライアントは世代差を検出して集計を保留する。

## 修復候補を作る

1. [暗号化バックアップの復元結果](https://github.com/tomoya41/baseball-notes/actions/runs/42217233085) を固定し、NPB portable backup restore drillを修復PRのブランチで `stage_team_generation=true` のみ指定して実行する。
2. CIで暗号化ファイルのSHA-256を照合して、新規スクラッチDBへ復元する。公開済みDirectoryとレビュー済みプロフィール情報からCatalogを再生成し、既存のGame・打撃・投球と日別Coverageを読み取り専用で再集計する。
3. Catalog全体、球団ID・全指標・母数・試合数・収録期間・Coverageを現行公開版と照合する。生成元の相違や集計値の差で停止する。修復候補は2つの公開用JSONとハッシュ報告のみで、DB・原本・鍵は含めない。
4. [ステージ結果](https://github.com/tomoya41/baseball-notes/actions/runs/42438937237) で12球団、740選手、partialを確認済み。CatalogのSHA-256は不変。Team Seasonの新SHA-256は `e176c1a6cdf300a559d3a0934eee06ebd6584ac09bead1d817ad586fdfc32879`。公開候補は7日間保存する。

プロフィールだけを更新する場合も、既存の整合済みリリースから球団メタデータと成績範囲が同一であることを確かめ、Team Seasonを同じ公開世代に含める。日付・世代・対象球団・期間・Coverageの検証を通らない組み合わせは配信候補にしない。

## 公開前のリハーサル

- Publish NPB Player Directory に `stage_only=true`、`preserve_published_only=true` とレビュー対象の `team_generation_repair_run` を指定する。PRブランチでWeb/PWAと全保存データを組み立て、ハッシュ一覧を `npb-preserve-only-rehearsal` に出力する。`deploy` が skipped であることを確認する。
- リハーサルのNPBハッシュ一覧を現行公開版と照合する。修復対象のTeam Season以外に差があれば原因を確認する。公開時も同じ検証と保全処理を通す。リハーサルではDBアクセスを伴う入力を拒否する。

## 承認後の公開と確認

- PR承認・mainへの統合後、公開の承認を受けて Publish NPB Player Directory の `preserve_published_only=true` と、レビュー済みステージRun IDを `team_generation_repair_run` に指定する。プロフィール更新、インポート、リハーサル専用モードはオフにする。期限切れや公開元のハッシュ変化時はステージを再作成する。
- 保存済みWebデータを含む一つのPages artifactへ適用する。検証ステップが公開元ハッシュ、再集計結果、日別データ、全投影ファイルの整合性を確認した後に公開する。修復操作から本番DBへの書込みは発生しない。
- 公開後、Pages workflowの公開ハッシュ照合に加え、実際の球団比較を開く。2026年、2球団、母数、指標、収録期間、基準日10月12日、生成時刻、partial表示を確認する。HOTと公式順位のGateを確認する。
- 回帰時は最後に正常動作を確認したPages artifactが取得できるか確認し、承認手順に従って戻す。取得期限を過ぎている場合は、稼働実績のあるアプリ版と検証済みのデータ一式から復旧候補を作成し、ステージで検証してから別途承認する。今回の公開直前版は世代不一致を含むため、球団比較の正常版としては扱わない。日別Facts、既存immutable asset、個人保存は保全する。
