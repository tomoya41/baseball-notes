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

## 2026-09-24 — Analysis UI and distinct situation dimensions

Use the existing design system for an Analysis summary → category → detail flow. A shared filter/query structure, capability gate and provider-specific combination check control each view. Player season totals must never masquerade as event-level analysis. The current sample provider therefore has an explicit unavailable Analysis adapter; UI components can render validated future aggregates without creating synthetic production data.

Query v2 distinguishes batting-order slot, signed pre-PA score differential and UI score bucket, actual game inning, and nth inning of a pitcher's own appearance. Times through the order remains separate. No Analysis Query/cache is persisted yet, so v1→v2 has no user-data migration; older tests and future adapters must update their query contract. This change can be rolled back independently of catalog/favorite storage. Retrosheet historical columns justify conditional MLB feasibility, not current-season availability; NPB split coverage and Savant reuse remain unconfirmed. See `docs/analysis-capabilities.md` and `SPEC.md` section 33.

## 2026-09-24 — MATCHUP / WATCH provider boundary

MATCHUP composes independently gated AnalysisProvider aggregates; it does not create a second metric or pitch taxonomy. Direct history uses the pair subject, while pitch/count/recent comparisons use each player's existing subject and keep their populations separate. A deterministic attention pitch requires both aligned canonical pitch types and at least 50 pitches on each side; this is a viewing cue, not a strength/weakness or game prediction. Direct history below 20 PA is a reference value. Top-level sections fetch on selection except the small summary set, so a failed detail source does not suppress other sections.

WATCH has a separate provider contract because today's schedule/lineup freshness and permission differ from previous-day Analysis. Its capability flags for schedule, lineup and bullpen are independent. `今日` is the Japan calendar day, preserving the game's source-local date. A selected three-hitter window is based on the supplied order, never a live next-batter inference; bullpen rows show only past usage. Both adapters are unavailable for the current synthetic source. Retrosheet's published historical MLB files do not license a current-day lineup feed, and MLB.com site automation is not used. No favorite/catalog migration or new monthly cost is introduced; rollback is the MATCHUP/WATCH routes, ports and their adapters as one feature unit.

## 2026-09-24 — Daily data foundation and historical standings proof

Use an SQLite-compatible schema with versioned SQL migrations and repository ports. Local `file:` libSQL runs tests/imports; a Turso Free project is the selected remote SQL candidate only after account, no-overage controls and secret-backed publishing are configured. Supabase Free is less suitable here because of its smaller database allowance, inactive-project pause and lack of free automatic backups. Do not put a remote DB token in Android/Web. Clients consume validated static payloads or a future own API. R2 remains a candidate for a later permitted high-volume archive, not an active dependency: its free tier can incur usage charges past limits. Current normalized historical archive is local JSON.gz; off-machine durability is an open deployment risk.

Retrosheet 2025 regular-season gameinfo is the only enabled real provider for this slice. Its notice permits reuse with prominent exact attribution, and released files are not a current-day feed. Import all 2,430 regular games once, reject truncated/duplicate/invalid releases, upsert changed game facts, and recompute all existing standings snapshots affected by a correction. The displayed group is an MLB division; rank is the app's computed percentage ordering, not an official tiebreak determination. Suspended games enter the reconstruction at completion date. Keep source identity, record URL and collection time. Facts/snapshots persist, caches/raw responses expire by class. Existing sample UI and capability gates remain unchanged. The optional GitHub Actions schedule is disabled until a permitted current-season provider and durable free storage/publishing are configured. Rollback removes the new data modules/migration/workflow without migrating device favorites or existing catalog cache.

## 2026-09-24 — Bounded NPB public-page ingestion

NPB公式の二次利用・無断転載禁止表示に従い、公式ページをCollectorのSourceにしない。2026年9月時点でnf3公開ページの明示的な機械取得・再利用禁止を確認できなかったため、セ・パ順位、12球団の日程・結果、事前照合した4選手の試合行だけを低頻度で検証する。nf3は二次集計サイトであり、公開されていることを包括的な再利用許諾とは見なさない。Source Registryから即時停止可能にし、出典・取得日時・対象日・欠測を保持する。利用条件の変更や2028年閉鎖予定に備えてAdapterを交換可能にする。

既存SQLite/libSQLとMigrationにNPBのsource ID mapping、日程/結果、Stage別完了状態を追加する。順位はSnapshotとして永久保存し、現時点のページを過去日の順位として偽装しない。予定から結果への変更は同じGameを訂正upsertする。選手ログは4人に限るためStageは常にpartialで、Analysis/HOTや全リーグの打撃・投手Capabilityを開放しない。Homeの順位のみローカルで生成した静的JSONをRepository経由で表示する。リモートDB、公開配信、オフサイトbackup、GitHub Scheduleは設定完了まで無効。RollbackはMigration 002を残してNPB CollectorとHome接続を停止し、既存のMLB歴史データと端末Favoritesを保つ。
