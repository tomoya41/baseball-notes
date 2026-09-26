import type { DataClient } from "./database";
import { npbPlayerDirectorySchema, type NpbPlayerDirectory } from "../domain/npb-player-directory";

export class NpbPlayerDirectoryRepository {
  constructor(private readonly client: DataClient) {}

  async read(generatedAt = new Date().toISOString()): Promise<NpbPlayerDirectory> {
    const [master, teamsResult, batting, pitching, date] = await Promise.all([
      this.client.execute(`SELECT entity_id,payload_json FROM
        (SELECT entity_id,payload_json,ROW_NUMBER() OVER
          (PARTITION BY entity_id ORDER BY valid_from DESC) AS ordinal
          FROM master_history WHERE entity_kind='player') WHERE ordinal=1`),
      this.client.execute(`SELECT entity_id,payload_json FROM
        (SELECT entity_id,payload_json,ROW_NUMBER() OVER
          (PARTITION BY entity_id ORDER BY valid_from DESC) AS ordinal
          FROM master_history WHERE entity_kind='team') WHERE ordinal=1`),
      this.client.execute("SELECT DISTINCT player_id FROM player_game_batting"),
      this.client.execute("SELECT DISTINCT player_id FROM player_game_pitching"),
      this.client.execute("SELECT MAX(snapshot_date) AS date FROM standings_daily WHERE league='NPB'"),
    ]);
    const effectiveDate = date.rows[0]?.date;
    if (typeof effectiveDate !== "string") throw new Error("No NPB standings effective date");
    const teams = teamsResult.rows.map((row) => {
      const value = JSON.parse(String(row.payload_json)) as { names?: { canonical?: unknown; japaneseShort?: unknown } };
      const name = value.names?.canonical;
      const shortName = value.names?.japaneseShort;
      if (typeof name !== "string") throw new Error("Invalid team master");
      return { id: String(row.entity_id), name,
        shortName: typeof shortName === "string" ? shortName : name };
    }).sort((a, b) => a.id.localeCompare(b.id));
    const battingIds = new Set(batting.rows.map((row) => String(row.player_id)));
    const pitchingIds = new Set(pitching.rows.map((row) => String(row.player_id)));
    const players = master.rows.map((row) => {
      const value = JSON.parse(String(row.payload_json)) as { name?: unknown; teamId?: unknown; position?: unknown };
      if (typeof value.name !== "string" || !value.name.trim()) throw new Error("Invalid player master name");
      return { playerId: String(row.entity_id), displayName: value.name,
        teamId: typeof value.teamId === "string" ? value.teamId : null,
        position: typeof value.position === "string" && value.position.trim() ? value.position : null,
        battingAvailable: battingIds.has(String(row.entity_id)),
        pitchingAvailable: pitchingIds.has(String(row.entity_id)) };
    }).sort((a, b) => a.displayName.localeCompare(b.displayName, "ja") ||
      a.playerId.localeCompare(b.playerId));
    return npbPlayerDirectorySchema.parse({ schemaVersion: 1, league: "NPB", effectiveDate,
      generatedAt, teams, players });
  }
}
