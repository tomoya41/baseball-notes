import { useSyncExternalStore } from "react";
import { applyWebUpdate, subscribeWebOffline, webOfflineState } from "../app/web-offline";
import { isAndroid } from "../app/platform";

export function WebAppUpdateNotice() {
  const state = useSyncExternalStore(subscribeWebOffline, webOfflineState, webOfflineState);
  if (!state.updateAvailable) return null;
  return <aside className="runtime-status" aria-label="アプリの更新"><span>新しいバージョンがあります。</span>{" "}<button type="button" disabled={state.applying} onClick={applyWebUpdate}>{state.applying ? "更新中…" : "更新する"}</button>{state.failed && <span role="status"> 更新できませんでした。通信状態を確認して再試行してください。</span>}</aside>;
}

export function WebOfflineInfo() {
  const state = useSyncExternalStore(subscribeWebOffline, webOfflineState, webOfflineState);
  if (isAndroid() || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  return <section><h2>オフラインで使う</h2><p role="status">{state.ready ? "オフラインでもアプリを開き、保存済みの成績を確認できます。未取得の成績には通信が必要です。" : state.failed ? "オフライン起動を利用できません。通信がある状態でアプリを開き直してください。" : "通信がある状態でアプリを開くと、オフラインでも利用できるようになります。"}</p><p>ブラウザーの保存データを削除すると、オフライン用のデータも消えます。</p></section>;
}
