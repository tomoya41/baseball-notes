import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { japaneseMlbPlayerName, matchesMlbPlayerName } from "../domain/mlb-japanese-display";
import { contextReader } from "../application/baseball-context-reader";
import { playerHonorBucket, honorProfilePath, type HonorsPage, type Honor, type HonorRecipient, type ContextManifest } from "../domain/player-honors";
import { honorRecipientPath, isHonorRecipientId, type HonorCatalog, type HonorLeague } from "../domain/honor-discovery";
import { DataState, LoadingSkeleton } from "./components";
import "./player-honors.css";

const winnerNote = (s: string) => ({ Unanimous: "満票選出", "1st Game": "第1試合", "2nd Game": "第2試合" })[s] ?? s;
const matchesRecipient = (p: HonorRecipient, q: string) => p.name.toLowerCase().includes(q.toLowerCase()) || p.links.some(l => l.league === "MLB" && matchesMlbPlayerName(l.playerId, p.name, q));
const displayName = (p: HonorRecipient, league: HonorLeague) => {
  const link = p.links.find(l => l.league === league) ?? p.links[0];
  return link?.league === "MLB" ? japaneseMlbPlayerName(link.playerId, p.name) : p.name;
};
const division = (v: string | null) => ({ CL: "セ・リーグ", PL: "パ・リーグ", AL: "ア・リーグ", NL: "ナ・リーグ", ML: "MLB全体" })[v ?? ""] ?? v;
const licenseUrl = (license: string) => ({ "CC-BY-SA-3.0": "https://creativecommons.org/licenses/by-sa/3.0/", "CC-BY-SA-4.0": "https://creativecommons.org/licenses/by-sa/4.0/", "CC0-1.0": "https://creativecommons.org/publicdomain/zero/1.0/", "ODC-BY-1.0": "https://opendatacommons.org/licenses/by/1-0/" })[license];

function Sources({ page }: { page: HonorsPage }) {
  return <details className="honors-sources"><summary>収録範囲・出典</summary><p>一部選手・表彰を収録。回数は収録分です。アプリ独自のMVP・ランキングとは別です。所属は受賞年度の記録で、受賞日の所属を断定するものではありません。年度成績が未収録でも受賞歴を表示します。</p>{page.sources.map(s => <p key={s.id}><a href={s.url}>{s.name}</a>{s.authorsUrl && <> · <a href={s.authorsUrl}>執筆履歴</a></>} · <a href={licenseUrl(s.license)}>{s.license}</a></p>)}<p>原データからの変更：年別一覧の抜粋、日本語表記、本人照合、所属年度の関連付け。各データ部分は表示のライセンスで再利用できます。SABR / Sean Lahman ©1996–2025。MLBの本人照合はChadwick Register（<a href="https://github.com/chadwickbureau/register">ODC-BY 1.0</a>）を使用しています。</p></details>;
}

function HonorList({ page, rows, league, selected = false }: { page: HonorsPage; rows: Honor[]; league: HonorLeague; selected?: boolean }) {
  return <ol className="honors-list">{rows.map(row => {
    const p = page.recipients.find(p => p.id === row.recipientId)!;
    const target = p.identityStatus === "unresolved" ? undefined : p.links.find(l => l.league === league) ?? p.links[0];
    const name = displayName(p, league), recipientLink = honorRecipientPath(row.league, p.id);
    return <li key={row.id}><div className="honors-year"><Link to={`/${row.league}/awards?year=${row.year}`}>{row.year}</Link><small>{division(row.division) ?? "リーグ未収録"}</small></div><div className="honors-result"><strong>{row.name}</strong>{row.position && <span>{row.position}</span>}{row.sourceNote && row.sourceNote !== row.position && row.sourceNote !== "Co-MVP" && <small>{winnerNote(row.sourceNote)}</small>}
      {!selected && <span><Link to={target ? honorProfilePath(target, row.year, row) : recipientLink}>{name}</Link>{p.identityStatus === "unresolved" && <small>本人照合保留</small>}</span>}
      <small>{row.seasonTeams.map(t => t.name).join(" / ") || "受賞年度の所属未収録"}{row.joint === true && " · 同時受賞あり"}{!selected && ` · 収録分${p.counts[row.awardId]}回`}</small>
      <div className="honors-row-links">{!selected && <Link to={recipientLink} aria-label={`${name}の表彰歴をすべて見る`}>表彰歴</Link>}{selected && target && <Link to={honorProfilePath(target, row.year, row)}>{target.league !== league ? `${target.league}の収録成績` : target.seasons.includes(row.year) || target.postseasonSeasons?.includes(row.year) ? "年度成績" : "収録年度の成績"}</Link>}<a className="honors-evidence" href={page.sources.find(s => s.id === row.sourceId)!.url}>出典</a></div>
    </div></li>;
  })}</ol>;
}

