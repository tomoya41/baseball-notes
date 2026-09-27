# NPB historical collection: published nf3 routes

Reviewed 2026-09-27. nf3 remains the existing provisional provider; no new automated source is added.

## Discovery

Monthly March schedule pages returned no Game rows, while each team's published `全表示` schedule includes the same March Games. Historical collection reconciles twelve season-wide schedules; each Game must appear identically in both team schedules. A confirmed no-games day requires this validated calendar, not an empty parser result.

The Daily pitcher participation page covers only two weeks. Historical collection instead follows the published season pitcher roster and each profile's `全投球成績`. Participation is an explicit matching date/opponent/time row, including zero-out appearances. Rosters and parsed logs are cached only for the current run. No permanent derived tables, guessed participants or date-specific exceptions.

Published withdrawn/traded profile prefixes (`wb_`, `tr_`) remain part of the source identity. Traded roster rows can lack the ordinary hover attribute; profile links, validated table schema and exact team path establish rows. A profile prefix is not a canonical identity: normal mapping safety still applies. Historical Facts retain the team recorded for that Game.

## Reviewed identity evidence

Each exception in `src/data/npb-verified-nf3-identities.ts` requires source ID, player name, canonical source team and exact nf3 profile URL. nf3's published NPB profile links were manually compared on 2026-09-27; NPB is an identity research reference, not a new automated collector.

| Player | Evidence | Canonical handling |
| --- | --- | --- |
| 早川隆久 | Eagles #21, nf3 `Pacific/E/p/21_stat.htm`, [NPB 31835153](https://npb.jp/bis/players/31835153.html), 1998-07-06 matches existing reviewed Master | Keep `a66dfd52-1ae2-4245-b849-558f263e6422`; add strict source alias |
| A.マルティネス | Fighters #2, nf3 `Pacific/F/f/2_stat.htm`, [NPB 73975136](https://npb.jp/bis/players/73975136.html), Ariel catcher born 1996-05-28 | New verified identity, separate from Giants R.マルティネス / NPB 23925134 |
| 山本祐大 | Former DeNA `Central/DB/f/tr_H_50_stat.htm` and current Hawks profile both link [NPB 23125136](https://npb.jp/bis/players/23125136.html) | Keep existing canonical ID/current Hawks Master; historical DeNA Fact team retained |
| 若林楽人 | Former Giants `Central/G/f/tr_L_59_stat.htm` and current Lions `Pacific/L/f/49_stat.htm` both link [NPB 53555153](https://npb.jp/bis/players/53555153.html) | One reviewed canonical identity, two strict source aliases; current Lions metadata and past Giants Facts separated |
| 尾形崇斗 | Former Hawks `Pacific/H/f/tr_DB_39_stat.htm` and `p/tr_DB_39_stat.htm`, current DeNA `Central/DB/p/36_stat.htm` all link [NPB 61365136](https://npb.jp/bis/players/61365136.html) | Keep `2ef0916f-a072-42fa-90ba-9b897506e86c` / current DeNA Master; historical Hawks Fact team retained |

These are identity exceptions supported by explicit profile evidence, not date-specific numeric patches or name-only merges. The Roberto/José Osuna exception is unchanged.

An explicitly reviewed f/p profile pair can be listed as two exact permitted URLs for one source identity. Hayakawa's Eagles f/21 and p/21 both link to NPB 31835153; this permits his recorded batting participation as well as pitching without weakening unrelated URL guards. Withdrawn/traded f/p pairs are merged only when both the complete provider parameter and normalized name agree. Ordinary #42 and `wb_42`, or #39 and `tr_DB_39`, remain separate participants despite uniform reuse.

## 9/22 DeNA PA regression

東克樹's full batting row contains `中飛 投犠野`. `投犠野` explicitly denotes a sacrifice bunt with fielder's choice. The former sacrifice parser recognized `犠打`/`犠バント` but missed `犠野`; expected PA therefore disagreed with the two observed plate-appearance tokens. The minimal parser change adds only the explicit sacrifice marker. The row is PA 2, AB 1, SH 1. Ordinary `投野選` remains an at-bat; no BF allocation, missing-value zero fill or Game-specific numeric repair is used.

## Safety and rollback

Each Game uses existing canonical identity resolution, validation and atomic authoritative writes. Complete days are reused only after current Fact validation and Day evidence agree. Unknown identities/tokens or schedule inconsistencies remain unresolved with reason codes. The optimized historical save path accepts a verified Game to batch existing Fact-key reads; Daily's default persistence path and limited insert-only safety remain intact. Disable historical ingestion to roll back discovery without deleting canonical Facts or re-enabling limited-write degradation.
