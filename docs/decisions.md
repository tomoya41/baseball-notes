# Durable Decisions

This file records decisions that should survive individual implementation tasks.

## 2026-09-23 — Product focus
The product is a baseball data discovery app, not a pitch-by-pitch速報 replacement.

Reason:
- Sports Navi already serves pitch-by-pitch速報 well.
- The product can differentiate through recent-form analysis, player context, historical records, advanced data, seasonal features, and personalization.
- Avoiding pitch-by-pitch monitoring substantially reduces infrastructure and API pressure.

## 2026-09-23 — Audience
Primary audience: ordinary baseball fans who want to explore data.

Advanced metrics are allowed and encouraged, especially for MLB, but the UI must explain unfamiliar metrics in plain language.

## 2026-09-23 — Leagues
NPB and MLB are both first-class leagues.

MLB may expose significantly richer data. The app should use useful legally available MLB data rather than artificially limiting MLB to match NPB.

## 2026-09-23 — Cost constraint
Additional recurring monthly cost must remain ¥0 unless explicitly changed later.

Free tiers are acceptable. A feature that requires recurring paid infrastructure belongs in a future/optional bucket until explicitly approved.

## 2026-09-23 — AI
AI is optional enrichment only.

The core application, rankings, records, profiles, favorites, and seasonal features must remain useful when AI is unavailable. AI may later explain statistics, summarize sourced information, or make complex data easier for general fans to understand.

## 2026-09-23 — Accounts
Initial implementation does not require user accounts.

Favorites and preferences should initially be stored locally on the device. Cloud synchronization can be added later if justified.

## 2026-09-23 — Development method
All planned features remain in the long-term scope, but implementation is incremental.

Do not build everything at once. Establish a stable foundation, verify it, then add feature groups one by one.

## 2026-09-23 — Repository hygiene
Repository cleanup is continuous.

After each meaningful task, check for obsolete task-related files, superseded implementations, temporary scripts, debug files, duplicate assets, and stale mocks. Delete only after verifying they are unreferenced, then rerun relevant checks.

## 2026-09-23 — Android/web architecture

Use React + strict TypeScript + Vite with Capacitor Android. Hash routing supports static previews and bundled assets without a server rewrite. No SSR, hosted API, database, account or AI dependency is needed for the foundation. Kotlin/Compose would require a separate browser UI; Flutter would add a second language/toolchain without sufficient benefit for this scope.

Separate domain contracts/calculations, application repositories/ports, provider validation/normalization, storage adapters and UI. Wire objects never reach screens. Zod schemas are the runtime contract and source of inferred TypeScript types; avoid duplicate handwritten validation types. Implementation wiring lives in `src/app`. See `docs/architecture.md`.

## 2026-09-23 — Data adoption gate and honest sample proof

Use only project-authored synthetic data in the initial vertical proof. Always label it as sample data and keep sample IDs separate from real-player identities. Never replace a failed real feed with synthetic values silently.

NPB official-site content is not a licensed machine-readable application feed; do not reuse it without permission. MLB public pages/CSV definitions do not establish application redistribution rights. Retrosheet is a promising permitted historical source, but it does not provide current-day coverage. Wikidata can supply CC0 identity/profile supplements, not a complete season-stat feed. Paid feeds and time-limited/scrambled trials do not meet the permanent ¥0 real-data requirement. See `docs/data-sources.md` and `docs/analysis-capabilities.md` for evidence and unresolved conditions.

## 2026-09-23 — Persistence, freshness and identity

Preferences stores favorites (Android SharedPreferences, browser localStorage); disposable normalized catalog snapshots use IndexedDB. Version both stores. Cache failure must not block usable fetched data. Preserve unknown/corrupt favorites rather than overwriting them. Do not treat device cache as an authoritative historical archive.

Separate source update time from fetch time and expiry. Refetching delayed source data cannot make it fresh. On failure retain valid cache with explicit stale warnings. Corrections replace snapshots with source revision metadata. Preserve canonical player IDs across real-provider changes using verified mapping, not name matching. Sample identities never auto-migrate to real players.

