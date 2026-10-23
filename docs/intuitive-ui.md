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
- Phone density was corrected after feedback: player names 36→24px, HOT title 40→24px, leading rank 56→32px and leading OPS 44→24px at 390px/standard text size. Lead statistics share one row, and wrap at enlarged Android font settings. The global title, section spacing, featured Home and score rows also shrink. Body stays 15px; action targets remain at least 44px. This replaces the earlier assumption that oversized names/numbers alone produce a useful hierarchy.
- Game recap starts with two selected batters and one pitcher, plus any selected Favorites. Other already-selected recap entries expand on demand; box scores retain all stored players and values. No recap selection calculation changes.

## Data and performance boundaries

The scores Home reads the existing `games/recent.json` (maximum six games) once, in place of its previous manifest/lookaround request. It does not add a Home request. Only final games at or before the feed cutoff and device date are displayed, with each game date and the feed cutoff visible. This feed does not create Day/Coverage evidence or claim anything about Today/no-games. The follow view retains the original Today reader and its existing request bound. Schedule remains the destination for date/next-game browsing. A failed feed shows an actionable unavailable state. No database queries are introduced.

This change preserves the five primary destinations, route validation, Current/Historical and Regular/Postseason separation, NPB HOT/Ranking closure, personal stores, Android platform handling and the offline application update mechanism. No external font, image, library or recurring service is added.

Rollback: revert this presentation commit and rebuild the app with the existing versioned service worker. Immutable data assets and saved personal data require no migration. Do not remove the service-worker deployment as a rollback method.

## Verification record

Local browser checks and release evidence are recorded in `.data/intuitive-ui/` (ignored). Before/After screenshots use the same 2024 MLB player and the same 2024-08-20 HOT cutoff. Unavailable device checks must remain NOT RUN. Final QA and delivery results follow below.
