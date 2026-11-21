import { internationalOfficialTournaments as tournaments } from "../data/international-official-links";
import { internationalTeamNames, internationalRoundNames, japanResultsByTournament, resultLicense } from "../data/international-japan-results";
import { apbcSelections } from "../data/apbc-2026-selections";
import { wbc2023JapanStatsRevision, wbc2023JapanStatsVerification } from "../data/wbc-2023-japan-stats";
import { metrics, ratio } from "../domain/metrics";
import { formatMetric } from "../presentation/formatters";

export function InternationalGameEntry({ expanded, onToggle, selected, onSelect }: {
  expanded: boolean;
  onToggle: (open: boolean) => void;
  selected: (typeof tournaments)[number] | undefined;
  onSelect: (id: string) => void;
}) {
  const tournament = selected ?? tournaments[0]!;
  const edition = japanResultsByTournament.get(tournament.id);
  const batting = edition?.playerStats.filter(row => row.role === "batting") ?? [];
  const pitching = edition?.playerStats.filter(row => row.role === "pitching") ?? [];
  const statsCoverage = edition?.coverage.playerStats;

  return <details className="advanced-disclosure" id="international-game-entry" data-international-entry open={expanded} onToggle={event => onToggle(event.currentTarget.open)}>
    <summary>侍ジャパン・国際試合</summary>
    <label className="weekly-stage">大会 <select value={tournament.id} onChange={event => onSelect(event.target.value)}>
      {tournaments.map(item => <option key={item.id} value={item.id}>{item.kind === "apbc" ? `APBC ${item.year}` : item.name}</option>)}
    </select></label>
    <div aria-live="polite">
      <h2>{tournament.name}</h2>
      {tournament.summary && <p>{tournament.summary}</p>}
      {edition ? <section aria-label="日本代表の試合結果">
        <h3>日本代表の結果 · {edition.games.length}試合</h3>
        <p className="inline-note">日付は現地時間。{edition.playerStats.length ? "成績は大会通算です。" :
          edition.participation.length ? "個人成績は未収録です。" : "代表選手・個人成績は未収録です。"}</p>
        <ol className="row-list">{edition.games.map(game => <li key={game.id} className="player-row">
          <span className="player-row__body"><small><time dateTime={game.localDate!}>{game.localDate}</time> · {internationalRoundNames[game.round]}</small>
            <strong>{internationalTeamNames.get(game.awayTeamId!)} {game.result!.awayRuns} − {game.result!.homeRuns} {internationalTeamNames.get(game.homeTeamId!)}</strong></span>
        </li>)}</ol>
        {batting.length > 0 && <details className="advanced-disclosure">
          <summary>打撃成績 · {batting.length}人</summary>
          <ul className="row-list">{batting.map(row => <li key={row.playerId} className="player-row">
            <span className="player-row__body"><strong>{row.name}</strong>
              <small>打率 {formatMetric(ratio(row.hits, row.atBats), metrics.avg!)} · {row.atBats}打数{row.hits}安打</small>
              <small>{row.gamesPlayed}試合 · {row.homeRuns}本塁打 · {row.runsBattedIn}打点</small>
            </span>
          </li>)}</ul>
        </details>}
        {pitching.length > 0 && <details className="advanced-disclosure">
          <summary>投球成績 · {pitching.length}人</summary>
          <ul className="row-list">{pitching.map(row => <li key={row.playerId} className="player-row">
            <span className="player-row__body"><strong>{row.name}</strong>
              <small>防御率 {formatMetric(ratio(row.earnedRuns * 27, row.outs), metrics.era!)} · {formatMetric(ratio(row.outs, 1), metrics.outs!)}</small>
              <small>{row.gamesPlayed}登板 · {row.strikeouts === null ? "奪三振は未収録" : `${row.strikeouts}奪三振`}</small>
            </span>
          </li>)}</ul>
        </details>}
        {edition.participation.length > 0 && <details className="advanced-disclosure"><summary>代表に選ばれた選手 · {edition.participation.length}人</summary>
          <p className="inline-note">10月7日発表。大会での登録・出場は未確認です。</p>
          {["投手", "捕手", "内野手", "外野手"].map(position => <div key={position}><h4>{position}</h4>
            <p>{apbcSelections.filter(player => player.position === position).map(player => player.name).join("、")}</p></div>)}
        </details>}
        <details className="source-note"><summary>収録範囲・出典</summary><p>日本戦の確定スコアを抜粋。左がビジター、右がホームです。
          Wikipediaの執筆者による記録を抜粋・翻訳・整形し、<a href={resultLicense}>CC BY-SA 4.0</a>で提供しています。</p>
          {statsCoverage?.status === "partial" && <p>日本代表の大会通算成績から打撃・投球の一部指標を収録。試合ごとの出場記録は未収録です。
            {statsCoverage.source.sourceRevisionId === wbc2023JapanStatsRevision && <> WBC公式の
              <a href={wbc2023JapanStatsVerification.batting}>打撃成績</a>・<a href={wbc2023JapanStatsVerification.pitching}>投球成績</a>でも確認できます。</>}
          </p>}
          {edition.sources.map(source => <p key={source.id}><a href={source.url}>{
            statsCoverage?.status === "partial" && statsCoverage.source.sourceRevisionId === source.id ? "日本語版の大会通算成績" :
              source.sourceId === "jawiki" ? "日本語版の代表選手" : "英語版の試合結果"
          }（版 {source.version}）</a></p>)}
        </details>
      </section> : <p>アプリ未収録。日程・結果・代表選手は、公開されている公式情報で確認できます。</p>}
      <div className="hub-links">{tournament.links.map(link => <a key={link.url} href={link.url}
        target="_blank" rel="noopener noreferrer">{link.label} ↗</a>)}</div>
    </div>
  </details>;
}
