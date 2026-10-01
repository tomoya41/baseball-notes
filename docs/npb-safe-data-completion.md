# NPB Safe Data Completion — 2026-10-01

Scope: preserve the completed UI, existing canonical Facts, source adapters and Production Gates. Implement reusable data projections and connect the existing Season milestone destination. No schema migration, collector expansion, Operations reassessment, paid infrastructure or daily Wikidata job.

## Re-inventory

Classification applies to the **specific capability**, rather than saying that every NPB field is available or impossible.

| Group | Decision | Evidence / next requirement |
|---|---|---|
| Profile expansion | Safely implementable for reviewed identities | Structured Wikidata CC0 claims, exact reviewed canonical → NPB external ID → Wikidata entity; seven additional players implemented |
| Season milestones | Safely implementable in stored scope | Existing Season aggregate; app-defined counting checkpoints, no career/official-achievement/date/rank assertions |
| Game-level advanced Analysis | Already implemented safely | 7/14/30, Home/Away, Opponent, batting order, appearance role. No reason to duplicate these read models |
| Historical seasons | Source/rights research required | nf3 has a 2025 index. Historical coverage, preservation, source longevity and permission for expanded redistribution remain unverified |
| Career / career milestones | Source/rights research required | Requires reusable historical source **and complete player career coverage**. Current 2026 counts cannot substitute |
| Transactions / registration / removal | Source/rights research required | nf3公示履歴 exists, but current provisional scope does not authorize expanding into a new event collection |
| Trade / retirement / FA / Posting | Source/rights research required | Official announcements exist; need reusable event source, effective dates and identity evidence. A roster change is not a trade/FA event |
| Draft / Prospects | Source/rights research required | Official draft results and profile claims are candidates. No verified reusable, comprehensive source adopted; no prospect evaluation inferred |
| Preseason / camp | Source/rights research required | NPB official 2026 open-game results exist. Reuse permission and separate competition coverage not established |
| Uniform number / bats / throws | Source/rights research required for expansion | Existing source identifiers contain numbers, but cannot establish current, dated team membership. Reviewed Wikidata cohort lacks usable number/handedness claims |
| Direct BvP | Source/rights and semantics research required | nf3 exposes a public matchup-search page; no new search-result collector adopted. Exact matchup provenance, completeness, stable IDs and redistribution permission need verification |
| PA-level / inning / outs / base-state / score-context analysis | Currently impossible from adopted canonical data | No canonical NPB PA stream or deterministic initial states. Same-game participation is not a matchup |
| Photos / logos | Asset-specific rights research required | An image URL or a Wikidata link is not a license. Existing unavailable visual fallbacks retained |
| HOT / Counting Ranking / Rate Ranking / Records | Production Gate pending | Current Coverage/readiness retained; no “almost complete” bypass and no manual Scheduled proof |

**Source_available_not_implemented is not used to imply rights permission:** known pages with unconfirmed redistribution remain rights blockers. Safe profile fields for the reviewed cohort are now implemented; remaining profile population is not claimed complete.

## Primary-source / rights evidence

Accessed **2026-10-01**:

