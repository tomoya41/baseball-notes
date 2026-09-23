# Baseball Data App — Product Specification

Status: Architecture selected; Phase 0 vertical proof and Analysis A foundation. Live data providers remain subject to the documented adoption gate.

---

## 1. Product vision

Create an Android-first baseball data application for NPB and MLB fans.

The product should answer questions such as:

- Who is performing best right now?
- Who has become hotter or colder recently?
- What does this statistic actually mean?
- How does this player compare with peers, past seasons, or historical players?
- Which milestones are approaching?
- What happened to past draft classes?
- Which draft prospects, prospects, rookies, FA players, posting candidates, or preseason performers are worth watching?
- What does the richer MLB data reveal that ordinary box scores do not?

The app is deliberately **not** a pitch-by-pitch速報 product. Live pitch-by-pitch usage is left to established速報 apps. The product concentrates on data, interpretation, discovery, historical context, and seasonal baseball stories.

---

## 2. Primary audience

Primary user:
- A normal baseball fan.
- Interested in statistics and player performance.
- Does not necessarily know sabermetric terminology.
- Wants deeper information without needing a specialist analytics site.

Design rule:
> Keep the data rich, but make the meaning understandable.

Advanced metrics must not be hidden merely because they are advanced. Instead, provide accessible explanations.

Example:

**Barrel% — 17.8%**
- What it measures: percentage of batted balls with an ideal combination of exit velocity and launch angle.
- How to read it: higher is generally better for power production.
- Context: show percentile or league-relative context when reliable data permits.

---

## 3. Hard constraints

1. Android smartphone app first.
2. NPB and MLB are both first-class.
3. Additional recurring monthly operating cost must remain ¥0 unless explicitly approved later.
4. Use only data sources whose use is compatible with the intended application.
5. Do not rely on prohibited scraping, reverse engineering, or undocumented private APIs.
6. AI is optional and must never be required for the core product to work.
7. Implementation must be incremental and reviewable.
8. The codebase must be designed so data providers can be replaced.
9. No requirement for pitch-by-pitch速報.
10. Repository cleanup is part of normal completion of every task.

---

## 4. Product principles

### 4.1 Rich data, simple presentation
Store and support as much useful permitted data as practical, especially for MLB, but progressively disclose it in the UI.

### 4.2 MLB can be richer than NPB
Do not reduce MLB to artificial parity with NPB.

If MLB legitimately provides:
- Statcast metrics,
- detailed batted-ball metrics,
- pitch metrics,
- defense,
- running,
- rolling windows,
- historical datasets,
- prospect information,

the app should be capable of using them.

### 4.3 Never fabricate missing parity
If an NPB equivalent is unavailable, show that the metric is unavailable for that league/source. Do not estimate or invent it merely to fill the screen.

### 4.4 Historical accumulation is an asset
Daily or periodic snapshots should be stored where practical so the app can compute:
- 7-day,
- 14-day,
- 30-day,
- monthly,
- season,
- trend,
- delta,
- streak,
- and historical comparisons.

### 4.5 Seasonal relevance
The app should change emphasis across the baseball calendar rather than present a static home screen all year.

---

## 5. Navigation concept

Final navigation may evolve during UI design, but the information architecture should support:

- Home
- Hot / Rankings
- Players
- Records
- Future / Draft / Prospects
- Seasonal modules
- My / Favorites

Search must be easily accessible.

NPB / MLB filters should be available globally where appropriate.

---

## 6. Home

Home combines personalized and timely information.

Core sections:

### 6.1 My
Favorite teams and players.

Examples:
- recent performance,
- ranking position,
- milestones,
- noteworthy movement,
- seasonal status.

### 6.2 Hot
Recently strong players.

Default windows:
- 7 days
- 14 days
- 30 days
- current month
- season

### 6.3 Now
Current relevant baseball information, not pitch-by-pitch速報.

Examples:
- completed game results,
- standout performances,
- milestone achievements,
- notable recent statistical changes.

### 6.4 Season
Dynamic seasonal module.

Examples:
- preseason in spring,
- MLB draft,
- NPB draft,
- pennant/record races,
- FA/posting/hot stove in the offseason.

---

## 7. Hot / recent-form analysis

This is a core product feature.

### 7.1 Periods
Support where data permits:
- today / most recent game,
- 7 days,
- 14 days,
- 30 days,
- calendar month,
- season.

### 7.2 Hitter rankings
Examples:
- AVG
- OBP
- SLG
- OPS
- HR
- RBI
- hits
- runs
- walks
- strikeout rate
- stolen bases
- situational stats where reliable

### 7.3 Pitcher rankings
Examples:
- ERA
- WHIP
- wins
- saves
- holds
- strikeouts
- K/9
- BB/9
- opponent AVG
- quality starts where available
- recent-start / recent-appearance performance

### 7.4 Hot / rising / cooling signals
The app should calculate changes such as:
- recent window vs season baseline,
- current month vs prior month,
- recent 30 days vs previous 30 days,
- rolling trend changes.

Labels such as “hot”, “rising”, or “cooling” must be based on transparent statistical rules rather than arbitrary AI judgment.

