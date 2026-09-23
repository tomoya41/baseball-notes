import { useEffect, useState } from "react";
import type { AnalysisProvider } from "../application/ports";
import { analysisResultSchema } from "../domain/analysis";
import type { AnalysisQuery, AnalysisResult } from "../domain/analysis";
import { analysisQueryKey } from "../domain/analysis-query";

export function useAnalysisData(provider: AnalysisProvider, query: AnalysisQuery, enabled: boolean) {
  const key = analysisQueryKey(query);
  const [state, setState] = useState<{ key: string; result: AnalysisResult | null; error: string | null }>({
    key: "", result: null, error: null,
  });
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void provider.analyze(query, controller.signal).then((raw) => {
      if (controller.signal.aborted) return;
      const result = analysisResultSchema.parse(raw);
      if (analysisQueryKey(result.query) !== key) throw new Error("Mismatched analysis query");
      setState({ key, result, error: null });
    }).catch(() => { if (!controller.signal.aborted) setState({ key, result: null, error: "分析データを取得できませんでした" }); });
    return () => controller.abort();
  }, [provider, query, key, enabled]);
  return state.key === key ? state : { key, result: null, error: null };
}