- [Wikidata licensing](https://www.wikidata.org/wiki/Wikidata:Licensing): “All structured data … is released into the public domain under Creative Commons Zero”. This covers structured claims/labels, not linked photos, Wikipedia prose or other sites. Free storage, modification and public redistribution are supported by CC0. Existing Data Sources screen links Wikidata/CC0; no portrait downloaded.
- [Wikidata data access](https://www.wikidata.org/wiki/Wikidata:Data_access): use documented Action API and a narrow Query Service query. One small ID query plus batched entity/label requests; no recurring poll.
- [NPB ID property P4260](https://www.wikidata.org/wiki/Property:P4260): exact identifier bridge. [Uniform number P1618](https://www.wikidata.org/wiki/Property:P1618) requires team/time context before it can represent current membership. Generic playing/shooting handedness is not interpreted as baseball bats/throws.
- [nf3 current index](https://nf3.sakura.ne.jp/), [2025 index](https://nf3.sakura.ne.jp/2025/), [公示履歴](https://nf3.sakura.ne.jp/Stats/kouji.htm), [打者−投手検索](https://nf3.sakura.ne.jp/php/vsSer.php): existence verified by read-only research. Index links resolved from the root, not incorrectly under `/Stats/`. No new canonical collection or broad reuse permission inferred from the disclaimer. Existing provisional adopted scope remains unchanged.
- [NPB official preseason results](https://npb.jp/preseason/2026/), [official social guideline](https://bis.npb.or.jp/social/guideline.html): useful reference, not an adopted automated redistribution source. The copyright URL was unavailable through the browsing tool; failure is not permission.
- [Nippon Baseball Data Repository](https://github.com/armstjc/Nippon-Baseball-Data-Repository): README identifies SPAIA as the upstream source for most data. A repository/code license alone does not verify upstream data reuse; not adopted.
- [2010 PBP forum release](https://www.japanesebaseball.com/forums/17/64293): upstream Yahoo/other copied data and noncommercial licensing are not sufficient permission for this application's production acquisition; not adopted.

No MLB Current, Statcast, paid API or third-party photos/logos collected.

## Reviewed identity / profile evidence

Reuses `npb-verified-nf3-identities.ts`'s already verified canonical/NPB page links. A narrow P4260 query returned one entity per eight external IDs. Seven are new profile supplements; Hayakawa is an existing reviewed profile. Labels differing from canonical names (Martinez, Osuna) do not change identity or display names.

| Canonical Player ID | NPB ID | Wikidata | Newly reusable fields |
|---|---|---|---|
| 7996a107-69eb-4950-820d-913760f6669e | 81285138 | Q58420279 | P, birthplace, nationality; year-only DOB stays null |
| 35e631df-8103-4fe3-8b9c-2231f8cf5247 | 81085150 | Q130726841 | DOB, birthplace, nationality; position unknown |
| 79e33d14-9021-4db8-a976-74c9d02df328 | 73975136 | Q52083715 | C, DOB, birthplace, nationality, height/weight |
| d4f78de4-1e08-4f51-9f18-9e064968866f | 23125136 | Q43426179 | C, DOB, birthplace, nationality, height/weight |
| 3095455f-01b8-452a-9b8a-fdd8991bfba3 | 53555153 | Q105259074 | OF, DOB, birthplace, nationality |
| 2ef0916f-a072-42fa-90ba-9b897506e86c | 61365136 | Q57314556 | P, DOB, birthplace, nationality, height/weight |
| a66dfd52-1ae2-4245-b849-558f263e6422 | 31835153 | Q102246615 | Existing Hayakawa profile preserved |
| a4d2116b-07d3-4a7a-8f8e-32f6d28759e4 | 13415155 | Q19793652 | P, DOB, birthplace, nationality, height; weight unknown |

Claims archive SHA256: `95886a354d452d1bf5673788f14902e370b09a4be5c98054810dc606c961d050`.
Related label archive SHA256: `13ae7907e18f3b5068754c6ad3127a36a23d6212d9f99d70f3f2b960d2378f3d`.
The committed fixture is a documented subset of those structured claims; full raw responses remain local. Reviewed snapshot records the local archive observation time. It is **not** an effective date for height/weight/current affiliation.

Update is explicit, reproducible and local:

```powershell
npx tsx scripts/review-npb-profile-supplement.ts claims.json labels.json <observedAt-UTC> reviewed.json
```

Before replacing the reviewed registry, review exact ID uniqueness and the bridge. Unknown claims/ranks/units/conflicts are not numeric patches. Preferred/deprecated ranks are respected; day-precision DOB required. Directory supplementation fills only null fields; conflicts are reported and existing values retained. No Player creation, source mapping mutation, team correction, bats/throws inference or role-availability inference.

## Contract / public projection

Directory v2, Catalog v1, Season v1 and existing capabilities v1 remain compatible. Original measurement snapshots preserve their own observation dates. `careerHistory` stays empty and uniform membership metadata stays null.

Additive capability: `seasonMilestones` (stored-scope, partially available); existing `milestones` refers to full career and stays blocked. New payload:

`data/npb/milestones/<season>/latest.json` — schemaVersion 1, canonical IDs, regular-season period/effective date, Coverage, observed complete counting metrics, previous/next app checkpoint. No raw Game Facts, source IDs, achievement date, ranking, predictions or career totals.

Intervals are app presentation conventions: H/RBI/SO 50, W 5, others 10. Unknown/partial metrics are omitted; known zero preserved. Coverage partial/unknown means the count represents **stored facts only**, not an exact whole-season result. Players ordered by Japanese name/canonical ID, not count/rank. Generation reuses the existing Season aggregate with **0 additional SELECTs / source requests**.

Connection: `#/NPB/milestones?tab=0`; Career tab remains Coming Soon without data requests. Search, 40-player bounded rendering, expandable counts, canonical Player stats link, loading/error/empty/legacy-unavailable states. Existing UI/CSS/navigation retained. MLB destinations unchanged.

Common directory/game-surface generators include the supplement; day workflows/schedules are unchanged. Publish preservation requires the new payload once its capability is advertised, but supports legacy deployments. Regenerate directory/catalog/capabilities/milestones together before rollout; new payload source dates must match. Do not merge an old catalog with a newer capability.

## Real-data projection verification

Read-only HTTP snapshot of public **2026-09-30** data, 735 players:

| Field | Before | After |
|---|---:|---:|
| Position | 3 | 9 |
| DOB | 4 | 10 |
| Birthplace | 3 | 10 |
| Nationality | 4 | 11 |
| Height | 3 | 7 |
| Weight | 2 | 5 |

Conflicts 0, unchanged known values/IDs/names/team membership/visuals, deterministic rerun PASS. Milestone projection: 735 players / 4,100 complete counting fields. Coverage retained **157 complete + 25 no_games + 6 partial + 0 unknown = 188 days**. This is the current public snapshot, not a reclassification of the prior 184-day window or a repair of rain-shortened games.

Measured generation 55 ms including four file writes, queries 0, canonical writes 0. Bytes: Directory 218,427; Catalog 522,130; Capabilities 7,810; Milestones 464,020 (including canonical team display context to distinguish same-name players). Existing Season 1.51 MB is not duplicated into the client milestone fetch. New screen fetches two static contracts; existing cached profile opening remains one Catalog fetch. No recurring job, service/dependency or additional monthly cost.

Verification:

```powershell
npx tsx scripts/verify-npb-safe-projections.ts <downloaded-public-snapshot> <output-directory>
```

It asserts original canonical metadata and Gates, idempotent projections and hashes. Production rollout remains a separate merge/publish step; local generated data is not represented as already deployed.

## Validation / remaining blockers

Local verification: 545 tests / 54 files PASS (24 new regressions), lint/typecheck/Web build/Vercel build/Capacitor sync PASS. Portable export/scratch restore over the existing local NPB snapshot PASS: 17 protected tables, schema version 4, 180,160 compressed bytes, row/value hashes verified. This is a local backup regression, not a new full remote NPB+MLB export. No schema or canonical data changed.

Original Facts/coverage, rain-shortened evidence, HOT/Ranking logic and Infrastructure Phase are not altered. Rights permission, full historical coverage, exact PA provenance and dated membership evidence remain prerequisites for the blocked capabilities above. The finished app can continue independently of those blockers.

## PR #2 review: coordinated projection publication

The original Directory-only workflow supplemented Search data but copied the old Catalog/Capabilities/Milestones. Same-day profile changes could therefore be inconsistent even when effectiveDate matched.

The Directory publication now preserves and validates the released family first, then regenerates Directory, Catalog, Capabilities and Milestones together using the new Directory and the **unchanged** released Season/HOT/Team Season. All four share the Directory generation timestamp. No source request, aggregate recalculation, canonical write, Coverage repair or Gate decision is added. When the read-only Directory is newer than the released Season, the job fails before staged projection writes; use the existing coordinated Season publisher to advance the date.

`validateNpbPublication` checks schemas, effective dates, projection generations, canonical identities, shared profile/affiliation/role fields, profile Capability counts, existing Gate consistency, Coverage, and Milestones against the preserved Season metrics. A legacy family without the new capability may omit Milestones; advertising it makes the file mandatory. Unknown/null values remain unknown. The game-surface generator also writes its enriched Directory alongside its Catalog, so the Daily manual preservation branch cannot publish an old Directory with a new Catalog.

Every existing Pages artifact upload now has a final consistency check after all copying/preservation, with the same publish condition as the upload. Missing/invalid/mixed contracts fail closed. Pages still deploys one complete artifact; a partial staging write never reaches upload. The Directory post-deploy HTTP check validates the whole family, not just Search. Existing workflow schedules, collector concurrency, Facts, UI and MLB semantics remain unchanged. Product idempotency hashes now include Directory and Milestones as well as Catalog/Capabilities/Team Season.

Regression covers same-date field drift, same-date timestamp drift, date advancement, stale Capability counts, identity mismatch, missing or corrupt Milestones, legacy rollout, complete Directory refresh, unchanged base payload bytes, rerun equality and all six Pages upload paths. This fix is staged in PR #2; no merge or publication was performed.

Review-fix verification: 563 tests / 55 files PASS (18 publication regressions added), lint/typecheck/Web/Vercel build PASS. The actual published 2026-09-30 snapshot (735 players) passed legacy-family validation, coordinated refresh, full-family validation and a second identical refresh locally. Season/HOT/Team Season SHA256s were unchanged. Public files were read only; no publish workflow was dispatched. CDN propagation retries require the whole family to become consistent before HTTP verification succeeds.

### Latest-HEAD review: HOT publication dependencies

The final guard also exposed an existing independent HOT publication boundary: a new HOT effectiveDate or readiness cannot be paired with preserved Capabilities/Season/Team Season. The HOT workflow now regenerates the dependent dated family from read-only canonical queries at the **generated HOT payload's effectiveDate**, then uploads one artifact and verifies the full public family after deploy. Directory and game-surface generators accept the same explicit publication date; latest stored affiliation remains labeled as such. The existing HOT evidence/eligibility engine, Season formulas, Coverage validator and Ranking Gates are unchanged. No canonical write or collection is added. Regressions cover same-date readiness changes, coordinated date advancement and the actual workflow staging/order/date contract.

The staged and post-deploy verification also cover Records, Game manifest, Recent Games and the bounded dated schedules referenced by Recent (plus effectiveDate). Dates, shared Game generation, canonical Recent rows and Records Gate/metric identity must agree; CDN propagation of just the profile family is insufficient for a successful publish.

Records generation and verification share the extracted existing eight-category projector. The whole result is compared, including category ordering, all qualified counting rows, deterministic tied ordering and competition ranks. Missing categories/rows or altered ranks cannot pass, even when the public Gate is closed. No Records formula or eligibility semantics changed.
