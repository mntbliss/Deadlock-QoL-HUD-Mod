import { CssReplacement } from "../types/CssReplacement.ts";
import type { HudConfig } from "../types/HudConfig.ts";
import { injectIntoFirstRule, renderTemplate, replaceFirstRuleProps } from "./css_edit.ts";

function props(pairs: Array<[string, string]>): CssReplacement[] {
  return CssReplacement.many(pairs);
}

export function flattenUnitHealthbars(text: string, cfg: HudConfig): string {
  const uiScale = cfg.css("minion_ui_scale", "200%").asUiScale();
  const barH = cfg.get("minion_bar_height", "42px");
  const barW = cfg.get("minion_bar_width", "460px");
  const radius = cfg.get("minion_border_radius", "10px");

  // Troopers use the default #UnitHealthbarContainer (no .minion class).
  // Heroes also use that selector, so restore .player afterwards with a more-specific rule.
  text = replaceFirstRuleProps(
    text,
    "#UnitHealthbarContainer",
    props([
      ["height: 150px;", `height: ${barH};`],
      ["height: 130px;", `height: ${barH};`],
      ["width: 500px;", `width: ${barW};\n\tui-scale: ${uiScale};`],
      ["width: 900px;", `width: ${barW};\n\tui-scale: ${uiScale};`],
      ["max-width: 700px;", `max-width: ${barW};`],
      ["margin-left: 200px;", "margin-left: 0px;"],
      ["margin-bottom: 200px;", "margin-bottom: 0px;"],
    ]),
  );

  text = injectIntoFirstRule(
    text,
    "#UnitHealthbarContainer",
    `ui-scale: ${uiScale};\n\tmax-width: ${barW};\n\tborder-radius: ${radius};`,
  );

  text = replaceFirstRuleProps(
    text,
    "#UnitHealthbarsContainer",
    props([["pre-transform-rotate2d: -70deg;", "pre-transform-rotate2d: 0deg;"]]),
  );

  text = replaceFirstRuleProps(
    text,
    ".verticalHealthbars .WindowRoot",
    props([
      [
        "transform: rotateZ(-70deg) translateY(170px) translateX(-500px);",
        "transform: none;",
      ],
      ["transform: rotateZ(-90deg);", "transform: none;"],
    ]),
  );

  const heroVanilla = `
.player #UnitHealthbarsContainer
{
	pre-transform-rotate2d: -70deg;
	pre-transform-scale2d: 1.1;
	horizontal-align: middle;
	vertical-align: middle;
	overflow: noclip;
	flow-children: none;
	margin-right: 0px;
}

.player #UnitHealthbarContainer
{
	height: 150px;
	width: 500px;
	max-width: 700px;
	ui-scale: 100%;
	pre-transform-scale2d: 1.0;
	margin-left: 200px;
	margin-bottom: 200px;
	vertical-align: middle;
	horizontal-align: middle;
	overflow: noclip;
	border-radius: 0px;
}

.verticalHealthbars.player .WindowRoot,
.player.verticalHealthbars .WindowRoot
{
	transform: rotateZ(-70deg) translateY(170px) translateX(-500px);
	height: 100%;
	padding: 20px;
	width: 80%;
}
`;

  const defineHits = [...text.matchAll(/@define [^\n]+\n/g)];
  const last = defineHits[defineHits.length - 1];

  if (last?.index !== undefined) {
    const insertAt = last.index + last[0].length;
    text = text.slice(0, insertAt) + heroVanilla + text.slice(insertAt);
  }

  const combined =
    ".sentry #UnitHealthbarContainer,.minion #UnitHealthbarContainer,.npc #UnitHealthbarContainer,.trooper #UnitHealthbarContainer";

  text = text.replace(".sentry #UnitHealthbarContainer,.minion #UnitHealthbarContainer", combined);

  text = replaceFirstRuleProps(
    text,
    combined,
    props([
      ["height: 70px;", `height: ${barH};`],
      ["width: 500px;", `width: ${barW};`],
      ["ui-scale: 200%;", `ui-scale: ${uiScale};`],
    ]),
  );

  return replaceFirstRuleProps(
    text,
    ".sentry #UnitHealthbarContainer",
    props([
      ["height: 80px;", `height: ${barH};`],
      ["width: 600px;", `width: ${barW};\n\tui-scale: ${uiScale};`],
    ]),
  );
}

