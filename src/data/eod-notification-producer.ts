import type { DataClient } from "./database";
import { readEodEvent } from "./npb-eod";
import { eodNotification } from "../domain/eod-notifications";
import { npbPlayerDirectorySchema } from "../domain/npb-player-directory";
export async function sendPublishedEodNotifications(client: DataClient, date: string,
  directory: unknown, send: (event: ReturnType<typeof eodNotification>) => Promise<void>) {
  const parsed = npbPlayerDirectorySchema.parse(directory);
  if (parsed.effectiveDate < date || !await readEodEvent(client, "eod-published", date)) throw Error("Verified publication required before notification");
  const players = await client.execute({ sql: `SELECT DISTINCT player_id FROM (
    SELECT b.player_id FROM player_game_batting b JOIN npb_games g ON g.game_id=b.game_id WHERE g.game_date=?
    UNION SELECT p.player_id FROM player_game_pitching p JOIN npb_games g ON g.game_id=p.game_id WHERE g.game_date=?)`, args: [date, date] });
  let sent = 0, skipped = 0, failed = 0;
  for (const row of players.rows) {
    const id = String(row.player_id), profile = parsed.players.find(p => p.playerId === id);
    if (!profile) { skipped++; continue; }
    const event = eodNotification(date, id, profile.displayName);
    // Claim BEFORE send: at-most-once across Daily, Watcher and retries. An uncertain
    // HTTP outcome is never automatically resent (FCM has no exactly-once API).
    const claim = await client.execute({ sql: "INSERT OR IGNORE INTO permanent_events VALUES (?,?,?,?,?,?,?,?)",
      args: [event.id, "notification-eod", date, id, JSON.stringify({ state: "claimed" }), "app-notifications", event.id, new Date().toISOString()] });
    if (!claim.rowsAffected) { skipped++; continue; }
    let state: string;
    try { await send(event); sent++; state = "sent"; } catch { failed++; state = "failed_or_uncertain"; }
    await client.execute({ sql: "UPDATE permanent_events SET payload_json=? WHERE event_id=?", args: [JSON.stringify({ state }), event.id] });
  }
  return { sent, skipped, failed };
}
