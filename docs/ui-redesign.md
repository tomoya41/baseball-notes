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
| `/NPB/matchup` | Matchup / player comparison | Explore |
| `/:league/watch` | Game / player context | Explore |

Explore groups games, records, player journeys and matchup discovery; future features do not occupy Home cards. MLB's real player BvP remains functional. Data can later populate the prepared destinations without restructuring primary navigation. A route is a UI plan, not a Production/rights availability claim.

## Scope / rollback

UI, presentation metadata, composition and a native deep-link allowlist for Stats/Profile tabs. No schema, collector, Facts, qualification formula, Coverage, HOT, Ranking or Operations Gate change. SampleProvider is disconnected from production composition; foundation modules referenced by tests remain. Revert these commits to restore the old UI without data migration. Dev `/data` requests proxy published payloads, with no fixture fallback.

## Verification

The added suite checks canonical tab/context links, future no-data screens, native parent/deep links, theme parsing, verified identity and neutral visuals. Existing calculation, provider, cache and favorites suites remain. Final browser/build evidence is recorded after validation.
