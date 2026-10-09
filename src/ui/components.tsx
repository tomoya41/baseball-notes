import { useId, useState } from "react";
import type { ReactNode } from "react";
import { ChevronRight, Info, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { metrics } from "../domain/metrics";
import type { Favorite, Player, PlayerCatalog, Statistics, Team } from "../domain/models";
import { metricHelp } from "../presentation/metric-help";
import type { MetricHelp } from "../presentation/metric-help";
import { formatMetric, formatPlayerName, formatPositions, formatTeamName } from "../presentation/formatters";
import { TeamBrand } from "./branding";
import { AppDialog } from "./app-dialog";

export function SectionHeader({ title, action, to }: { title: string; action?: string | undefined; to?: string | undefined }) {
  return <div className="section-header">
    <h2>{title}</h2>
    {action && to && <Link className="section-action" to={to}>{action}<ChevronRight size={17} /></Link>}
  </div>;
}

export function PageHeading({ eyebrow, title, detail, level = 1 }: { eyebrow?: string; title: string; detail?: string; level?: 1 | 2 }) {
  return <div className="page-heading">
    {eyebrow && <p className="eyebrow">{eyebrow}</p>}
    {level === 1 ? <h1>{title}</h1> : <h2>{title}</h2>}
    {detail && <p className="muted">{detail}</p>}
  </div>;
}

export function PlayerAvatar({ player, team, jersey, size = "sm" }: {
  player: Player; team?: Team | null | undefined; jersey?: string | null | undefined; size?: "sm" | "lg";
}) {
  const fallback = formatPlayerName(player).slice(0, 1);
  return <span className={`player-avatar player-avatar--${size}`} aria-hidden="true">
    <TeamBrand team={team} size={size === "lg" ? "lg" : "sm"} />
    <span>{jersey ?? fallback}</span>
  </span>;
}

export function PlayerRow({ player, catalog, favorites, trailing, to }: {
  player: Player; catalog: PlayerCatalog; favorites?: Favorite[]; trailing?: ReactNode; to?: string;
}) {
  const team = catalog.teams.find((item) => item.id === player.teamId);
  const profile = catalog.profiles.find((item) => item.player.id === player.id);
  const isFavorite = favorites?.some((item) => item.league === player.league && item.kind === "player" && item.entityId === player.id);
  return <Link className="player-row" to={to ?? `/${catalog.league}/players/${encodeURIComponent(player.id)}`}>
    <PlayerAvatar player={player} team={team} jersey={profile?.jersey} />
    <span className="player-row__body">
      <strong>{formatPlayerName(player)}</strong>
      <small>{formatTeamName(team, "short")} · {formatPositions(player.positions)}</small>
    </span>
    {trailing ?? (isFavorite && <Star size={16} fill="currentColor" aria-label="お気に入り登録済み" />)}
    <ChevronRight className="row-chevron" size={19} aria-hidden="true" />
  </Link>;
}

export function TeamRow({ team, catalog }: { team: Team; catalog: PlayerCatalog }) {
  const count = catalog.profiles.filter((profile) => profile.player.teamId === team.id).length;
  return <Link className="team-row" to={`/${catalog.league}/teams/${encodeURIComponent(team.id)}`}>
    <TeamBrand team={team} size="md" />
    <span className="player-row__body"><strong>{formatTeamName(team)}</strong><small>{catalog.league} · 登録選手 {count}人</small></span>
    <ChevronRight className="row-chevron" size={19} aria-hidden="true" />
  </Link>;
}

export function FavoriteButton({ active, saving, onClick, label }: {
  active: boolean; saving: boolean; onClick: () => void; label: string;
}) {
  return <button className={`favorite-button${active ? " is-active" : ""}`} type="button"
    aria-label={`${label}を${active ? "お気に入りから削除" : "お気に入りに追加"}`}
    aria-pressed={active} disabled={saving} onClick={onClick}>
    <Star size={21} fill={active ? "currentColor" : "none"} aria-hidden="true" />
  </button>;
}

export function MetricInfo({ definition }: { definition: MetricHelp }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const content = <>
    <p className="eyebrow">指標ガイド</p><h2 id={titleId}>{definition.name} <span>{definition.fullName}</span></h2>
    <p>{definition.description}</p>
    <p>{definition.interpretation}</p>
    {definition.caveat && <p className="muted">{definition.caveat}</p>}
    {definition.formula && <p><strong>計算式</strong> {definition.formula}</p>}
    {definition.data && <p><strong>利用データ</strong> {definition.data}</p>}
    {definition.sample && <p className="muted">{definition.sample}</p>}
    {definition.scope && <p className="muted">{definition.scope}</p>}
  </>;
  return <>
    <button className="metric-info-button" type="button" aria-label={`${definition.name}の説明`} aria-haspopup="dialog"
      onClick={() => setOpen(true)}><Info size={17} aria-hidden="true" /></button>
    {open && <AppDialog labelledBy={titleId} onClose={() => setOpen(false)}>{content}</AppDialog>}
  </>;
}

export function MetricLabel({ metric, label }: { metric: string; label?: string }) {
  const definition = metricHelp(metric);
  return <span className="metric-label"><span>{label ?? metric}</span>{definition && <MetricInfo definition={definition} />}</span>;
}

export function MetricGrid({ stats, advanced = false }: { stats: Statistics; advanced?: boolean }) {
  return <div className={`metric-grid${advanced ? " metric-grid--advanced" : ""}`}>
    {Object.entries(stats.metrics).map(([id, value]) => {
      const definition = metrics[id];
      if (!definition || definition.advanced !== advanced) return null;
      return <div className="metric-tile" key={id}>
        <div className="metric-tile__label"><MetricLabel metric={id} label={definition.name} /></div>
        <strong className="metric-tile__value">{formatMetric(value, definition)}</strong>
        {value.status !== "available" && <small className="metric-tile__note">{value.reason}</small>}
      </div>;
    })}
  </div>;
}

export type DataStateKind = "no-data" | "unsupported" | "source-unavailable" | "not-implemented" | "small-sample";

export function DataState({ kind, title, detail, action, to }: {
  kind: DataStateKind; title?: string; detail?: string; action?: string; to?: string;
}) {
  const defaults: Record<DataStateKind, string> = {
    "no-data": "データがありません",
    unsupported: "このデータは提供されていません",
    "source-unavailable": "データを取得できませんでした",
    "not-implemented": "この機能は準備中です",
    "small-sample": "サンプルが少ないため参考値です",
  };
  return <div className={`data-state data-state--${kind}`} role={kind === "source-unavailable" ? "alert" : "status"}>
    <strong>{title ?? defaults[kind]}</strong>
    {detail && <p>{detail}</p>}
    {action && to && <Link className="text-link" to={to}>{action}<ChevronRight size={16} /></Link>}
  </div>;
}

export function LoadingSkeleton() {
  return <div className="skeleton-page" aria-label="読み込み中" role="status">
    <span className="sr-only">読み込み中</span>
    <div className="skeleton skeleton--heading" />
    <div className="skeleton skeleton--panel" />
    <div className="skeleton skeleton--row" />
    <div className="skeleton skeleton--row" />
  </div>;
}
