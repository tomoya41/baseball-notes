// Explicit, offline presentation-registry refresh. Never part of a collector or daily run.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { unzipSync } from "fflate";
import { parse } from "csv-parse/sync";
import { z } from "zod";
import { historicalId } from "../src/data/mlb-historical";

const cache = ".data/mlb-japanese-labels-sparql.json";
if (process.argv.includes("--fetch")) {
  // Verified Wikidata properties: P6976 Retrosheet person ID, P3541 MLB.com player ID.
  const query = `SELECT ?p ?ja ?retro ?mlbam WHERE {
    ?p <http://www.w3.org/2000/01/rdf-schema#label> ?ja. FILTER(LANG(?ja)="ja")
    { ?p <http://www.wikidata.org/prop/direct/P6976> ?retro }
    UNION { ?p <http://www.wikidata.org/prop/direct/P3541> ?mlbam }
  }`;
  const response = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`, {
    headers: { "User-Agent": "BaseballNotes/1.0 (Japanese labels; https://github.com/tomoya41/baseball-notes)",
      Accept: "application/sparql-results+json" }, signal: AbortSignal.timeout(50000),
  });
  if (!response.ok) throw new Error(`Wikidata labels unavailable: ${response.status}`);
  await mkdir(".data", { recursive: true });
  await writeFile(cache, await response.text());
}
const field = z.object({ value: z.string().min(1) });
const raw = z.object({ results: z.object({ bindings: z.array(z.object({
  p: z.object({ value: z.string().regex(/^http:\/\/www\.wikidata\.org\/entity\/Q\d+$/) }),
  ja: field.extend({ "xml:lang": z.literal("ja") }),
  retro: field.optional(),
  mlbam: field.optional(),
})).min(1) }) }).parse(JSON.parse(await readFile(cache, "utf8")));
const labels = new Map<string, { name: string; entity: string }[]>();
for (const row of raw.results.bindings) {
  const name = row.ja.value.replace(/\s*[（(][^()（）]*[）)]$/, "").trim();
  if (!/[ァ-ヶ]/.test(name) || /[\p{Script=Han}]/u.test(name)) continue;
  for (const [kind, id] of [["retro", row.retro?.value], ["mlbam", row.mlbam?.value]]) if (id) {
    const key = `${kind}:${id}`;
    labels.set(key, [...(labels.get(key) ?? []), { name, entity: row.p.value.split("/").at(-1)! }]);
  }
}
const japanese: Record<string, string> = {
  "Shohei Ohtani": "大谷翔平", "Yu Darvish": "ダルビッシュ有", "Seiya Suzuki": "鈴木誠也",
  "Yoshinobu Yamamoto": "山本由伸", "Shota Imanaga": "今永昇太", "Roki Sasaki": "佐々木朗希",
  "Masataka Yoshida": "吉田正尚", "Kodai Senga": "千賀滉大", "Yusei Kikuchi": "菊池雄星",
  "Yuki Matsui": "松井裕樹", "Kenta Maeda": "前田健太", "Tomoyuki Sugano": "菅野智之",
  "Shinnosuke Ogasawara": "小笠原慎之介", "Masahiro Tanaka": "田中将大", "Shogo Akiyama": "秋山翔吾",
  "Yoshitomo Tsutsugo": "筒香嘉智", "Shun Yamaguchi": "山口俊", "Yoshihisa Hirano": "平野佳寿",
  "Gosuke Katoh": "加藤豪将", "Yoshi Tsutsugo": "筒香嘉智", "Kohei Arihara": "有原航平", "Hirokazu Sawamura": "澤村拓一",
  "Naoyuki Uwasawa": "上沢直之", "Koudai Senga": "千賀滉大", "Shintaro Fujinami": "藤浪晋太郎",
};
// Display spelling only, applied after the exact Register identity has been established.
const familiar: Record<string, string> = {
  "Aaron Judge": "アーロン・ジャッジ", "Mike Trout": "マイク・トラウト", "Mookie Betts": "ムーキー・ベッツ",
  "Freddie Freeman": "フレディ・フリーマン", "Framber Valdez": "フランバー・バルデス",
  "Pete Alonso": "ピート・アロンソ", "Junior Caminero": "ジュニア・カミネロ",
  "DJ LeMahieu": "DJ・ルメイヒュー", "Eugenio Suarez": "エウヘニオ・スアレス",
  "Juan Soto": "フアン・ソト", "Ronald Acuna Jr.": "ロナルド・アクーニャ・ジュニア",
  "Vladimir Guerrero Jr.": "ブラディミール・ゲレーロ・ジュニア", "Fernando Tatis Jr.": "フェルナンド・タティス・ジュニア",
  "Lars Nootbaar": "ラーズ・ヌートバー", "Ha-Seong Kim": "キム・ハソン", "Hyun Jin Ryu": "リュ・ヒョンジン",
  "Jung Hoo Lee": "イ・ジョンフ", "Ji-Man Choi": "チェ・ジマン", "Shin-Soo Choo": "チュ・シンス",
  "Ji Man Choi": "チェ・ジマン", "Kwang Hyun Kim": "キム・グァンヒョン", "Hyeon-Jong Yang": "ヤン・ヒョンジョン",
  "Hyeseong Kim": "キム・ヘソン", "Hoy Park": "パク・ヒョジュン", "Yu Chang": "チャン・ユーチェン",
  "Tzu-Wei Lin": "リン・ズーウェイ", "Kai-Wei Teng": "テン・カイウェイ", "Tsung-Che Cheng": "チェン・ゾンジェ",
};
const index = JSON.parse(await readFile(".data/mlb-public/data/mlb/historical/players/index.json", "utf8")) as {
  players: { id: string; name: string }[] };
const players = new Map(index.players.map(player => [player.id, player]));
const entries = unzipSync(await readFile(".data/chadwick-register.zip"), {
  filter: file => /\/data\/people-[0-9a-f]\.csv$/.test(file.name),
});
if (Object.keys(entries).length !== 16) throw new Error("Incomplete Chadwick Register");
const output: Record<string, { en: string; ja: string; evidence: string }> = {};
const ambiguous: string[] = [];
for (const content of Object.values(entries)) for (const row of parse(content, { columns: true }) as Record<string, string>[]) {
  const id = historicalId("player", `chadwick:${row.key_uuid}`);
  const player = players.get(id);
  if (!player) continue;
  const candidates = [...(labels.get(`retro:${row.key_retro}`) ?? []), ...(labels.get(`mlbam:${row.key_mlbam}`) ?? [])];
  const entities = new Set(candidates.map(candidate => candidate.entity));
  if (entities.size > 1) { ambiguous.push(id); continue; }
  if (row.key_wikidata && entities.size && !entities.has(row.key_wikidata)) { ambiguous.push(id); continue; }
  const override = japanese[player.name] ?? familiar[player.name];
  const selected = candidates[0];
  if (override || selected) output[id] = { en: player.name, ja: override ?? selected!.name,
    evidence: override ? "editorial" : `https://www.wikidata.org/wiki/${selected!.entity}` };
}
const manifest = JSON.parse(await readFile(".data/mlb-public/data/mlb/historical/manifest.json", "utf8")) as {
  teams: { id: string; name: string }[] };
