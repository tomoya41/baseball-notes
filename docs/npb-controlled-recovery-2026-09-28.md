# September 28 controlled recovery

Baseline: PR #29 / `437d68f`, reviewed Regular calendar ending October 8, 2026. This unit authorizes only the three already-saved September 28 Games: `5956839637147e5631b2` (Lions–Eagles 2–4), `7978b5cc540f0334e2d7` (Baystars–Carp 3–4), `fd5f433285c5557b67a6` (Marines–Fighters 3–8), each with the `npb:game:` prefix.

At the new baseline audit there are 899 Games, 23,468 batting Facts, 7,112 pitching Facts, nine pending Games and six partial dates. September 28 has no saved batting/pitching Facts or completeness rows for these Games. The legacy partial Day must remain in history. The earlier 80 batting /30 pitching dry-run rows are candidates, not canonical data.

## Admission and protected boundaries

The existing `npb-historical-backfill.yml` gets an opt-in `controlled_sep28` flag; defaults and general backfill behavior remain. Controlled mode rejects any other date range. No additional provider, license interpretation, schema migration, generic repair writer, identity merge or UI change.

1. Existing portable Backup drill exports every protected table and restores/checks it in a new scratch DB. Encrypt with the existing secret, decrypt and compare bytes, then successfully upload the encrypted baseline **before** the writer step. Only encrypted exports go to seven-day Actions artifacts; raw exports remain private runner files. Missing key/artifact/restore failure stops writes.
2. Re-export the current DB and compare every table's manifest data checksum/count with that retained baseline. Any intervening change stops admission. All collector/repair/publication workflows share `daily-npb-collector-and-pages` concurrency.
3. Reconcile all twelve year-wide nf3 schedules. Both source enumeration and saved Games must match the exact reviewed IDs/date/teams/game numbers/venue/time/status/score/source IDs. Unknown metadata or an additional Game stops before schedule or Fact writes.
4. Dry-run with the existing participant identity and Game validator. No mapping additions allowed. Then run the **existing writer on scratch** using exactly the captured pages. Verify 18/34/28 batting and 12/9/9 pitching rows, complete proof and every saved value. No raw pages uploaded.
5. The existing canonical writer receives only those already-validated captured pages. It retains its per-Game transaction and `trigger=repair` Day provenance. Readback compares canonical values/IDs/provenance with scratch (only collection timestamp is excluded from the value hash). Never treat partial existing rows as a clean recovery target.
6. Protect all 17 backup tables: existing rows may not change/delete except September 28's `games` enumeration stage (22 stale rows → three validated Games), or a target failed/partial proof left after a rolled-back transaction with no saved Facts. That proof can be replaced only after fresh validation; broken complete proof or existing partial/conflicting Facts remain blocked. New rows are restricted to the three Games' batting/pitching/completeness, nf3 September 28 ingestion records and a complete **repair** Day. Identity/master/Game/other-date changes fail verification and prohibit publication. Old Day history is immutable.
7. Repeat backfill on the same captured pages; canonical Facts/mappings must remain byte-identical and no duplicates appear. Export/restore/readback again, record backup through the existing Day backup method, then export the recorded final state and restore it independently. A retry which skips an already-complete Game/Day can acknowledge the latest independently validated **repair** Day's pending/failed backup; only that backup field may change, not its original operational result, counts or error history, and never a Scheduled or partial Day. Encrypt/decrypt/compare and retain the post-recovery export.

Backup artifacts expire after seven days; they are not perpetual retention or Scheduled proof. Scratch restore proves recovery into a new empty DB. Do not bulk-restore over a live DB or delete correct Facts to force rollback. If any verification fails after a per-Game commit, preserve first-pass/checkpoint evidence, stop publication and inspect exact committed rows; resume only through the same guarded verified path.

## Coverage and publication

Use unchanged `NpbPeriodCoverageRepository` / Game validator rules. Append a repair Day only after validated enumeration/participants; do not overwrite the legacy Day or manually assign Coverage. Other five partial dates remain independent. HOT requires actual Scheduled production and encrypted backup evidence as well as identity/metadata/sample conditions; neither manual repair nor successful outside-calendar skip establishes it. Rankings require complete season coverage. Stale retains its existing meaning.

