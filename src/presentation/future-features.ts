// Route structure for future capabilities. This is UI planning, never a data-readiness claim.
export const futureSections = {
  milestones: { title: "達成記録", detail: "選手が積み重ねた記録を、シーズンとキャリアの両方から。", tabs: ["シーズン", "キャリア"], requirement: "この条件の達成記録は未収録です。" },
  moves: { title: "選手移動", detail: "選手の所属や登録の変化を、ひとつの場所で。", tabs: ["登録・移動", "FA", "Posting"], requirement: "この条件の公示・移籍情報は未収録です。" },
  talent: { title: "次の世代", detail: "ドラフトからプロスペクトまで、選手の入口をたどる。", tabs: ["ドラフト", "プロスペクト"], requirement: "この条件の指名・選手情報は未収録です。" },
  preseason: { title: "オープン戦", detail: "公式戦とは分けて、シーズン前の試合を振り返る。", tabs: ["日程・結果", "選手成績"], requirement: "オープン戦の日程・選手成績は未収録です。" },
  matchup: { title: "MATCHUP", detail: "打者と投手の対戦を、実際の記録から。", tabs: ["対戦成績", "選手比較"], requirement: "NPBの打者対投手の対戦記録は未収録です。" },
  watch: { title: "WATCH", detail: "試合と選手の情報を、観戦のおともに。", tabs: ["試合", "選手の見どころ"], requirement: "この画面の試合・選手情報は未収録です。ライブ情報は提供していません。" },
  career: { title: "キャリア", detail: "過去シーズンをたどり、選手の歩みを見る。", tabs: ["シーズン履歴", "収録期間合計"], requirement: "この条件の過去シーズン成績は未収録です。" },
  advanced: { title: "対戦・高度分析", detail: "いつ、誰と、どんな場面で。記録のもう一歩先へ。", tabs: ["Direct BvP", "状況別"], requirement: "この条件の打席・状況別成績は未収録です。" },
} as const;
export type FutureSection = keyof typeof futureSections;
