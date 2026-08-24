import type { HudConfig } from "./HudConfig.ts";

/** Which HUD pieces this build will patch. */
export class FeatureFlags {
  readonly playerHp: boolean;
  readonly minions: boolean;
  readonly minimap: boolean;
  readonly heart: boolean;
  readonly heartPulse: boolean;
  readonly inventory: boolean;
  readonly swapCorners: boolean;

  constructor(cfg: HudConfig) {
    this.playerHp = cfg.isEnabled("use_character_hp_bar");
    this.minions = cfg.isEnabled("use_minion_panorama_bars");
    this.minimap = cfg.isEnabled("use_minimap_style");
    this.heart = cfg.isEnabled("use_heart_crosshair");
    this.heartPulse = this.heart && cfg.isEnabled("use_heart_pulse_low_hp_crosshair");
    this.inventory = cfg.isEnabled("use_clear_inventory");
    this.swapCorners = cfg.isEnabled("swap_minimap_inventory", false);
  }

  get any(): boolean {
    return this.playerHp || this.minions || this.minimap || this.heart || this.inventory || this.swapCorners;
  }
}
