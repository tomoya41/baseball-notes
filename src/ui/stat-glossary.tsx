import { useSearchParams } from "react-router-dom";
import { glossaryKeys, metricHelp } from "../presentation/metric-help";
import { normalizePlayerSearch } from "../domain/npb-player-directory";
import { DataState, MetricLabel, PageHeading } from "./components";
import { ExplorerLinks } from "./data-explorer";
export function StatGlossary({ league }: { league: "NPB" | "MLB" }) {
  const [params, setParams] = useSearchParams(), query = params.get("q") ?? "";
  const scope = new URLSearchParams(params); scope.delete("q");
  const keys = glossaryKeys.filter(key => { const help = metricHelp(key); return help && (league === "MLB" || key !== "RISP") && normalizePlayerSearch(`${key}${help.fullName}${help.description}`).includes(normalizePlayerSearch(query)); });
  return <div className="screen"><PageHeading eyebrow={`${league} · DATA GUIDE`} title="指標ガイド" /><ExplorerLinks league={league} scope={`?${scope}`} /><label className="search-field"><span className="sr-only">指標を検索</span><input type="search" value={query} placeholder="OPS・出塁率など" onChange={e => setParams(previous => { const next = new URLSearchParams(previous); next.set("q", e.target.value); return next; }, { replace: true })} /></label><p className="inline-note">画面内のⓘからも同じ説明を開けます。提供される指標はリーグ・期間・Capabilityで異なります。</p>{!keys.length && <DataState kind="no-data" title="一致する表示指標がありません" />}<div className="row-list">{keys.map(key => { const value = metricHelp(key)!; return <article className="explorer-result" key={key}><h2><MetricLabel metric={key} /> · {value.fullName}</h2><p>{value.description}</p><p className="inline-note">{value.interpretation}</p></article>; })}</div></div>;
}
