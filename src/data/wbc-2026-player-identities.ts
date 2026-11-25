import { buildNpbInternationalIdentityEvidence, kanemaruNpbIdentityReview } from "./international-npb-player-identities";
import { premier122024IdentityEvidence, wbc2023IdentityEvidence } from "./historical-japan-player-identities";
import { wbc2026Selections } from "./wbc-2026-selections";

// Japanese Wikipedia contributors (CC BY-SA 4.0) and the Chadwick Register (ODC-BY 1.0).
// Only reviewed matches to the existing NPB Directory are included.
const reviewedPlayers = [
  // 種市篤暉
  [3692477, 111848132, "71275134", "6fdd24c0-42e5-4878-800f-e02351765b27",
    "cf464022-ddf4-497d-a0b3-f5c580ebb0a3", "895afacc49fa7ff619d8af3d77093e5591027d1cecfc5a2c1f07967579a16db8"],
  // 周東佑京
  [3700545, 111881968, "21925136", "fe02470d-7c15-4c03-8a17-d6d339445ebe",
    "a8e42bb7-47f9-4ef2-b1ab-e1f383b19550", "7028c1b8842d764d9de91b530f88401fb0694e2d4df413f8e259fb5944157ca3"],
  // 森下翔太
  [4037204, 111870052, "43145157", "92a02594-a4f7-498c-bb83-8a41855b4645",
    "7b61b097-9b73-4d41-93b9-af1a4464833e", "941b781b56c1d955dfe84f7ff3f45533016d01e984992e7644761dc70a70fb6a"],
  // 伊藤大海
  [4237529, 111748928, "51355153", "e894c7ec-cf2d-4000-98d4-4211c1a4b345",
    "8acd21a4-3d94-485c-b7a4-b7091b30c65d", "50cad8b398f5fad8676832cc72471bac686cbbbc44c049b24689c35f0ce7ed07"],
  // 隅田知一郎
  [4463322, 111640731, "21025155", "ce229d30-ea65-4e6f-ae6a-08a8ac6a624f",
    "a2e11691-1e04-42c7-b976-f5504b8cecf1", "00e841f3e92eb5387541e6ecfdc8857ef47d686b3bd2398655b614f7cbf05a47"],
] as const;
const reviewDate = "2026-11-24T13:06:00Z";

const additionalPlayers = [
  // 若月健矢
  [2959833, 111839744, "41645139", "0849d339-1434-46b4-9382-a748c1c797a0",
    "c95e5b8a-ad45-4520-961d-29e56ca0b701", "7ce907e6db50bb51310574364d3decc4318b5a24a2b93e5cc14aad56c0c1b4a0"],
  // 松本裕樹
  [3103993, 111511176, "61665130", "87a6fa52-0973-4575-940d-b89bee5cdf13",
    "653fa39f-5fc1-4041-ab58-28f10aec5889", "ef435b574739ca4d46fc90e45586c2eccd9c6378677427973b4ed56dc9dc8260"],
  // 坂本誠志郎
  [3327162, 111829561, "11915132", "2d760a27-b58a-47a5-80df-6b0aa3571ef5",
    "edbd139e-656b-461d-b3b6-756d6e060caa", "24d2d849ceb5a34707e8b4a1254a6649e012fa5b026a31250083722578e98d7f"],
  // 佐藤輝明
  [4237419, 111892846, "41045153", "a1ca7cac-f9be-4993-a78c-bcd1e1ae3399",
    "8fdcd710-2127-4b95-9bbe-678d87dc67ed", "ede0c6e43a8ffc95f0fff1b295081f0a21c82f1d9207e4298e128bee2c2c5372"],
  // 曽谷龍平
  [4667614, 111529791, "81985157", "feb0d3d8-adc6-4da3-91b8-bac1c5d12cac",
    "14f69d0e-da65-41c4-a22c-43a1f98bab6f", "7d8575969ca46b1c03b6230b2c0ab1556de9fb795a683ca04680c82ab0eebdd5"],
] as const;
const additionalReviewDate = "2026-11-25T04:18:49Z";

const reviewedEvidence = buildNpbInternationalIdentityEvidence([
  ...reviewedPlayers.map(row => ({ row, reviewDate })),
  kanemaruNpbIdentityReview,
  ...additionalPlayers.map(row => ({ row, reviewDate: additionalReviewDate })),
]);

// Reuse matches reviewed for other editions when their fixed Japanese article ID is on this roster.
const rosterIds = new Set(wbc2026Selections.map(player => player.id));
const identities = new Map(reviewedEvidence.identities.map(row => [row.playerId, row]));
const sources = new Map(reviewedEvidence.sources.map(row => [row.id, row]));
for (const edition of [premier122024IdentityEvidence, wbc2023IdentityEvidence]) {
  for (const row of edition.identities) {
    if (!rosterIds.has(row.playerId)) continue;
    const prior = identities.get(row.playerId);
    if (prior) {
      if (prior.canonicalPlayerId !== row.canonicalPlayerId) throw new Error(`Conflicting NPB identity for ${row.playerId}`);
      continue;
    }
    identities.set(row.playerId, row);
    const sourceIds = [row.evidence.international.sourceRevisionId, row.evidence.canonical.sourceRevisionId];
    for (const source of edition.sources) {
      if (sourceIds.includes(source.id) && !sources.has(source.id)) sources.set(source.id, source);
    }
  }
}
export const wbc2026IdentityEvidence = { identities: [...identities.values()], sources: [...sources.values()] };
