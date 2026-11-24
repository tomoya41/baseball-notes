import { buildNpbInternationalIdentityEvidence, kanemaruNpbIdentityReview } from "./international-npb-player-identities";

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

export const wbc2026IdentityEvidence = buildNpbInternationalIdentityEvidence([
  ...reviewedPlayers.map(row => ({ row, reviewDate })),
  kanemaruNpbIdentityReview,
]);
