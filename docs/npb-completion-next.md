# NPB completion: saved CS observations, earlier seasons and player progression

Inspection date: 2026-10-16 JST. Baseline main `7d80cd608f5708254dde0ff8cd861d2fc8bfaf9c` (PR #36). This delivery does not write the canonical database, replace nf3, relax a Production Gate, or add paid infrastructure.

## Completed implementation and data admission

| Area | Verified result | Boundary |
| --- | --- | --- |
| Current Player/Recent during API failure | Read existing published season/7/14/30-day projections after API failure, with exact player identity, publication date, original coverage and null values | API/Turso restoration is not claimed; no monthly projection invented; no Watch/Gate evidence |
| Earlier Regular years | 234 additional club-season rows, 124 batting / 110 pitching, for existing saved Directory identities | No new OB identities, no 2026 facts, no inferred game facts |
| Regular release v6 | 598 players / 3,324 rows, batting 1,799 / pitching 1,525; actual admitted years 2002–2025 | All years partial; no rows admitted for 2000/2001 |
| 2026 CS | 8 observed-final score records; 125 players / 125 stage-team-role rows, 97 batting / 28 pitching | Only collected participant tables; not tournament totals, standings, advancement, qualified ranking or complete box scores |
| Player progression | Up to four selected historical years, metric chart, missing-year breaks, club-season observations, collected-range best, scoped sum and per-revision attribution | No inferred transfer date, missing-year zero or full Career claim |
| Historical pitching rates | WHIP / K/9 / BB/9 from independent H/BB/SO and integer outs when present; glossary scope updated | Not enabled for Current nf3's combined BB/HBP field |

Existing 3,090 Regular rows: unchanged 3,090 / changed 0 / missing 0 / identity changes 0. Historical-only identities remain 21 and their existing 119 rows are unchanged. The report field `newHistoricalOnly:21` counts all historical-only identities in the new dataset, **not 21 newly added identities**.

Saved Directory has 740 identities, not proof of active/registered status. Historical match remains 577; 163 lack admitted Regular history (73 lack independent bridges, 90 have bridges without admitted in-range rows). Earlier-year extension does not reduce these counts. No current uniform number, registration or primary position was inferred. Competing profile-source observations remain quarantined rather than automatically overwritten.

### Annual additions

| Year | Added batting | Added pitching | Total |
| --- | ---: | ---: | ---: |
| 2002 | 0 | 1 | 1 |
| 2003 | 1 | 1 | 2 |
| 2004 | 2 | 1 | 3 |
| 2005 | 2 | 2 | 4 |
| 2006 | 2 | 3 | 5 |
| 2007 | 4 | 5 | 9 |
| 2008 | 5 | 8 | 13 |
| 2009 | 5 | 10 | 15 |
| 2010 | 9 | 11 | 20 |
| 2011 | 14 | 11 | 25 |
| 2012 | 21 | 13 | 34 |
| 2013 | 26 | 20 | 46 |
| 2014 | 33 | 24 | 57 |
| 2015–2025 | 0 | 0 | 0 existing rows altered |

The old 55 quarantine items remain excluded. Four additional pre-2015 issues make 59 total; this is an expanded inspection range, not a regression in the previous admitted rows. WHIP disagreements, ambiguous extra columns and unknown numeric expressions have not been accepted by increasing tolerance. The six unsupported tables include new/foreign players without an in-range NPB annual table, so absence cannot automatically be repaired by a broader parser.

## Source rights and reproducibility

Use classification **B: conditional reuse** for Wikipedia text/table extraction under CC BY-SA 4.0. Conditions: per-article revision and author-history links, license, modifications, share-alike for the extracted dataset. Application source code licensing remains separate. No photos/logos, nf3 rights expansion, upstream GitHub dataset assumption or inquiry was introduced.

Official basis checked on 2026-10-16:

- [Wikimedia Terms §7, licensing/reuse](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use#7._Licensing_of_Content): attribution, modifications and applicable share-alike conditions.
- [MediaWiki API etiquette](https://www.mediawiki.org/wiki/API:Etiquette): bounded requests/cache. This import reprocesses previously acquired archives; source requests = 0.
- [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/): extracted/normalized datasets retain the license.

CS input uses archived MediaWiki revisions: Pacific page 5301694 / revision 111396986, Central page 5302364 / revision 111395902, archive observed `2026-10-16T05:05:23.865Z`. The future Japan Series article is excluded. Official NPB score pages were viewed only as diagnostic references (10/10 L–F, 10/11 G–DB, 10/14 T–DB); no official tables/raw content were imported or relabelled as Wikipedia.

CS identities require an explicit full linked article and an existing independently verified QID + NPB ID + canonical bridge. Abbreviations/plain names are rejected, not fuzzy-matched. Of 213 source exclusions, 144 are unverified article-identity row observations, 66 unsupported box-column layouts, 3 not-observed-final templates. These are not 213 distinct missing players. Blank BB/HBP/PA fields remain null; combined walks+HBP are never split. No future 0–0 template becomes a played game. No series advancement or advantage is inferred from these partial score records.

| Immutable artifact | SHA256 | Size |
| --- | --- | ---: |
| Regular v6 gzip | `3546cea6b2c3767c973739ab5a902c98b02a89e81d33e47444f079efabbd21b4` | 214,011 B |
| Regular archived source | `1e383d106ef9db5329aca692d08e938e4d10dd931e945a604bb859347cdd570f` | Existing private cache |
| CS v1 gzip | `2f66f68780e7c7605ad45a55f455535532f8a4011ccab18e60859821fab1e836` | 18,368 B |
| CS public body | `be7bc59301fa222850bd7301a4f62857064ccda3ffdece09192c1a221e92df71` | 111,154 B |

Import commands (all outputs ignored under `.data`, no canonical writes):

```powershell
npx tsx scripts/import-npb-historical-wikipedia.ts .data/npb-history-phase2/combined-archive.json .data/npb-completion-next/v6 --from-year=2000 --current-directory=.data/npb-history-pilot/baseline-data_npb_players_latest.json
npx tsx scripts/verify-npb-historical-expansion.ts .data/npb-active-expansion/v5/npb-historical-wikipedia.json.gz .data/npb-completion-next/v6/npb-historical-wikipedia.json.gz .data/npb-completion-next/v6/expansion.json
npx tsx scripts/import-npb-cs-wikipedia.ts .data/npb-active-expansion/wiki-2026-competition-archive.json .data/npb-history-phase2/combined-archive.json .data/npb-history-pilot/baseline-data_npb_players_latest.json .data/npb-completion-next/cs
```

Independent scratch SQLite readback and idempotent replay pass for both imports. Existing v3/v4/v5 public generations remain retained (36 files); rollback means reverting the small release pins, not overwriting published assets. Real input archives/quarantine/full article text are not committed. Only bounded licensed product projections are published.

## Product and performance rules

Historical uses manifest + selected year (2 initial requests); at most four selected years for comparison. CS has one bounded 111,154-byte hash-validated projection, rendering at most 30 player rows/page. Stage/role/search/page and year/metric comparison states remain in URLs and native deep links. Home additional fetches = 0. Regular v6: 25 public files / 2,244,409 B / maximum 354,459 B. Old historical postseason aggregate is retained separately (4 rows / 2,642 B).

Progression rates are recomputed from nullable components, never averaged. Rate best-value eligibility is an app display threshold: 100 recorded PA for AVG/OPS, 90 outs for pitching rates. ERA/WHIP/BB9 use minima; other metrics maxima; ties retain all years. Not official qualification. Profile Current and historical sections keep separate source/coverage and do not silently add 2026 partial data to historical totals.

## Operations and remaining tasks

Turso was BLOCKED during the 2026-10-16 investigation. On 2026-10-17 JST, scheduled EOD watcher [38958724866](https://github.com/tomoya41/baseball-notes/actions/runs/38958724866) performed one successful SQL read and correctly skipped outside the reviewed Regular calendar: zero writes, zero source requests, publication false. The preceding watcher [38933531322](https://github.com/tomoya41/baseball-notes/actions/runs/38933531322) still reported the blocked-read error. The exact account-side cause/recovery mechanism is **unknown**; [Turso usage documentation](https://docs.turso.tech/help/usage-and-billing) names quota blocking as a possibility, not proof of this account's cause. No plan/payment/credential/account change was made. Owner Console inspection is no longer needed to continue the delivery; if blocking recurs, usage/plan/reset remain useful diagnostic information.

Public Recent API returned HTTP 200 for exact canonical ID `3c4b8e86-5a0c-48cb-aeba-44676de9fa38` at `2026-10-16T20:03:43Z` (7d) and `20:03:46Z` (season), both with saved as-of 2026-10-12. Null 7d batting/pitching remains a valid empty observation, not zero statistics. No claim of new live data or permanent provider recovery.

Read-only integrity [38959550926](https://github.com/tomoya41/baseball-notes/actions/runs/38959550926) succeeded: 899 saved Games, 6 pending, 196 reviewed dates = 166 complete + 5 partial + 25 evidenced no-game; input errors 0 / evidence findings 0. Eight protected table counts/hashes were identical before/after, writes 0/source requests 0. Fact quality [38959555123](https://github.com/tomoya41/baseball-notes/actions/runs/38959555123) independently confirmed 23,548 batting / 7,142 pitching Facts, before/after unchanged (11 SELECTs). This is a successful integrity inspection of a **known-partial** database, not complete coverage.

Portable backup/independent scratch restore [38959630755](https://github.com/tomoya41/baseball-notes/actions/runs/38959630755) passed: schema 4, 17 tables, compressed export 1,649,165 B and repository readback. This manual transient restore drill is **not** newly retained encrypted Production backup or scheduled-collection evidence. Freshness remains stale, health warning outside the reviewed calendar, HOT/Ranking closed. No shortened-game refetch/repair or scheduled proof manufactured. Published-response fallback remains useful for future API outages.

Read-only period/HOT diagnostic [38959857662](https://github.com/tomoya41/baseball-notes/actions/runs/38959857662) passed at saved as-of 2026-10-12: 7d coverage complete, 142 candidates, eligible batting **0**, starters 5, relievers 3; readiness `not_ready` with `category_not_ready` and `scheduled_production_evidence_pending`. All three public entry arrays remain empty. Protected Game/Fact/mapping counts unchanged. Complete seven-day coverage is insufficient to open HOT; whole-Regular coverage remains partial and cannot open Ranking. This manual diagnostic is not scheduled proof.

| User task | Result / next safe step |
| --- | --- |
| 1 Turso | SQL/API read recovery observed; read-only integrity/restore revalidated; root cause unknown, scheduled skip is not Fact collection |
| 2 CS | Partial real scores + exact-ID participant observations implemented; recover additional reviewed column layouts next |
| 3 / 4 Current history / identity | 577/740 unchanged; 73 need independent IDs, 90 need admissible annual rows; no guessed merge |
| 5 / 13 profile fields | Existing conflict-aware values preserved; dated source observations/explicit units are next incremental work, not current-roster inference |
| 6 Preseason | No newly admitted reusable player-stat source this delivery; not a zero-performance state |
| 7 Japan Series | Future games excluded; only actual observed facts can be admitted after play |
| 8 2015–2025 | Existing 3,090 rows unchanged; targeted table-layout review remains |
| 9 pre-2015 | 234 rows added for existing saved identities, admitted range starts 2002 |
| 10 old postseason | Existing four rows retained; no unverified expansion |
| 11 affiliation | Recorded club-year comparisons implemented; no inferred transfer dates/complete history |
| 12 draft | Existing verified draft/school features preserved; no new joined-year inference |
| 14 six incomplete games | Evidence/rights hold remains; no production writes |
| 15 quarantine | Old 55 still excluded, four new older-year exclusions; reasons retained |
| Analysis | Historical chart, collected-range best, selected-year totals, transfer observations and scoped pitching rates implemented |
| Android | Physical ADB inventory empty; Pixel / TalkBack NOT RUN; emulator validation tracked below |
| 2027 / Push / Play / redesign | No source/gate assumptions or owner-only release actions; independent later units |

Recommended next development: recover supported full article links in the 66 CS layout exclusions, then independently evidenced Current identity gaps and source-dated profile observations. Monitor actual scheduled behavior independently of product work. Preseason/source permissions and six shortened-game final evidence remain separate gates.

## Delivery verification

Local post-review full tests: 124 files / 1,404 tests PASS. Lint, typecheck and Web/Vercel build PASS. Review P2 (historical-manifest failure blocking independent 2026 Current/CS views) fixed with two failure-isolation tests; skipped innings cannot become implicit zero and X is accepted only in the final home half. Replaying the CS archive after these checks preserved its admitted hash. Initial JS 490,890 B versus previous public 483,943 B (about +7 KB); CSS remains 66,769 B. Post-review CI/Android/public evidence is appended after actual runs; no emulator result is a physical-device PASS.

Codex external re-review completed at code commit `8a76061390e61e20465d4cc0f75155a404fd7968` with no new findings; the original P2 thread was fixed, explained and resolved. Subsequent edits are operational-evidence documentation only. Responsive browser inspection covered CS filters/player stages, saved Regular comparison and four-year progression at 360/390 Light/Dark and 768/1280 Light, with no document overflow. URL year/stage/role/metric transitions, reload, search empty state and keyboard metric-help focus were exercised. Screenshots are retained locally under `.data/npb-completion-next/screenshots/`; generated evidence is not committed as source code.
