import { useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, Search } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import type { AnalysisProvider } from "../application/ports";
import type { AnalysisCapabilities, AnalysisResult, Split } from "../domain/analysis";
import { capabilityManifestSchema } from "../domain/analysis";
import { assessAnalysisQuery } from "../domain/analysis-query";
import { pitchTypeDefinitions } from "../domain/baseball-terms";
import type { Player, PlayerCatalog } from "../domain/models";
import { formatSplitMetric } from "../presentation/analysis";
import { attentionPitch, firstSplit, matchupQuery } from "../presentation/matchup";
import { formatDate, formatPitchType, formatPlayerName, formatTeamName } from "../presentation/formatters";
import { AnalysisDataView, RecentChange, SampleBadge, SplitMetrics } from "./analysis";
import { useAnalysisData } from "./use-analysis-data";
import { TeamBrand } from "./branding";
import { DataState, LoadingSkeleton, PageHeading, SectionHeader } from "./components";

type Section = "summary" | "direct" | "arsenal" | "count" | "recent";
function available(manifest: AnalysisCapabilities, id: keyof AnalysisCapabilities["features"]): boolean {
  const feature = manifest.features[id];
  return feature.status === "available" && feature.implementation === "implemented";
}
function stateView(result: AnalysisResult | null, error: string | null, denied: boolean) {
  if (denied) return <DataState kind="unsupported" title="この分析は提供されていません" />;
  if (error) return <DataState kind="source-unavailable" detail={error} />;
  if (!result) return <LoadingSkeleton />;
  if (result.status === "empty") return <DataState kind="no-data" detail={result.reason} />;
  if (result.status === "unavailable") return <DataState kind="unsupported" detail={result.reason} />;
  if (result.status === "not-implemented") return <DataState kind="not-implemented" detail={result.reason} />;
  if (result.status === "error") return <DataState kind="source-unavailable" detail={result.reason} />;
  return null;
}

export function DirectMatchup({ result, league }: { result: Extract<AnalysisResult, { status: "data" }>; league: PlayerCatalog["league"] }) {
  const split = firstSplit(result);
  if (!split) return <DataState kind="no-data" />;
  return <div className="matchup-direct"><div className="matchup-direct__head"><strong>直接対戦</strong>
    <SampleBadge split={split} subject="batter" group="none" warningContext="directMatchup" /></div>
    <SplitMetrics split={split} league={league} compact />
    <details className="advanced-disclosure"><summary>成績の詳細<ChevronRight size={18} /></summary>
      <SplitMetrics split={split} league={league} /></details></div>;
}

function pitchLabel(split: Split) {
  const type = Object.hasOwn(pitchTypeDefinitions, split.key) ? split.key as keyof typeof pitchTypeDefinitions : null;
  return type ? formatPitchType(type) : split.label;
}
export function ArsenalVsBatter({ pitcher, batter, league }: {
  pitcher: Extract<AnalysisResult, { status: "data" }>;
  batter: Extract<AnalysisResult, { status: "data" }>;
  league: PlayerCatalog["league"];
}) {
  const byType = new Map(batter.splits.map((split) => [split.key, split]));
  return <div className="analysis-list">{pitcher.splits.map((pitch) => {
    const against = byType.get(pitch.key);
    const usage = pitch.metrics.find((item) => item.definitionId === "usagePct");
    const type = Object.hasOwn(pitchTypeDefinitions, pitch.key) ? pitch.key : null;
    const percentage = usage?.value.status === "available" ? Math.max(0, Math.min(100, usage.value.value * 100)) : 0;
    return <details className="analysis-row" key={pitch.key}><summary>
      <span className={`pitch-mark${type ? ` pitch-mark--${type}` : ""}`} aria-hidden="true" />
      <span className="analysis-row__label"><strong>{pitchLabel(pitch)}</strong>
        <SampleBadge split={pitch} subject="pitcher" group="pitch-type" /></span>
      <span className="matchup-pitch-values"><small>投手 使用率</small><strong>{usage ? formatSplitMetric(usage) : "—"}</strong></span>
      <ChevronRight size={18} aria-hidden="true" /></summary>
      {usage?.value.status === "available" && <div className="pitch-usage"><span style={{ width: `${percentage}%` }} /></div>}
      <div className="analysis-row__detail"><div className="matchup-compare-columns"><div><strong>投手</strong>
        <SplitMetrics split={pitch} league={league} /></div><div><strong>打者 vs {pitchLabel(pitch)}</strong>
          {against ? <><SampleBadge split={against} subject="batter" group="pitch-type" />
            <SplitMetrics split={against} league={league} /></>
            : <DataState kind="no-data" title="この球種の打者成績はありません" />}</div></div></div>
    </details>;
  })}</div>;
}

