# Astra UI Redesign Handoff — Data Contract Freeze v1

Batch G, 2026-09-30. **This document hands off data; it does not start the redesign.** Product requirements remain in `SPEC.md`. Rights evidence is in `docs/npb-batch-g-rights.md`. Verification results and measured counts are in `docs/npb-batch-g-report.md`.

## Design freedom and immutable data boundaries

The next UI may be redesigned from first principles. Retain canonical identities, data scopes, accessibility, attribution, last-success offline behavior and capability gates. A visually rich surface must work without a photograph or official logo. Never manufacture current results, career totals, batting/pitching order, logos or a missing metric. Do not put provider URLs/identifiers into routes, favorite keys or public entities.

Japanese audience: Japanese players' verified kanji names, familiar verified katakana names for other players/teams. Existing MLB display-name projection is preserved; unknown spelling retains the source display name rather than inventing a transliteration. Search normalization supports source-name aliases. Use established display names in payloads, never transliterate the canonical key.

## Frozen contracts

| Contract | Definition / consumer boundary | Important invariant |
| --- | --- | --- |
| League | `src/domain/models.ts`, NPB / MLB | Explicit route/key league; never current-data fallback across leagues |
| Team | `npbCatalogSchema.teams`, `src/domain/npb-product-contract.ts` | Canonical ID, Japanese names, short abbreviation, division; location/stadium nullable |
| Player | `npbCatalogSchema.players` plus existing Directory v2 | Canonical UUID, display name, independent batting/pitching availability |
| PlayerProfile | `players[].profile` | Position/投打/DOB/place/nationality/height/weight/age nullable; unknown is not zero |
| PlayerVisuals | `players[].visual` | Rights-cleared URL + attribution + licence required together; otherwise null and name fallback |
| PlayerMembership | `players[].membership` | Latest **stored** affiliation, not proof of current roster; uniform belongs here, never immutable Player identity |
| Game | `src/domain/npb-game-index.ts`, date-scoped index v1 | Canonical ID/date/teams/status/score/game number; final is distinct from Fact completeness |
| GameDetail | `src/domain/npb-game-detail.ts` | Available batting/pitching sections, nullable stats, no inferred substitution/relief order |
| Season / PlayerSeason | `src/application/npb-season-payload.ts` v1 | Stored regular-season scope; Coverage separated from Metric Status |
| TeamSeason | `npbTeamSeasonSchema` v1 | `stored_final_games`; G/W/L/T/RF/RA and reused batting/pitching metrics; not official full-season standings |
| Recent / Analysis | `src/domain/player-period.ts`, Analysis bundle / context | 7/14/30 inclusive date windows; shared Fact context for splits; no per-split SQL |
| Ranking | Season readiness / `src/domain/npb-ranking-qualifier.ts` | Counting and Rate independently gated; candidate arrays are not public rankings |
| Records | `src/domain/npb-records.ts` | Season scope only; gate closed means no provisional leaderboard leak |
| Favorite | `src/domain/models.ts` / Favorites repository | League + canonical Player ID; device local, existing NPB/MLB migration preserved |
| Capabilities | `npbCapabilitiesSchema` v1 | Data-keyed status, available flag, reasons and known/total; independent of screen design |

The new endpoints are additive. **Existing Directory v2, Season v1, Game/Records v1, MLB schemas and Android storage have not changed.** New public schema definitions are strict. Any future breaking change needs a schema version and migration/preservation review. Avoid importing `src/data/npb-nf3.ts` or an external-source adapter into UI code.

## NPB data semantics and nulls

`catalog/latest.json` provides all Profile basics, membership and visual capability in **one shared fetch**. `StaticNpbProductRepository.catalog()/player(id)` validates it and deduplicates concurrent consumers. Invalid/unknown canonical IDs do not become a name-based lookup; unknown profile is null. `invalidateCatalog()` permits selective refresh on reconnect. The bounded public-response IndexedDB cache is reused; no large JSON in localStorage, no endpoint request to Wikidata from the app.

