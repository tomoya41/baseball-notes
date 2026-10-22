import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import pin from "../src/data/npb-draft-final-release.json";
import { finalDraftForecastSchema } from "../src/domain/npb-draft-final";
import { verifyFinalDraftWindow } from "./npb-draft-final-window";

export async function stageNpbFinalDraft(root: string) {
  await verifyFinalDraftWindow();
  // Reviewed editorial source, not a provider dump. Its exact immutable projection is pinned independently of result facts.
  const f = finalDraftForecastSchema.parse(JSON.parse(await readFile("src/data/npb-draft-2026-final-forecast.json", "utf8")));
  const body = Buffer.from(JSON.stringify(f) + "\n");
  if (body.length > 150000 || body.length !== pin.bytes || createHash("sha256").update(body).digest("hex") !== pin.bodySha256 || f.frozenAt !== pin.frozenAt) throw Error("Frozen final forecast mismatch");
  const destination = join(root, pin.sha256);
  await mkdir(destination, { recursive: true });
  await writeFile(join(destination, "final-2026.json"), body);
  return { files: 1, bytes: body.length, canonicalWrites: 0 };
}
