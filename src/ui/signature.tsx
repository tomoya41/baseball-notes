import { useState, type ReactNode } from "react";
import { ChevronLeft, MoreHorizontal } from "lucide-react";
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

export type HeadlineStat = { metric: string; label?: string; value: string };
export function TeamRecord({ wins, losses, ties }: { wins: number | null; losses: number | null; ties?: number | null }) {
  return <dl className="team-record"><div><dt>勝</dt><dd>{wins ?? "—"}</dd></div><div><dt>敗</dt><dd>{losses ?? "—"}</dd></div>{ties !== undefined && <div><dt>引分</dt><dd>{ties ?? "—"}</dd></div>}</dl>;
}
export function HeadlineStats({ title, stats, partial = false }: { title: string; stats: HeadlineStat[]; partial?: boolean }) {
  return <section className="headline-stats" aria-label={title}><div className="headline-stats-context"><span>{title}</span>{partial && <span className="headline-partial">一部未収集</span>}</div><dl>{stats.map(stat => <div key={stat.metric}><dt><MetricLabel metric={stat.metric} {...stat.label ? { label: stat.label } : {}} /></dt><dd>{stat.value}</dd></div>)}</dl></section>;
}

export function PlayerIdentity({ name, context, detail, visual, favorite, children }: {
  name: string; context: string; detail?: string; visual?: ReactNode; favorite: ReactNode; children?: ReactNode;
}) {
  return <header className="player-identity"><div className="player-identity-top"><div><p className="eyebrow">{context}</p><h1>{name}</h1>{detail && <p className="player-identity-detail">{detail}</p>}</div>{favorite}{visual}</div>{children}</header>;
}

export function HomeDiscover({ league, year, date, showHot = true }: { league: "NPB" | "MLB"; year?: number; date?: string; showHot?: boolean }) {
  const scope = year ? `?season=${year}` : "";
  const form = `${scope}${date ? `&asOfDate=${date}` : ""}`;
  return <section className="home-discover" aria-label="野球データを楽しむ"><h2>{league === "MLB" ? "このシーズンを掘る" : "選手と数字をもっと"}</h2>{league === "MLB" && showHot && <Link className="discovery-feature" to={`/MLB/form${form}`}><span className="feature-kicker">HOT</span><span><strong>活躍した選手を探す</strong><small>{year}年{date ? ` · ${date}時点` : ""}の過去記録</small></span><span aria-hidden="true">↗</span></Link>}<div className="discovery-paths"><Link to={`/${league}/data${scope}`}><strong>成績を探す</strong><span>条件・期間で絞り込む ↗</span></Link><Link to={`/${league}/compare${scope}`}><strong>選手を比較</strong><span>2〜4人の違いを見る ↗</span></Link><Link to={`/${league}/teams${scope}`}><strong>球団を見る</strong><span>試合・成績・選手 ↗</span></Link><Link to={`/${league}/${league === "NPB" ? "talent" : "history"}${scope}`}><strong>{league === "NPB" ? "ドラフト・若手" : "シーズン履歴"}</strong><span>{league === "NPB" ? "同期・出身校から探す" : "収録年度をたどる"} ↗</span></Link></div></section>;
}
