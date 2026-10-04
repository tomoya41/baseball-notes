// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PersonalLibrary, PERSONAL_LIBRARY_KEY } from "../src/application/personal-library";
import { CollectionButton, PersonalLibraryProvider, PersonalLibraryScreen, SaveViewButton } from "../src/ui/personal-library";
import { services } from "../src/app/services";
import { leagueSwitchPath } from "../src/domain/cross-league";
const id = "00000000-0000-4000-8000-000000000001";
const reader = vi.hoisted(() => vi.fn());
vi.mock("../src/app/historical-products", () => ({ readHistoricalProduct: reader }));
let div: HTMLDivElement, root: Root, data: Map<string, string>, store: PersonalLibrary;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); reader.mockReset(); reader.mockResolvedValue({ players: [] });
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  vi.spyOn(services.directory, "findLatestNpb").mockResolvedValue({ players: [{ playerId: id, displayName: "現在の選手名", teamId: "npb:team:tigers" }], teams: [{ id: "npb:team:tigers", name: "阪神", shortName: "阪神" }] } as never);
  data = new Map(); let n = 0; store = new PersonalLibrary({ get: async k => data.get(k) ?? null, set: async (k, v) => { data.set(k, v); } }, () => Date.now(), () => `local-${++n}`);
  div = document.createElement("div"); document.body.append(div); root = createRoot(div);
});
afterEach(async () => { await act(async () => root.unmount()); div.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const mount = async (child: ReactNode, path = "/NPB/library") => act(async () => root.render(<MemoryRouter key={path} initialEntries={[path]}><PersonalLibraryProvider store={store}>{child}</PersonalLibraryProvider></MemoryRouter>));
const click = async (el: Element) => act(async () => el.dispatchEvent(new MouseEvent("click", { bubbles: true })));
const fill = async (el: HTMLInputElement, value: string) => act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, value); el.dispatchEvent(new Event("input", { bubbles: true })); });
describe("local organization UI", () => {
  it("keeps library tabs across leagues without crossing data context", () => {
    expect(leagueSwitchPath("/NPB/library", "?tab=views&season=2026", "MLB")).toBe("/MLB/library?tab=views");
    expect(leagueSwitchPath("/MLB/library", "?tab=activity", "NPB")).toBe("/NPB/library?tab=activity");
  });
  it("keeps saved entities distinguishable when all metadata is unavailable", async () => {
    vi.mocked(services.directory.findLatestNpb).mockRejectedValue(Error("offline")); reader.mockRejectedValue(Error("offline"));
    const c = (await store.createCollection("保存" )).collections[0]!; await store.setPlayer(c.id, { league: "NPB", playerId: id }, true);
    await mount(<PersonalLibraryScreen league="NPB" />); expect(div.textContent).toContain(id);
    await store.visit({ league: "NPB", kind: "teams", entityId: "npb:team:tigers", conditions: "", visitedAt: Date.now() });
    await mount(<PersonalLibraryScreen league="NPB" />, "/NPB/library?tab=activity"); expect(div.textContent).toContain("npb:team:tigers");
  });
  it("saves explicit conditions and links a reproducible URL with no local ID", async () => {
    await mount(<SaveViewButton league="MLB" params={new URLSearchParams("season=2025&competition=postseason&metric1=HR&value1=2")} />);
    await click(div.querySelector("button")!); await fill(div.querySelector("input")!, "秋の本塁打");
    await act(async () => div.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect((await store.read()).views[0]!.name).toBe("秋の本塁打");
    await mount(<PersonalLibraryScreen league="NPB" />, "/NPB/library?tab=views");
    const link = [...div.querySelectorAll("a")].find(a => a.textContent?.includes("秋の本塁打"))!;
    expect(link.href).toContain("competition=postseason"); expect(link.href).not.toContain("local-1");
  });
  it("adds/removes canonical players from Collections without a favorite or individual stat fetch", async () => {
    const c = (await store.createCollection("比較候補")).collections[0]!;
    await mount(<CollectionButton league="NPB" playerId={id} name="選手" />);
    await click(div.querySelector("button")!); await click(div.querySelector('input[type="checkbox"]')!);
    expect((await store.read()).collections[0]!.players).toEqual([{ league: "NPB", playerId: id }]);
    await click(div.querySelector('input[type="checkbox"]')!); expect((await store.read()).collections[0]!.players).toEqual([]);
    expect(reader).not.toHaveBeenCalled(); expect(data.has("baseball:favorites:v1")).toBe(false); expect(c.id).toBe("local-1");
  });
  it("reloads Collections and resolves the current display name from canonical metadata", async () => {
    const c = (await store.createCollection("若手" )).collections[0]!; await store.setPlayer(c.id, { league: "NPB", playerId: id }, true);
    await mount(<PersonalLibraryScreen league="NPB" />); expect(div.textContent).toContain("現在の選手名");
    expect(div.querySelector(`a[href="/NPB/players/${id}"]`)).not.toBeNull(); expect(data.get(PERSONAL_LIBRARY_KEY)).not.toContain("現在の選手名");
  });
  it("keeps the screen usable for corrupt storage and permits an explicit library-only reset", async () => {
    data.set(PERSONAL_LIBRARY_KEY, "broken"); data.set("baseball:favorites:v1", "keep");
    await mount(<PersonalLibraryScreen league="NPB" />); expect(div.querySelector('[role="alert"]')).not.toBeNull(); expect(data.get(PERSONAL_LIBRARY_KEY)).toBe("broken");
    await click(div.querySelector('.library-reset input')!); await click(div.querySelector('.library-reset button')!);
    expect((await store.read()).collections).toEqual([]); expect(data.get("baseball:favorites:v1")).toBe("keep");
  });
  it("records canonical Activity without a search term and survives metadata failure", async () => {
    reader.mockRejectedValue(Error("offline")); await mount(<PersonalLibraryScreen league="NPB" />, `/NPB/players/${id}?season=2026&q=secret`);
    expect((await store.read()).activity[0]!.entityId).toBe(id); expect(data.get(PERSONAL_LIBRARY_KEY)).not.toContain("secret");
    await mount(<PersonalLibraryScreen league="NPB" />, "/NPB/library?tab=activity");
    expect(div.textContent).toContain("現在の選手名"); expect(div.textContent).toContain("保存内容は保持しています");
  });
});
