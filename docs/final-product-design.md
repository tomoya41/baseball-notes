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

## Scroll policy (user requirement)

The user clarified that **document-level vertical scrolling is also disallowed**. Screens must fit the viewport and expose remaining content through explicit previous/next pages, tabs and detail destinations. No user-operated scroll panel, carousel or wide table. The viewport presentation layer paginates the existing document flow; it must keep every data item and keyboard target reachable rather than merely clipping overflow. Wrap navigation, disclose details, paginate lists and adapt tables into labelled rows on narrow screens. Validate page counts and focus transitions after asynchronous loads, filter changes, viewport resize and enlarged text.

## Implementation / verification

Foundation and navigation first, followed by core, analytical and personal surfaces. Keep existing read models and bounded fetching. Split optional route implementations without changing repositories. Verify 360px Light/Dark, tablet and desktop, direct links, keyboard/focus, reduced motion, local persistence, data hashes and Android builds before publishing.
