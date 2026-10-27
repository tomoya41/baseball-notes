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
