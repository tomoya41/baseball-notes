import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { npbHotPayloadSchema, type NpbHotPayload } from "../application/npb-hot-payload";

// This writer only stages a local artifact. It is deliberately not called by Pages publishing.
export async function writeNpbHotPayloadAtomically(path: string, value: NpbHotPayload): Promise<number> {
  const payload = npbHotPayloadSchema.parse(value);
  const json = JSON.stringify(payload);
  const bytes = Buffer.byteLength(json, "utf8");
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, json, { encoding: "utf8", flag: "wx" });
    npbHotPayloadSchema.parse(JSON.parse(await readFile(temporary, "utf8")));
    await rename(temporary, path);
    return bytes;
  } finally { await rm(temporary, { force: true }); }
}
