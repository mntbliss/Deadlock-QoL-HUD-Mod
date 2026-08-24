import fs from "node:fs";
import path from "node:path";

import { BuildError } from "../types/BuildError.ts";
import { CompileInput } from "../types/CompileInput.ts";
import type { HudConfig } from "../types/HudConfig.ts";
import type { ProjectPaths } from "../types/ProjectPaths.ts";

const TROOPER = 'm_HealthBarParticle = resource_name:"particles/npc/npc_healthbar.vpcf"';
const EMPTY = 'm_HealthBarParticle = resource_name:""';

export function prepareNpcUnits(paths: ProjectPaths, inputs: CompileInput[], cfg: HudConfig): void {
  if (!cfg.isEnabled("use_minion_panorama_bars")) {
    console.log("Skipping npc_units.vdata (use_minion_panorama_bars is off)");
    return;
  }

  if (!fs.existsSync(paths.npcUnitsSrc)) {
    BuildError.fail(
      `Missing decompiled npc_units.vdata:\n  ${paths.npcUnitsSrc}\n` +
        "Keep assets/scripts/npc_units.vdata in this repo.",
    );
  }

  let text = fs.readFileSync(paths.npcUnitsSrc, "utf8");
  const count = text.split(TROOPER).length - 1;

  if (count === 0) {
    BuildError.fail(
      "npc_units.vdata has no trooper m_HealthBarParticle entries to clear. " +
        "Re-export/decompile scripts after a game patch.",
    );
  }

  text = text.replaceAll(TROOPER, EMPTY);

  const dest = path.join(paths.content, "scripts", "npc_units.vdata");

  fs.writeFileSync(dest, text.replaceAll("\r\n", "\n"));
  console.log(`Cleared HealthBarParticle on ${count} trooper entries`);
  inputs.push(new CompileInput(dest));
}
