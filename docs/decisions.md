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

## 2026-09-24 — NPB Remote persistence and delivery

Keep the SQLite/libSQL repository and migrations. Use a Tokyo-region Turso Free database for server-side daily Facts and standings snapshots, and public GitHub Pages for a validated, precomputed NPB standings JSON plus Web app. The Android build reads the same public URL; no database credential enters the client. GitHub Actions owns the daily collector, replays captured Raw once for idempotency verification on manual runs, and publishes a complete Pages artifact only after database and payload checks pass. The repository is public for free Pages; the Turso account is Free with no payment method. No R2, Vercel, paid service, or new baseball source is added.

The collector switches local/remote at its composition root, while Repository/Domain SQL remains unchanged. GitHub repository secrets hold the DB URL and database-scoped write token. A repository variable gates the schedule until a manual dry-run, remote ingest/replay, and live Pages read succeed. The scheduled time is 03:37 JST; schedule delay or inactivity can still prevent a run. Raw HTML stays on the transient Actions runner for replay and is not republished as a Pages artifact. Turso Free's one-day PITR is insufficient as a long-term Fact backup, so a private off-machine export/restore process remains an operations risk. If deployment must be rolled back, disable the schedule variable and redeploy the last validated Pages artifact without deleting permanent Facts or local favorites.

## 2026-09-24 — Manual one-game NPB completeness gate

Keep the daily four-player subset unchanged. A separate manual collector verifies one final DH game through independent lineup and pitcher-usage discovery, substitution traversal, canonical identity mapping, source-row parsing and team/box-score reconciliation before committing all player-game Facts. The dedicated game completeness record is separate from the daily date-wide stages; a complete game does not mean all games or players for that date are complete. Re-running the same Raw corrects rows by stable keys. The proof deliberately stops at Marines–Buffaloes on 2026-09-23, avoiding a whole-slate crawl and new services. Migration 003 adds only nullable event fields and a game-completeness table. Rollback disables the manual workflow and leaves migration/data in place; do not delete permanent Facts to revert the feature.

## 2026-09-24 — Second controlled NPB game and defensive-outs gate

Reuse the manual one-game pipeline for one reviewed Hawks–Lions game with explicit nonzero doubles; do not broaden the scheduled collector. The first game's fixed 27-outs-per-staff check was too narrow: when the home team leads after the top of the ninth, the visiting staff normally records 24 outs. For these two fixed proof targets, verify expected defensive outs from each game's known completed innings rather than inferring them from the final score alone. A future general collector must derive innings from an independently validated game record, including walk-offs and extras, before marking completion. Keep pitcher BB/HBP combined, appearance order null, and unobserved 3B/HBP/SH/SF/HLD/SV cases unverified. Rollback disables the second manual choice without deleting normalized permanent Facts. See `docs/npb-game-edge-proof.md`.

## 2026-09-25 — Bounded NPB edge proof and final-out plausibility

Keep all-game player-Fact collection disabled. Add exactly two manual game targets: 2026-09-23 Carp–Giants for Central pitchers batting, sacrifice hits, fractional relief innings, holds and a save; BayStars–Dragons for a directly observed triple, HBP and an extra-inning home victory. Retain the same Source Registry, Provider, Repository, migrations and Turso tables. Accept a narrow alphabetic suffix in nf3 profile filenames, but continue resolving identity through verified uniform number, name and profile URL. No game-specific parser or schema branch is introduced.

Replace per-target fixed outs with a general *plausible final shape* check: an away win/tie requires matching whole innings from both pitching staffs; a home win permits one to three fewer visiting defensive outs. It rejects shortened or unclear records and supports a skipped bottom ninth or a walk-off, including extra innings. This does not independently prove the final inning because the nf3 schedule row lacks it. Keep independent team extra-base validation, SF nonzero coverage and appearance order unverified. Source-level observation does not expand product Analysis Capability. Rollback disables the two new manual choices and restores the prior URL/outs validation code, leaving permanent Facts intact. See `docs/npb-game-phase4-proof.md`.

## 2026-09-25 — Portable Fact export and manual full-day safety gate

Back up the existing Turso/libSQL schema and an explicit allowlist of permanent/provenance tables as SQLite DDL plus gzip JSONL files with SHA-256, row counts and migration versions in a manifest. Restore is permitted only into a new empty SQLite file, where the same Repository reads standings and a complete Game. Caches, generated JSON and expiring Raw are excluded. The manual GitHub Actions drill shares the daily collector's concurrency group and does not publish its backup artifact; a private, persistent off-provider storage destination is still a separate operations task. No vendor-specific backup format, paid service or new migration is needed.

