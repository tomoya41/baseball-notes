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

Turso remains **BLOCKED / latest canonical readback not verified**. Latest inspected Freshness scheduled run 38872296730 and EOD watcher 38857965030 fail with `SQL read operations are forbidden`; bounded diagnostic reported one SQL read, zero writes and zero nf3 requests. [Turso usage documentation](https://docs.turso.tech/help/usage-and-billing) explains quota blocking as one possible cause, but does not prove this account exceeded quota. [Provider status](https://status.turso.tech/) was operational on inspection; that does not prove an individual database is healthy. No local account-management access/credentials permit determining Owner Console usage/plan/reset. Owner must supply those three non-secret values or restore service in the account. No retries storm, paid plan, credential disclosure or second account.

Last verified pending 6 / partial 5 / stale and closed HOT/Ranking remain protected, **not a fresh SQL integrity PASS**. No repeated shortened-game fetching/dry-run, no canonical repair, no scheduled/backup proof manufactured. Published-response fallback is application availability only.

| User task | Result / next safe step |
| --- | --- |
| 1 Turso | Owner Console usage/plan/reset required; saved-stat display implemented independently |
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

Recommended next development: recover supported full article links in the 66 CS layout exclusions, then independently evidenced Current identity gaps and source-dated profile observations. Do not block this on Turso. Preseason/source permissions and six shortened-game final evidence remain separate gates.

## Delivery verification

Local full tests: 124 files / 1,400 tests PASS. Lint, typecheck and Web build PASS before PR. Post-review/build/Android/public evidence is appended after the corresponding actual runs; no emulator result is a physical-device PASS.
