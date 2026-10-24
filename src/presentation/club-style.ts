import type { CSSProperties } from "react";

// App-owned palette, not official colors. An explicit ID controls presentation;
// neither names nor this hash establish identity, history or affiliation.
const palette = ["#d4a656", "#5ba6db", "#d98072", "#71b8a0", "#b59aca", "#c2ba76"];
export function clubStyle(teamId: string | undefined): CSSProperties {
  if (!teamId) return {};
  let hash = 0;
  for (const ch of teamId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return { "--club-accent": palette[hash % palette.length] } as CSSProperties;
}
