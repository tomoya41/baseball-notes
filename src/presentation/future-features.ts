// Route structure for future capabilities. This is UI planning, never a data-readiness claim.
export const futureSections = {
  milestones: { title: "達成記録", detail: "選手が積み重ねた記録を、シーズンとキャリアの両方から。", tabs: ["シーズン", "キャリア"], requirement: "確認済みの収録範囲に基づく達成記録を提供予定です。" },
  moves: { title: "選手移動", detail: "選手の所属や登録の変化を、ひとつの場所で。", tabs: ["登録・移動", "FA", "Posting"], requirement: "確認済みの公示・移籍情報が利用可能になり次第、表示します。" },
  talent: { title: "次の世代", detail: "ドラフトからプロスペクトまで、選手の入口をたどる。", tabs: ["ドラフト", "プロスペクト"], requirement: "指名情報や選手情報を確認できるデータ提供元を準備中です。" },
  preseason: { title: "オープン戦", detail: "公式戦とは分けて、シーズン前の試合を振り返る。", tabs: ["日程・結果", "選手成績"], requirement: "オープン戦の確認済みデータを準備中です。" },
  matchup: { title: "MATCHUP", detail: "打者と投手の対戦を、実際の記録から。", tabs: ["対戦成績", "選手比較"], requirement: "NPBの実対戦記録が利用可能になり次第、接続します。同じ試合に出場しただけでは対戦扱いしません。" },
  watch: { title: "WATCH", detail: "試合と選手の情報を、観戦のおともに。", tabs: ["試合", "選手の見どころ"], requirement: "利用可能なデータの範囲で観戦用の画面を準備中です。現時点でライブ情報は提供していません。" },
  career: { title: "キャリア", detail: "過去シーズンをたどり、選手の歩みを見る。", tabs: ["シーズン履歴", "収録期間合計"], requirement: "過去シーズンの確認済みデータを準備中です。収録期間を明示して表示します。" },
  advanced: { title: "対戦・高度分析", detail: "いつ、誰と、どんな場面で。記録のもう一歩先へ。", tabs: ["Direct BvP", "状況別"], requirement: "検証済みの打席・状況データが利用可能になり次第、接続します。" },
} as const;
export type FutureSection = keyof typeof futureSections;
