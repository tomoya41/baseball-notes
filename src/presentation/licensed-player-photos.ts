import ohtani from "../assets/players/ohtani-2024-v1.webp";
import yamamoto from "../assets/players/yamamoto-2024-v1.webp";
import kondo from "../assets/players/kondo-2023-v1.webp";
import maki from "../assets/players/maki-2021-v1.webp";
import yanagita from "../assets/players/yanagita-2023-v1.webp";

// Reviewed informational portraits only. This registry grants no logo,
// endorsement, advertising or current-roster rights. See visual-assets-rights.md.
export const licensedPlayerPhotos = [
  { playerId: "mlb:player:e70b8d12-aa41-50c0-9c1b-d468d451355f", qid: "Q4391858", name: "大谷翔平", season: 2024, years:[2024,2025], assetName:"ohtani-2024", framed:false,
    src: ohtani, width: 320, height: 480, author: "All-Pro Reels", edits: "UCinternationalによる切り抜き。サイズ縮小・WebP変換。",
    source: "https://commons.wikimedia.org/w/index.php?curid=152950633&oldid=1253972097",
    license: "CC BY-SA 2.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/",
    sourceSha1: "15173fd08edc0ac7e75a0c100bef2f15fd59cc9e", sha256: "d83d67a0950dbfd4d09389f32152aa57efbf7c453c9877252ca5783cf7b9d02f" },
  { playerId: "mlb:player:361727b1-f326-5bf1-9d1b-adba3157c9ac", qid: "Q30935992", name: "山本由伸", season: 2024, years:[2024,2025], assetName:"yamamoto-2024", framed:false,
    src: yamamoto, width: 360, height: 462, author: "All-Pro Reels", edits: "WikiPedantによる切り抜き・修整。サイズ縮小・WebP変換。",
    source: "https://commons.wikimedia.org/w/index.php?curid=177710647&oldid=1126409671",
    license: "CC BY-SA 2.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/",
    sourceSha1: "508f5cd2866902f8b1c095d7c7fa8093476180d6", sha256: "2a74bbd3cfa0b0ef41478157dcb332a1a032c61e6648f5fda74403acbd4cf10d" },
  { playerId:"54f9b289-4717-4fb8-b1c3-7c8cf37e2e42",qid:"Q11638712",npbId:"41745135",name:"近藤健介",season:2023,years:[2023,2024,2025,2026],assetName:"kondo-2023",framed:true,
    src:kondo,width:320,height:514,author:"Orixbaseballclub",edits:"サイズ縮小・WebP変換。表示領域に合わせたトリミング。",
    source:"https://commons.wikimedia.org/w/index.php?curid=130403896&oldid=1285332938",
    license:"CC BY-SA 4.0",licenseUrl:"https://creativecommons.org/licenses/by-sa/4.0/",
    sourceSha1:"1d9a4f7aa5f48ac8fe2e416e5c88665aae5974b4",sha256:"811c7c2828df5394a9fec7ea6d55ab99868b3c2ae47c7e1979623463a7fe07b1" },
  { playerId:"852bed28-a3f1-4b60-8a1f-950cc2947686",qid:"Q102246912",npbId:"13115153",name:"牧秀悟",season:2021,years:[2021,2022,2023,2024,2025,2026],assetName:"maki-2021",framed:false,
    src:maki,width:320,height:385,author:"ぽこ太郎",edits:"サイズ縮小・WebP変換。表示領域に合わせたトリミング。",
    source:"https://commons.wikimedia.org/w/index.php?curid=102150971&oldid=1278574972",
    license:"CC BY-SA 4.0",licenseUrl:"https://creativecommons.org/licenses/by-sa/4.0/",
    sourceSha1:"f853e090e3cbbe86a6d1dd72c3ca8aa74ad87f1d",sha256:"5e084f3787fb2c36847e609ab678fb466874787ca479af3c58057251e12f3cbc" },
  { playerId:"dc165f2e-9539-4ad0-b206-5d75794fee96",qid:"Q11534568",npbId:"31835133",name:"柳田悠岐",season:2023,years:[2023,2024,2025,2026],assetName:"yanagita-2023",framed:false,
    src:yanagita,width:320,height:424,author:"ウィ貴公子",edits:"原写真からの切り抜きに続き、向き補正・上半身の切り抜き・サイズ縮小・WebP変換。",
    source:"https://commons.wikimedia.org/w/index.php?curid=138568489&oldid=1285342780",
    license:"CC BY-SA 4.0",licenseUrl:"https://creativecommons.org/licenses/by-sa/4.0/",
    sourceSha1:"ad3ff223ff20c632f723bee67f9c05f672b30359",sha256:"6d5092c4df29f61203b600c44d4c2a7c2cdf7f3cddcc87ba40257a67b7f34381" },
] as const;

/** A dated portrait identifies its subject, not the season's uniform or roster.
 * Each file has its own reviewed presentation years; no name-based fallback. */
export function findLicensedPlayerPhoto(playerId: string, season: number) {
  return licensedPlayerPhotos.find(photo => photo.playerId === playerId && (photo.years as readonly number[]).includes(season));
}

