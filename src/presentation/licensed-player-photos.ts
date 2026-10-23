import ohtani from "../assets/players/ohtani-2024-v1.webp";
import yamamoto from "../assets/players/yamamoto-2024-v1.webp";

// Reviewed informational portraits only. This registry grants no logo,
// endorsement, advertising or current-roster rights. See visual-assets-rights.md.
export const licensedPlayerPhotos = [
  { playerId: "mlb:player:e70b8d12-aa41-50c0-9c1b-d468d451355f", qid: "Q4391858", name: "大谷翔平", season: 2024,
    src: ohtani, width: 320, height: 480, author: "All-Pro Reels", edits: "UCinternationalによる切り抜き。サイズ縮小・WebP変換。",
    source: "https://commons.wikimedia.org/w/index.php?curid=152950633&oldid=1253972097",
    license: "CC BY-SA 2.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/",
    sourceSha1: "15173fd08edc0ac7e75a0c100bef2f15fd59cc9e", sha256: "d83d67a0950dbfd4d09389f32152aa57efbf7c453c9877252ca5783cf7b9d02f" },
  { playerId: "mlb:player:361727b1-f326-5bf1-9d1b-adba3157c9ac", qid: "Q30935992", name: "山本由伸", season: 2024,
    src: yamamoto, width: 360, height: 462, author: "All-Pro Reels", edits: "WikiPedantによる切り抜き・修整。サイズ縮小・WebP変換。",
    source: "https://commons.wikimedia.org/w/index.php?curid=177710647&oldid=1126409671",
    license: "CC BY-SA 2.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/",
    sourceSha1: "508f5cd2866902f8b1c095d7c7fa8093476180d6", sha256: "2a74bbd3cfa0b0ef41478157dcb332a1a032c61e6648f5fda74403acbd4cf10d" },
] as const;

