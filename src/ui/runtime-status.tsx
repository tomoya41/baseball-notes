import { useEffect, useState } from "react";
import type { Favorite } from "../domain/models";
import { hasSavedResponseFallback, publicNetworkOnline, favoriteNotifications as notifications } from "../app/mobile-services";
import { isAndroid } from "../app/platform";
export function RuntimeStatus() {
  const [online, setOnline] = useState(publicNetworkOnline()), [saved, setSaved] = useState(hasSavedResponseFallback());
  useEffect(() => {
    const update = () => { setOnline(publicNetworkOnline()); setSaved(hasSavedResponseFallback()); };
    for (const event of ["online", "offline", "baseball:saved-data", "baseball:refresh-data"]) window.addEventListener(event, update);
    return () => { for (const event of ["online", "offline", "baseball:saved-data", "baseball:refresh-data"]) window.removeEventListener(event, update); };
  }, []);
  return !online || saved ? <p className="runtime-status" role="status">{saved ? "保存済みデータを表示しています" : "オフラインです。保存済みデータのある画面をご覧いただけます。"}</p> : null;
}
export function NotificationSettings({ favorites, ready, visible }: { favorites: Favorite[]; ready: boolean; visible: boolean }) {
  const [enabled, setEnabled] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [configured, setConfigured] = useState(false), [checked, setChecked] = useState(false);
  useEffect(() => {
    if (!isAndroid()) return;
    let active = true;
    void Promise.allSettled([notifications.enabled(), notifications.readiness()]).then(([preference, status]) => {
      if (!active) return;
      if (preference.status === "fulfilled") setEnabled(preference.value);
      if (status.status === "fulfilled" && preference.status === "fulfilled") setConfigured(status.value.configured);
      if (preference.status === "rejected" || status.status === "rejected") setMessage("通知設定を読み込めません。設定は保持しています。");
    })
      .finally(() => { if (active) setChecked(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => { const sync = () => { if (isAndroid() && ready) void notifications.sync(favorites).catch(() => setMessage("通信が戻ったら通知設定を再確認してください。")); };
    sync(); window.addEventListener("online", sync); return () => window.removeEventListener("online", sync); }, [favorites, ready]);
  const toggle = async () => { setBusy(true); setMessage("");
    try { await notifications.setEnabled(!enabled, favorites); setEnabled(await notifications.enabled()); }
    catch (error) { try { setEnabled(await notifications.enabled()); } catch { /* Keep the last known setting if storage is unavailable. */ }
      setMessage(error instanceof Error ? error.message : "通知設定を保存できません。"); }
    finally { setBusy(false); }
  };
  if (!visible) return null;
  return <section className="notification-settings" aria-labelledby="notifications-title">
    <h2 id="notifications-title">成績更新通知</h2>
    <p>Androidの成績更新通知は外部設定・配信検証が必要です。MLB過去記録は対象外です。アプリ内の確認差分はWatch Centerで確認できます。</p>
    {isAndroid() ? <><p role="status">{!checked ? "通知設定を確認中…" : configured ? "通知の接続設定あり。配信確認は別途必要です。" : "外部通知は未設定・利用準備中です。"}</p><button className="button" type="button" role="switch" aria-checked={enabled} disabled={busy || !checked || (!configured && !enabled)} onClick={() => void toggle()}>
      {busy ? "設定中…" : enabled ? "通知 ON" : "通知 OFF"}</button></> : <p>外部通知はAndroid向けの準備機能です。Webからは配信しません。</p>}
    {message && <p role="status">{message}</p>}
    <a href="#/privacy">プライバシー・データについて</a>
  </section>;
}
export function PrivacyScreen() { return <section className="screen"><h1>プライバシー・データ</h1>
  <h2>端末に保存するデータ</h2><p>お気に入り、通知設定、最近読み込んだ公開成績を端末に保存します。Watchは追跡対象のcanonical ID・確認した数値・データの日付・既読状態を端末に保存します。検索語の分析や外部送信は行いません。アカウント、クラウド同期、アクセス解析は使用しません。</p>
  <h2>通信先</h2><p>公開データをGitHub Pagesおよび選手APIから読み込みます。通信先には通常の接続情報が伝わります。</p>
  <h2>Androidの通知</h2><p>通知をONにすると、Firebase Cloud Messagingがインストール識別情報・通知用トークン・お気に入りNPB選手の購読先を扱います。当アプリのDBにトークンは保存しません。通知はいつでもOFFにできます。</p>
  <p>WebとAndroidの保存領域は別です。アプリのデータ消去・アンインストールで保存情報は消えます。</p>
  <a href="#/MLB/sources">データ提供元・クレジット</a>
  <p><a href="https://firebase.google.com/support/privacy">Firebaseのプライバシー情報</a></p>
  </section>; }
