# Astra Product Completion Handoff — 2026-10-11

## Purpose and authoritative boundaries

This is the handoff for the next UI reconstruction, not a claim that unavailable data or Android release work is complete. Read `SPEC.md`, `docs/product-completion-inventory.md`, `docs/astra-product-final-handoff.md`, `docs/product-completion-audit.md`, and the user's [UI audit](../baseball_notes_ui_audit_2026-10-11.md). The latter is a code-based design critique, not evidence of device or screenshot QA. This batch retains the present Astra design language.

The product has five primary destinations: Home / Games / Players / Records / My. Preserve public hash URLs, native translation, Back behavior and portable query parsing. Use one natural vertical page scroll; avoid nested vertical scrolling. No additional primary destination is required for HOT, MATCHUP or personal tools.

UI may change typography, hierarchy, composition, responsive layout, filter disclosure, tabs, sheets, charts, headers, list/table presentation and navigation labels. It must preserve canonical IDs, immutable Facts, Coverage, production gates, scope, source attribution, export permissions and local persistence. UI needs are not grounds for a data migration, source acquisition or relaxed gate.

## Route and state inventory

Routes below use `/:league`, with NPB / MLB selected explicitly. Composition is in `src/ui/app.tsx`, `npb-routes.tsx` and the MLB league view. Public legacy redirects remain supported. Read the route/query validators before changing a URL.

| Route family | Function / meaningful states |
|---|---|
| `home` | Current saved NPB games/results and personal context; MLB selected Historical season/date. Loading, missing data, saved-data freshness, gated HOT |
| `schedule`, `games/:gameId` | Calendar/results, Preview/Recap, actual game Facts, optional Series. Scheduled/final/partial/unavailable; no invented starter |
| `search`, `teams`, `teams/:teamId` | Player / Team / Game / Series discovery, Team Hub, favorites and comparison. Catalog success with Season failure retains roster and reports failed section |
| `players/:playerId/:section?` | Profile, Stats, Game Log, Analysis, Trends and saved history. Unknown fields remain absent; pitcher batting remains accessible |
| `records` (`ranking` redirect) | Counting/rate or unavailable gate; collected-period / decade records carry exact years, never all-time or Career |
| `data`, `history`, `explore` | Data / Recent / saved-season exploration; shareable criteria, samples, paging, saved views. Empty filter result differs from missing dataset |
| `compare`, `team-compare`, `season-compare` | 2–4 canonical entities or saved-year comparisons. Different roles, scopes, samples and unavailable metrics remain explicit |
| MLB `form` | Historical HOT / monthly candidates / change; category, exact as-of, 7/14/30 or calendar-month comparison. Incomplete coverage, insufficient samples, Postseason monthly unavailable |
| MLB `matchup` | Canonical exact-PA batter versus pitcher, scope and sample. Zero actual matchup is a valid result; missing capability is separate |
| `postseason/*` | MLB historical Hub / Series / canonical games and player scope. NPB current has explicit Source rights pending, no empty fake bracket |
| `milestones/*` | Saved Season checkpoints; no Career milestone inference |
| NPB `talent/*` | ドラフト / 同期 / 若手 / 出身校; partial metadata, birth-date based age and selected-player Compare. No rookie or prospect qualification |
| `my`, `library`, `library/collections/:collectionId` | Player / Team Favorites, Collections Dashboard, Saved Views and Activity; local empty/corrupt/quota states |
| `watch-center` | Observed changes since local baseline; unread/read/hidden/preferences. First observation establishes baseline, not an event notification |
| `glossary`, `/privacy` | Metric explanations, local / FCM architecture and data-source disclosures |
| `moves`, `preseason`, unsupported `career` / `advanced` / `watch` | Existing source-dependent future routes. Capability-based unavailable / Coming Soon, without mocked content |

Every screen must support loading, error/retry, empty, unavailable, partial, stale and offline saved-data states where applicable. Do not collapse these into an empty table, zero or “complete.” Invalid IDs/queries should use validated fallbacks and preserve a way back.

## Proposed information hierarchy

The user's “Broadcast × Scouting” direction fits two surface families. Use dedicated sports compositions for Home, Game, Player, Team and HOT; use compact analytical rows/charts and disclosed controls for Explorer, Compare and Records. Do not repeat an identical rounded card for every section.

| Surface | Priority and drill-down |
|---|---|
| Home | Actual game/date/status first → latest / next results → favorites and compact Watch summary → period discovery. MLB Historical is selected-year context, not Today |
| Game | Teams, score and status → objective key numbers → Preview/Recap → batting/pitching Facts → Series context. No inferred causes of victory |
| Player | Identity and verified team/role → headline Season stats → Recent/Trends → Games/Analysis → saved history / Compare. Separate actual pitcher batting from standard hitter listing |
| Team | Identity and saved Season record → latest/next games → team stats → players → scope-specific Postseason / Compare |
| HOT / monthly | Selected year/date and category → result/rate/sample → previous-period rate and delta when relevant → short deterministic reason → methodology disclosure / Profile |
| Records | Collected years and competition → record type and actual values → sample/qualification → player/year drill-down |
| Compare | Entities and common scope → key metric differences/charts → full metrics → source/sample explanation. No invented overall winner |
| Analysis / Explorer | Scope and active conditions → results first → compact secondary controls / sheet → glossary and Profile/Compare |
| My / Watch | Saved/organized targets versus observed changes, respectively. Home summarizes; My does not duplicate the entire Home feed |

