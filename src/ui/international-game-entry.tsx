import { useState } from "react";
import { internationalOfficialTournaments as tournaments } from "../data/international-official-links";
import { internationalTeamNames, internationalRoundNames, japanResultsByTournament, resultLicense } from "../data/international-japan-results";

export function InternationalGameEntry({ expanded, onToggle }: { expanded?: boolean; onToggle?: (open: boolean) => void } = {}) {
  const [id, setId] = useState(tournaments[0]!.id);
  const tournament = tournaments.find(item => item.id === id) ?? tournaments[0]!;
  const edition = japanResultsByTournament.get(tournament.id);

  return <details className="advanced-disclosure" id="international-game-entry" data-international-entry open={expanded} onToggle={event => onToggle?.(event.currentTarget.open)}>
    <summary>侍ジャパン・国際試合</summary>
    <label className="weekly-stage">大会 <select value={tournament.id} onChange={event => setId(event.target.value)}>
      {tournaments.map(item => <option key={item.id} value={item.id}>{item.kind === "apbc" ? `APBC ${item.year}` : item.name}</option>)}
    </select></label>
    <div aria-live="polite">
      <h2>{tournament.name}</h2>
      {tournament.summary && <p>{tournament.summary}</p>}
      {edition ? <section aria-label="日本代表の試合結果">
        <h3>日本代表の結果 · {edition.games.length}試合</h3>
        <p className="inline-note">日付は現地時間。代表選手・個人成績は未収録です。</p>
        <ol className="row-list">{edition.games.map(game => <li key={game.id} className="player-row">
          <span className="player-row__body"><small><time dateTime={game.localDate!}>{game.localDate}</time> · {internationalRoundNames[game.round]}</small>
            <strong>{internationalTeamNames.get(game.awayTeamId!)} {game.result!.awayRuns} − {game.result!.homeRuns} {internationalTeamNames.get(game.homeTeamId!)}</strong></span>
        </li>)}</ol>
        <details className="source-note"><summary>収録範囲・出典</summary><p>日本戦の確定スコアを抜粋。左がビジター、右がホームです。
          英語版Wikipediaの執筆者による記録を翻訳・整形し、<a href={resultLicense}>CC BY-SA 4.0</a>で提供しています。</p>
          {edition.sources.map(source => <p key={source.id}><a href={source.url}>出典記事（版 {source.version}）</a></p>)}
        </details>
      </section> : <p>アプリ未収録。日程・結果・代表選手は、公開されている公式情報で確認できます。</p>}
      <div className="hub-links">{tournament.links.map(link => <a key={link.url} href={link.url}
        target="_blank" rel="noopener noreferrer">{link.label} ↗</a>)}</div>
    </div>
  </details>;
}
