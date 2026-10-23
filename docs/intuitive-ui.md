# Result-first baseball experience

Baseline: main `ba07237` (PR #66). Scope: presentation and the existing bounded public saved-results reader. No collector, source, canonical write, historical release or Gate changes.

## Design decisions

The initial viewport should answer a baseball question, rather than explain the application's functions. Previously NPB Home opened with unavailable Today information and a long empty Favorites explanation; search placed lifecycle shortcuts ahead of the search box; Profile repeated a dark panel, metric help icons and a large date field; HOT repeated evaluation text and used the same large treatment for every row.

- NPB Home leads with three seasonal destinations and a search entry. Saved results show their own date. Favorites content loads when relevant instead of showing a long empty instruction. Standings and follow views remain available.
- MLB Home keeps one featured player and compact supporting players; removes repeated team/comparison destinations. The selected historical season remains explicit. No form projection fetch is added.
- Profile uses the player's name and three major numbers as its heading. Year/competition stay above the player, while year history and comparison are direct links. The Recent cutoff is visible; opening it reveals the existing date field. Player tabs and their URLs remain unchanged.
- HOT keeps mode and active conditions visible, with secondary controls in the existing disclosure. One lead entry is prominent; subsequent entries are compact. Reasons, samples, comparison periods and links remain in the row disclosure. Evaluation and pagination are unchanged.
- Search prioritizes input/results. Team/role filters show their current selection while closed. Row comparison and collection controls share a labelled dialog; Favorites remains a direct action. Obsolete initial-only tiles are removed from these rows.
- NPB published-response fallback keeps its date, saved/unknown-freshness/partial status visible, but moves the repeated long warning into one disclosure and prioritizes batting AVG/HR/OPS or pitching ERA/IP/SO. The existing reader, null handling and all remaining metrics are retained.
- Metric labels themselves open the existing explanation dialog. A dotted underline signals interactivity without repeating a separate information icon at every number. Keyboard focus and accessible dialog labels remain.
- Phone density was corrected after two rounds of feedback. The first 24px name/title correction was insufficient. Final standard-size targets at 390px are body 14px, player name/headline numbers 20px, HOT lead name 17px, other names 15px and ordinary stats 16–17px. A guide button covers its own stat cell (at least 44px) instead of allocating a separate tall label row. Lead statistics share one row and wrap at enlarged Android font settings. This replaces the earlier assumption that oversized names/numbers alone produce a useful hierarchy.
- Game recap starts with two selected batters and one pitcher, plus any selected Favorites. Other already-selected recap entries expand on demand; box scores retain all stored players and values. No recap selection calculation changes.

## Density comparison, 2026-10-23

The first refinement reused the earlier research but did not adequately translate competitors' phone density into this app. After further user feedback, the following first-party promotional screenshots were opened and visually inspected again (not merely their descriptions):

- [Sportsnavi game screen](https://vos.line-scdn.net/landpress-content-v2-ghixa54r9emb25pxf5kyp63u/fc30cd211ed7472a88e8109a6a0f85b7-large.png), via [official app page](https://sports.yahoo.co.jp/promo/app/bblive/): compact player labels and consecutive stat rows; screen space belongs to baseball information rather than oversized captions.
- [NPB+ Player screenshot](https://www.japan-baseball.jp/npb-plus/img/capture_04.jpg?date=20260221), via [official page](https://www.japan-baseball.jp/npb-plus/): selected key metrics are emphasized, but the remaining metrics fit compact label/value lines. [Official game screenshot](https://www.japan-baseball.jp/npb-plus/img/capture_03.jpg?date=20260921) places score/context in a small header rather than a whole explanatory block.
- [FotMob official preview](https://www.fotmob.com/_next/static/media/download-mockup-en.9bf44f1b.png), via [download page](https://www.fotmob.com/download): repeated results are short rows with aligned scores, not separate promotional tiles.

These are visual composition references. Native apps were not installed or measured, so the app's chosen CSS pixel sizes are our decisions, not measured competitor font specifications. No competitor images, logos, photos, data or screen layout are copied into production. The resulting changes reduce standard body/name/value scales and remove the separate tall label row while retaining the full stat-cell guide target, scope, data warnings and enlarged OS text.

## Data and performance boundaries

The scores Home reads the existing `games/recent.json` (maximum six games) once, in place of its previous manifest/lookaround request. It does not add a Home request. Only final games at or before the feed cutoff and device date are displayed, with each game date and the feed cutoff visible. This feed does not create Day/Coverage evidence or claim anything about Today/no-games. The follow view retains the original Today reader and its existing request bound. Schedule remains the destination for date/next-game browsing. A failed feed shows an actionable unavailable state. No database queries are introduced.

This change preserves the five primary destinations, route validation, Current/Historical and Regular/Postseason separation, NPB HOT/Ranking closure, personal stores, Android platform handling and the offline application update mechanism. No external font, image, library or recurring service is added.

Rollback: revert this presentation commit and rebuild the app with the existing versioned service worker. Immutable data assets and saved personal data require no migration. Do not remove the service-worker deployment as a rollback method.

## Verification record

Local browser checks and release evidence are recorded in `.data/intuitive-ui/` (ignored). Before/After screenshots use the same 2024 MLB player and the same 2024-08-20 HOT cutoff. Final phone-density captures use the `dense-` prefix; both `after-` and `compact-` captures belong to superseded iterations.

- Actual browser views: NPB Home; MLB Home; Ohtani 2024 and 2023 profiles; NPB Yanagita saved-response fallback; NPB Search/results/action dialog; historical HOT; MLB game/recap; scoped Compare. Phone checks cover 360/390px, Light/Dark. Additional views: 768px Player and 1280px HOT. No horizontal document overflow was observed on these views. This is focused QA, not a claim that every route/state was visually inspected.
- At 390px/standard text size the corrected HOT heading is 20px and its first row occupies about 161px. Three complete upper entries fit in the initial view. Profile name and headline values are 20px; stat guides are full-cell targets measuring at least 44px high. NPB partial/unknown-update status and cutoff remain visible with saved values.
- Interaction checks: scoped Player year/Compare links and Back; year change to 2023; Favorite retained after reload; search action dialog; OPS explanation and Escape/focus return. Local QA storage was used; no production personal data was cleared.
- Local full check: 171 test files, 1,782 tests passed, one platform-specific test skipped on Windows; lint/typecheck/Web/Vercel builds passed. Linux CI runs the platform-specific check. Retained publication verification passed for 86 assets with no source requests, canonical writes or HTTP requests during staging.
- Initial JS: 280,838 bytes. Combined CSS: 71,655 bytes. Offline shell: 37 files / 2,079,472 bytes, approximately 0.43% above the baseline shell. No additional image/font download or Home form fetch; scores Home makes one bounded saved-feed request. HOT rendering stays at 20 per page, Search at its existing progressive bound.
- [PR #67](https://github.com/tomoya41/baseball-notes/pull/67): review of the initial implementation identified an extra Home request. The follow reader was restored and scores Home now uses the single existing feed. Subsequent automated reviews of the route/fallback fixes and compact typography found no major issues. Android release checks and the added HOT 200% glyph-fitting assertion are available in [the final native run](https://github.com/tomoya41/baseball-notes/actions/workflows/android-beta.yml).

NPB Current API availability remains an independent operational limitation: a game API failure was observed locally, and Player used the existing published saved-response fallback. This release does not establish database recovery, repair Facts or open HOT/Ranking. Static publication checks cannot establish live canonical DB integrity. Pixel and TalkBack are NOT RUN because no physical ADB device was available. Native emulation is not physical QA.

Release procedure: merge the reviewed tree after required checks; use the existing `app-only` Pages workflow to preserve the coordinated data snapshot; verify public app hashes and protected data, then inspect the served UI. The existing service-worker update action activates the new app without deleting local Favorites/Collections/Watch.
