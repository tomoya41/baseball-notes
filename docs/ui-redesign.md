# Baseball Notes UI redesign

2026-09-30. The user's zero-based Android-first redesign replaces the old presentation layer. `astra-ui-redesign-handoff.md` still governs data, rights, canonical identities and capabilities.

## Information architecture

Five primary destinations: Home, Games, Players, Records and My. Analysis lives in a player's context; existing canonical Analysis links remain. General NPB Analysis opens search; MLB opens the verified Japanese cohort. League switching never carries another league's player/game ID.

Player tabs: Overview, Stats, Analysis, Game Log, Profile. Overview emphasizes saved Season and Recent with three recent game links. Details use disclosure. NPB splits retain the shared 30-day API bundle. MLB keeps season/as-of context in the URL and computes additional splits from the same saved player payload. Advanced BvP/situations load on request. Unsupported 2026 results never fall back to 2025.

NPB Home prioritizes real results and standings. MLB Home prioritizes Japanese players and historical entry points. My combines local favorites with appearance, notifications, privacy and source credits. Light/dark/system uses the existing small-preference adapter; favorites keys and native storage remain unchanged.

## Visual system / rights

Ivory and forest surfaces, editorial headings, copper accents and tabular numbers replace the previous cards. Colors are app identity, not official club palettes. Neutral player initials use actual names. Photos are accepted only through the existing explicit `usage=allowed` contract and attribution. Published NPB photos/logos remain unavailable. Profile and uniform fields render only when known. See `npb-batch-g-rights.md`.

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

The added suite checks canonical tab/context links, future no-data screens (including invalid tab parameters), native parent/deep links, theme parsing, verified identity and neutral visuals. Existing calculation, provider, cache, portable backup/restore and favorites suites remain.

Local verification on 2026-10-01: **490 tests / 50 files, lint, typecheck, Web build, Vercel build and Capacitor sync PASS**. The main JS bundle is 506.96 kB (151.03 kB gzip); the lazy MLB chunk is 474.06 kB (144.36 kB gzip); CSS is 29.36 kB (6.40 kB gzip). Vite's 500 kB chunk advisory remains; advanced payloads are loaded on request, never raw PA rows. The development server excludes `.data` and Android generated outputs from its watcher to avoid OneDrive image locks and generated-asset reloads.

Browser verification used real published payloads: NPB Home, standings/team, search, Player/Season/Recent, the shared 7/14/30 and all conditional splits, 9/25 and 9/26 Game Details, schedule previous-date navigation and gated Records.坂本 retains PA 3 / AB 2 / BB 1; zero-PA substitutes and repeated batting slots remain present. MLB Home/Japanese filter, Ohtani's two roles, favorites after reload, 2020 Rate/2025 Counting Records, exact Ohtani–Darvish BvP (2025: PA 5 / H 1 / HR 0 / AVG .250 / OBP .400 / OPS .650), and inning situations were checked. No DB/Facts/Coverage/production Gate writes were made.

Android API 36 emulator and debug/release APK/unsigned AAB passed in [manual CI 36727319479](https://github.com/tomoya41/baseball-notes/actions/runs/36727319479). Both instrumentation tests passed: modal/history Back, canonical cold deep link, NPB/MLB, preferences/favorites restart, no-cache offline shell, cached-player offline restart and reconnect. Native Light/Dark 360px and 600px screenshots show no page overflow or platform title bar. This manual build is UI evidence, **not Scheduled Production proof**. UI refinement after this run receives another compile check on the PR.

Measured emulator timings are environment-specific: shell 5,024 ms; historical player 2,367 ms; Analysis 1,363 ms; BvP 166 ms; Game Detail 310 ms; Search 41 ms; cached offline Player 2,290 ms. Largest measured cached response: 218,268 bytes. Screenshots and instrumentation evidence are kept in ignored `.data/ui-redesign/`, with the CI artifact retained for seven days.
