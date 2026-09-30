import { createSign } from "node:crypto";
import { z } from "zod";
import { openDataClient } from "../src/data/database";
import { sendPublishedEodNotifications } from "../src/data/eod-notification-producer";
const secret = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!secret || process.env.NPB_NOTIFICATIONS_ENABLED !== "true") {
  console.log(JSON.stringify({ notifications: "disabled", reason: "external_setup_or_opt_in_pending" }));
} else {
  const account = (() => { try {
    return z.object({ project_id: z.string().regex(/^[a-z][a-z0-9-]+$/), client_email: z.email(), private_key: z.string().startsWith("-----BEGIN PRIVATE KEY-----") }).parse(JSON.parse(secret));
  } catch { throw Error("Firebase service credential is invalid (details redacted)"); } })();
  const date = process.env.TARGET_DATE ?? "";
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(date)) throw Error("Target date required");
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const now = Math.floor(Date.now() / 1000), assertion = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({ iss: account.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })}`;
  const signature = createSign("RSA-SHA256").update(assertion).sign(account.private_key, "base64url");
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", signal: AbortSignal.timeout(15000),
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${assertion}.${signature}` }) });
  if (!tokenResponse.ok) throw Error("FCM authorization failed");
  const token = z.object({ access_token: z.string() }).parse(await tokenResponse.json()).access_token;
  const response = await fetch("https://tomoya41.github.io/baseball-notes/data/npb/players/latest.json", { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw Error("Published directory unavailable");
  const client = openDataClient(process.env.TURSO_DATABASE_URL ?? "", process.env.TURSO_AUTH_TOKEN);
  try {
    const report = await sendPublishedEodNotifications(client, date, await response.json(), async event => {
      const result = await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
        method: "POST", signal: AbortSignal.timeout(15000), headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ message: { topic: event.topic, data: { eventId: event.id, title: event.title, body: event.body, deepLink: event.deepLink },
          android: { priority: "HIGH", ttl: "86400s" } } }),
      });
      if (!result.ok) throw Error("FCM send rejected"); // Never log server body/token/config.
    });
    console.log(JSON.stringify({ notifications: "enabled", ...report }));
  } finally { client.close(); }
}
