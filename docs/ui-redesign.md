# Baseball Notes UI redesign

2026-09-30. The user's zero-based Android-first redesign replaces the old presentation layer. `astra-ui-redesign-handoff.md` still governs data, rights, canonical identities and capabilities.

## Information architecture

Five primary destinations: Home, Games, Players, Records and My. Analysis lives in a player's context; existing canonical Analysis links remain. General NPB Analysis opens search; MLB opens the verified Japanese cohort. League switching never carries another league's player/game ID.

Cross-league switching also clears season/date parameters because NPB Current and MLB Historical use different calendars. The target league opens its supported default context. Selecting the already active league preserves the current route and query, including a historical ranking year.

Within MLB, a selected-year search result, Game boxscore, leaderboard or BvP opponent link carries that year into the Player page; unrestricted search still defaults to the player's latest imported season.

Player tabs: Overview, Stats, Analysis, Game Log, Profile. Overview emphasizes saved Season and Recent with three recent game links. Details use disclosure. NPB splits retain the shared 30-day API bundle. MLB keeps season/as-of context in the URL and computes additional splits from the same saved player payload. Advanced BvP/situations load on request. Unsupported 2026 results never fall back to 2025.

NPB Home has Scores / Standings / Follow modes. MLB Home has Japanese Players / Follow / League modes, defaulting to a selected-year player watch board with actual OPS/HR and ERA/SO. Two-way players retain both rows; unavailable values stay unavailable. Only up to four existing individual profile payloads load for the board; the all-player Season aggregate is not fetched. League mode contains historical games and gated counting leaders. My combines local favorites with appearance, notifications, privacy and source credits. Light/dark/system uses the existing small-preference adapter; favorites keys and native storage remain unchanged.

## Visual system / rights

The 2026-10-01 composition replaces the original stack of panels: a watch board leads MLB Home, modes separate distinct Home tasks, a quick calendar leads schedules, and opposing teams surround the central Game score. Long Japanese club names break at their existing separator; the full identity remains in screen-reader labels and canonical links. The palette uses ink/slate with cobalt accents, compact context bars, a dark Player identity band and tabular numbers. Primary metrics share a ruled grid; rankings emphasize rank, player and value. Decorative copy and the previous large hero are removed. Colors are app identity, not official club palettes. Neutral player initials use actual names. Photos are accepted only through the existing explicit `usage=allowed` contract and attribution. Published NPB photos/logos remain unavailable. Profile and uniform fields render only when known. See `npb-batch-g-rights.md`.

The phone layout uses 13px body text, 24px Player headings and 24px primary values at the normal 16px root size. Touch targets remain at least 44px. Japanese-player identity and selected-year statistics appear together. Profiles use a full-width identity band and compact tabs. Phone lists and rankings use dividers rather than boxed sections. Relative sizing and scrollable tables preserve larger text settings. MLB period and split controls no longer consume several rows of wrapped chips.

Metric labels expose local, keyboard-accessible dialog explanations for OPS, OBP, SLG, K/9, BF, RISP and other known statistics. The dialog describes meaning, interpretation and caveats without changing any calculation. Rate qualification details remain available through disclosure; they are separate from metric definitions. Research and design decisions are recorded in `sports-ui-research.md`.

Game Details use scrollable tables and secondary-field disclosure. Null remains `—`, zero remains zero; innings use the existing outs-based formatter. Zero-PA participants and duplicate batting slots stay visible. NPB display order does not assert substitution or relief sequence. No inning score is invented.

## Verified Japanese MLB discovery

`src/data/mlb-japan-cohort.json` is presentation metadata, not a canonical Fact/membership migration. Wikidata Japan citizenship (P27/Q17), exact Retrosheet (P6976)/MLBAM (P3541) identifiers and existing Chadwick UUID mappings identify the cohort. A reviewed entity allowlist is required, with register Wikidata-key agreement where present. Names/kanji are not classification evidence. The 23 confirmed players can be filtered by imported season and historical team and favorited.

