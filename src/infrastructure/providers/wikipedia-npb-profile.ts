import { z } from "zod";
import type { NpbProfileBridge } from "./wikidata-npb-profile-supplement";
import { profileRegistrySchema, type ProfileRegistryEntry, type ProfileField } from "../../domain/npb-profile-registry";

const pageSchema = z.object({ title: z.string(), pageprops: z.object({ wikibase_item: z.string() }),
  revisions: z.array(z.object({ revid: z.number().int().positive(), timestamp: z.iso.datetime(),
    slots: z.object({ main: z.object({ content: z.string() }) }) })).min(1) });
// Parse only the named infobox and top-level parameters, never article prose/statistics/media.
export function baseballInfobox(text: string): Map<string, string> {
  const start = /\{\{Infobox baseball player\s*[\n|]/i.exec(text)?.index;
  if (start === undefined) throw Error("Baseball infobox unavailable");
  let depth = 0, links = 0, end = -1;
  const parts: string[] = []; let previous = start + 2;
  for (let i = start; i < text.length; i++) {
    if (text.slice(i, i + 2) === "{{") { depth++; i++; continue; }
    if (text.slice(i, i + 2) === "}}") { depth--; if (!depth) { parts.push(text.slice(previous, i)); end = i; break; } i++; continue; }
    if (text.slice(i, i + 2) === "[[") { links++; i++; continue; }
    if (text.slice(i, i + 2) === "]]") { links--; i++; continue; }
    if (text[i] === "|" && depth === 1 && links === 0) { parts.push(text.slice(previous, i)); previous = i + 1; }
  }
  if (end === -1) throw Error("Incomplete baseball infobox");
  const fields = new Map<string, string>();
  for (const part of parts.slice(1)) {
    const equal = part.indexOf("="); if (equal < 0) continue;
    const name = part.slice(0, equal).trim(), value = part.slice(equal + 1).trim();
    if (fields.has(name)) throw Error(`Duplicate infobox field: ${name}`);
    fields.set(name, value);
  }
  return fields;
}
export function infoboxPlainText(value: string) {
  const text = value.replace(/<!--[^]*?-->/g, "").replace(/<ref\b[^>]*>[^]*?<\/ref>/gi, "").replace(/<ref\b[^>]*\/\s*>/gi, "")
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, name: string, label?: string) => label ?? name).trim();
  return ["{", "}", "<", ">", "[", "]"].some(c => text.includes(c)) ? null : text;
}
const plain = infoboxPlainText;
export function readWikipediaNpbProfile(raw: unknown, bridge: NpbProfileBridge, observedAt: string) {
  const page = pageSchema.parse(raw);
  if (page.pageprops.wikibase_item !== bridge.wikidataId) throw Error("Wikipedia identity mismatch; no name-only matching");
  const revision = page.revisions[0]!, fields = baseballInfobox(revision.slots.main.content), entries: ProfileRegistryEntry[] = [];
  const add = (field: ProfileField, value: unknown) => {
    if (value == null) return;
    entries.push({ playerId: bridge.playerId, field, value, sourceName: `Wikipedia「${page.title}」の執筆者`,
      sourceUrl: `https://ja.wikipedia.org/w/index.php?title=${encodeURIComponent(page.title)}&oldid=${revision.revid}`,
      license: "CC-BY-SA-4.0", rightsEvidenceUrl: "https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use#7._Licensing_of_Content",
      publicReuseAllowed: true, verifiedAt: observedAt, effectiveFrom: null, effectiveTo: null, verificationStatus: "source_verified", reviewer: "Codex",
      verificationMethod: "automated", sourceRevision: revision.revid, observedAt,
      transformation: "Named infobox facts parsed and normalized; no prose, media or statistical tables",
      notes: "Infobox fact extracted/normalized. Derived values remain CC BY-SA 4.0; current jersey/roster, media, prose and stats excluded.", additionalSourceUrls: [] });
  };
  const number = (field: string) => { const value = plain(fields.get(field) ?? ""); return value && /^\d+(\.\d+)?$/.test(value) ? Number(value) : null; };
  add("heightCm", number("身長")); add("weightKg", number("体重"));
  const hands: Record<string, string> = { "右": "right", "左": "left", "両": "switch" };
  add("bats", hands[plain(fields.get("打席") ?? "") ?? ""] ?? null);
  const arm = plain(fields.get("利き腕") ?? ""); if (arm === "右" || arm === "左") add("throws", hands[arm]);
  const birth = /^\{\{生年月日と年齢\|(\d{4})\|(\d{1,2})\|(\d{1,2})\}\}$/.exec(fields.get("生年月日") ?? "");
  if (birth) add("birthDate", `${birth[1]}-${birth[2]!.padStart(2, "0")}-${birth[3]!.padStart(2, "0")}`);
  // 出身地 is not a guarantee of birthplace. Preserve its distinct meaning rather than overwriting P19.
  const place = plain(fields.get("出身地") ?? ""); if (place) add("originPlace", place);
  const country = plain(fields.get("国籍") ?? "");
  if (country && !/[,、/]/.test(country)) add("nationality", country);
  const year = /^\{\{NPBドラフト\|(\d{4})\}\}$/.exec(fields.get("プロ入り年度") ?? "")?.[1];
  if (year) {
    add("draftYear", Number(year)); const round = plain(fields.get("ドラフト順位") ?? "");
    if (round && /^(育成選手)?ドラフト\d+位$/.test(round)) add("draftRound", round.replace("育成選手ドラフト", "育成").replace("ドラフト", ""));
    if (round && /^(育成選手)?ドラフト\d+位$/.test(round)) add("draftType", round.startsWith("育成") ? "developmental" : "regular");
  }
  const debut = /^(\d{4})年\d{1,2}月\d{1,2}日$/.exec(plain(fields.get("初出場") ?? "") ?? "")?.[1];
  if (debut) add("debutYear", Number(debut));
  // Only an explicit NPB label establishes NPB debut; generic 初出場 can mean MLB/overseas debut.
  const npbDebut = /(?:\(NPB\)|（NPB）|日本プロ野球|日本野球機構)/.test(plain(fields.get("初出場") ?? "") ?? "")
    ? /(?:^|\s)(\d{4})年\d{1,2}月\d{1,2}日/.exec(plain(fields.get("初出場") ?? "") ?? "")?.[1] : null;
  if (npbDebut) add("npbDebutYear", Number(npbDebut));
  // Separate school/industry context from P69 educated-at and professional membership.
  // Only bullet-list atoms with explicit category suffixes are accepted. No prose is copied.
  const amateur = (fields.get("経歴") ?? "").split(/\r?\n/).flatMap(line => {
    const match = /^\s*\*\s*(.+)$/.exec(line); if (!match) return [];
    const name = plain(match[1]!); if (!name || /[()（）]/.test(name)) return [];
    const category = /(?:高等学校|高校)$/.test(name) ? "high_school" : /大学$/.test(name) ? "university" : null;
    return category ? [{ name, category, from: null, to: null }] : [];
  });
  if (amateur.length) add("amateurHistory", amateur);
  const position = plain(fields.get("守備位置") ?? "");
  const positions: Record<string, string> = { "投手": "P", "捕手": "C", "一塁手": "1B", "二塁手": "2B", "三塁手": "3B", "遊撃手": "SS", "左翼手": "LF", "中堅手": "CF", "右翼手": "RF", "外野手": "OF", "指名打者": "DH" };
  if (position && positions[position]) add("position", positions[position]);
  // More complex/multiple positions retain the unambiguous source list without a primary-position inference.
  if (position) { const list = position.split(/[、・,]/).flatMap(v => v.split("/")).map(v => v.trim()).filter(Boolean);
    if (list.length && list.every(v => positions[v] || v === "内野手")) add("knownPositions", list); }
  return profileRegistrySchema.parse({ schemaVersion: 1, observedAt, entries });
}
