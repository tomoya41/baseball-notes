import { z } from "zod";
import type { PlayerProvider } from "../../application/ports";
import {
  catalogSchema,
  leagueSchema,
  timestampSchema,
} from "../../domain/models";
import type { League, PlayerCatalog, Statistics } from "../../domain/models";
import { ratio } from "../../domain/metrics";

const count = z.number().int().nonnegative();
const batting = z
  .object({
    ab: count,
    hits: count,
    hr: count,
    obp: z.number().min(0).max(1).nullable(),
    slg: z.number().min(0).max(4).nullable(),
    barrelRate: z.number().min(0).max(1).nullable(),
  })
  .refine((s) => s.hits <= s.ab && s.hr <= s.hits, "Invalid batting counts");
const pitching = z.object({ outs: count, earnedRuns: count });
export const sampleWireSchema = z.object({
  version: z.literal(1),
  league: leagueSchema,
  updated_at: timestampSchema,
  revision: z.string().min(1),
  clubs: z.array(
    z.object({ code: z.string().min(1), label: z.string().min(1) }),
  ),
  players: z.array(
    z.object({
      key: z.string().min(1),
      label: z.string().min(1),
      aliases: z.array(z.string()),
      club: z.string().nullable(),
      position: z.string().nullable(),
      bats: z.enum(["右", "左", "両"]).nullable(),
      throws: z.enum(["右", "左"]).nullable(),
      number: z.string().nullable(),
      batting: batting.nullable(),
      pitching: pitching.nullable(),
    }),
  ),
  season: z.number().int().min(1800).max(2200),
});

export function normalizeSample(input: unknown, league: League): PlayerCatalog {
  const wire = sampleWireSchema.parse(input);
  if (wire.league !== league) throw new Error("Unexpected league");
  const source = {
    providerId: "sample-v1",
    label: "同梱サンプル（架空）",
    kind: "sample" as const,
    license: "Project-authored synthetic data",
    revision: wire.revision,
    updatedAt: wire.updated_at,
  };
  const identity = (kind: string, key: string) =>
    `sample:${league}:${kind}:${key}`;
  const statistics: Statistics[] = [];
  for (const player of wire.players) {
    const base = {
      playerId: identity("player", player.key),
      league,
      season: wire.season,
      seasonType: "regular" as const,
      source,
    };
    if (player.batting) {
      const b = player.batting;
      statistics.push({
        ...base,
        group: "hitting",
        completeness:
          b.obp === null || b.slg === null || b.barrelRate === null
            ? "partial"
            : "complete",
        metrics: {
          avg: ratio(b.hits, b.ab),
          hr: { status: "available", value: b.hr },
          ops:
            b.obp === null || b.slg === null
              ? { status: "missing", reason: "出塁率または長打率が未提供です" }
              : { status: "available", value: b.obp + b.slg },
          barrelPct:
            league === "NPB"
              ? {
                  status: "unsupported",
                  reason: "このNPB提供元では計測データを扱っていません",
                }
              : b.barrelRate === null
                ? { status: "missing", reason: "計測値が届いていません" }
                : { status: "available", value: b.barrelRate },
        },
      });
    }
    if (player.pitching)
      statistics.push({
        ...base,
        group: "pitching",
        completeness: "complete",
        metrics: {
          era: ratio(player.pitching.earnedRuns * 27, player.pitching.outs),
          outs: { status: "available", value: player.pitching.outs },
        },
      });
  }
  return catalogSchema.parse({
    league,
    source,
    statistics,
    teams: wire.clubs.map((t) => ({
      id: identity("team", t.code),
      league,
      name: t.label,
    })),
    profiles: wire.players.map((p) => ({
      player: {
        id: identity("player", p.key),
        league,
        name: p.label,
        searchNames: p.aliases,
        teamId: p.club === null ? null : identity("team", p.club),
        position: p.position,
        sourceIds: { "sample-v1": p.key },
      },
      bats: p.bats,
      throws: p.throws,
      jersey: p.number,
    })),
  });
}

export class SampleProvider implements PlayerProvider {
  readonly id = "sample-v1";
  readonly policy = {
    cacheTtlMs: 12 * 60 * 60 * 1000,
    maxSourceAgeMs: 7 * 24 * 60 * 60 * 1000,
    allowPersistence: true,
  };
  constructor(
    private readonly request: typeof fetch = (input, init) =>
      fetch(input, init),
  ) {}
  async loadCatalog(
    league: League,
    signal: AbortSignal,
  ): Promise<PlayerCatalog> {
    const response = await this.request(
      `${import.meta.env.BASE_URL}data/${league.toLowerCase()}.json`,
      { signal },
    );
    if (!response.ok) throw new Error(`Provider HTTP ${response.status}`);
    const payload: unknown = await response.json();
    return normalizeSample(payload, league);
  }
}
