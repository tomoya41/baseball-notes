import { useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { MetricLabel } from "./components";
import { AppDialog } from "./app-dialog";

export function PlayerContextBar({ backTo, children, tools }: { backTo: string; children: ReactNode; tools?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <div className="player-context-bar">
    <Link className="icon-button" to={backTo} aria-label="選手一覧に戻る"><ChevronLeft size={20} aria-hidden="true" /></Link>
    <div className="player-context-controls">{children}</div>
    {tools && <button className="icon-button player-action-trigger" aria-label="選手の操作" aria-haspopup="dialog" onClick={() => setOpen(true)}><span>操作</span><MoreHorizontal size={16} aria-hidden="true" /></button>}
    {open && tools && <AppDialog label="比較・推移・保存" onClose={() => setOpen(false)}><h2>比較・推移・保存</h2><nav className="player-action-menu" aria-label="選手の比較と推移" onClick={e => { if (e.target instanceof Element && e.target.closest("a")) setOpen(false); }}>{tools}</nav></AppDialog>}
  </div>;
}

export function GameHeading({ title, date, context, backTo }: { title: string; date: string; context: string; backTo: string }) {
  return <header className="game-context-bar"><a className="icon-button" href={`#${backTo}`} aria-label="日程・結果に戻る"><ChevronLeft size={20} aria-hidden="true" /></a><div><span>{date}</span><small>{context}</small></div><h1 className="sr-only">{title}</h1></header>;
}

export function PlayerQuickActions({ compareTo, historyTo, trendsTo }: { compareTo: string; historyTo: string; trendsTo?: string }) {
  return <nav className="player-quick-actions" aria-label="選手をもっと知る">
    <Link to={historyTo} aria-label="年度の変化を見る">年度別<ChevronRight size={16} aria-hidden="true" /></Link>
    {trendsTo && <Link to={trendsTo} aria-label="成績の推移と連続記録を見る">推移<ChevronRight size={16} aria-hidden="true" /></Link>}
    <Link to={compareTo} aria-label="ほかの選手と比較">比較<ChevronRight size={16} aria-hidden="true" /></Link>
  </nav>;
}

export function HomeSearchEntry({ league, year }: { league: "NPB" | "MLB"; year?: number }) {
  return <Link className="home-search-entry" to={`/${league}/search${year ? `?season=${year}` : ""}`}><Search size={20} aria-hidden="true" /><span>気になる選手を探す</span><ChevronRight size={18} aria-hidden="true" /></Link>;
}

export function PlayerListTools({ name, children }: { name: string; children: ReactNode }) {
  const [open,setOpen] = useState(false);
  return <><button className="icon-button" aria-label={`${name}の比較・保存`} aria-haspopup="dialog" onClick={()=>setOpen(true)}><MoreHorizontal size={20} aria-hidden="true" /></button>{open && <AppDialog label={`${name}の比較・保存`} onClose={()=>setOpen(false)}><h2>{name}</h2><nav className="player-action-menu" aria-label="比較・保存" onClick={e=>{if(e.target instanceof Element && e.target.closest("a"))setOpen(false);}}>{children}</nav></AppDialog>}</>;
}

export type HeadlineStat = { metric: string; label?: string; value: string };
export function TeamRecord({ wins, losses, ties }: { wins: number | null; losses: number | null; ties?: number | null }) {
  return <dl className="team-record"><div><dt>勝</dt><dd>{wins ?? "—"}</dd></div><div><dt>敗</dt><dd>{losses ?? "—"}</dd></div>{ties !== undefined && <div><dt>引分</dt><dd>{ties ?? "—"}</dd></div>}</dl>;
}
export function HeadlineStats({ title, stats, partial = false }: { title: string; stats: HeadlineStat[]; partial?: boolean }) {
  const labels: Record<string,string> = { AVG:"打率", HR:"本塁打", ERA:"防御率" };
  return <section className="headline-stats" aria-label={title}><div className="headline-stats-context"><span>{title}</span>{partial && <span className="headline-partial">一部未収集</span>}</div><dl>{stats.map(stat => <div key={stat.metric}><dt><MetricLabel metric={stat.metric} label={stat.label ?? labels[stat.metric] ?? stat.metric} /></dt><dd>{stat.value}</dd></div>)}</dl></section>;
}

export function PlayerIdentity({ name, context, detail, visual, favorite, children, uniformNumber }: {
  name: string; context: string; detail?: string; visual?: ReactNode; favorite: ReactNode; children?: ReactNode; uniformNumber?: string | number | null;
}) {
  return <header className="player-identity"><div className="player-identity-top"><div><p className="eyebrow">{context}</p>{uniformNumber!=null&&uniformNumber!==""&&<span className="player-uniform-number" aria-label={`保存済みの背番号 ${uniformNumber}`}><span aria-hidden="true">#</span>{uniformNumber}</span>}<h1>{name}</h1>{detail && <p className="player-identity-detail">{detail}</p>}</div>{favorite}{visual}</div>{children}</header>;
}

export function HomeDiscover({ league, year, date, showHot = true }: { league: "NPB" | "MLB"; year?: number; date?: string; showHot?: boolean }) {
  const scope = year ? `?season=${year}` : "";
  const form = `${scope}${date ? `&asOfDate=${date}` : ""}`;
  return <section className="home-discover" aria-label="野球データを楽しむ"><h2>数字を楽しむ</h2>{league === "MLB" && showHot && <Link className="discovery-feature" to={`/MLB/form${form}`}><span className="feature-kicker">HOT</span><span><strong>活躍した選手</strong><small>{year}年{date ? ` · ${date}時点` : ""}の過去記録</small></span><ChevronRight size={18} aria-hidden="true" /></Link>}<div className="discovery-paths">{[
    ["data", "成績を探す"], ["compare", "選手を比べる"], ["teams", "球団を見る"], ["history", "年度をたどる"],
    ...(league === "NPB" ? [["talent", "ドラフト・若手"]] : []),
  ].map(([route,label])=><Link key={route} to={`/${league}/${route}${scope}`}><strong>{label}</strong><ChevronRight size={16} aria-hidden="true" /></Link>)}</div></section>;
}