### 7.5 Qualification
Rankings must provide appropriate minimum-sample options such as:
- all players,
- qualified / qualification-equivalent,
- minimum plate appearances / innings / appearances.

The rule must be visible.

---

## 8. Player directory and player profiles

### 8.1 Search
Search NPB and MLB players by:
- Japanese name,
- romanized / English name where available,
- team,
- position.

### 8.2 Profile overview
Use permitted structured sources where possible.

Potential data:
- name,
- name readings / English name,
- date of birth,
- age,
- birthplace,
- nationality where appropriate,
- height,
- weight,
- bats / throws,
- position,
- jersey number,
- current team,
- previous teams,
- amateur history / school history where available,
- draft information,
- professional debut,
- awards,
- career timeline.

### 8.3 Statistics tabs
Suggested presentation:
- Overview
- Season
- Recent
- Career / yearly
- Records
- Advanced
- Career / timeline

### 8.4 Metric explanations
Every unfamiliar statistic should expose an info action containing:
- name,
- full name if abbreviated,
- plain-language definition,
- interpretation,
- rough context or league-relative percentile when defensible,
- caveats.

---

## 9. MLB advanced data

Use useful permitted MLB data as broadly as practical.

The exact data source and licensing/usage conditions must be verified before production use.

Potential categories include:

### 9.1 Hitting / batted ball
- Exit Velocity
- Max Exit Velocity
- Launch Angle
- Hard-Hit%
- Barrel%
- xBA
- xSLG
- xwOBA
- wOBA where available
- Bat Speed
- squared-up / swing-related metrics where available
- home-run distance
- spray / batted-ball distributions where permitted

### 9.2 Pitching
- pitch velocity
- max velocity
- spin rate
- pitch movement
- pitch usage
- whiff rate
- chase rate
- strikeout / walk metrics
- expected statistics
- pitch-type performance

### 9.3 Defense
- OAA and related permitted metrics
- position-based defensive metrics

### 9.4 Running
- Sprint Speed
- baserunning metrics where available

### 9.5 Trend analysis
Advanced MLB data should support:
- recent rolling windows,
- changes from season baseline,
- player percentile context,
- year-over-year changes,
- “what changed recently?” views.

Advanced metrics must remain understandable to non-experts.

---

## 10. Records

### 10.1 Historical rankings
Support NPB and MLB historical rankings where reliable and permitted.

Examples:
- HR
- hits
- RBI
- runs
- stolen bases
- wins
- saves
- strikeouts
- games
- rate statistics where qualification is valid.

### 10.2 Filters
Where meaningful:
- all-time
- active players
- league
- position
- age
- season
- era / date range.

### 10.3 Record Watch
Show approaching milestones.

Examples:
- 2,000 hits
- 200 / 300 / 500 HR
- 200 wins
- 2,000 strikeouts
- league-specific significant thresholds.

Example:
> 200 HRまであと3

### 10.4 Achievement integration
When a milestone is reached:
- update player record status,
- create a notification if enabled,
- show historical context.

---

## 11. Comparisons

### 11.1 Player vs player
Compare:
- recent 7 / 14 / 30 days,
- season,
- career,
- age-equivalent point,
- advanced MLB metrics where both players have data.

### 11.2 Same-age comparison
Examples:
- career HR through age 26,
- hits through age 25,
- wins through age 27.

### 11.3 Draft-class comparison
Compare players from the same draft class over time.

---

## 12. Streaks

Potential streaks:
- consecutive games with a hit,
- consecutive games with HR / RBI where useful,
- consecutive scoreless innings,
- winning streaks for pitchers where contextually meaningful,
- on-base streaks,
- other measurable streaks.

Streak logic must be deterministic and test-covered.

---

## 13. Draft

Draft modules are seasonal but historical draft data remains accessible.

### 13.1 NPB Draft
Support:
- draft date / event overview,
- notable prospects,
- prospect profiles,
- position,
- school / university / club,
- physical profile,
- available statistics,
- recent performances,
- draft history,
- favorite prospects.

### 13.2 Draft prediction aggregation
Do not present AI-generated guesses as fact.

Preferred approach:
- aggregate clearly sourced media predictions where reuse is permitted,
- show number of sources linking a prospect/team,
- show change over time,
- distinguish official, reported, and prediction information.

### 13.3 Draft day
When official results become available:
- attach drafted player to team,
- preserve pre-draft profile,
- continue the player lifecycle into professional data.

### 13.4 Historical draft
Allow exploration by year:
- team selections,
- round,
- later career results,
- draft-class rankings/comparisons.

### 13.5 MLB Draft
Support MLB draft/prospect information where reliable permitted data is available.

---

## 14. Prospects / farm / minors / rookies

Support progressively:
- NPB farm players,
- MLB minor-league prospects,
- prospect lists where permitted,
- recent prospect performance,
- rookie watch,
- transition from draft prospect to professional player.

Avoid editorial claims such as “will definitely be promoted.” Show the underlying performance and sourced reporting instead.

---

## 15. Offseason / Hot Stove

### 15.1 FA
Track:
- eligibility,
- declaration,
- status,
- official signing,
- previous team,
- new team,
- recent/career stats.

