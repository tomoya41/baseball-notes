# Product Expansion Batch 4

## Recent Explorer

NPB `#/NPB/data?season=2026&period=14` explores all players **with saved appearances in the selected inclusive calendar window**, not every master player assigned artificial zero statistics. Regular Season only. It is saved-data exploration, not HOT or official qualification. Partial coverage stays explicit; rows have no rank. Null metrics and zero-PA/zero-out appearances retain existing semantics. WHIP remains unavailable because NPB walks/hit batters are not source-separated.

`data/npb/explorer/recent/{7,14,30}.json` uses the existing bulk `PlayerPeriodBatchService`: canonical IDs/display metadata, effectiveDate, period, coverage, batting/pitching metrics and availability. No provider HTTP, per-player SQL, canonical writes, new collector or source. Each selected window needs one static request; filters/two-metric sorting/pagination are local, with 40 rendered rows. Team filtering uses latest saved affiliation and includes pre-transfer appearances, explicitly labelled. Optional sample controls use PA, pitching outs (three outs equal one inning), or appearances. Up to three displayed metrics are URL conditions.

MLB Historical Regular/Postseason retains bounded explicit cohorts: 12 players maximum, three concurrent requests, anchored to that competition/year's source-local end date. No Current MLB. Legacy Recent URLs with `recentPlayers` preserve cohort semantics.

## Publication and rollback

Season generation stages all three Recent projections. The shared final Pages artifact guard validates all-or-none, periods, season/date and canonical Directory display/affiliation. HTTP staged hashes include them. App/profile-only publication preserves them; errors abort instead of silently deleting live data. Initial generation uses `mlb-historical-publish.yml`, `mode=app-only`, `refresh_recent_explorer=true`, at the preserved Directory date. Other NPB and both MLB archives remain unchanged. Daily/EOD Season generation then refreshes the same family. No Production Gate/Scheduled proof change.

Rollback: revert this UI/projector change and republish. Local Favorites are independent and never migrated or overwritten. New read-only projections do not change canonical backups.

## Local library

A small versioned SettingsStore/Capacitor Preferences document, `baseball:personal-library:v1`:

- Activity: canonical league/type/ID, non-sensitive context and visit time, maximum 60 entries / 90 days, deduplicated by resource/context. Player/Team/Game/Series/Data/Season Explorer. Search text and selected-player cohorts are not recorded. Current Directory resolves names; missing metadata preserves IDs. No analytics/network writes.
- Saved Views: maximum 20 named views, league, explorer type and whitelisted URL conditions (year, competition, period, role, team, filters/sort/sample/metrics, canonical cohort/profile, explicitly saved name search). Excludes pagination, compare selection, credentials and local IDs. Opening reruns conditions on available data, not a frozen result. Shared URLs never contain local view IDs.
- Collections: maximum 20 groups / 100 canonical players per group. Create/rename/delete/add/remove, cross-league membership, profile links and same-league selection of two to four players for Compare. MLB Compare year/competition are explicit. Favorites mean following; Collections mean organization. No individual stats fanout in lists.

Serial writes avoid concurrent lost edits. Corrupt JSON, unknown future versions and quota failures are local errors; content is kept until explicit reset. Version 0 structured groups/views migrates in memory, persisted at next edit. Preferences are capped at 250,000 serialized characters. Reset clears only the library, not Favorites; Activity can clear separately. Large public JSON stays in the existing bounded IndexedDB response cache.

My retains its follow dashboard with compact library entries. Discovery gets shortcuts. Search/Profile/Explorer use “整理” through a native, labelled dialog, sharing focus and Android Back behavior. `#/NPB/library` / `#/MLB/library`, `tab=collections|views|activity`, are My destinations; primary navigation stays five items.

## Verification

Tests cover bulk windows, partial/null/zero semantics, missing identities, no provider IDs/ranks, coordinated family dates/IDs, single-request bounded Recent UI, failure without Season fallback, scope restoration, Activity privacy/aging/deduplication, serial writes, reload, migration/corruption/future schemas/quota and Favorites-preserving reset. Full Web/Vercel/Android checks, actual public 360px Light/Dark smoke, HTTP performance and unchanged-area hashes are delivery gates. Monthly additional recurring cost stays ¥0.
