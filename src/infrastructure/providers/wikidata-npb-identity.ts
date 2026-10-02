import { z } from "zod";
import type { NpbPlayerDirectory } from "../../domain/npb-player-directory";

export const wikidataNpbTeams: Readonly<Record<string, string>> = {
  Q127635: "npb:team:tigers", Q1197407: "npb:team:giants", Q1194023: "npb:team:baystars",
  Q209961: "npb:team:dragons", Q247577: "npb:team:carp", Q1324392: "npb:team:swallows",
  Q129164: "npb:team:hawks", Q974277: "npb:team:fighters", Q1328038: "npb:team:buffaloes",
  Q1375077: "npb:team:eagles", Q325819: "npb:team:lions", Q484151: "npb:team:marines",
};
const binding = z.object({ value: z.string() });
const indexSchema = z.object({ results: z.object({ bindings: z.array(z.object({
  item: binding, npb: binding, name: binding, team: binding,
})) }) });
// Punctuation between identical Japanese name components is typographic, not surname matching.
const normalize = (value: string) => value.normalize("NFKC").replace(/[\s\u3000・]+/g, "").toLocaleLowerCase("ja-JP");
const qid = (uri: string) => /^https?:\/\/www\.wikidata\.org\/entity\/(Q\d+)$/.exec(uri)?.[1];

// Candidate discovery is not approval. Approval additionally verifies actual entity
// claims and rejects contradictory known identity fields before a registry can be built.
export function discoverNpbIdentityCandidates(raw: unknown, directory: NpbPlayerDirectory) {
  const rows = indexSchema.parse(raw).results.bindings;
  return directory.players.map(player => {
    const matches = rows.filter(row => normalize(row.name.value) === normalize(player.displayName)
      && wikidataNpbTeams[qid(row.team.value) ?? ""] === player.teamId && /^\d{8}$/.test(row.npb.value)
      && qid(row.item.value));
    const identities = [...new Set(matches.map(row => `${qid(row.item.value)}:${row.npb.value}`))];
    return { playerId: player.playerId, displayName: player.displayName, teamId: player.teamId,
      status: identities.length === 1 ? "candidate" : identities.length ? "ambiguous" : "unmatched",
      candidates: identities.map(key => {
        const [wikidataId, npbId] = key.split(":") as [string, string];
        return { wikidataId, npbId, registeredNames: [...new Set(matches.filter(row => qid(row.item.value) === wikidataId
          && row.npb.value === npbId).map(row => row.name.value))], sourceTeamIds: [...new Set(matches.filter(row =>
          qid(row.item.value) === wikidataId && row.npb.value === npbId).map(row => qid(row.team.value)!))] };
      }),
    };
  });
}

const entitySchema = z.object({ id: z.string().optional(), lastrevid: z.number().int().optional(),
  labels: z.record(z.string(), z.object({ value: z.string() })),
  aliases: z.record(z.string(), z.array(z.object({ value: z.string() }))),
  claims: z.record(z.string(), z.array(z.object({ rank: z.string().optional(), mainsnak: z.object({
    datavalue: z.object({ value: z.unknown() }).optional(),
  }) }))),
});
export function verifyNpbIdentityCandidate(candidate: ReturnType<typeof discoverNpbIdentityCandidates>[number], rawEntity: unknown,
  player: NpbPlayerDirectory["players"][number]) {
  if (candidate.status !== "candidate" || candidate.playerId !== player.playerId) return { approved: false, reason: "identity_ambiguous" } as const;
  const entity = entitySchema.parse(rawEntity), match = candidate.candidates[0]!;
  const values = (property: string) => (entity.claims[property] ?? []).filter(c => c.rank !== "deprecated").map(c => c.mainsnak.datavalue?.value);
  const names = [entity.labels.ja?.value, ...(entity.aliases.ja ?? []).map(a => a.value)].filter((v): v is string => !!v);
  const teams = values("P54").flatMap(v => z.object({ id: z.string() }).safeParse(v).data?.id ?? []);
  const ids = [...new Set(values("P4260"))];
  if ((entity.id !== undefined && entity.id !== match.wikidataId) || ids.length !== 1 || ids[0] !== match.npbId || !names.some(n => normalize(n) === normalize(player.displayName))
    || !teams.some(team => wikidataNpbTeams[team] === player.teamId))
    return { approved: false, reason: "identity_evidence_changed_or_insufficient" } as const;
  const births = values("P569").flatMap(v => {
    const value = z.object({ time: z.string(), precision: z.number() }).safeParse(v).data;
    return value?.precision === 11 ? /^\+(\d{4}-\d{2}-\d{2})T/.exec(value.time)?.[1] ?? [] : [];
  });
  if (player.birthDate && births.some(birth => birth !== player.birthDate))
    return { approved: false, reason: "known_birth_date_conflict" } as const;
  return { approved: true, reason: "exact_registered_name_and_canonical_team_with_unique_npb_identifier",
    sourceRevision: entity.lastrevid ?? null } as const;
}
