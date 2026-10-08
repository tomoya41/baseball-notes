# Product Completion Batch 7 audit

2026-10-08. Baseline: `11a75ad2cf40679fe0608f7a7eb12d631124f6f0`. No new source, canonical write, data migration, push backend or recurring service. Monthly additional cost remains ¥0.

## Findings and changes

| Finding | Resolution |
| --- | --- |
| Android parent navigation lost regular MLB year; team parent skipped catalog | Preserve validated season/competition; team parent returns league team list |
| Legacy MLB advanced route fell back to latest overview | Route to existing Analysis preserving season/as-of/competition; player list link also retains year |
| Impossible calendar dates could survive shared/deep-link parsing | Validate real ISO calendar dates, including leap days |
| Filter typing generated Back entries for every edit | Replace typing entries; keep intentional context changes in history |
| Historical hooks duplicated gzip acquisition/validation | Share application reader and in-flight decode/validation; do not retain settled generations |
| Screen navigation did not announce the new main content | Focus main on pathname transitions; query edits keep input focus |
| Unexpected render errors could remove the routed screen | Screen error boundary preserves shell and personal state; retry/route change recover |
| Dark selected-date text failed normal text contrast | Dark on-brand token changed; explicit/system themes covered by contrast tests |
| External notification setting could imply delivery readiness and throw during secondary storage reads | Explicit setup/delivery status, disabled unconfigured opt-in, contained read/write failures; no push added |
| README described obsolete sample/reference screens | Current navigation, actual capabilities and Watch semantics documented |

Metric dialogs have accessible names, native focus/Escape restoration and dialog announcement; loading status now includes screen-reader text. Existing reduced-motion, skip link and minimum tap targets remain. Boundary keys are namespaced to avoid collision with the shared-link control during route changes.

## Audit matrix

| Area | Evidence / boundary |
| --- | --- |
| Home / Today, Preview / Recap, Games | Actual saved NPB dates/scores; unavailable today is explicit. MLB remains historical. Watch summary acquires zero additional payloads |
| Search / Player / Team / Records / Milestones | Real canonical links/profile data; partial records and closed NPB ranking gates retained |
| Data / Recent / Season Explorer | URL filters, meaningful browser Back, bounded rows, minimum samples and incomplete coverage labels; no ranking-gate change |
| Player / Team / Season Compare, Trends | Existing scope/year/role semantics; NPB single saved year does not fabricate history |
| MLB BvP / Situational / Postseason | Actual exact-matchup aggregates and PA samples; historical Regular/Postseason isolation, no current-event claims |
| My / Collections / Saved Views / Activity / Favorites | Versioned local schemas, reload/migration, corruption/quota/reset/legacy isolation covered by regression tests |
| Watch | Baseline, same-fact dedup/corrections, read/unread/hidden, bounded preferences, stale/older/partial/offline fallback and Historical semantics covered |
| Glossary / Share / Export / Sources | Metric dialog keyboard behavior; canonical portable links; NPB export restriction and bounded MLB credits preserved |
| Android | Existing dialog/history/parent/root Back order and canonical link translation regression tests; debug APK and unsigned release AAB via Android CI |

## Performance

Concurrent reads of the same historical product now perform one acquisition/decode/validation/Japanese projection. Subsequent reads still observe corrections; failed reads can retry. Regular and Postseason paths and request adapters stay isolated. Tests verify these properties rather than introducing a stale permanent memoization cache.

Existing bounds: Collection pages 12 players, Compare 4 targets; Watch 12 players / 4 teams / 6 saved views, 100 alerts / 240 observations / 800 dedup IDs / 300KB state. Activity 60 items / 90 days, 20 collections / 100 players each and 20 saved views. Public cache retains at most 64MB / 400 responses with a 2MB per-response ceiling. Raw PA/event data are excluded.

Read-only public HTTP benchmark on Node 24.19.0 (single run; not Android device latency):

| Product | Response body bytes | Decoded bytes | Fetch ms | Decode/parse ms |
| --- | ---: | ---: | ---: | ---: |
| NPB Catalog | 1,249,191 | 1,249,191 | 98 | 5 |
| NPB Directory | 237,707 | 237,707 | 14 | 1 |
| NPB Recent 14 | 724,549 | 724,549 | 16 | 3 |
| NPB Season | 1,521,095 | 1,521,095 | 22 | 6 |
| MLB 2025 Season gzip | 259,799 | 3,641,340 | 237 | 15 |
| MLB 2025 Postseason gzip | 33,075 | 720,537 | 245 | 4 |
| MLB Ohtani profile gzip | 36,935 | 443,352 | 206 | 2 |

Fetch response body lengths are not browser wire-transfer measurements. Shared JS is approximately 344KB gzip / 1.15MB raw; the existing large-chunk warning remains a follow-up, not a runtime failure. No broad bundler/UI architecture rewrite was made.

## Verification and limits

Full tests include local persistence, public cache/offline fallback, migration, quota, backup/restore, rights/export, bounded acquisition and Watch cases. New regressions cover reader sharing/retry, route focus/error recovery, namespace collision, filter Back, date validity, historical year preservation, notification readiness failures and theme contrast. Web/Vercel and Android CI are delivery gates.

Actual browser audit uses the real public payloads at 360px in Light/Dark, with direct routes, navigation/Back, metric dialog focus/Escape, invalid links, loading/empty/partial/unavailable states and larger layouts. Public delivery compares 26 unchanged payload SHA-256 values, canonical IDs, profile/membership values, NPB Directory/Catalog/Capabilities/Milestones generations and gate values before/after app-only publication.

No source rights were expanded: existing NPB provisional scope, Retrosheet credit, Chadwick attribution, Wikimedia provenance and export restrictions remain. NPB Facts/Coverage/HOT/Ranking/Infrastructure and MLB Regular/Postseason semantics are unchanged. Data counts vary independently with scheduled NPB publication; delivery invariance is checked against the immediate pre-publish snapshot.

This is not a hardware certification or a production push test. Physical Android/TalkBack, actual background lifecycle behavior and true disconnected-device launch remain release QA. Source-dependent missing features are listed in [Astra handoff](astra-product-final-handoff.md) and do not block this product audit.
