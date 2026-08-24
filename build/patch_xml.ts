import { BuildError } from "../types/BuildError.ts";

export function hoistHpNumbers(text: string): string {
  if (text.includes('class="hp_numbers_row"')) return text;

  const pattern =
    /<Panel class="progress_bar_numbers">\s*<Panel class="bar_num_col_right">\s*<Label id="current_health"[^>]*>\s*<Label id="max_health"[^>]*>\s*<\/Panel>\s*<\/Panel>\s*/s;
  const next = text.replace(pattern, "");

  if (next === text) {
    console.log("WARN: could not hoist HP number labels");
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
    console.log("WARN: health_bar_border missing after hoist");
    return text;
  }

  console.log("Hoisted HP numbers out of the progress bar");
  return text.replace('<Panel class="health_bar_border">', row);
}

export function injectUnsecuredSoulsChip(text: string): string {
  if (text.includes('id="mntbliss_hp_souls"')) return text;

  const needle = "<CitadelHudSoulAPContainer>";

  if (!text.includes(needle)) {
    console.log("WARN: gold container missing CitadelHudSoulAPContainer");
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

export function injectHeartsIntoGun(text: string): string {
  if (text.includes('id="mntbliss_heart_crosshair"') && text.includes('id="mntbliss_heart_cracked"')) {
    return text;
  }

  const needle = '<Citadel_AbilityHUDElement_Gun class="ability_element_gun">';

  if (!text.includes(needle)) {
    BuildError.fail("element_gun.xml is missing Citadel_AbilityHUDElement_Gun");
  }

  const hearts = `${needle}
		<Image id="mntbliss_heart_echo" src="s2r://panorama/images/heart_crosshair.vsvg" />
		<Image id="mntbliss_heart_crosshair" src="s2r://panorama/images/heart_crosshair.vsvg" />
		<Image id="mntbliss_heart_cracked" src="s2r://panorama/images/heart_crosshair_cracked.vsvg" />`;

  if (text.includes('id="mntbliss_heart_cracked"')) {
    return text.replace(
      needle,
      `${needle}
		<Image id="mntbliss_heart_echo" src="s2r://panorama/images/heart_crosshair.vsvg" />
		<Image id="mntbliss_heart_crosshair" src="s2r://panorama/images/heart_crosshair.vsvg" />`,
    );
  }

  return text.replace(needle, hearts);
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
