# NPB 2026 Season ranking qualification

Verified on 2026-09-27 from primary sources:

- [NPB 2026 batting leaders](https://npb.jp/bis/2026/stats/bat_p.html): required PA = actual team games × 3.1, rounded to nearest integer.
- [NPB 2026 pitching leaders](https://npb.jp/bis/2026/stats/pit_p.html): required innings = actual team games × 1.0.
- [Official scoring rules, 9.22](https://npb.jp/scoring/officialrule_900.pdf). The published rules PDF predates 2026. [2026 amendments, item 24](https://npb.jp/npb/2026rules.html) revise the Japanese note and explicitly apply actual games played rather than the planned schedule, with rounding following the rule's explanatory notes. The 2026 leaders pages independently confirm the first-team thresholds.

Calculation uses integer PA and integer outs. Batting threshold is `floor((teamGames * 31 + 5) / 10)`; pitching threshold is `teamGames * 3` outs. Team games are counted from canonical final Games only **after the entire requested Season Coverage is complete**. Unknown Coverage, missing sample metrics, or ambiguous/transferred team context yields `qualifier unknown`, never qualified. No inference from current standings or incomplete schedules.

Rule 9.22 allows an under-threshold batter to win a batting-average / slugging / on-base title when adding the missing appearances as hitless at-bats still produces the highest rate. This is an **award exception**, not ordinary qualification. This app does not award titles, alter saved AVG/OBP/SLG, or mark such a player qualified automatically. Ordinary rate rankings filter qualified players; the award exception remains out of scope.

OPS and K/9 do not have corresponding official individual-title qualification rules here. Our statistical comparison policy uses the same verified PA / innings minimum to avoid tiny samples; this is an app policy, not an NPB award claim. Counting-stat candidates need complete Coverage and complete metrics but no PA/innings threshold. No WHIP.

Rankings are deterministic statistical ordering with canonical Player ID tie-breaks. Public ranking activation remains a separate explicit publish decision. Readiness separates verified rules from verified per-player computation; incomplete Coverage can coexist with a verified rule and unknown individual qualifiers. Records reuse Season counting candidates and do not claim career/all-time records.

Official NPB pages are research references only. They are not added to the canonical automated collector.
