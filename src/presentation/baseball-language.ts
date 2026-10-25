/** Display only: keep the source throws/bats fields and their meanings unchanged. */
export function formatThrowBat(throws: string | null | undefined, bats: string | null | undefined): string {
  const hands: Record<string,string> = { right: "右", left: "左", switch: "両", R: "右", L: "左", B: "両", "右": "右", "左": "左", "両": "両" };
  const hand = (value: string | null | undefined) => hands[value ?? ""];
  const throwing = hand(throws), batting = hand(bats);
  if (!throwing && !batting) return "投打未確認";
  return `${throwing ? `${throwing}投` : "投げる手未確認"}${throwing && batting ? "" : "・"}${batting ? `${batting}打` : "打席未確認"}`;
}

export const regularSeasonLabel = (league: string) => league === "NPB" ? "公式戦" : "レギュラーシーズン";
export function coverageLabel(status: string) { const labels: Record<string,string> = {complete:"収録完了",partial:"一部収録",unknown:"未確認",unavailable:"未収録",failed:"取得失敗",no_games:"試合なし"}; return labels[status] ?? "未確認"; }
export function readinessReasonLabel(reason: string) { const labels: Record<string,string> = { season_coverage_not_complete:"シーズン成績の収録が未完了です", qualifier_computation_requires_complete_coverage:"規定到達の判定に必要な成績を確認中です", qualifier_computation_pending:"規定到達の判定を確認中です", public_ranking_not_enabled:"ランキングは公開準備中です" }; return labels[reason] ?? "集計条件を確認中です"; }
