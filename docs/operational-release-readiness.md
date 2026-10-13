# Operational Stability / Release Readiness — 2026-10-13

Base: PR #27 / `ec8ca1c`. This delivery changes operational admission, Android QA and two focused interactions. No new source, recurring cost, signing key, Play delivery, statistical calculation, canonical identity, Fact, Coverage or Production Gate is introduced or changed.

## NPB lifecycle and monitoring

The reviewed 2026 Regular calendar is March 27–October 7, **scheduled**, not confirmed final. The canonical DB contains an October 8 Game. Do not declare the season finished, change its dates speculatively, or discard that Game.

| State | Handling |
| --- | --- |
| Empty date inside the reviewed acquisition window | Existing paired schedule / Day validation must establish `no_games`; absence alone is not evidence. |
| Date outside the reviewed window, without a saved fixture | `outside_reviewed_regular_calendar`: normal acquisition skip; no source calls, migration, DB write, Day record, Coverage upgrade or proof. |
| Saved fixture outside that window | Fail closed with metadata-review reason; preserve saved results. |
| Missing / failed acquisition inside the window | Existing retries, failure diagnostics and Gate apply. |
| Partial saved Facts | Remain partial; monitoring separately reports pending saved Games. |
| Valid retained snapshot after an acquisition skip | Raw wall-clock freshness remains `stale`. Separate `retained_saved_snapshot` operation mode requires independent DB/public date agreement, a successful saved Day, no newer saved fixture, zero target fixtures, and current successful Scheduled Action. HTTP, backup, incomplete latest Day, missing evidence or failed Action cannot be waived. This is neither Current freshness nor confirmed season completion. Older pending Games remain explicitly reported. |
| Missing reviewed year | Error, not successful off-season skip. 2027 needs reviewed metadata and provider readiness. |

The existing safety net can also skip an already published and revalidated Day. A skip never runs collection, regenerates projections, uploads a Fact backup or deploys. The completion callback now checks the **exact triggering Run** for the completed successful Day Facts step in a successful job. A successful workflow with skipped collection cannot admit publication. Manual aggregate dispatch remains manual and cannot establish Scheduled proof. HOT's SQL/backup/Action evidence checks are unchanged.

Daily skip diagnostics are retained for seven days as `npb-daily-lifecycle`, distinct from encrypted Fact backups. `check-npb-freshness.ts` adds a bounded read-only calendar inspection with latest saved Game, target fixtures, pending Games and metadata-review status. It does not label the season complete or stale data fresh.

### Evidence before merge

