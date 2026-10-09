# Final product UI direction

## Scope and boundaries

Presentation-only reconstruction after the Product Completion audit. All public routes, canonical IDs, data readers, coverage, production gates, attribution, export restrictions and local storage namespaces retain their meaning. No source acquisition or canonical writes. UI commits can be reverted independently; no data migration is required.

## Visual language

A baseball scorebook: strong score and numeric hierarchy, compact named rows, ruled sections and restrained ink/terracotta accents. Light uses warm paper and dark ink; Dark uses graphite surfaces and warm highlights. Neutral initials remain the fallback for unlicensed portraits and marks. App accents are not official team colours.

## Information architecture

- Home: league/season context, results or followed players, then exploration. MLB remains visibly Historical.
- Player / Team: identity → headline figures → scoped details. Supporting actions must not precede identity.
- Game: state and score → deterministic recap/preview → box score.
- Explore / Compare: compact scope controls, expandable advanced filters, readable result rows and explicit samples.
- My: saved players/teams, collections, saved conditions, activity and observed changes. Watch remains in-app data comparison, not Push.
- The five primary destinations and every existing deep link remain available. Sharing belongs in a secondary action, not a full-width introductory panel.

## Navigation and scroll policy (2026-10-09 correction)

The user explicitly chose natural vertical document scrolling after finding viewport pagination confusing. There is one document scroll, no CSS-column pages or artificial page counts. Fixed primary navigation remains reachable. Native modal dialogs temporarily lock the document and have one content scroll plus a persistent close action. No data migration is needed; rollback is an application revert.

Detail tabs describe the content (概要 / 成績 / 分析 / 試合別 / 選手情報), distribute across their actual item count, and retain published routes. Use 球団ページ and コレクション consistently instead of implementation/product jargon. Historical context remains explicit as 過去シーズン; it is never relabelled today.

## Market reference review

Inspected official Apple Sports and FotMob app screenshots, not just marketing text:

- [Apple Sports official screenshots](https://www.apple.com/newsroom/2026/05/apple-sports-expands-to-more-than-90-new-countries-and-regions/): clear date/scope controls, compact score rows and purpose-labelled detail tabs.
- [FotMob official app preview](https://www.fotmob.com/download): continuous fixture lists grouped by competition, visible match identity before detailed statistics.

Applied patterns: continuous reading, fixed primary destinations, named sections and progressive disclosure. No third-party visual assets or data were copied; the existing baseball scorebook palette and rights-cleared content remain.

## Verification boundaries

Check 360px Light/Dark, larger viewports, long profiles, list-to-detail navigation, native dialog Escape/focus return and a single active scroll region. Retain data hashes, bounded readers, local persistence and Android Back contracts. Device TalkBack and real-device operation remain manual release checks.
