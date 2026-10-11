# Product Completion & NPB Operations — 2026-10-11

Baseline: `c2a7f49` (PR #20 / #21). New sources, remote canonical writes, paid services, registration and Android release publication are outside this batch. Additional recurring infrastructure cost remains ¥0. Evidence files and raw archives stay ignored under `.data/product-ops/`.

## NPB root cause and fixes

Scheduled [38089599775](https://github.com/tomoya41/baseball-notes/actions/runs/38089599775) failed after collection on target 2026-10-10. Complete raw job logs and a read-only diagnostic reproduced the final generation check failure: Directory/HOT effectiveDate 10/10, Season 10/07. Regular Season collection correctly clamped its Fact window to the configured 10/07 cutoff, but Season mistakenly used that window end as the projection observation date. No evidence supports labeling this as an identity or missing-game failure.

Season now takes the coordinated Directory observation date, retaining the original Fact period and Coverage. Team Season and Season checkpoints accept `period.to <= effectiveDate` and reject future Fact periods. Game index Coverage likewise remains clamped to the Regular cutoff; later calendar dates are empty/unknown, not fabricated complete days. Existing wire fields and schema versions remain compatible.

Daily, EOD and read-only Season publishing use the existing formal HOT publisher with verified canonical display metadata. Its scheduled proof predicate is unchanged: actual Scheduled collector/operational/backup success plus the latest scheduled workflow success and expected encrypted artifact. A manual diagnostic or publish is not proof. HOT artifact staging and Game Surface consume the same dated projection. Diagnostic-only mode does not configure/deploy Pages; whole-family consistency, idempotency and backup restore still run.

Read-only [38133591557](https://github.com/tomoya41/baseball-notes/actions/runs/38133591557) passed. Observation 10/10, Regular period through 10/07: 739 Season participants; Directory/Catalog 740 canonical players; 164 complete, 25 no-game, **6 partial** dates. Recent7 complete, Recent14/30 partial. HOT has 206 complete players, 249 candidates; eligible batting **0**, starters **12**, relievers **8**. Formal output remains empty/not-ready, with `category_not_ready` and `scheduled_production_evidence_pending`. Metadata is now resolved through the formal join, without filling unknown identity or source conflict by guesswork. Ranking remains closed due to partial Season Coverage. Production idempotency report: **canonicalWrites 0**. Portable export / scratch restore passed separately.

The correction has passed reproduced diagnostics; the next real Scheduled success is still required to establish operational evidence. No gate is relaxed. The configured 10/07 end date has `endDateStatus: scheduled`, not final: this correction preserves the existing aggregate boundary and does not establish that the actual competition ended then. Any verified rescheduled Regular Game after it requires separate metadata/period review; neither that Game nor a future Postseason is inferred here. Latest saved profile conflicts and unresolved identity remain the separate Data Quality track.

## Existing-data Product completion

Historical change mode now supports a calendar-month versus previous-calendar-month comparison. At month end it compares full calendar months; during a month it compares the same day number, capped at the prior month's end. It compares rates, shows both samples and never substitutes a future Season total. Both periods must satisfy the existing monthly minimum: hitters 80 PA; starters 60 outs / 4 appearances; relievers 24 outs / 8 appearances. Missing/zero/null/incomplete/unknown-role samples suppress evaluation. Postseason calendar-month modes remain unavailable.

The UI exposes prior rate, prior sample and signed difference, keeping methodology behind ⓘ. Monthly aggregate does not link to an incorrectly labeled seven-day Recent comparison. Portable URL state supports the new mode. Favorite Watch confirmation now records Rising status in rolling and calendar comparisons, using existing bounded user-triggered baseline, read state, dedupe and stale/partial controls. It is not Push or a present-day MLB event.

Collected-range/decade Records, saved-season Timeline, profile period analysis, Explorer/Compare and exact PA analysis already exist and are retained rather than duplicated. More nuanced as-of Season-baseline comparison and dedicated monthly Profile/Compare remain Product gaps, not falsely completed by the above.

## 2014–2015 admission and preservation

Use the existing Retrosheet CSV/PBP archives, Chadwick identity and independent validators. Import into isolated release SQLite only; preserve existing 2016–2025 released Game/Facts, identities, yearly Season/Team/Records/advanced/Recent/form payload bytes. Expanded range aggregates may change only to include admitted new years. The expansion verifies all old decoded immutable content before reusing baseline bytes; a second full check includes exploration shards. Public release/archive refresh and Pages staging remain coordinated, with the shared closed-world Postseason guard immediately before upload.

| Season / scope | Games | Players | Batting Facts | Pitching Facts | Canonical PA | Isolated SQLite with PA |
|---|---:|---:|---:|---:|---:|---:|
| 2015 Regular | 2,429 | 1,348 | 70,534 | 19,964 | 183,628 | 169,340,928 B |
| 2015 Postseason | 36 | 234 | 1,100 | 318 | 2,698 | 2,781,184 B |
| 2014 Regular | 2,430 | 1,320 | 69,565 | 19,321 | 183,929 | 169,295,872 B |
| 2014 Postseason | 32 | 230 | 980 | 303 | 2,469 | 2,564,096 B |

Local reconstruction for every listed Game: missing PBP / skipped games / parser failures / unresolved identities / unexplained counting mismatches **0**. Substitution-during-PA unknown initial contexts remain null according to existing parser semantics. PA runtimes: 2015 Regular 77.591s / Postseason 13.029s; 2014 Regular 85.148s / Postseason 13.085s. All-year CI, old-release SHA preservation, independent CSV season aggregates, backup/scratch restore and public readback are required before release; local proof alone does not claim admission.

2014/2015 scheduled 162-game qualification uses year-specific primary evidence: [2014 schedule](https://www.mlb.com/news/colorado-rockies-2014-schedule-released/c-60136492), [2015 final-day scenarios](https://www.mlb.com/news/scenarios-for-final-day-of-2015-season/c-153136576). Official round cross-checks: [2014 Postseason](https://www.mlb.com/postseason/history/2014), [2015 Postseason](https://www.mlb.com/postseason/history/2015). Accessed 2026-10-11. No actual cancelled game silently reduces the scheduled title denominator; rules/exception semantics remain unchanged. These years use the existing one-game Wild Card model, followed by Division Series / ALCS / NLCS / World Series. No Current data provider is introduced.

## Review, performance and handoff

Recheck PR #20's final population, Cooling ordering, role filters and app-only form-refresh guard, and PR #21's final closed-world Postseason publication guard. New expansion generates/revalidates all form shards and byte-preserves every old shard; it does not use the app-only refresh flag to bypass an immutable release check. Verification-only mode produces evidence/backup artifacts but creates no public release and deploys no Pages.

External PR #22 review found two P1 publication issues: old 2016–2025 exploration path regexes despite widened payload schemas, and legacy single-scope release modes admitting candidate years without expansion-only guards. Fixes route path years through the validated schemas (with wrong-year/month/scope regressions) and limit data publication to coordinated `expansion`. Legacy `release` / `postseason` input is rejected before checkout/download/import; the workflow default is `app-only`. Direct isolated CLI imports remain available, but public admission always verifies both competitions and the full old-release family. This is a deliberate safety restriction, not a relaxed gate or a change to Regular/Postseason calculations.

Initial JS: **481.95KB / 149.22KB gzip**, compared with 481.86KB / 149.18KB previously; the form route is 13.72KB / 5.67KB gzip. New month comparison reuses existing month shards (maximum two) and adds no payload family. Rolling mode loads at most three month shards. Render limit 20; Watch at most 12 followed players; Home additional form fetch **0**. Year expansion stays partitioned/lazy, never bundles the canonical DB or raw PA into the app.

The new [Astra handoff](astra-product-completion-handoff.md) maps routes/states/hierarchy, source-dependent differences, local and domain boundaries and the user's audit. UI redesign may proceed over admitted data, separately from Scheduled proof, source blockers and signed/device release QA. No large UI redesign is part of this delivery.

Delivery / final validation evidence is recorded below after review and publication.

## Integrated verification evidence

Verification-only [38136005841](https://github.com/tomoya41/baseball-notes/actions/runs/38136005841) passed in 52m12s without release creation or Pages deployment. Regular imports/reconstruction/audit/restore took 30m46s; Postseason 7m40s; coordinated staging/independent verification 11m06s. All 27,623 Regular and 472 Postseason Games reconstructed. Regular PA 2,088,943; missing identities, parser failures and unexplained counting mismatches remain zero. Regular isolated SQLite with PA is 1,925,300,224 B. This is release-worker/local storage, not a new Turso allocation. Both portable competition backups and the combined NPB/MLB restore passed.

Old-release verification: 42,927 payload hashes, 5,071 profile snapshots and 10 previous Team Hub snapshots unchanged. Independent CSV/player-aggregate comparisons passed for 2014–2019 in both scopes. Form validation checked 28,095 Games, 3,024 windows and 14,338,738 metric comparisons. Form projections total 128 files / 9,997,438 compressed bytes / largest 137,239 B; generation 182.284s, source requests 0, canonical writes 0. Advanced Regular aggregates total 142,142,554 compressed bytes / 21,092 files / largest 57,786 B; querying one exact Ohtani–Valdez matchup uses one indexed SELECT. Final whole-site closed-world/publication gate passed as well. Old and new-year evidence is retained in the run artifacts; raw archives/PA are not Pages payloads.

Subsequent external review identified the missing GitHub token forwarding and a self-proof deadlock: Daily HOT generation was asking for successful completion of the still-running Daily workflow. Token forwarding now covers both run/artifact requests; secrets are excluded from diagnostics. The existing read-only Season publication workflow listens for a **completed, successful, same-repository, main-branch Scheduled Daily workflow** and re-evaluates the unchanged formal HOT gate afterwards. It never collects or labels a manual run as Scheduled; it executes trusted main code rather than a workflow-run-controlled SHA or PR artifact. Early Daily output safely remains not-ready until completed proof exists. Failure, foreign-repository, manual and non-main callbacks cannot publish. This fixes operational ordering without weakening eligibility, target-date, backup, completeness or infrastructure evidence requirements.
