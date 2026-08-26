import type { HudConfig } from "./HudConfig.ts";

/** Which HUD pieces this build will patch. */
export class FeatureFlags {
  readonly playerHp: boolean;
  readonly minions: boolean;
  readonly minimap: boolean;
  readonly heart: boolean;
  readonly heartPulse: boolean;
  readonly customHit: boolean;
  readonly customHeadshot: boolean;
  readonly statsMonitor: boolean;
  readonly inventory: boolean;
  readonly swapCorners: boolean;

  constructor(cfg: HudConfig) {
    this.playerHp = cfg.isEnabled("use_character_hp_bar");
    this.minions = cfg.isEnabled("use_minion_panorama_bars");
    this.minimap = cfg.isEnabled("use_minimap_style");
    this.heart = cfg.isEnabled("use_heart_crosshair");
    this.heartPulse = this.heart && cfg.isEnabled("use_heart_pulse_low_hp_crosshair");
    this.customHit = cfg.isEnabled("use_custom_hit_animation");
    this.customHeadshot = cfg.isEnabled("use_custom_hit_headshot_animation");
    this.statsMonitor = cfg.isEnabled("use_stats_monitor");
    this.inventory = cfg.isEnabled("use_clear_inventory");
    this.swapCorners = cfg.isEnabled("swap_minimap_inventory", false);
  }

  get any(): boolean {
    return (
      this.playerHp ||
      this.minions ||
      this.minimap ||
      this.heart ||
      this.customHit ||
      this.customHeadshot ||
      this.statsMonitor ||
      this.inventory ||
      this.swapCorners
    );
  }

  get gunHud(): boolean {
    return this.heart || this.customHit || this.customHeadshot;
  }
}