function PlayerHonorsContent({ league, playerId }: { league: HonorLeague; playerId: string }) {
  const [state, setState] = useState<{ page: HonorsPage | null; error?: boolean } | null>(null);
  useEffect(() => { let active = true; void contextReader.honors(`honors/players/${league}/${playerHonorBucket(playerId)}.json`).then(page => { if (active) setState({ page }); }).catch(() => { if (active) setState({ page: null, error: true }); }); return () => { active = false; }; }, [league, playerId]);
  if (!state) return <LoadingSkeleton />;
  if (state.error) return <p>表彰歴を読み込めません。<Link to={`/${league}/awards`}>タイトル・表彰一覧へ</Link></p>;
  const page = state.page, ids = new Set(page?.recipients.filter(p => p.links.some(l => l.league === league && l.playerId === playerId)).map(p => p.id));
  const rows = page?.records.filter(r => ids.has(r.recipientId)).sort((a, b) => b.year - a.year || a.awardId.localeCompare(b.awardId)) ?? [];
  return rows.length && page ? <><HonorList page={page} rows={rows} league={league} /><Sources page={page} /></> : <p>この選手のタイトル・表彰歴は未収録です。</p>;
}
export function PlayerHonors({ league, playerId }: { league: HonorLeague; playerId: string }) {
  const [open, setOpen] = useState(false);
  return <details className="player-honors" onToggle={e => setOpen(e.currentTarget.open)}><summary>タイトル・表彰歴</summary>{open && <PlayerHonorsContent key={`${league}:${playerId}`} league={league} playerId={playerId} />}</details>;
}

type Filters = { year: string; award: string; query: string; limit: number };
type Change = (key: string, value: string) => void;
function FilterControls({ years, awards, filters, change, allYears = false }: { years: readonly number[]; awards: readonly { id: string; name: string }[]; filters: Filters; change: Change; allYears?: boolean }) {
  return <div className="honors-filters"><label>年度<select value={filters.year} onChange={e => change("year", e.target.value)}>{allYears && <option value="">すべての年度</option>}{years.map(y => <option key={y} value={y}>{y}年</option>)}{filters.year && !years.includes(Number(filters.year)) && <option value={filters.year}>未収録</option>}</select></label><label>タイトル・表彰<select value={filters.award} onChange={e => change("award", e.target.value)}><option value="">すべて</option>{awards.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}{filters.award && !awards.some(a => a.id === filters.award) && <option value={filters.award}>未収録の表彰</option>}</select></label><label>選手名<input type="search" value={filters.query} onChange={e => change("q", e.target.value)} placeholder="選手を絞り込む" /></label></div>;
}
function Retry({ retry }: { retry: () => void }) { return <><DataState kind="source-unavailable" title="表彰歴を読み込めません" /><button onClick={retry}>再試行</button></>; }

function YearHonors({ league, manifest, filters, change }: { league: HonorLeague; manifest: ContextManifest; filters: Filters; change: Change }) {
  const [state, setState] = useState<{ key: string; page: HonorsPage | null; failed?: boolean } | null>(null), [attempt, setAttempt] = useState(0);
  const key = `${league}:${filters.year}`, available = manifest.years[league].includes(Number(filters.year));
  useEffect(() => { if (!available) return; let active = true; void contextReader.honors(`honors/years/${league}/${filters.year}.json`).then(page => { if (active) setState({ key, page }); }).catch(() => { if (active) setState({ key, page: null, failed: true }); }); return () => { active = false; }; }, [available, league, filters.year, key, attempt]);
  const current = state?.key === key ? state : null, page = current?.page;
  const scoped = page?.records.every(r => r.league === league && String(r.year) === filters.year) ? page : null;
  const awards = [...new Map(scoped?.records.map(r => [r.awardId, { id: r.awardId, name: r.name }])).values()];
  const rows = scoped?.records.filter(r => (!filters.award || r.awardId === filters.award) && (!filters.query || matchesRecipient(scoped.recipients.find(p => p.id === r.recipientId)!, filters.query))) ?? [];
  return <><FilterControls years={manifest.years[league]} awards={awards} filters={filters} change={change} />{!available ? <DataState kind="no-data" title="この年度の表彰歴は未収録です" /> : current?.failed ? <Retry retry={() => setAttempt(n => n + 1)} /> : !current ? <LoadingSkeleton /> : !scoped ? <DataState kind="no-data" title="この年度の表彰歴は未収録です" /> : <><p className="inline-note">{rows.length}件 · 一部収録</p>{rows.length ? <HonorList page={scoped} rows={rows.slice(0, filters.limit)} league={league} /> : <p>該当する受賞歴は未収録です。</p>}{rows.length > filters.limit && <button onClick={() => change("limit", String(filters.limit + 30))}>さらに表示</button>}<Sources page={scoped} /></>}</>;
}

