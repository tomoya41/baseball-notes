import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { internationalOfficialTournaments as tournaments } from "../data/international-official-links";
import { apbc2026BatteryRevision } from "../data/apbc-2026-battery-appearances";
import { internationalTeamNames, internationalRoundNames, japanResultsByTournament, japanSelectionsByTournament, resultLicense } from "../data/international-japan-results";
import { apbc2026OfficialBoxes } from "../data/apbc-2026-highlights";
import { premier122024JapanStatsRevision, premier122024JapanStatsVerification } from "../data/premier12-2024-japan-stats";
import { wbc2023JapanStatsRevision, wbc2023JapanStatsVerification } from "../data/wbc-2023-japan-stats";
import { wbc2026OfficialBoxes } from "../data/wbc-2026-japan-highlights";
import { metrics, ratio } from "../domain/metrics";
import { formatDate, formatMetric } from "../presentation/formatters";

const innings = (outs: number) => formatMetric(ratio(outs, 1), metrics.outs!);

function InternationalPlayerRow({ name, npbPlayerId, children }: { name?: string; npbPlayerId?: string; children: ReactNode }) {
  const player = <><strong>{name}</strong>{children}</>;
  return <li className="player-row">
    {npbPlayerId ? <Link className="player-row__body international-player-link" to={`/NPB/players/${npbPlayerId}`}>
      {player}<span className="international-player-link__arrow" aria-hidden="true">→</span>
    </Link> : <span className="player-row__body">{player}</span>}
  </li>;
}

