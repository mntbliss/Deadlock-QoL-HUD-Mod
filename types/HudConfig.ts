import fs from "node:fs";

import { BuildError } from "./BuildError.ts";
import { CssValue } from "./CssValue.ts";
import type { ProjectPaths } from "./ProjectPaths.ts";

const ALIASES: Record<string, string> = {
  minion_use_panorama_bars: "use_minion_panorama_bars",
  relload_crosshair_color: "reload_crosshair_color",
};

const STALE = ["minion_bar_scale", "level_hp_margin", "level_offset_y", "souls_offset_y"];

const DEFAULTS: Record<string, string> = {
  author: "mntbliss",
  mod_name: "mntbliss QoL HUD",
  use_character_hp_bar: "true",
  use_minion_panorama_bars: "true",
  use_minimap_style: "true",
  use_heart_crosshair: "true",
  use_heart_pulse_low_hp_crosshair: "true",
  use_clear_inventory: "true",
  crosshair_color: "#FFFFFF",
  reload_crosshair_color: "#FF5A5A",
  low_hp_crosshair_color: "#E8A3AD",
  heart_size: "36px",
  fill_color: "#4DFFB5",
  fill_low_color: "#FF5A5A",
  fill_mid_color: "#E8FF5A",
  track_color: "#0A0A0A99",
  border_color: "#000000",
  bar_shadow: "0px 0px 6px 1px #000000F0",
  damage_color: "#B83A32CC",
  heal_color: "#77DB77CC",
  number_color: "#FFEFD7",
  max_number_color: "#FFEFD799",
  bar_width: "440px",
  bar_height: "22px",
  border_radius: "12px",
  border_width: "1px",
  margin_bottom: "118px",
  number_size: "28px",
  number_offset_y: "-32px",
  souls_offset_x: "16px",
  level_offset_x: "16px",
  side_offset_y: "8px",
  shield_gap: "6px",
  swap_minimap_inventory: "false",
  inventory_slots_opacity_idle: "40%",
  minion_bar_width: "460px",
  minion_bar_height: "42px",
  minion_ui_scale: "360%",
  minion_border_radius: "10px",
  minion_border_width: "2px",
  minion_border_color: "#FFFFFF88",
  minion_track_color: "#000000CC",
  minimap_border_radius: "32px",
  minimap_bg_color: "#0000004D",
  minimap_scale: "100%",
};

export const HIDDEN_CONFIG_KEYS = new Set([
  "author",
  "mod_name",
  "use_character_hp_bar",
  "use_minion_panorama_bars",
  "use_minimap_style",
  "use_heart_crosshair",
  "use_heart_pulse_low_hp_crosshair",
  "use_clear_inventory",
  "swap_minimap_inventory",
  "souls_margin_bottom",
  "souls_anchor_x",
  "level_anchor_x",
  "level_margin_bottom",
  "move_level",
  "shield_y",
]);

/** HUD knobs from config.json plus derived souls/level anchors. */
export class HudConfig {
  private constructor(private readonly values: Record<string, string>) {}

  static load(paths: ProjectPaths): HudConfig {
    const values = { ...DEFAULTS };

    if (fs.existsSync(paths.configJson)) {
      const raw: unknown = JSON.parse(fs.readFileSync(paths.configJson, "utf8"));

      if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
        BuildError.fail("config.json must be a JSON object");
      }

      for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
        values[ALIASES[key] ?? key] = String(value);
      }