## 2026-09-23 — No mandatory cloud and bounded CI cost

Android packages static assets. Vercel is optional personal/non-commercial Hobby preview only; no deployment is created in this task. GitHub Actions uses standard public-repository runners; private jobs stay disabled until free limits and spending controls are verified. Local `npm run check` remains the independent validation path. No automatic paid overages, cloud Cron, paid APIs or subscriptions.

## 2026-09-23 — Analysis A scope and capabilities

Analysis extends the existing architecture without replacing player/favorite modules. Add a separate AnalysisProvider port and domain contracts, not raw pitch data inside the player catalog. Common query/result/sample/freshness contracts can be shared; data availability stays provider/league/period/metric specific.

Capability tracks permission/data status separately from implementation. UI/application admission must check subject, season type, coverage, every filter, requested metric, population and verified feature combination. Only `available` + `implemented` enables a capability. Unknown, conditional and prohibited routes fail closed. Current sample catalogs do not claim analysis coverage. NPB can gain capabilities later without changing league-specific UI branches; MLB is not artificially reduced to NPB coverage.

## 2026-09-23 — Analysis semantics, daily cutoff and retention

Use a named baseball timezone and completed games through the previous day. Resolve inclusive calendar-date windows independently of device hours/DST. Date/month boundary and denominator rules must be tested. Shared DataFreshness remains compatible with catalog data; analysis adds actual coverage, aggregation time/version and coordinate provenance.

Separate final outcomes of PAs reaching a count from per-pitch responses at that count. Every metric carries its denominator population/definition version. Configure sample warnings outside calculations and keep them separate from ranking qualification. 「捕手別バッテリー配球傾向」 describes observed pairing, not who requested a pitch.

Savant documents a 2026 change in plate-location/zone conventions. Coordinate definition, version, units, viewpoint and measurement plane must match for direct comparisons. Transformation requires a later verified implementation.

Persist bounded aggregates only where permitted. No permanent all-pitch cloud mirror. Analysis A introduces contracts and guards; collection, daily scheduling, aggregate cache eviction, advanced analysis screens and phases B–G are not implemented now. `SPEC.md` section 30 is the formal analysis product scope.

## 2026-09-23 — Japanese-first baseball presentation

Japanese is the default UI, while familiar baseball abbreviations remain in English. Show basic metrics compactly; advanced metrics have an optional short `ⓘ` explanation backed by MetricDefinition for later glossary reuse. When a reliable comparable population exists, show relative position and its scope before lengthy explanation. Percentile conversion must know source ranking semantics and metric direction; no inferred top-% claim.

Store provider values and units unchanged; convert mph/imperial units to metric at presentation, with explicit JST formatting for timestamps and date-only calendar values kept separate. Keep canonical, verified Japanese and English player names separate, likewise team full/short/code, canonical positions and pitch types. Search aliases are not verified Japanese display names. Provider adapters normalize these identities before UI.

The disposable player catalog cache moves to v2 because its normalized name/position schema changed. Favorite entity IDs and their storage are unchanged. Old v1 cache remains untouched and is refetched; revert by restoring the prior domain/provider/UI and v1 key together. No design-system change or real data-provider adoption is implied.

## 2026-09-24 — Android-first design system and navigation

Use a restrained navy/blue token system with device-following light/dark themes, tabular numerals, system Japanese fonts, 4–32px spacing scale, 8–16px radius and approximately 48px touch targets. Lucide is the only general icon set; baseball-specific SVGs are original. Team and league marks default to text/monogram because official logo reuse is unlicensed. A reviewed license record is required before registering an official asset.

Bottom navigation is ホーム / 検索 / 分析 / 記録 / マイ. The existing player detail URL persists; old directory/favorite routes redirect. Home is a short vertical feed and never manufactures unavailable schedule/HOT/record data. Search supports both player and team. Player uses four in-page tabs. Ranking is a synthetic preview list only while real qualification inputs are absent, with visible nonofficial wording. These choices preserve provider/domain/favorite storage and can be reverted as one UI change. `SPEC.md` section 32 and `docs/design-system.md` define the product boundary.
