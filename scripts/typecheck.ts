import { spawnSync } from "node:child_process";

// The vendored slice is pinned upstream code compiled under DIM's own flags, so its
// diagnostics are noise that would drown ours. A diagnostic starts at column 0 and its
// explanation lines are indented, so ownership carries down until the next unindented line
const result = spawnSync("npx", ["tsc", "--noEmit", "--pretty", "false"], {
  encoding: "utf8",
});
const lines = `${result.stdout}${result.stderr}`.split("\n");

const ours: string[] = [];
let keeping = false;

// npm and pnpm write their own warnings to the same stream, so a line only counts when it
// carries a file position
const DIAGNOSTIC = /^(.+)\(\d+,\d+\): /;

for (const line of lines) {
  const start = DIAGNOSTIC.exec(line);

  if (line && !line.startsWith(" ")) {
    keeping = start !== null && !start[1].startsWith("vendor/");
  }

  if (keeping && line) {
    ours.push(line);
  }
}

if (ours.length > 0) {
  console.error(ours.join("\n"));
}

process.exit(ours.length > 0 ? 1 : 0);
