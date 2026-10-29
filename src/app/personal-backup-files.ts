import { registerPlugin } from "@capacitor/core";
import { isAndroid } from "./platform";
const files = registerPlugin<{ save(options: { text: string; filename: string }): Promise<{ saved: boolean }> }>("PersonalBackupFiles");
export async function savePersonalBackup(file: { text: string; filename: string }): Promise<"saved" | "started" | "cancelled"> {
  if (isAndroid()) return (await files.save(file)).saved ? "saved" : "cancelled";
  const url = URL.createObjectURL(new Blob([file.text], { type: "application/json;charset=utf-8" }));
  try { const link = document.createElement("a"); link.href = url; link.download = file.filename; link.click(); }
  finally { window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
  return "started";
}
