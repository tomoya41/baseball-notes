import { metrics } from "../domain/metrics";
import type { MetricDefinition } from "../domain/models";

export type MetricHelp = Pick<MetricDefinition, "name" | "fullName" | "description" | "interpretation" | "caveat">;
const help: Record<string, MetricHelp> = {
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
  return help[normalized] ?? metrics[key] ?? metrics[normalized === "IP" ? "outs" : normalized.toLowerCase()];
}
