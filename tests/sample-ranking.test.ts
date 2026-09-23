import { describe, expect, it } from "vitest";
import mlb from "../public/data/mlb.json";
import { normalizeSample } from "../src/infrastructure/providers/sample-provider";
import { sampleRanking } from "../src/presentation/sample-ranking";

describe("synthetic ranking preview", () => {
  it("sorts available values and excludes missing ones", () => {
    const catalog = normalizeSample(mlb, "MLB");
    expect(sampleRanking(catalog, "avg").map((row) => [row.rank, row.player.id, row.value]))
      .toEqual([[1, "sample:MLB:player:alex", 0.28]]);
    expect(sampleRanking(catalog, "era").map((row) => row.player.id))
      .toEqual(["sample:MLB:player:casey"]);
  });

  it("gives tied values the same rank and sorts ERA ascending", () => {
    const catalog = normalizeSample(mlb, "MLB");
    const caseyBatting = catalog.statistics.find((stats) => stats.playerId.endsWith(":casey") && stats.group === "hitting")!;
    caseyBatting.metrics.avg = { status: "available", value: 0.28 };
    expect(sampleRanking(catalog, "avg").map((row) => row.rank)).toEqual([1, 1]);

    const alexPitching = structuredClone(catalog.statistics.find((stats) => stats.group === "pitching")!);
    alexPitching.playerId = "sample:MLB:player:alex";
    alexPitching.metrics.era = { status: "available", value: 1.5 };
    catalog.statistics.push(alexPitching);
    expect(sampleRanking(catalog, "era").map((row) => row.player.id))
      .toEqual(["sample:MLB:player:alex", "sample:MLB:player:casey"]);
  });

  it("never presents an unqualified real catalog as an official ranking", () => {
    const catalog = normalizeSample(mlb, "MLB");
    catalog.source.kind = "licensed";
    expect(sampleRanking(catalog, "avg")).toEqual([]);
  });
});
