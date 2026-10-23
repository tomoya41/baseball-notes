# Result-first baseball experience

Baseline: main `ba07237` (PR #66). Scope: presentation and one bounded, existing public saved-results reader. No collector, source, canonical write, historical release or Gate changes.

## Design decisions

The initial viewport should answer a baseball question, rather than explain the application's functions. Previously NPB Home opened with unavailable Today information and a long empty Favorites explanation; search placed lifecycle shortcuts ahead of the search box; Profile repeated a dark panel, metric help icons and a large date field; HOT repeated evaluation text and used the same large treatment for every row.

- NPB Home leads with three seasonal destinations and a search entry. Saved results show their own date. Favorites content loads when relevant instead of showing a long empty instruction. Standings and follow views remain available.
- MLB Home keeps one featured player and compact supporting players; removes repeated team/comparison destinations. The selected historical season remains explicit. No form projection fetch is added.
- Profile uses the player's name and three major numbers as its heading. Year/competition stay above the player, while year history and comparison are direct links. The Recent cutoff is visible; opening it reveals the existing date field. Player tabs and their URLs remain unchanged.
- HOT keeps mode and active conditions visible, with secondary controls in the existing disclosure. One lead entry is prominent; subsequent entries are compact. Reasons, samples, comparison periods and links remain in the row disclosure. Evaluation and pagination are unchanged.
- Search prioritizes input/results. Team/role filters show their current selection while closed. Row comparison and collection controls share a labelled dialog; Favorites remains a direct action. Obsolete initial-only tiles are removed from these rows.
- Metric labels themselves open the existing explanation dialog. A dotted underline signals interactivity without repeating a separate information icon at every number. Keyboard focus and accessible dialog labels remain.
- Game recap starts with two selected batters and one pitcher, plus any selected Favorites. Other already-selected recap entries expand on demand; box scores retain all stored players and values. No recap selection calculation changes.

## Data and performance boundaries

After the saved calendar window, Home reads the existing `games/recent.json` (maximum six games) once, after reading the manifest. Only a matching effective date and final games inside the saved bounds are admitted. This feed does not create Day/Coverage evidence or turn an unavailable Today page into no-games. Failures and mismatched snapshots remain unavailable. In-season lookaround and its request bound are unchanged. No database queries are introduced.

This change preserves the five primary destinations, route validation, Current/Historical and Regular/Postseason separation, NPB HOT/Ranking closure, personal stores, Android platform handling and the offline application update mechanism. No external font, image, library or recurring service is added.

Rollback: revert this presentation commit and rebuild the app with the existing versioned service worker. Immutable data assets and saved personal data require no migration. Do not remove the service-worker deployment as a rollback method.

## Verification record

Local browser checks and release evidence are recorded in `.data/intuitive-ui/` (ignored). Before/After screenshots use the same 2024 MLB player and the same 2024-08-20 HOT cutoff. Unavailable device checks must remain NOT RUN. Final QA and delivery results are added below after execution.
