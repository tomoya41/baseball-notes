import type { NpbHistoricalRow } from "../domain/npb-historical";
import { collectedRecordCheckpoints } from "../domain/npb-collected-records";
import { comparisonValue } from "../domain/product-comparison";
import { MetricLabel } from "./components";

export function CollectedRecordWatch({rows}:{rows:NpbHistoricalRow[]}) {
  const checkpoints=collectedRecordCheckpoints(rows);
  if(!checkpoints.length)return null;
  return <section aria-label="収録分の記録ウォッチ"><h3>記録への歩み</h3><p className="inline-note">{checkpoints[0]!.seasons.join(" / ")}年 · 収録分合計</p>
    <dl className="explorer-values">{checkpoints.map(c=><div key={c.metric}><dt><MetricLabel metric={c.metric} label={c.metric==="outsRecorded"?"投球回":c.metric} /></dt><dd>{comparisonValue(c.metric,c.value)}<small style={{display:"block",fontWeight:400}}>{c.remaining===null?"構成値に未収録があるため計算できません":`収録分で ${comparisonValue(c.metric,c.next)} まであと ${comparisonValue(c.metric,c.remaining)}`}</small>{c.lastRecorded!==null&&<small style={{display:"block",fontWeight:400}}>収録分は {comparisonValue(c.metric,c.lastRecorded)} を記録</small>}</dd></div>)}</dl>
    <details><summary>節目と収録範囲について</summary><p>完全な通算記録・達成日・達成予測ではありません。安打は500、本塁打・盗塁は100、勝利は50、奪三振は500、投球回は1,000回刻みのアプリ内の目安です。未収録年度・球団・成績は補わず、一つでも必要な数値が不明な指標は計算しません。現在の通算への残り数や自動通知ではありません。</p></details>
  </section>;
}