### 15.2 Posting
Track:
- official posting process,
- dates / deadlines,
- official result,
- NPB-to-MLB history,
- related sourced reporting.

### 15.3 Movement
Support:
- trades,
- released players,
- retirement,
- active-player draft where applicable,
- new foreign players,
- team additions and departures.

### 15.4 Information confidence
Clearly separate:
- Official
- Reported
- Prediction / rumor

Never render rumor as confirmed fact.

### 15.5 Team IN / OUT
Provide a team-level offseason ledger:
- additions,
- departures,
- draft,
- FA,
- trades,
- foreign players,
- retirement/release.

---

## 16. Preseason / open games / spring

### 16.1 Current preseason
Show:
- team records,
- standings,
- hitter performance,
- pitcher performance,
- rookies,
- new foreign players,
- roster competition.

### 16.2 Historical comparison
Compare:
- preseason ranking vs regular-season finish,
- preseason player performance vs regular-season performance,
- historical outcomes for preseason leaders.

### 16.3 “Does preseason predict the season?”
Create data-driven historical views rather than unsupported conclusions.

Examples:
- average regular-season finish after top-3 preseason finish,
- preseason batting leader’s eventual regular-season line,
- year-by-year comparison.

### 16.4 Position competition
Where data permits, compare players competing for similar roles without making unsupported roster predictions.

---

## 17. Favorites / My Baseball

Initial version:
- no account required,
- local device persistence.

Allow favorite:
- teams,
- players,
- draft prospects where applicable.

My view should surface:
- recent-form changes,
- ranking positions,
- record milestones,
- official movement,
- seasonal updates.

---

## 18. Notifications

Notifications are in scope.

Do not build generic pitch-by-pitch scoring alerts as the primary notification system.

Categories may include:
- milestone achieved,
- milestone approaching,
- favorite player enters a defined recent-form leaderboard,
- significant hot/rising signal,
- official FA signing,
- official posting update,
- official draft selection,
- favorite team significant roster movement,
- preseason / rookie / prospect event where rules are clear.

Users must be able to enable/disable categories.

Notifications should be event/rule-driven where possible, not dependent on AI.

---

## 19. News / sourced information

This app should not become a generic news reader.

Use news/sourced content primarily when it adds context to:
- players,
- draft,
- FA,
- posting,
- roster movement,
- prospects,
- significant records.

Prefer:
- headline,
- source,
- date,
- short permitted summary,
- link to original.

Do not reproduce full copyrighted articles.

---

## 20. AI

AI is optional enhancement.

Potential later uses:
- “Explain this stat simply.”
- “Why is this recent performance notable?” using supplied data.
- concise summaries of already-sourced information.
- explain differences between advanced metrics.

Rules:
- never fabricate missing statistics,
- never convert rumor into fact,
- always ground summaries in supplied data/sources,
- core functionality must work with AI disabled,
- free quota constraints must be respected.

Google AI Pro subscription used by the developer is not assumed to equal production API quota. Production AI integration must use a legitimate API/free tier if implemented.

---

## 21. Data strategy

### 21.1 Provider abstraction
The product should define internal domain models independent of individual providers.

Suggested layers:
1. provider adapters
2. validation/normalization
3. internal domain models
4. derived-stat calculation
5. cache/persistence
6. UI

### 21.2 Data categories
Separate:
- relatively static profile data,
- historical datasets,
- season totals,
- daily snapshots,
- derived rolling metrics,
- seasonal/event information,
- news/source references,
- advanced MLB data.

### 21.3 “Use all useful data” interpretation
The goal is broad data coverage, not uncontrolled ingestion.

Store/use data when:
- it is permitted,
- useful for current or plausible future product features,
- economical within the ¥0 constraint,
- and storage/processing is reasonable.

Do not automatically persist enormous raw pitch/event feeds merely because they exist if the product does not use them.

### 21.4 Snapshots
Where permitted and practical, record periodic player/team snapshots to make later rolling-window calculations possible without repeatedly requesting old data.

### 21.5 Staleness
Every remotely updated dataset should support:
- last updated timestamp,
- stale/error state,
- graceful fallback to cached data.

---

## 22. Data-source requirements

Before a provider becomes production-critical, document:
- provider/source,
- league coverage,
- fields/endpoints used,
- authentication,
- quota,
- update frequency,
- licensing/terms considerations,
- caching allowance,
- fallback plan,
- replaceability.

NPB and MLB may use different providers.

No production architecture should be tightly coupled to one undocumented endpoint.

---

## 23. Infrastructure / zero-cost requirement

The architecture must be capable of operating at additional recurring monthly cost of ¥0 for the intended initial personal/small-user use.

Potential free-tier components may include:
- static/web preview hosting,
- serverless functions,
- local device storage,
- free database/storage tiers,
- push-notification free tiers,
- free AI API tier if used.

The architecture task must verify current quotas/terms before selecting any cloud dependency.

Do not treat a developer subscription such as Google AI Pro as an application backend entitlement unless its terms explicitly allow that usage.

---

## 24. App / web development direction

Android is the primary distribution target.

Preferred initial direction:
- TypeScript web UI for fast iteration,
- Capacitor for Android packaging,
- browser preview during development,
- GitHub for source control,
- Vercel may be used for free previews or developer/admin views if useful.

