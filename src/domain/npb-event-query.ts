export const playerEventKinds = ["trade", "signing", "retirement_announcement", "nonrenewal_notice", "release", "registration_change", "fa_declaration", "posting_application", "draft_selection", "contract_renewal"] as const;
export function npbEventQuery(params: URLSearchParams) {
  const kind = params.get("kind"), team = params.get("team"), player = params.get("player"), query = params.get("q") ?? "", follow = params.get("follow") === "1", rawPage = params.get("page") ?? "1";
  const valid = (!kind || playerEventKinds.includes(kind as typeof playerEventKinds[number])) && (!team || /^npb:team:(giants|tigers|dragons|carp|swallows|baystars|hawks|fighters|lions|marines|eagles|buffaloes)$/.test(team)) && (!player || /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(player)) && query.length <= 100 && /^[1-9]\d{0,2}$/.test(rawPage) && (!params.has("follow") || ["0", "1"].includes(params.get("follow")!)) && (!params.has("season") || params.get("season") === "2026");
  return { valid, kind, team, player, query, follow, requestedPage: Number(rawPage) };
}