Only three players have verified height and two have unambiguous weight. Measurement observation/review time is recorded, measurement effective date is unknown. Do not call it current measured weight. Age is calculated from birth date and the payload's explicit `ageAsOfDate`, not silently from the device clock. Uniform number, its observed/effective dates, draft year/round are currently null. Career history is empty because unavailable, not because the player has no prior clubs. Bats/throws and primary position are not inferred from Game appearances.

All team names/divisions are available. Abbreviation uses the familiar existing Japanese short name. Official home location/stadium/colours are unknown in this contract. `observedHomeVenues` in TeamSeason lists venues where stored home Games occurred; **it is not a designation of a club's official home stadium**. Official colour is null; `colorRole=neutral` lets the app choose its own neutral UI palette. No unofficial “official colour” claims.

TeamSeason is partitioned from two batch Fact reads and one Game read, independent of team count. Rates use the existing aggregators. `scoreStatus`, Fact game counts and Season Coverage must accompany use of G/W/L/T/RF/RA. Metrics can be complete for observed Facts while overall Season Coverage remains partial. Saved final scores of a shortened Game can appear even when Game Fact verification remains partial. Missing score is null; never treat it as 0–0. RF/RA are null if not all stored final scores are known. No WHIP exposure.

## Current NPB capabilities

Available: 12 teams; standings; schedule/results; canonical Game/score/status; batting/pitching; batting slots; starter/substitute and starter/reliever; Player master; Game Log; Recent; Home/Away; Opponent; Batting Order; role; saved Season; Favorites/My; Game browsing; team saved-season aggregates.

Partial: current stored affiliation is not a verified complete roster; most Profile fields remain null; completeness retains rain-shortened partials. Detailed-profile acquisition beyond reviewed CC0 identities is not rights-cleared. Do not use the number of Player rows as “registered roster count”.

Unavailable/blocked: career history/totals/milestones; uniform numbers; draft/prospects; transactions/FA/posting/retirement; camp/open-game ingestion; portraits/logos/official palette. Sources exist for several groups, but their reusable data permission or canonical bridge is missing. Details/reasons are in `capabilities.json` and the rights matrix.

Required adopted granularity unavailable: NPB Direct BvP, pitch-level, canonical inning score, strict substitutions/relief order. NPB must not inherit empty or sample MLB Advanced widgets.

Gate pending: NPB HOT, counting/rate Ranking and Records. Use brief user wording (“集計を確認中” / “HOTランキング準備中”) with diagnostics behind development tools. No mock rows. Manual backfill/publish is not Scheduled proof. Rain-shortened six Games remain partial; do not convert them to complete to decorate a UI.

Publication audit on 2026-09-30: the stored horizon is **2026-09-29**, and March 27–September 29 comprises **187 days: 156 complete, 25 confirmed no_games, 6 partial, 0 unknown**. The original five rain-shortened days remain partial. September 28 is an additional partial day: three stored final Game headers have no verified participant/completeness record (`expected_participants_unverified`). Do not label that day “試合なし” from its zero verified final count. Current-Fact validation passes 827 Games, retains six shortened Games as partial and three September 28 Games as unverified. Latest September 23–29 coverage is therefore partial. These were observed in existing data; Batch G made zero canonical writes and did not repair or relax them. Astra can proceed with explicit partial states; Production HOT/Ranking cannot ignore them.

## Visual asset contract

All NPB `photo.usage` and `logo.usage` currently equal `unavailable`, URL/attribution/licence URL null. Show name or team abbreviation. Exact licensed Commons candidates are documented separately; a Wikidata P18 link is not itself a grant. Do not make a browser hotlink as a rights workaround. Approved later assets can populate the existing allowed-asset structure with required credit/licence without rebuilding the domain.

Retrosheet and Chadwick credit/ODC-By notices remain accessible at `#/MLB/sources`, including first offline launch. Wikidata CC0 credit is already there. Future About/Data Sources may redesign this presentation while retaining legally required wording.

## Routes and endpoints

Web base: `https://tomoya41.github.io/baseball-notes/`. Existing hash router stays supported in Android. IDs need URL encoding; never use names or provider IDs as keys.