function RecipientHonors({ league, recipientId, filters, change }: { league: HonorLeague; recipientId: string; filters: Filters; change: Change }) {
  const [state, setState] = useState<{ key: string; page: HonorsPage | null; failed?: boolean } | null>(null), [attempt, setAttempt] = useState(0);
  const key = `${league}:${recipientId}`;
  useEffect(() => { let active = true; void contextReader.recipient(league, recipientId).then(page => { if (active) setState({ key, page }); }).catch(() => { if (active) setState({ key, page: null, failed: true }); }); return () => { active = false; }; }, [league, recipientId, key, attempt]);
  const current = state?.key === key ? state : null;
  if (current?.failed) return <Retry retry={() => setAttempt(n => n + 1)} />;
  if (!current) return <LoadingSkeleton />;
  const p = current.page?.recipients.find(p => p.id === recipientId), rows = current.page?.records.filter(r => r.league === league && r.recipientId === recipientId).sort((a, b) => b.year - a.year || a.awardId.localeCompare(b.awardId)) ?? [];
  if (!p || !rows.length) return <DataState kind="no-data" title="この選手の表彰歴は未収録です" />;
  const page: HonorsPage = { ...current.page!, recipients: [p], records: rows, sources: current.page!.sources.filter(s => rows.some(r => r.sourceId === s.id)) };
  const awards = [...new Map(rows.map(r => [r.awardId, { id: r.awardId, name: r.name }])).values()], years = [...new Set(rows.map(r => r.year))];
  const shown = rows.filter(r => (!filters.year || r.year === Number(filters.year)) && (!filters.award || r.awardId === filters.award));
  return <section className="honors-recipient" aria-label={`${displayName(p, league)}の表彰歴`}><Link to={`/${league}/awards?view=players`}>選手を探す</Link><h2>{displayName(p, league)}</h2><p className="inline-note">{Math.min(...years)}–{Math.max(...years)}年 · 一部収録{!p.links.some(l => l.league === league) && " · 年度成績は未収録"}{p.identityStatus === "unresolved" && " · 本人照合保留"}</p><dl className="honors-summary"><div><dt>受賞年</dt><dd>{years.length}<small>年</small></dd></div><div><dt>表彰の種類</dt><dd>{awards.length}<small>種類</small></dd></div><div><dt>受賞歴</dt><dd>{rows.length}<small>件・収録分</small></dd></div></dl><details className="honors-counts"><summary>表彰ごとの回数（収録分）</summary><dl>{awards.map(a => <div key={a.id}><dt>{a.name}</dt><dd>{rows.filter(r => r.awardId === a.id).length}回</dd></div>)}</dl></details><div className="honors-filters"><label>年度<select value={filters.year} onChange={e => change("year", e.target.value)}><option value="">すべての年度</option>{years.map(y => <option key={y} value={y}>{y}年</option>)}{filters.year && !years.includes(Number(filters.year)) && <option value={filters.year}>未収録</option>}</select></label><label>タイトル・表彰<select value={filters.award} onChange={e => change("award", e.target.value)}><option value="">すべて</option>{awards.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}{filters.award && !awards.some(a => a.id === filters.award) && <option value={filters.award}>未収録の表彰</option>}</select></label></div>{shown.length ? <HonorList page={page} rows={shown.slice(0, filters.limit)} league={league} selected /> : <p>指定した条件の受賞歴は未収録です。</p>}{shown.length > filters.limit && <button onClick={() => change("limit", String(filters.limit + 30))}>さらに表示</button>}<Sources page={page} /></section>;
}

