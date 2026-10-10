# Product Track 2 — Draft copy and MLB Historical exploration

## Scope and invariants

Phase A changes Japanese copy and disclosure placement only. Draft routes, verified
fields and provenance remain unchanged. ドラフト / ドラフト同期 / 若手選手 /
選手経歴 / 出身校から探す are product labels. Missing Draft information is not
undrafted; age is not Rookie/Prospect eligibility; Draft year is not join/debut year;
saved affiliation is not current roster proof. Profile history uses a compact ordered
flow with an explicit incomplete-history disclosure.

Phase B uses only already-published Retrosheet Game Facts and validated exact-PA
aggregate products, with the existing Retrosheet and Chadwick attribution. No new
Source download, license interpretation, canonical identity, Fact, Coverage or Gate
change. No Turso/canonical DB queries or writes. MLB Current remains unavailable.

## Product and routes

- `/MLB/data?season=2024&period=14&asOfDate=2024-08-20`: all-player Recent,
  7/14/30 inclusive calendar days, explicit Historical date/year/scope, actual
  appearance-team filter, batting/pitching, sample and existing Explorer rules.
  `competition=postseason` selects the independent Postseason subtree. Legacy
  selected-player Recent URLs remain supported; changing the year clears the old
  as-of date. Forty results per page, no official rank/HOT claim.
- `/MLB/matchup?season=2025&batter=<canonical>&pitcher=<canonical>`: searchable
  canonical identities and one existing batter Advanced aggregate payload. Matchup
  uses its validated exact pitcher/batter PA result, never shared Game participation.
  PA is visible; no small-sample superiority labels. Postseason is independent.
- `/MLB/milestones?season=2025`: Season checkpoints, near/achieved, batting/pitching,
  metric/name/player filters. Reuses Watch's existing H/HR/RBI/SB/SO/W/SV/HLD steps;
  missing metrics are omitted (MLB HLD is not provided). Near means remaining at most
  20% of the checkpoint interval. Achieved means the Season total meets the step,
  not an inferred achievement date. Career/all-time records are not created.
- MLB Player's more section: saved Season timeline from its existing Profile,
  including every actually recorded appearance team in a year. No inferred tenure,
  missing-career years or extra fetches. Links to year history, Compare, Game Log,
  Postseason. Profile, Search/Discovery, Explorer, Compare and Watch reuse these
  routes, with scope preserved. Primary navigation stays at five destinations.

## MLB-only metric definition

Inputs are the independent canonical H, BB, HBP, SO, PA, BF and integer outs fields.
BB includes intentional walks and excludes HBP. Pitcher attribution follows existing
validated Game Facts, not PBP pitcher-state inference during an unfinished PA.

| Metric | Formula | Scope / interpretation |
|---|---|---|
| WHIP | `(H + BB) × 3 / outsRecorded` | Pitching, lower generally better; excludes HBP |
| BB/9 | `BB × 27 / outsRecorded` | Pitching, lower generally better |
| K% | `SO / PA × 100` or `SO / BF × 100` | Batting / pitching respectively; role matters |
| BB% | `BB / PA × 100` or `BB / BF × 100` | Batting / pitching respectively; role matters |

Only complete, non-null components produce a rate. Zero outs makes WHIP/BB9
unavailable while a known positive BF can still support K%/BB%. No minimum sample is
invented as official qualification: Explorer exposes user-set PA/outs/G minimum;
small samples and selected scope are explained by the existing metric sheet.
Regular/Postseason are separate. These metrics are UI-derived, leaving existing
core aggregate payload bytes unchanged. NPB's independent BB/HBP deficiency is not
fixed by copying MLB capabilities; NPB does not gain these new metrics.

## Read-only projection and publication

New namespace: `historical/[postseason/]exploration/recent/<year>/index.json.gz`
and monthly `<YYYY-MM>.json.gz`. Monthly payloads contain per-day/per-player/per-team
**count aggregates**, compact canonical dictionaries and source fingerprints. They
contain no raw PA/events, pitch data, Game stream or Chadwick full dump. Doubleheader
counts remain additive; one unknown input propagates null for its metric.

Fingerprint binds sorted canonical Game IDs and original compressed Game hashes.
Runtime schemas verify dates, identities, dictionary bounds, rows and competition.
The reader checks Manifest dates/Coverage, fingerprint and required shards before
folding. One index plus at most three monthly shards; no Profile/PA fanout. Existing
Season/Directory are reused. Team changes reuse cached shards, with client-side fold
by actual team. Home gains no fetches.

`mlb-historical-publish.yml`, `mode=app-only`,
`expand_historical_exploration=true` generates/verifies this additive family from
the preserved release and refreshes the public archive. Future full release imports
also regenerate it. Default app-only preserves the archive. Existing NPB publication
guards run unchanged. Postseason publication audits additionally reproduce every
new shard from original canonical Games and reject incomplete/stale/altered files;
legacy archives without the entire new family remain readable.

## Measurements and validation

Local 2020–2025 source: 13,046 Regular + 261 Postseason Games. Generation:
**63 files / 4,687,776 compressed bytes / 138,424 largest / 502,151 daily rows**;
22–33 seconds on this machine, zero Source requests/DB queries/writes.
Independent reference aggregation checks all players in 216 windows (first/middle/
last date × 7/14/30 × all teams/one actual team × twelve year/scope pairs):
**1,550,804 metric comparisons, mismatch 0**. Max measured fold 32–43ms, max window
1,122 players. This is a representative-window check, not every possible date.
Postseason publication additionally validates the entire monthly family against Facts.

Recent: 3 reused base payloads plus 2–4 new reads; no per-player fetch. MATCHUP:
Manifest/Directory + one Advanced file; switching pitchers reuses it. Milestones:
Manifest/Directory + one Season file. Timeline: zero additional fetch. All lists
render at most 40 rows per page or 20 search candidates. New payloads are additive;
protected existing payload hashes are compared again after deployment.

Tests cover dates/windows/actual team, scope/fingerprint/identity drift, null/zero
inputs, source/shard publication consistency, exact matchup/no result/swap,
checkpoints and multi-team/missing-year timeline, portable URL and NPB metric isolation.
Web/Android CI, actual HTTP and mobile Light/Dark smoke evidence are recorded in
the delivery PR. Signing, real-device TalkBack and Current/Career Source work remain
separate release/data tracks. No paid service or recurring infrastructure is added.
