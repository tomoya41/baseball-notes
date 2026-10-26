const names: Record<string, string> = { giants: "巨人", tigers: "阪神", dragons: "中日", carp: "広島", swallows: "ヤクルト", baystars: "DeNA", hawks: "ソフトバンク", fighters: "日本ハム", lions: "西武", marines: "ロッテ", eagles: "楽天", buffaloes: "オリックス" };
export const npbTeamShortName = (id: string) => names[id.split(":").at(-1)!] ?? "球団未確認";
