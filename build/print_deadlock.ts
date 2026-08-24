import path from "node:path";
import { fileURLToPath } from "node:url";

import { BuildError } from "../types/BuildError.ts";
import { ProjectPaths } from "../types/ProjectPaths.ts";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const deadlock = ProjectPaths.findDeadlock(path.resolve(root));

if (!deadlock) {
  BuildError.fail("Could not find Deadlock. Set deadlock_root in paths.json.");
}

process.stdout.write(`${deadlock}\n`);
