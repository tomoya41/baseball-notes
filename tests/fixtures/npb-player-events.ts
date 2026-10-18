import { parseWikipediaPlayerEvents } from "../../src/infrastructure/providers/wikipedia-npb-player-events";
// Synthetic people/claims only. Never exported as public baseball data.
export const eventPerson = { playerId: "11111111-1111-4111-8111-111111111111", name: "架空太郎", article: "架空太郎", wikidataId: "Q100000001", npbId: "99999991", identityRevision: 100 };
export const otherEventPerson = { ...eventPerson, playerId: "22222222-2222-4222-8222-222222222222", name: "架空次郎", article: "架空次郎", wikidataId: "Q100000002", npbId: "99999992" };
export const citation = "<ref>synthetic evidence, not a real announcement</ref>";
export const retirement = `** 阪神タイガースは、[[架空太郎]]の今季限りでの現役引退を発表${citation}。`;
export function eventPage(body: string, revision = 200) { return { pageid: 5145794, title: "2026年の日本プロ野球", revisions: [{ revid: revision, timestamp: "2026-10-18T00:00:00Z", slots: { main: { content: `== できごと ==\n=== 9月 ===\n* [[9月28日|28日]]\n${body}\n== 成績 ==\n` } } }] }; }
export function eventFixture() { return parseWikipediaPlayerEvents(eventPage(retirement), "2026-10-19T00:00:00Z", [eventPerson], "a".repeat(64)).dataset; }
