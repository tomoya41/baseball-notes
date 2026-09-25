# NPB Player Period Batch: read-only verification

`PlayerPeriodBatchService` uses the existing JST period resolver, batting/pitching aggregators, metric status, and league-wide coverage calendar. Its player universe is canonical IDs with a saved batting or pitching Fact in the requested date window; the roles are distinct and a two-way player can appear in both. The result retains each player's Fact count, sample metrics (batting G/PA/AB; pitching appearances/BF/outs), metric status, and coverage. It does not rank, score, cache, or write Derived results.

The Repository makes one distinct-ID query, at most one batting Fact query, and at most one pitching Fact query. The existing coverage repository reads three bounded evidence sets once per period. Therefore a nonempty two-role batch takes **six SQL reads regardless of player count**; a single-role stage takes five. Smaller stages use a sorted-ID subset and one `IN` query per role; full runs omit the ID list to avoid a large variable limit. Parsed Facts are grouped by canonical ID and passed to the same pure aggregators as the Player screen. Coverage comes from Day/Game evidence, never from an individual's appearance. The batch summary counts role results; unique players are reported separately. All players with the same period currently share the same league-wide coverage status, so a mixed-status summary is an extensibility check, not a claim that the live cohort is heterogeneous.

Run locally with `npm run verify:npb:period-batch -- --date=2026-09-24`. The manual `NPB period batch read-only verification` GitHub Action runs the identical script against Turso using existing secrets and makes no source requests or DB writes. It executes staged 10-batter, 10-pitcher, up-to-50-each, and full 7/14/30-day reads. Each stage reports player/Fact counts, SQL query count, DB-read and aggregation durations, and approximate heap change. It compares 中島大輔 and 上原健太 against the individual service when their Facts occur in the window, and compares protected table counts before/after. The GitHub secret currently used for connection may authorize writes, but this workflow executes only SELECT and never exposes its value. No public batch API is provided.

On the local 2026-09-24 snapshot: 131 batting Facts, 42 pitching Facts, 25 Games, and 178 mappings before and after. Stages A/B/C/D used 5/5/6/6 queries; the full 7-day read covered 125 batters and 41 pitchers (141 distinct players), 131+42 Facts, with 8 ms DB read and 2 ms aggregation in one local run. All 166 role results had unknown 7-day coverage because earlier Day evidence is absent. These numbers are a **local** performance baseline, distinct from the remote run below. Heap deltas fluctuate with garbage collection and are not a peak-memory measurement.

## Turso read-only run (2026-09-25)

[Manual workflow #1](https://github.com/tomoya41/baseball-notes/actions/runs/36125289110) succeeded on the 2026-09-24 as-of date. Counts were unchanged before/after: **244 batting, 79 pitching, 30 Games, 285 mappings**. 中島大輔's batting and 上原健太's pitching results matched the individual service exactly for 7/14/30d (including metric status and coverage); WHIP remained unavailable. No source was fetched and no write SQL was issued.

| Stage | Batters / pitchers | Facts batting / pitching | SQL reads | DB read | Aggregation | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| A, 7d | 10 / 0 | 12 / 0 | 5 | 552 ms | 1 ms | 553 ms |
| B, 7d | 0 / 10 | 0 / 10 | 5 | 239 ms | 1 ms | 240 ms |
| C, 7d | 50 / 50 | 65 / 52 | 6 | 496 ms | 2 ms | 498 ms |
| D, 7d | 205 / 77 | 244 / 79 | 6 | 352 ms | 3 ms | 355 ms |
| D, 14d | 205 / 77 | 244 / 79 | 6 | 238 ms | 6 ms | 245 ms |
| D, 30d | 205 / 77 | 244 / 79 | 6 | 235 ms | 2 ms | 237 ms |

The full 7d universe has **239 distinct canonical players**, because 43 have Facts in both roles. Its role-result coverage summary, likewise for 14d and 30d, is complete 0 / partial 0 / unknown 282 / unavailable 0. Fact history is still short, so equal counts across periods are expected. The sum of individual SQL call durations can exceed wall-clock DB read time because some reads run concurrently. These timings are one GitHub runner/Turso observation, not a latency guarantee; repeated daily growth measurements are still needed before introducing a cache.

At task start (2026-09-25 19:33 JST), the first full-day `event=schedule` opportunity is still 2026-09-26 03:37 JST. Scheduled production evidence remains **pending**. The earlier 2026-09-25 scheduled Daily Run predates `NPB_DAY_FACTS_ENABLED=true` and does not prove full-day unattended operation. Freshness scheduled execution has separately succeeded; see `npb-freshness-operations.md`.

The next data gate for a production HOT comparison is consecutive complete Day/Game coverage over the comparison window and a verified full-day scheduled Daily Run. Metric completeness and minimum sample rules would also need separate review. This task defines no HOT score or eligibility threshold.