export function revealPlayerBarNumbers(text: string): string {
  return replaceFirstRuleProps(
    text,
    ".progress_bar_numbers",
    props([
      ["horizontal-align: right;", "horizontal-align: center;"],
      ["visibility: collapse;", "visibility: visible;"],
      ["transform: translateY(-2px);", "transform: none;"],
    ]),
  );
}

export function flattenPlayerHealthbar(text: string, cfg: HudConfig): string {
  const barW = cfg.get("bar_width", "440px");
  const barH = cfg.get("bar_height", "22px");

  text = text.replaceAll("margin: 4px 0px 1px 1px;", "margin: 0px;");

  text = replaceFirstRuleProps(
    text,
    ".health_bar_border",
    props([
      ["margin: 10px;", "margin: 0px;"],
      ["margin: 30px;", "margin: 0px;"],
      ["vertical-align: bottom;", "vertical-align: center;"],
    ]),
  );

  text = injectIntoFirstRule(
    text,
    ".health_bar_border",
    `width: ${barW};\n\theight: ${barH};`,
  );

  text = replaceFirstRuleProps(
    text,
    ".bars_container",
    props([
      ["transform: rotateZ(-20deg);", "transform: none;"],
      ["horizontal-align: right;", "horizontal-align: center;"],
      ["width: 145px;", "width: fit-children;\n\tpadding: 10px 12px;"],
      ["width: 135px;", "width: fit-children;"],
      ["height: 310px;", "height: fit-children;"],
      ["padding: 0px;", "padding: 10px 12px;"],
    ]),
  );

  text = replaceFirstRuleProps(
    text,
    ".health_bar_line",
    props([
      ["horizontal-align: right;", "horizontal-align: center;"],
      ["vertical-align: bottom;", "vertical-align: center;"],
      ["height: 350px;", "height: fit-children;"],
      ["width: 75px;", `width: ${barW};`],
    ]),
  );

  text = injectIntoFirstRule(
    text,
    ".health_bar_line",
    `width: ${barW};\n\theight: fit-children;\n\toverflow: noclip;\n\tanimation-name: none;\n\tpre-transform-scale2d: 1.0;`,
  );

  text = replaceFirstRuleProps(
    text,
    ".large_progress_bar",
    props([
      ["width: 40px;", "width: 100%;"],
      ["height: healthbarHeight;", `height: ${barH};`],
    ]),
  );

  text = replaceFirstRuleProps(
    text,
    "#health_bar",
    props([
      ["width: 66px;", "width: 100%;"],
      ["height: 212px;", `height: ${barH};`],
    ]),
  );

  text = replaceFirstRuleProps(
    text,
    "#health_and_abilities_container",
    props([
      ["width: 250px;", "width: 580px;"],
      ["height: 380px;", "height: 168px;"],
      ["overflow: clip;", "overflow: noclip;"],
    ]),
  );

  const animStops: Array<[string, string]> = [
    [".healthLow .health_bar_line", "vibrate"],
    [".healthMid .health_bar_line", "vibrate3"],
    ["#health_and_abilities_container.localPlayerLowHealth", "healthLow"],
    ["#health_and_abilities_container.localPlayerMidHealth", "healthMid"],
  ];
  for (const [selector, anim] of animStops) {
    text = replaceFirstRuleProps(text, selector, props([[`animation-name: ${anim};`, "animation-name: none;"]]));
  }
  text = replaceFirstRuleProps(
    text,
    ".small_progress_bar",
    props([
      ["width: 10px;", "width: 180px;"],
      ["height: healthbarHeight;", "height: 8px;"],
      ["margin-top: 3px;", "margin-top: 0px;"],
    ]),
  );

  text = replaceFirstRuleProps(
    text,
    "#shield_bar,#tech_shield_bar",
    props([
      ["horizontal-align: right;", "horizontal-align: center;"],
      ["transform: rotateZ(12deg);", "transform: none;"],
      ["margin-right: 29px;", "margin-right: 0px;"],
      ["margin-top: 30px;", "margin-top: 0px;"],
    ]),
  );

  return injectIntoFirstRule(text, "#shield_bar,#tech_shield_bar", "vertical-align: top;\n\ty: 28px;");
}

