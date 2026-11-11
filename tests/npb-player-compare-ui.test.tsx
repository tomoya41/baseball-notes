// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { CompareWorkspace, type ComparePlayer } from "../src/ui/player-compare";
import { PersonalLibraryProvider } from "../src/ui/library-provider";
import { PersonalLibrary } from "../src/application/personal-library";

const players: ComparePlayer[] = [1, 2].map(n => ({
  id: `00000000-0000-4000-8000-00000000000${n}`, name: `比較選手${n}`, batting: false, pitching: true,
}));

it("offers to save the two selected NPB players even if one stats request fails", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div"), root = createRoot(host);
  const store = new PersonalLibrary({ get: async () => null, set: async () => {} });
  const loader = vi.fn(async () => { throw Error("unavailable"); });
  try {
    const playerIds = players.map(p => p.id).join(",");
    await act(async () => root.render(<MemoryRouter initialEntries={[`/NPB/compare?players=${playerIds}&role=pitching`]}>
      <PersonalLibraryProvider store={store}>
        <CompareWorkspace league="NPB" players={players} teams={[]} seasons={[2026]} loader={loader} />
      </PersonalLibraryProvider>
    </MemoryRouter>));
    expect(host.textContent).toContain("読み込みに失敗しました");
    expect(host.querySelector(".library-save button")?.textContent).toBe("この条件を保存");
  } finally { await act(async () => root.unmount()); vi.unstubAllGlobals(); }
});

it.each([
  { secondDate: "2026-10-12", secondEra: 2.5, expected: "ERAの差 +0.75" },
  { secondDate: "2026-10-12", secondEra: null, expected: "ERAの差 —" },
  { secondDate: "2026-10-11", secondEra: 2.5, expected: null },
])("compares pitching samples and differences only on matching dates ($secondDate, $secondEra)", async ({ secondDate, secondEra, expected }) => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const div = document.createElement("div"), root = createRoot(div);
  const loader = vi.fn(async (id: string) => {
    const first = id === players[0]!.id;
    return { id, date: first ? "2026-10-12" : secondDate, notice: null, coverage: "partial",
      metrics: { ERA: { value: first ? 3.25 : secondEra, status: "partial" }, outsRecorded: { value: first ? 31 : 27, status: "partial" } } };
  });
  try {
    await act(async () => root.render(<MemoryRouter initialEntries={[`/NPB/compare?players=${players.map(p => p.id).join(",")}&role=pitching`]}>
      <CompareWorkspace league="NPB" players={players} teams={[]} seasons={[2026]} loader={loader} />
    </MemoryRouter>));
    expect(loader.mock.calls.map(call => call[0])).toEqual(players.map(p => p.id));
    if (expected) {
      expect(div.querySelector('.npb-compare-difference strong')?.textContent).toBe(expected);
      expect(div.querySelector('.npb-compare-samples')?.textContent).toContain("10.1投球回");
    } else {
      expect(div.querySelector('.npb-compare-summary')).toBeNull();
      expect(div.textContent).toContain("集計の基準日が揃っていません");
    }
  } finally { await act(async () => root.unmount()); vi.unstubAllGlobals(); }
});