This is a preference, not an irreversible mandate. The initial architecture task may choose a materially better zero-cost approach but must document the reason before implementation.

---

## 25. Offline / local behavior

At minimum:
- favorite settings should survive app restarts,
- recently fetched/cached content should remain viewable where feasible,
- stale content must be labeled,
- network failure must not crash primary navigation.

---

## 26. Accessibility / usability

- Touch targets appropriate for smartphones.
- Respect system font scaling where practical.
- Do not communicate important state by color alone.
- Support dark and light themes eventually; initial architecture must not block either.
- Charts/tables must have readable textual context.
- Japanese-first UI, while MLB names/terms may retain appropriate English labels.

---

## 27. Phased implementation

All phases are part of the long-term product. They are **implementation order**, not abandoned scope.

### Phase 0 — Architecture and proof of data
Goal: prove the foundation before building product breadth.

Deliverables:
- chosen technical architecture,
- source tree,
- provider adapter interfaces,
- data-source feasibility notes for NPB and MLB,
- normalized player/team/stat domain models,
- local persistence approach,
- basic navigation shell,
- CI/check commands,
- documented decisions.

Do not implement the full product.

### Phase 1 — Core player foundation
- NPB / MLB league handling
- player directory/search
- player detail
- season and career/basic yearly stats
- metric explanation framework
- favorites
- cached/offline-safe basic behavior

### Phase 2 — Hot / rankings
- 7/14/30 days
- current month
- season
- hitter rankings
- pitcher rankings
- filters / qualification
- rising/cooling calculations
- test coverage for rolling windows

### Phase 3 — Records / history
- career records
- active-player records
- Record Watch
- milestones
- streaks
- player comparison
- same-age comparison

### Phase 4 — Personalization / notifications
- My view
- configurable notifications
- milestone / rankings / movement events
- robust local settings

### Phase 5 — Draft / prospects
- NPB draft
- MLB draft where feasible
- prospect profiles
- prediction aggregation with source/confidence distinction
- draft history
- draft-class follow-up
- rookies/farm/minors progressively

### Phase 6 — Offseason
- FA
- posting
- trades
- release/retirement
- active-player draft
- foreign-player additions
- team IN/OUT

### Phase 7 — Preseason
- current preseason standings/performance
- player performance
- historical preseason-vs-season comparisons
- rookies/new players
- position competition views

### Phase 8 — Deep MLB
- additional Statcast/advanced metrics
- rolling advanced trends
- percentile/context views
- year-over-year advanced changes
- richer pitch/batted-ball/defense/running data as permitted

### Phase 9 — Optional AI enrichment
- simple metric explanation
- grounded performance explanations
- sourced summary assistance

---

## 28. Phase completion rule

A phase is not complete merely because screens exist.

Before advancing:
- relevant functionality works,
- external data failures are handled,
- calculations are tested,
- type/lint/build checks pass,
- major UI flows are manually verified,
- durable decisions are documented,
- obsolete task-related files and old implementation remnants are safely cleaned after reference verification,
- no new recurring paid dependency has been introduced.

---

## 29. Initial Work task boundary

The first Work/Codex task must **not** implement the full roadmap.

It should:
1. read this specification,
2. verify current technical/data-source assumptions,
3. choose and document architecture,
4. create the stable project skeleton,
5. implement only enough vertical functionality to prove the foundation,
6. run checks,
7. clean obsolete task-related files safely,
8. stop and report what is ready for the next small task.

The foundation should make later phases easy to add without forcing a rewrite.

---

## 30. Analysis — approved product scope

Added 2026-09-23. This section extends the roadmap; it does not authorize implementing all analysis phases at once. Analysis explains why a player is performing well, their strengths, and their tendencies to ordinary fans. Rich metrics remain welcome; unfamiliar metrics expose meaning and interpretation on demand, while all analysis values retain denominators, limitations, and a league/player baseline when a reliable comparison exists. AI is not required.

### 30.1 League and provider capabilities

Separate common analysis contracts, MLB advanced analysis, and feasible NPB analysis. Do not implement league checks throughout the UI. An `AnalysisCapability` manifest per provider/league governs controls and availability. Track data access (`available`, `conditional`, `unavailable`, `prohibited`, `research`) separately from implementation (`implemented`, `not-implemented`). Conditional or unverified permission is not permission to fetch.

The source-backed feasibility matrix is in `docs/analysis-capabilities.md`. Review each metric/filter against actual provider documentation, coverage years, authentication, quota, caching and redistribution rights before enabling it. Missing observations, zero observations, unsupported capabilities, unverified rights, and unimplemented features are different states.

Common candidates: AVG, OBP, SLG, OPS, HR, RBI, BB, SO, K%, BB%, ERA, WHIP, K/9, BB/9; handedness, home/away, inning, count, base state, RISP, outs, monthly and recent splits where licensed data supports them. A historical release is not a source of yesterday's current-season statistics.

NPB uses only permitted basic statistics and available recent/handedness/monthly/situation splits. Pitch-level and Hawk-Eye data remain disabled unless machine access, storage, aggregation and reuse are explicitly permitted. Do not infer missing NPB tracking data. MLB can expose richer licensed data independently.