Before all-game scheduling, run the six final 2026-09-23 games as one read-only dry-run using the established nf3 parser, canonical mapping and completeness checks. Reuse archived local Raw and a shared in-run URL cache to reduce source load. Resolve old role-specific player IDs only when same-season team, uniform, name and source URL agree; derive nf3's optional alphabetic profile suffix instead of assuming a numeric query ID. Unknown pitcher markers and special PA events fail closed. A complete Day requires every Game complete and unchanged protected DB tables. Passing the manual gate does not modify `.github/workflows/daily-collector.yml`; enabling previous-day all-game collection remains one later review unit. See `docs/npb-backup-day-proof.md`.

## 2026-09-25 — Day-level Fact collection and atomic Game commit

Extend the existing one-game nf3 proof into a day orchestrator without changing the source or client delivery model. Determine target from the preceding Asia/Tokyo calendar day, enumerate Repository Games, and collect Player Facts only for final Games. Commit verified mappings, both Fact types, completeness and provenance in one libSQL write transaction per Game; a failed Game does not undo other complete Games. A separate durable Day run records complete/partial/no_games/failed and request counts. The original limited schedule remains unchanged until local and GitHub manual dry-run, remote ingest/replay, readback, encrypted backup and publish all pass. Since this is a public repository and its Actions artifacts are readable, never upload plaintext Fact exports; encrypt any short-retention artifact before upload. See `docs/npb-day-operations.md`.

## 2026-09-25 — Independent NPB freshness check

Use a separate GitHub Actions workflow to detect a missing or stale public Pages payload by the configurable 12:00 JST deadline, instead of treating a delayed 03:37 collector start as failure. Compare the actual HTTP JSON's effective date with the prior Asia/Tokyo day. Keep published freshness distinct from the remote Day-run completeness and backup state; query Turso metadata and the latest scheduled GitHub Action only for diagnosis. A failed health check fails Actions but does not automatically refetch nf3 or create Issues. The monitor's distinct schedule also runs when the collector's schedule is absent. No schema migration, client change or monthly service cost is introduced; rollback disables the freshness workflow and leaves collection/payload behavior intact. See `docs/npb-freshness-operations.md`.

## 2026-09-25 — Read-only seven-day Player Game Fact aggregation

Calculate a single player's first `7d` period from already-persisted NPB Game Facts through the existing batch date-range Repository reads. The window is seven inclusive Asia/Tokyo calendar dates ending at the explicit `asOfDate`; this differs intentionally from AnalysisQuery's previous-day cutoff, which future app-facing callers must enforce. Derived values are recalculated, not written to Turso or Pages. Every nullable count carries observed/total Fact coverage; incomplete inputs suppress dependent rates. Pitching outs remain integers. Standalone BB is required for WHIP; nf3's combined BB+HBP is never substituted. Result-level completeness describes retrieved Fact fields, not all-day ingestion coverage. No schema, provider, collector, schedule, backup or client route changes; rollback removes the new domain/service/test/script and this documentation, with no data migration.

## 2026-09-25 — Collection coverage for read-only 7/14/30-day periods

Extend the central calendar-day resolver to 14d and 30d without duplicating batting or pitching formulas. Keep metric completeness about the Facts returned by the Repository, while a separate league-wide Period Coverage is established only from latest Day-run evidence, a complete Game-enumeration stage, and complete final-Game batting/pitching gates. Explicit no-games days count as covered; absence of an individual player's Fact does not imply a collection gap. Missing historical evidence is unknown, known failed/partial ingestion is partial, and inaccessible coverage evidence is unavailable. This conservative proof avoids false complete claims across unbackfilled dates and transfers, at the cost of not yet certifying an individual team's exact schedule. No migration, ingestion change, cache, UI rollout or HOT ranking is added. Rollback removes the coverage reader/evaluator and narrows the resolver while leaving permanent Facts untouched.

## 2026-09-25 — Read-only Player Recent delivery

Connect only the NPB Player page's Recent section to stored Turso Game Facts through `PlayerPeriodService`. A small Vercel Free API holds a read-only Turso credential server-side; Android/Web receive validated JSON without DB credentials. The client keeps the existing Player shell and 7/14/30-day selector, displays metric availability separately from period collection coverage, and never substitutes sample stats after an API failure. WHIP remains hidden because nf3 pitching Facts do not separate BB from HBP. No Fact, migration, collector, scheduled workflow, or HOT change is included. Rollback removes the Recent adapter and API while leaving stored Facts and Pages standings delivery intact.
