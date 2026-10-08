import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight, Moon, Sun, Monitor } from "lucide-react";
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
function ClubName({ name }: { name: string }) {
  const divider = name.lastIndexOf("・");
  if (divider <= 0 || divider === name.length - 1) return <span>{name}</span>;
  return <span className="club-name"><span className="club-context">{name.slice(0,divider)}<span className="sr-only">・</span></span><span>{name.slice(divider + 1)}</span></span>;
}
export function ScoreboardRow({ to, away, home, awayScore, homeScore, status, date, gameNumber, partial = false }: {
  to: string; away: string; home: string; awayScore: number | null; homeScore: number | null;
  status: string; date?: string; gameNumber?: number | undefined; partial?: boolean;
}) {
  const known = awayScore !== null && homeScore !== null;
  return <Link className="scoreboard-row" to={to} aria-label={`${date ? `${date}、` : ""}ビジター ${away} ${awayScore ?? "得点未確認"}、ホーム ${home} ${homeScore ?? "得点未確認"}、${status}${gameNumber ? `、第${gameNumber}試合` : ""}${partial ? "、一部データ確認中" : ""}`}>
    <span className="scoreboard-match"><span className={`scoreboard-side${known && awayScore > homeScore ? " scoreboard-winner" : ""}`}><span className="scoreboard-club"><small>ビジター</small><ClubName name={away} /></span><strong>{awayScore ?? "—"}</strong></span><span className={`scoreboard-side${known && homeScore > awayScore ? " scoreboard-winner" : ""}`}><span className="scoreboard-club"><small>ホーム</small><ClubName name={home} /></span><strong>{homeScore ?? "—"}</strong></span></span>
    <span className="scoreboard-center">{date && <small>{date}</small>}<span>{status}</span>{gameNumber !== undefined && gameNumber > 0 && <small>第{gameNumber}試合</small>}{partial && <small className="scoreboard-partial">一部データ確認中</small>}<ChevronRight size={16} aria-hidden="true" /></span>
  </Link>;
}
export function HomeModeNav({ modes, active, onChange }: { modes: readonly { id: string; label: string }[]; active: string; onChange: (id: string) => void }) {
  return <div className="home-mode-nav" role="group" aria-label="ホームの表示">{modes.map(mode => <button key={mode.id} aria-pressed={active === mode.id} onClick={() => onChange(mode.id)}>{mode.label}</button>)}</div>;
}
export function DateRibbon({ date, min, max, onChange }: { date: string; min: string; max: string; onChange: (date: string) => void }) {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0,10) !== date || date < min || date > max) return null;
  const shift = (offset: number) => { const next = new Date(`${date}T00:00:00Z`); next.setUTCDate(next.getUTCDate() + offset); return next.toISOString().slice(0,10); };
  const dates = [-2,-1,0,1,2].map(shift).filter(d => d >= min && d <= max);
  return <div className="date-ribbon"><div className="date-ribbon-heading"><strong>{Number(date.slice(0,4))}年{Number(date.slice(5,7))}月</strong><label><span className="sr-only">試合日</span><input type="date" aria-label="試合日" value={date} min={min} max={max} onChange={e => { if(e.target.value >= min && e.target.value <= max) onChange(e.target.value); }} /></label></div><nav aria-label="日付移動"><button aria-label="前日" disabled={date <= min} onClick={() => onChange(shift(-1))}><ChevronLeft size={18} /></button><div className="date-ribbon-days">{dates.map(d => <button key={d} aria-label={d} aria-pressed={date === d} onClick={() => onChange(d)}><small>{new Intl.DateTimeFormat("ja-JP",{weekday:"short",timeZone:"UTC"}).format(new Date(`${d}T00:00:00Z`))}</small><strong>{Number(d.slice(8))}</strong></button>)}</div><button aria-label="翌日" disabled={date >= max} onClick={() => onChange(shift(1))}><ChevronRight size={18} /></button></nav></div>;
}
export function ScoreHero({ away, home, awayScore, homeScore, status }: { away: string; home: string; awayScore: number | null; homeScore: number | null; status: string }) {
  return <div className="score-hero" role="group" aria-label={`${away} ${awayScore ?? "得点未確認"}、${home} ${homeScore ?? "得点未確認"}、${status}`}><div><small>ビジター</small><strong><ClubName name={away} /></strong></div><div className="score-hero-result"><span>{awayScore ?? "—"}<i aria-hidden="true">:</i>{homeScore ?? "—"}</span><small>{status}</small></div><div><small>ホーム</small><strong><ClubName name={home} /></strong></div></div>;
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