### 30.2 Daily data and time semantics

Analysis uses completed games through the previous day, normally refreshed at most once per day. It is not an in-game feed. Every result must expose:

- source update time, fetch time, aggregation time and revision;
- the actual complete-through baseball date and its named IANA timezone;
- the resolved inclusive date interval, completeness, freshness and warnings;
- an understandable label such as 「分析データは前日終了時点」, plus the actual cutoff when delayed.

Use provider game dates, not the device's timezone, for baseball grouping. Date windows must survive timezone/DST, month/year boundaries and leap days. Never pull today's incomplete games into a trailing window. If the first day of a month has no completed days for that month, show an empty period, not last month's totals. Date-only month/year arithmetic must not be implemented with local-hour subtraction.

Daily aggregation/scheduling is a future implementation task. Do not add paid Cron infrastructure. Corrected data replaces the same aggregate's revision. Fetching old source data must not reset its source-age warning.

### 30.3 Shared AnalysisQuery

One query contract and validator must be used across screens and future adapters. Include league, subject (batter/pitcher/matchup), reference date/timezone, season type, requested metric IDs, grouping, and filters:

| Dimension | Options |
|---|---|
| Period | Season, last 7/14/30 calendar days, current month, previous month, custom inclusive dates |
| Opponent | All, vs RHP/LHP or RHB/LHB, specific pitcher, specific batter |
| Base state | All, empty, runners on, RISP, loaded |
| Outs | All, 0, 1, 2 |
| Count | All, first pitch, pitcher ahead, batter ahead, two strikes, full count, exact balls/strikes |
| Pitch | All, pitch type, configurable velocity interval |
| Context | Home/away, inning or inning band, lead/tied/behind, catcher when supported |

Provider Capability must cover every selected filter, grouping, metric, period and their combination. An unsupported filter must not be ignored or silently widened to All. Unsupported inputs are disabled with a reason. Velocity intervals use explicit units and non-overlapping lower-inclusive / upper-exclusive bounds. Preset thresholds can change without changing stored metric meanings.

### 30.4 Pitcher analysis

When permitted: handedness, recent and monthly form, innings, situations, 7/14/30 days and season baseline comparison.

MLB Pitch Arsenal, per pitch type: Usage%, average/max velocity, spin, vertical/horizontal movement, Zone%, Swing%, Whiff%, Chase%, Called Strike%, CSW%, opponent AVG/SLG, xBA/xSLG/xwOBA and Run Value where available. Retain useful licensed aggregates and their definitions; do not invent a field not provided by the source.

Default inning groups are 1–3, 4–6 and 7+, with individual innings in detail. Representative count groups are first pitch, pitcher ahead, batter ahead, two strikes and full count; exact 0-0 through 3-2 in detail. These groups overlap and must not be summed as a partition. Count is **pre-pitch**. Include handedness, base state, outs and score state only where observed.

### 30.5 Batter analysis and count semantics

Pitch-type candidates: PA, pitches, AVG, SLG, OPS, HR, K%, Whiff%, xBA/xSLG/xwOBA, exit velocity, Hard-Hit%, Barrel%. Do not label strengths/weaknesses from AVG alone. Later deterministic rules must consider league baseline, player baseline and sample size, with a visible rule version.

Count analysis has two distinct populations:

1. `plate-appearance-reached-count`: final outcomes of distinct plate appearances that reached the count, counted once per PA even if multiple foul balls occur at that count.
2. `pitch-at-count`: responses to pitches thrown at that pre-pitch count, counted per pitch.

Never compute the former by treating each pitch row as a PA. Pitch-type batting-result aggregates require an explicit PA attribution rule (for example terminal pitch) and separate pitch-response populations. Combined filters are enabled only when the adapter defines their meaning. RISP, outs, home/away, innings, handedness and lead/tied/behind require the relevant pre-event context.

### 30.6 Velocity and zone

Velocity-band analysis is configurable. Initial UI candidates for four-seam pitches: below 92, [92,95), [95,97), [97,99), 99+ mph. These are examples, not domain constants. Batter/pitcher results may include AVG, xwOBA and Whiff% when valid.

Later heatmaps may show pitch location/usage, Whiff%, opponent xwOBA; batter AVG/xwOBA/Whiff%/Swing%/HR/exit velocity. Keep coordinate system ID/version, units, viewpoint, measurement plane, strike-zone definition and season coverage. Savant's 2026 location/zone changes require a validated conversion or separate comparisons. Do not combine pitch coordinates and batted-ball plot coordinates. Model the coordinate definition now; defer grids, rendering and transforms.

### 30.7 MATCHUP

Entry points: today's games when a permitted schedule/lineup provider exists, player pages, and manual pitcher/batter selection. Direct matchups show PA, AB, H, HR, SO, BB, AVG, OPS when supplied, with a small-sample warning. Separately align the pitcher's actual arsenal usage with the batter's performance against those pitch types; this is contextual comparison, not direct head-to-head evidence.

The basic count UI compares responses to pitches at a pre-pitch count, separately for pitcher and batter; it never calls these final PA outcomes. Later location and velocity-band overlays require aligned coordinates/units and adequate samples. Show population, date window and baseline on each side. Similar pitch shape based on velocity/movement rather than pitch-name alone belongs to a late phase. Do not interpret matchup analysis as certainty about a game's result.

