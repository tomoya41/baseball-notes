# NPB Player Story / Same-age Season Delivery

## Scope and original-vision gap

Baseline: main c54dab0 / PR #41, 2026-10-18 JST. The next reviewable Product increment addresses draft-to-performance discovery and age-related comparison using already admitted data. It does not claim complete careers, current roster evidence or a transaction/news feed. No external acquisition, new source, canonical writes, data release, paid service or monthly cost.

### Implemented experience

- `/NPB/history?cohort=ageSeason&age=26&role=batting&recentPlayers=<2–4 canonical UUIDs>` compares **seasons in which each player is that age on December 31**. January/December/leap-day birthdays have explicit year-end semantics. This is not cumulative statistics up to a birthday, full Career, age-adjusted ranking or Rookie qualification.
- Existing Historical manifest + Catalog independently identify players/DOB. Select up to four; use at most four distinct annual payloads. Unknown birthday/identity, absent player/year/role, null components and failed acquisition remain different states. Never fall back to Current/another season or fill with zero.
- Each comparison shows its actual year, recorded club rows, PA/IP sample and article/revision/author/license links. Ratios reuse `sumHistoricalRows`; split-team counts/components are recomputed, not averaged. One year's fetch failure does not remove other valid observations. Retry requests only the failed year. Metric changes and remove/re-add reuse in-view annual promises.
- Results use existing ComparisonBars, metric glossary and design components. Candidate rendering is capped at 30, comparisons at four. Search filters an indexed canonical universe with an available verified birth date, not a complete current-roster population. No official qualification or superiority claim; era differences are not adjusted.
- Explicit Saved Views/share preserve age and selected canonical IDs. Automatic Activity omits cohort, age, peer and selected IDs. Existing persistence schema and Back/reload are retained.
- NPB Player → More → **経歴と年度成績をたどる**, or annual stats → **選手の歩み** opens the existing school/Draft/affiliation components alongside links to actual collected years. `story=1` persists the expanded view. Year-end ages require a verified birth date. It does not infer joined/debut dates, transfer dates, retirement or missing-year participation. Historical-only identities keep usable season links when Current profile metadata is absent.

### Performance, protection and rollback

Home requests +0; ordinary Player/annual stats do not fetch Catalog for a closed story. Age comparison is manifest + existing Catalog + at most four distinct admitted seasons (maximum six cold data requests), not all 24 seasons/profiles/PA. A selected unadmitted age year does not trigger a request. Raw data/payloads and source contracts are unchanged, so old APK URLs remain available. Rollback reverts presentation/domain changes; no DB or payload rollback is required.

NPB Historical remains 600 players / 3,334 rows, all partial, 2002–2025. CS remains 11 observed-final games /145 participant aggregates. Current remains separate: last verified six pending games/five partial dates/stale and HOT/Ranking closed. October 18 scheduled SQL read blocking is not solved by these Product features; no repeated provider retry or owner-plan change. Latest live DB integrity is not newly verified. MLB Historical 2014–2025 is unchanged.

## Unfinished vision and next increments

| Original area | Status after this increment | Next prerequisite/action |
|---|---|---|
| Draft → player story | PARTIAL | Confirmed school/draft/profile + collected years connected; candidate forecasts/media predictions/results, full entry/development/exit evidence still missing |
| Farm/minors, official Rookie, Prospects | SOURCE / RIGHTS BLOCKED | Independently admissible results/qualification/ranking source; young age is not a substitute |
| FA, Posting, transactions, team IN/OUT, retirement | SOURCE / RIGHTS BLOCKED | Structured dated evidence + independently matched IDs and permitted acquisition/storage/display; affiliation-year differences are not event evidence |
| Preseason / 2026 Japan Series | DATA / RIGHTS PENDING | Admitted actual competition data; never generate future results or use qualified-only tables as a full universe |
| Full Career / all-time Records / Record Watch | PARTIAL / SOURCE BLOCKED | Full season/career coverage and qualification; collected-year sum/high and same-age season comparison do not close this gap |
| Strength/change analysis | PARTIAL | Existing HOT/monthly/rising/splits, trends and age comparison usable within admitted scopes; no fabricated NPB BvP/pitch/Statcast metrics |
| Pitch, defense, baserunning, battery measurements | SOURCE / RIGHTS BLOCKED | Exact measurement/event definitions and licensed source; do not infer from Season aggregates |
| Favorites changes / notifications | PARTIAL | Existing local Watch and native infrastructure remain; closed-app delivery needs real scheduled evidence, device verification and owner configuration |
| Seasonal Home / related news | PARTIAL | Existing Games/CS/Draft navigation usable; a full seasonal editorial/event layer needs factual permitted inputs |
| Profile / identity / missing historical rows | PARTIAL | Prioritize independently matched Current identities (71 gaps) and classify 161 without admitted past rows; not all necessarily played in target years |
| Web offline shell | NOT IMPLEMENTED | Separate small release with versioned shell caching/update/rollback QA; existing validated data cache is not a fully offline Web shell |
| Android / Play | PARTIAL / OWNER GATE | Physical Pixel + TalkBack, original signer continuity, release custody/App Links/Privacy/Data safety/listing/testers/submission |
| Turso / scheduled backup / 2027 | BLOCKED / OPERATIONAL PENDING | Stable authorized reads, actual scheduled collection→encrypted backup→publication evidence; independently reviewed 2027 calendar/source |
| Astra full redesign | DEFERRED | Preserve current design during Product/data work; later redesign remains a separate scope |

Recommended order: (1) finish this collected-data story/age comparison, (2) classify and extend active-player historical/ID evidence, (3) admit competition/dated-event sources where public terms permit, (4) Web offline-shell and Android signing/device quality, (5) production evidence/2027, (6) later Astra design. Source/owner gates must not block independent Product increments. No inquiry or payment was made.

## Validation receipt

Domain/UI fixtures are synthetic only; they are not published as players/results. Regressions cover year-end age boundaries, unknown/absent identity/DOB/year/role, scope rejection, split-team ratios/nulls, independent failures/retries, 30/4 limits, Back/cache, explicit Save versus automatic Activity, source retention and story missing-data states. Native instrumentation adds a ninth actual-data scenario for 2025佐藤輝明 versus 2024牧秀悟 at year-end 26, 200% Activity recreation, and the recorded-season story. Full checks, Android/browser/public proof and review are recorded on the delivery PR after actual execution; unrun physical Pixel/TalkBack are never counted as PASS.

## User correction — Japanese same-grade grouping

The primary peer entry uses `cohort=schoolYear`: verified birthdays from **April 2 through April 1 of the following calendar year**, matching the [MEXT explanation](https://www.mext.go.jp/a_menu/shotou/shugaku/detail/1422233.htm) checked 2026-10-18. April 1 belongs to the preceding group; March 31/January 1 and leap-day birthdays are covered by boundary tests. Display the complete birthday range and each member's DOB. Do not infer actual enrollment/graduation, repeated/skipped grades, common school or foreign school-year systems. Unknown DOB remains excluded/unavailable. Existing `birthYear` links retain calendar-year semantics; draft-year and age-season comparisons remain separate. Saved conditions/share/native Back/reload preserve the new kind without changing the Activity privacy rule. For example Maki (1998-04-21) and Sato (1999-03-13) belong to the same Japanese grade grouping.
