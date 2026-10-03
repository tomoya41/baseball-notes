# Product Expansion Batch 2

Home / Today, Game Preview / Recap and followed-team dashboards are derived UI views over existing public read models. No collector, source, database table, identity, aggregate or Production Gate changes. No recurring service costs.

## Time and capability boundaries

- NPB Today: `Asia/Tokyo` calendar date, recomputed at minute intervals. Never use an old effectiveDate as Today. Empty unknown/partial/failed indexes are unconfirmed, not no_games. Show the saved results effectiveDate next to the current JST date.
- At most 15 saved date indexes (Today ±7 days, clipped to manifest bounds), fetched concurrently from static Pages with ordered failure tracking. Future items must have explicit scheduled status; recent results must be final and no later than effectiveDate. Failed indexes remain visible as a partial-read warning. No next-game assertion beyond that saved range.
- MLB: selected historical season only. Never label historical final games as current, live or next. Unsupported years remain unavailable. My accepts an explicit regular/postseason scope, and all selected-season links and controls retain it; default My remains regular. No MLB Preview because the current data contract contains historical finals only.
- Additive local product capability matrix in `product-daily.ts`; existing public capabilities and NPB HOT/Ranking/Infrastructure Gates remain untouched.

## Favorites

Reuse `baseball:favorites:v1`: `{league, kind: player|team, entityId, addedAt}`. Team IDs are canonical; league and kind participate in matching. No migration, no cloud backend, no token table. Existing preferences adapters provide Web/offline and native persistence. Notifications continue to select NPB **player** favorites only.

Team Hub, dated Games, Home scoreboard disclosures and Game Detail expose add/remove. My keeps the complete removable saved list, with at most four team activity payloads and four player detail/Recent summaries. Home uses a compact subset to avoid an oversized dashboard.

NPB favorite Recent requires the same effectiveDate as Catalog. Recent streaks are the tail of the 7-day saved appearance window, with coverage and Fact count checks; missing stats, incomplete coverage or ambiguous ordering remain unconfirmed. `+` denotes a possible continuation beyond the window, not an official record. MLB tail streaks use the selected historical season and the existing canonical chronology. Both link to the established Trends / Analysis views.

Milestone proximity uses coordinated Catalog/Capabilities/Milestones generations, only when the existing capability allows it. At most three favorite checkpoints within three counts of the next app-defined season threshold; never career achievements or official milestone dates.

## Preview / Recap

NPB scheduled Game Detail uses only prior final games within 14 days. Season summary is shown only when its effectiveDate is no later than the day before the previewed game. No inferred starters, lineup, current form prediction or BvP acquisition. Existing Team Hub / Compare / favorite Analysis provide deeper context.

Recap is rule-based for both leagues: batters with >=2 hits or >=1 HR; pitchers with >=18 outs and <=1 run, or >=3 outs and zero runs. Favorites appear regardless of that threshold. Null stays unknown, zero-out pitchers are not automatically classified as highlights. Show criteria inline on demand; no causal victory/loss prose and no HOT ranking claim.

Postseason Recap preserves competition-scoped Player/Team navigation and shows Series wins only through the selected game's final prefix; eventual Series outcome is not leaked into earlier recaps. Played wins and rule-advantage credits have separate labels in Recap. Rule advantage wins remain separate and never become artificial Game wins.

## Delivery / rollback

Application-only Pages publication preserves all coordinated NPB and MLB regular/postseason payloads byte-for-byte. No canonical write. Compare the existing 26 payload hashes/counts/IDs/Gates before and after publication. Rollback reverts this UI/read-model commit; stored favorites remain compatible and no migration is needed.

Regression includes JST/date boundaries, no_games vs unknown, doubleheaders, null Recap stats, pregame cutoff, exact Series prefix, both-league team/player favorites reload/idempotency, existing cache/native checks, and 360px Light/Dark smoke with real public data. CI builds the debug APK and unsigned release AAB. No signing/Firebase/Play release work.