### 30.8 Catcher / battery

Name the feature **「捕手別バッテリー配球傾向」**. When observed catcher ID is available, group pitcher × catcher: usage, first pitch, two-strike counts, hitter handedness, innings, RISP and results. Do not state that the catcher requested a pitch; observed pairing does not identify decision-making causality. Leave room for Framing, Blocking, Pop Time, Arm Strength and other licensed catcher-defense metrics.

### 30.9 Watch integration

Use previous-day analysis to support watching, without pitch-by-pitch速報: today's starter × lineup, three hitters selected from the known batting order, later times through order (1st/2nd/3rd+), and bullpen prior appearance dates/pitch counts/consecutive days. A lineup is labelled confirmed or planned; the app does not infer the live next batter. Today's schedule/lineup is separate from the analysis cutoff and has its own freshness. Do not assert that a reliever will pitch today.

### 30.10 Recent change

Later compare last 30 days vs season, current vs previous month, recent vs previous 30 days. Batter candidates: AVG/OPS/K%/BB%/Hard-Hit%/Barrel%, pitch-type and velocity-band performance. Pitcher candidates: velocity, usage, Whiff%/K%/BB%/xwOBA, movement and pitch-type results. Use configurable deterministic rules, comparison scope and denominator; no AI requirement. Period overlap (last 30 vs season) must be disclosed.

### 30.11 Sample size and metric definitions

Every split/result retains denominators: PA, AB, BF, pitches, swings, outside-zone pitches, BBE, outs/innings, matchups as applicable. Unknown is not zero. Every derived percentage must retain its denominator population and definition version. League-relative values must identify the comparable baseline and its sample size.

Initial configurable warning candidates:

| Context | Warn below |
|---|---|
| batting split | 20 PA |
| pitch-level | 50 pitches |
| batted-ball | 20 BBE |
| pitcher × catcher | 100 pitches |

Show 「サンプルが少ないため参考値」 below the selected threshold; unknown sample size gets a distinct message. Warnings do not automatically remove data. Ranking qualification is a separate policy. Do not mix denominator thresholds with eligibility rules.

### 30.12 Storage and extension contracts

Prefer permitted raw data → bounded aggregation → needed aggregate cache. Do not permanently mirror every MLB pitch into a cloud database. Future aggregates include PitchMix, CountSplit, Batter/PitcherPitchTypeSplit, BatterySplit, ZoneSplit, VelocitySplit and MatchupSplit.

Cache identity must include provider and source revision, schema and aggregation/metric-definition versions, canonical query with all filters, daily reference date, resolved interval, source cutoff, and coordinate definition when applicable. Retention follows the license; enforce a size/entry bound before enabling an analysis cache. Retain counts needed to recompute rates; never average split rates without their proper denominators.

Analysis A originally introduced AnalysisQuery, AnalysisCapability, AnalysisResult, Split, SampleSize, shared freshness, minimal CountState/BaseState and coordinate metadata. Full PitchEvent/BattedBallEvent and detailed PitchMetrics/PitchMix/Battery/Zone/Velocity models still wait for an actual adapter and calculation. Use separate AnalysisProvider and player-directory contracts; no destructive migration of existing favorites/catalog caches.

### 30.13 Implementation sequence and stop rule

- **Analysis A**: feasibility matrix, Query, Capability, Split, SampleSize, freshness and validation. No real-data access without permission.
- **Analysis B**: pitcher pitch mix/results, inning/count/handedness.
- **Analysis C**: batter pitch-type/count/handedness/situation.
- **Analysis D**: direct matchup, arsenal vs batter, count and velocity.
- **Analysis E**: heatmap, trends, recent changes and percentiles.
- **Analysis F**: catcher/battery and defense.
- **Analysis G**: watching integration.

This order guides analysis work inside the existing product roadmap; it does not replace prior features or authorize automatic phase advancement. The initial Analysis A task stopped after architecture review, source matrix, contracts and regression checks. Analysis A was not a claim that daily acquisition or all analysis screens were implemented.

---

## 31. Japanese-first terminology and presentation

### 31.1 Language and explanation density

Japanese is the default UI language. Prefer terms natural to Japanese baseball fans; keep familiar abbreviations such as AVG, OBP, SLG, OPS, ERA, WHIP, WAR, K%, BB%, xwOBA and OAA. Do not translate established abbreviations merely to make every label Japanese. Compact cards emphasize value, short label and trustworthy context. They must not repeat paragraphs explaining AVG, HR, RBI, OPS, ERA, WHIP, strikeouts, wins or saves.

Unfamiliar metrics (for example xBA, xSLG, xwOBA, wOBA, wRC+, Barrel%, Hard-Hit%, Whiff%, Chase%, CSW%, OAA, Run Value, Framing and Sprint Speed) offer a small optional `ⓘ` action. On a phone it opens a short accessible dialog/sheet with Japanese name, what it measures, how to read high/low, and only essential caveats. Do not expand explanations by default. Detailed formulas belong in a later searchable glossary, backed by the same versioned MetricDefinition catalogue. No per-metric AI explanation button; later AI may synthesize a player's traits, recent changes or a MATCHUP, but fixed metric definitions work offline.

