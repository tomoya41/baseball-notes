# Baseball Data App — Product Specification

Status: Product direction approved; architecture to be finalized before implementation.

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