function PlayerPicker({ catalog, kind, selected, onSelect }: {
  catalog: PlayerCatalog; kind: "pitcher" | "batter"; selected: Player | null; onSelect: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(!selected);
  const candidates = catalog.profiles.filter(({ player }) => catalog.statistics.some((stat) =>
    stat.playerId === player.id && stat.group === (kind === "pitcher" ? "pitching" : "hitting")));
  const matches = candidates.filter(({ player }) => [player.names.canonical, player.names.japanese,
    player.names.english, ...player.searchNames].filter(Boolean).join(" ").normalize("NFKC")
    .toLocaleLowerCase("ja-JP").includes(search.normalize("NFKC").toLocaleLowerCase("ja-JP")));
  return <div className="matchup-picker"><label>{kind === "pitcher" ? "投手" : "打者"}
    {editing && <span className="search-field"><Search size={18} /><input type="search" value={search}
      placeholder={kind === "pitcher" ? "投手を検索" : "打者を検索"}
      onChange={(event) => setSearch(event.target.value)} /></span>}</label>
    {selected && <p className="muted">選択中：{formatPlayerName(selected)}</p>}
    {editing && <div className="matchup-picker__results">{matches.map(({ player }) => {
      const team = catalog.teams.find((item) => item.id === player.teamId);
      return <button type="button" key={player.id} onClick={() => { onSelect(player.id); setSearch(""); setEditing(false); }}>
        <TeamBrand team={team} size="sm" /><span><strong>{formatPlayerName(player)}</strong>
          <small>{formatTeamName(team, "short")} · {player.positions.join(" / ")} · {catalog.league}</small></span>
        <ChevronRight size={18} /></button>;
    })}{matches.length === 0 && <DataState kind="no-data" title="該当する選手がいません" />}</div>}
    {selected && !editing && <button type="button" className="text-button" onClick={() => setEditing(true)}>選び直す</button>}
  </div>;
}

function MatchupDetail({ catalog, pitcher, batter, provider }: {
  catalog: PlayerCatalog; pitcher: Player; batter: Player; provider: AnalysisProvider;
}) {
  const [section, setSection] = useState<Section>("summary");
  const manifest = useMemo(() => capabilityManifestSchema.parse(provider.capabilities(catalog.league)), [provider, catalog.league]);
  const queries = useMemo(() => {
    const base = { league: catalog.league, pitcherId: pitcher.id, batterId: batter.id, manifest };
    return { direct: matchupQuery({ ...base, section: "direct" }),
      pitcherPitch: matchupQuery({ ...base, section: "arsenal", actor: "pitcher" }),
      batterPitch: matchupQuery({ ...base, section: "arsenal", actor: "batter" }),
      pitcherCount: matchupQuery({ ...base, section: "count", actor: "pitcher" }),
      batterCount: matchupQuery({ ...base, section: "count", actor: "batter" }),
      pitcherRecent: matchupQuery({ ...base, section: "recent", actor: "pitcher" }),
      batterRecent: matchupQuery({ ...base, section: "recent", actor: "batter" }),
    };
  }, [catalog.league, pitcher.id, batter.id, manifest]);
  const directGate = assessAnalysisQuery(queries.direct, manifest).enabled;
  const pitchGate = available(manifest, "pitchTypeMatchup") &&
    assessAnalysisQuery(queries.pitcherPitch, manifest).enabled && assessAnalysisQuery(queries.batterPitch, manifest).enabled;
  const countGate = available(manifest, "countMatchup") &&
    assessAnalysisQuery(queries.pitcherCount, manifest).enabled && assessAnalysisQuery(queries.batterCount, manifest).enabled;
  const recentGate = available(manifest, "recentMatchup") &&
    assessAnalysisQuery(queries.pitcherRecent, manifest).enabled && assessAnalysisQuery(queries.batterRecent, manifest).enabled;
  const direct = useAnalysisData(provider, queries.direct, directGate && ["summary", "direct"].includes(section));
  const pitcherPitch = useAnalysisData(provider, queries.pitcherPitch, pitchGate && ["summary", "arsenal"].includes(section));
  const batterPitch = useAnalysisData(provider, queries.batterPitch, pitchGate && ["summary", "arsenal"].includes(section));
  const pitcherCount = useAnalysisData(provider, queries.pitcherCount, countGate && section === "count");
  const batterCount = useAnalysisData(provider, queries.batterCount, countGate && section === "count");
  const attention = attentionPitch(pitcherPitch.result, batterPitch.result);
  const snapshots = [direct.result, pitcherPitch.result, batterPitch.result, pitcherCount.result, batterCount.result]
    .filter((value): value is Extract<AnalysisResult, { status: "data" | "empty" }> =>
      value?.status === "data" || value?.status === "empty");
  const completeThrough = snapshots.map((value) => value.coverage.completeThrough).sort()[0];
  const pitcherTeam = catalog.teams.find((item) => item.id === pitcher.teamId);
  const batterTeam = catalog.teams.find((item) => item.id === batter.teamId);
  const sections: { id: Section; label: string; show: boolean }[] = [
    { id: "summary", label: "概要", show: true }, { id: "direct", label: "直接対戦", show: directGate },
    { id: "arsenal", label: "球種", show: pitchGate }, { id: "count", label: "カウント", show: countGate },
    { id: "recent", label: "変化", show: recentGate },
  ];
  return <>
    <div className="matchup-versus"><div><TeamBrand team={pitcherTeam} size="md" /><small>投手</small><strong>{formatPlayerName(pitcher)}</strong></div>
      <span>VS</span><div><TeamBrand team={batterTeam} size="md" /><small>打者</small><strong>{formatPlayerName(batter)}</strong></div></div>
    <p className="analysis-cutoff">分析データは前日終了時点 · {completeThrough ? `${formatDate(completeThrough, true)}終了時点` : "更新日時はデータ取得後に表示"}</p>
    {snapshots.some((value) => value.freshness.state === "stale") &&
      <DataState kind="source-unavailable" title="保存済みの古い分析データです" />}
    <nav className="analysis-nav chip-list" aria-label="対戦分析カテゴリー">{sections.filter((item) => item.show).map((item) =>
      <button type="button" className="filter-chip" key={item.id} aria-current={section === item.id ? "page" : undefined}
        onClick={() => setSection(item.id)}>{item.label}</button>)}</nav>
    {section === "summary" && <section><SectionHeader title="この対戦の注目点" />
      {direct.result?.status === "data" && <DirectMatchup result={direct.result} league={catalog.league} />}
      {attention && <div className="matchup-attention"><strong>{pitchLabel(attention.pitcher)}に注目</strong>
        <p>投手の主な球種と、打者の同球種への成績を比較</p>
        <div className="matchup-compare-columns"><div><strong>投手</strong><SampleBadge split={attention.pitcher} subject="pitcher" group="pitch-type" />
          <SplitMetrics split={attention.pitcher} league={catalog.league} compact /></div>
          <div><strong>打者</strong><SampleBadge split={attention.batter} subject="batter" group="pitch-type" />
            <SplitMetrics split={attention.batter} league={catalog.league} compact /></div></div></div>}
      {!directGate && !pitchGate && <DataState kind="unsupported" title="この提供元に対戦分析データはありません" />}
      {directGate && direct.result?.status !== "data" && stateView(direct.result, direct.error, false)}
      {pitchGate && !attention && (pitcherPitch.error || batterPitch.error
        ? <DataState kind="source-unavailable" title="球種比較の一部を取得できませんでした" />
        : !pitcherPitch.result || !batterPitch.result ? <LoadingSkeleton />
          : pitcherPitch.result.status === "data" && batterPitch.result.status === "data"
            ? <p className="muted">球種比較はサンプル数と基準日が揃う場合に表示します。</p>
            : <DataState kind="no-data" title="球種比較に必要な集計が揃っていません" />)}
    </section>}
    {section === "direct" && <section><SectionHeader title="直接対戦" />
      {direct.result?.status === "data" ? <DirectMatchup result={direct.result} league={catalog.league} />
        : stateView(direct.result, direct.error, !directGate)}</section>}
    {section === "arsenal" && <section><SectionHeader title="投手の球種 × 打者の成績" />
      {pitcherPitch.result?.status === "data" && batterPitch.result?.status === "data"
        ? <ArsenalVsBatter pitcher={pitcherPitch.result} batter={batterPitch.result} league={catalog.league} />
        : <>{stateView(pitcherPitch.result, pitcherPitch.error, !pitchGate)}
          {pitcherPitch.result?.status === "data" && <><AnalysisDataView result={pitcherPitch.result}
            category="pitch" subject="pitcher" league={catalog.league} />
            {stateView(batterPitch.result, batterPitch.error, false)}</>}
          {batterPitch.result?.status === "data" && pitcherPitch.result?.status !== "data" &&
            <AnalysisDataView result={batterPitch.result} category="pitch" subject="batter" league={catalog.league} />}</>}
    </section>}
    {section === "count" && <section><SectionHeader title="カウント別の傾向" />
      <p className="muted">そのカウントで投じられた球への反応。到達打席の最終成績とは別です。</p>
      <h3>投手の配球</h3>{pitcherCount.result?.status === "data"
        ? <AnalysisDataView result={pitcherCount.result} category="count" subject="pitcher" league={catalog.league} />
        : stateView(pitcherCount.result, pitcherCount.error, !countGate)}
      <h3>打者の反応</h3>{batterCount.result?.status === "data"
        ? <AnalysisDataView result={batterCount.result} category="count" subject="batter" league={catalog.league} />
        : stateView(batterCount.result, batterCount.error, !countGate)}</section>}
    {section === "recent" && <section><SectionHeader title="最近30日とシーズン" />
      <h3>投手</h3><RecentChange provider={provider} query={queries.pitcherRecent} manifest={manifest} subject="pitcher" />
      <h3>打者</h3><RecentChange provider={provider} query={queries.batterRecent} manifest={manifest} subject="batter" /></section>}
    <div className="matchup-analysis-links"><Link to={`/${catalog.league}/players/${encodeURIComponent(pitcher.id)}/analysis`}>投手分析<ChevronRight size={16} /></Link>
      <Link to={`/${catalog.league}/players/${encodeURIComponent(batter.id)}/analysis`}>打者分析<ChevronRight size={16} /></Link></div>
  </>;
}

export function MatchupScreen({ catalog, provider }: { catalog: PlayerCatalog; provider: AnalysisProvider }) {
  const [params, setParams] = useSearchParams();
  const pitcher = catalog.profiles.find(({ player }) => player.id === params.get("pitcher") &&
    catalog.statistics.some((stat) => stat.playerId === player.id && stat.group === "pitching"))?.player ?? null;
  const batter = catalog.profiles.find(({ player }) => player.id === params.get("batter") &&
    catalog.statistics.some((stat) => stat.playerId === player.id && stat.group === "hitting"))?.player ?? null;
  const select = (kind: "pitcher" | "batter", id: string) => {
    const next = new URLSearchParams(params);
    next.set(kind, id);
    setParams(next);
  };
  return <div className="screen matchup-screen"><Link className="back-link" to={`/${catalog.league}/analysis`}><ArrowLeft size={18} />分析に戻る</Link>
    <PageHeading eyebrow={`${catalog.league} / 対戦`} title="MATCHUP" detail="投手と打者を選んで、前日までの傾向を見る" />
    {(!pitcher || !batter) && <div className="matchup-selectors">
      <PlayerPicker catalog={catalog} kind="pitcher" selected={pitcher} onSelect={(id) => select("pitcher", id)} />
      <PlayerPicker catalog={catalog} kind="batter" selected={batter} onSelect={(id) => select("batter", id)} />
    </div>}
    {pitcher && batter && <><button type="button" className="text-button" onClick={() => {
      const next = new URLSearchParams(params); next.delete("pitcher"); next.delete("batter"); setParams(next);
    }}>選手を変更</button><MatchupDetail key={`${pitcher.id}:${batter.id}`} catalog={catalog}
      pitcher={pitcher} batter={batter} provider={provider} /></>}
  </div>;
}