When legally available and comparable, place rank, top percentage, league average, positional average or period delta near the value before adding prose. Every comparison names its population, period, season and relevant baseline. Never invent a rank or percentile without a defined comparable population. Convert a percentile to `MLB 上位8%` only after confirming whether its source percentile ranks raw values or performance and whether high/low is favorable. Otherwise show the source's verified label or omit the relative claim.

### 31.2 Units, precision, dates

Keep each provider's original value and unit in domain/source provenance. Presentation converts velocity to km/h (usually one decimal), distance to m or cm, height to cm and weight to kg. Show mph/feet/inches/pounds secondarily only when useful. A shared formatter owns constants, rounding and missing-value behavior. Never overwrite a source mph value with a derived km/h value. AVG/OBP/SLG/OPS normally use three decimals without leading zero (`.318`); ERA two decimals (`2.35`); percentages normally one (`18.2%`); integer counts no decimals. MetricDefinition can set precision for detailed analysis. Missing/unsupported is `—`, not `null`, `undefined`, `NaN` or zero.

Internally distinguish an absolute timestamp from a baseball calendar date and its source time zone. Japanese UI normally displays instants in Asia/Tokyo: `2026年9月23日`, `9月23日`, `18:00`; label local MLB time explicitly if shown. Date-only values do not shift between time zones. Render innings as `1回表`, `1回裏` and so forth, retaining provider top/bottom codes internally.

### 31.3 Names, teams, positions, pitch types

Player identity is stable and distinct from canonical source name, verified Japanese display name and English display name. NPB Japanese names are primary. For MLB, prefer a trusted curated Japanese name where explicitly available; otherwise use the source English name. Search aliases alone do not license an automatically generated katakana display name. Preserve both scripts for profile/search where supported.

Keep team canonical name, Japanese full name, short name and abbreviation/code as separate fields. Use Japanese NPB names and trusted Japanese MLB names when available; fall back without inventing a translation. Full names fit profiles; short names fit compact cards; codes fit dense comparisons.

Normalize provider positions to canonical codes before UI. Use P/C/1B/2B/3B/SS/LF/CF/RF/DH on compact screens, adding OF only when a source says merely “outfielder”. Detail can show `P 投手`, `SS 遊撃手`, etc. SP/RP/CP are roles only when the provider definition supports them, not substitutes for a fielding position. A two-way hitter/pitcher must not be inferred to be DH. Pitch types likewise have canonical identities distinct from source codes and Japanese display names (フォーシーム, シンカー, スライダー, スイーパー, カーブ, チェンジアップ, スプリット, カットボール). Future adapters map provider-specific codes; UI does not display raw provider labels.

### 31.4 Analysis context and scope

Every Analysis/Split value retains its denominator and definition. Show a concise sample next to granular results (`.667 · 3打数2安打`, `Barrel% 18.2% · 87計測打球`) when available. Small samples receive `参考値` or `サンプル少`; unknown denominators are distinct from small denominators. Tapping can reveal the policy threshold and reason. These configurable warnings remain separate from ranking eligibility. Labels such as `得意`, `苦手`, `好相性` or `苦戦` require a documented deterministic rule using a relevant metric, league baseline, player baseline and sufficient sample size; otherwise use neutral wording or `参考値`. AI impression alone is insufficient.

Centralize locale, numbers, units, dates, names, positions, pitch types and metric definitions. Do not hardcode each screen. The Japanese presentation foundation preceded the representative design work in section 32. A glossary screen and the advanced MATCHUP/heatmap phases remain separate work; the MATCHUP/WATCH shell is in section 34.

---

## 32. Android-first design system and representative screens

The approved visual direction is Modern / Sports / Data / Clean, with usability before ornament. The first visible layer is conclusion or important value; detail appears through clearly labeled rows, tabs, chips and optional explanations. Primary navigation uses five Japanese labels: ホーム / 検索 / 分析 / 記録 / マイ. WATCH enters from Home's 今日の試合, not a sixth tab. Player uses 概要 / 成績 / 分析 / その他, retaining room for records and career in その他. All routes retain global NPB/MLB switching. Existing bookmarked `/players/:id` URLs remain valid; legacy `/players` and `/favorites` redirect to the new Search/My routes.

The design token layer defines light/dark backgrounds, surfaces, borders, text, brand, semantic states, charts, spacing, radius, typography, elevation, icon sizes and touch targets. Default theme follows the device. Use deep navy/blue sparingly for CTA, links and selection; team color is a small identity accent, not the application theme. Normal UI icons use one SVG set; required baseball-specific icons are original vectors. No official NPB/MLB/team logo is bundled without reviewed application-use permission. Shared Team/League branding chooses a permitted logo or a clearly nonofficial badge/text/monogram fallback. Do not generate confusingly similar official marks or depend on player photos.

