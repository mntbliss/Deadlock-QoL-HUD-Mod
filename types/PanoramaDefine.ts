import { CssValue } from "./CssValue.ts";

/** `@define Name` in CSS mapped to a config.json key. */
export class PanoramaDefine {
  constructor(
    readonly name: string,
    readonly configKey: string,
  ) {}

  valueFrom(get: (key: string) => string | undefined): string | undefined {
    const raw = get(this.configKey);

    if (raw === undefined) return undefined;

    const value = new CssValue(raw);

    if (this.name === "MinimapScale" || this.name === "MinionUiScale") return value.asUiScale();
    if (this.name === "HeartSize") return value.asPx();
    if (this.name === "InventorySlotsOpacityIdle") return value.asOpacity();

    return raw;
  }

  static all(): PanoramaDefine[] {
    return [
      new PanoramaDefine("MinionBarWidth", "minion_bar_width"),
      new PanoramaDefine("MinionBarHeight", "minion_bar_height"),
      new PanoramaDefine("MinionUiScale", "minion_ui_scale"),
      new PanoramaDefine("MinionBorderRadius", "minion_border_radius"),
      new PanoramaDefine("MinionBorderWidth", "minion_border_width"),
      new PanoramaDefine("MinionBorderColor", "minion_border_color"),
      new PanoramaDefine("MinionTrackColor", "minion_track_color"),
      new PanoramaDefine("MinimapBorderRadius", "minimap_border_radius"),
      new PanoramaDefine("MinimapBgColor", "minimap_bg_color"),
      new PanoramaDefine("MinimapScale", "minimap_scale"),
      new PanoramaDefine("CrosshairColor", "crosshair_color"),
      new PanoramaDefine("ReloadCrosshairColor", "reload_crosshair_color"),
      new PanoramaDefine("LowHpCrosshairColor", "low_hp_crosshair_color"),
      new PanoramaDefine("RegularHitHeartsColor", "regular_hit_hearts_color"),
      new PanoramaDefine("HeadshotSpikesColor", "headshot_spikes_color"),
      new PanoramaDefine("HeartSize", "heart_size"),
      new PanoramaDefine("InventorySlotsOpacityIdle", "inventory_slots_opacity_idle"),
      new PanoramaDefine("SoulsAnchorX", "souls_anchor_x"),
      new PanoramaDefine("SoulsMarginBottom", "souls_margin_bottom"),
      new PanoramaDefine("LevelAnchorX", "level_anchor_x"),
      new PanoramaDefine("LevelMarginBottom", "level_margin_bottom"),
      new PanoramaDefine("HealthbarWidth", "bar_width"),
      new PanoramaDefine("HealthbarHeight", "bar_height"),
      new PanoramaDefine("HealthbarMarginBottom", "margin_bottom"),
      new PanoramaDefine("HealthbarNumberSize", "number_size"),
      new PanoramaDefine("HealthbarNumberColor", "number_color"),
      new PanoramaDefine("HealthbarMaxNumberColor", "max_number_color"),
      new PanoramaDefine("HealthbarBorderWidth", "border_width"),
      new PanoramaDefine("HealthbarBorderColor", "border_color"),
      new PanoramaDefine("HealthbarBorderRadius", "border_radius"),
      new PanoramaDefine("HealthbarTrackColor", "track_color"),
      new PanoramaDefine("HealthbarBarShadow", "bar_shadow"),
      new PanoramaDefine("HealthbarFillColor", "fill_color"),
      new PanoramaDefine("HealthbarFillMidColor", "fill_mid_color"),
      new PanoramaDefine("HealthbarFillLowColor", "fill_low_color"),
      new PanoramaDefine("HealthbarDamageColor", "damage_color"),
      new PanoramaDefine("HealthbarHealColor", "heal_color"),
      new PanoramaDefine("HealthbarNumberOffsetY", "number_offset_y"),
      new PanoramaDefine("HealthbarShieldY", "shield_y"),
    ];
  }
}