The audit identifies small 10–13px UI text, dense filters, technical wording, repetitive cards and CSS override layering. Audit these visually at 360px before choosing final tokens; proposed larger type in the user's MD is design guidance, not a requirement to enlarge every statistic. Keep numerical alignment, sufficient touch areas and progressive disclosure. Technical detail belongs in existing ⓘ dialogs; necessary scope/date/partial warnings remain visible. Prefer Japanese product terms already adopted by the Draft polish.

## League, time and role semantics

- NPB: Current **saved** Regular Season. Projection `effectiveDate` is observation/publication date; Fact `period.to` ends at the verified Regular Season cutoff. A later observation date does not extend Coverage or create games. Current roster/number is not proved by latest saved affiliation.
- NPB HOT requires coverage, eligible samples, identity/display metadata, actual Scheduled production/backup and publication evidence. Ranking has an independent completeness/qualification gate. Six partial dates remain a blocker; never publish by hiding them.
- MLB: admitted Historical seasons only. The 2014–2015 addition is published only after the same PA, identity, scope, independent aggregate and immutable-old-release checks as 2016–2025. No MLB Current, Career or all-time claim.
- Regular and Postseason have separate payload trees, queries and aggregates. Calendar-month candidates/comparison are Regular-only. Postseason HOT remains subject to its own complete coverage and sample limits.
- Display role is same-season/scope/as-of evidence. Fielder/DH/two-way evidence, ordinary pitcher batting and unknown role are distinct. Unknown roles remain visible where appropriate, never inferred from a missing profile. UI filters do not change official qualifier computation or delete batting Facts.
- HOT uses lexicographic same-category metrics and published minimum samples, not an opaque sum of unlike units. Monthly MVP is an app candidate list, not an official award. Rising/Cooling requires both samples and compares OPS/ERA rates. Full calendar months compare full prior months; mid-month compares through the same day number, capped at prior month end. Zero appearances is insufficient data, not Cooling.

## Reusable primitives and dedicated screens

Reuse validated repository/domain calculations; redesign their rendering rather than building duplicate engines. Shared primitives should cover accessible buttons/links, tabs/chips, stat cells with glossary, data-state panels, sheets/dialog focus, score alignment, trend charts, player/team compact rows, filter summary and responsive paging. Dedicated Game / Player / Team / Home / form compositions may use these primitives without sharing one generic card template.

Repositories and domain files own Fact aggregation, qualifiers, scopes, identities and rights. `src/domain/portable-route.ts` owns portable conditions. Platform services own Android Back, lifecycle and incoming URI translation. Cache fallback must preserve its saved-data indication. The full observation/alert system stays inside the existing application/domain boundary; do not recreate it in a new UI hook.

## Personal state, rights and performance

Favorites remain `league + canonical ID`; team favorites and player favorites stay distinct. Collections and Saved Views are local objects, not portable public IDs. Activity stores bounded canonical targets; Watch stores bounded observations/rules/read state. Preserve versions, migration, corruption handling, quota handling and clear/reset. A visual reorganization must not reset user data.

Historical HOT/Monthly/Rising Watch is explicitly user-triggered data confirmation, with baseline/dedupe and stale/partial suppression. At most 12 followed players are evaluated; no automatic bulk fetch on Home, push or background delivery claim. Favorite Rising observations are keyed by year/scope/category/period/mode to avoid cross-period baselines.

The form screen loads one year/scope index and at most three monthly shards; calendar-month comparison uses at most two. Render 20 entries initially. Home retains zero additional form fetch. Initial JS is measured in the batch delivery document; do not import the Historical reader or charts eagerly into the shell.

No new player photo/logo source is authorized. Respect existing `PlayerVisual` / `TeamVisual` usage flags; use permitted colors, names, abbreviations or neutral identity marks. Retrosheet credit and Chadwick attribution remain available; Wikipedia field attribution/revision remains intact. NPB export restrictions and missing WHIP inputs are not changed by richer MLB metrics. Never export raw PA or full source identity datasets.

## Completion and next QA

This batch adds calendar-month comparison and favorite Rising observation, repairs NPB publication-date consistency and validates the small 2014–2015 expansion. Read the delivery report for admission/build/publication evidence, not an assumed success from this design document.

Remaining Product work includes as-of Season-baseline comparisons, broader period-specific Profile/Compare presentation and measured device interactions. Source work remains NPB Historical/Career/Current Postseason/roster, FA/transactions/Preseason and MLB Current. These do not block a UI redesign over admitted data.

Next Astra should capture actual baseline screenshots, agree on a common language, redesign Home / Player / HOT first and carry it through Game / Team / analytical / personal surfaces. Preserve route/query tests and explicit states throughout. Finish with all-route 360px Light/Dark overflow, keyboard/focus/dialog/reduced-motion, tablet/desktop, Back/deep-link/reload/offline/persistence QA. Real Android / TalkBack, signed App Links and release signing remain manual release gates; successful CI builds do not prove them.