export function InternationalGameEntry({ expanded, onToggle, selected, onSelect }: {
  expanded: boolean;
  onToggle: (open: boolean) => void;
  selected: (typeof tournaments)[number] | undefined;
  onSelect: (id: string) => void;
}) {
  const tournament = selected ?? tournaments[0]!;
  const edition = japanResultsByTournament.get(tournament.id);
  const roster = japanSelectionsByTournament.get(tournament.id);
  const positions = new Set(roster?.players.map(player => player.position));
  const playerNames = new Map(roster?.players.map(player => [player.id, player.name]));
  const highlights = new Map(edition?.gameHighlights.map(game => [game.gameId, game]));
  const apbc = tournament.kind === "apbc";
  const wbc2026 = tournament.kind === "wbc" && tournament.year === 2026;
  const officialBoxes = wbc2026 ? wbc2026OfficialBoxes : apbc ? apbc2026OfficialBoxes : undefined;
  const batting = edition?.playerStats.filter(row => row.role === "batting") ?? [];
  const pitching = edition?.playerStats.filter(row => row.role === "pitching") ?? [];
  const gamePitching = edition?.gamePitching.filter(row => row.teamId === "international:team:jpn") ?? [];
  const pitchDates = new Map(edition?.games.map(game => [game.id, game.localDate]));
  const outings = new Map<string, { gameId: string; outs: number }[]>();
  for (const game of gamePitching) {
    for (const { playerId, outs } of game.pitchers) {
      const playerGames = outings.get(playerId) ?? [];
      playerGames.push({ gameId: game.gameId, outs });
      outings.set(playerId, playerGames);
    }
  }
  const statsCoverage = edition?.coverage.playerStats;
  const npbPlayers = new Map(edition?.identities.filter(row => row.league === "NPB")
    .map(row => [row.playerId, row.canonicalPlayerId]));
  const identitySourceIds = new Set(edition?.identities.flatMap(row =>
    [row.evidence.international.sourceRevisionId, row.evidence.canonical.sourceRevisionId]));
  const sources = edition?.sources.filter(source => !identitySourceIds.has(source.id));
  const identitySources = edition?.sources.filter(source => identitySourceIds.has(source.id));
  const appearances = new Map<string, string[]>();
  for (const record of edition?.participation ?? []) {
    if (record.kind !== "appeared" || record.date === null) continue;
    const dates = appearances.get(record.playerId) ?? [];
    dates.push(record.date);
    appearances.set(record.playerId, dates);
  }
  for (const dates of appearances.values()) dates.sort();

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
        {edition.tournamentMvp && <p>大会MVP <strong>{playerNames.get(edition.tournamentMvp.playerId)}</strong></p>}
        <p className="inline-note">日付は現地時間。{edition.playerStats.length ? "成績は大会通算です。" :
          highlights.size ? `日本の本塁打と${wbc2026 ? "勝敗投手" : "勝利投手"}を収録。` :
          edition.participation.length ? "個人成績は未収録です。" : "代表選手・個人成績は未収録です。"}</p>
        <ol className="row-list">{edition.games.map(game => {
          const detail = highlights.get(game.id);
          return <li key={game.id} className="player-row">
            <span className="player-row__body"><small><time dateTime={game.localDate!}>{game.localDate}</time> · {internationalRoundNames[game.round]}</small>
              <strong>{internationalTeamNames.get(game.awayTeamId!)} {game.result!.awayRuns} − {game.result!.homeRuns} {internationalTeamNames.get(game.homeTeamId!)}</strong>
              {detail && <>
                <small>日本の本塁打 {detail.homeRuns.map(({ playerId, count }, index) =>
                  <span key={playerId}>{index > 0 && "、"}{playerNames.get(playerId)} <span className="international-count">{count}本</span></span>)}</small>
                {detail.winningPitcherId && <small>勝利投手 {playerNames.get(detail.winningPitcherId)}</small>}
                {detail.losingPitcherId && <small>敗戦投手 {playerNames.get(detail.losingPitcherId)}</small>}
              </>}
            </span>
          </li>;
        })}</ol>
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
              <small>防御率 {formatMetric(ratio(row.earnedRuns * 27, row.outs), metrics.era!)} · {innings(row.outs)}</small>
              <small>{row.gamesPlayed}登板 · {row.strikeouts === null ? "奪三振は未収録" : `${row.strikeouts}奪三振`}</small>
            </span>
          </li>)}</ul>
        </details>}
        {outings.size > 0 && <details className="advanced-disclosure">
          <summary>登板・投球回 · {outings.size}人</summary>
          <p className="inline-note">日本戦{gamePitching.length}試合 · チーム計{innings(gamePitching.reduce((sum, game) => sum + game.teamOuts, 0))}</p>
          <ul className="row-list">{[...outings].map(([id, games]) => <InternationalPlayerRow key={id}
            name={playerNames.get(id)} npbPlayerId={npbPlayers.get(id)}>
            <small>{games.length}登板 · {innings(games.reduce((sum, game) => sum + game.outs, 0))}</small>
            <small>{games.map(({ gameId, outs }) =>
              `${formatDate(pitchDates.get(gameId) ?? null, true)} ${innings(outs)}${outs === 0 ? "（アウトなし）" : ""}`).join("、")}</small>
          </InternationalPlayerRow>)}</ul>
        </details>}
        {roster && <details className="advanced-disclosure"><summary>代表に選ばれた選手 · {roster.players.length}人</summary>
          <p className="inline-note">{formatDate(roster.announcedAsOf, true)}時点の発表。登録名簿は未収録です。</p>
          {[...positions].map(position => <div key={position}><h4>{position}</h4>
            <p>{roster.players.filter(player => player.position === position).map(player => player.name).join("、")}</p></div>)}
        </details>}
        {appearances.size > 0 && <details className="advanced-disclosure">
          <summary>出場を確認した選手 · {appearances.size}人</summary>
          <p className="inline-note">{apbc ? "本塁打・登板・捕手の記録" : "本塁打や勝敗投手の記録"}で確認できた試合のみ。日付は現地時間です。</p>
          <ul className="row-list">{[...appearances].map(([id, dates]) => <InternationalPlayerRow key={id}
            name={playerNames.get(id)} npbPlayerId={npbPlayers.get(id)}>
            <small>{dates.map(date => formatDate(date, true)).join("、")}</small>
          </InternationalPlayerRow>)}</ul>
        </details>}
        <details className="source-note"><summary>収録範囲・出典</summary><p>日本戦の確定スコアを抜粋。左がビジター、右がホームです。
          Wikipediaの執筆者による記録を抜粋・翻訳・整形し、<a href={resultLicense}>CC BY-SA 4.0</a>で提供しています。</p>
          {officialBoxes && highlights.size > 0 && <>
            <p>{outings.size ? "登板と投球回を収録。防御率や奪三振、打撃の大会通算成績は未収録です。" :
              "大会通算の打撃・投球成績は未収録です。"}{wbc2026 && "準々決勝は現地3月14日、日本時間3月15日です。"}</p>
            <div className="hub-links">{[...officialBoxes].map(([date, url]) =>
              <a key={date} href={url}>{formatDate(date, true)}の公式試合記録</a>)}</div>
          </>}
          {statsCoverage?.status === "partial" && <p>日本代表の大会通算成績から打撃・投球の一部指標を収録。試合ごとの出場記録は未収録です。
            {statsCoverage.source.sourceRevisionId === wbc2023JapanStatsRevision && <> WBC公式の
              <a href={wbc2023JapanStatsVerification.batting}>打撃成績</a>・<a href={wbc2023JapanStatsVerification.pitching}>投球成績</a>でも確認できます。</>}
            {statsCoverage.source.sourceRevisionId === premier122024JapanStatsRevision && <> 照合先は
              <a href={premier122024JapanStatsVerification.throughSuperRound}>決勝前のWBSC集計</a>と
              <a href={premier122024JapanStatsVerification.final}>決勝の試合記録</a>です。</>}
          </p>}
          {sources?.map(source => <p key={source.id}><a href={source.url}>{
            statsCoverage?.status === "partial" && statsCoverage.source.sourceRevisionId === source.id ? "日本語版の大会通算成績" :
              source.id === apbc2026BatteryRevision ? "日本語版の登板・投球回・捕手の記録" :
              source.sourceId === "jawiki" ? "日本語版の代表選手" : "英語版の試合結果"
          }（版 {source.version}）</a></p>)}
          {identitySources?.length ? <details className="source-note">
            <summary>本人照合の出典</summary>
            <p>日本語版Wikipediaの選手記事（<a href={resultLicense}>CC BY-SA 4.0</a>）と、
              Chadwick Baseball Bureauの登録データで選手IDを照合しました。</p>
            <ul>{identitySources.map(source => <li key={source.id}>
              {source.sourceId === "chadwick-register" ? <>
                <a href={source.url}>Chadwick Register</a>（<a href={source.termsEvidenceUrl}>ODC-BY 1.0</a>）
              </> : <a href={source.url}>日本語版Wikipediaの選手記事（版 {source.version}）</a>}
            </li>)}</ul>
          </details> : null}
        </details>
      </section> : <p>アプリ未収録。日程・結果・代表選手は、公開されている公式情報で確認できます。</p>}
      <div className="hub-links">{tournament.links.map(link => <a key={link.url} href={link.url}
        target="_blank" rel="noopener noreferrer">{link.label} ↗</a>)}</div>
    </div>
  </details>;
}
