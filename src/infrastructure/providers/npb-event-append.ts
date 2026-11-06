import { z } from "zod";
import { npbPlayerEventId } from "../../domain/npb-event-query";
import { citedOffseasonEventTransformation, npbPlayerEventsSchema, type NpbPlayerEvents } from "../../domain/npb-player-events";

const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const eventAppendReviewSchema = z.strictObject({
  previousBodySha256: digest,
  sourceContentSha256: digest,
  identityInputSha256: digest,
  additions: z.array(z.strictObject({ id: z.string().regex(npbPlayerEventId), statementSha256: digest })).min(1).max(30),
});

/** Corrections and omissions stay in the candidate audit. Copy only explicit additions. */
export function appendReviewedNpbEvents(previous: NpbPlayerEvents, candidate: NpbPlayerEvents, input: unknown) {
  const review = eventAppendReviewSchema.parse(input);
  if (candidate.retainedSources || candidate.source.revision <= previous.source.revision ||
    Date.parse(candidate.observedAt) < Date.parse(previous.observedAt) ||
    candidate.source.contentSha256 !== review.sourceContentSha256 ||
    candidate.identityInputSha256 !== review.identityInputSha256) throw Error("Unreviewed or regressed event append source");

  const oldIds = new Set(previous.events.map(e => e.id));
  const candidates = new Map(candidate.events.map(e => [e.id, e]));
  const additions = review.additions.map(({ id, statementSha256 }) => {
    const event = candidates.get(id);
    if (oldIds.has(id) || event?.statementSha256 !== statementSha256) throw Error("Reviewed event must be a new matching observation");
    oldIds.add(id);
    return event;
  });
  const used = new Set(additions.map(e => e.playerId));
  const players = new Map(previous.players.map(p => [p.playerId, p]));
  for (const player of candidate.players.filter(p => used.has(p.playerId))) {
    const existing = players.get(player.playerId);
    if (existing && JSON.stringify(existing) !== JSON.stringify(player)) throw Error("Existing event identity requires separate correction review");
    players.set(player.playerId, player);
  }
  return npbPlayerEventsSchema.parse({
    ...candidate,
    retainedSources: [...previous.retainedSources ?? [], previous.source],
    players: [...players.values()],
    events: [...previous.events, ...additions].sort((a, b) => b.recordedDate.localeCompare(a.recordedDate) || a.id.localeCompare(b.id)),
    transformation: citedOffseasonEventTransformation,
  });
}
