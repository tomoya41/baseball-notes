# NPB Draft / Young Player Discovery / Lifecycle

## Scope and contracts

This Product track consumes the existing, validated public Catalog and saved Regular Season/Recent projections. It does not add a source, change canonical identity, acquire profile data, write the canonical database, or modify any Production Gate. Additional recurring cost is ¥0.

NPB only: `/NPB/talent` replaces the old Draft placeholder. MLB Draft/Prospects remain unavailable. The legacy `/NPB/talent?tab=1` still opens the unimplemented Prospects surface. Existing Player, Team, Compare and public deep links remain compatible.

Views:

- `view=draft`: confirmed Draft years; `year=2022` is a Draft Class. Unknown years are excluded by default, optionally included with `unknown=1`. This is **collected players with verified metadata**, not the complete Draft register.
- `view=young`: age calculated from verified DOB at `asOf`, defaulting to Catalog effectiveDate, with an inclusive age ceiling of 25 by default. This does not certify Prospects, Rookie qualification or current roster membership.
- `view=school`: original confirmed school/amateur labels, partial text matching. No school canonical merging, graduation or enrollment interval inference.
- Player `/more`: lightweight school/amateur → confirmed Draft → partial saved affiliation history → saved Season section. Unknown years are omitted, not interpolated. Generic debutYear is not translated to NPB debut; Draft is not joinedYear.

Filters: exact Draft year or inclusive year range, exact stored round label, regular/developmental/unknown Draft type, canonical-matched Draft team, primary position, latest saved team, age bounds/reference date, player name, school/amateur label, batting/pitching data availability and minimum PA or recorded outs. A source's raw historical team label is displayed but never silently mapped into the Draft-team filter. 3 pitching outs = 1 inning.

Unsupported competitions/seasons, malformed dates, invalid bounds or unknown team/position/round are explicitly reported with no incompatible data query. URL query parameters retain filters, page and 2–4 Compare selections across reload/back. Compare uses the existing engine, league, role and Season/7d/14d/30d context; it does not create a new ranking.

## Evidence and partial coverage

Snapshot: public Catalog effectiveDate **2026-10-07**, 739 canonical players. Counts are computed from the loaded Catalog at runtime, not hardcoded in UI.

| Field | Known / total |
|---|---:|
| Draft year | 623 / 739 |
| Draft round | 602 / 739 |
| Draft type | 601 / 739 |
| Canonical-matched Draft team | 33 / 739 |
| Birth date | 665 / 739 |
| School / amateur label union | 653 / 739 |
| Partial affiliation history | 562 / 739 |

Null Draft information means **unconfirmed**, never undrafted. Unknown DOB means unknown age and is excluded from an age-filtered result. Pending/conflicting registry candidates are not consumed. Latest saved affiliation is not current registration evidence.

Existing field provenance and attribution remain unchanged: Wikidata CC0, Wikipedia CC BY-SA and other already accepted Catalog credits. The Player Lifecycle section links source articles and license URLs with transformation disclosure; full field/revision provenance remains in the existing publication/registry contracts and source documents. No new asset, source-rights interpretation or export permission is added.

## Fetch, state and performance

- One shared Catalog response, plus **one** bulk Season or selected Recent response. No 739 per-player Profile requests. Changing metadata filters, pagination or Compare selection triggers no additional payload requests; changing period fetches only that period projection.
- Both projection identity (canonical ID/name/saved team) and effectiveDate must match the Catalog. A mismatched generation is an error; Catalog metadata remains visible and statistics render `—`.
- Results render 30 at a time. Compare caps at four same-stat-role candidates. Natural page scrolling; no nested results scroller or wide table.
- Existing validated-response persistent cache provides offline fallback. No new local persistence key/schema; URL query is the portable view state. Existing Favorites/Collections are untouched.
- Snapshot decoded JSON sizes: Catalog 1,249,191 B; Season 1,521,095 B; Recent7/14/30: 573,663 / 724,549 / 888,763 B. These are reused published payloads; no new public payload.
- Local Node benchmark of 100 evaluations per query: Draft Class 3.0 ms, age/pitcher 2.5 ms, school 6.0 ms, year-range/round 2.4 ms. Device timings may differ.

Metadata availability, statistic loading/error, minimum-sample empty results, partial Fact Coverage and unknown individual metrics remain distinct. Rankings/HOT gates are not used as a discovery ranking or bypassed.

## Integration and validation

Entry points: Players/Search, Discovery's data tools, Home's existing Explorer links, Team Hub (saved team filter), Data Explorer, Compare and Player profile. Five primary destinations are retained. Detailed conditions are disclosed progressively for 360px.

35 targeted tests cover nullable Draft/DOB, canonical team matching, age boundaries, year ranges, role, samples, exact school-label preservation, invalid URLs, generation/identity rejection, master immutability, bounded rows, bulk requests, error preservation, loading versus empty, all four Coverage states, legacy unavailable Prospects routes, existing Compare handoff, reuse after temporary filter errors, explicit retry and successful-period restoration after another period fails, including retry isolation across periods. Full test/build, visual and delivery results are recorded in the PR.

Release procedure: app-only Pages workflow; preserve all existing NPB/MLB data artifacts. Compare public payload hashes before/after; no collector, canonical migration or Source acquisition. Android build regression uses the existing debug APK/unsigned release AAB workflow. Formal signing, Play publication, source-quality review queues, Rookie eligibility and MLB Draft/Minor League remain outside this batch.
