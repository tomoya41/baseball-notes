# Product Expansion Batch 6 — Personal Watch

## Contract and scope

`#/NPB/watch-center` / `#/MLB/watch-center` are **in-app confirmation differences**, unrelated to the future live `WATCH` provider contract. Home shows two unread summaries from local storage and performs **zero additional data reads**. My links to the feed/preferences without adding a sixth primary destination. Evaluation occurs on entering Watch Center or explicitly checking data, not in a timer, service worker or background job.

First observation, newly tracked entities and preference changes establish a quiet baseline. Later successful reads compare normalized values against the preceding check. Wording is “前回確認時からデータ上変化” / “新しく確認できた試合記録”; observation time never claims an actual event time. An initial release smoke with unchanged real data correctly produces no alerts; synthetic change cases are covered only by tests.

`WatchObservation` contains league, canonical player/team identity (local view identity for Saved Views), rule, season, competition, projection content key, effectiveDate, generatedAt where available, eventDate, Coverage, compact numeric observations, observation timestamp and canonical detail route. No raw Facts/PA, search terms, source credentials or analytics are stored. Saved-condition membership stores canonical IDs (max 100) and a conditions fingerprint, not the query text. View labels remain local.

## Rules / independent availability

| Rule | NPB | MLB Historical |
|---|---|---|
| Latest player record / correction | Existing final Game Log, season/date bounded; partial records explicitly labelled | Latest saved complete regular season's Game Facts |
| Team result | Three published date indexes, matched to Game manifest generation | Latest complete historical Team Hub result |
| Next game | Only explicit scheduled rows in published today/next-day indexes; missing calendars do not imply a next game | Unavailable; no current/future assertion |
| 14-day OPS / ERA change | Bulk Recent, complete Coverage and complete metric/sample required | Existing profile Facts, selected latest imported complete regular season |
| Streak | Not admitted from truncated NPB Game Logs | Existing verified chronology and complete profile; exact hitting/on-base/scoreless tails only |
| Milestone | Existing coordinated milestone projection; complete Coverage required | Saved-season aggregate checkpoints |
| Series | Current Postseason source unavailable | Complete historical Hub; explicitly archival corrections/confirmation differences |
| Saved View entrant | All-player 7/14/30 NPB Recent conditions, complete Coverage/condition metrics, max 100 matches | Unavailable (bounded-cohort explorer is not a full-population projection) |

Recent thresholds are descriptive observation thresholds, not HOT, rank, quality labels or official qualification: both observations require 20 PA for OPS and 9 recorded outs for ERA. Absolute change ≥ .050 OPS / 1.00 ERA; Collection-only targets use .100 / 1.50. No unavailable metric becomes zero. Exact streak changes may include an ended streak; uncertain/“at least” tails are not alerted. Checkpoints reuse `seasonCheckpointSteps` (H/RBI/SO 50, HR/SB/SV/HLD 10, W 5), explicitly **saved Season**, never full Career or official achievement dates. Arrival/clinched-Series changes are High, record/streak/condition entrants Normal, numeric/proximity/next-plan changes Low. No AI categorization.

NPB Regular/Postseason never mix. MLB Watch defaults to the latest imported complete regular season (currently 2025); Series use the separate historical Postseason Hub. There is no 2026 MLB Current access. Team Recent and historical saved-condition watches are intentional remaining product gaps.

Record toggles affect record/next-game alerts only. Recent, confirmed streaks, checkpoints and historical Series remain independent: targets are acquired when any applicable enabled rule needs them. Unsupported Saved Views are filtered before the six-condition budget; only NPB 2026 all-player Recent conditions currently qualify.

## Freshness and publication

NPB effectiveDate must not be future and must be within three JST calendar days. Historical dates may be old by design but must match 2020–2025 season. Future generatedAt and generations whose JST calendar date precedes effectiveDate are rejected (UTC 15:00 is the JST day boundary). Older effectiveDate/generation/result sequence cannot roll back the baseline. Content, not regenerated timestamps, determines duplicates.

Directory and milestone projections must share effectiveDate/generatedAt. Bulk Recent uses its own validated period/generation with Directory effectiveDate + identity checks. Game date pages must share their Game manifest's generatedAt and Directory effectiveDate. Season aggregate and Directory are not incorrectly required to share a timestamp: existing coordinated milestone adapter owns that family check.

Offline checks retain the feed and do not advance observations. A response-cache fallback occurring during a check suppresses that entire evaluation; a monotonic cache fallback revision detects it even when a previous screen was already stale. Fresh later online reads can be evaluated. Independent failed reads preserve prior baselines for their active targets; removed/bounded-out subscriptions are pruned. The feed labels partial Coverage and old data. No HOT/Ranking/Infrastructure Gate changes.

## Storage / settings / privacy

`baseball:personal-watch:v1` is separate from Favorites and `baseball:personal-library:v1`. Preferences/observations/alerts use existing Preferences adapter (native Preferences on Android, localStorage on Web). Defaults: player/team record, confirmed streak, checkpoint and historical Series ON; Recent, Collections and Saved Views OFF. Settings update serially, reset baselines, and never request notification permission.

Limits: 12 Players, 4 Teams, 6 Saved Views per league/check; Favorites first, Collection members deduplicated. Up to 240 observations, 100 alerts, 800 content tombstones, 300,000 UTF-8 bytes. Alerts/observations retain 90 days; dedup tombstones are count bounded. Read, mark all read **within the current league**, dismiss and Watch-only reset preserve other namespaces. Schema v0 migration seeds retained alert dedup; unknown/corrupt formats remain untouched until explicit reset. Quota failure does not claim a successful confirmation or overwrite the persisted baseline. Preferences reset / dedup retention are intentionally bounded, not permanent event history.

Browser/native notifications were not added. Static Pages cannot guarantee background delivery; new FCM/backend/permission requirements are unnecessary for reliable in-app checks. Existing optional Android notification code and its external setup gate are unchanged and do not become Production verified through this batch.

## Cost / performance / rollback

No source acquisition, DB write, schema migration, static data expansion, cloud state, new dependencies or recurring services. ¥0 recurring cost remains. NPB worst-case bound is 23 reader calls (Directory 1, bulk Recent ≤3, milestones 1, logs ≤12 in groups of 3, manifest 1, date pages ≤5); MLB ≤19 (manifest/chronology, profiles ≤12, Team Hubs ≤4, Postseason Hub 1). Failures are bounded by the existing request timeout/cache adapter. Instrumentation reports targets, logical reader calls, total acquisition/normalization time, local bytes and alert limit; reader calls are not represented as exact wire/DB queries.

Local 360px real-data check: one NPB favorite + Recent ON = 4 reader calls, 837 ms acquisition/normalization, 1,496 bytes persisted. Actual partial Recent/Season were correctly not promoted to confirmed-change alerts. Public smoke/performance and CI evidence are reported with delivery.

Rollback is an application commit revert; leave/remove only the Watch namespace. There is no canonical migration or publication data change. App-only coordinated publish retains both MLB competition archives and NPB projections. Pre/post public SHA256/count/identity comparison covers unaffected projections.

## Validation

Regression tests cover first baseline, regeneration/dedup, result correction/doubleheader ordering, stale/future/older generations, complete-vs-partial/sample thresholds, exact-vs-uncertain streak, saved-season checkpoint proximity/arrival, Saved View entrants/cohort scope, historical/current separation, bounded reads, generation mismatch, read/unread/dismiss, reset/migration/corruption/quota, settings races, offline/cache fallback and Home's no-fetch summary. Native parent fallback for Watch is My; existing canonical entity links are reused.
