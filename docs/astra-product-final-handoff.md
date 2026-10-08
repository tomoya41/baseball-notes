# Astra final product/UI handoff

2026-10-08, Product Completion Batch 7. This handoff does not start a redesign. `SPEC.md` remains authoritative. Earlier rights evidence and contract documents remain in force.

## UI changes allowed

Layout, typography, spacing, progressive disclosure, charts, filters, navigation labels and composition of existing features may change. Keep five primary destinations: Home / Games / Players / Records / My. Home means what to inspect now; My means saved/organized/tracked items. Do not add empty NPB advanced controls simply to match MLB.

Reuse `components.tsx` (`DataState`, `LoadingSkeleton`, `MetricLabel`/`MetricInfo`, profile/list primitives), `RouteFocus`, platform services, and existing responsive/color tokens. Native metric dialogs already restore focus and support Escape. New dialogs need equivalent focus containment, naming and dismissal. Preserve 44px controls, reduced-motion rules and Light/Dark contrast.

## Immutable data boundaries

- Canonical IDs, identity mappings, nullable metrics, Facts, Coverage and Production Gates are not UI concerns. No database writes or provider-specific IDs in routes/favorites.
- NPB is saved Current, with explicit effectiveDate. MLB is Historical 2020–2025; never present it as today's live events. Regular/Postseason projections remain separate.
- Collected-range totals and saved-season comparisons are not full Career. Incomplete coverage cannot become complete by visual presentation.
- NPB HOT/Ranking remain closed unless independently authorized evidence opens them. Explorer/Compare/Watch do not bypass those gates. MLB qualified rate ranking semantics and exact canonical PA BvP remain unchanged.
- Player images/team logos with unclear rights stay unavailable. Display names and aliases are verified metadata, not identity keys.
- Retrosheet/Chadwick/Wikimedia attribution and field provenance remain accessible. Export remains governed by `domain/product-sharing.ts`: bounded displayed MLB derived results with credits; NPB export is blocked. Do not widen rights through redesign.

## Routes and context

Hash routes retain `#/NPB/...` and `#/MLB/...`. Main resources: `home`, `schedule`, `search`, `players/:canonicalId`, `teams/:canonicalId`, `games/:canonicalId`, `records`, `data`, `history`, `compare`, `team-compare`, `season-compare`, `postseason`, `postseason/series/:canonicalId`, `milestones`, `library`, `watch-center`, `my`, `glossary`, `sources`. Player sections: `stats`, `analysis`, `game-log`, `more`, `trends`; legacy `advanced` links resolve to Analysis with year/scope preserved.

Use existing portable condition parsers/validators for season, competition, filters, sort and metrics. Search typing replaces the current history entry; explicit context/period selection creates meaningful history. Native Back closes an open dialog, then router history, then the canonical parent, exiting only at root. Query-only edits retain focus; screen transitions focus main. Invalid IDs/dates/unsupported contexts show explicit fallback, never fabricated data.

## Acquisition/state boundaries

UI calls application/composition interfaces, not infrastructure providers. Historical hooks and product consumers share the validated gzip reader. Concurrent same-path reads share fetch/decode/validation; settled reads are not permanently memoized, so corrections remain observable. Public response cache saves only validated last-success responses. Never cache error responses or raw PA/event streams.

Distinguish loading, no rows, capability unavailable, network error with retry, partial coverage, stale generation and offline saved-response fallback. Missing values render as —, not zero. `RuntimeStatus` announces saved/offline data. Screen render failures are contained without resetting personal state.

## Persistence/platform boundaries

Favorites use league + canonical entity; keep legacy player migration and team keys. `PersonalLibrary` owns bounded Collections/Saved Views/Activity with versioned validation. `PersonalWatch` owns observations/preferences/read/hidden/dedup state. Do not rewrite storage keys/schema for cosmetic changes. Corrupt data is preserved until an explicit namespace reset; quota failure must not silently advance the Watch baseline. Collection IDs and saved-view IDs are local, not portable public links.

Watch: first observation creates a baseline; later validated changes are labeled data changes, not event-time claims. Home summary does not acquire Watch data. Evaluation is bounded, rejects stale/older/offline-fallback observations, and distinguishes partial/historical evidence. External Android notifications are setup-dependent and delivery-unverified; no browser/native/background push was added.

Android bundles the shared app shell and uses existing platform adapters for Back, links, lifecycle, network and preferences. Do not replace the hash router, expose credentials, finalize signing/package ID or enable Firebase as part of a UI pass.

## Known product gaps

NPB Career/Historical, Current Postseason, WHIP, current roster/uniform evidence, unresolved identity/review queue, MLB Current and rights-pending assets remain Source/Data Quality work. Initial shared JS remains relatively large; a future measured code-splitting task may reduce it, but must preserve correction/cache/route semantics. Native hardware/TalkBack and true network-disabled launch require a device QA pass; automated tests and browser checks do not replace that evidence.
