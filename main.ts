import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { assertCompiled, compileFiles, packVpk } from "./build/compile.ts";
import { prepareSources } from "./build/prepare.ts";
import { BuildError } from "./types/BuildError.ts";
import { Log } from "./types/Log.ts";
import { ProjectPaths } from "./types/ProjectPaths.ts";

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];

  const out: string[] = [];

  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);

    if (ent.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }

  return out;
}

function main(): void {
  const root = path.dirname(fileURLToPath(import.meta.url));
  const paths = ProjectPaths.resolve(root);

  Log.loading(paths.deadlock);
  Log.loading(paths.csdk);
  Log.loading(paths.extract);

  const inputs = prepareSources(paths);

  compileFiles(paths, inputs);

  const found = walk(paths.gameOut).filter((p) =>
    [".vcss_c", ".vxml_c", ".vjs_c", ".vdata_c", ".vsvg_c"].includes(path.extname(p)),
  );

  if (!found.length) {
    BuildError.fail("Compile produced no outputs under game/citadel_addons/hp_bar");
  }

  assertCompiled(paths, inputs);
  packVpk(paths);

  Log.ok("👋", "fully close deadlock, then launch");
}

main();