After verified recovery, regenerate the complete NPB projection family with `npb-season-publish.yml`. Compare all public effective dates, all changed statistics with canonical restored Facts, and all unaffected scopes/identities with their baseline. Preserve the existing MLB release archive and validate 2014–2025 Regular/Postseason HTTP contracts.

## Remaining six Games / physical QA

The six earlier Games are outside this write scope. Investigate explicit ending evidence separately; final scores do not establish innings/outs. Any official record inspected is diagnostic evidence only unless its acquisition/storage/public use fits the existing provider contract. No bulk official player stats ingestion or exception relaxation.

October 14 diagnostic inspection found explicit rain-shortened status, matching date/teams/score, on all six primary records:

| Saved Game | Primary ending record inspected | Production limitation |
|---|---|---|
| April 9 Hanshin–Yakult | [official record](https://npb.jp/scores/2026/0409/t-s-03/) | Existing nf3 ending evidence absent |
| April 14 Yakult–DeNA | [official record](https://npb.jp/scores/2026/0414/s-db-04/) | Same; partial inning matters, not a standard nine-inning final |
| May 3 Hanshin–Giants | [official record](https://npb.jp/scores/2026/0503/t-g-08/) | Existing nf3 ending evidence absent |
| June 20 Yakult–Hiroshima | [official record](https://npb.jp/scores/2026/0620/s-c-10/) | Same; an inning can begin without another recorded out |
| September 9 Lotte–Rakuten | [official record](https://npb.jp/scores/2026/0909/m-e-19/) | Same; fractional innings cannot be treated as decimal innings |
| September 9 DeNA–Yakult | [official record](https://npb.jp/scores/2026/0909/db-s-21/) | Existing nf3 ending evidence absent |

Their root cause is now independently supported as shortened-final context, rather than a speculative short game derived from scores. Box-score ending/pitching totals were inspected for diagnosis, not ingested or exposed as new player data. NPB's pages restrict secondary use; the existing `shortenedFinalEvidenceSchema` explicitly admits only `provider=nf3` and an nf3 URL. **Do not relabel official evidence as nf3 or broaden rights/the contract here.** Next action is an explicit evidence/rights/adapter decision, or a nf3 page with independently explicit ending metadata, followed by participant replay. These six Games and five partial dates remain outside this recovery's writes. No claim of restored shortened games.

Physical Android/TalkBack/production-signed App Links are not available in this environment. Follow [physical QA](android-device-qa.md); the Android 36 emulator is an independent automated check. No signing key creation/change, root assetlinks deployment, Play registration/payment/upload or production push.

## Executed recovery and validation

- Baseline read-only audit [38488544900](https://github.com/tomoya41/baseball-notes/actions/runs/38488544900), independently repeated [38490133528](https://github.com/tomoya41/baseball-notes/actions/runs/38490133528): nine pending, six partial dates, zero findings; protected hashes unchanged before writes. Actual Daily [38482059458](https://github.com/tomoya41/baseball-notes/actions/runs/38482059458) skipped outside the reviewed calendar; its callback [38482111495](https://github.com/tomoya41/baseball-notes/actions/runs/38482111495) did not publish. Neither is collection proof.
- Existing pre-write encrypted Backup/restore drill [38488589943](https://github.com/tomoya41/baseball-notes/actions/runs/38488589943) passed. Controlled first dry-run [38489421751](https://github.com/tomoya41/baseball-notes/actions/runs/38489421751) validated all three candidates and scratch ingestion, then exposed a duplicate backup-directory error, with no canonical writes. Fixed by separate directories; full dry-run [38490072861](https://github.com/tomoya41/baseball-notes/actions/runs/38490072861) passed, remote counts unchanged, 302 requests/pages, zero retry, 16,153,912 response bytes.
- **Actual guarded ingest [38492410369](https://github.com/tomoya41/baseball-notes/actions/runs/38492410369) succeeded.** Its own freshly restored/encrypted/uploaded baseline preceded acquisition. Both schedule copies, fresh dry-run and real scratch ingestion passed before production writes. Existing canonical writer added the following Facts; these are now saved, not merely dry-run candidates:

| Canonical Game suffix | Home–away / score | Batting | Pitching | Home/away outs | Readback |
|---|---|---:|---:|---|---|
| `5956839637147e5631b2` | Lions–Eagles 2–4 | 18 | 12 | 27 /27 | complete, matches candidate hash |
| `7978b5cc540f0334e2d7` | Baystars–Carp 3–4 | 34 | 9 | 27 /27 | complete, matches candidate hash |
| `fd5f433285c5557b67a6` | Marines–Fighters 3–8 | 28 | 9 | 27 /27 | complete, matches candidate hash |

New Day `40afb130-5e90-4e61-91b9-fd573886bf9d` is **repair /complete /3 final /3 complete /0 partial /0 failed**, 80 batting/30 pitching, mapping additions zero, backup exported. The legacy scheduled partial Day is unchanged. Replay is `skipped_verified`; counts and all canonical Fact/mapping values remain identical, zero extra Source requests. Per-Game SHA readback matches the validated scratch and independent restored exports.

| Protected table | Before → after | Permitted difference |
|---|---|---|
| `player_game_batting` | 23,468 →23,548 | 80 target rows added, zero existing rows changed/deleted |
| `player_game_pitching` | 7,112 →7,142 | 30 target rows added, zero existing rows changed/deleted |
| `npb_game_completeness` | 855 →858 | three complete target proofs |
| `ingestion_runs` | 904 →907 | three nf3 target ingestion records |
| `npb_day_runs` | 261 →262 | one complete repair Day; old 261 rows unchanged |
| `npb_ingestion_stages` | 260 →260 | September 28 games stage only, stale 22 count →validated three |
| `npb_games` | 899 →899 | full hash unchanged |
| `source_entity_mappings` | 1,662 →1,662 | full hash unchanged |
| `master_history` | 755 →755 | full hash unchanged |
| Remaining eight protected tables | unchanged | full hashes unchanged |

Both encrypted baseline and final restored export are retained in that Run's `npb-recovery-baseline-encrypted-38492410369` / `npb-recovery-completed-encrypted-38492410369` artifacts for seven days. Each encryption was decrypted and byte-compared on the runner; every restored table/schema was independently verified and all three target Games read back. Final export includes the recorded repair-backup status. No raw export or key was uploaded. Local ignored copies of the encrypted artifacts are retained for owner-controlled recovery.

Independent post-write audit [38493192387](https://github.com/tomoya41/baseball-notes/actions/runs/38493192387): **899 Games /six pending /zero findings**, stable read-only observation. Full Regular period: 196 dates, complete **165 →166**, partial **6 →5**, no_games25 unchanged, failed/unknown0. Only September 28 changed `partial →complete`; April9/14, May3, June20, September9 remain partial. HOT/Ranking conditions were not modified. Latest saved effectiveDate remains October12; repair is not a fresh current-day observation or Scheduled success.

Quality: 105 files /1,226 tests, lint/typecheck/Web/Vercel builds pass; initial JS/CSS and Home fetch behavior unchanged. Codex Review on `1fdfee99dd` found no major issues after the reported P1/P2 fixes (backup directory, both schedule copies, rolled-back proof retry, completed repair backup acknowledgement/selection, airplane cleanup). Source and data protections are tested; exact scope is additionally exercised on real scratch/canonical/restored data.

Android [38491954100](https://github.com/tomoya41/baseball-notes/actions/runs/38491954100) passed **two instrumentation tests** plus cold-offline/process-restart/network-recovery shell QA. APK6,078,644 bytes /unsigned AAB4,494,439 bytes. Two earlier runs exposed emulator transport races, not accepted QA: svc toggles had left cellular connected, then reconnect was not yet validated. The test harness now establishes no default network/validated native connectivity before assertions and restores airplane mode in teardown. App runtime and UI were unchanged. Physical handset/TalkBack/release signing/verified host App Links/Play remain NOT RUN and owner-gated. Debug APK is available in the `android-beta-unsigned` artifact, or the ignored local copy, with [physical PASS/FAIL instructions](android-device-qa.md).

Coordinated generation/publication and post-public HTTP evidence are recorded in the PR delivery report after verification. Recovery success does not itself claim publication or open Production Gates.
