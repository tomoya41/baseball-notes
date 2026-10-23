# Baseball Notes — full-screen editorial redesign

Baseline: main `e4c73be` (PR #67), 2026-10-23. The supplied twelve-screen concept is the visual direction, not a source of real players, logos, results, live innings or advanced data. Delivery now includes review, merge and Pages only after validation (the user's later authorization supersedes the initial PR-only stop).

## Direction and migration

**Everyday clarity, event atmosphere, useful depth.** Navy score stages, white/quiet statistical surfaces, editorial event covers. Standard phone body remains 14px; identities 20px; captions 12px; only scores receive large numerical emphasis. Android font scaling remains native. No external fonts.

The old interface put menus/seasonal text before games and hid both box scores inside independent disclosures. Home now starts with stored results, games offer a direct in-page jump and one selected team, and profiles place navigation immediately after identity. New visual assets belong to events/history, not every statistical card. Shared shell/controls apply to every route; Games, Player, data exploration and editorial/personal families have distinct compositions.

Affected layer: React presentation/CSS plus the bounded offline application-asset manifest. No acquisition, statistics, eligibility, canonical ID, database, public data projection or local-storage migration. Revert these presentation commits to roll back; existing pinned data and local keys remain usable. New `boxSide` is optional, retains all existing query values, and falls back to away for legacy URLs. Both teams are already loaded; changing the selected team makes no request.

## Competitive evidence, checked 2026-10-23

Official public descriptions/screens and the user's attached examples were inspected. Competitor native apps were not installed or measured. Public-store ratings/reviews are observations, not proof of why an app is popular.

| Reference | Observed principle adopted | Deliberately excluded |
|---|---|---|
| [NPB+ official](https://www.japan-baseball.jp/npb-plus/) | Strong player identity, score/role hierarchy and separate performance detail | Tracking, photo/logo assets, uncollected live situations |
| [Sportsnavi official](https://sports.yahoo.co.jp/promo/app/bblive/) | Game → player facts → profile; followed subjects easy to reach | Pitch-by-pitch core, ads/news body, implied real-time service |
| [Apple Sports official examples](https://www.apple.com/newsroom/2024/02/introducing-apple-sports-a-new-app-for-sports-fans/) | Opposed teams/scores; clear result before supporting actions | Betting, television features and branded gradients |
| [FotMob public store](https://play.google.com/store/apps/details?id=com.mobilefootie.wc2010&hl=en) and attached match list | Compact aligned match rows, date/status column, grouped context | Football ratings and copied assets |
| [Sofascore public UI](https://www.sofascore.com/) and attached profile | Identity/tabs before detailed content; two-subject numerical comparison | Unsupported proprietary scores/maps |
| [FanGraphs public leaders](https://www.fangraphs.com/leaders/major-league) and attached table | Semantic aligned tables; scope/metric exploration; detailed statistics below essentials | A desktop-width wall of columns at enlarged phone text |
| [MLB official](https://www.mlb.com/apps/mlb-app) | Connected player/game/history destinations | Unlicensed 2026 Current data, footage and photos |

[Sportsnavi public reviews](https://play.google.com/store/apps/details?id=jp.co.yahoo.android.sports.npb.textlive&hl=ja) include a 2026-07-26 complaint about repeated follow prompts/unwanted articles/advertising. This supports avoiding intrusive onboarding in our design; it does not establish a general sentiment or causal usability result. The pasted claim about an MLB Box Score complaint was not independently established and is not relied on.

## Screen inventory and acceptance

All existing routes are retained. This is the design/verification plan, **not** a declaration that every state was visually inspected. Actual screenshots, dimensions, unavailable data and test results belong to the delivery evidence below.

| Family | Composition / acceptance | Data boundary |
|---|---|---|
| NPB Home, standings, followed | Results before editorial cover/search; compact match rows; personalized view | One bounded existing results feed; additional form fetch 0; HOT closed |
| MLB Home | Historical cover/year, already-fetched results sample, one lead followed player and compact others | At most existing four profiles; selected historical year |
| Schedules, scoreboard, preview | Date navigation, status left, team names and right-aligned scores | Unknown ≠0; no invented live status |
| Regular and historical Game detail | Opposed result stage, direct box-score jump, one selected team | Both lineups preserved; all secondary fields retained |
| CS / Japan Series Game detail | Same result/row primitives, actual innings and collected player facts | Stage/partial/source preserved; unplayed results remain absent |
| Player overview / Stats | Compact season/competition row, navy identity, readable tabs, role-specific statistics | No inferred number/current affiliation; both actual roles retained |
| Player analysis / Trends / Game log | Primary results, existing graphs/samples, disclosure for conditions | Exact existing aggregates, partial chronology, canonical game links |
| Player metadata / lifecycle | Labelled profile facts and career chronology | Verified fields only; historical affiliation not current roster |
| HOT / monthly / rising-cooling | Edition, compact criteria, lead rank plus dense result list | Existing scoring, date windows, sample thresholds, closed NPB gates |
| Records / milestones | Metric-first results, rank/name/value alignment and exact period | No partial historical totals called full Career |
| Search / directory / teams | Input/results first, summary of active filters, labelled secondary tools | Existing aliases/identity; missing metadata explicit |
| Team hub / stats | Record, saved performance, games and roster | Actual saved team membership, no logo-rights expansion |
| Player / Team / Season Compare, BvP | Distinct two-subject presentation and metric-specific scales | Missing values have no bar; no new statistical interpretation |
| Explorer / Recent / saved conditions | Essential criteria then results; advanced choices disclosed | URL/Back/Reload/saved-view validation unchanged |
| NPB history / MLB history | Original archive cover, selected year/collected-range context | Partial NPB and admitted MLB years remain separate |
| Draft / young / schools | Draft editorial cover, readable prediction/results tabs and player rows | Immutable forecasts/results and eligibility exclusions preserved |
| Postseason / Series | Stadium cover, round progression and opposed series totals, game links | Played wins vs advantages, CS vs Japan Series vs Regular |
| My / Favorites / Watch / Collections | Followed subjects before organizing tools; compact personal rows | Existing baselines, read state, collection/activity keys |
| Explore / glossary / sources / privacy / settings | Clear typographic sections, ordinary controls and accessible sheets | Full license/source/metric definitions retained |
| Loading / empty / retry / unsupported / stale / saved fallback / legacy | Specific status and recovery action in the same shell | Never turn absence into zero or healthy/complete |

## Production image assets

Generated with the built-in dedicated image tool, then inspected and optimized as 960×640 WebP (quality 80). Original PNG masters stay in the local generated-images directory, not the repository. Final project files:

| Asset | Bytes | Use |
|---|---:|---|
| `src/assets/editorial/postseason-v1.webp` | 49,604 | Fictional empty night ballpark; postseason and autumn discovery |
| `src/assets/editorial/draft-v1.webp` | 40,580 | Baseball/scouting notebook in fictional empty event hall; Draft |
| `src/assets/editorial/archive-v1.webp` | 55,714 | Glove/ball on wooden stadium bench; historical exploration |

No real faces, official marks, written statistics or real-event claims. Images have empty alt text because adjacent live HTML conveys their role; all titles/results/controls remain selectable and accessible. Lazy loading, fixed intrinsic dimensions and a dark readable fallback prevent dependency on successful image loading. The three hashed WebP application assets are included in the existing versioned/verified offline shell (baseball JSON remains excluded).

Prompt set (production requirements): original photographic landscape 3:2; no people/faces, logos, lettering, watermarks, UI or results; uncluttered darker left for HTML title. Night stadium: first-base view across the diamond, floodlights, forest-green grass/navy sky, realistic geometry, no neon/CGI. Draft: ivory red-stitched ball and closed dark scouting notebook on polished wood, empty blurred event hall, restrained warm gold/charcoal. Archive: used glove/scuffed ball on quiet wooden ballpark bench, fictional historic stadium, muted olive/tobacco/parchment, tactile analog texture. These scenes are atmosphere, not source evidence.

## Delivery evidence

In progress. Before captures use the deployed PR #67 code. After captures use this branch and the same player/year/game where available. Physical Pixel/TalkBack are separate from browser/emulator evidence. No data integrity or Turso recovery claim follows from UI tests.
