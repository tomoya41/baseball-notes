# NPB未収録・本人照合の再監査（2026-10-27）

既存の `audit-npb-active-coverage.ts` に任意の理由分類を追加した。既定の4引数を保ち、`--identity-archive`、`--regular-quarantine`、`--cs-quarantine` を3つ同時に指定する。記事archiveのSHA256がHistorical datasetの`inputSha256`に一致し、独立承認済みcanonical UUID/NPB ID/QIDの3項目とarchiveの橋渡しが一致する場合だけ分類する。同名、略称、球団、表の数値から本人を推定しない。

これは保存済み入力の診断であり、登録状態・全Career・Production integrityを認定するものではない。入力ファイルとbridge集合のfingerprintを記録し、次回は新しい証拠または変更されたfingerprintを確認してから再検証する。データ採用、DB接続、外部リクエストは行わない。

## 実入力の結果

Directory740人、Historical579人、未収録161人、独立bridge未確定69人を維持。Historical v8は600人・3,524球団別年度行（打撃1,927・投球1,597）、2000〜2025年、partialのまま。

| 未収録161人の理由 | 人数 | 次に必要な証拠 |
| --- | ---: | --- |
| 独立したcanonical本人照合不足 | 69 | canonicalの取得元IDと、独立したNPB ID/QIDの対応 |
| 照合済み記事に採用可能な対象年度行がない | 86 | 許諾済みSourceの検証可能な年度別行 |
| 全対象行が隔離された | 6 | 原記事訂正または意味を証明できる独立parser規則 |

86人を2026年初出場・出場なし・過去成績ゼロとは判断しない。隔離された6人は、カナリオ、ターノック、ダルベック、レイノルズ、林安可の未対応表と、大野稼頭央の率不整合。外国リーグの表をNPBとして受理しない。

Regular隔離59診断は、統計不整合50、分母不足1、未解釈数値3、未対応表5。件数は人物数ではない。`2|19`等の破損やWHIP/OPS不整合を許容誤差で通さない。CS隔離257診断はすべて本人照合不足で、記事リンクのない略称を他試合・球団・役割から伝播しない。

今回のaudit入力fingerprintは`19e0bddd1603977ee5306a4de518779aa67853d560de9d316caea38f40034a8e`。Historical gzipは`5cda8fb982f6e972ebadb887fb90ed66c9d79ae95be367ebe0fc32533d614181`、記事archiveは`d4946a34dd2c2c72bc10ee0a2bf0b2336690a705f51d38198d00bb35f9f9b092`。入力と出力はprivate `.data` に保持する。

## CS明示リンク5人の新しい観測

2026-10-27T00:46:18.649Zに、既存許可済みの公式Wikipedia APIを1要求のみ実施した。原文はprivate cacheに固定し、既存の[CC BY-SA 4.0の条件](npb-sourced-player-events.md)を維持する。追加記事本文の公開や、新Sourceの無断採用は行っていない。

