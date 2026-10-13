# NPB saved-data integrity and release preparation — 2026-10-13

This is a Game/Day evidence audit, not a declaration of season completion. No new Source, inferred Facts, canonical writes, identity merges or Gate relaxation. UI and MLB Historical 2014–2025 are unchanged.

## October 8 and the reviewed calendar

Canonical `npb:game:49a69ad2efd3bf67d3e5`, source record `2026-10-08:T:S:1`: Hanshin home / Yakult away, Koshien, scheduled 18:00 JST, final 0–4. Saved nf3 source: [October Swallows schedule](https://nf3.sakura.ne.jp/php/stat_disp/stat_disp.php?y=0&leg=0&mon=10&tm=S&vst=all), collected `2026-10-08T23:32:35.354Z`.

Independent minimal calendar verification: [NPB October schedule](https://npb.jp/games/2026/schedule_10_detail.html) and [October 8 official Game](https://npb.jp/scores/2026/1008/t-s-25/) explicitly classify it as Central League regular season. [October 10](https://npb.jp/scores/2026/1010/g-db-01/) explicitly says CS First Stage. The October page lists both competitions; its last date cannot be used as the Regular boundary. No official player statistics or imagery were acquired into a provider or public payload.

The previous calendar was checked September 25 and stopped October 7. This is stale metadata, not a wrongly dated Game. `npb-season-metadata.ts` now admits October 8, with source URLs and **Codex-assisted** verification, not human-reviewed provenance. `endDateStatus=scheduled`, `status=in_progress`, `seasonEndConfirmed=false` remain. Later makeup fixtures still require review. No independent declaration that all Regular games ended was used.

Saved Game evidence: complete batting/pitching/Game; **36 batting / 9 pitching Facts**. Latest October 8 Day: `9a40b880-9f45-48e0-987e-1ba0b479bd9b`, scheduled trigger, complete, one final/complete Game, zero partial/failed Games. Operational status **completed_with_warning**, Backup **failed**, `TypeError: fetch failed`. Data completeness and operational backup success are different facts. This run cannot substitute for the missing HOT scheduled/backup proof.

## Nine pending Games, individually

All nine have saved final scores. None is an actually ongoing Game. All nine have **0 stored batting / 0 stored pitching Facts**, not zero performance; null outs remain null. The first six have validation attempts with complete parsed/mapped participant counts, but failed pitching-outs checks and **no independently saved shortened-final evidence**. Their staged participant counts do not prove persisted Facts.

| Date | Canonical Game suffix (`npb:game:`) | Home–away | Saved score | Completeness / parsed batters,pitchers | Why pending / safe next step |
|---|---|---|---|---|---|
| 04-09 | `2469292e18a73924f23c` | Hanshin–Yakult | 2–0 | partial / 24,5 | Both teams' pitchingOuts failed. Need independent final inning/end-outs evidence plus source replay. |
| 04-14 | `99b0c4913966af7674ad` | Yakult–DeNA | 5–3 | partial / 23,4 | Same check failure, independently unresolved for this Game. |
| 05-03 | `e9a705d2e3ddfe1dabe8` | Hanshin–Giants | 3–0 | partial / 20,3 | Same check failure; a short game must not be inferred from a score. |
| 06-20 | `b2f541664347c98a1f62` | Yakult–Hiroshima | 6–8 | partial / 30,7 | Same check failure; final score alone insufficient. |
| 09-09 | `51c3f0f8dba6a7bb710e` | Lotte–Rakuten | 10–4 | partial / 23,9 | Same check failure, no saved exception evidence. |
| 09-09 | `645ed547effceffc5ca9` | DeNA–Yakult | 9–2 | partial / 24,5 | Same check failure, no saved exception evidence. |
| 09-28 | `5956839637147e5631b2` | Seibu–Rakuten | 2–4 | no completeness row | Score-only save. Daily rolling path fails; year-wide scratch validation succeeds with 18 batters / 12 pitchers. |
| 09-28 | `7978b5cc540f0334e2d7` | DeNA–Hiroshima | 3–4 | no completeness row | Year-wide scratch validation succeeds independently: 34 batters / 9 pitchers. No canonical proof stored by dry-run. |
| 09-28 | `fd5f433285c5557b67a6` | Lotte–Nippon-Ham | 3–8 | no completeness row | Year-wide scratch validation succeeds independently: 28 batters / 9 pitchers. No canonical proof stored by dry-run. |

Source record for each is retained in the audit, with `source_url`, `collected_at`, Game content hash, stored counts, checks/issues and completion evidence. No majority merge, fabricated PA, default zero, fixture re-dating or exception-list relaxation.

September 28 read-only dry-run [38398896806](https://github.com/tomoya41/baseball-notes/actions/runs/38398896806): **9 requests / 9 pages / 0 retries**, all three `nf3 pitch usage date missing: 2026-09-28`, no stored/new Facts or mappings. Workflow failure is this deliberate validation rejection, not a newly broken production Scheduled Run. The one-off preview input was removed after diagnosis; existing collector remains available for a formally justified future replay. Raw responses were not uploaded or published.

This is the **daily rolling two-week discovery path** (`pc_all_data_last2w_pn.htm`), not proof the provider lacks every historical path. Existing year-wide discovery was then exercised with `npb-historical-backfill.yml`, explicit September 28 only, **mode=dry-run**, [38403472647](https://github.com/tomoya41/baseball-notes/actions/runs/38403472647). All three Games validated complete, 80 batting / 30 pitching candidate rows, zero mapping additions/conflicts, **302 requests / 302 pages / 0 retries / 30 cache hits / 16,153,912 response bytes / 306.97 s**. The one traced write affected scratch metadata only. Remote protected counts stayed **899 / 23,468 / 7,112 / 1,662 mappings / 855 completeness / 261 Days**, PA unknown=0. “storedBatters/storedPitchers” in the nested dry-run result are simulated validation counts, not persisted canonical Facts. This is a feasible restoration route, not Source blocked.

No `ingest` run was performed in this diagnostic delivery. Actual restoration additionally requires real write/readback/replay and portable backup evidence; dry-run cannot upgrade the existing September 28 Day. The next narrow data-repair unit can use the existing explicit-date backfill path, preserving known Game values and existing Facts, then regenerate the complete projection family. It must remain `trigger=repair`, never scheduled proof. No source permission was expanded.

## Six partial dates

| Date | Latest Day / final,complete,partial counts | Cause |
|---|---|---|
| 04-09 | repair, partial / 4,3,1 | Hanshin–Yakult validation incomplete |
| 04-14 | repair, partial / 6,5,1 | Yakult–DeNA validation incomplete |
| 05-03 | repair, partial / 5,4,1 | Hanshin–Giants validation incomplete |
| 06-20 | repair, partial / 4,3,1 | Yakult–Hiroshima validation incomplete |
| 09-09 | repair, partial / 6,4,2 | Two independently incomplete Games |
| 09-28 | scheduled legacy curated-subset run, partial / recorded 0,0,0 versus **3 now-saved final Games** | Day/Game mismatch, no complete boxscore proof. Batting stage “Curated player subset only”, pitching stage partial. |

Games enumeration stages are complete, but this is not player-stat completeness. The September 28 latest run (`17d88b1f-5f4e-4d83-ba23-938069cfecde`) predates the stored final score update; it must not be silently rewritten. No-game evidence is not the cause of these six partial dates.

Period before correction: **195 dates / 164 complete / 25 no_games / 6 partial**. Read-only evaluation including the independently saved October 8: **196 / 165 / 25 / 6**, zero failed/unknown. This adds an existing complete date to the derived period; it does not upgrade any partial Day or alter Coverage evidence. Publication must regenerate the entire coordinated projection family, not only the Season file.

## Fixed diagnostic defect and reproducibility

The old `audit-npb-eod-coverage.ts` INNER JOIN omitted Games without completeness rows, hiding all three September 28 Games. It now uses the shared **LEFT JOIN** diagnostic and includes missing-proof Games, nullable values, latest Day/stages and boundary Games. Seven bounded SELECT queries, no per-Player requests.

Codex Review P2 also identified inconsistent evidence rows: overall Game complete with batting/pitching partial, failed or null. Both this audit and the lifecycle monitor now require **all three statuses complete** before excluding a final Game from pending counts. A real SQLite fixture verifies this case, missing-proof Games, postponed/future exclusions and unchanged hashes. Coverage evidence itself is not modified.

A second P2 found a hard-coded October 7 horizon in backfill inventory. Remaining calendar-date counts now use the reviewed metadata, with endpoint/after-end/invalid-date/unknown-season regression checks. This changes diagnostics only, not collection authorization or completeness.

Further review corrected the active Season/Player Period guides and resilient handling of malformed saved JSON. Corrupt pending-row checks/issues/shortened evidence are retained in the DB and identified by field/reason/hash in the report; arbitrary corrupt raw text is not exposed. The CLI emits the usable report before failing for manual review. A fixture covers all three corrupt fields and verifies no mutation. This is not a normalization or repair of malformed evidence.

The audit also scans nominally complete past Games before exclusion, compares actual stored Facts against expected/collected/mapped counts, and validates JSON **shapes** with the existing completeness/shortened-final schemas. Invalid metadata, failed complete-proof checks or wrong Game binding remain explicit findings and fail diagnostics after report emission. Lifecycle pending counts include Fact-count drift. These read-only checks do not change public Coverage or Gate rules.

`npb-freshness.yml` manual `integrity_audit=true` runs `audit-npb-data-integrity.ts`; scheduled behavior is unchanged. The audit does no migration, ingestion, repair or publication. Hashes/counts of eight canonical/evidence/master tables before and after prove stable observation; a concurrent change fails the invariant check rather than asserting no change.

Initial [read-only audit 38398222784](https://github.com/tomoya41/baseball-notes/actions/runs/38398222784): 7.33 s, 0 writes, 0 Source requests. Protected counts: **899 Games / 23,468 batting / 7,112 pitching / 855 completeness / 261 Day runs / 260 stages / 23 permanent events / 755 master-history rows**. Raw rows are hashed only; artifact contains bounded Game metadata and summaries, not a raw provider dump.

## Production / Scheduled evidence after PR #28

| Run | Actual trigger / result | Evidence meaning |
|---|---|---|
| [38392579900](https://github.com/tomoya41/baseball-notes/actions/runs/38392579900) | schedule, EOD, success | Oct13 outside-calendar skip, Source requests=0, DB reads=1/writes=0, publishRequired=false. No Fact or publication proof. |
| [38384862666](https://github.com/tomoya41/baseball-notes/actions/runs/38384862666) | schedule, freshness, success | Oct12 expected/published, fresh/healthy at observation; retentionVerified=false. Strict stale failure remains. |
| [38371532930](https://github.com/tomoya41/baseball-notes/actions/runs/38371532930) | manual Daily, success | Lifecycle skip; cannot serve as Scheduled evidence. |
| [38371578322](https://github.com/tomoya41/baseball-notes/actions/runs/38371578322) | workflow_run callback, skipped | Manual trigger not admitted. |

At initial audit no post-merge calendar Scheduled or Daily Scheduled had yet completed. Do not count manual runs, successful skipped steps or old-main executions as new Scheduled collection. New actual schedule evidence must be recorded independently when available. Existing October 8 Backup failure cannot be rewritten as exported by a manual backup drill.

HOT stays **not_ready**: latest published batting eligible=0, starter=5, relief=3; scheduledProductionEvidence=false, all public arrays empty. Short Current window is not a substitute for scheduled complete game-day + exported encrypted backup proof and every category/display/identity/sample condition. Rankings stay **not_ready**: six partial dates, complete-coverage qualifier computation required, public ranking disabled. No Gate values changed.

## Delivery / next action

1. Independently verified calendar correction + coordinated read-only regeneration; preserve canonical DB and all MLB release files.
2. September 28 year-wide restoration is technically validated: perform its controlled existing backfill/write/readback/backup path as a separate data-repair unit. Six earlier final-inning/out-count proofs remain independently unresolved; never force completeness.
3. Obtain actual successful scheduled complete Fact collection + encrypted backup proof; outside-season skips cannot supply it. Keep freshness monitoring honest during offseason.
4. Android checks and Play readiness: [physical QA](android-device-qa.md), [store preparation](play-release-readiness.md). Physical device/TalkBack/signing/Play remain separate owner gates.

Final execution evidence is recorded in the PR delivery report; preliminary diagnosis is not a claim that the later publication or emulator finished.
