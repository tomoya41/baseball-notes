# Historical MLB ranking qualification

Accessed 2026-09-30. Primary authority: [2025 Official Baseball Rules, 9.22(a), its Comment, and 9.22(b)](https://mktg.mlbstatic.com/mlb/official-information/2025-official-baseball-rules.pdf), printed pages 143–144. [2020 rules](https://img.mlbstatic.com/mlb-images/image/upload/mlb/atcjzj9j7wrgvsm8wnjq.pdf) use the same qualification provisions. The app stores a factual implementation summary, not a copy of the copyrighted rulebook.

For AVG, OBP and SLG titles, minimum PA is scheduled Games per club in the player's league multiplied by 3.1, rounded to the nearest whole PA. Below-threshold candidates can win the respective title if adding the missing appearances as hitless at-bats still leaves their adjusted rate highest in that league. Each metric is evaluated separately. Original counts/rates remain untouched; hypothetical counts exist only in the ranking read model. The rule's example (490 PA, 440 AB, 165 H against a qualified .362 leader) qualifies after adding 12 hitless AB.

ERA needs innings at least equal to scheduled league Games. Stored outs are compared with three times that denominator. Cancelled/unplayed Games do not reduce the schedule denominator. OPS and K/9 are not championships named by 9.22: the app explicitly uses the ordinary PA/IP sample threshold for these statistical lists, without a title exception.

## Season denominator evidence

These are explicit, source-backed season metadata, not a universal 162 constant or an observed Games calculation:

| Season | Scheduled Games/club | Required PA | Required outs | Primary schedule source |
|---|---:|---:|---:|---|
| 2020 | 60 | 186 | 180 | [Revised 60-game schedule](https://www.mlb.com/news/2020-major-league-baseball-schedule-released) |
| 2021 | 162 | 502 | 486 | [2021 MLB schedule announcement](https://www.mlb.com/press-release/press-release-mlb-announces-2021-regular-season-schedule) |
| 2022 | 162 | 502 | 486 | [CBA agreement preserves full schedule](https://www.mlb.com/news/mlb-mlbpa-agree-to-cba) |
| 2023 | 162 | 502 | 486 | [Balanced schedule explanation](https://www.mlb.com/news/2023-mlb-schedule) |
| 2024 | 162 | 502 | 486 | [Official club schedule breakdown](https://www.mlb.com/press-release/royals-announce-2024-regular-season-schedule) |
| 2025 | 162 | 502 | 486 | [MLB schedule announcement](https://www.mlb.com/press-release/press-release-mlb-announces-2025-regular-season-schedule), [numbered official schedule](https://img.mlbstatic.com/mlb-images/image/upload/mlb/xpd5em2nl2154nj0g2em.pdf) |

AL/NL rates are aggregated by the league of the team for which the player appeared. A cross-league transfer is kept separate. Interleague Games remain included in that team's season. This avoids pooling PA from unrelated league title contests. Complete historical coverage and complete input metrics are prerequisites. Missing coverage, denominator, metric, or qualifying-leader evidence gives `unknown`, never eligibility.

Counting rankings remain independent. Exception qualification is metric-specific, with missing PA, adjusted rate and reason in internal diagnostics; public lists show original rate plus a concise exception note. Rate sorting uses adjusted rate for exception candidates and unrounded existing-aggregator rates; equal values receive equal ranks. No canonical Fact is changed.

## PA storage and rollback

The existing remote `plate_appearances` reservation lacks the required release validation fields. Historical PA uses separate local-release SQLite tables and two matchup indexes. NPB schema/Facts are unaffected. The release command is explicit, never daily. Rollback removes the advanced publish step and UI capability while leaving the Core database/payload compatible; no destructive NPB migration is involved.

Pilot estimate: approximately 982,000 PA based on 2025's 182,926 PA and the actual six-season Game count. Initial 315 MB row estimate excluded full index cost. The measured pilot adds 137 MB for one full season, giving approximately 735 MB additional SQLite including indexes for all seasons. Turso storage/write delta is zero. The importer reports actual size and runtime before enabling any public capability; raw PA rows are never copied into Pages.
