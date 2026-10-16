# Independent encrypted NPB backup / restore

This opt-in manual extension of `npb-backup-drill.yml` retains a usable encrypted copy while the Regular collector correctly skips outside the reviewed season calendar. It adds no source collection, canonical write, paid storage, scheduled job, secret or key generation. Default `retain_encrypted=false` preserves the previous transient drill.

With `retain_encrypted=true`, use the **existing** `NPB_BACKUP_ENCRYPTION_KEY` secret:

1. Export the existing 17 protected tables through the existing SELECT-only backup path and independently restore/read back into scratch SQLite.
2. Validate the export directory remains inside the job's `.data/backup-drill-*` workspace before packaging it.
3. Encrypt with the existing AES-256-GCM envelope, decrypt a new copy and compare plaintext bytes.
4. Restore the decrypted archive into a second new scratch database. Existing restore checks validate schema, compressed/data hashes, every restored row value, counts and migration versions, then repository readback.
5. Upload **only ciphertext and a whitelisted summary** for seven days. Plain SQL/JSONL, decrypted tar, DB, credentials, source DB URL and export directories are not artifact paths. Failed verification uploads nothing.

Run after reviewing the workflow commit:

```powershell
gh workflow run npb-backup-drill.yml --ref main -f retain_encrypted=true
```

The artifact is `npb-independent-encrypted-<run id>`, deliberately distinct from the Daily collector's Fact-backup artifact. The summary explicitly sets `collectionEvidence=false` and `scheduledProductionEvidence=false`. It is **not** Scheduled Production, new ingestion/freshness, complete Coverage or HOT/Ranking evidence. No Production Gate reader or allowlist changes. Review the event type and code commit alongside the artifact, not the green job icon alone.

For a future restore, download this ciphertext, use the existing key privately with `scripts/crypt-npb-backup.ts decrypt`, unpack into a new private directory, then use `scripts/restore-npb-backup.ts --from=<directory> --to=<new-scratch.db>`. Never overwrite an existing/canonical DB. The original key remains owner-managed; do not print it, replace it or store it in Git/artifacts. Seven-day expiry is intentional; this does not introduce indefinite/off-season automated retention or replace owner-managed long-term backup policy.

Current Regular remains known partial (six pending Games, five partial dates). A successful backup preserves those facts; it does not repair the missing evidence. Actual execution/restore/artifact inspection results are recorded in the delivery PR after the run. Physical Pixel/TalkBack and Play signing remain independent owner/device checks.
