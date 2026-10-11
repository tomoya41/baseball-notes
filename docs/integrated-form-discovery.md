# Integrated Form Discovery — 2026-10-11

## Scope / safety

Baseline: PR #19 / main `5467c5bfd81a904e1d6b71137fd7e4dfbcc5c92e`. MLB Historical 2016–2025 only. This delivery adds read-only role/period aggregates and product surfaces. No canonical DB writes, migrations, new provider, paid infrastructure, Current MLB, tracking, image, or production push. Existing Season qualification, official record ranks, Facts, PA/BvP semantics, Coverage and NPB Production Gates remain unchanged. Regular and Postseason have separate directories, manifests, roles and calculations.

## Player roles: display, not official eligibility

`player-display-role.ts` is shared by Search, Profile, Explorer, Compare, Records and Team lists. Standard batting keeps fielders, DH and unknown roles; verified pitcher-only batting is a secondary filter. All batting Facts remain accessible in Profile and in the all-player view. Profile can collapse pitcher batting without removing its statistics. Explicitly selected Compare participants remain selected. Official qualification/ranks are never recomputed by a display filter.

MLB uses dated **same Season / same competition** Retrosheet fielding and DH evidence; future dates are excluded at an historical as-of date. Missing evidence remains unknown, rather than inferring pitcher from an appearance. A DH batting season remains in standard batting even with no pitching, including the 2024 use case. The separate two-way *season evidence* requires at least 60 pitching outs and 20 starter-DH games of at least 3 PA, and records the first date both thresholds were reached. This is a product evidence criterion, not an official roster/two-way designation or an attribute automatically applied to every season. NPB uses existing verified profile positions only; current unknown position is not inferred.

## HOT / Monthly / Rising-Cooling policy

Route: `#/MLB/form?season=2024&asOfDate=2024-08-20&period=7&mode=hot&category=batting`. `mode=monthly|change`, `category=starters|relievers`, `competition=postseason`, `battingView=pitchers|all`, team, favorites, change state and page are URL state. Native custom links and portable sharing preserve valid state. Five primary destinations stay unchanged.

HOT uses inclusive 7/14/30 calendar-day windows ending at the exact as-of date. Batting minimum PA = 20/40/80. Starter minimum outs = 15/30/60 plus at least ceil(days/7) starts. Relief minimum outs = 6/12/24 plus at least 2*ceil(days/7) appearances. Mixed-role pitchers have separate appearance aggregates; unknown-role rows suppress pitching evaluation. Zero-out relief retains conceded runs but cannot alone qualify. Null metrics are never zero.

Ordering is transparent lexicographic, not an arbitrary mixed-unit score: batting OPS, PA, HR, H descending; pitching ERA ascending, K/9 descending, then outs (starter) or appearances (relief), then outs. Final ties use canonical ID. This is an app-defined evaluation, not an official leaderboard/award. Reasons display the actual rate, sample and counting facts.

Monthly candidates are Regular-only calendar-month-to-asOf aggregates. Minimums: 80 PA; 60 starter outs / 4 starts; 24 relief outs / 8 appearances. Calendar month-end and in-month observations are visibly different. No Postseason monthly award analogy is made. Calendar-month candidates link to **Season Compare**, explicitly labelled; HOT/change link to same-day window Compare. Monthly is not passed off as a 7-day comparison.

Changes compare adjacent equal-length windows. OPS change of at least +.100 / -.100, or ERA reduction/increase of at least 1.00 produces rising/cooling; otherwise stable. Both periods must satisfy sample/coverage/metric rules. Insufficient data is separate; nonappearance is not cooling. Unknown pitching roles in either period suppress evaluation. No future Season total is used. Team filtering selects players who appeared for that team within the window; transferred players' combined window results remain combined, and the UI discloses this. It is not a team-only split.

## Projection / validation / publication

New paths: `(postseason/)exploration/form/<season>/index.json.gz` and `<YYYY-MM>.json.gz`. Index includes scope, complete-coverage admission, Game count, exact first/last dates, canonical roles/dates, existing Game gzip SHA fingerprint and official source archive hash. Month shards are compact Player/Team dictionaries and aggregate rows, not PA or raw events. Strict validators reject duplicate dictionaries/rows, cross-scope, invalid dates/roles, unknown identities and inconsistent generations.

Generator checks the existing canonical Game date, teams, score and complete batting/pitching arrays against the same licensed processed CSV importer before producing any role supplement. It does not silently accept source corrections. Per-game batting appearances for both teams are retained, while G is deduplicated by canonical Game ID. This handles suspended-game team changes without a player-specific patch.

