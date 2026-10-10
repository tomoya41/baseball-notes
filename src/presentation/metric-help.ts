import { metrics } from "../domain/metrics";
import type { MetricDefinition } from "../domain/models";

export type MetricHelp = Pick<MetricDefinition, "name" | "fullName" | "description" | "interpretation" | "caveat"> & { formula?: string; data?: string; sample?: string; scope?: string };
const context: Record<string, Pick<MetricHelp, "formula" | "data" | "sample" | "scope">> = {
  AVG: { formula: "安打 ÷ 打数", data: "保存済みの安打・打数", sample: "打数が少ないほど変動します。探索の最低サンプルと公式規定は別です。" },
  OBP: { formula: "(安打＋四球＋死球) ÷ (打数＋四球＋死球＋犠飛)", data: "構成項目に欠測がある場合は完全な値として扱いません。", sample: "打席数を確認。出塁の定義に失策・野選は含みません。" },
  SLG: { formula: "(安打＋二塁打＋三塁打×2＋本塁打×3) ÷ 打数", data: "安打と各長打・打数", sample: "打数と球場・シーズンの違いを確認してください。" },
  OPS: { formula: "OBP ＋ SLG", data: "保存済みの出塁率・長打率", sample: "少数打席では極端な値になります。走塁・守備の評価は含みません。" },
  ERA: { formula: "自責点 × 27 ÷ 記録したアウト数", data: "自責点・投手アウト数。失点とは別です。", sample: "少ない投球回では大きく変動。球場・守備等の影響も受けます。" },
  K9: { formula: "奪三振 × 27 ÷ 記録したアウト数", data: "奪三振・投手アウト数", sample: "短い投球回では変動。失点を抑えたかどうかとは別の観点です。" },
  WHIP: { formula: "(被安打＋与四球) × 3 ÷ 投球アウト数", data: "MLB Historicalの独立したH・BB・outs。死球は含みません。", sample: "投球回が少ないと変動。0アウトまたは必要項目未提供なら計算しません。" },
  BB9: { formula: "与四球 × 27 ÷ 投球アウト数", data: "MLB Historicalの与四球（敬遠を含み、死球を除く）", sample: "少ない投球回では変動。低いほど与四球の頻度が低い傾向です。" },
  "K%": { formula: "三振 ÷ 打席（打者）／対戦打者（投手） × 100", data: "MLB HistoricalのSO・PA/BF。打者と投手で分母が異なります。", sample: "打席・対戦打者が少ないと変動。打者は低いほど、投手は高いほど三振の頻度を表します。" },
  "BB%": { formula: "四球 ÷ 打席（打者）／対戦打者（投手） × 100", data: "MLB Historicalの独立したBB（敬遠を含む）・PA/BF。死球は分子に含みません。", sample: "打者は高いほど四球を選び、投手は低いほど四球を抑える傾向。小サンプルは慎重に読みます。" },
  IP: { formula: "アウト数 ÷ 3（余りを1/3回単位で表示）", data: "canonicalの投手アウト数", sample: "6.1は6回と1アウト。6.1という小数の投球回ではありません。" },
};
export const glossaryKeys = ["G", "GS", "PA", "AB", "H", "2B", "3B", "HR", "R", "RBI", "BB", "HBP", "SH", "SF", "SO", "SB", "CS", "AVG", "OBP", "SLG", "OPS", "IP", "BF", "ER", "ERA", "K9", "W", "L", "SV", "HLD", "RISP", "WHIP", "BB9", "K%", "BB%"] as const;
const help: Record<string, MetricHelp> = {
  BB9: { name: "BB/9", fullName: "9回あたりの与四球", description: "与四球を9回に換算した頻度。死球は含みません。", interpretation: "低いほど四球を与える頻度が低い傾向です。" },
  "K%": metrics.kPct!, "BB%": metrics.bbPct!,
  G: { name: "G", fullName: "出場・登板数", description: "保存済み成績がある試合数。打者の出場数と投手の登板数は別に集計します。", interpretation: "多さだけで成績の良し悪しは判断しません。" },
  GS: { name: "GS", fullName: "先発登板数", description: "先発と確認できる投手登板の数。", interpretation: "役割が不明な登板を先発と推定しません。" },
  "2B": { name: "2B", fullName: "二塁打", description: "対象範囲の二塁打数。", interpretation: "出場機会と合わせて確認します。" },
  "3B": { name: "3B", fullName: "三塁打", description: "対象範囲の三塁打数。", interpretation: "出場機会と合わせて確認します。" },
  R: { name: "R", fullName: "得点・失点", description: "打者では得点数、投手では失点数です。", interpretation: "投手の自責点（ER）とは異なります。文脈を確認してください。" },
  RBI: { name: "RBI", fullName: "打点", description: "打撃によって記録された打点数。", interpretation: "走者のいる機会にも左右されます。値だけで打者全体の評価はできません。" },
  HBP: { name: "HBP", fullName: "死球・与死球", description: "打者では受けた死球、投手では与えた死球の数。", interpretation: "与四球と混ぜず、出典で分離された値だけを利用します。" },
  SH: { name: "SH", fullName: "犠打", description: "記録上の犠打数。", interpretation: "打席には含めますが、打数には含めません。" },
  SF: { name: "SF", fullName: "犠飛", description: "記録上の犠牲フライ数。", interpretation: "打席には含め、打数には含めません。出塁率の分母には含みます。" },
  SB: { name: "SB", fullName: "盗塁", description: "記録された盗塁数。", interpretation: "盗塁死・機会数も合わせて確認します。" },
  CS: { name: "CS", fullName: "盗塁死", description: "盗塁に失敗してアウトになった数。", interpretation: "多さだけでなく盗塁機会と合わせて読みます。" },
  ER: { name: "ER", fullName: "自責点", description: "公式記録上、その投手の責任とされた失点数。", interpretation: "失点すべてが自責点になるわけではありません。防御率の計算に使います。" },
  W: { name: "W", fullName: "勝利", description: "勝利投手として記録された回数。", interpretation: "投手個人だけでなく打線・継投等にも左右されます。" },
  L: { name: "L", fullName: "敗戦", description: "敗戦投手として記録された回数。", interpretation: "登板数・失点等と合わせて確認します。" },
  SV: { name: "SV", fullName: "セーブ", description: "セーブとして記録された登板数。", interpretation: "役割・セーブ機会に左右されます。条件を独自に推測しません。" },
  HLD: { name: "HLD", fullName: "ホールド", description: "出典でホールドとして記録された数。", interpretation: "リーグ・出典での提供範囲を確認してください。取得できない場合は0としません。" },
  OBP: { name: "OBP", fullName: "出塁率", description: "安打・四球・死球で出塁する割合。（安打＋四球＋死球）÷（打数＋四球＋死球＋犠飛）で計算します。", interpretation: "高いほどアウトにならずに出塁しています。.350なら、この計算の対象機会の35%で出塁。", caveat: "失策や野選による出塁は含みません。打席数と一緒に確認してください。" },
  SLG: { name: "SLG", fullName: "長打率", description: "1打数あたりの塁打数。単打は1、二塁打は2、三塁打は3、本塁打は4として合計し、打数で割ります。", interpretation: "高いほど多くの塁を打撃で獲得しています。.500は1打数あたり0.5塁打。長打の割合そのものではありません。" },
  K9: { name: "K/9", fullName: "9回あたりの奪三振", description: "奪三振数を投球回で割り、9回に換算した値です。", interpretation: "9.00なら9回あたり9奪三振のペース。高いほど三振を奪う頻度が高くなります。", caveat: "短い投球回では大きく変動します。失点の少なさを直接表す指標ではありません。" },
  BF: { name: "BF", fullName: "対戦打者数", description: "投手が対戦した打者の人数。四球・死球・犠打なども含みます。", interpretation: "投手成績の対象となった機会の多さを確認できます。値の大小だけで良し悪しは判断しません。" },
  PA: { name: "PA", fullName: "打席数", description: "打者が打席を完了した回数。打数に加え、四球・死球・犠打・犠飛などを含みます。", interpretation: "率の成績を読むときのサンプル数です。打席が少ないほど率は変動しやすくなります。" },
  AB: { name: "AB", fullName: "打数", description: "打席から四球・死球・犠打・犠飛・打撃妨害などを除いた回数。", interpretation: "打率と長打率の計算に使う機会数です。打席数（PA）とは異なります。" },
  RISP: { name: "RISP", fullName: "得点圏に走者", description: "打席開始時に二塁または三塁に走者がいる状況。", interpretation: "この条件での打撃結果を確認します。得意・苦手の判定ではなく、対象打席数と合わせて読みます。" },
};
const aliases: Record<string, string> = { "K/9": "K9", k9: "K9", outsRecorded: "IP", outs: "IP", bf: "BF", H: "hits", "bases:risp": "RISP" };
export function metricHelp(key: string): MetricHelp | undefined {
  const normalized = aliases[key] ?? key.toUpperCase();
  const value = help[normalized] ?? metrics[key] ?? metrics[normalized === "IP" ? "outs" : normalized.toLowerCase()];
  return value ? { ...value, ...context[normalized], scope: "選択したシーズン・期間・条件の保存済み分。Regular SeasonとPostseasonは別集計。未取得は0ではありません。" } : undefined;
}
