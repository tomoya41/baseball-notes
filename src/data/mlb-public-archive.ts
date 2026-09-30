import { createHash } from "node:crypto";

export interface HistoricalPublicArchive {
  schemaVersion: 1;
  assetUrl: string;
  sha256: string;
}

// This is a preservation copy of public aggregates, never a database backup.
export function parseHistoricalPublicArchive(value: unknown): HistoricalPublicArchive {
  if (!value || typeof value !== "object") throw new Error("Invalid historical archive pointer");
  const pointer = value as Partial<HistoricalPublicArchive>;
  if (pointer.schemaVersion !== 1 || typeof pointer.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(pointer.sha256)
    || typeof pointer.assetUrl !== "string"
    || !/^https:\/\/github\.com\/tomoya41\/baseball-notes\/releases\/download\/mlb-historical-[0-9a-f]{24}\/historical-payload\.tar\.gz$/.test(pointer.assetUrl))
    throw new Error("Invalid historical archive pointer");
  return { schemaVersion: 1, assetUrl: pointer.assetUrl, sha256: pointer.sha256 };
}

export function historicalPublicArchivePointer(archive: Uint8Array): HistoricalPublicArchive {
  const sha256 = createHash("sha256").update(archive).digest("hex");
  return { schemaVersion: 1, sha256,
    assetUrl: `https://github.com/tomoya41/baseball-notes/releases/download/mlb-historical-${sha256.slice(0, 24)}/historical-payload.tar.gz` };
}

export function verifyHistoricalArchive(archive: Uint8Array, checksum: string): void {
  if (!/^[0-9a-f]{64}$/.test(checksum) || createHash("sha256").update(archive).digest("hex") !== checksum)
    throw new Error("MLB payload archive checksum mismatch");
}

export function validateHistoricalArchiveMembers(members: string[]): void {
  if (!members.length || members.some(name => !/^historical(?:\/|$)/.test(name)
    || name.includes("..") || name.includes("\\") || name.startsWith("/")))
    throw new Error("Unsafe MLB payload archive members");
}
