# Sports/data UI research

Reviewed 2026-10-01. These are official product pages, public interfaces and documentation reviewed for interface design only. No statistics, assets, branding or layouts are imported from these services. Native apps were not installed or benchmarked; claims below are limited to the accessible materials.

| Service / first-party reference | Observed pattern |
|---|---|
| [Apple Sports introduction](https://www.apple.com/newsroom/2024/02/introducing-apple-sports-a-new-app-for-sports-fans/) / [guide](https://support.apple.com/guide/apple-sports-app/welcome/web) | Fast score access, personalized teams and result-to-detail navigation. |
| [FotMob](https://www.fotmob.com/) / [company](https://www.fotmob.com/aboutUs/company) | Match browsing and follow-oriented discovery. |
| [Sofascore](https://www.sofascore.com/) | Competition, match-state and favorites filters. |
| [Formula 1 results](https://www.formula1.com/en/results/2025/drivers) | Aligned rank, participant and points. |
| [FanGraphs leaderboard interface](https://blogs.fangraphs.com/weve-updated-our-major-league-leaderboards-interface/) / [custom leaderboards](https://blogs.fangraphs.com/the-sites-most-underrated-feature-custom-leaderboards/) | Filtering and deliberate metric selection in dense statistical tables. |
| [Baseball Savant](https://baseballsavant.mlb.com/) | Separate leaderboards and a glossary entry point. |
| [Baseball Reference leaderboard glossary](https://www.baseball-reference.com/about/leader_glossary.shtml) | Statistical definitions alongside a broad data hierarchy. |
| [TradingView watchlist advanced view](https://www.tradingview.com/support/solutions/43000771546-watchlist-advanced-view-mode/) / [watchlists](https://www.tradingview.com/support/solutions/43000745825-mastering-the-tradingview-watchlists/) | Followed entities and selectable comparison context. |
| [NBA Stats player tables](https://www.nba.com/stats/players/traditional) / [help navigation](https://www.nba.com/stats/help) | Distinct traditional/advanced tables, leaders, statistical minimums and glossary. |

## Application decisions

These are our design judgments, not claims that the services use the identical implementation:

- Scores use two team rows with fixed numeric alignment, a small saved-status column and one canonical Game link. Team abbreviations/neutral initials do not imply authorized club marks. Unknown score remains an em dash.
- Home starts with useful data. NPB shows recent games and standings; MLB shows selected imported-season games, a verified Japanese cohort and actual counting leaders. An unavailable capability never gets a fabricated preview.
- The primary navigation is Home / Games / Players / Records / My. Analysis belongs to the selected player. Purpose-specific future routes sit under Explore or Profile rather than competing with available functions.
- Statistics share ruled grids and comparison rows rather than isolated rounded cards. Rank, player and value establish leaderboard hierarchy. Filters and the selected season remain explicit.
- Metric help opens beside the metric without leaving the page. OBP denominator, SLG interpretation, K/9 sample caveat, BF and RISP context are explicit. Qualification explanation and uncertainty remain separately discoverable.
- Favorites are fast local shortcuts. Japan discovery uses reviewed canonical identities, not names or guessed nationality. Japanese labels are retained when verified, with original-name fallback.
- Mobile controls retain 44px targets, native modal focus/Escape/Back behavior, visible keyboard focus and internal table scrolling. Light/Dark colors belong to the app, not teams.

No new provider, analytics, paid runtime or current MLB collection is introduced by this research.