      for (const old of Object.keys(ALIASES)) delete values[old];
      for (const stale of STALE) delete values[stale];
    } else {
      fs.writeFileSync(paths.configJson, `${JSON.stringify(values, null, 2)}\n`);
    }

    return new HudConfig(values);
  }

  get(key: string, fallback?: string): string {
    return this.values[key] ?? fallback ?? "";
  }

  has(key: string): boolean {
    return key in this.values;
  }

  set(key: string, value: string): void {
    this.values[key] = value;
  }

  entries(): Array<[string, string]> {
    return Object.entries(this.values);
  }

  css(key: string, fallback?: string): CssValue {
    return new CssValue(this.get(key, fallback));
  }

  isEnabled(key: string, fallback = true): boolean {
    const raw = this.values[key] ?? fallback;

    if (typeof raw === "boolean") return raw;

    return ["1", "true", "yes", "on"].includes(String(raw).trim().toLowerCase());
  }

  applyInventoryLayout(moveLevel: boolean): void {
    const hpBottom = this.css("margin_bottom", "118px").asNumber();
    const barH = this.css("bar_height", "22px").asNumber();
    const barW = this.css("bar_width", "440px").asNumber();
    const soulsRight = this.css("souls_offset_x", "16px").asNumber();
    const levelLeft = this.css("level_offset_x", "16px").asNumber();
    const sideNudge = this.css("side_offset_y", "8px").asNumber();
    const g4 = (n: number) => String(Number(n.toPrecision(4)));

    // Match hud_hp_bottom_center.css so souls/jar sit on the bar's vertical center.
    const containerH = 168;
    const barsMarginTop = 54;
    const numbersH = 32;
    const numbersGap = 4;
    const soulsH = 32;
    const jarPanelHalf = 30;
    const jarVisualCenterFromBottom = 50;
    const belowBar = containerH - barsMarginTop - numbersH - numbersGap - barH;
    const barCenter = hpBottom + belowBar + barH / 2 - sideNudge;

    this.set("souls_margin_bottom", `${g4(barCenter - soulsH / 2)}px`);
    this.set("souls_anchor_x", `${g4(barW / 2 + soulsRight)}px`);
    this.set("level_anchor_x", `${g4(-(barW / 2 + levelLeft + jarPanelHalf))}px`);
    this.set("level_margin_bottom", `${g4(barCenter - jarVisualCenterFromBottom)}px`);
    this.set("move_level", moveLevel ? "true" : "false");

    // y: 28px sits the 8px shield flush on the HP bar. Larger gap moves it up.
    const shieldGap = this.css("shield_gap", "6px").asNumber();
    this.set("shield_y", `${g4(28 - shieldGap)}px`);
  }

  inventoryLevelCss(): string {
    return `
#PlayerLevelContainer
{
	ignore-parent-flow: true;
	width: 60px;
	height: 85px;
	overflow: noclip;
	horizontal-align: center;
	vertical-align: bottom;
	x: LevelAnchorX;
	margin-bottom: LevelMarginBottom;
}

#ToNextPanel
{
	visibility: collapse;
}

.gShopOpen #PlayerLevelContainer,
#gold_and_ap_container.gShopOpen #PlayerLevelContainer
{
	ignore-parent-flow: false;
	width: fit-children;
	height: 85px;
	overflow: noclip;
	horizontal-align: left;
	vertical-align: middle;
	x: 0px;
	margin-bottom: 0px;
}

.gShopOpen #ToNextPanel
{
	visibility: visible;
}
`;
  }

  swapCornersCss(): string {
    return `
#minimap_persp
{
	horizontal-align: left;
}

.ModsContainer
{
	horizontal-align: right;
	margin-left: 0px;
	margin-right: 16px;
}

#StatsAndModsContainer #LowerLeft CitadelStatusEffect
{
	horizontal-align: right;
	margin-left: 0px;
	margin-right: 20px;
}

.gShopOpen #minimap_persp
{
	horizontal-align: right;
}

.gShopOpen .ModsContainer,
#StatsAndModsContainer.gShopOpen .ModsContainer
{
	horizontal-align: left;
	margin-left: 16px;
	margin-right: 0px;
}

.gShopOpen #StatsAndModsContainer #LowerLeft CitadelStatusEffect,
#StatsAndModsContainer.gShopOpen #LowerLeft CitadelStatusEffect
{
	horizontal-align: left;
	margin-left: 20px;
	margin-right: 0px;
}
`;
  }
}