function HonorPlayers({ league, manifest, recipientId, filters, change }: { league: HonorLeague; manifest: ContextManifest; recipientId: string | null; filters: Filters; change: Change }) {
  const [state, setState] = useState<{ league: HonorLeague; data: HonorCatalog | null; failed?: boolean } | null>(null), [attempt, setAttempt] = useState(0);
  useEffect(() => { let active = true; void contextReader.catalog(league).then(data => { if (active) setState({ league, data }); }).catch(() => { if (active) setState({ league, data: null, failed: true }); }); return () => { active = false; }; }, [league, attempt]);
  const current = state?.league === league ? state : null;
  if (current?.failed) return <Retry retry={() => setAttempt(n => n + 1)} />;
  if (!current) return <LoadingSkeleton />;
  const catalog = current.data;
  if (!catalog || catalog.league !== league) return <DataState kind="no-data" title="選手別の表彰歴は未収録です" />;
  if (recipientId) return catalog.players.some(p => p.id === recipientId) ? <RecipientHonors league={league} recipientId={recipientId} filters={filters} change={change} /> : <DataState kind="no-data" title="この選手の表彰歴は未収録です" />;
  const players = catalog.players.filter(p => (!filters.year || p.years.includes(Number(filters.year))) && (!filters.award || p.awardIds.includes(filters.award)) && (!filters.query || p.name.toLowerCase().includes(filters.query.toLowerCase()) || league === "MLB" && p.playerId !== null && matchesMlbPlayerName(p.playerId, p.name, filters.query)));
  return <><FilterControls years={manifest.years[league]} awards={catalog.awards} filters={filters} change={change} allYears /><p className="inline-note">{players.length}人 · 表彰歴の収録選手</p><div className="honors-player-list">{players.slice(0, filters.limit).map(p => <Link key={p.id} className="honors-player-link" to={honorRecipientPath(league, p.id)}><span><strong>{league === "MLB" && p.playerId ? japaneseMlbPlayerName(p.playerId, p.name) : p.name}</strong><small>{Math.min(...p.years)}–{Math.max(...p.years)}年{!p.playerId && " · 表彰歴のみ"}{p.identityStatus === "unresolved" && " · 本人照合保留"}</small></span><span>{p.total}<small>件</small><span aria-hidden="true"> ›</span></span></Link>)}</div>{!players.length && <p>該当する選手の表彰歴は未収録です。</p>}{players.length > filters.limit && <button onClick={() => change("limit", String(filters.limit + 30))}>さらに表示</button>}</>;
}

export function HonorsScreen({ league }: { league: HonorLeague }) {
  const [params, setParams] = useSearchParams(), [manifest, setManifest] = useState<ContextManifest | null>(null), [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0);
  const recipient = params.get("recipient"), view = params.get("view"), players = view === "players" || recipient !== null;
  const filters: Filters = { year: params.get("year") ?? (players ? "" : String(manifest?.years[league][0] ?? "")), award: params.get("award") ?? "", query: params.get("q") ?? "", limit: Math.min(5000, Math.max(30, Number(params.get("limit")) || 30)) };
  const valid = !["year", "award", "view", "recipient", "q"].some(k => params.getAll(k).length > 1) && (view === null || view === "players" || view === "years") && !(recipient && view === "years") && (recipient === null || isHonorRecipientId(league, recipient)) && (!filters.year || /^\d{4}$/.test(filters.year) && Number(filters.year) >= (league === "NPB" ? 1936 : 1871) && Number(filters.year) <= 2025) && (!filters.award || /^[a-z0-9_-]+$/.test(filters.award)) && filters.query.length <= 100;
  useEffect(() => { let active = true; void contextReader.manifest().then(m => { if (active) { setManifest(m); setFailed(false); } }).catch(() => { if (active) setFailed(true); }); return () => { active = false; }; }, [attempt]);
  const change: Change = (key, value) => setParams(p => { const n = new URLSearchParams(p); if (value) n.set(key, value); else n.delete(key); if (key !== "limit") n.delete("limit"); return n; });
  const mode = (next: "years" | "players") => setParams(p => { const n = new URLSearchParams(p); n.delete("recipient"); n.delete("limit"); if (next === "players") { n.set("view", "players"); n.delete("year"); } else n.delete("view"); return n; });
  return <div className="screen honors-screen"><header><p className="eyebrow">{league} · RECORDS</p><h1>タイトル・表彰歴</h1><Link to={`/${league}/records`}>成績・記録へ</Link></header><p className="inline-note">{manifest?.years[league].length ? `${Math.min(...manifest.years[league])}–${manifest.years[league][0]}年 · 一部収録 · ${manifest.counts[`${league}Rows`]}件` : "収録範囲を確認中"}</p><div className="honors-view" role="group" aria-label="表彰歴の見方"><button aria-pressed={!players} onClick={() => mode("years")}>年度別</button><button aria-pressed={players} onClick={() => mode("players")}>選手別</button></div>{!valid ? <DataState kind="no-data" title="表彰歴の条件を確認してください" /> : failed ? <Retry retry={() => setAttempt(n => n + 1)} /> : !manifest ? <LoadingSkeleton /> : players ? <HonorPlayers league={league} manifest={manifest} recipientId={recipient} filters={filters} change={change} /> : <YearHonors league={league} manifest={manifest} filters={filters} change={change} />}</div>;
}
