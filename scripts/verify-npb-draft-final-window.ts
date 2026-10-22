import { createHash } from "node:crypto";
import pin from "../src/data/npb-draft-final-release.json";
import { assertFinalAppPublicationWindow, finalDraftForecastSchema } from "../src/domain/npb-draft-final";

// One bounded own-site read, no DB/source access. Fail closed on outages or a conflicting immutable asset.
const response = await fetch(`https://tomoya41.github.io/baseball-notes/data/npb/draft/${pin.sha256}/final-2026.json`, { signal: AbortSignal.timeout(15000), cache: "no-store" });
let alreadyPublished = false;
if (response.ok) {
  const body = Buffer.from(await response.arrayBuffer());
  if (body.length !== pin.bytes || createHash("sha256").update(body).digest("hex") !== pin.bodySha256) throw Error("Public final forecast does not match immutable pin");
  finalDraftForecastSchema.parse(JSON.parse(body.toString()));
  alreadyPublished = true;
} else if (response.status !== 404) throw Error(`Cannot establish final forecast publication state: HTTP ${response.status}`);
assertFinalAppPublicationWindow(alreadyPublished);
console.log(JSON.stringify({ status: "PASS", alreadyPublished, checkedAt: new Date().toISOString(), firstPublicationSafetyMarginMinutes: 15, dbReads: 0 }));
