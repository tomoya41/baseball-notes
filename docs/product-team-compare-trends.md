# Team Hub, Player Compare, Trends

## Scope and invariants

These product surfaces reuse validated saved data. No provider access, database migration, canonical writes, profile curation, qualification or Production Gate changes. NPB remains current regular-season saved data; MLB remains 2020–2025 Historical with separately selected regular/postseason scopes. Explicit unsupported years never fall back to a different season. Existing Favorites keep their league + canonical Player keys.

## Team Hub

- `#/NPB/teams` and `#/NPB/teams/<canonicalTeamId>`: existing Catalog membership, saved Team Season W/L/T/runs and batting/pitching totals, existing published standings and the latest 14 calendar days of date indexes. Catalog/Season/activity errors remain independent. Partial statistics retain their status; favorite Players are identified in the roster.
- `#/MLB/teams?season=2025` and `#/MLB/teams/<canonicalTeamId>?season=2025`: saved Season summary, last 12 results, team-specific Player batting/pitching totals, favorite-only filter and existing Postseason Series links. `competition=postseason` explicitly selects the separate scope. Historical appearances are not described as current roster membership.
- MLB team aggregates use each Game Fact's actual team ID. A traded Player's whole Season is never assigned to each club. No reconstructed official division standings are presented.

New validated, compressed read models are additive: `data/mlb/historical/[postseason/]teams/<season>/<canonicalTeamFilename>.json.gz`. Chronology files at `[postseason/]chronology/<season>.json.gz` preserve existing canonical Game numbers for doubleheader ordering. Both are derived locally from the checksum-verified preservation archive on every publication path; original projections remain byte-identical. UI reads one team payload rather than the entire Season database.

## Player Compare

`#/NPB/compare` and `#/MLB/compare?season=2025`, with optional comma-separated canonical `players` (maximum four) and `role=batting|pitching`. Home, Search, Player and Team pages expose the entry point. Search is bounded; there is no thousands-item selector. Role tabs compare the same kind of statistics, with missing/no-appearance fields shown as unavailable rather than zero.

NPB: Season, 7/14/30 days, plus home/away, opponent, batting order and appearance roles over the existing 30-day Analysis bundle. Each selected Player needs only a Season response and/or one shared Analysis bundle; adding conditions does not add split-specific requests. MLB: selected Season or 7/14/30-day windows ending at that Season's last saved date, home/away, opponent, order and roles; existing capability-gated PA-derived inning/outs/base-state/score and exact BvP comparisons. PA-derived pitcher comparisons show opposing batters' batting metrics, not invented pitcher ERA. Regular/Postseason are isolated.

The comparison is descriptive, not a qualified leaderboard. PA/IP and missing/partial notices remain visible. Mismatched response effective dates block the table. Changing conditions never reuses results for the previous context; failed requests are not permanently cached.

## Trends and observed streaks

`#/NPB/players/<id>/trends` and `#/MLB/players/<id>/trends?season=2025` (optional explicit Postseason scope).

- Batting: observed trailing hit/on-base/home-run appearance counts; rolling weighted AVG/OBP/SLG/OPS over 5 or 10 batting appearances; moving OPS graph and values table.
- Pitching: observed trailing scoreless appearances using **R**, including zero-out appearances; per-appearance runs graph and IP/R/ER/SO table.
- PA=0 substitutes do not create batting appearances. On-base means H + BB + HBP, explicitly distinct from official streak rules. A `+` means the loaded boundary does not establish the beginning of the streak. NPB loads at most 50 appearances; MLB uses the selected year/as-of context.
- Missing PA/components remain unknown. Missing graph points are gaps, not interpolated zeroes. Incomplete Coverage prevents confirmed streak counts, while saved-data rolling summaries remain descriptive. Duplicate Games or unknown doubleheader order block chronological results. No official/career streak or qualitative “hot/cold” label is inferred.

Charts have screen-reader names and accompanying tables; metrics reuse on-demand explanations. At 360px, only stat tables scroll horizontally. No raw PA/event data is added to Pages or Android.

## Cost, publication, rollback

Initial real archive validation: 32,680 existing files, 131,055,257-byte compressed preservation archive. Derived 372 files total 2,795,149 compressed bytes; generation approximately 20.7 seconds locally; zero canonical writes and zero external Source requests. Public JSON caching uses the existing bounded validated-response cache. No new scheduled workflow, paid service or recurring backend cost.

For this UI-only release use `mlb-historical-publish.yml` with `mode=app-only`: preserve the coordinated NPB family and existing regular/Postseason archive, derive small read models, publish the whole site once, then verify actual public hashes/HTTP. Manual publication is not Scheduled Production evidence. Backup schema is unchanged; all new data can be regenerated from existing saved public projections.

Rollback: revert this product change and republish the previous app artifact. Additive Team/chronology files can remain harmless or be regenerated; no database restore or Favorite migration is necessary.

## Intentional gaps

MLB Current remains unavailable; historical standings lack an adopted official division snapshot. Team Favorites are not added; existing Player Favorites connect to Team rosters. NPB incomplete Season Coverage keeps observed streaks unconfirmed. Comparison windows are aligned to the saved effective date; custom shared as-of-date selection is a future UX enhancement. Existing profile review exceptions remain a separate data-quality track.
