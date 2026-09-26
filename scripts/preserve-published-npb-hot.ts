import { preservePublishedNpbHot } from "../src/data/npb-hot-preservation";

const result = await preservePublishedNpbHot(
  "dist/data/standings/npb/latest.json", "dist/data/npb/hot/latest.json",
  "https://tomoya41.github.io/baseball-notes/data/npb/hot/latest.json",
);
process.stdout.write(`Previous validated HOT payload: ${result}\n`);