Home is a short vertical feed: today's games, favorites, a small relevant discovery set, HOT, Now/Record Watch and season information. Each section exposes only a few items and a clear destination. When a data source is absent, show the correct unavailable state instead of invented games, trends or records. Search finds players and teams; results favor simple rows with name, team, position and league context. Ranking uses a readable list/table with rank, person, value and qualification note, not many cards. Current synthetic ranking is labeled as a sample-only reference; no official/qualified ranking is claimed until denominators and qualification rules exist.

State UI distinguishes loading, empty results, not supported by a provider, source error, feature not implemented and small sample. A displayed zero remains a value. Use Skeleton for structural loading, concise empty copy with one action, and text plus icon/position rather than color alone. Components use normalized domain data and shared Japanese Formatters. Metric explanations remain optional for advanced metrics. Section 33 adds the Analysis UI foundation; section 34 adds the MATCHUP/WATCH shell. Full charts remain future work. See `docs/design-system.md` for tokens and implemented component rules.

---

## 33. Analysis UI — Summary, category, detail

Analysis reuses the section-32 tokens, Japanese Formatters, MetricDefinition, navigation and data states. On Player, show a small summary first, then a limited set of category chips and one detail category at a time. Batters use 概要 / 球種 / カウント / 状況 / 打球・コース / 変化; pitchers use 概要 / 球種 / 配球 / 状況 / コース / 変化. Handedness, base/outs, batting order, score differential, game inning and appearance inning belong under 状況, not top-level tabs. Ball-in-play and recent-change categories are links/sections only when a compatible provider supplies validated aggregates. Never derive a trait claim such as 「得意」「苦戦」「接戦に強い」 from a single rate or a small sample.

Each split shows its sample and a configurable small-sample badge. Granular rows open on demand; pitcher pitch mix uses horizontal usage bars and named, theme-aware pitch colors. Count views keep **PA final outcome after reaching a pre-pitch count** separate from **response to pitches thrown at that count**. Show representative count groups first and exact counts in detail. Relative comparisons require a named population/season, a verified metric direction and source-provided baseline; missing comparison is omitted, never estimated. A 3×3 zone view requires coordinate provenance compatible with the aggregation and shows no fabricated cells.

AnalysisQuery v2 keeps `battingOrder` (1–9), `scoreDifferential` (signed raw runs or named display bucket at PA start), `gameInning` (actual game inning) and `appearanceInning` (the pitcher's nth inning in that appearance) distinct. Times through the batting order is a separate future dimension. Adapters must preserve the raw game inning and pre-event score, identify the pitcher appearance before deriving appearance inning, and record missing/deduced coverage. Capability and validated feature combinations gate each grouping/filter for each provider, league, period, subject and metric. A documented historical MLB field does not enable current-season or NPB UI. Analysis retains the previous-day cutoff, source update time, stale state and sample policy; it does not require live pitches or a cloud raw-pitch archive.

This phase supplies contract-ready UI and an honest unavailable adapter for the current synthetic catalog. Real event-level data, battery defense and AI explanation remain separate work. Section 34 defines the later MATCHUP/WATCH UI task.

---

## 34. MATCHUP / WATCH UI — previous-day context, no live feed

MATCHUP reuses Analysis Query, Result, MetricDefinition, SampleBadge, metric display, pitch color, capability gates and freshness. Routes accept an optional pitcher and batter ID, so player pages can preselect either side; manual search selects the other. A future permitted game/lineup provider can link to the same route. The first view shows the players, direct history and a deterministic attention pitch only when both pitch-type aggregates have at least 50 pitches. It makes no `得意`/`苦戦` claim without a separately documented baseline rule. Direct PA below 20 is labelled `参考値` rather than hidden.

Direct history, pitcher arsenal, batter pitch-type response, count and recent comparisons are independently gated and loaded only for the selected view. The arsenal pairs canonical pitch-type IDs, not name strings, and does not treat each side's season sample as head-to-head evidence. Count means pitch-at-count response; reached-PA outcome remains a distinct Analysis population. Relative values appear only with supplied comparison scope. When one source section fails, available sections remain visible. `AnalysisQuery` and daily cutoff form the future on-demand aggregate/cache key; no all-pairs precomputation or raw-pitch cloud mirror is introduced.

WATCH enters from Home's `今日の試合`, never a sixth bottom tab. A separate WatchProvider supplies schedule, each team's lineup and bullpen usage with separate capabilities/freshness. `今日` uses Japan calendar time; MLB's local game date is retained independently. A game page shows teams, planned starters, a lineup when supplied, a selectable three-hitter window in batting order, links to MATCHUP/Analysis, and prior-day bullpen facts. It does not identify the live next batter, current count, fatigue, or today's reliever availability. Bullpen `completeThrough` must precede today. Missing schedule, lineup and bullpen are separate states, never fictional data.

The current sample source has no real schedule, lineup, appearance log or matchup/pitch observations. Both leagues' live capability flags therefore remain unavailable. MLB public historical Retrosheet files may support bounded retrospective direct matchups and bullpen logs through their released seasons, with required attribution and coverage checks; they do not establish current-day feed rights. MLB.com automated collection is not an adopted path. NPB machine-readable reuse permission remains unverified. The fixture-only test data never reaches production UI. Similar pitch quality, complete location/velocity overlays, times-through-order, live play-by-play, predictions, battery matchup and notifications are out of this phase.
