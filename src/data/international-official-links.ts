import { internationalTournamentSchema } from "../domain/international-competition";

// Editorial links only. Game, roster and statistics data require separate admission.
export const internationalOfficialTournaments = internationalTournamentSchema.array().parse([
  {
    competition: "international", id: "international:tournament:apbc:2026", kind: "apbc", year: 2026,
    name: "アジアプロ野球チャンピオンシップ2026",
    summary: "発表された開催日程は2026年11月12〜15日、会場は東京ドーム。",
    links: [
      { label: "公式大会概要", url: "https://www.japan-baseball.jp/jp/games/apbc2026/" },
      { label: "公式試合日程", url: "https://www.japan-baseball.jp/jp/games/apbc2026/#schedule" },
      { label: "日本代表の公式選手一覧", url: "https://www.japan-baseball.jp/jp/games/apbc2026/player_jpn.html" },
    ],
  },
  {
    competition: "international", id: "international:tournament:wbc:2026", kind: "wbc", year: 2026, name: "WBC 2026",
    links: [{ label: "日本代表の公式大会ページ", url: "https://www.japan-baseball.jp/jp/games/wbc2026/" }],
  },
  {
    competition: "international", id: "international:tournament:wbc:2023", kind: "wbc", year: 2023, name: "WBC 2023",
    links: [{ label: "日本代表の公式大会ページ", url: "https://www.japan-baseball.jp/jp/team/topteam/2023/wbc/overview.html" }],
  },
  {
    competition: "international", id: "international:tournament:premier12:2024", kind: "premier12", year: 2024, name: "WBSC プレミア12 2024",
    links: [{ label: "日本代表の公式大会ページ", url: "https://www.japan-baseball.jp/jp/games/2024premier12/" }],
  },
  {
    competition: "international", id: "international:tournament:premier12:2027", kind: "premier12", year: 2027, name: "WBSC プレミア12 2027",
    links: [{ label: "WBSCの開催方針（PDF）", url: "https://static.wbsc.org/uploads/federations/0/cms/documents/b5b2592b-3a2b-515b-a001-1e72e5a80911.pdf" }],
  },
  {
    competition: "international", id: "international:tournament:exhibition:2026:nagoya", kind: "exhibition", year: 2026, name: "侍ジャパンシリーズ2026 名古屋",
    links: [{ label: "日本代表の公式大会ページ", url: "https://www.japan-baseball.jp/jp/games/nagoya2026/" }],
  },
]);
