// Adapted from the fixed Wikipedia revisions below, CC BY-SA 4.0.
// Roles, country and MVP were checked against the organizers' announcements.
const teamId = "international:team:jpn";
const id = (pageId: number) => `international:player:jawiki:${pageId}`;

const reviewed = [
  {
    tournamentId: "international:tournament:apbc:2023", revision: "111760584",
    official: "https://www.japan-baseball.jp/jp/games/apbc2023/",
    players: [[4463322, "pitcher"], [4741578, "second_base"], [4237419, "third_base"],
      [4037204, "outfield"], [3886554, "outfield"]],
  },
  {
    tournamentId: "international:tournament:wbc:2023", revision: "1380039596",
    official: "https://www.mlb.com/world-baseball-classic/history/2023", mvp: 5145471,
    players: [[5145471, "pitcher"], [3325410, "outfield"], [5145471, "designated_hitter"]],
  },
  {
    tournamentId: "international:tournament:wbc:2026", revision: "1380043139",
    official: "https://www.mlb.com/news/2026-world-baseball-classic-all-tournament-team",
    players: [[5145471, "designated_hitter"]],
  },
  {
    tournamentId: "international:tournament:premier12:2024", revision: "1378187154",
    official: "https://www.wbsc.org/en/events/2024-premier12/news/chieh-hsien-chen-is-the-wbsc-premier12-2024-mvp",
    players: [[3586306, "catcher"], [3858983, "second_base"], [4037204, "outfield"]],
  },
] as const;

export const japanTournamentHonors = new Map<string, {
  revision: string;
  official: string;
  players: { teamId: string; playerId: string; position: (typeof reviewed)[number]["players"][number][1];
    source: { sourceRevisionId: string; sourceRecordId: string } }[];
  mvp?: { teamId: string; playerId: string; source: { sourceRevisionId: string; sourceRecordId: string } };
}>(reviewed.map(row => [row.tournamentId, {
  revision: row.revision,
  official: row.official,
  players: row.players.map(([pageId, position]) => ({ teamId, playerId: id(pageId), position,
    source: { sourceRevisionId: row.revision, sourceRecordId: `All-tournament team/${position}/${pageId}` } })),
  ...("mvp" in row ? { mvp: { teamId, playerId: id(row.mvp),
    source: { sourceRevisionId: row.revision, sourceRecordId: "Awards/Tournament MVP" } } } : {}),
}]));
