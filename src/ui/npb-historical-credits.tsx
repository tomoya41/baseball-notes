import type { NpbHistoricalDataset } from "../domain/npb-historical";

export function HistoricalCredits({data,playerId}:{data:Pick<NpbHistoricalDataset,"players">;playerId:string}) {
  const p=data.players.find(p=>p.playerId===playerId)!;
  return <small><a href={`https://ja.wikipedia.org/w/index.php?title=${encodeURIComponent(p.article)}&oldid=${p.revision}`} target="_blank" rel="noreferrer">Wikipedia「{p.article}」の執筆者</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a> · 原記事からの変更：年度表の抜粋・表記整理{p.sourceObservedAt&&` · 原本取得 ${p.sourceObservedAt.slice(0,10)}`}</small>;
}
