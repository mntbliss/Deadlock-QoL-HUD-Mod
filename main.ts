import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { assertCompiled, compileFiles, packVpk } from "./build/compile.ts";
import { prepareSources } from "./build/prepare.ts";
import { BuildError } from "./types/BuildError.ts";
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

  console.log(`Deadlock: ${paths.deadlock}`);
  console.log(`CSDK: ${paths.csdk}`);
  console.log(`Vanilla HUD: ${paths.extract}`);

  const inputs = prepareSources(paths);
  compileFiles(paths, inputs);

  const found = walk(paths.gameOut).filter((p) =>
    [".vcss_c", ".vxml_c", ".vjs_c", ".vdata_c", ".vsvg_c"].includes(path.extname(p)),
  );

  if (!found.length) {
    const nearby = walk(path.join(paths.csdk, "game", "citadel_addons")).filter(
      (p) => path.basename(p).startsWith("hud_health") && p.endsWith(".vcss_c"),
    );

    console.log("No outputs under GAME_OUT. Nearby compiled files:", nearby.slice(0, 20));
    BuildError.fail("Compile produced no outputs under game/citadel_addons/hp_bar");
  }

  console.log("Compiled outputs:");

  for (const file of found.sort()) {
    console.log(" ", path.relative(paths.gameOut, file), fs.statSync(file).size);
  }

  assertCompiled(paths, inputs);
  packVpk(paths);

  console.log("\nDone. Fully close Deadlock if it's open, then launch again.");
  console.log("Edit config.json, then run enable_mod.bat / bun run build again.");
  console.log("After a game patch, refresh assets/ from a new HUD extract before rebuilding.");
}

main();
