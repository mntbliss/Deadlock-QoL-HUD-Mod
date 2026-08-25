import { BuildError } from "../types/BuildError.ts";
import { Log } from "../types/Log.ts";

export function hoistHpNumbers(text: string): string {
  if (text.includes('class="hp_numbers_row"')) return text;

  const pattern =
    /<Panel class="progress_bar_numbers">\s*<Panel class="bar_num_col_right">\s*<Label id="current_health"[^>]*>\s*<Label id="max_health"[^>]*>\s*<\/Panel>\s*<\/Panel>\s*/s;
  const next = text.replace(pattern, "");

  if (next === text) {
    Log.warn("⚠️", "could not hoist HP numbers");
    return text;
  }

  text = next;

  const row =
    '<Panel class="hp_numbers_row">\n' +
    '\t\t\t\t<Label id="current_health" class="progress_bar_current" text="{i:health}" />\n' +
    '\t\t\t\t<Label id="max_health" text="/{i:maxHealth}" />\n' +
    "\t\t\t</Panel>\n" +
    '\t\t\t<Panel class="health_bar_border">';

  if (!text.includes('<Panel class="health_bar_border">')) {
    Log.warn("⚠️", "health_bar_border missing after hoist");
    return text;
  }

  return text.replace('<Panel class="health_bar_border">', row);
}

export function hoistShieldNumbers(text: string): string {
  if (text.includes('id="mntbliss_shield_numbers"')) return text;

  const block =
    /<ProgressBarWithMiddle id="(tech_shield_bar|shield_bar)"([^>]*)>\s*<Panel class="progress_bar_numbers">\s*(<Label class="progress_bar_current"[^>]*>)\s*(<Label class="progress_bar_max"[^>]*>)\s*<\/Panel>\s*<\/ProgressBarWithMiddle>/gs;

  const next = text.replace(block, (_, id: string, attrs: string, current: string, max: string) => {
    const numId = id === "tech_shield_bar" ? "mntbliss_tech_shield_numbers" : "mntbliss_shield_numbers";

    return (
      `<Panel id="${numId}" class="mntbliss_shield_numbers">\n` +
      `\t\t\t${current}\n` +
      `\t\t\t${max}\n` +
      `\t\t</Panel>\n` +
      `\t\t<ProgressBarWithMiddle id="${id}"${attrs}></ProgressBarWithMiddle>`
    );
  });

  if (next === text) {
    Log.warn("⚠️", "could not hoist shield numbers");
    return text;
  }

  return next;
}

export function injectUnsecuredSoulsChip(text: string): string {
  if (text.includes('id="mntbliss_hp_souls"')) return text;

  const needle = "<CitadelHudSoulAPContainer>";

  if (!text.includes(needle)) {
    Log.warn("⚠️", "gold container missing CitadelHudSoulAPContainer");
    return text;
  }

  return text.replace(
    needle,
    `${needle}
		<Panel id="mntbliss_hp_souls">
			<Panel id="mntbliss_hp_souls_icon" />
			<Label id="mntbliss_hp_souls_label" text="{i:hud_cur_gold}" />
			<Label id="mntbliss_hp_souls_unsecured" text="({i:hud_death_gold_penalty})" />
		</Panel>`,
  );
}

export function injectGunHitScript(text: string): string {
  if (text.includes("mntbliss_hit_fx.vjs_c")) return text;

  if (!text.includes("</styles>")) {
    BuildError.fail("element_gun.xml is missing </styles>");
  }

  return text.replace(
    "</styles>",
    `</styles>
	<scripts>
		<include src="s2r://panorama/scripts/mntbliss_hit_fx.vjs_c" />
	</scripts>`,
  );
}

export function injectFireRateIntoGun(text: string): string {
  if (!text.includes('id="mntbliss_weapon_ammo"')) {
    text = text.replace(
      /<Label class="weapon_ammo" text="\{i:current_clip_ammo\}" \/>/,
      '<Label id="mntbliss_weapon_ammo" class="weapon_ammo" text="{i:current_clip_ammo}" />',
    );
  }

  if (text.includes('id="mntbliss_fire_rate"')) return text;

  const rate = `<Panel id="mntbliss_fire_rate" class="mntbliss_fire_rate">
				<Image class="mntbliss_fire_rate_icon" src="s2r://panorama/images/icons/properties/fire_rate.vsvg" />
				<Label id="mntbliss_fire_rate_label" class="mntbliss_fire_rate_label" text="" />
			</Panel>`;

  const next = text.replace(/(<Panel id="ammo_panel">[\s\S]*?<\/Panel>)/, `$1\n\t\t\t${rate}`);

  if (next === text) {
    Log.warn("⚠️", "could not inject fire rate under ammo");
    return text;
  }

  return next;
}