Sources, accessed 2026-09-30: [Wikidata structured data licence (CC0)](https://www.wikidata.org/wiki/Wikidata:Licensing), [Ohtani](https://www.wikidata.org/wiki/Q4391858), [Darvish](https://www.wikidata.org/wiki/Q940215), [Katoh](https://www.wikidata.org/wiki/Q16265263). Existing [Chadwick attribution](https://github.com/chadwickbureau/register) remains. An external ID does not authorize fetching external statistics.

Three conflicting query associations (Bryan Hoeing, Evan Carter, Roansy Contreras) were excluded by the reviewed entity allowlist. Unknown/conflicting status never asserts a negative nationality: all players remain accessible in unrestricted search. Refresh is explicit (`tsx scripts/update-mlb-japan-cohort.ts --fetch`), with downloaded register/index inputs, not a daily source request. No MLB Current collection is introduced.

## Future screens

These routes have internal structure and explicit Coming Soon output, without data requests or mock metrics:

| Route | Screen structure | Entry |
|---|---|---|
| `/NPB/players/:id/career` | Season history / collected range | Profile disclosure |
| `/NPB/players/:id/advanced` | Direct BvP / situations | Profile disclosure |
| `/:league/milestones` | Season / career milestones | Records / Explore |
| `/:league/moves` | Registration/movement / FA / Posting | Explore |
| `/:league/talent` | Draft / prospects | Explore |
| `/:league/preseason` | Schedule/results / stats | NPB schedule / Explore |
| `/:league/matchup` | Matchup discovery / player comparison | Explore; MLB also links to existing player BvP |
| `/:league/watch` | Game / player context | Explore |

Explore groups games, records, player journeys and matchup discovery; future features do not occupy Home cards. MLB's real player BvP remains functional. Data can later populate the prepared destinations without restructuring primary navigation. A route is a UI plan, not a Production/rights availability claim.

## Scope / rollback

UI, presentation metadata, composition and a native deep-link allowlist for Stats/Profile tabs. No schema, collector, Facts, qualification formula, Coverage, HOT, Ranking or Operations Gate change. SampleProvider is disconnected from production composition; foundation modules referenced by tests remain. Revert these commits to restore the old UI without data migration. Dev `/data` requests proxy published payloads, with no fixture fallback.

## Verification

Current composition (2026-10-01): **507 tests / 50 files, lint, typecheck, Web build and Vercel build PASS**. [Final Android CI run 36792231349](https://github.com/tomoya41/baseball-notes/actions/runs/36792231349) at `bdd63e809875bac3113daf597c5b1046f463a12e` passes Capacitor sync, packaged-asset secret scan, Android compile, debug/release APK and unsigned AAB, plus API 36 emulator instrumentation (**2 tests, 41.73s**). Debug APK: 5,951,178 bytes; unsigned AAB: 4,384,843 bytes. No release signing or store upload is performed.

The main JS bundle is 511.98 kB (152.56 kB gzip), lazy MLB chunk 476.95 kB (144.78 kB gzip), CSS 40.74 kB (8.20 kB gzip). The existing Vite 500 kB advisory remains. No new asset/font service or recurring infrastructure is added.

The tests cover bounded date navigation, malformed dates, known zero vs missing scores, canonical/context links, gates, favorites, provider calculations, cache and portable backup/restore. New native screenshot evidence covers the actual watch board in 360px Light/Dark and 600px, the calendar, Player and Game Detail. Existing Android checks retain Back, cold deep links, preferences/Favorites restart, offline shell, cached Player and reconnect. Manual Android runs are UI regression evidence, never Scheduled Production proof.

The final emulator evidence artifact is `11132700507`, 893,191 bytes, SHA-256 `2f0d5e167f3ed2709a3a2da4f343baff74a993d33e20d448b2164b7c16843400`. Its `ui-redesign/` directory contains six visually inspected, loaded screenshots: Home 360px Light/Dark and 600px, plus Schedule, Player and Game at 360px. Appearance is changed through the app's preference controls; route/data readiness and rendered frames are checked before capture. Recreating the Activity after emulator display resizing removes the obsolete compositor buffer. Earlier captures with loading content or mixed buffers are superseded and are not visual proof. Local verified copy: `.data/ui-redesign/final-ui-proof/` (ignored, not committed). GitHub artifacts expire after seven days.

Browser checks used real published NPB/MLB payloads, including 坂本 PA 3 / AB 2 / BB 1, zero-PA substitutes, repeated batting slots, 2020 rate records, 2025 counting/rate records, Ohtani's two roles and exact Ohtani–Darvish BvP (2025: PA 5 / H 1 / HR 0 / AVG .250 / OBP .400 / OPS .650). The final pass verifies NPB Home modes/standings and closed Records/HOT, the MLB date ribbon/central scores, selected-year Player tabs, 7-day conditional filtering, actual BvP search, metric help keyboard opening/Escape and focus restoration. The new composition leaves all underlying calculations and canonical data intact.

Native Back, deep links, offline shell, cached Player, reconnect and Favorite/preference restart assertions pass. Offline cached Player reached the expected screen in 874ms in the final CI emulator run; this is one emulator observation, not a physical-device guarantee. No hands-on TalkBack or physical-device performance claim is made. Portable backup/restore regression tests pass; no canonical DB mutation or new production export is needed for this presentation-only change.

## Public release verification (2026-10-01)

[PR #1](https://github.com/tomoya41/baseball-notes/pull/1) is merged into main at `d3bac70cf693daddbdb3a6dc78464bca82ce8947`. The actual GitHub Pages app was smoke-tested at 360 × 800 in Light and Dark: NPB/MLB Home, Search, Schedule date navigation, Game Detail, Player tabs/Game Log, Analysis, Records and My. Favorites survived reload for each league; test additions were removed and the original system appearance preference restored. MLB checks also covered Japanese-player discovery, exact BvP, situational splits and 2020/2025 rate records. NPB partial-data notices and closed HOT/Records remained visible.

The public smoke test found a CSS class collision: MLB's inline `label.analysis-condition` rule also made NPB's `details.analysis-condition` flex, placing its summary beside the split content. Commit `b1ac7fa3e0d709e2d13737c57d8d3f21aa8bcfe5` scopes that rule to the label. A regression test loads the actual stylesheet and verifies both layouts. On the final published app, opened NPB split disclosures remain stacked in both themes, with document scroll width 345px inside a 360px viewport. No new design or feature was introduced.

Final checks: **521 tests / 52 files, lint, typecheck, Web build and Vercel build PASS**. [Foundation CI 36798973722](https://github.com/tomoya41/baseball-notes/actions/runs/36798973722) and [Android CI 36798973811](https://github.com/tomoya41/baseball-notes/actions/runs/36798973811) pass for the fix commit, including Android compile, APK/AAB generation and packaged-asset secret inspection. The push CI does not rerun emulator instrumentation; the verified native composition evidence above remains applicable. Browser warning/error logs were empty during the release smoke test.

[Pages publication 36799002435](https://github.com/tomoya41/baseball-notes/actions/runs/36799002435) succeeds on attempt 2 after a transient HTTP 503 interrupted preservation of the existing public payloads in attempt 1. It uses the existing `app-only` path and does not run a collector or historical import. After publication, 12 of 13 baseline public payloads are byte-identical; Standings differs only in generated/collected/calculated timestamps. Scores, aggregate values, canonical IDs, effective dates, capabilities and Production Gates are unchanged. This manual publication is not Scheduled Production proof and does not reclassify Infrastructure Phase.

Loaded 360px screenshot evidence is kept locally in `.data/ui-release/screenshots/` (ignored). The UI redesign phase is complete. Revert the presentation commits to restore the previous UI without any data migration.
