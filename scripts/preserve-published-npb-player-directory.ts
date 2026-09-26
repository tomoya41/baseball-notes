import { preservePublishedNpbPlayerDirectory } from "../src/data/npb-player-directory-preservation";

const result = await preservePublishedNpbPlayerDirectory("dist/data/npb/players/latest.json",
  "https://tomoya41.github.io/baseball-notes/data/npb/players/latest.json");
process.stdout.write(`Previous validated Player Directory: ${result}\n`);
