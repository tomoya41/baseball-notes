import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { npbPlayerDirectorySchema, type NpbPlayerDirectory } from "../domain/npb-player-directory";

export async function writeNpbPlayerDirectoryAtomically(path: string, value: NpbPlayerDirectory): Promise<number> {
  const json = JSON.stringify(npbPlayerDirectorySchema.parse(value));
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, json, { encoding: "utf8", flag: "wx" });
    npbPlayerDirectorySchema.parse(JSON.parse(await readFile(temporary, "utf8")) as unknown);
    await rename(temporary, path);
    return Buffer.byteLength(json, "utf8");
  } finally { await rm(temporary, { force: true }); }
}