| Run | Event | Observation |
| --- | --- | --- |
| [38329720938](https://github.com/tomoya41/baseball-notes/actions/runs/38329720938) | Actual schedule / main | Daily success, October 12 target; existing proof rules apply. |
| [38330001144](https://github.com/tomoya41/baseball-notes/actions/runs/38330001144) | workflow_run / main | Aggregate completion callback succeeded. |
| [38342268503](https://github.com/tomoya41/baseball-notes/actions/runs/38342268503) | Actual schedule / main | EOD watcher succeeded. |
| [38359636737](https://github.com/tomoya41/baseball-notes/actions/runs/38359636737) | Actual schedule / old main | Calendar sync failed after attempting migration: date outside metadata. Fixed by preflight before migration. |
| [38367451160](https://github.com/tomoya41/baseball-notes/actions/runs/38367451160) | Manual / branch | Remote calendar sync succeeded: HTTP **0**, reads **1**, writes **0**, no source check. Not Scheduled proof. |
| [38367456055](https://github.com/tomoya41/baseball-notes/actions/runs/38367456055) | Manual / branch | Actual HTTP/DB freshness healthy; October 12 saved/public snapshot agrees. Latest saved Game October 8, pending saved Games **9**, calendar metadata review needed. Not Scheduled proof. |

Public snapshot: effectiveDate **2026-10-12**, master generatedAt **2026-10-13T01:00:59.063Z**, Directory/Catalog **740**, Season **739**. Season Coverage: 195 dates / 164 complete / 25 no-game / **6 partial**. Pending Game count 9 is a different unit from six partial dates. HOT `not_ready`, Scheduled evidence false, batting eligible 0, starter eligible 5, relief eligible 3, **public arrays empty**. Rankings `not_ready`: incomplete season, qualifier computation requires complete coverage, public ranking not enabled. Display metadata and canonical identities are retained; this batch does not cure these data/Gate blockers.

## Focused UX

- Player year and Regular/Postseason stay above identity and headlines. The previously icon-only action now visibly says **操作**. Compare, trends, history, collections remain in the same accessible sheet. URL/selected year/scope are unchanged.
- Game Recap removes the unrelated PA/IP/RBI help strip. Help is attached to each actual reported figure. Player links and help buttons are siblings, never nested interactive elements. Null, zero, highlights, sample, selection rules and competition links retain their meaning.
- No HOT filter redesign or new decoration. Existing PR #27 results-first filters, mobile tabs, long names and charts are checked rather than changed without cause.
- Before/after images are local ignored evidence under `.data/operational-readiness/`; release evidence can be attached to the PR. Native screenshots are captured by the existing emulator job. No photos/logos or new visual dependency.

## Android readiness boundaries

The existing custom scheme and HTTPS parser, native Back (dialog → history → parent → exit), App lifecycle network refresh, Preferences, cached validated response and shared UI remain unchanged. Updated instrumentation uses current Player/Home selectors rather than obsolete layouts or timed toast text. Additional checks cover real action-sheet Back, 150% system font and landscape sizing/recreation. Existing tests cover cold offline launch, cache restart, online recovery, theme, saved Favorite and Preferences process/activity restart.

Builds are debug APK and **unsigned** release AAB, with packaged-asset scans. Emulator is Android 36 x86_64 on the existing free public Actions runner. This does not certify physical hardware or all supported SDKs.

Manual release checklist (not performed by this delivery):

1. Physical Android Back/gestures, IME, rotation, font/display scales, low-memory background/restart and long names across supported devices.
2. TalkBack traversal, dialog focus, chart readings, contrast and touch behavior on a physical device.
3. Fresh install and warm cache under airplane mode, actual flaky network and recovery; verify Favorites, Collections, Saved Views and Watch baseline/read state.
4. Owner-approved signing key / backup / fingerprint / release signature verification. No key generation or replacement here.
5. Root-domain `/.well-known/assetlinks.json` and owner-approved signing certificate for verified App Links. A project-path file is insufficient. Custom-scheme tests are not verified App Links proof.
6. Play Console privacy/data-safety/store listing, release tracks and review. No Play submission in this batch.

Browser cold offline start still lacks a Service Worker guarantee; validated response fallback and native bundled-shell offline are distinct. Browser/Native Production Push is not added or claimed.

## Validation and delivery record

Full tests include calendar boundaries, impossible dates, missing year, known outside fixture, no-game non-proof, skipped/failed callback steps, retained snapshot failure modes and metric dialog/focus. Existing HOT/MVP/Rising, role, Regular/Postseason, persistence, Gate and attribution regression tests remain in the suite.

The app-only Pages path preserves both published NPB and the complete released MLB **2014–2025** archive. No collector import, historical expansion, raw redistribution or canonical write is performed by app publication. Hash/Contract checks compare against the actual predeploy HTTP baseline, independently from unrelated legitimate daily updates.

Final build, review, emulator, merge, Pages and HTTP results are recorded in the PR delivery comment; operational dispatches above remain explicitly manual. New scheduled post-merge runs must establish their own evidence. Do not promote this delivery to HOT/Ranking production readiness.

Next priority: review existing official calendar metadata against the saved October 8 fixture and audit the nine pending saved Games; validate the next real Scheduled skip/callback. Independently perform the physical Android release checklist. Source-blocked Current MLB, NPB Postseason, Career, roster/uniform information remain separate tracks.
