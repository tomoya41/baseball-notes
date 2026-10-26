# NPB read suspension (2026-10-26)

## Evidence and scope

- Scheduled Freshness run `40296133642` (job `121482539600`) reported database read blocking. Scheduled EOD run `40278411516` (job `121426068965`) returned `BLOCKED: SQL read operations are forbidden` before collecting source data. These logs establish provider rejection, not the owner's plan/quota/reset date or recovery.
- No direct production DB probe, account change, retry loop, new source request, Fact write or gate change was used for this fix.

## Bounded suspension

An actual read-only operation returning code `BLOCKED` records a strict, credential-free timestamp/24-hour reservation/run ID in `.data/npb-db-read-suspension.json`. Four production workflows share this small Actions cache on main. A deferred run never extends or republishes the reservation. Expiry only permits the next ordinary scheduled attempt; it does not establish recovery. Missing/evicted cache cannot guarantee suppression across independent runners. Invalid/future/extended state fails closed and requires inspection.

During suspension, collection fails with `unavailable`, zero source/DB activity and no publication, callback, no-game, Coverage, freshness-health or Scheduled Fact evidence. Freshness still checks public JSON and Actions; dependent integrity queries are withheld. A safe report is retained for seven days. Only a later actual Scheduled collection/backup/publication can establish production success.

## Reduced work

In-range EOD watch no longer performs a duplicate preliminary Game enumeration. Outside reviewed dates, one date-indexed COUNT still detects saved Games needing calendar review. Calendar sync retains its empty-database safety check. Source-only dry-run and normal calendar skips omit the connection SELECT. Unknown future calendar metadata fails before opening the DB. Existing public static projections remain independent.

## Validation and rollback

Tests cover exact expiry, non-extension, concurrent observations, read-only error classification, invalid state, zero-I/O deferred CLI execution, calendar boundary guards and workflow restrictions. Full checks: 1,907 passing / one pre-existing skipped test; lint, strict typecheck and Web build pass. Application shell remains byte-identical (`23cd17289cfd6328afbc1ad54c5f82f755352b60d5817cd60cd247e93b2256a2`, 55 files).

Rollback is a normal code revert; no DB/schema/data/personal-store migration is involved. Remove cached state only after understanding the observation; never do so to manufacture quota recovery or production success. Monthly incremental cost remains ¥0. Pixel/TalkBack and current production integrity are not asserted by these fixture tests.
