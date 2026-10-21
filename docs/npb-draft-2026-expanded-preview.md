# ドラフト2026：高校・大学・社会人・独立リーグと3位までの独自予想

2026-10-21作成。従来の大学代表4年生18人・12球団の1位候補案は、その候補行・予想・作成時刻・hashを保存したまま、新しい開催前版 `2026-premeeting-v2` を追加する。結果・抽選は開催前なので0件。canonical DB / Current / Facts / Gateへの要求・writeは0。追加費用¥0。

## 出典と利用条件

既存の[Wikipedia利用規約§7](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use/ja)、[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)、[正規API利用方針](https://www.mediawiki.org/wiki/API:Etiquette)を適用する。B（条件付き採用）。記事のrevision・執筆者リンク、変更表示、ShareAlikeを公開JSON・画面・Releaseに保つ。独自案もこのデータセットではCC BY-SA 4.0。コードのライセンスとは別。

- 既存の2026年日本代表記事（page 5209342 / rev 111304047）の社会人24人とU-18の17人を追加。高校の学年や志望届・指名資格を推定しない。代表での所属・役割は大会当時。対象外の年齢区分、コーチ、辞退者表を混ぜない。
- [茨城](https://ja.wikipedia.org/w/index.php?curid=3859496)、[徳島](https://ja.wikipedia.org/w/index.php?curid=528913)、[高知](https://ja.wikipedia.org/w/index.php?curid=565473)の所属選手一覧から、記事リンク付きの投手4人を追加。revision/timestamp/content hashはSource registryへ固定。登録者・練習生の区別やNPBへの指名資格の確認ではない。個別記事が未作成でも、一覧の明示的なリンクと所属の組を特集内IDにする。既存NPB canonical IDへの氏名mergeは0。将来の結果で所属表記が異なる同名は「照合確認中」とし、自動で的中・不的中にしない。
- 正規APIの新規取得は4要求：存在確認した年度別リーグ記事と個人記事はmissingで採用0、候補検索は本文採用0、球団一覧3記事を1要求でprivate取得。計量・retry 0・maxlag=5・User-Agent・private cacheを使用。年ごとのリーグ記事が見つからないことを、その年にリーグや選手が存在しない証拠にはしない。
- 既存代表記事の私有archiveを再利用し、大量再取得しない。ニュースの本文・評価・予想表・写真は取り込まない。調査で得た報道のスカウト評価、球速、成績、志望情報は公開データへ転記しない。

## 範囲と予想の意味

候補63人：高校17 / 大学18 / 社会人24 / 独立4。これは全候補の網羅や公式の志望届名簿ではない。候補の一部が実際には指名対象でない可能性を表示する。高校の在籍学年・進路を名簿から補完しない。

12球団×支配下1〜3位、36人の独自プラン。既存資料で確認できる所属・守備位置を使い、投手・捕手・野手の組み合わせを考えたAIの編集上の仮説。球団の公表・取材・補強意向、能力ランキング、抽選・ウェーバー順の再現ではない。初版の予想を上書きしない。新しい36案も作成時刻を固定し、後日の結果反映で変更・削除しない。

同じ選手を複数球団や複数順位へ同時に最終指名したとするプランは拒否。結果との比較は、対応する支配下順位の最終指名だけを対象とする。育成指名、初回入札、抽選を混ぜない。未収録は不的中ではない。

## 安全な更新

`build-npb-draft-preview.ts` は固定済みの前dataset・admitted archive・予想・明示review確認からofflineで新immutable版を生成する。対象はreview済み代表表と球団投手表の形式に限定。未知のheader/role/列数/投打/記事リンク/重複を拒否する。出力は `.data` 内のみ。

既存の結果更新CLIは新予想と候補区分を前版から保持する。公開済みの初版・新予想を変更するとadvance検証で停止する。結果表の未知形式や訂正・削除は従来どおり別review。古い公開assetを保持し、新version/hashへ切り替える。Raw記事は公開しない。

UIは同じ特集routeのまま、1〜3位予想 / 初版保存版を切り替え、候補は高校・大学・社会人・独立リーグで絞る。球団別の3人を縦に表示し、理由・答え合わせは展開式。URL、Back、reload、shareを維持。結果や既存NPB/MLBのFact・Coverage・Gateは変更しない。新payloadは約47KB、gzip約9KB、特集で1fetch、Home追加fetch0。
