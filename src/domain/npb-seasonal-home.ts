import { dateInZone } from "./analysis-query";

export const seasonalModes=["spring","regular","autumn","winter"] as const;
export type SeasonalMode=typeof seasonalModes[number];
/** Editorial discovery context only: never competition dates, live news or collection evidence. */
export function npbSeasonalHome(now:number,requested:string|null=null){
  const date=dateInZone(now,"Asia/Tokyo"),month=Number(date.slice(5,7));
  const automatic:SeasonalMode=month>=2&&month<=3?"spring":month>=4&&month<=9?"regular":month===10?"autumn":"winter";
  const mode=seasonalModes.includes(requested as SeasonalMode)?requested as SeasonalMode:automatic;
  const content={
    spring:{title:"春の選手チェック",description:"収録済みの過去成績と若手選手から、新シーズンの楽しみを探す。",links:[{to:"/NPB/talent?view=young",label:"若手選手を探す"},{to:"/NPB/history?season=2025",label:"2025年の収録成績を見る"},{to:"/NPB/history?cohort=ageSeason&age=26&ageMode=collected",label:"年齢ごとの積み重ねを比較"}],unavailable:"オープン戦・キャンプの実データは未収録です。過去成績から今季の活躍や出場予定は予測しません。"},
    regular:{title:"シーズンの数字を楽しむ",description:"保存済みの試合と成績から、お気に入りの変化を追う。",links:[{to:"/NPB/schedule",label:"保存済みの試合を見る"},{to:"/NPB/data?period=7",label:"直近成績を調べる"},{to:"/NPB/watch-center",label:"お気に入りの変化を見る"}],unavailable:"保存済みデータの基準日は各画面に表示します。HOT・個人成績ランキングは現在利用できません。"},
    autumn:{title:"CSとドラフトから、選手を深掘り",description:"収録済みの短期決戦と、ドラフト候補・同期の歩みをたどる。",links:[{to:"/NPB/cs?season=2026",label:"2026年CSの収録試合・成績"},{to:"/NPB/talent/2026?view=results&forecast=final",label:"2026ドラフト・独自案と指名結果"},{to:"/NPB/postseason?stage=japan_series&season=2026",label:"日本シリーズの日程・大会詳細"}],unavailable:"CSは一部収録です。ドラフトの独自案は球団公表・報道予想とは別で、確認済みの指名結果のみ反映します。日本シリーズも収録時点を確認してください。"},
    winter:{title:"選手の歩みを振り返る",description:"年度ごとの成長、球団別成績、記録への積み重ねを見比べる。",links:[{to:"/NPB/history?season=2025",label:"年度推移・球団別成績を見る"},{to:"/NPB/history?cohort=ageSeason&age=26&ageMode=collected",label:"同じ年齢までの収録分を比較"},{to:"/NPB/my",label:"追いかけたい選手を整理"}],unavailable:"契約・トレード・引退発表の記事記載は一部収録です。FA・ポスティングの全件情報や公式のIN／OUT一覧は未収録です。球団別年度成績から移籍日や契約を推定しません。"}
  } satisfies Record<SeasonalMode,{title:string;description:string;links:{to:string;label:string}[];unavailable:string}>;
  return {mode,date,automatic,manual:seasonalModes.includes(requested as SeasonalMode),...content[mode]};
}