export function injectHeartsIntoGun(
  text: string,
  opts: { heart: boolean; customHit: boolean; customHeadshot: boolean; fireRate: boolean } = {
    heart: true,
    customHit: true,
    customHeadshot: true,
    fireRate: true,
  },
): string {
  const needle = '<Citadel_AbilityHUDElement_Gun class="ability_element_gun">';

  if (!text.includes(needle)) {
    BuildError.fail("element_gun.xml is missing Citadel_AbilityHUDElement_Gun");
  }

  if (opts.customHit || opts.customHeadshot || opts.fireRate) text = injectGunHitScript(text);
  if (opts.fireRate) text = injectFireRateIntoGun(text);

  const images: string[] = [];

  if (opts.heart) {
    images.push(
      '<Image id="mntbliss_heart_echo" src="s2r://panorama/images/heart_crosshair.vsvg" />',
      '<Image id="mntbliss_heart_crosshair" src="s2r://panorama/images/heart_crosshair.vsvg" />',
      '<Image id="mntbliss_heart_cracked" src="s2r://panorama/images/heart_crosshair_cracked.vsvg" />',
    );
  }

  if (opts.customHeadshot) {
    images.push('<Image id="mntbliss_heart_spikes" src="s2r://panorama/images/heart_rose_spikes.vsvg" />');
  }

  if (opts.customHit) {
    images.push('<Image id="mntbliss_hit_hearts" src="s2r://panorama/images/heart_hit_hearts.vsvg" />');
  }

  const already =
    text.includes('id="mntbliss_heart_crosshair"') ||
    text.includes('id="mntbliss_heart_spikes"') ||
    text.includes('id="mntbliss_hit_hearts"');

  if (!already && images.length) {
    text = text.replace(needle, `${needle}\n\t\t${images.join("\n\t\t")}`);
  } else if (!text.includes('id="mntbliss_heart_cracked"') && opts.heart) {
    text = text.replace(
      '<Image id="mntbliss_heart_crosshair" src="s2r://panorama/images/heart_crosshair.vsvg" />',
      '<Image id="mntbliss_heart_crosshair" src="s2r://panorama/images/heart_crosshair.vsvg" />\n\t\t<Image id="mntbliss_heart_cracked" src="s2r://panorama/images/heart_crosshair_cracked.vsvg" />',
    );
  }

  if (opts.customHeadshot && !text.includes('id="mntbliss_heart_spikes"')) {
    const cracked = '<Image id="mntbliss_heart_cracked" src="s2r://panorama/images/heart_crosshair_cracked.vsvg" />';
    const heart = '<Image id="mntbliss_heart_crosshair" src="s2r://panorama/images/heart_crosshair.vsvg" />';
    const spikes = '\n\t\t<Image id="mntbliss_heart_spikes" src="s2r://panorama/images/heart_rose_spikes.vsvg" />';

    if (text.includes(cracked)) text = text.replace(cracked, `${cracked}${spikes}`);
    else if (text.includes(heart)) text = text.replace(heart, `${heart}${spikes}`);
    else text = text.replace(needle, `${needle}${spikes}`);
  }

  if (opts.customHit && !text.includes('id="mntbliss_hit_hearts"')) {
    const spikes = '<Image id="mntbliss_heart_spikes" src="s2r://panorama/images/heart_rose_spikes.vsvg" />';
    const hitHearts = '\n\t\t<Image id="mntbliss_hit_hearts" src="s2r://panorama/images/heart_hit_hearts.vsvg" />';

    if (text.includes(spikes)) text = text.replace(spikes, `${spikes}${hitHearts}`);
    else text = text.replace(needle, `${needle}${hitHearts}`);
  }

  return text;
}

export function injectHeartIntoHud(text: string): string {
  if (text.includes('id="mntbliss_heart_crosshair"')) return text;

  const needle = '<Panel id="LowHealthWarning">';

  if (!text.includes(needle)) BuildError.fail("hud.xml is missing #LowHealthWarning");

  return text.replace(
    needle,
    `<Panel id="LowHealthWarning">
						<Image id="mntbliss_heart_echo" src="s2r://panorama/images/heart_crosshair.vsvg" />
						<Image id="mntbliss_heart_crosshair" src="s2r://panorama/images/heart_crosshair.vsvg" />`,
  );
}

export function injectLowhpListener(text: string): string {
  if (text.includes('id="mntbliss_lowhp_listener"')) return text;

  const needle = '<Panel class="HudCore"';

  if (!text.includes(needle)) return text;

  return text.replace(
    needle,
    `<GlobalClassListener id="mntbliss_lowhp_listener" classes="localPlayerLowHealth" />
		<GlobalClassListener id="mntbliss_reload_listener" classes="reloading" />
		<Panel class="HudCore"`,
  );
}

export function injectMinionHpLabel(text: string): string {
  if (text.includes("mntbliss_hp_label")) return text;

  const hpLabel =
    '<Label id="mntbliss_hp_label" class="mntbliss_hp_label" text="{i:health}/{i:maxHealth}" />';

  if (text.includes('<Panel id="UnitHealthbarsContainer" />')) {
    return text.replace(
      '<Panel id="UnitHealthbarsContainer" />',
      `${hpLabel}\n\t\t\t\t<Panel id="UnitHealthbarsContainer" />`,
    );
  }

  if (text.includes('<Panel id="InfoHealthContainer">')) {
    return text.replace(
      '<Panel id="InfoHealthContainer">',
      `<Panel id="InfoHealthContainer">\n\t\t\t\t${hpLabel}`,
    );
  }

  return text;
}
