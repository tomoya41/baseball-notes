import { useId, useRef } from "react";
import type { ReactNode } from "react";
import { ChevronRight, Info, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { metrics } from "../domain/metrics";
import type { Favorite, MetricDefinition, Player, PlayerCatalog, Statistics, Team } from "../domain/models";
import { formatMetric, formatPlayerName, formatPositions, formatTeamName } from "../presentation/formatters";
import { TeamBrand } from "./branding";

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
  const isFavorite = favorites?.some((item) => item.kind === "player" && item.entityId === player.id);
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

export function MetricInfo({ definition }: { definition: MetricDefinition }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  return <>
    <button className="metric-info-button" type="button" aria-label={`${definition.name}の説明`}
      onClick={() => dialog.current?.showModal()}><Info size={17} aria-hidden="true" /></button>
    <dialog className="metric-dialog" ref={dialog} aria-labelledby={titleId}>
      <h2 id={titleId}>{definition.name}（{definition.fullName}）</h2>
      <p>{definition.description}</p>
      <p>{definition.interpretation}</p>
      {definition.caveat && <p className="muted">{definition.caveat}</p>}
      <form method="dialog"><button className="button">閉じる</button></form>
    </dialog>
  </>;
}

export function MetricGrid({ stats, advanced = false }: { stats: Statistics; advanced?: boolean }) {
  return <div className={`metric-grid${advanced ? " metric-grid--advanced" : ""}`}>
    {Object.entries(stats.metrics).map(([id, value]) => {
      const definition = metrics[id];
      if (!definition || definition.advanced !== advanced) return null;
      return <div className="metric-tile" key={id}>
        <div className="metric-tile__label"><span>{definition.name}</span>{advanced && <MetricInfo definition={definition} />}</div>
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
    <div className="skeleton skeleton--heading" />
    <div className="skeleton skeleton--panel" />
    <div className="skeleton skeleton--row" />
    <div className="skeleton skeleton--row" />
  </div>;
}
