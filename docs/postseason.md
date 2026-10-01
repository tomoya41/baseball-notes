# Postseason — competition, rights and release operation

Reviewed **2026-10-01 JST**. Postseason is a separate competition, never an exception to regular-season statistics. No Current MLB collection, NPB acquisition expansion, paid service or scheduled-proof substitution is introduced.

## Eligibility inventory

| Area | Classification | Implementation |
| --- | --- | --- |
| Competition/round/Series model | Safe now | Canonical series and rule advantages, independent of Game wins |
| MLB 2020–2025 Games/boxscore/PBP | Historical only; reuse rights verified | Imported and published independently of Regular Season |
| MLB Series/bracket/Player stats/log/BvP/situations | Safe after full archive validation | Available for all six Postseasons |
| MLB 2026 Current Postseason | Source/rights investigation required | Unavailable / Source rights pending; no results collected |
| NPB Current/historical CS/Japan Series | Source/rights investigation required | Model/routes/capability ready; acquisition and stats unavailable |
| NPB BvP/PBP | Impossible from adopted canonical granularity | No matchup inferred from Game participants |
| Production push/scheduled collector | External evidence and safe Current source required | No new sends, schedules or Infrastructure adjudication |

## Primary source and rights evidence

Accessed 2026-10-01:

- [Retrosheet usage notice](https://www.retrosheet.org/notice.txt) permits any desired use, including sale, redistribution and commercial products, with prominent credit. Accuracy is not guaranteed; corrections are possible. Existing Data Sources, archive and release attribution retain the required wording:

  > The information used here was obtained free of charge from and is copyrighted by Retrosheet. Interested parties may contact Retrosheet at "www.retrosheet.org".

- [Official CSV definitions](https://www.retrosheet.org/downloads/csvcontents.html) and [2025 release](https://www.retrosheet.org/fall2025release.html): official Season downloads, no per-Game scraping. Explicit `gametype` values `wildcard`, `divisionseries`, `lcs`, `worldseries` admit Postseason; regular, All-Star and tiebreaker `playoff` are excluded. Source `innings` means scheduled innings; Postseason actual ending inning comes from populated team line-score columns. Source starttime has no reviewed timezone contract, so `scheduledAt` remains null.
- [Chadwick README](https://github.com/chadwickbureau/register/blob/master/README.md) explicitly uses [ODC Attribution 1.0](https://opendatacommons.org/licenses/by/1-0/). Existing source/license notices remain visible. Exact Retrosheet → cached Chadwick UUID mapping only; conflicts fail import and names never trigger merging. MLBAM cross-references do not confer another site's data rights.
- [2020 official expanded format](https://www.mlb.com/press-release/press-release-mlb-mlbpa-agree-to-expand-2020-postseason), [2021 official schedule](https://www.mlb.com/press-release/press-release-mlb-announces-2021-postseason-schedule), [format FAQ](https://www.mlb.com/news/mlb-playoff-format-faq): versioned rule references. Wild Card best-of-three in 2020, single-game in 2021, best-of-three in 2022–2025. DS best-of-five; LCS/WS best-of-seven. Unreviewed seasons fail closed; rules are not inferred from played Game counts.
- [MLB terms](https://www.mlb.com/official-information/terms-of-use): public-app reuse not verified. The [2026 official Postseason page](https://www.mlb.com/news/2026-mlb-playoff-and-world-series-schedule) confirms Current information exists, without granting redistribution. No Stats API, API-SPORTS, Statcast or Savant collection adopted. Free access and identity bridge are insufficient rights evidence.
- [nf3 index](https://nf3.sakura.ne.jp/): no positive grant for expanding provisional regular collection to CS/Japan Series verified; inspected index exposed no separately licensed Postseason download. Historical page existence is not permission. Preserve adopted scope, no new nf3 acquisition enabled. See [NPB rights audit](npb-batch-g-rights.md).
- [NPB CS reference](https://npb.jp/games/2026/info_cs.html): competition reference only, no official-site bulk collector. Model supports CS First/Final and Japan Series. Final Stage advantage is separate from Game wins; draw/seed-based clinches require explicit future permitted-provider evidence. Model availability does not prove an outcome or license data.

## Contract and isolation

- `CompetitionType = regular | postseason`; absent legacy scope means regular, never all. Regular schemaVersion, canonical ID generation and all original aggregation semantics remain unchanged.
- `PostseasonRound` represents NPB's three stages and MLB's Wild Card/DS/ALCS/NLCS/WS. Round comes from explicit source type, not inferred dates.
- `PostseasonSeries` includes canonical ID, league/season, round/name, bestOf/winsRequired, actual canonical Games, nullable scheduledAt/scores, status/winner, `playedWins`, `advantageWins`, `seriesTotal`, clinch/reason, advancement and effectiveDate. Nonterminal Games award no wins; NPB advantage never fabricates a Game.
- Hub v1 has provenance (provider/archive SHA256/verifiedAt), coverage/counts/Series and independent stats/analysis capabilities. Complete Historical coverage requires validated final Games, full bracket and all Series clinched. Duplicate IDs, invalid results, missing advancement or incomplete brackets block publication.
- Provider/aggregators/PA parser are shared; release SQLite and public prefix are **isolated by competition**. Guards reject mixed databases before Fact writes. No Turso migration/write or change to reserved NPB PA tables. Legacy regular queries continue to read only the regular release.
- 994 Players: 992 share regular canonical IDs. Chase DeLauter (2025) and David Freitas (2020) appear only in the collected range's Postseason. Search/My union these two canonical identities and route their profiles to Postseason; regular seasons/totals are unchanged.
- Public `/data/postseason/capabilities.json`; gzip `/data/mlb/historical/postseason/{manifest,hub/<year>,players/index,players/<id>,schedule/<year>/<date>,games/<id>,seasons/<year>,records/<year>,advanced/<year-or-range>/<id>}.json.gz`. File IDs replace colons with underscores; UI routes retain canonical IDs and explicit `competition=postseason` context.
- Builds initially mark MLB Historical Postseason `not_ready` with no advertised seasons. The final whole-site artifact guard derives required paths from the Manifest, six Hubs and Player directory: every Game Detail, date Schedule, Player profile, Season aggregate, Records and season/range Advanced payload must exist and validate. It cross-checks canonical references, season/date/score, Fact counts and analysis capabilities, and rejects stale unadvertised files before marking availability. All Daily/EOD/manual/app-only publish paths use that guard; a missing subtree remains not_ready and a partial/corrupt subtree aborts publication. PA analysis admission is independent. Current rights never change.
- Public only compact aggregates, no raw PA/archive/HTML/source ID/DB/credential. Unknown pitchCount/HLD stay null. No Statcast inference.
- Counting **Postseason Leaders** are separate from regular rankings. Descriptive Player rates retain sample/PA; regular rate-title qualification is not applied. BvP and situations use only scoped canonical PA and their existing independent validation gates. Range totals mean imported Postseasons, not career.
- Favorite keys remain league + canonical Player ID. Future notification-target contract carries competition/season/Series/Game/Player; no new production subscriptions/sends.

## Validated release

| Season | Games | Series | Batting Facts | Pitching Facts | PA |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2020 | 53 | 15 | 1,692 | 540 | 4,013 |
| 2021 | 37 | 9 | 1,213 | 404 | 2,774 |
| 2022 | 40 | 11 | 1,207 | 381 | 2,996 |
| 2023 | 41 | 11 | 1,273 | 412 | 3,086 |
| 2024 | 43 | 11 | 1,380 | 451 | 3,266 |
| 2025 | 47 | 11 | 1,479 | 476 | 3,636 |
| Total | 261 | 68 | 8,244 | 2,664 | 19,771 |

1,988 private mapping rows. All 261 Games reconstructed. Identity unresolved, parser failures, skipped Games, boxscore/PA count mismatches, runner/score continuity issues and unknown start contexts: **0**. Existing PA regressions cover substitutions, runner-only events and exact batter/pitcher attribution. Re-import: **0 boxscore / 0 PA writes**. Portable schema/hash/chunks and scratch restore match all seven tables and representative Game/Player/PA.

Measured local box import ~15s, PA ~52s, advanced generation ~6s; isolated DB 19,386,368 bytes. Public 4,245 files / 5,638,283 compressed bytes, largest 41,306 bytes. Six cached official Season archives plus Register reused; cold release requires seven downloads (~81MB compressed, ~761MB extracted), no Game-level HTTP. PA local only, no Turso cost. Free public-repository Actions/Pages/Release storage; no daily MLB job.

Regular public preservation compares **all 28,394 files byte-for-byte** before/after staging, including identity, stats, qualification/Records. NPB publication retains the existing coordinated projection family and guards. No NPB Fact/Coverage/rain-shortened/HOT/Ranking/Infrastructure writes.

## Commands / publication / rollback

```sh
npx tsx scripts/import-mlb-historical.ts --competition postseason --download --cache .data --db .data/mlb-postseason.sqlite --output .data/postseason-public
npx tsx scripts/import-mlb-plate-appearances.ts --competition postseason --cache .data --db .data/mlb-postseason.sqlite --report .data/postseason-pa-validation.json
npx tsx scripts/generate-mlb-advanced.ts --competition postseason --db .data/mlb-postseason.sqlite --validation .data/postseason-pa-validation.json --output .data/postseason-public
npx tsx scripts/verify-mlb-postseason.ts --root .data/postseason-public/data/mlb/historical --regular-root dist/data/mlb/historical
npx tsx scripts/backup-mlb-historical.ts --db .data/mlb-postseason.sqlite --output .data/postseason-backup --scratch .data/postseason-restored.sqlite
```

Scratch must be empty/new. Manual `mlb-historical-publish.yml mode=postseason`: validate/re-import/restore, preserve published regular archive, replace the entire Postseason subtree, verify regular SHA256 equality and NPB coordinated family, refresh content-addressed aggregate archive, deploy once, HTTP verify six Hub/sample Game contracts. Retain audit artifact. Encrypted backup contains remote NPB plus selected MLB competition; existing regular MLB backup remains separate. `mode=release` replaces the regular tree while preserving only Postseason; `mode=app-only` preserves both. Replacement stages a fresh directory before moving it into place, with rollback on rename failure. Corrected releases remove obsolete Game/Player/aggregate paths instead of overlaying stale files.

Daily/EOD/Freshness schedules and shared publish concurrency unchanged. Future Current collector needs separate rights/operations evidence; manual publish is not Scheduled proof. Rollback to prior public artifact and remove additive Postseason surfaces; no regular migration.

## UI / limitations

Existing design/bottom navigation retained. Home/Games link to Hub; grouped Series show played wins, best-of, actual advancement and clinches. Series opens canonical Game Detail. Player, Schedule, Records switch Regular/Postseason with distinct data/cache keys. Profile/Log/7/14/30/Home-Away/Opponent/Order/Role/BvP/Situation reuse existing surfaces. Season changes return to that year's Hub. Android links/fallback Back preserve competition. No next Game invented for completed Historical Series.
Player Directory/Search, redirects, filters and Profile's return-to-list retain the selected competition. Postseason Search reads only that directory; the regular directory's identity-only union continues to expose two Postseason-only Players without modifying regular facts.
The MLB UI reads and validates the published Postseason Capability once in its league container. Home/Explore/competition entry links use the advertised seasons, and all Postseason routes wait for admission before fetching scoped data. Unpublished releases show an explicit preparation state; capability fetch failures offer retry without issuing missing Hub requests. Hub/Series do not depend on a Regular manifest fetch. The same validated public response cache supports offline availability.

NPB/MLB Current explicitly show Source rights pending, with no fake bracket, scores or 2025 fallback. NPB collector, Current schedule, push verification and permitted NPB PBP remain blockers. Store signing/Firebase and existing NPB Gates are separate.
