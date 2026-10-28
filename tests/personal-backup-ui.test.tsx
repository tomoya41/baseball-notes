// @vitest-environment jsdom
import { webcrypto } from "node:crypto";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { PersonalBackupSettings } from "../src/ui/personal-backup";
import { PersonalBackup } from "../src/application/personal-backup";
import { PersonalSettingsStore, PERSONAL_KEYS } from "../src/application/personal-settings";
import { Favorites } from "../src/application/favorites";
import { onPersonalRestored } from "../src/app/personal-events";
const save = vi.hoisted(() => vi.fn()); vi.mock("../src/app/personal-backup-files", () => ({ savePersonalBackup: save }));
let div: HTMLDivElement, root: Root, data: Map<string, string>, transfer: PersonalBackup, source: string;
const id = "00000000-0000-4000-8000-000000000001", now = Date.parse("2026-10-29T01:00:00Z");
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.stubGlobal("crypto", webcrypto); save.mockReset().mockResolvedValue("started");
  data = new Map(); const store = new PersonalSettingsStore({ get: async k => data.get(k) ?? null, set: async (k, v) => { data.set(k, v); }, remove: async k => { data.delete(k); } });
  transfer = new PersonalBackup(store, () => now); await new Favorites(store, () => now).add({ league: "NPB", kind: "player", entityId: id }); source = (await transfer.export()).text; data.clear();
  div = document.createElement("div"); document.body.append(div); root = createRoot(div); await act(async () => root.render(<PersonalBackupSettings transfer={transfer} />));
});
afterEach(async () => { await act(async () => root.unmount()); div.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const button = (label: string) => [...div.querySelectorAll("button")].find(b => b.textContent === label)!;
async function settle() { for (let n = 0; n < 100; n++) { await act(async () => { await new Promise(r => setTimeout(r, 5)); }); if (!button("ファイルを保存").disabled) return; } throw Error("Pending backup operation"); }
async function click(el: Element) { await act(async () => { el.dispatchEvent(new MouseEvent("click", { bubbles: true })); }); await settle(); }
async function choose(text = source) {
  const file = { name: "backup.json", size: new TextEncoder().encode(text).length, text: async () => text };
  await act(async () => { const input = div.querySelector<HTMLInputElement>('input[type="file"]')!; Object.defineProperty(input, "files", { configurable: true, value: [file] }); input.dispatchEvent(new Event("change", { bubbles: true })); });
  await settle();
}
describe("explicit backup/restore UI", () => {
  it("previews counts, requires confirmation and refreshes all consumers only after restore", async () => {
    const refresh = vi.fn(), unsubscribe = onPersonalRestored(refresh);
    await choose(); expect(div.querySelector("table")?.textContent).toContain("お気に入り0件1件"); expect(data.size).toBe(0); expect(button("取り込む").disabled).toBe(true);
    await click(div.querySelector('input[type="checkbox"]')!); await click(button("取り込む")); expect(data.has(PERSONAL_KEYS.favorites)).toBe(true);
    expect(div.textContent).toContain("保存内容を取り込みました"); expect(refresh).toHaveBeenCalledTimes(1); unsubscribe();
  });
  it("resets confirmation when switching to replacement and leaves storage intact on cancel", async () => {
    await choose(); await click(div.querySelector('input[type="checkbox"]')!); await click(div.querySelectorAll('input[type="radio"]')[1]!);
    expect(div.textContent).toContain("対象の保存内容を置き換えることを確認しました"); expect(button("取り込む").disabled).toBe(true);
    await click(button("キャンセル")); expect(div.querySelector("table")).toBeNull(); expect(data.size).toBe(0);
  });
  it("shows safe invalid-file/stale-preview errors and never overwrites a later edit", async () => {
    await choose("invalid JSON"); expect(div.querySelector('[role="alert"]')?.textContent).toContain("形式"); expect(data.size).toBe(0);
    await choose(); await click(div.querySelector('input[type="checkbox"]')!); data.set(PERSONAL_KEYS.favorites, JSON.stringify({ version: 1, items: [] }));
    // A logical change, not just JSON formatting, invalidates the plan.
    const library = { version: 1, collections: [{ id: "later", name: "後から保存", players: [], updatedAt: now }], views: [], activity: [] };
    data.set(PERSONAL_KEYS.library, JSON.stringify(library)); const before = new Map(data); await click(button("取り込む"));
    expect(div.querySelector('[role="alert"]')?.textContent).toContain("変更"); expect(data).toEqual(before);
  });
  it("uses the export adapter, reports browser start accurately and handles cancellation/failure", async () => {
    await click(button("ファイルを保存")); expect(save.mock.calls[0]![0].filename).toBe("baseball-notes-backup-2026-10-29.json"); expect(div.textContent).toContain("保存を開始");
    save.mockResolvedValueOnce("cancelled"); await click(button("ファイルを保存")); expect(div.textContent).toContain("キャンセル");
    save.mockRejectedValueOnce(Error("private-path")); await click(button("ファイルを保存")); expect(div.querySelector('[role="alert"]')?.textContent).toContain("保存できません"); expect(div.textContent).not.toContain("private-path");
  });
});
