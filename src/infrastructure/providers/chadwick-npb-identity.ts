import { z } from "zod";
import type { NpbProfileBridge } from "./wikidata-npb-profile-supplement";

const row = z.object({ key_uuid: z.uuid(), key_npb: z.string(), key_wikidata: z.string(),
  key_mlbam: z.string(), key_retro: z.string(), key_bbref: z.string(), key_fangraphs: z.string(),
  birth_year: z.string(), birth_month: z.string(), birth_day: z.string() });

// Join exact external IDs only. Neither a name nor an ID authorizes another site's data.
export function linkChadwickNpb(raw: unknown, bridges: readonly NpbProfileBridge[]) {
  const rows = z.array(row).parse(raw);
  return bridges.map(b => {
    const matches = rows.filter(r => r.key_npb === b.npbId);
    if (matches.length !== 1) return { bridge: b, approved: false as const, reason: "ambiguous_or_missing_npb_id" };
    const r = matches[0]!;
    if (rows.filter(v => v.key_uuid === r.key_uuid).length !== 1 || (r.key_wikidata && r.key_wikidata !== b.wikidataId))
      return { bridge: b, approved: false as const, reason: "cross_reference_conflict" };
    const date = [r.birth_year, r.birth_month.padStart(2, "0"), r.birth_day.padStart(2, "0")].join("-");
    return { bridge: b, approved: true as const, chadwickId: r.key_uuid,
      birthDate: z.iso.date().safeParse(date).data ?? null,
      externalIds: { retrosheet: r.key_retro || null, mlbam: r.key_mlbam || null,
        baseballReference: r.key_bbref || null, fangraphs: r.key_fangraphs || null } };
  });
}