export function flattenMinimap(text: string, cfg: HudConfig): string {
  const radius = cfg.get("minimap_border_radius", "32px");
  const bg = cfg.get("minimap_bg_color", "#0000004D");
  const scale = cfg.css("minimap_scale", "100%").asUiScale();
  const fade = 'url("s2r://panorama/images/masks/softedge_box_png.vtex")';
  const fadeProp = `opacity-mask: ${fade};`;

  for (const selector of ["#minimap_container", "#HudMinimapContainer", "#hud_minimap"]) {
    text = replaceFirstRuleProps(
      text,
      selector,
      props([["border-radius: 50%;", `border-radius: ${radius};\n\t${fadeProp}`]]),
    );
  }

  text = replaceFirstRuleProps(
    text,
    "#minimap_container",
    props([["overflow: clip;", `overflow: noclip;\n\tui-scale: ${scale};`]]),
  );

  text = replaceFirstRuleProps(
    text,
    ".useZoomedMinimap #HudMinimapContainer",
    props([["overflow: clip;", "overflow: noclip;"]]),
  );

  const radialBg = `gradient( radial, 50% 50%, 0% 0%, 82% 82%, from( ${bg} ), to( #00000000 ) )`;

  text = replaceFirstRuleProps(
    text,
    "#HudMinimapContainer",
    props([
      ["width: 105%;", "width: 100%;"],
      ["height: 105%;", "height: 100%;"],
      ["background-color: rgba(0, 0, 0, 0.5);", `background-color: ${radialBg};`],
      ["world-blur: ingameHudBlur;", "world-blur: none;"],
    ]),
  );

  text = replaceFirstRuleProps(
    text,
    "#hud_minimap",
    props([["background-color: rgba(25, 25, 25, 0.7);", "background-color: #00000000;"]]),
  );

  text = replaceFirstRuleProps(
    text,
    "#map_render",
    props([["overflow: noclip;", `overflow: noclip;\n\t${fadeProp}`]]),
  );

  text = replaceFirstRuleProps(
    text,
    "#minimap_frame",
    props([
      ["opacity: 1;", "opacity: 0;"],
      ["visibility: visible;", "visibility: collapse;"],
    ]),
  );

  text = injectIntoFirstRule(text, "#minimap_container", fadeProp);
  return injectIntoFirstRule(text, "#HudMinimapContainer", fadeProp);
}

export function flattenClearInventory(text: string, cfg: HudConfig, moveLevel: boolean): string {
  const idleOpacity = cfg.css("inventory_slots_opacity_idle", "40%").asOpacity();

  text = replaceFirstRuleProps(
    text,
    "#gold_and_ap_container",
    props([
      ["horizontal-align: left;", "horizontal-align: center;"],
      ["margin-left: 26px;", "margin-left: 0px;"],
      ["margin-bottom: 142px;", "margin-bottom: 0px;"],
      ["width: 400px;", "width: 100%;"],
    ]),
  );

  text = injectIntoFirstRule(text, "#gold_and_ap_container", "height: 100%;\n\toverflow: noclip;");

  text = injectIntoFirstRule(
    text,
    "#gold_and_ap_container.gShopOpen",
    "width: 400px;\n\thorizontal-align: left;\n\theight: fit-children;",
  );

  text = injectIntoFirstRule(text, "#hudGoldContainer", "visibility: collapse;");

  text = injectIntoFirstRule(text, "#LowerLeft", "width: 100%;");

  text = replaceFirstRuleProps(
    text,
    "#BarGraphContainer",
    props([
      ["visibility: visible;", "visibility: collapse;"],
      ["width: 80px;", "width: 0px;"],
    ]),
  );

  text = injectIntoFirstRule(
    text,
    ".ModsContainer",
    `opacity: ${idleOpacity};\n` +
      `\tbackground-image: url("s2r://panorama/images/minimap_dot_grid.vsvg");\n` +
      `\tbackground-size: 8px 8px;\n` +
      `\tbackground-repeat: repeat;\n` +
      `\topacity-mask: url("s2r://panorama/images/masks/softedge_box_png.vtex");`,
  );

  text = replaceFirstRuleProps(
    text,
    "#StatsAndModsContainer .unowned.mod_icon_single_container",
    props([
      ["opacity: 0.8;", `opacity: ${idleOpacity};`],
      ["background-color: #ffffff05;", "background-color: #00000066;"],
    ]),
  );

  if (moveLevel) {
    text = replaceFirstRuleProps(
      text,
      "#PlayerLevelContainer",
      props([
        ["horizontal-align: left;", "horizontal-align: center;"],
        ["vertical-align: middle;", "vertical-align: bottom;"],
      ]),
    );
    text = injectIntoFirstRule(
      text,
      "#PlayerLevelContainer",
      "ignore-parent-flow: true;\n" +
        "\twidth: 60px;\n" +
        "\toverflow: noclip;\n" +
        `\tx: ${cfg.get("level_anchor_x")};\n` +
        `\tmargin-bottom: ${cfg.get("level_margin_bottom")};`,
    );
    text = injectIntoFirstRule(text, "#ToNextPanel", "visibility: collapse;");
  }

  return replaceFirstRuleProps(
    text,
    "#HealthBarContent CitadelStatusEffect",
    props([
      ["margin-top: 90px;", "margin-top: 4px;"],
      ["margin-right: 110px;", "margin-right: 0px;"],
    ]),
  );
}