`verify-historical-form.ts` independently reconstructs windows from immutable Game Facts using the existing canonical aggregators. It covers every month, Season midpoint, 7/14/30, calendar month, all categories, both competitions and prior-window differences. It also verifies every source Game gzip fingerprint and shard descriptor. Publication must pass this before creating the artifact.

`refresh_historical_form=true` on the existing `mlb-historical-publish.yml mode=app-only` preserves the entire released Historical tree, generates/validates the additive projections, verifies SHA of **all existing files** (`verify-form-preservation.ts`), and refreshes the preservation archive atomically with Pages. Existing NPB coordinated-family guards still run. Public readback validates all 20 indexes plus first/last monthly shard per scope; no credentials are on the deploy job. The app-only path neither imports Facts nor opens NPB gates. Do not reuse an old archive pointer after adding these projections.

## Rights / attribution

Primary materials checked 2026-10-11: [Retrosheet notice](https://www.retrosheet.org/notice.txt), [official processed CSV distribution](https://www.retrosheet.org/downloads/csvdownloads.html), [Chadwick Public Register](https://github.com/chadwickbureau/register). Retrosheet permits reuse/commercial use/redistribution with its specified credit; existing Retrosheet credit and Chadwick ODC-BY attribution are maintained. Same existing providers and canonical identity bridges only. No raw events, all PA, full Register, private DB or rights-unknown images are exposed to Pages. See the original rights evidence and Sources UI. nf3 remains provisional; this delivery does not expand its rights.

## Product / performance / Watch

Home links to HOT, monthly candidates and changes at the selected saved Season end, without new Home data fetches. Search, Profile, Explorer and Compare retain existing paths and gain contextual entrances. Detail filters and evaluation explanations are progressive disclosure; compact rows show players and numbers first. One document scroll, 20 rendered results/page, existing themes/glossary/focus styles.

HOT is a lazy route chunk (~13 KB raw); initial JS changes about +0.76 KB raw / +0.25 KB gzip from the PR #19 build. Reads: existing Directory plus one role index and at most three monthly shards; no all-player Profiles or PA fanout. Generated local projection: 106 files / 8,318,547 bytes compressed; largest shard 137,239 bytes. Existing Game/PA DB size delta is zero. Generation 250 seconds on Windows/OneDrive with cached official archives, 0 SELECT and 0 canonical writes. Measured final validation/runtime evidence is retained by the publication workflow.

Historical Watch is explicitly user-triggered from the standard HOT/monthly surface for at most 12 Favorites. TOP10 candidate membership shares existing local baseline, preferences, dedupe/read/dismiss rules. First observations do not alert. As-of rollback, incomplete/unknown coverage and offline/cached fallback do not generate new events. Labels indicate Historical data confirmation, not events occurring today. No browser/native/background push. Existing Recent-change Watch rules continue; collection/saved-condition discovery is not promoted into HOT.

## NPB readiness and operations — independent blockers

Public snapshot 2026-10-07: HOT `not_ready`, 7-day Coverage complete, scheduledProductionEvidence false, reasons `scheduled_production_evidence_pending` and `display_metadata_unavailable`; category candidate samples are separate from the public gate. Season/ranking remains partial/not_ready, including the 6 partial days. The copy now describes coverage, sample eligibility, display identity and scheduled publication requirements, rather than saying 7 complete days alone opens HOT.

Latest inspected scheduled Daily run [38089599775](https://github.com/tomoya41/baseball-notes/actions/runs/38089599775) (2026-10-10, baseline main) failed in **Build Web app with the same-origin validated JSON**; collection, validation and encrypted backup completed but Pages deploy was skipped. Logs do not prove the underlying failing condition, so this batch does not invent an operations fix. Its diagnostic 7-day data was complete but batting eligible count was 0; eligible starters/relievers did not justify relaxing batting rules. Latest inspected scheduled freshness run 38042984491 also failed. Successful EOD/manual runs are not substituted for scheduled publication proof. No NPB gate value or infrastructure phase is changed; NPB monthly candidates are not published.

## 2014–2015 preflight — not a new published release

Official archive-only isolated importer checks (2 downloads, 19,829,081 bytes, ~80 sec):

| Season / scope | Games | Players | Batting facts | Pitching facts | Source PA rows | Missing PBP / identity / boxscore issues |
|---|---:|---:|---:|---:|---:|---|
| 2014 Regular | 2,430 | 1,320 | 69,565 | 19,321 | 183,929 | 0 / 0 / 0 |
| 2014 Postseason | 32 | 230 | 980 | 303 | 2,469 | 0 / 0 / 0 |
| 2015 Regular | 2,429 | 1,348 | 70,534 | 19,964 | 183,628 | 0 / 0 / 0 |
| 2015 Postseason | 36 | 234 | 1,100 | 318 | 2,698 | 0 / 0 / 0 |

All five existing MLB round types mapped; roles/teams passed boxscore validation. These are **source PA rows**, not fully reconstructed/validated canonical PA. Full PA reconstruction, independent state/aggregate validation, portable restore, expanded free storage, full Pages/CI duration and browser performance remain unmeasured. `publicReady:false`; no manifest, existing validator year bounds, canonical DB or public year selector is expanded. Recommended next import unit **2015**, then 2014. Existing 4-year expansion implies roughly 0.31 GB regular DB growth for two similar years; that is an estimate, not evidence that the free capacity/CI gate is satisfied. Previous 10-year advanced generation took ~34 minutes; a 12-year end-to-end run must be measured before release. Preflight does not block these completed Product surfaces.

## Remaining original-vision gaps / recommended order

1. Operational Track: diagnose scheduled build/publication failure, show real scheduled success/freshness/backup proof, resolve required display metadata, then re-evaluate NPB HOT/ranking with existing sample/coverage gates. No automatic gate opening.
2. Historical Track: isolated 2015 full PA/capacity/restore proof, then 2014. Current MLB / full Career / all-time records remain unavailable, not replaced by limited historical data.
3. Source/rights Track: NPB Historical/Career/Postseason/transactions/FA/posting/preseason, official rookies/prospects and tracking need new permitted evidence. Existing verified Draft/young discovery and saved Season checkpoints do not complete these domains.
4. Product follow-up within available data: monthly-over-month changes, optional period-to-date Season comparisons, Favorite rising Watch summaries and advanced period filters. Current delivery provides adjacent equal-window changes; it does not claim every SPEC signal, award prediction, official Period Ranking or complete Career Record Watch.

Final device/TalkBack, release signing/App Links and Production Push QA remain manual. No Store release is performed. See Product Completion Inventory follow-up for the scope-specific classifications.

## Local validation evidence

1,126 tests / 96 files PASS, including the final standard `npm run check` with its default timeout. A simultaneous large-file audit earlier required a focused rerun of an unchanged artifact fixture; the final complete run also passed without a timeout override. Lint, strict typecheck, Web and Vercel build passed. All 52,986 original public Historical files / 228,996,982 bytes retain exact SHA; canonical writes 0. No new PA/Game Facts, no year expansion, no NPB payload modification. Android/PR/publication evidence is recorded in the delivery Run and PR.

Codex Review found a P2 in Cooling ordering: batting OPS declines and pitching ERA increases were listed smallest first. Sorting now reverses the improvement order specifically for Cooling, with independent batter/starter/reliever regression fixtures checking both Rising and Cooling and input-order determinism. Player navigation also preserves the selected 7/14/30-day window between tabs and the Historical HOT return link.

Independent validation: 23,168 Games, 2,184 windows/categories, 9,655,073 metric comparisons (including WHIP, BB/9, K% and BB%), mismatches 0, unknown-role rows 0 across all 20 scopes. Final local worst evaluation 189 ms, 20 rendered rows/page, up to 3 monthly fetches, 0 SQL queries. Final full audit elapsed 169 seconds. This worst local sample is not an Android device benchmark.

A second Codex P2 found that the NPB Stats tab omitted the overview's pitcher-batting display flag. Both tabs now use the same verified position, with route-level regression cases for pitcher, fielder and unknown position. All Facts remain accessible.

Further review hardened publication: form refresh fails before acquisition unless mode=app-only. Independent validation now derives expected player populations from original Game Facts for every window/category and rejects omitted players or empty categories before numeric comparison; source months, period bounds and complete role populations must also match. Omission fixtures cover batter/starter/reliever. This closes two additional P2 findings without changing any public Fact.

Final self-review additionally compares form coverage with the original manifest and independently validates all existing product metrics. The external Codex Review identified four P2 issues across three review rounds, all fixed and covered by regressions. Its final re-review request was refused by the account's free code-review usage limit; no paid credits were purchased. Final changes were reviewed here against the source Facts, publication path and invariant checks instead. This is not represented as a successful final external bot review.
