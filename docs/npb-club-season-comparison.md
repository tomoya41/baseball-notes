# NPB collected club-season comparison

Baseline: main 03f0578 / PR #42, checked 2026-10-18 JST. This is one incremental Product analysis change over admitted Wikipedia Historical Regular data, not a transactions feed or a new-source import.

## Evidence investigation and decision

The existing Wikidata adapter already retains P54 affiliation qualifiers P580/P582 at their actual year/month/day precision. The free registry contains 92 dated affiliation observations, while the newer curated registry also contains potentially different affiliation values. The published Catalog snapshot used for QA has no dated affiliations. `applyNpbProfileRegistry` rejects competing values and preserves known values; this change does not overwrite those conflicts, choose the oldest/most precise claim automatically, or promote them to transfer/entry/retirement events. A future dated-event admission must reverify identity, source revision, date precision and claim consistency. No provider inquiry, new source acquisition or Source Contract change was performed.

Instead, the Product increment answers a safe existing-data question: how do this player's **recorded club rows in selected years** compare? It is reachable on NPB Player annual history and History → player → annual comparison.

## Implemented

- Select at most four existing years and one role using the existing URL and year controls; expand **球団別に見比べる** when at least two clubs have actual rows. The existing trend metric controls the club chart too. No new primary navigation or separate selector.
- Group only selected player/role/club rows, recompute rates from components, retain nulls if required components are absent, and calculate pitching K/9 and BB/9 from integer outs. No average of season rates or decimal-innings arithmetic.
- Each club shows exact observed years, sample PA/IP, key statistics and links to a selected annual view with role preserved. Same-year multi-club observations stay separate; discontinuous/rejoined years are listed individually and grouped only as recorded rows, never as a continuous tenure.
- Missing selected years remain missing. Different year counts and samples are explicit; counts/bars are not an official ranking, rate qualification or causal estimate of a transfer's effect. It is not full Career or an official club career total.
- The existing annual comparison's per-article/revision/author/CC BY-SA source panel remains linked from the club view. Source data is not copied into code.

## Performance, preservation and rollback

Additional data requests: **0**, including Home, closed/open comparison and metric changes. Reuse existing at-most-four selected annual payloads; at most 12 canonical NPB club groups render (usually two), derived only from the selected rows. No raw redistribution, new public payload, canonical DB write, persistence migration, eligibility change or paid dependency. NPB Historical remains 600 players / 3,334 rows / 2002–2025, all partial; CS remains 11 observed-final games /145 partial participant rows. Current and MLB 2014–2025 assets and source terms remain unchanged. Revert this app commit to roll back; no data rollback is needed.

Current HOT/Ranking stay closed. Six pending games/five partial dates/stale are the last verified Current state; latest SQL-read blocking is not resolved or reverified by this analysis. No new Scheduled collection/backup evidence is claimed. Physical Pixel is not currently connected; no install, signer change, device-data deletion or TalkBack PASS is claimed.

## Validation

Domain fixtures cover weighted rates, split-team years, rejoined/discontinuous years, selected-year exclusion, missing years/components, null versus zero, fractional IP/zero outs, identity/role/duplicate rejection and the four-year bound. UI checks cover samples, unknown metrics without bars, role/year links, absent/single-club behavior, source access and no fetch on expansion. Native instrumentation adds an actual-data Kondo scenario with 2022 Fighters (396 PA), 2023/2024/2025 Hawks (1,455 PA), component-derived AVG .307, Activity recreation at 200% and annual navigation. Browser, full-suite/build and delivery receipts are recorded after actual execution on the PR.

## Remaining roadmap

1. Independently reverify conflicting dated affiliation claims before considering any dated player-story event; do not infer an event from the club chart.
2. Extend 161 Current players without admitted past rows / 71 Historical identity bridge gaps with independently licensed evidence, not name-only matches.
3. Admit missing competition/player aggregates only where source scope and reuse conditions permit.
4. Separate Web offline shell and Android original signer/physical Pixel/TalkBack work; retain existing Current operational gates.
