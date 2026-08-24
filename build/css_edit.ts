import fs from "node:fs";
import path from "node:path";

import { BuildError } from "../types/BuildError.ts";
import { CssReplacement } from "../types/CssReplacement.ts";
import type { HudConfig } from "../types/HudConfig.ts";
import { PanoramaDefine } from "../types/PanoramaDefine.ts";

function escapeRe(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function stripViewerNoise(text: string): string {
  text = text.replace(/<!--.*?-->\s*/s, "");
  text = text.replace(/\/\*\s*Prettified by Source 2 Viewer.*?\*\/\s*/s, "");

  return text.replace(/^\s+/, "");
}

export function sanitizeBaseCss(text: string): string {
  text = text.replaceAll(
    'opacity-mask: url("s2r://panorama/images/hud/healthbar/healthbar_backer_mask.vsvg");',
    'opacity-mask: url("s2r://panorama/images/masks/no_mask_png.vtex");',
  );
  text = text.replaceAll(
    'opacity-mask: url("s2r://panorama/images/hud/healthbar/healthbar_backer_horiz_mask.vsvg");',
    'opacity-mask: url("s2r://panorama/images/masks/no_mask_png.vtex");',
  );
  text = text.replaceAll(
    'opacity-mask: url("s2r://panorama/images/hud/healthbar/healthbar_backer_vert_mask.vsvg");',
    'opacity-mask: url("s2r://panorama/images/masks/no_mask_png.vtex");',
  );
  text = text.replace(
    /background-image:\s*url\("s2r:\/\/panorama\/images\/hud\/healthbar\/healthbar_fill_texture[^"]*"\);/g,
    "background-image: none;",
  );

  return text.replace(
    /background-image:\s*url\("s2r:\/\/panorama\/images\/hud\/healthbar\/healthbar_frame[^"]*"\);/g,
    "background-image: none;",
  );
}

export function replaceFirstRuleProps(
  text: string,
  selector: string,
  replacements: CssReplacement[],
): string {
  const match = text.match(new RegExp(`^[ \\t]*${escapeRe(selector)}\\s*\\{`, "m"));

  if (!match || match.index === undefined) return text;

  const start = match.index + match[0].length;
  const end = text.indexOf("}", start);

  if (end < 0) return text;

  let body = text.slice(start, end);

  for (const { from, to } of replacements) body = body.replaceAll(from, to);

  return text.slice(0, start) + body + text.slice(end);
}

export function injectIntoFirstRule(text: string, selector: string, snippet: string): string {
  const match = text.match(new RegExp(`^[ \\t]*${escapeRe(selector)}\\s*\\{`, "m"));

  if (!match || match.index === undefined) return text;

  const start = match.index + match[0].length;
  const end = text.indexOf("}", start);

  if (end < 0) return text;

  const body = text.slice(start, end);
  const extra = snippet.trim();

  if (body.includes(extra)) return text;

  return `${text.slice(0, start)}\n\t${extra}${body}${text.slice(end)}`;
}

export function renderTemplate(filePath: string, cfg: HudConfig): string {
  let text = fs.readFileSync(filePath, "utf8");
  const keys = [...text.matchAll(/\{\{(\w+)\}\}/g)]
    .map((m) => m[1])
    .filter((key): key is string => Boolean(key));
  const missing = [...new Set(keys)].filter((key) => !cfg.has(key)).sort();

  if (missing.length) {
    BuildError.fail(`${path.basename(filePath)}: config.json missing keys: ${missing.join(", ")}`);
  }

  text = text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => cfg.get(key));

  for (const define of PanoramaDefine.all()) {
    const value = define.valueFrom((key) => (cfg.has(key) ? cfg.get(key) : undefined));

    if (value === undefined) continue;

    text = text.replace(new RegExp(`(@define ${escapeRe(define.name)}:\\s*)[^;]+;`), `$1${value};`);
  }

  return text;
}
