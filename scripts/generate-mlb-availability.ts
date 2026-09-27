import { mkdir, writeFile } from "node:fs/promises";
import { mlbAvailability } from "../src/domain/league-availability";

// Source gate only: no provider requests, credentials, database access, or fake statistics.
await mkdir("dist/data/mlb", { recursive: true });
await writeFile("dist/data/mlb/manifest.json", JSON.stringify(mlbAvailability));
