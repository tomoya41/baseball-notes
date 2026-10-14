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

Physical Android/TalkBack/production-signed App Links are not available in this environment. Follow [physical QA](android-device-qa.md); the Android 36 emulator is an independent automated check. No signing key creation/change, root assetlinks deployment, Play registration/payment/upload or production push.

Execution results and actual run IDs will be added after the controlled dry-run/write/readback/publication, rather than assuming this plan succeeded.
