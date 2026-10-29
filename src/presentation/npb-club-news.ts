/** External navigation only. Club news is not an admitted ingestion/republication source. */
export const npbClubNews: Readonly<Record<string, string>> = {
  giants: "https://www.giants.jp/news/", tigers: "https://hanshintigers.jp/news/",
  dragons: "https://dragons.jp/news/", carp: "https://www.carp.co.jp/news/",
  swallows: "https://www.yakult-swallows.co.jp/news/", baystars: "https://www.baystars.co.jp/news/",
  hawks: "https://www.softbankhawks.co.jp/news/", fighters: "https://www.fighters.co.jp/news/list/",
  lions: "https://www.seibulions.jp/news/", marines: "https://www.marines.co.jp/news/",
  eagles: "https://www.rakuteneagles.jp/news/", buffaloes: "https://www.buffaloes.co.jp/news/",
};
export function clubNewsUrl(teamId: string) { return /^npb:team:[a-z]+$/.test(teamId) ? npbClubNews[teamId.slice(9)] ?? null : null; }
