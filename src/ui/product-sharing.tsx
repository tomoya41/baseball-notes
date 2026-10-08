import { useState } from "react";
import { Share2 } from "lucide-react";
import { useLocation } from "react-router-dom";
import { displayCsv, portableUrl, type DisplayExport } from "../domain/product-sharing";

export function ShareLink({ path, search = "", compact = false }: { path?: string; search?: string; compact?: boolean }) {
  const location = useLocation(), url = portableUrl(path ?? location.pathname, path ? search : location.search);
  const [message, setMessage] = useState(""), [fallback, setFallback] = useState(false);
  if (!url) return null;
  const copy = async () => { try { await navigator.clipboard.writeText(url); setMessage("URLをコピーしました"); } catch { setFallback(true); setMessage("URLを選択してコピーできます"); } };
  return <div className={`share-link${compact ? " share-link--compact" : ""}`}><button className={compact ? "icon-button" : "button button--secondary"} aria-label="リンクを共有" onClick={() => { if (navigator.share) void navigator.share({ title: "Baseball Notes", url }).catch((e: unknown) => { if (!(e instanceof Error && e.name === "AbortError")) void copy(); }); else void copy(); }}><Share2 size={18} aria-hidden="true" />{!compact && "リンクを共有"}</button>{message && <small role="status">{message}</small>}{fallback && <label>共有URL<textarea readOnly value={url} onFocus={e => e.currentTarget.select()} /></label>}</div>;
}
export function DisplayExportButton({ data }: { data: DisplayExport }) {
  const [failed, setFailed] = useState(false);
  if (data.league !== "MLB" || !data.rows.length) return null;
  return <div className="display-export"><button className="button button--secondary" onClick={() => { try {
    const blob = new Blob(["\uFEFF", displayCsv(data)], { type: "text/csv;charset=utf-8" }), url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = `baseball-notes-${data.date}.csv`; a.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); setFailed(false);
  } catch { setFailed(true); } }}>表示中の集計をCSV</button><small>表示範囲のみ・出典を含みます</small>{failed && <p role="alert">出力できませんでした</p>}</div>;
}
