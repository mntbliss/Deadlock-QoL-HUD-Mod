import fs from "node:fs";
import path from "node:path";

import { BuildError } from "../types/BuildError.ts";
import { CompileInput } from "../types/CompileInput.ts";
import { FeatureFlags } from "../types/FeatureFlags.ts";
import { HIDDEN_CONFIG_KEYS, HudConfig } from "../types/HudConfig.ts";
import type { ProjectPaths } from "../types/ProjectPaths.ts";
import { renderTemplate, sanitizeBaseCss, stripViewerNoise } from "./css_edit.ts";
import {
  flattenClearInventory,
  flattenHeartCrosshair,
  flattenMinimap,
  flattenPlayerHealthbar,
  flattenSwapCorners,
  flattenUnitHealthbars,
  heartOverrideCss,
  revealPlayerBarNumbers,
} from "./patch_css.ts";
import { prepareNpcUnits } from "./patch_vdata.ts";
import {
  hoistHpNumbers,
  hoistShieldNumbers,
  injectHeartIntoHud,
  injectHeartsIntoGun,
  injectLowhpListener,
  injectMinionHpLabel,
  injectUnsecuredSoulsChip,
} from "./patch_xml.ts";
import {
  PLAYER_LAYOUT_BASES,
  PLAYER_STYLE_BASES,
  UNIT_INJECT_STYLES,
  UNIT_LAYOUT_BASES,
  UNIT_STYLE_BASES,
  UNIT_STYLE_NAMES,
} from "./vanilla.ts";

function writeNl(file: string, text: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text.replaceAll("\r\n", "\n"));
}

