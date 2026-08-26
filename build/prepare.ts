import fs from "node:fs";
import path from "node:path";

import { BuildError } from "../types/BuildError.ts";
import { CompileInput } from "../types/CompileInput.ts";
import { FeatureFlags } from "../types/FeatureFlags.ts";
import { HudConfig } from "../types/HudConfig.ts";
import { Log } from "../types/Log.ts";
import type { ProjectPaths } from "../types/ProjectPaths.ts";
import { renderTemplate, sanitizeBaseCss, stripViewerNoise } from "./css_edit.ts";
import {
  flattenClearInventory,
  flattenHeartCrosshair,
  flattenMinimap,
  flattenPlayerHealthbar,
  flattenStatsMonitor,
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
  injectStatsMonitorScript,
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

function secondsFromConfig(raw: string): number {
  const text = raw.trim().toLowerCase();
  let value = Number.NaN;

  if (text.endsWith("ms")) value = Number(text.slice(0, -2)) / 1000;
  else if (text.endsWith("s")) value = Number(text.slice(0, -1));
  else {
    value = Number(text);
    if (value > 10) value /= 1000;
  }

  if (!Number.isFinite(value)) return 0.36;

  return Math.max(value, 0.05);
}

export function prepareSources(paths: ProjectPaths): CompileInput[] {
  fs.rmSync(paths.content, { recursive: true, force: true });
  fs.rmSync(paths.gameOut, { recursive: true, force: true });

  fs.mkdirSync(path.join(paths.content, "panorama", "styles"), { recursive: true });
  fs.mkdirSync(path.join(paths.content, "panorama", "layout"), { recursive: true });
  fs.mkdirSync(path.join(paths.content, "panorama", "images"), { recursive: true });
  fs.mkdirSync(path.join(paths.content, "panorama", "scripts"), { recursive: true });
  fs.mkdirSync(path.join(paths.content, "scripts"), { recursive: true });
  fs.mkdirSync(paths.gameOut, { recursive: true });

  const cfg = HudConfig.load(paths);
  const flags = new FeatureFlags(cfg);

  cfg.applyInventoryLayout(flags.playerHp);

  const on = [
    flags.playerHp && "hp",
    flags.minions && "minions",
    flags.minimap && "minimap",
    flags.heart && "heart",
    flags.customHit && "hit",
    flags.customHeadshot && "headshot",
    flags.statsMonitor && "stats",
    flags.inventory && "inventory",
    flags.swapCorners && "corners",
  ].filter(Boolean);

  Log.ok("✨", `${cfg.get("mod_name", "HUD mod")} · ${on.join(" · ")}`);

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
  const statsOverride = flags.statsMonitor ? renderTemplate(paths.statsCss, cfg) : "";
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

  if (flags.statsMonitor) {
    if (!styleNames.includes("hud.css")) styleNames.push("hud.css");
    if (!styleNames.includes("citadel_hud_active_player_stats.css")) {
      styleNames.push("citadel_hud_active_player_stats.css");
    }
  }

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
        if (flags.heart) {
          text = flattenHeartCrosshair(
            text,
            flags.customHeadshot,
            cfg.css("crosshair_center_dot_size", "4px").asPx(),
          );
        }
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
      if (flags.statsMonitor) {
        text = flattenStatsMonitor(text, cfg, flags.swapCorners);
        text = `${text.trimEnd()}\n\n/* === mntbliss stats monitor === */\n${statsOverride}\n`;
      }
    } else if (name === "citadel_hud_active_player_stats.css") {
      text = flattenStatsMonitor(text, cfg, flags.swapCorners);
      text = `${text.trimEnd()}\n\n/* === mntbliss stats monitor === */\n${statsOverride}\n`;
    } else if (name.endsWith("element_gun.css")) {
      if (flags.heart) {
        text = flattenHeartCrosshair(
          text,
          flags.customHeadshot,
          cfg.css("crosshair_center_dot_size", "4px").asPx(),
        );
      }
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
      Log.warn("⚠️", `skip missing layout ${name}`);
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

  if (flags.statsMonitor) {
    const statsSrc = path.join(paths.extract, "layout", "citadel_hud_active_player_stats.xml");

    if (!fs.existsSync(statsSrc)) BuildError.fail(`Missing extracted layout: ${statsSrc}`);

    const statsDest = path.join(paths.content, "panorama", "layout", "citadel_hud_active_player_stats.xml");
    const statsJsSrc = path.join(paths.root, "panorama", "scripts", "mntbliss_stats_monitor.js");

    if (!fs.existsSync(statsJsSrc)) BuildError.fail(`Missing stats monitor script: ${statsJsSrc}`);

    writeNl(statsDest, injectStatsMonitorScript(stripViewerNoise(fs.readFileSync(statsSrc, "utf8"))));
    inputs.push(new CompileInput(statsDest));

    const statsJsDest = path.join(paths.content, "panorama", "scripts", "mntbliss_stats_monitor.js");

    writeNl(statsJsDest, fs.readFileSync(statsJsSrc, "utf8"));
    inputs.push(new CompileInput(statsJsDest));
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

    if (flags.gunHud) {
      const jsSrc = path.join(paths.root, "panorama", "scripts", "mntbliss_hit_fx.js");

      if (!fs.existsSync(jsSrc)) BuildError.fail(`Missing hit FX script: ${jsSrc}`);

      const duration = secondsFromConfig(cfg.get("hit_animation_duration", "0.36s"));
      const speed = Number(cfg.get("hit_animation_speed", "1")) || 1;
      const jsDest = path.join(paths.content, "panorama", "scripts", "mntbliss_hit_fx.js");

      writeNl(
        jsDest,
        fs
          .readFileSync(jsSrc, "utf8")
          .replaceAll("__HIT_DURATION__", String(duration))
          .replaceAll("__HIT_SPEED__", String(speed)),
      );
      inputs.push(new CompileInput(jsDest));
    }

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
    }
  }

  return inputs;
}
