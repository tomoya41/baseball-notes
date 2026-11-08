import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { Services } from "../app/services";
import { readNpbHistoricalManifest } from "../application/npb-historical-reader";
import { readNpbPlayerSeasonComparison, type NpbSeasonComparisonRow } from "../application/npb-player-season-comparison";
import { canonicalEntityRefSchema, normalizePlayerSearch } from "../domain/cross-league";
import type { NpbHistoricalManifest } from "../domain/npb-historical";
import type { NpbPlayerDirectory } from "../domain/npb-player-directory";
import { npbSeasonComparisonCurrentYear as currentYear, npbSeasonComparisonMetricKeys, npbSeasonComparisonYears } from "../domain/npb-season-comparison";
import { comparisonValue, metricNumber } from "../domain/product-comparison";
import { npbTeamShortName } from "../presentation/npb-team-names";
import { ComparisonBars } from "./comparison-bars";
import { DataState, LoadingSkeleton, PageHeading } from "./components";
import { HistoricalCredits } from "./npb-historical-credits";
import { SaveViewButton } from "./personal-library";
import "./npb-historical-comparison.css";

const labels: Record<string, string> = { AB: "打数", AVG: "打率", BB: "四球", BF: "対戦打者", ER: "自責点", ERA: "防御率",
  G: "試合", GS: "先発", H: "安打", HR: "本塁打", K9: "奪三振率（9回あたり）", L: "敗戦", OBP: "出塁率", PA: "打席",
  R: "失点", RBI: "打点", SLG: "長打率", SO: "三振", SV: "セーブ", W: "勝利", outsRecorded: "投球回" };

