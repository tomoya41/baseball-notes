import pin from "./npb-japan-series-release.json";

// Wikipedia contributors, revision 111797100, CC BY-SA 4.0. Award names and recipients only.
export const japanSeries2026Awards = {
  seriesId: pin.seriesId,
  revisionUrl: "https://ja.wikipedia.org/w/index.php?curid=5306035&oldid=111797100",
  officialUrl: "https://npb.jp/nippons/2026/award.html",
  awards: [
    { name: "最高殊勲選手賞（MVP）", recipients: ["正木智也"] },
    { name: "敢闘選手賞", recipients: ["東克樹"] },
    { name: "優秀選手賞", recipients: ["杉山一樹", "山本祐大", "庄子雄大"] },
    { name: "SMBCみんなの声援賞", recipients: ["柳田悠岐"] },
  ],
} as const;