export function prepareSources(paths: ProjectPaths): CompileInput[] {
  fs.rmSync(paths.content, { recursive: true, force: true });
  fs.rmSync(paths.gameOut, { recursive: true, force: true });

  fs.mkdirSync(path.join(paths.content, "panorama", "styles"), { recursive: true });
  fs.mkdirSync(path.join(paths.content, "panorama", "layout"), { recursive: true });
  fs.mkdirSync(path.join(paths.content, "panorama", "images"), { recursive: true });
  fs.mkdirSync(path.join(paths.content, "scripts"), { recursive: true });
  fs.mkdirSync(paths.gameOut, { recursive: true });

  const cfg = HudConfig.load(paths);
  const flags = new FeatureFlags(cfg);

  console.log(`Building: ${cfg.get("mod_name", "HUD mod")} by ${cfg.get("author", "unknown")}`);
  cfg.applyInventoryLayout(flags.playerHp);

  console.log(`  use_character_hp_bar: ${flags.playerHp}`);
  console.log(`  use_minion_panorama_bars: ${flags.minions}`);
  console.log(`  use_minimap_style: ${flags.minimap}`);
  console.log(`  use_heart_crosshair: ${flags.heart}`);
  console.log(`  use_heart_pulse_low_hp_crosshair: ${flags.heartPulse}`);
  console.log(`  use_custom_hit_animation: ${flags.customHit}`);
  console.log(`  use_custom_hit_headshot_animation: ${flags.customHeadshot}`);
  console.log(`  use_clear_inventory: ${flags.inventory}`);
  console.log(`  swap_minimap_inventory: ${flags.swapCorners}`);
  console.log("Config:");

  for (const [key, value] of cfg.entries()) {
    if (!HIDDEN_CONFIG_KEYS.has(key)) console.log(`  ${key}: ${value}`);
  }

  if (!flags.any) {
    BuildError.fail("All use_* toggles are off. Nothing to pack.");
  }

  const playerOverride = flags.playerHp ? renderTemplate(paths.playerCss, cfg) : "";
  const unitOverride = flags.minions ? renderTemplate(paths.unitCss, cfg) : "";
  const minimapOverride = flags.minimap ? renderTemplate(paths.minimapCss, cfg) : "";
  const heartOverride = flags.gunHud
    ? heartOverrideCss(paths.heartCss, flags.heartPulse, cfg, {
        heart: flags.heart,
        customHit: flags.customHit,
        customHeadshot: flags.customHeadshot,
      })
    : "";
  let inventoryOverride = "";

  if (flags.inventory) {
    inventoryOverride = renderTemplate(paths.inventoryCss, cfg);
    if (flags.playerHp) inventoryOverride += cfg.inventoryLevelCss();
  }

  const inputs: CompileInput[] = [];
  const styleNames: string[] = [];

  if (flags.playerHp) styleNames.push(...PLAYER_STYLE_BASES);

  if (flags.minimap) {
    if (!styleNames.includes("hud.css")) styleNames.push("hud.css");
    styleNames.push("hud_minimap.css");
  }

  if (flags.minions) styleNames.push(...UNIT_STYLE_BASES);

  if (flags.gunHud) {
    if (!styleNames.includes("hud.css")) styleNames.push("hud.css");
    styleNames.push("ability_hud_elements/element_gun.css");
  }

  if (flags.inventory) {
    if (!styleNames.includes("hud.css")) styleNames.push("hud.css");

    for (const extra of ["hud_gold_and_ap_container.css", "citadel_shop_mod_icon.css"]) {
      if (!styleNames.includes(extra)) styleNames.push(extra);
    }

    if (flags.playerHp && !styleNames.includes("citadel_status_effect.css")) {
      styleNames.push("citadel_status_effect.css");
    }
  }

  if (flags.swapCorners && !styleNames.includes("hud.css")) styleNames.push("hud.css");

  for (const name of styleNames) {
    const src = path.join(paths.extract, "styles", name);

    if (!fs.existsSync(src)) BuildError.fail(`Missing extracted style: ${src}`);

    let text = sanitizeBaseCss(stripViewerNoise(fs.readFileSync(src, "utf8")));

    if (name === "hud_minimap.css") {
      text = flattenMinimap(text, cfg);
      text = `${text.trimEnd()}\n\n/* === mntbliss minimap override === */\n${minimapOverride}\n`;
    } else if (UNIT_STYLE_NAMES.has(name)) {
      text = flattenUnitHealthbars(text, cfg);
      text = `${text.trimEnd()}\n\n/* === mntbliss unit HP override === */\n${unitOverride}\n`;
    } else if (UNIT_INJECT_STYLES.has(name)) {
      text = `${text.trimEnd()}\n\n/* === mntbliss unit HP override === */\n${unitOverride}\n`;
    } else if (name === "hud.css") {
      if (flags.playerHp) {
        text = flattenPlayerHealthbar(text, cfg);
        text = revealPlayerBarNumbers(text);
        text = `${text.trimEnd()}\n\n/* === mntbliss player HP override === */\n${playerOverride}\n`;
      }
      if (flags.minimap) {
        text = flattenMinimap(text, cfg);
        text = `${text.trimEnd()}\n\n/* === mntbliss minimap override === */\n${minimapOverride}\n`;
      }
      if (flags.gunHud) {
        if (flags.heart) text = flattenHeartCrosshair(text, flags.customHeadshot);
        text = `${text.trimEnd()}\n\n/* === mntbliss heart crosshair === */\n${heartOverride}\n`;
      }
      if (flags.inventory) {
        text = flattenClearInventory(text, cfg, flags.playerHp);
        text = `${text.trimEnd()}\n\n/* === mntbliss clear inventory === */\n${inventoryOverride}\n`;
      }
      if (flags.swapCorners) {
        text = flattenSwapCorners(text);
        text = `${text.trimEnd()}\n\n/* === mntbliss swap corners === */\n${cfg.swapCornersCss()}\n`;
      }
    } else if (name.endsWith("element_gun.css")) {
      if (flags.heart) text = flattenHeartCrosshair(text, flags.customHeadshot);
      text = `${text.trimEnd()}\n\n/* === mntbliss heart crosshair === */\n${heartOverride}\n`;
    } else if (
      name === "hud_gold_and_ap_container.css" ||
      name === "citadel_shop_mod_icon.css" ||
      name === "citadel_status_effect.css"
    ) {
      text = flattenClearInventory(text, cfg, flags.playerHp);
      text = `${text.trimEnd()}\n\n/* === mntbliss clear inventory === */\n${inventoryOverride}\n`;
      if (flags.swapCorners) {
        text = flattenSwapCorners(text);
        text = `${text.trimEnd()}\n\n/* === mntbliss swap corners === */\n${cfg.swapCornersCss()}\n`;
      }
    } else {
      text = flattenPlayerHealthbar(text, cfg);
      text = revealPlayerBarNumbers(text);
      text = `${text.trimEnd()}\n\n/* === mntbliss player HP override === */\n${playerOverride}\n`;
    }

    const dest = path.join(paths.content, "panorama", "styles", name);

    writeNl(dest, text);
    inputs.push(new CompileInput(dest));
  }

  const layoutNames: string[] = [];

  if (flags.playerHp) layoutNames.push(...PLAYER_LAYOUT_BASES);
  if (flags.minions) layoutNames.push(...UNIT_LAYOUT_BASES);

  for (const name of layoutNames) {
    const src = path.join(paths.extract, "layout", name);

    if (!fs.existsSync(src)) {
      console.log(`skip missing layout: ${name}`);
      continue;
    }

    let text = stripViewerNoise(fs.readFileSync(src, "utf8"));

    const isUnitLayout = UNIT_LAYOUT_BASES.includes(name);

    if (!isUnitLayout) {
      text = text.replaceAll('vertical="true"', 'vertical="false"');
      text = text.replaceAll('class="WindowRoot"', 'class="WindowRoot mntbliss_flat"');
    }

    if (flags.playerHp && (name === "hud_health.xml" || name === "hud_health_single_bar.xml")) {
      text = hoistHpNumbers(text);
    }

    if (flags.playerHp && (name === "hud_health.xml" || name === "hud_health_stacked.xml")) {
      text = hoistShieldNumbers(text);
    }

    if (flags.minions) text = injectMinionHpLabel(text);

    const dest = path.join(paths.content, "panorama", "layout", name);

    writeNl(dest, text);
    inputs.push(new CompileInput(dest));
  }

  if (flags.inventory) {
    const src = path.join(paths.extract, "layout", "hud_gold_and_ap_container.xml");

    if (!fs.existsSync(src)) BuildError.fail(`Missing extracted layout: ${src}`);

    const dest = path.join(paths.content, "panorama", "layout", "hud_gold_and_ap_container.xml");

    writeNl(dest, injectUnsecuredSoulsChip(stripViewerNoise(fs.readFileSync(src, "utf8"))));
    inputs.push(new CompileInput(dest));
  }

  if (flags.gunHud) {
    const gunSrc = path.join(paths.extract, "layout", "ability_hud_elements", "element_gun.xml");

    if (!fs.existsSync(gunSrc)) BuildError.fail(`Missing extracted layout: ${gunSrc}`);

    const gunDest = path.join(paths.content, "panorama", "layout", "ability_hud_elements", "element_gun.xml");

    writeNl(
      gunDest,
      injectHeartsIntoGun(stripViewerNoise(fs.readFileSync(gunSrc, "utf8")), {
        heart: flags.heart,
        customHit: flags.customHit,
        customHeadshot: flags.customHeadshot,
      }),
    );
    inputs.push(new CompileInput(gunDest));

    if (flags.heart) {
      const hudSrc = path.join(paths.extract, "layout", "hud.xml");

      if (!fs.existsSync(hudSrc)) BuildError.fail(`Missing extracted layout: ${hudSrc}`);

      const hudDest = path.join(paths.content, "panorama", "layout", "hud.xml");

      writeNl(
        hudDest,
        injectHeartIntoHud(injectLowhpListener(stripViewerNoise(fs.readFileSync(hudSrc, "utf8")))),
      );
      inputs.push(new CompileInput(hudDest));
    }
  }

  prepareNpcUnits(paths, inputs, cfg);

  if (flags.playerHp || flags.minimap || flags.gunHud || flags.inventory) {
    const images = path.join(paths.root, "panorama", "images");

    for (const name of fs.readdirSync(images).filter((n) => n.endsWith(".svg")).sort()) {
      const dest = path.join(paths.content, "panorama", "images", name);

      fs.copyFileSync(path.join(images, name), dest);
      inputs.push(new CompileInput(dest));
      console.log(`Packed texture: ${name}`);
    }
  }

  return inputs;
}
