import { useId } from "react";
import "./inning-scoreboard.css";

import type { InningCell } from "../domain/inning-score";
export type ScoreboardTeam = { name: string; runs: number | null; innings?: readonly InningCell[]; hits?: number | null; errors?: number | null };
const known = (n: number | null | undefined) => typeof n === "number" && Number.isInteger(n) && n >= 0;
function cell(value: InningCell | undefined) {
  if (value === "X") return { text: "X", label: "攻撃なし" };
  if (value === "pending") return { text: "・", label: "まだ開始していない攻撃" };
  if (typeof value === "string" && /^\d+x$/.test(value)) return { text: value, label: `${value.slice(0, -1)}得点、サヨナラ終了` };
  return known(value as number | null) ? { text: String(value), label: `${value}得点` } : { text: "—", label: "得点未収録" };
}
/** Presentation only: never infer an inning, a final, hits or errors from totals. */
export function InningScoreboard({ away, home,completedInnings }: { away: ScoreboardTeam; home: ScoreboardTeam;completedInnings?:number }) {
  const id = useId(), columns = Math.min(30, Math.max(9, away.innings?.length ?? 0, home.innings?.length ?? 0));
  const teams = [away, home], hits = teams.some(t => known(t.hits)), errors = teams.some(t => known(t.errors));
  return <section className="inning-board" aria-labelledby={id}>
    <h2 id={id}>イニング別得点</h2>
    <div className="inning-board__scroll" tabIndex={0} role="region" aria-label="イニング別得点。左右にスクロールできます">
      <table className="inning-board__table"><caption className="sr-only">{away.name} 対 {home.name}のイニング別得点</caption>
        <thead><tr><th scope="col">球団</th>{Array.from({ length: columns }, (_, i) => <th scope="col" key={i} aria-label={`${i + 1}回`}>{i + 1}</th>)}<th scope="col" className="inning-board__total">計</th>{hits && <th scope="col">安</th>}{errors && <th scope="col">失</th>}</tr></thead>
        <tbody>{teams.map((t, side) => <tr key={side}><th scope="row">{t.name}</th>{Array.from({ length: columns }, (_, i) => { const c = completedInnings!==undefined&&i>=completedInnings?{text:"",label:"試合終了後のため攻撃なし"}:cell(t.innings?.[i]); return <td key={i} aria-label={c.label}>{c.text}</td>; })}<td className="inning-board__total" aria-label={known(t.runs) ? `${t.runs}得点` : "合計得点未収録"}>{known(t.runs) ? t.runs : "—"}</td>{hits && <td>{known(t.hits) ? t.hits : "—"}</td>}{errors && <td>{known(t.errors) ? t.errors : "—"}</td>}</tr>)}</tbody>
      </table>
    </div>
    <p className="inning-board__legend">— 未収録 · X 攻撃なし · x サヨナラ{completedInnings!==undefined&&completedInnings<9&&" · 空欄は試合終了後"}{teams.some(t => t.innings?.includes("pending")) && " · ・開始前"}</p>
  </section>;
}
