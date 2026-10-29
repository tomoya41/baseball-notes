import { useEffect, useRef, useState } from "react";
import { Download, FolderOpen } from "lucide-react";
import { PERSONAL_BACKUP_MAX_BYTES, type BackupCounts, type PersonalBackup, type RestoreMode, type RestorePreview } from "../application/personal-backup";
import { savePersonalBackup } from "../app/personal-backup-files";
import { personalRestored } from "../app/personal-events";
import "./personal-backup.css";
const labels: [keyof BackupCounts, string][] = [["favorites", "お気に入り"], ["collections", "コレクション"], ["views", "保存した条件"], ["activity", "最近見た履歴"]];
export function PersonalBackupSettings({ transfer }: { transfer: PersonalBackup }) {
  const [preview, setPreview] = useState<RestorePreview | null>(null), [mode, setMode] = useState<RestoreMode>("merge"), [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false), [name, setName] = useState("");
  const text = useRef(""), request = useRef(0), chooser = useRef<HTMLInputElement>(null);
  useEffect(() => () => { request.current++; transfer.cancel(); }, [transfer]);
  const cancel = () => { request.current++; transfer.cancel(); setPreview(null); text.current = ""; setName(""); setConfirmed(false); if (chooser.current) chooser.current.value = ""; };
  const prepare = async (nextText: string, nextMode: RestoreMode) => {
    const version = ++request.current; setPreview(null); setConfirmed(false); setError(""); setMessage(""); setBusy(true);
    try { const p = await transfer.preview(nextText, nextMode); if (version === request.current) setPreview(p); }
    catch (e) { if (version === request.current) setError(e instanceof Error ? e.message : "ファイルを確認できません。"); }
    finally { if (version === request.current) setBusy(false); }
  };
  const exportFile = async () => {
    setBusy(true); setError(""); setMessage("");
    try { const status = await savePersonalBackup(await transfer.export()); setMessage(status === "saved" ? "ファイルを保存しました。" : status === "started" ? "ファイルの保存を開始しました。" : "保存をキャンセルしました。"); }
    catch { setError("ファイルを保存できません。保存領域や保存先を確認してください。"); } finally { setBusy(false); }
  };
  const choose = async (file?: File) => {
    if (!file) return;
    cancel(); setError("");
    if (file.size > PERSONAL_BACKUP_MAX_BYTES) { setError("1MB以内のファイルを選んでください。"); return; }
    const version = request.current; setBusy(true);
    try { const value = await file.text(); if (version !== request.current) return; text.current = value; setName(file.name); setMode("merge"); await prepare(value, "merge"); }
    catch { if (version === request.current) setError("ファイルを読み込めません。"); }
    finally { if (version === request.current) setBusy(false); }
  };
  const restore = async () => {
    if (!preview || !confirmed) return; setBusy(true); setError(""); setMessage("");
    try { await transfer.restore(preview.token); cancel(); personalRestored(); setMessage("保存内容を取り込みました。"); }
    catch (e) { setPreview(null); setConfirmed(false); setError(e instanceof Error ? e.message : "保存状態を確認できません。"); personalRestored(); }
    finally { setBusy(false); }
  };
  return <section className="settings-panel personal-backup" aria-labelledby="personal-backup-title"><h2 id="personal-backup-title">バックアップ</h2><p className="inline-note">お気に入り・保存した条件などを持ち運ぶ</p>
    <div className="backup-actions"><button disabled={busy} onClick={() => void exportFile()}><Download size={16} aria-hidden="true" />ファイルを保存</button><button disabled={busy} onClick={() => chooser.current?.click()}><FolderOpen size={16} aria-hidden="true" />ファイルを選ぶ</button></div>
    <input ref={chooser} className="sr-only" tabIndex={-1} type="file" accept=".json,application/json" aria-label="バックアップファイル" disabled={busy} onChange={e => void choose(e.target.files?.[0])} />
    <p className="inline-note">NPB・MLB共通。成績・Watchの確認履歴は含みません。</p>
    {busy && <p role="status">確認しています…</p>}{error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    {name && <p className="backup-filename">{name}</p>}
    {name && <div className="backup-method"><fieldset disabled={busy}><legend>取り込み方法</legend><div className="backup-mode">{([["merge", "追加する"], ["replace", "置き換える"]] as const).map(([value, label]) => <label key={value}><input type="radio" name="backup-mode" checked={mode === value} onChange={() => { setMode(value); void prepare(text.current, value); }} />{label}</label>)}</div></fieldset>{!preview && <button disabled={busy} onClick={cancel}>キャンセル</button>}</div>}
    {preview && <div className="backup-preview"><h3>取り込み内容</h3><p className="inline-note">{new Date(preview.createdAt).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })}のファイル</p><table><caption className="sr-only">取り込み前後の保存件数</caption><thead><tr><th scope="col">保存内容</th><th scope="col">現在</th><th scope="col">取り込み後</th></tr></thead><tbody>{labels.map(([key, label]) => <tr key={key}><th scope="row">{label}</th><td>{preview.before[key]}件</td><td>{preview.after[key]}件</td></tr>)}</tbody></table>
      <p className="inline-note">{mode === "merge" ? "この端末の設定を維持して追加します。" : "対象の保存内容とWatch設定を置き換えます。"}Watchは新しい基準で確認します。</p>
      {preview.expiredActivity > 0 && <p className="inline-note">90日より前の閲覧履歴{preview.expiredActivity}件は対象外です。</p>}
      <label className="backup-confirm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} />{mode === "replace" ? "対象の保存内容を置き換えることを確認しました" : "取り込み内容を確認しました"}</label>
      <div className="backup-actions"><button disabled={busy || !confirmed} onClick={() => void restore()}>取り込む</button><button disabled={busy} onClick={cancel}>キャンセル</button></div>
    </div>}
    <details><summary>保存する内容</summary><p>お気に入り、コレクション、保存した条件、最近の閲覧履歴、Watchの設定を保存します。表示・端末の通知許可・成績キャッシュ・Watchの数値や確認履歴は含みません。</p><p>ファイルは自動送信しません。追加時は同じ内容を重複させず、保存IDが同じ別内容は別の項目にします。古い閲覧履歴は90日・60件の範囲で整理します。</p></details>
  </section>;
}
