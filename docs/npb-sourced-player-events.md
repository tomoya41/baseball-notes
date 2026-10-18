# NPB sourced player events — first admitted increment

Reviewed 2026-10-19 (JST), baseline main `4cef88b` / PR #45. This is the first bounded licensed chronology view, not a complete transfer ledger, official announcement feed or general-purpose news reader. No Current statistics, canonical tables, roster registration, uniform numbers or Production Gates are written.

## Source admission and evidence

Condition **B — permitted subject to attribution/share-alike**: Japanese Wikipedia [2026年の日本プロ野球](https://ja.wikipedia.org/w/index.php?curid=5145794&oldid=111421457), page 5145794, revision 111421457, edited 2026-10-17T23:32:28Z, acquired 2026-10-18T20:54:19.944Z. Original content SHA256 `51aff04446e3349a242683962a92e2b0840c593689147e9c572e16ed550ee13a`. One documented Wikimedia API request; no cited media article body, photo or logo requests.

Rights basis checked 2026-10-19: [Wikimedia Terms §7](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use), [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), [API etiquette](https://www.mediawiki.org/wiki/API:Etiquette). The API's published access policy and license support bounded automated retrieval, storage, transformation and Web/Android reuse of admitted Wikipedia text with original revision/authors, license, modification notice and share-alike. This does not license third-party newspaper bodies or imagery linked in references. News-provider RSS/API/body acquisition is still unadmitted. No inquiry, payment, new account or credentials were used.

Only dated first sentences in できごと, with an associated reference and an explicit already-verified player article link, are parsed. Extracted text/classification is CC BY-SA 4.0; app code remains separately licensed. Per-row source links point to the immutable revision and authors; player identity evidence has its own article/revision. Reference markup is removed from the bounded excerpt, not passed off as directly reviewed official evidence.

Final v2 (same observations as v1): **19 events / 19 players**: 13 development-to-controlled contracts, 5 retirement announcements, 1 cash trade. Initial candidate 21 became 19 after enforcing citation association; two unsupported reference positions were not silently accepted. Quarantine contains hash-only diagnostics: 74 missing/multiple admitted player links, 27 missing associated citations, 2 unsupported grammars (103 total). These are rejected statements, not 103 verified transactions.

## Identity, date and correction semantics

- Pool: 136 existing canonical players, zero ambiguous article targets. Existing approved profile registries plus 21 reviewed article associations are checked against the collision-checked canonical UUID / NPB ID / QID bridge. Display names are presentation only. No new UUIDs or name-based merges.
- Article-registry additions reuse archived exact player revision/content hashes. The identity input SHA covers all three registry files plus the normalized canonical IDs/display names consumed from Directory (order/generation timestamps are excluded). Metadata corrections are reported separately from event edits. The static builder checks every admitted player's bridge independently.
- `encyclopedia_record` is the only emitted status. A text saying a club announced something remains an encyclopedia record here, not `official_announcement` certification.
- `recordedDate` means the chronology's event day. `announcementDate` / `effectiveDate` stay null. No inferred membership, retirement effective day, contract period or jersey. Future JST days and acquisition before revision time are rejected.
- Removed or changed excerpt/semantic rows are review candidates, never automatic factual retractions or roster edits. No consensus merging across providers. Source changes are separately reported.

## Product and delivery boundaries

`/NPB/moves` replaces only the existing NPB coming-soon route. Search, kind, club, specific player and Favorites filters retain URL/deep-link/Back behavior. Missing data means uncollected, not no transaction. Home, Player, Team and My link to the route; no primary navigation is added. MLB's unavailable movement route is unchanged. Favorites/Collections/Watch persistence is read-only and unchanged; no push/baseline event is invented.

The active projection is immutable `npb-events-wikipedia-20261019-v2`, one 14,317-byte JSON / 3,905-byte gzip asset, with both hashes and exact source revision pinned in `src/data/npb-player-events-release.json`. Previous publication families must be appended to `npb-player-events-retained-releases.json` when a later pin is promoted, so installed APKs retain their data URLs. Rollback means restore the previous app/pin and retain assets, not rewriting v1. v1 is retained (14,317 bytes / 3,907 gzip) after the review fix to bind Directory names into the input digest: two public JSON files total 28,634 bytes, one route fetch. All 19 observations and player values remain unchanged. Raw wikitext/private source cache and generated projections are not committed to Git.

The route lazily fetches one bounded verified static JSON, at most 15 rows per page. Home additional event/form fetches: **0**. No client Wikipedia or AI calls; IndexedDB stores only a hash/schema-validated public response for offline fallback. Shared in-flight reads do not prevent Retry after failure.

## Periodic collection versus AI/publication

GitHub Actions `NPB sourced player events check` is configured daily **08:17 JST**, one Wikimedia API request plus at most two own-site reads. 2 MB source budget, 250 KB normalized budget, no retries/payment fallback. It only uploads a CC BY-SA candidate/report/hash-only quarantine artifact (7 days), uses contents:read, no DB/AI secrets and no publish callback. A new year skips pending separate source admission. A skipped check is not Freshness health or scheduled Current Fact evidence.

Candidate detection is not automatic public promotion. Review exact source/identity/date/changes, replay locally, add a new immutable release/pin, retain previous assets, test/review/merge and preserve-published-only Pages publication. Empty, regressed, removed/corrected or unsupported claims require inspection; retain the last valid published snapshot on failure. Existing Plus/local Codex can assist review within plan limits; no OpenAI/Gemini paid API is provisioned. Source text is untrusted input and must never set commands, credentials or publication policy.

## Validation and remaining scope

Synthetic fixtures cover explicit IDs, name-only/multiple-player rejection, quotes/uncited text, source mismatch, reference formats, JST boundaries, deterministic dedupe, corrections, missing events, query/deep links, read-only favorites, UI error/Retry and validated offline readback. Android adds a real event deep-link/recreation/200% text case. Full release evidence is recorded below after it runs; no emulator/physical result is implied by a test file's existence.

FA/Posting/current draft results, media predictions, complete Team IN/OUT, official effective dates, always-on AI summarization and background push remain incomplete. Current NPB 6 pending games / 5 partial days / stale and closed HOT/Ranking remain separate; latest Turso DB integrity is not claimed. Full Career and roster registration remain unproved. Physical Pixel/signature continuity and TalkBack remain owner/device QA, separate from API36 emulator evidence.

## Local validation before merge

Full suite before the metadata review fix: 1,548 PASS / 1 existing SKIP. The review fix adds a Directory-name correction/order/identity regression; final CI results supersede this count. Web/Vercel build, lint/typecheck passed locally. Browser screenshots inspected at 360 and 390 Light/Dark, 768 and 1280 Dark; expandable source, empty FA condition, Reload/Back and exact player route checked. Reused filter-grid/search/pagination styles after the first mobile inspection exposed cramped inline filters; no CSS redesign. Error/Retry and offline validated cache have automated fixtures. Physical ADB inventory is empty: Pixel/TalkBack NOT RUN. API36 new test execution is pending publication, not claimed PASS.

Daily local Codex review automation `npb` was created ACTIVE for 09:00 JST in the existing chat. It reviews the candidate/report, summarizes only supported changes and can prepare a tested PR, with unchanged-state silence. PC/app must be running and existing plan quota available ([official schedule guidance](https://learn.chatgpt.com/docs/automations)); no billed API fallback. This is separate from GitHub candidate collection and does not promise unattended publication or push.

## Published evidence — PR #46

- [PR #46](https://github.com/tomoya41/baseball-notes/pull/46), merge `c01a4267365f6e86630021431cfac3feadf68677`. External Codex Review found one P2 (Directory metadata was absent from the admission digest); fixed with the regression above and an immutable v2, retained v1. Re-review of `395e76a` completed with no findings. Full suite **1,549 PASS / 1 existing SKIP**, lint/typecheck and Web/Vercel builds passed.
- [Pages run 39168233815](https://github.com/tomoya41/baseball-notes/actions/runs/39168233815) succeeded, preserving the published Current generation without DB/source refresh. [Public screen](https://tomoya41.github.io/baseball-notes/#/NPB/moves) displays 19 records. Independent public readback: all **18 protected NPB/MLB payload hashes unchanged**; Historical/CS/retained-event verification **120 HTTP reads PASS**. Canonical writes 0; latest remote DB integrity still unverified/Turso blocked.
- [First source check 39168523291](https://github.com/tomoya41/baseball-notes/actions/runs/39168523291) succeeded: one official Wikimedia API call, two own-site reads, 19 records, no added/removed/changed/player-metadata changes, identical source/identity input hash. It was **workflow_dispatch**, not an actual scheduled run or Current Fact/backup/publication proof. Its acquisition timestamp changes the candidate body hash but does not require republishing identical events. The local AI schedule has been configured, not claimed to have executed automatically yet.
- Entry JS changed from 496,716 to about 275,600 bytes as shared chunks were redistributed; this is not a claim of an equivalent first-render speedup. CSS remains **66,907 bytes**, event lazy chunk about **11.56 KB / 5.17 KB gzip**, no new fonts/images. Active route fetch 14,317 bytes, Home event fetch 0, 15 rows/page.
- Android debug APK **6,136,571 bytes**, SHA256 `f1518a5d9790bb2d74c0a36f05fd68210e1a69d5e388da0834dd293e0362c8f5`; unsigned AAB **4,546,998 bytes**, from [run 39168249718](https://github.com/tomoya41/baseball-notes/actions/runs/39168249718). Build passed. Instrumentation was **12/13**, not PASS: the new real event/deep-link/200% test passed; an existing shell test failed during OS font-scale recreation. No physical device was connected; do not assume CI debug signing matches the installed Pixel app.

### Configuration-transition harness correction

In the failed run, Back closed the dialog and returned Home correctly. The test later reached the actual Ohtani profile (`historical_player_ms=1540`) and screenshot, then changed OS font scale and immediately asked ActivityScenario to recreate. Native logs show overlapping Activity replacements at 21:39:45–48 UTC; ActivityScenario rejected a destroyed old instance. There is no `exitApp` at that point and this is not evidence of a Back failure.

The test helper now waits, bounded to 20 seconds, for a resumed Activity and the actual new WebView's native-provided `--android-font-scale` to match the requested scale for 500 ms, then performs the existing explicit recreation and all route/layout/persistence assertions. Only the expected DESTROYED transition may wait; an app that does not resume or apply the requested scale still fails. No app, font scale policy, Activity configuration flags, signing, data or gate changes. Final rerun evidence must be inspected before calling the whole emulator suite PASS; failed run remains linked above.

Review of the harness additionally identified AndroidX onActivity's exact destroyed-instance NullPointerException. The bounded guard now accepts that exact framework message/type as well as the observed IllegalStateException, while explicitly rejecting unrelated NPE/route/runtime errors. A dedicated instrumentation guard regression is added (14 total tests). Framework basis: https://github.com/android/android-test/blob/main/core/java/androidx/test/core/app/ActivityScenario.java . No general exception suppression or replacement of a failed result with PASS.

