# Product Completion & NPB Operations — 2026-10-11

Baseline: `c2a7f49` (PR #20 / #21). New sources, remote canonical writes, paid services, registration and Android release publication are outside this batch. Additional recurring infrastructure cost remains ¥0. Evidence files and raw archives stay ignored under `.data/product-ops/`.

## NPB root cause and fixes

Scheduled [38089599775](https://github.com/tomoya41/baseball-notes/actions/runs/38089599775) failed after collection on target 2026-10-10. Complete raw job logs and a read-only diagnostic reproduced the final generation check failure: Directory/HOT effectiveDate 10/10, Season 10/07. Regular Season collection correctly clamped its Fact window to the configured 10/07 cutoff, but Season mistakenly used that window end as the projection observation date. No evidence supports labeling this as an identity or missing-game failure.

Season now takes the coordinated Directory observation date, retaining the original Fact period and Coverage. Team Season and Season checkpoints accept `period.to <= effectiveDate` and reject future Fact periods. Game index Coverage likewise remains clamped to the Regular cutoff; later calendar dates are empty/unknown, not fabricated complete days. Existing wire fields and schema versions remain compatible.

Daily, EOD and read-only Season publishing use the existing formal HOT publisher with verified canonical display metadata. Its scheduled proof predicate is unchanged: actual Scheduled collector/operational/backup success plus the latest scheduled workflow success and expected encrypted artifact. A manual diagnostic or publish is not proof. HOT artifact staging and Game Surface consume the same dated projection. Diagnostic-only mode does not configure/deploy Pages; whole-family consistency, idempotency and backup restore still run.

Read-only [38133591557](https://github.com/tomoya41/baseball-notes/actions/runs/38133591557) passed. Observation 10/10, Regular period through 10/07: 739 Season participants; Directory/Catalog 740 canonical players; 164 complete, 25 no-game, **6 partial** dates. Recent7 complete, Recent14/30 partial. HOT has 206 complete players, 249 candidates; eligible batting **0**, starters **12**, relievers **8**. Formal output remains empty/not-ready, with `category_not_ready` and `scheduled_production_evidence_pending`. Metadata is now resolved through the formal join, without filling unknown identity or source conflict by guesswork. Ranking remains closed due to partial Season Coverage. Production idempotency report: **canonicalWrites 0**. Portable export / scratch restore passed separately.

The correction has passed reproduced diagnostics; the next real Scheduled success is still required to establish operational evidence. No gate is relaxed. Latest saved profile conflicts and unresolved identity remain the separate Data Quality track.

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

Initial JS: **481.95KB / 149.22KB gzip**, compared with 481.86KB / 149.18KB previously; the form route is 13.72KB / 5.67KB gzip. New month comparison reuses existing month shards (maximum two) and adds no payload family. Rolling mode loads at most three month shards. Render limit 20; Watch at most 12 followed players; Home additional form fetch **0**. Year expansion stays partitioned/lazy, never bundles the canonical DB or raw PA into the app.

The new [Astra handoff](astra-product-completion-handoff.md) maps routes/states/hierarchy, source-dependent differences, local and domain boundaries and the user's audit. UI redesign may proceed over admitted data, separately from Scheduled proof, source blockers and signed/device release QA. No large UI redesign is part of this delivery.

Delivery / final validation evidence is recorded below after review and publication.