| Surface | Canonical route |
| --- | --- |
| Home / Search / Analysis / Records / My | `#/<NPB-or-MLB>/<home|search|analysis|records|my>` |
| NPB Player | `#/NPB/players/<canonical UUID>` with `/stats`, `/analysis`, `/more` sections |
| NPB Schedule | `#/NPB/schedule?date=YYYY-MM-DD` |
| NPB Game | `#/NPB/games/<encoded canonical Game ID>` |
| MLB Player | `#/MLB/players/<URL-encoded canonical Player ID>` (including the `mlb:player:` namespace); selected historical Season/as-of controls |
| MLB Schedule | `#/MLB/schedule?season=2025&date=2025-09-20` |
| MLB Game | `#/MLB/games/<canonical Game ID>` |
| Sources / Privacy | `#/MLB/sources`, `#/privacy` |

| Public payload | Purpose |
| --- | --- |
| `/data/npb/catalog/latest.json` | New shared basic Profile / membership / Team / visual read model (no Game Facts) |
| `/data/npb/capabilities.json` | New data capabilities / reasons / field coverage |
| `/data/npb/teams/season/2026/latest.json` | New 12-team stored-season projection |
| `/data/npb/players/latest.json` | Existing Directory v2 |
| `/data/standings/npb/latest.json` | Existing standings snapshot |
| `/data/npb/games/manifest.json`, `games/recent.json`, `games/dates/YYYY-MM-DD.json` | Date-scoped Schedule/Results, small Home list |
| `/data/npb/season/2026/latest.json`, `records/2026/latest.json`, `hot/latest.json` | Season / gated Records / gated HOT |
| Existing NPB Recent/Analysis/GameLog/GameDetail repositories | Validated application/API read models; preserve current endpoint fallbacks, no client DB connection |
| `/data/mlb/historical/manifest.json` and `.json.gz` projections | Existing split Player/date/Game/Season/Records/Advanced payloads; follow manifest and repositories, no raw PA |

Freshness: payload `effectiveDate` is the stored data horizon; `generatedAt` is packaging time and is not proof of fresh Games. NPB dates use Asia/Tokyo. Historical MLB dates/Season scope are source-local. New generation requires Directory/Season/HOT effective dates to agree. Historical MLB is release-driven, not a daily current collector. No UI may silently fill 2026 Current MLB with 2025 data.

## NPB / MLB differences

NPB: current 2026, six rain-shortened verification gaps, Production HOT/Ranking closed, sparse profiles, no licensed photo/logo set, no Direct BvP or pitch granularity. MLB: Retrosheet/Chadwick 2020–2025 Historical Core/Advanced; Direct BvP from exact canonical PA relation; validated inning/outs/base/score conditions; rate/season counting records with metric-specific official qualification; totals labelled **収録期間合計**, not full MLB career. Neither league has Statcast/live WATCH in this release. Do not force feature parity.

## Android / cache / notification boundaries

Batch F Capacitor shell shares Web UI: App/Back/custom canonical deep links, native lifecycle/network, offline packaged HTML/JS/CSS, last-success public response cache, device-local league-aware Favorites. Preserve Android root exit and nested Back behavior, status/navigation safe areas, keyboard behavior, dark mode and 44px touch targets. No entire MLB DB/PA bundle on the device.

NPB favorite EOD notification code is opt-in and FCM topic-based; no token DB, no live scores, and failure isolated after successful publish. Firebase setup/actual Push delivery, final package ID, release signing and App Links certificate/assetlinks are manual gates. This batch does not satisfy or change them. No Account/Analytics/Cloud sync or paid backend.

## Verification / redesign acceptance

Use real payloads and capability/null fixtures; test offline empty and saved data, long names, narrow tables, loading/error, 360px Light/Dark and keyboard/TalkBack. Preserve existing source credits. A contract change requires revisiting consumers, strict validation, offline cache, preservation workflows, tests and this handoff. The current UI was not redesigned in Batch G; Astra is a separate explicitly authorized next batch.
