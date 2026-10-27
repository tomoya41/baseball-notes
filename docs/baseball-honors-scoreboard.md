# Historical honors and inning scoreboards

Source / rights check: **2026-10-28 JST**. Independent static partial projections; no DB writes, inferred statistical seasons, ranking gate changes or replacements of the existing 63,372 public data files.

## Rights and acquisition

| Source / formal evidence | Decision | Adopted scope and conditions |
| --- | --- | --- |
| [SABR / Sean Lahman](https://sabr.org/lahman-database/), official [CSV distribution](https://sabr.box.com/s/y1prhc795jk8zvmelfd3jq7tl389y6cd), [README](https://sabr.box.com/shared/static/qtgh1olzcaauz5x234wqx8huixizff8l.txt), section 0.1 | B | Copyright 1996–2025 SABR, via donation from Sean Lahman. [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) permits storage, modification and redistribution on Web / Android. Retain credit, license and modification notice / ShareAlike. Official 1871–2025 download, no account / paid API. Import annual AL/NL/ML winners from AwardsPlayers, identities from People, award-season clubs from Appearances/Teams. No Negro League / Seamheads records imported. |
| Previously archived Japanese Wikipedia player revisions | B | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Explicit NPB title/award lists only; per-record article/revision, original excerpt hash and authors-history URL. Extract, translate labels and link identity/season clubs; no photos or prose biographies. Raw archive stays private. |
| Existing Wikipedia CS revisions 5301694 / 111417089 and 5302364 / 111424439 | B | Exact content SHA matches active CS pin. CC BY-SA 4.0, extract Linescore innings / explicit H/E for the same 12 admitted finals only. Game ID/date/clubs/R must match. |
| [Retrosheet notice](https://www.retrosheet.org/notice.txt) | B | Existing 2014–2025 CSV archives, gameinfo/teamstats only, already published Game IDs only. Required verbatim attribution appears with the scoreboard. No new pitch-by-pitch acquisition. |
| [Chadwick Register](https://github.com/chadwickbureau/register), [ODC-BY 1.0](https://opendatacommons.org/licenses/by/1-0/) | B | Existing cached registry UUID + bbref / Retrosheet IDs; DOB contradictions rejected. Attribution retained; no name-only matches. |
| [Wikidata licensing](https://www.wikidata.org/wiki/Wikidata:Licensing) | A, not imported in v1 | Main-namespace structured data CC0 permits reuse. Bare P166 alone does not establish year/league/position/ref. Item-level qualifier admission remains necessary. Existing QIDs retained as identity evidence; v1 needs no additional API calls. |
| NPB / MLB official award pages | Reference only | [NPB 2025 names](https://npb.jp/award/2025/cl.html), [MLB Cy Young history](https://www.mlb.com/awards/cy-young). Formal-name / institution checks only. Official-site accessibility is not bulk redistribution permission. |

Lahman-derived records retain CC BY-SA 3.0, Wikipedia-derived records CC BY-SA 4.0. Each part remains separately reusable; the collection does not change application-code licenses. Immutable bundle contains admitted projections only. Local inputs.json hashes the raw source inputs; public records retain applicable source/revision hashes. No inquiries / applications / paid services used.

## Admission contract

- `player-honors.ts`: source/formal name, stable award ID, year, league/division, position, nullable co-winner flag, award-season clubs, external recipient IDs and optional existing profile links. Counts mean **collected wins**, not full-career totals. Unknown fields stay unknown.
- NPB: exact NPB award links, count/year lists, nested positions, year ranges and single-year rookie awards. Reject ambiguous dates, count disagreements, duplicate years, awards after 2025 and sponsor rookie subawards. Old relief/glove institutions have separate names. Pre-2013 winning-percentage rules remain held. Generic non-NPB links are not admitted from NPB experience alone.
- MLB: winners only; no votes, candidates or inferred statistical champions. MVP before 1931 held. Cy Young 1956–66 keeps MLB-wide scope. Traded winners keep multiple award-season clubs, not a guessed award-day employer. A recipient may have no application profile; no forced join / new current identity / missing-season statistics.
- `inning-score.ts`: integers, null, X, numeric walk-off x and pending are distinct. Fully known innings must sum to R; end markers belong only to the final home inning. UI overlay must match the existing Game ID/scope/date/teams/R.
- Retrosheet: full linescore flag, exact team pair, no forfeit / internal missing inning. X/x only for a dense complete final and normal home batting order. Ties/shortened games keep actual innings. NPB Regular has no admitted inning arrays: show unknown innings and saved R; H only from a complete existing box score. Japan Series retains existing arrays; no invented H/E.

## Publication and performance

Offline builder → new immutable release → pin → stage validates all hashes / paths / schemas / references → hash-scoped public files. No old asset is overwritten. Rollback reverts app/pin; keep release and old public data.

Honors reads one manifest plus the requested year / two-hex profile bucket, only on navigation/expansion. Scores read a selected month and Regular/Postseason scope. Home adds zero requests. Runtime validates before offline caching, bounds memory to 64 files. Errors preserve original Game totals. No dataset enters initial JS / APK shell.

## Active v2 scope

- NPB: **682 records / 140 linked recipients / 1999–2025**, partial.
- MLB: **3,289 records / 1,022 recipients / 1931–2025**, 16 award classes, partial. **All 1,022 recipients** have convergent independent Chadwick identities (0 unresolved). **1,330 records / 413 recipients** have collected-profile links. **609 recipients** remain without a profile link, including players outside 2014–2025. Names never force linkage.
- Supplemental innings: **28,095 MLB games (2014–2025)**, **12 NPB CS games (2026)**. Existing 2 Japan Series finals also use the common table. NPB Regular innings remain uncollected.
- Not exhaustive: historical NPB champions, ambiguous source formats, older winning-percentage institutions, all co-winners, MLB statistical batting/pitching titles, unannounced 2026 awards. Empty results mean uncollected, not no award.

## Validation

Final exact-head review / CI / Android / data preservation / Pages / HTTP evidence is recorded after execution. Pixel and actual TalkBack remain NOT RUN without device access; accessible table semantics alone are not TalkBack certification.

## Local evidence before PR

- All **28,095** supplemental MLB scoreboards compared against the previously published Game JSON: Game ID/date/teams/R/Regular–Postseason scope agree, **0 mismatches**. Existing Games are untouched.
- After adding the multiline comment/ref and candidate guards, all **682** admitted NPB honor IDs and exact excerpt hashes are unchanged.
- Initial full local foundation run: **206 files, 1,994 passed + 1 existing Windows-only skip**. Subsequent focused guard tests passed; final exact-head CI remains the release gate.
- Web/Vercel build and release credential scan passed. Shell remains data-free. Active additive projection: **543 files / 18,354,425 bytes**, max individual payload **209,858 bytes**; gzip bundle **3,228,865 bytes**. Existing public data baseline is 301,164,338 bytes; projected total stays below 320MB.
- Physical ADB device list empty (2026-10-28 JST): Pixel/TalkBack NOT RUN, no install/uninstall/data clear/signing changes. Existing release-signature/Play owner gates remain.
- Latest observed EOD run 40585641952 honors read-suspension lease from 40542701449 through 2026-10-28T16:37:34.787Z, **dbReads=0/dbWrites=0**. This task adds no probes and does not assert Turso recovery.

Visual QA: actual local app using the unchanged published data and capability files; no mock production statistics.

[Japan Series before, 360 Light](assets/awards-scoreboard/before-japan-360-light.png) · [after Light](assets/awards-scoreboard/after-japan-360-light.png) · [after Dark](assets/awards-scoreboard/after-japan-360-dark.png) · [NPB honors](assets/awards-scoreboard/npb-awards-360-light.png) · [MLB Postseason](assets/awards-scoreboard/mlb-postseason-360-dark.png).

200% system-font and final WebView evidence are covered by the new Android instrumentation test, run after the new immutable public paths are available. Accessible markup is tested separately from actual TalkBack, which remains unverified.

### Prepublication v2 corrections

The v1 GitHub release remains immutable and was never deployed to Pages. v2 separates the 1976–2012 Rolaids Relief Man Award from the 2014+ Mariano Rivera AL / Trevor Hoffman NL awards, and preserves voting/game notes separately from fielding position. See the [MLB 2014 announcement](https://www.mlb.com/news/greg-holland-craig-kimbrel-named-2014-relievers-of-the-year/c-99306568) and [official club award history](https://img.mlbstatic.com/mlb-images/image/upload/fl_attachment/mlb/kdnzrsvryd8tcxzq6tbt.pdf). These are formal-name/history checks, not imported award lists from MLB. The 16 raw award classes have 18 distinct normalized institution IDs. Raw source names/notes and evidence hashes remain available.

All 1,022 MLB recipients pass independent ID convergence and DOB contradiction checks; 609 lack a collected profile, not an established identity. Preserve that distinction in UI. Existing canonical Japanese player names are used only through the verified ID for display/search; source names are retained. Club names use source spelling; exhaustive historical official-name normalization remains unimplemented.

No v1 asset is replaced. v2 uses a new version/hash. The retained-pins list is for generations already deployed to Pages; on a later v3 adoption, retain the deployed v2 projection first.
