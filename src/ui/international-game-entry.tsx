import { useState } from "react";
import { internationalOfficialTournaments as tournaments } from "../data/international-official-links";

export function InternationalGameEntry({ expanded, onToggle }: { expanded?: boolean; onToggle?: (open: boolean) => void } = {}) {
  const [id, setId] = useState(tournaments[0]!.id);
  const tournament = tournaments.find(item => item.id === id) ?? tournaments[0]!;

  return <details className="advanced-disclosure" id="international-game-entry" data-international-entry open={expanded} onToggle={event => onToggle?.(event.currentTarget.open)}>
    <summary>侍ジャパン・国際試合</summary>
    <label className="weekly-stage">大会 <select value={tournament.id} onChange={event => setId(event.target.value)}>
      {tournaments.map(item => <option key={item.id} value={item.id}>{item.kind === "apbc" ? `APBC ${item.year}` : item.name}</option>)}
    </select></label>
    <div aria-live="polite">
      <h2>{tournament.name}</h2>
      {tournament.summary && <p>{tournament.summary}</p>}
      <p>アプリ未収録。日程・結果・代表選手は、公開されている公式情報で確認できます。</p>
      <div className="hub-links">{tournament.links.map(link => <a key={link.url} href={link.url}
        target="_blank" rel="noopener noreferrer">{link.label} ↗</a>)}</div>
    </div>
  </details>;
}
