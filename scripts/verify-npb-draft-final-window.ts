import { verifyFinalDraftWindow } from "./npb-draft-final-window";

// One bounded own-site read, no DB/source access. Fail closed on outages or a conflicting immutable asset.
console.log(JSON.stringify({ status: "PASS", ...await verifyFinalDraftWindow(), checkedAt: new Date().toISOString(), firstPublicationSafetyMarginMinutes: 15, dbReads: 0 }));
