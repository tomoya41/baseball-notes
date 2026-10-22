import { verifyFinalDraftWindow } from "./npb-draft-final-window";

// One bounded own Pages/Release proof read, no DB/provider collection. Fail closed on conflicting evidence.
console.log(JSON.stringify({ status: "PASS", ...await verifyFinalDraftWindow(), checkedAt: new Date().toISOString(), firstPublicationSafetyMarginMinutes: 15, dbReads: 0 }));
