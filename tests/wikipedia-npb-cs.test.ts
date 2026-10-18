import { expect, it } from "vitest";
import { parseWikipediaCs } from "../src/infrastructure/providers/wikipedia-npb-cs";
const id = "00000000-0000-4000-8000-000000000001";
const template = `=== ファーストステージ ===
==== 第1戦 ====
{{Linescore
|Road=日本ハム|Home=西武|Date=10月10日|RR=1|HR=0|RH=1|HH=0|WP=架空投手
|R1=1|R2=0|R3=0|R4=0|R5=0|R6=0|R7=0|R8=0|R9=0
|H1=0|H2=0|H3=0|H4=0|H5=0|H6=0|H7=0|H8=0|H9=0
|Note2=試合時間：3時間1分}}
{| class="wikitable"
!colspan="12"|日本ハム
|-
!colspan="2"|選<br/>手!!投球回!!投球数!!打者!!被安打!!被本塁打!!奪三振!!与四死球!!失点!!自責点
|-
|勝||[[架空投手]]||9||110||28||0||0||10||1||0||0
|}
`;
const page = (content = template) => ({ pageid: 5301694, title: "2026年のパシフィック・リーグクライマックスシリーズ", revisions: [{ revid: 123, timestamp: "2026-10-15T00:00:00Z", slots: { main: { content } } }] });
const parse = (content = template) => parseWikipediaCs(page(content), "2026-10-16T00:00:00Z", [{ playerId: id, article: "架空投手" }]);
it("accepts an explicitly observed final but never splits combined walks and HBP", () => {
  const result = parse(); expect(result.games).toHaveLength(1); expect(result.observations).toHaveLength(1);
  const row = result.observations[0]!.aggregate;
  expect(row.playerId).toBe(id); expect(row.scope.stage).toBe("npb_cs_first"); expect(row.metrics.outsRecorded).toBe(27);
  expect(row.metrics.SO).toBe(10); expect(row.metrics.BB).toBeNull(); expect(row.metrics.HBP).toBeNull(); expect(row.metrics.WHIP).toBeNull();
  expect(row.metrics.ERA).toBe(0); expect(row.metrics.W).toBe(1);
});
it("preserves blank vs explicit zero and never merges a plain name", () => {
  const blank = parse(template.replace("||0||0||10||1", "|| ||0||10||1"));
  expect(blank.observations[0]?.aggregate.metrics.H).toBeNull(); expect(blank.observations[0]?.aggregate.metrics.HR).toBe(0);
  const unlinked = parse(template.replace("[[架空投手]]", "架空投手")); expect(unlinked.observations).toHaveLength(0); expect(unlinked.issues[0]?.reason).toBe("unverified_article_identity");
});
it.each([
  template.replace("試合時間：3時間1分", "試合時間：時間分"),
  template.replace("10月10日", "10月17日"),
  template.replace("|R1=1", "|R1=0"),
  template.replace("|Road=日本ハム", "|Road=不明球団"),
  template.replace("|R2=0", "|R10=0"),
  template.replace("|R1=1", "|R1=1X"),
  `<!--${template}-->`,
])("rejects future/placeholders/comments/unknown teams and inconsistent innings", content => { expect(parse(content).games).toHaveLength(0); });
it("does not read unreviewed columns or convert baseball IP into decimal", () => {
  expect(parse(template.replace("||9||110", "||0.1||110")).observations[0]?.aggregate.metrics.outsRecorded).toBe(1);
  expect(parse(template.replace("||9||110", "||0.3||110")).observations).toHaveLength(0);
  expect(parse(template.replace("!!与四死球", "!!与四球")).observations).toHaveLength(0);
});
it("requires exact article identity and does not accept duplicated source fields", () => {
  expect(() => parseWikipediaCs({ ...page(), title: "wrong" }, "2026-10-16T00:00:00Z", [])).toThrow("Unreviewed");
  expect(() => parse(template.replace("|RR=1", "|RR=1|RR=2"))).toThrow("Duplicate");
});
it("reads an explicitly separated multiline pitching row without borrowing from a following row", () => {
  const oneLine = "|勝||[[架空投手]]||9||110||28||0||0||10||1||0||0";
  const multiline = oneLine.split("||").map((v, i) => i ? `|${v}` : v).join("\n");
  const parsed = parse(template.replace(oneLine, multiline));
  expect(parsed.observations).toEqual(parse().observations);
  const truncated = multiline.replace("\n|110", "");
  const separateUnknown = "\n|-\n| \n|別の未確認選手\n|0.1\n|3\n|1\n|0\n|0\n|1\n|0\n|0\n|0";
  const rejected = parse(template.replace(oneLine, truncated + separateUnknown));
  expect(rejected.observations).toHaveLength(0);
  expect(rejected.issues.some(i => i.reason === "unsupported_box_columns")).toBe(true);
});

