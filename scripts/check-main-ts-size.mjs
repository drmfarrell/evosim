// CI lint: main.ts must stay under 300 lines. If it grows past this,
// refactor into ui/, state/, scene/ modules. See CLAUDE.md.

import { readFileSync } from "fs";
import { resolve } from "path";

const MAX_LINES = 300;
const path = resolve(process.cwd(), "src/main.ts");

try {
  const text = readFileSync(path, "utf8");
  const lines = text.split("\n").length;
  if (lines > MAX_LINES) {
    console.error(
      `src/main.ts has ${lines} lines; max is ${MAX_LINES}. Refactor before adding features. See CLAUDE.md.`
    );
    process.exit(1);
  } else {
    console.log(`OK: src/main.ts has ${lines} lines (max ${MAX_LINES}).`);
  }
} catch (e) {
  console.error(`Could not read src/main.ts: ${e.message}`);
  process.exit(1);
}
