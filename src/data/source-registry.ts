import type { League } from "../domain/models";

export interface DataSource {
  key: string;
  displayName: string;
  league: League;
  baseUrl: string;
  type: "licensed-download" | "official-site" | "public-site" | "candidate-api";
  priority: number;
  status: "enabled-historical" | "enabled-limited-public" | "disabled-pending-terms" | "disabled-reuse-restricted";
  categories: readonly string[];
  updateCadence: string;
  termsUrl: string;
  checkedOn: string;
  notes: string;
}

export const sourceRegistry: readonly DataSource[] = [
  {
    key: "retrosheet-csv", displayName: "Retrosheet Daily Logs", league: "MLB",
    baseUrl: "https://www.retrosheet.org/downloads/", type: "licensed-download",
    priority: 10,
    status: "enabled-historical", categories: ["game", "historical-standings"],
    updateCadence: "release-based; current archive through 2025", termsUrl: "https://www.retrosheet.org/notice.txt",
    checkedOn: "2026-09-24", notes: "Permits reuse with prominent exact attribution. Historical only; source can correct records.",
  },
  {
    key: "npb-official", displayName: "NPB公式", league: "NPB", baseUrl: "https://npb.jp/",
    type: "official-site", priority: 10, status: "disabled-reuse-restricted", categories: ["master", "stats", "standings"],
    updateCadence: "site-dependent; no API SLA", termsUrl: "https://npb.jp/",
    checkedOn: "2026-09-24", notes: "Page footer explicitly prohibits secondary use and unauthorized reproduction. Disabled; no ingestion.",
  },
  {
    key: "nf3", displayName: "nf3", league: "NPB", baseUrl: "https://nf3.sakura.ne.jp/",
    type: "public-site", priority: 20, status: "enabled-limited-public", categories: ["standings", "games", "selected-player-game-logs"],
    updateCadence: "site-dependent; collector at most daily", termsUrl: "https://nf3.sakura.ne.jp/",
    checkedOn: "2026-09-24", notes: "Public/no explicit prohibition found on checked pages; robots.txt returns 404. No legal reuse guarantee. Secondary manually compiled source; bounded daily fetch, source attribution, disable on terms change. Site closure announced for 2028-01-24.",
  },
  {
    key: "mlb-stats", displayName: "MLB Stats", league: "MLB", baseUrl: "https://statsapi.mlb.com/",
    type: "candidate-api", priority: 10, status: "disabled-pending-terms", categories: ["master", "games", "standings"],
    updateCadence: "unverified", termsUrl: "https://www.mlb.com/official-information/terms-of-use",
    checkedOn: "2026-09-24", notes: "No third-party application storage/redistribution grant established.",
  },
  {
    key: "baseball-savant", displayName: "Baseball Savant", league: "MLB", baseUrl: "https://baseballsavant.mlb.com/",
    type: "public-site", priority: 20, status: "disabled-pending-terms", categories: ["pitch", "batted-ball"],
    updateCadence: "unverified", termsUrl: "https://www.mlb.com/official-information/terms-of-use",
    checkedOn: "2026-09-24", notes: "Pitch-level acquisition/reuse not approved; no all-pitch mirror.",
  },
];

export const RETROSHEET_ATTRIBUTION = 'The information used here was obtained free of charge from and is copyrighted by Retrosheet. Interested parties may contact Retrosheet at "www.retrosheet.org".';
