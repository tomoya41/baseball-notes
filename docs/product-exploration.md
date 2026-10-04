# Product Expansion Batch 3

## Saved-data exploration

`#/NPB/data` and `#/MLB/data` expose the existing validated Season projections as a condition-search tool, not an official leaderboard. Neither Ranking/HOT readiness nor qualification is changed. The UI has no rank column, explicitly states the saved-data scope and Coverage, displays PA or IP beside rates, and preserves null/unavailable values as `—`. Partial metrics remain labelled partial.

The URL retains league, selected season/competition, batting/pitching role, team, name, two numeric conditions, two sort keys, optional minimum PA/outs, result page, recent cohort, and comparison selection. Sorting has a deterministic name/canonical-ID tie break and puts null values last in either direction. Results render 40 compact rows per page, with two selected metrics plus the sample, rather than a wide all-stat table. Existing five primary destinations remain unchanged.

NPB has only the saved 2026 Regular Season. Its team filter means the player's latest saved affiliation; metrics include all of that player's season appearances, including before a transfer. Season and Directory must agree on effectiveDate, canonical identity, name and affiliation. Historical/Postseason requests are explicitly unavailable.

MLB covers the published 2020–2025 Regular and Postseason projections separately. Whole-season rows use the selected year's aggregate. A team filter instead loads the existing Team Hub projection, whose metrics represent appearances for that team in that year, not a player's career-wide affiliation. Manifest/season windows and directory identities must agree. Current 2026 is unavailable and never falls back to 2025. The existing published Postseason capability guard controls Postseason entry.

## Recent requests and cost

Batch 4 supersedes the NPB selected-cohort-only behavior with coordinated all-player Recent projections; see `product-personalization.md`. The original bounded cohort remains available and is still used for MLB Historical.

7/14/30-day exploration requires explicitly choosing at most 12 known players. It is not an all-player Recent ranking. No player profiles are fetched in whole-season mode. NPB reuses the existing Recent API; MLB reuses selected canonical player payloads and the existing null-aware aggregators, filtered to the selected competition/year/team and inclusive date window. MLB dates are source-local historical dates, anchored to the season manifest's lastDate; NPB is anchored to the saved effectiveDate.

Reads are limited to three concurrent requests, deduplicated within the unchanged player/period/scope context, and failed selections remain visibly unavailable. An explicit retry can retry failures. NPB responses with a different player, period, date or window are rejected. Changing team/year/role resets the cohort. A player with no appearances in a historical window is not given synthetic zero rate statistics.

Compare receives canonical players, role, season, competition and Recent period. The UI explicitly warns that Explorer's team restriction is not a Compare restriction: the existing Compare semantics use the player's whole selected scope. Other conditional/BvP/situational controls stay on the existing Compare/Analysis screen.

This batch adds no collectors, source, scheduled workflow, subscription or DB writes. It reuses one bounded Season payload and directory (or the one team/year payload) rather than downloading all games/Facts/PA. NPB's existing 2026 Season JSON is approximately 1.52 MB uncompressed at the pre-publication baseline, with 737 players; no new large static file is generated. Existing response-cache admission and offline fallback are reused.

## History and discovery

`#/MLB/history` is **保存済みシーズン履歴**, not full Career. One selected canonical profile supplies its recorded seasons, separate batting/pitching summaries, and year-specific Season/Analysis/Game Log/Compare/Team links. Team links are derived from that year's saved game facts. Missing role statistics and mismatched profile identity are explicit. `#/NPB/history` exposes only the actually saved 2026 season, with no invented historical years.

Search now has Player, Team, Game and Series destinations plus Favorites and Explorer shortcuts. Team search uses the existing catalog/manifest. Game search loads one explicitly selected date; it does not fetch the whole historical game corpus. Confirmed no-games, unknown/partial dates, invalid ranges and source errors remain distinct. MLB Series search explicitly enters Postseason and links the canonical series. NPB Series retains its source-rights-pending state.

MLB names use the existing verified Japanese/English aliases and normalization. NPB uses existing canonical display names and whitespace/NFKC normalization. No identity is created or merged from a name. Batch 4 adds a separate local Activity/Collections/Saved Views library; account/cloud discovery remains absent. See `product-personalization.md`.

## Glossary

`#/NPB/glossary` and `#/MLB/glossary` list only actually used statistics. The existing metric `ⓘ` dialog gains rate formulas, required data, sample cautions, innings notation and competition scope. Dialogs are labelled, focus-managed by the native dialog element, dismissible through the existing Android modal/back handling, and scroll within the viewport. RISP is offered only for MLB. WHIP, BB/9 and Statcast metrics are not exposed as new capabilities.

The listed metrics are G, GS, PA, AB, H, 2B, 3B, HR, R, RBI, BB, HBP, SH, SF, SO, SB, CS, AVG, OBP, SLG, OPS, IP, BF, ER, ERA, K/9, W, L, SV, HLD, and MLB RISP. Explanation does not introduce a universal rate threshold or confuse optional Explorer sample filters with official qualification.

## Validation and delivery

Before publication: domain/UI regressions cover compound filters, null ordering, minimum samples, bounded/deduplicated requests, canonical scope mismatch, date windows, unavailable seasons, role/period links to Compare, URL Back, pagination, no-games vs unknown, historical identity, and metric explanations. All tests, lint, typecheck, Web/Vercel builds and the existing Android debug/unsigned-release CI must pass.

Publish via `mlb-historical-publish.yml`, `mode=app-only`; this preserves coordinated NPB and both MLB releases byte-for-byte. Compare pre/post HTTP hashes for Directory, Catalog, Capabilities, Milestones, Season, HOT, Team Season, Records, game projections and MLB Regular/Postseason metadata. No Fact or Coverage repair, gate change or infrastructure-phase reevaluation belongs to this batch. Actual public 360px Light/Dark and main-feature smoke evidence is recorded in the delivery report.