const teamNames: Record<string, string> = {
  "Los Angeles Angels": "ロサンゼルス・エンゼルス", "Arizona Diamondbacks": "アリゾナ・ダイヤモンドバックス",
  Athletics: "アスレチックス", "Atlanta Braves": "アトランタ・ブレーブス", "Baltimore Orioles": "ボルティモア・オリオールズ",
  "Boston Red Sox": "ボストン・レッドソックス", "Chicago White Sox": "シカゴ・ホワイトソックス", "Chicago Cubs": "シカゴ・カブス",
  "Cincinnati Reds": "シンシナティ・レッズ", "Cleveland Guardians": "クリーブランド・ガーディアンズ",
  "Colorado Rockies": "コロラド・ロッキーズ", "Detroit Tigers": "デトロイト・タイガース", "Houston Astros": "ヒューストン・アストロズ",
  "Kansas City Royals": "カンザスシティ・ロイヤルズ", "Los Angeles Dodgers": "ロサンゼルス・ドジャース", "Miami Marlins": "マイアミ・マーリンズ",
  "Milwaukee Brewers": "ミルウォーキー・ブルワーズ", "Minnesota Twins": "ミネソタ・ツインズ", "New York Yankees": "ニューヨーク・ヤンキース",
  "New York Mets": "ニューヨーク・メッツ", "Philadelphia Phillies": "フィラデルフィア・フィリーズ", "Pittsburgh Pirates": "ピッツバーグ・パイレーツ",
  "San Diego Padres": "サンディエゴ・パドレス", "Seattle Mariners": "シアトル・マリナーズ", "San Francisco Giants": "サンフランシスコ・ジャイアンツ",
  "St Louis Cardinals": "セントルイス・カージナルス", "Tampa Bay Rays": "タンパベイ・レイズ", "Texas Rangers": "テキサス・レンジャーズ",
  "Toronto Blue Jays": "トロント・ブルージェイズ", "Washington Nationals": "ワシントン・ナショナルズ",
};
const teams = Object.fromEntries(manifest.teams.map(team => {
  if (!teamNames[team.name]) throw new Error(`Unreviewed team name: ${team.name}`);
  return [team.id, teamNames[team.name]];
}));
await writeFile("src/data/mlb-japanese-names.json", `${JSON.stringify({
  accessedDate: "2026-09-30", license: "CC0-1.0", players: Object.fromEntries(Object.entries(output).sort()), teams,
}, null, 2)}\n`);
console.log(JSON.stringify({ total: players.size, localized: Object.keys(output).length, teams: Object.keys(teams).length,
  unresolved: index.players.filter(player => !output[player.id]).map(player => ({ id: player.id, name: player.name })), ambiguous }, null, 2));
