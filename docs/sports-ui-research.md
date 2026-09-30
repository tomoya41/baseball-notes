# Sports/data UI research

Reviewed 2026-10-01. The first pass relied too heavily on descriptions and retained the old screen composition. A second pass directly inspected the first-party screenshots and public interfaces listed below before replacing Home, the calendar and the Game score composition. No statistics, visual assets or branding from these services are imported into the app. Native apps were not installed or benchmarked.

| Service / first-party reference | Observed pattern |
|---|---|
| [Apple Sports actual Game screen](https://www.apple.com/newsroom/images/2024/02/introducing-apple-sports-a-new-app-for-sports-fans/article/Apple-Sports-game-page_inline.jpg.large.jpg) | Symmetric team identity around a central score; separate result and statistical comparison. |
| [FotMob official app preview](https://www.fotmob.com/_next/static/media/download-mockup-en.9bf44f1b.png) / [download](https://www.fotmob.com/download) | Quick calendar strip, grouped competition results and aligned compact scores. Preview inspected for design; no systematic data extraction. |
| [Sofascore official Home preview](https://files.sofascore.com/news/2025/10/New-Home-screen-3-819x1024.jpg) / [explanation](https://www.sofascore.com/news/sofascores-new-home-screen-a-smarter-faster-way-to-follow-sports) | Separate sport/context switching, follow filters and result browsing. |
| [Formula 1 results](https://www.formula1.com/en/results/2025/drivers) | Aligned rank, participant and points. |
| [FanGraphs actual leaderboard preview](https://blogs.fangraphs.com/wp-content/uploads/2023/08/FG-Updated-MLB-Leaderboards-1536x1262.png) / [interface article](https://blogs.fangraphs.com/weve-updated-our-major-league-leaderboards-interface/) | Role/context filters separated from metric presets and a dense, aligned statistical table. |
| [Baseball Savant](https://baseballsavant.mlb.com/) | Separate leaderboards and a glossary entry point. |
| [Baseball Reference](https://www.baseball-reference.com/) | Actual page was blocked by a security challenge, which was not bypassed. No claim of visual inspection; glossary references from the previous pass are text only. |
| [TradingView watchlist advanced view](https://www.tradingview.com/support/solutions/43000771546-watchlist-advanced-view-mode/) (enlarged first-party UI image) | Names and real comparable values together; watchlist context, view mode and data columns have distinct hierarchy. |
| [NBA Stats player tables](https://www.nba.com/stats/players/traditional) / [help navigation](https://www.nba.com/stats/help) | Distinct traditional/advanced tables, leaders, statistical minimums and glossary. |

## Application decisions

These are our design judgments, not claims that the services use the identical implementation:

- Scores now use opposing team columns around a central score/status. Game Detail has the same hierarchy at a larger scale. Names do not imply authorized club marks. Unknown score remains an em dash; known zero is retained.
- NPB Home switches between Scores / Standings / Follow; it no longer stacks all sections. MLB Home defaults to a Japanese-player watch board with actual selected-year OPS/HR or ERA/SO, both roles where present, and favorites. Follow / League are separate modes. A four-profile maximum avoids fetching the all-player Season aggregate. An unavailable capability never gets a fabricated preview.
- Schedule uses a bounded five-date calendar ribbon with previous/next, a native date picker and explicit historical Season. Dates are calendar dates, with UTC used only to avoid timezone-dependent day arithmetic.
- The primary navigation is Home / Games / Players / Records / My. Analysis belongs to the selected player. Purpose-specific future routes sit under Explore or Profile rather than competing with available functions.
- Statistics share ruled grids and comparison rows rather than isolated rounded cards. Rank, player and value establish leaderboard hierarchy. Period uses one segmented control; MLB conditional splits use one native selector instead of nine wrapping chips. BvP opponent rows separate name and PA count.
- Metric help opens beside the metric without leaving the page. OBP denominator, SLG interpretation, K/9 sample caveat, BF and RISP context are explicit. Qualification explanation and uncertainty remain separately discoverable.
- Favorites are fast local shortcuts. Japan discovery uses reviewed canonical identities, not names or guessed nationality. Japanese labels are retained when verified, with original-name fallback.
- Mobile controls retain 44px targets, native modal focus/Escape/Back behavior, visible keyboard focus and internal table scrolling. Light/Dark colors belong to the app, not teams.

No new provider, analytics, paid runtime or current MLB collection is introduced by this research.
