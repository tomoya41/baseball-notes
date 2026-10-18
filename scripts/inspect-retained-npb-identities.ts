import { DatabaseSync } from "node:sqlite";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, sep } from "node:path";

// Fixed, previously verified encrypted restore. No arbitrary backup/target export.
const [file, summaryFile, restoredFile, output] = process.argv.slice(2);
if (!file || !summaryFile || !restoredFile || !output || ![file, output].every(p => resolve(p).startsWith(resolve(".data") + sep))) throw Error("Pass local scratch DB, safe summary, restore receipt and ignored output");
const summary = JSON.parse(await readFile(summaryFile, "utf8")), restored = JSON.parse(await readFile(restoredFile, "utf8"));
if (summary.result !== "PASS" || summary.runId !== "38963670207" || summary.encryptedSha256 !== "6aff8770a2f90923a75a21ed24b6d84a007cafb30bbda05b1756ffd0996ddd2e" || restored.result !== "PASS" || summary.schemaVersion !== restored.schemaVersion || JSON.stringify(summary.tables.map((t: {name:string;rows:number}) => [t.name,t.rows])) !== JSON.stringify(restored.tables.map((t: {name:string;rows:number}) => [t.name,t.rows]))) throw Error("Retained backup/independent restore receipt mismatch");
const targets = [
  { playerId: "bab3e29d-faa7-44e3-abe1-ee7023163a63", teamCode: "DB", number: "69" },
  { playerId: "e88b4e3d-1c6c-4b81-9c7c-9af1e8e133f3", teamCode: "DB", number: "62" },
];
const db = new DatabaseSync(resolve(file), { readOnly: true });
try {
  const rows = targets.map(target => {
    const matches = db.prepare("SELECT source_key,entity_kind,source_entity_id,internal_entity_id,source_url,first_seen,last_seen FROM source_entity_mappings WHERE internal_entity_id=? AND entity_kind='player' AND source_key='nf3'").all(target.playerId);
    return { ...target, matches };
  });
  const report = { mode: "retained_backup_identity_inspection", backupRunId: summary.runId, snapshotObservedAt: summary.observedAt,
    inspectedAt: new Date().toISOString(), backupEncryptedSha256: summary.encryptedSha256,
    scratchSha256: createHash("sha256").update(await readFile(file)).digest("hex"),
    scheduledProductionEvidence: false, freshCanonicalIntegrity: false, remoteReads: 0, remoteWrites: 0, sourceRequests: 0, rows };
  await writeFile(output, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ inspected: targets.length, found: rows.filter(r => r.matches.length).length, remoteReads: 0, remoteWrites: 0 }));
} finally { db.close(); }