export function NpbPlayerSeasonCompare({ directory }: { directory: Services["directory"] }) {
  const [params, setParams] = useSearchParams(), [search, setSearch] = useState("");
  const [manifest, setManifest] = useState<NpbHistoricalManifest | null | undefined>(undefined);
  const [players, setPlayers] = useState<NpbPlayerDirectory["players"] | null>(null);
  const [directoryFailed, setDirectoryFailed] = useState(false), [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ key: string; rows: NpbSeasonComparisonRow[] }>();
  const entity = params.get("entity") ?? "", requestedRole = params.get("role") ?? "batting";
  const role = requestedRole === "pitching" ? "pitching" : "batting", rawYears = params.get("years");
  const validScope = (params.get("competition") ?? "regular") === "regular" && !params.has("stage") &&
    (!params.has("season") || /^20\d{2}$/.test(params.get("season")!) && Number(params.get("season")) <= currentYear) &&
    (requestedRole === "batting" || requestedRole === "pitching");
  const parsedYears = npbSeasonComparisonYears(rawYears ?? "");
  const validYears = rawYears === null || rawYears === "" || parsedYears.length > 0;
  const validEntity = canonicalEntityRefSchema.safeParse({ league: "NPB", kind: "player", id: entity }).success;
  const historical = manifest?.players.find(player => player.playerId === entity);
  const previous = historical?.seasons.filter(year => year < currentYear).at(-1);
  const selected = rawYears === null ? previous ? [previous, currentYear] : [currentYear] :
    parsedYears;
  const selection = selected.join(","), key = `${entity}:${role}:${selection}:${retry}:${manifest?.inputSha256 ?? "saved"}`;

  useEffect(() => {
    if (!validScope || !validYears) return;
    let active = true;
    void readNpbHistoricalManifest().then(value => { if (active) setManifest(value); }).catch(() => { if (active) setManifest(null); });
    void directory.findLatestNpb().then(value => {
      if (active) { setPlayers(value.players); setDirectoryFailed(false); }
    }).catch(() => { if (active) setDirectoryFailed(true); });
    return () => { active = false; };
  }, [directory, retry, validScope, validYears]);
  useEffect(() => {
    if (!validScope || !validEntity || !selection || manifest === undefined) return;
    let active = true;
    void readNpbPlayerSeasonComparison(entity, role, selection.split(",").map(Number), manifest, directory).then(rows => {
      if (active) setResult({ key, rows });
    });
    return () => { active = false; };
  }, [directory, entity, key, manifest, role, selection, validEntity, validScope]);

  const update = (k: string, v: string) => setParams(previousParams => {
    const next = new URLSearchParams(previousParams);
    next.set(k, v);
    if (k === "entity") next.delete("years");
    return next;
  });
  const current = players?.find(player => player.playerId === entity), name = current?.displayName ?? historical?.name;
  const candidates = new Map(manifest?.players.map(player => [player.playerId, player.name]));
  for (const player of players ?? []) candidates.set(player.playerId, player.displayName);
  const years = [...new Set([...(manifest?.seasons.map(year => year.season) ?? []), ...selected, currentYear])].sort((a, b) => b - a);
  const metricKeys = npbSeasonComparisonMetricKeys(role);
  const metric = metricKeys.find(k => params.get("metric") === k) ?? (role === "batting" ? "OPS" : "ERA");
  const labelFor = (key: string) => key === "SO" && role === "pitching" ? "奪三振" : labels[key] ?? key;
  const metricLabel = labelFor(metric), sampleKey = role === "batting" ? "PA" : "outsRecorded";
  const rows = result?.key === key ? result.rows : null;
  const savedParams = validEntity && selected.length && (rawYears !== null || manifest !== undefined) ?
    new URLSearchParams({ seasonCompare: "1", player: entity, role, years: selection, metric, competition: "regular" }) : null;
  const sources = rows?.filter(row => row.state === "ready") ?? [];
  return <div className="screen npb-season-comparison">
    <PageHeading eyebrow="NPB · 公式戦" title="年度別の成績を比較" />
    <Link to="/NPB/season-compare?kind=team">球団の年度比較 →</Link>
    {!validScope || !validYears ? <DataState kind="unsupported" title="指定の年度や試合区分の成績は未収録です" action="公式戦の年度比較へ" to="/NPB/season-compare" /> : <>
      <details className="historical-comparison-filters" open={!entity}><summary>{name ?? "比較する選手を選ぶ"}</summary>
        <label className="search-field"><span className="sr-only">選手名</span><input type="search" placeholder="選手名で検索" value={search} onChange={e => setSearch(e.target.value)} /></label>
        <div className="row-list">{[...candidates].filter(([, label]) => normalizePlayerSearch(label).includes(normalizePlayerSearch(search))).slice(0, 12).map(([id, label]) =>
          <button className="player-row" key={id} onClick={() => { update("entity", id); setSearch(""); }}>{label}</button>)}</div>
      </details>
      <div className="explorer-filter-grid">
        <label>打撃・投球<select value={role} onChange={e => update("role", e.target.value)}><option value="batting">打撃</option><option value="pitching">投球</option></select></label>
        <label>比較指標<select value={metric} onChange={e => update("metric", e.target.value)}>{metricKeys.map(k => <option value={k} key={k}>{labelFor(k)}</option>)}</select></label>
      </div>
      <details className="historical-comparison-filters"><summary>比較する年度 {selected.length ? selected.map(year => `${year}年`).join("・") : "未選択"}</summary>
        <fieldset className="comparison-years"><legend>年度を選ぶ（最大4年）</legend>{years.map(year => <label key={year}><input type="checkbox" checked={selected.includes(year)}
          disabled={selected.length >= 4 && !selected.includes(year)}
          onChange={() => update("years", (selected.includes(year) ? selected.filter(value => value !== year) : [...selected, year]).join(","))} />{year}年</label>)}</fieldset>
      </details>
      {savedParams && <SaveViewButton key={savedParams.toString()} league="NPB" kind="history" params={savedParams}
        placeholder={name ? `例：${name}の${metricLabel}` : "例：2025年と2026年の比較"} />}
      {entity && !validEntity ? <DataState kind="unsupported" title="指定した選手IDを確認できません" /> : validEntity && (selected.length === 0 ? <p>比較する年度を選んでください。</p> :
        !rows ? <LoadingSkeleton /> : <section className="historical-comparison" aria-label="選手の年度別成績比較">
          <h2>{name ?? "指定した選手"}</h2>
          <ComparisonBars rows={rows.map(row => ({ id: String(row.year), name: `${row.year}年`, metrics: row.state === "ready" ? row.metrics : null }))}
            metric={metric} context={{ label: metricLabel, note: "棒は成績の値を表します。年度ごとの収録範囲と母数をあわせて確認してください。", render: id => {
              const row = rows.find(observation => String(observation.year) === id)!;
              if (row.state !== "ready") return <p className="historical-comparison-reason">{row.state === "unavailable" ? "この年の成績を読み込めませんでした。" : `この年の${role === "batting" ? "打撃" : "投球"}成績は未収録です。`}</p>;
              const sample = metricNumber(row.metrics, sampleKey), saved = row.source.kind === "saved";
              return <>
                <dl className="historical-comparison-scope">
                  <div><dt>母数</dt><dd>{sample === null ? "未収録" : `${comparisonValue(sampleKey, sample)}${role === "batting" ? "打席" : "回"}`}</dd></div>
                  <div><dt>収録範囲</dt><dd>{row.source.kind === "saved" ? `公式戦 ${row.source.from}〜${row.source.to} · ${row.source.coverage === "complete" ? "対象期間を収録" : row.source.coverage === "partial" ? "一部収録" : "収録範囲は未確認"}` : "公式戦・球団別成績（一部収録）"}</dd></div>
                  <div><dt>対象球団</dt><dd>{row.source.kind === "archive" ? row.source.teams.map(npbTeamShortName).join(" / ") : "球団別の内訳は未収録"}</dd></div>
                  <div><dt>{saved ? "公開データの基準日" : "資料の確認日"}</dt><dd>{row.source.kind === "saved" ? row.source.effectiveDate : row.source.observedAt.slice(0, 10)}</dd></div>
                </dl>
                {metricNumber(row.metrics, metric) === null && <p className="historical-comparison-reason">
                  {metric === "ERA" && sample === 0 ? "記録された投球アウトが0のため、防御率を計算できません。" :
                    "この指標の値や、計算に必要な内訳が収録されていません。"}
                </p>}
                {row.metrics[metric]?.status === "partial" && saved && <p className="inline-note">この指標は収録済みの成績から集計しています。</p>}
                <div className="historical-comparison-actions"><Link to={`/NPB/players/${entity}/seasons?season=${row.year}&role=${role}`}>{row.year}年の年度成績 →</Link></div>
              </>;
            } }} />
          {sources.length > 0 && <details className="season-comparison-sources"><summary>データの出典</summary>
            <ul>{sources.map(row => <li key={row.year}><strong>{row.year}年 </strong>{row.source.kind === "archive" ?
              <HistoricalCredits data={row.source.credits} playerId={entity} /> :
              <span><a href="https://nf3.sakura.ne.jp/" target="_blank" rel="noreferrer">nf3</a>の成績を集計した保存版。更新状況は未確認です。</span>}</li>)}</ul>
          </details>}
        </section>)}
      {(manifest === null || directoryFailed || rows?.some(row => row.state === "unavailable")) && <div><p role="status">比較に必要なデータの一部を読み込めませんでした。</p><button type="button" onClick={() => setRetry(value => value + 1)}>もう一度読み込む</button></div>}
      {current && <Link to={`/NPB/players/${entity}`}>選手プロフィールへ →</Link>}
    </>}
  </div>;
}
