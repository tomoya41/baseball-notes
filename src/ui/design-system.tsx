import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ArrowUpRight, Moon, Sun, Monitor } from "lucide-react";
import { Link } from "react-router-dom";
import { readAppearance, setAppearance } from "../app/appearance";
import type { ThemePreference } from "../app/appearance";
const themes = [{ id: "system", label: "端末に合わせる", icon: Monitor }, { id: "light", label: "ライト", icon: Sun }, { id: "dark", label: "ダーク", icon: Moon }] as const;
export function ThemeSettings() {
  const [theme, setTheme] = useState<ThemePreference>("system");
  const [message, setMessage] = useState("");
  useEffect(() => { let active = true; void readAppearance().then(value => {
    if (active) setTheme(value);
  }).catch(() => {}); return () => { active = false; }; }, []);
  const change = async (value: ThemePreference) => {
    setTheme(value);
    try { await setAppearance(value); setMessage(""); }
    catch { setMessage("この表示設定は今回の起動中だけ適用します。"); }
  };
  return <section className="settings-panel"><h2>表示モード</h2><div className="segmented" role="group" aria-label="表示モード">
    {themes.map(({ id, label, icon: Icon }) => <button key={id} aria-pressed={theme === id} onClick={() => void change(id)}><Icon size={17} aria-hidden="true" />{label}</button>)}
  </div>{message && <p role="status" className="inline-note">{message}</p>}</section>;
}
export function Monogram({ name, large = false }: { name: string; large?: boolean }) {
  const initials = name.includes(" ") ? name.split(" ").filter(Boolean).slice(0, 2).map(part => part[0]).join("") : name.slice(0, 2);
  return <span className={`monogram${large ? " monogram--large" : ""}`} aria-hidden="true">{initials}</span>;
}
export function PlayerTabs({ base, section, search = "" }: { base: string; section: string | undefined; search?: string }) {
  return <nav className="profile-tabs" aria-label="選手ページ">
    {[{ label: "概要", part: "" }, { label: "成績", part: "stats" }, { label: "分析", part: "analysis" }, { label: "試合別", part: "game-log" }, { label: "プロフィール", part: "more" }].map(tab =>
      <Link key={tab.part} to={`${base}${tab.part ? `/${tab.part}` : ""}${search}`} aria-current={(section ?? "") === tab.part ? "page" : undefined}>{tab.label}</Link>)}
  </nav>;
}
export function CompetitionHeader({ league, context, children }: { league: string; context: string; children?: ReactNode }) {
  return <header className="competition-header"><div><h1>{league}</h1><p className="eyebrow">{context}</p></div>{children}</header>;
}
export function ScoreboardRow({ to, away, home, awayScore, homeScore, status, date, gameNumber, partial = false }: {
  to: string; away: string; home: string; awayScore: number | null; homeScore: number | null;
  status: string; date?: string; gameNumber?: number | undefined; partial?: boolean;
}) {
  return <Link className="scoreboard-row" to={to}>
    <span className="scoreboard-teams"><span className={awayScore !== null && homeScore !== null && awayScore > homeScore ? "scoreboard-winner" : ""}><span><span className="sr-only">ビジター </span>{away}</span><strong>{awayScore ?? "—"}</strong></span>
      <span className={awayScore !== null && homeScore !== null && homeScore > awayScore ? "scoreboard-winner" : ""}><span><span className="sr-only">ホーム </span>{home}</span><strong>{homeScore ?? "—"}</strong></span></span>
    <span className="scoreboard-status"><span>{date}</span><strong>{status}</strong>{gameNumber !== undefined && gameNumber > 0 && <small>第{gameNumber}試合</small>}{partial && <small>一部データ確認中</small>}<ArrowUpRight size={15} aria-hidden="true" /></span>
  </Link>;
}
export function Shortcut({ to, title, detail }: { to: string; title: string; detail: string }) {
  return <Link className="shortcut" to={to}><span><strong>{title}</strong>{detail && <small>{detail}</small>}</span><ArrowUpRight size={21} aria-hidden="true" /></Link>;
}
export function MySettings() {
  return <div className="my-settings"><ThemeSettings /><section className="settings-panel"><h2>このアプリについて</h2>
    <Link className="settings-link" to="/MLB/sources">データ提供元・クレジット <ArrowUpRight size={17} aria-hidden="true" /></Link>
    <Link className="settings-link" to="/privacy">プライバシー・保存データ <ArrowUpRight size={17} aria-hidden="true" /></Link>
    <p className="inline-note">お気に入りはこの端末に保存。アカウント登録は不要です。</p></section></div>;
}
