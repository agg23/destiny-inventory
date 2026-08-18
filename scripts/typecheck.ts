import { spawnSync } from "node:child_process";

// The vendored slice is pinned upstream code compiled under DIM's own flags, so its
// diagnostics are noise that would drown ours. A diagnostic starts at column 0 and its
// explanation lines are indented, so ownership carries down until the next unindented line
const result = spawnSync("npx", ["tsc", "--noEmit", "--pretty", "false"], { encoding: "utf8" });
const lines = `${result.stdout}${result.stderr}`.split("\n");

const ours: string[] = [];
let keeping = false;

for (const line of lines) {
  if (line && !line.startsWith(" ")) {
    keeping = !line.startsWith("vendor/");
  }

  if (keeping && line) {
    ours.push(line);
  }
}

if (ours.length > 0) {
  console.error(ours.join("\n"));
}

process.exit(ours.length > 0 ? 1 : 0);