export function flattenHeartCrosshair(text: string): string {
  text = replaceFirstRuleProps(
    text,
    ".crosshair__dotborder",
    props([
      ["width: 8px;", "width: 0px;"],
      ["height: 8px;", "height: 0px;"],
      ["border-radius: 50%;", "border-radius: 0px;"],
      ["opacity: 0.85;", "opacity: 0;"],
    ]),
  );

  text = injectIntoFirstRule(text, ".crosshair__dotborder", "visibility: collapse;");

  text = replaceFirstRuleProps(
    text,
    "#LowHealthWarning",
    props([
      ["background-color: #D23619;", "background-color: #00000000;"],
      ["opacity: 0;", "opacity: 1;"],
      ["margin-top: 260px;", "margin-top: 0px;"],
    ]),
  );

  text = replaceFirstRuleProps(
    text,
    "#LowHealthWarning.localPlayerLowHealth",
    props([["animation-duration: 6s;", "animation-name: none;\n\tanimation-duration: 0s;"]]),
  );

  return injectIntoFirstRule(text, "#LowHealthWarning Label", "opacity: 0;\n\tmargin-top: 260px;");
}

export function heartOverrideCss(heartCss: string, pulse: boolean, cfg: HudConfig): string {
  const text = renderTemplate(heartCss, cfg);
  if (!pulse) return text;
  return `${text}
@keyframes 'mntbliss_heart_beat'
{
	0%
	{
		pre-transform-scale2d: 1.0;
		opacity: 0.94;
	}
	10%
	{
		pre-transform-scale2d: 1.22;
		opacity: 1.0;
	}
	22%
	{
		pre-transform-scale2d: 1.0;
		opacity: 0.94;
	}
	34%
	{
		pre-transform-scale2d: 1.12;
		opacity: 1.0;
	}
	48%
	{
		pre-transform-scale2d: 1.0;
		opacity: 0.94;
	}
	100%
	{
		pre-transform-scale2d: 1.0;
		opacity: 0.94;
	}
}

@keyframes 'mntbliss_heart_echo'
{
	0%
	{
		pre-transform-scale2d: 1.0;
		opacity: 0.4;
	}
	12%
	{
		pre-transform-scale2d: 1.35;
		opacity: 0.22;
	}
	28%
	{
		pre-transform-scale2d: 1.7;
		opacity: 0;
	}
	100%
	{
		pre-transform-scale2d: 1.7;
		opacity: 0;
	}
}

#LowHealthWarning.localPlayerLowHealth #mntbliss_heart_crosshair
{
	visibility: visible;
	opacity: 0.94;
	animation-name: mntbliss_heart_beat;
	animation-duration: 0.62s;
	animation-iteration-count: infinite;
	wash-color: LowHpCrosshairColor;
}

#LowHealthWarning.localPlayerLowHealth #mntbliss_heart_echo
{
	visibility: visible;
	animation-name: mntbliss_heart_echo;
	animation-duration: 0.62s;
	animation-iteration-count: infinite;
	wash-color: LowHpCrosshairColor;
}

.reloading #mntbliss_heart_crosshair,
.reloading #mntbliss_heart_echo,
.InHideout #mntbliss_heart_crosshair,
.InHideout #mntbliss_heart_echo,
.GameStatePreGame #mntbliss_heart_crosshair,
.GameStatePreGame #mntbliss_heart_echo
{
	visibility: collapse;
	opacity: 0;
}
`;
}
