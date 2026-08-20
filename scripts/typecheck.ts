import { spawnSync } from "node:child_process";

// A diagnostic starts at column 0; explanations are indented
const result = spawnSync("npx", ["tsc", "--noEmit", "--pretty", "false"], {
  encoding: "utf8",
});
const lines = `${result.stdout}${result.stderr}`.split("\n");

const ours: string[] = [];
let keeping = false;

// A line only counts when it carries a file position
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