| 記事 | 確認revision | NPB ID / QID | 判定 |
| --- | --- | --- | --- |
| [フランミル・レイエス](https://ja.wikipedia.org/w/index.php?oldid=111477507) | 111477507 | 73075159 / Q53567747 | Current略称canonicalとの独立対応不足 |
| [ダーウィンゾン・ヘルナンデス](https://ja.wikipedia.org/w/index.php?oldid=109165991) | 109165991 | 33435157 / Q63304416 | 同上 |
| [アンダーソン・セベリーノ](https://ja.wikipedia.org/w/index.php?oldid=111461456) | 111461456 | 53055152 / Q111594740 | 同上 |
| [ホセ・ルイーズ](https://ja.wikipedia.org/w/index.php?oldid=111101803) | 111101803 | 53955152 / Q34487759 | 同上 |
| [藤森海斗](https://ja.wikipedia.org/w/index.php?oldid=111426842) | 111426842 | 61665152 / QIDなし | QIDとCurrent本人照合不足 |

最初の4人は記事のNPB ID/QID/生年月日と、既存Chadwick archiveの同じ外部ID/生年月日が一致する。しかしCurrent Directoryの略称・球団だけではcanonical対応を独立に証明できない。藤森は記事にQIDがなく、ChadwickのNPB ID/生年月日だけで新しいQIDを推測しない。

2要求目のWikidata公式APIは`maxlag`で拒否（queryservice lag 905秒）。再試行や制限緩和をせず停止した。障害だけを理由に元データが誤りとは判断しない。次に進める条件は、日常更新で得られた確定source mapping等の新独立証拠であり、同じ略称照合や大量dry-runの反復ではない。Currentと重複するHistorical-only IDを作らない。

今回の新規採用選手・成績・canonical writeは0。HOT/Ranking Gate、Coverage、既存immutable assetと保存情報を変更しない。外部取得は合計2要求、追加月額費用¥0。

## 2026-11-22 JST — ネビンの2025年埼玉西武成績

公開Directoryの740人のうち、Historical v8と接続済みは579人だった。ネビンは既存のcanonical IDに独立照合済みのNPB ID `53755150`・Wikidata `Q107031409` を持つ。収録元でも同じNPB IDへのリンクとWikidata IDを確認した。2025年埼玉西武の打撃行は、137試合、570打席、509打数、141安打、21本塁打、63打点、打率.277、OPS.794を含む。NPB公式の2025年埼玉西武打撃表と各構成値を照合した。収録データは固定版の表から抽出した。[固定版111731051](https://ja.wikipedia.org/w/index.php?oldid=111731051)・[NPB公式球団別成績](https://npb.jp/bis/2025/stats/idb1_l.html)・[NPBの選手ページ](https://npb.jp/bis/players/53755150.html)

元の年度セルは `{{mlby|2025}}` だった。本人ID・出典版・球団・打撃の区分・行の全セルが確認済みの組み合わせで一致した場合だけ、この年度リンクをNPBの2025年として処理する。一般の他リーグ年度リンクは従来通り除外する。数値、母数、収録年度の上限は変更しない。

既存のHistorical取込で1選手・1行を検証し、scratch DBの読戻しと2回投入時の冪等性を確認した。Historical v9は601人・3,525行。v8の3,524行と600人の本人IDは保持した。2025年は548行から549行になり、他年度の行数・収録範囲の `partial` は維持。Directoryと接続済みは580人、未収録は160人になった。v8の公開済み固定URL27件は、v9切替前にHTTP本文とSHA-256を照合して保持対象に追加した。

v9の入力証跡はUTF-8で空白なしのJSONから算出したSHA-256。キー順は `baseRelease`、`baseArchive`、`reviewedAppendArchive`。値は順に `5cda8fb982f6e972ebadb887fb90ed66c9d79ae95be367ebe0fc32533d614181`、`d4946a34dd2c2c72bc10ee0a2bf0b2336690a705f51d38198d00bb35f9f9b092`、`b97529552fec9646a9a71b13e27348bdee248c37d766b01f409e6f475ddd78ba`。固定版の本文SHA-256は `720e8e6001cd29473cdb442815994840bca39be0eb6cabcf34e23b300837af0c`。配信用gzipのSHA-256は `d722f65df198a2857a916ca5e7afcd3c4e8416f63462d9de200d62c331ca243a`。

## 2026-11-22 JST — 大野稼頭央の2025年投球成績

本人照合済みの候補16人を、採用済みのSourceから取得した固定版で再検証した。2025年までの規則を通過した追加は大野稼頭央の1行。福岡ソフトバンクで4登板、4回1/3（13アウト）、1奪三振、防御率0.00。WHIPは4安打と2四球から1.38。勝敗がないため勝率は未算出。固定版111809459を既存のNPB IDとWikidata IDで照合し、NPB公式の成績で構成値を確認した。旧版で率の不一致により隔離した行の数値は採用していない。[採用した固定版](https://ja.wikipedia.org/w/index.php?oldid=111809459)・[NPB公式の照合先](https://npb.jp/bis/players/21325157.html)

既存のWikipedia取込で1行を取り出し、scratch DBで読み戻しと冪等性を検証した。追加用のスクリプトは公開済みのpinに一致する旧版と、収録のレビューを終えた少量のgzipを入力とする。過去成績がある選手の上書きを拒否し、旧版と追加分の両方のハッシュを `inputs.json` に保存する。`verify-npb-historical-expansion.ts` でv9の3,525行・既存本人IDに差がないことを確認した。v9の公開済み固定URL27件を保持する。

```powershell
npx tsx scripts/append-npb-historical-players.ts .data/v9-before.gz .data/ohno-reviewed/npb-historical-wikipedia.json.gz .data/ohno-v10
```

v10は602人・3,526行で、一部収録。Directoryとは581人が接続。記事アーカイブSHA-256は `8a0366f56823f24532ad9b0243463029a223b05626195e3fa81cd138be10d482`、追加gzipは `f453e464874f63948ed1033722de47d93c4ac60e256454a7be71ae7317703b87`、配信用gzipは `a6b9f867f32b71757413d4d9ad1453006437884b8f698b174c4dcbae8d7bc0ff`。
