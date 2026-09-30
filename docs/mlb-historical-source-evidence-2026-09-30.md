# MLB Historical source evidence — 2026-09-30

This decision concerns released 2020–2025 regular-season Retrosheet CSV files and the public Chadwick Register as an identity crosswalk. It does not approve any 2026 current-results collector, MLB Stats API, API-SPORTS, Lahman, Baseball Savant, or Statcast ingestion.

## Retrosheet

- Primary use notice: https://www.retrosheet.org/notice.txt (accessed 2026-09-30).
- Permission statement (verbatim): “Recipients of Retrosheet data are free to make any desired use of the information, including (but not limited to) selling it, giving it away, or producing a commercial product based upon the data.”
- Redistribution, modification and commercial product use: permitted by the notice. Retrosheet requires its specified credit to appear prominently in any transfer or product development. The app's Data Sources screen displays the exact credit from the notice:

  > The information used here was obtained free of charge from and is copyrighted by Retrosheet. Interested parties may contact Retrosheet at "www.retrosheet.org".

- Limitation: no accuracy warranty; corrections may follow. This is a historical release, not a current-day feed.
- Official CSV distribution and column definitions: https://www.retrosheet.org/downloads/csvdownloads.html and https://www.retrosheet.org/downloads/csvcontents.html (accessed 2026-09-30). The season archives contain `gameinfo`, `teamstats`, `allplayers`, `batting`, `pitching`, `fielding`, and `plays`. Import uses release ZIPs, never one HTTP request per Game.
- Production data is normalized facts and aggregates; raw CSV/HTML is not mirrored onto Pages. The archive hash and release year are retained as import provenance.

## Chadwick Register

- Primary source: https://github.com/chadwickbureau/register/blob/master/README.md (accessed 2026-09-30). Exact license statement: “This dataset is made available under the Open Data Commons Attribution License”. It points to https://opendatacommons.org/licenses/by/1.0/ .
- License text: https://opendatacommons.org/licenses/by/1-0/ (accessed 2026-09-30). ODC-By 1.0 permits sharing, modification, public display and commercial use of the database under its attribution/notice terms. Public derived use must make the source and license visible. The Data Sources screen links both.
- The 16 public `people-0.csv`–`people-f.csv` files provide `key_uuid` and `key_retro`. The importer does not merge by name. `key_mlbam`, `key_bbref`, `key_fangraphs`, and `key_wikidata` are identity references only; their presence does not grant use of those providers' data.
- Limitation: this public extract is delayed and may change through identity merge/split; it is not a current roster source. Source-to-canonical mappings and a release hash are retained for correction review.

## Data/UX boundaries

- `MLB 2026 Current` results, player stats and live Games remain unavailable. Retrosheet's 2026 original schedule, if later used, must be labeled 当初予定 and kept separate from current status.
- `pitchCount` and `HLD` are unavailable in the selected game-level CSV; unknown is not zero. `outsRecorded` uses the source's `p_ipouts`. Retrosheet PBP does not imply Statcast velocity, pitch type, exact location, exit velocity, launch angle or xwOBA.
- The imported 2020–2025 total is a **収録期間合計**, never automatically “MLB通算”. Rate rankings remain closed until season-specific official qualifier rules and calculations are verified.
- Historical releases are imported on explicit command or release update, not by a daily MLB collector. No new paid service or recurring charge is introduced.

## Historical rate qualification

[MLB's official rate-stat qualifier glossary](https://www.mlb.com/glossary/standard-stats/rate-stats-qualifiers) (accessed 2026-09-30) describes Rule 9.22: batting category leadership needs 3.1 PA per scheduled league Game, rounded to the nearest PA; ERA needs one pitched inning per scheduled Game. Cancelled Games remain in the scheduled denominator. [MLB's account of the revised 2020 season](https://www.mlb.com/news/faq-negro-leagues-stats-major-league-record) confirms its 60-Game schedule and the corresponding 186 PA / 60 IP thresholds. The 2021–2025 schedule is 162 Games, yielding 502 PA and 486 outs for the ordinary standard. These are not calculated from observed Game count.

The importer distinguishes qualified, unqualified and unknown internally. Rate Ranking remains unpublished until the Rule 9.22(a) short-PA title exception is represented and the public qualification behavior is reviewed; counting rankings are independent. OPS/K9 are not labeled official batting/ERA titles.