it("resolves only a source-authored article reference in the same final Game, club and role", () => {
  const content=template.replace("[[架空投手]]", "先発").replace("|WP=架空投手", "|WP=架空投手|RSP=[[架空投手|先発]]（9回） - [[架空捕手]]");
  const result=parseWikipediaCs(page(content),"2026-10-16T00:00:00Z",[{playerId:id,article:"架空投手"}],{summaryReferences:true});
  expect(result.observations[0]?.aggregate.metrics.outsRecorded).toBe(27);
  expect(result.observations[0]?.identityReference).toEqual({field:"RSP",article:"架空投手",label:"先発"});
  expect(parse(content).observations).toHaveLength(0); // Legacy/default admission remains strict.
  const wrongClub=content.replace("|RSP=","|HSP=");
  expect(parseWikipediaCs(page(wrongClub),"2026-10-16T00:00:00Z",[{playerId:id,article:"架空投手"}],{summaryReferences:true}).observations).toHaveLength(0);
});
it.each([
  "[[架空投手|先発]]、[[別の投手|先発]] - [[架空捕手]]", // Unknown target poisons a duplicate alias.
  "先発 - [[架空捕手]]", // No article identity.
  "[[別の投手|先発]] - [[架空捕手]]", // No known canonical bridge.
  "[[架空捕手]] - [[架空投手|先発]]", // Catcher is not a pitcher reference.
  "[[架空投手|先発]]", // Battery boundary not independently clear.
])("does not accept ambiguous or wrong-role battery references: %s", summary=>{
  const content=template.replace("[[架空投手]]","先発").replace("|WP=架空投手",`|WP=架空投手|RSP=${summary}`);
  expect(parseWikipediaCs(page(content),"2026-10-16T00:00:00Z",[{playerId:id,article:"架空投手"}],{summaryReferences:true}).observations).toHaveLength(0);
});
it("never carries an alias into another Game or applies pitcher references to a batter",()=>{
  const first=template.replace("[[架空投手]]","先発").replace("|WP=架空投手","|WP=架空投手|RSP=[[架空投手|先発]] - 架空捕手");
  const next=template.replace("10月10日","10月11日").replace("[[架空投手]]","先発");
  const r=parseWikipediaCs(page(first+next),"2026-10-16T00:00:00Z",[{playerId:id,article:"架空投手"}],{summaryReferences:true});
  expect(r.games).toHaveLength(2);expect(r.observations).toHaveLength(1);
  expect(r.observations[0]?.gameId).toBe(r.games[0]?.id);
  const batting=first.replace(/!colspan="2"[^\n]+/,"!打順!!守備!!選手!!打数!!安打!!本塁打!!打点!!得点!!三振!!四死球!!犠打!!盗塁").replace("|勝||先発||9||110||28||0||0||10||1||0||0","|1||右||先発||1||1||0||1||1||0||0||0||0");
  expect(parseWikipediaCs(page(batting),"2026-10-16T00:00:00Z",[{playerId:id,article:"架空投手"}],{summaryReferences:true}).observations).toHaveLength(0);
});
