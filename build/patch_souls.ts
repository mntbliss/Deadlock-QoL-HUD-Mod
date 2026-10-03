import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { BuildError } from "../types/BuildError.ts";
import type { HudConfig } from "../types/HudConfig.ts";
import { Log } from "../types/Log.ts";
import type { ProjectPaths } from "../types/ProjectPaths.ts";

/**
 * Halo: particle radius locked to 1 → drawn size = soul_orb_halo_size.
 * Orb body: leave m_flConstantRadius alone (vanilla 8). Dark shell uses
 * IgnoreRadius + ConstantRadius; overwriting ConstantRadius to 1 crushed the
 * shell so the colored core outgrew the armored dark layer.
 */
const SOUL_MODEL_PARTICLES = [
  "generic/spirit_orb_ambient_model.vpcf",
  "generic/spirit_orb_ambient_enemy_model.vpcf",
  "environment/spirit_orb_dropped_ambient_model.vpcf",
  "environment/spirit_orb_dropped_ambient_enemy_model.vpcf",
] as const;

const SOUL_GRID_REL = "materials/particle/mntbliss/soul_orb_dot_grid.vtex";

const FIXED_RADIUS = 1.0;
const DEFAULT_HALO_SIZE = 14;

/** CSDK resourcecompiler tops out at vpcf63; newer exports need a header downgrade. */
function normalizeVpcfHeader(text: string): string {
  return text.replace(
    /format:vpcf6[4-9]:version\{[0-9a-f-]+\}/i,
    "format:vpcf63:version{a6e6a69e-52d3-4527-8b9c-ff3bb91aca3e}",
  );
}

function readHaloSize(cfg: HudConfig): number {
  const value = cfg.number("soul_orb_halo_size", DEFAULT_HALO_SIZE);
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_HALO_SIZE;

  return Number(Math.min(40, Math.max(1, value)).toFixed(2));
}

function literalFloatBlock(value: number): string {
  return `{
				m_nType = "PF_TYPE_LITERAL"
				m_nMapType = "PF_MAP_TYPE_DIRECT"
				m_flLiteralValue = ${value}
				m_NamedValue = ""
				m_nControlPoint = 0
				m_nScalarAttribute = 3
				m_nVectorAttribute = 6
				m_nVectorComponent = 0
				m_flRandomMin = 0.0
				m_flRandomMax = 1.0
				m_nRandomMode = "PF_RANDOM_MODE_CONSTANT"
				m_flMultFactor = 1.0
				m_flInput0 = 0.0
				m_flInput1 = 1.0
				m_flOutput0 = 0.0
				m_flOutput1 = 1.0
				m_nBiasType = "PF_BIAS_TYPE_STANDARD"
				m_flBiasParameter = 0.0
				m_Curve =
				{
					m_spline = [  ]
					m_tangents = [  ]
					m_vDomainMins = [ 0.0, 0.0 ]
					m_vDomainMaxs = [ 0.0, 0.0 ]
				}
			}`;
}

/** Force radius init (after lifetime field 1) to a fixed literal. */
function freezeRadiusInit(text: string): string {
  const next = text.replace(
    /(m_nOutputField = 1\r?\n\t\t\},\r?\n\t\t\{\r?\n\t\t\t_class = "C_INIT_InitFloat"\r?\n\t\t\tm_InputValue = \r?\n\t\t\t\{\r?\n\t\t\t\t)m_nType = "[^"]+"\r?\n\t\t\t\tm_nMapType = "[^"]+"\r?\n\t\t\t\tm_flLiteralValue = [0-9.]+/,
    `$1m_nType = "PF_TYPE_LITERAL"\n\t\t\t\tm_nMapType = "PF_MAP_TYPE_DIRECT"\n\t\t\t\tm_flLiteralValue = ${FIXED_RADIUS}`,
  );

  if (next === text) {
    BuildError.fail("soul halo patch: radius InitFloat not found");
  }

  return next;
}

/** Every-frame replace particle radius attribute (field 3) so nothing can rescale it. */
function injectRadiusLockOperator(text: string): string {
  if (text.includes("m_nOutputField = 3\n\t\t\tm_nSetMethod = \"PARTICLE_SET_REPLACE_VALUE\"")) {
    return text;
  }

  const op = `\t\t{
\t\t\t_class = "C_OP_SetFloat"
\t\t\tm_InputValue =
\t\t\t${literalFloatBlock(FIXED_RADIUS)}
\t\t\tm_nOutputField = 3
\t\t\tm_nSetMethod = "PARTICLE_SET_REPLACE_VALUE"
\t\t},
`;

  const next = text.replace(/\tm_Operators =\s*\r?\n\t\[\r?\n/, (m) => `${m}${op}`);

  if (next === text) {
    BuildError.fail("soul halo patch: m_Operators block not found");
  }

  return next;
}

function setHaloRadiusScale(text: string, size: number): string {
  text = text.replace(
    /(_class = "C_OP_RenderSprites"\r?\n)(?:\t\t\tm_bIgnoreRadius = true\r?\n)?(?:\t\t\tm_flMinSize = [\s\S]*?\t\t\tm_flMaxSize = [\s\S]*?\t\t\t\}\r?\n)?/g,
    "$1",
  );

  const next = text.replace(
    /(_class = "C_OP_RenderSprites"\s+m_flRadiusScale\s*=\s*\{\s*m_nType = "PF_TYPE_LITERAL"\s+m_nMapType = "PF_MAP_TYPE_DIRECT"\s+m_flLiteralValue = )\d+(?:\.\d+)?/g,
    `$1${size}`,
  );

  if (next === text) {
    BuildError.fail("soul halo patch: RenderSprites radiusScale not found");
  }

  return next;
}

/**
 * Dark shell must NOT follow the locked particle radius (that's for the halo).
 * Shell already IgnoreRadius in most vpcfs; ensure all shell blocks have it so
 * size stays on ConstantRadius=8 and covers the smaller colored core when armored.
 */
function ensureShellIgnoresParticleRadius(text: string): string {
  const shellMat = 'm_hOverrideMaterial = resource:"materials/models/particle/generic_soul_orb_shell.vmat"';
  let cursor = 0;
  let out = "";
  let hits = 0;

  while (true) {
    const matIdx = text.indexOf(shellMat, cursor);
    if (matIdx < 0) {
      out += text.slice(cursor);
      break;
    }

    const start = text.lastIndexOf('_class = "C_OP_RenderModels"', matIdx);
    if (start < cursor) {
      BuildError.fail("soul halo patch: shell RenderModels opener missing");
    }

    out += text.slice(cursor, start);

    const after = text.slice(start);
    const endRel = after.search(/\n\t\t\{\r?\n\t\t\t_class = "C_OP_Render/);
    const arrayEnd = after.search(/\n\t\]/);
    const blockEndRel = endRel >= 0 ? endRel : arrayEnd;
    if (blockEndRel < 0) {
      BuildError.fail("soul halo patch: shell RenderModels end missing");
    }

    let block = after.slice(0, blockEndRel);
    hits += 1;

    if (!block.includes("m_bIgnoreRadius = true")) {
      block = block.replace(
        /(_class = "C_OP_RenderModels"\r?\n)/,
        "$1\t\t\tm_bIgnoreRadius = true\n",
      );
    }

    out += block;
    cursor = start + blockEndRel;
  }

  if (hits < 1) {
    BuildError.fail("soul halo patch: no soul_orb_shell RenderModels found");
  }

  return out;
}

/** CP1.z armor factor: dim at armored ends, full at vulnerable mid. */
function armorVisibilityFloatBlock(): string {
  return `{
				m_nType = "PF_TYPE_CONTROL_POINT_COMPONENT"
				m_nMapType = "PF_MAP_TYPE_CURVE"
				m_flLiteralValue = 0.0
				m_NamedValue = ""
				m_nControlPoint = 1
				m_nScalarAttribute = 3
				m_nVectorAttribute = 6
				m_nVectorComponent = 2
				m_flRandomMin = 0.0
				m_flRandomMax = 1.0
				m_nRandomMode = "PF_RANDOM_MODE_CONSTANT"
				m_flMultFactor = 1.0
				m_flInput0 = 0.0
				m_flInput1 = 1.0
				m_flOutput0 = 0.0
				m_flOutput1 = 1.0
				m_nBiasType = "PF_BIAS_TYPE_STANDARD"
				m_flBiasParameter = 0.0
				m_Curve =
				{
					m_spline =
					[
						{
							x = 0.0
							y = 0.06
							m_flSlopeIncoming = 0.0
							m_flSlopeOutgoing = 0.0
						},
						{
							x = 0.18
							y = 1.0
							m_flSlopeIncoming = 0.0
							m_flSlopeOutgoing = 0.0
						},
						{
							x = 0.82
							y = 1.0
							m_flSlopeIncoming = 0.0
							m_flSlopeOutgoing = 0.0
						},
						{
							x = 1.0
							y = 0.06
							m_flSlopeIncoming = 0.0
							m_flSlopeOutgoing = 0.0
						},
					]
					m_tangents =
					[
						{ m_nIncomingTangent = "CURVE_TANGENT_SPLINE" m_nOutgoingTangent = "CURVE_TANGENT_SPLINE" },
						{ m_nIncomingTangent = "CURVE_TANGENT_SPLINE" m_nOutgoingTangent = "CURVE_TANGENT_SPLINE" },
						{ m_nIncomingTangent = "CURVE_TANGENT_SPLINE" m_nOutgoingTangent = "CURVE_TANGENT_SPLINE" },
						{ m_nIncomingTangent = "CURVE_TANGENT_SPLINE" m_nOutgoingTangent = "CURVE_TANGENT_SPLINE" },
					]
					m_vDomainMins = [ 0.0, 0.0 ]
					m_vDomainMaxs = [ 1.0, 1.0 ]
				}
			}`;
}

/**
 * Colored cores (generic_soul_orb*) stay bright when armored because they're
 * additive selfillum — shell size can't cover them. Drive their alpha from
 * CP1.z (armor); keep existing CP61 team gate as m_flOpStrength.
 */
function armorDimColoredCores(text: string): string {
  const mats = [
    'm_hOverrideMaterial = resource:"materials/models/particle/generic_soul_orb.vmat"',
    'm_hOverrideMaterial = resource:"materials/models/particle/generic_soul_orb_enemy.vmat"',
  ];

  let hits = 0;

  for (const mat of mats) {
    let cursor = 0;
    let out = "";

    while (true) {
      const matIdx = text.indexOf(mat, cursor);
      if (matIdx < 0) {
        out += text.slice(cursor);
        break;
      }

      const start = text.lastIndexOf('_class = "C_OP_RenderModels"', matIdx);
      if (start < cursor) {
        BuildError.fail("soul halo patch: colored core RenderModels opener missing");
      }

      out += text.slice(cursor, start);

      const after = text.slice(start);
      const endRel = after.search(/\n\t\t\{\r?\n\t\t\t_class = "C_OP_Render/);
      const arrayEnd = after.search(/\n\t\]/);
      const blockEndRel = endRel >= 0 ? endRel : arrayEnd;
      if (blockEndRel < 0) {
        BuildError.fail("soul halo patch: colored core RenderModels end missing");
      }

      let block = after.slice(0, blockEndRel);
      hits += 1;

      const alphaMatch = block.match(/\t\t\tm_flAlphaScale\s*=\s*\{[\s\S]*?\n\t\t\t\}/);
      if (alphaMatch && !block.includes("m_flOpStrength =")) {
        // Existing alpha is the CP61 team gate — keep it as op strength.
        const asStrength = alphaMatch[0].replace("m_flAlphaScale", "m_flOpStrength");
        block = block.replace(
          alphaMatch[0],
          `${asStrength}\n\t\t\tm_flAlphaScale =\n\t\t\t${armorVisibilityFloatBlock()}`,
        );
      } else if (alphaMatch) {
        block = block.replace(alphaMatch[0], `\t\t\tm_flAlphaScale =\n\t\t\t${armorVisibilityFloatBlock()}`);
      } else {
        block = block.replace(
          /(_class = "C_OP_RenderModels"\r?\n)/,
          `$1\t\t\tm_flAlphaScale =\n\t\t\t${armorVisibilityFloatBlock()}\n`,
        );
      }

      // Colored core under dark shell (particle radius locked to 1 for halo).
      if (!/m_flRadiusScale\s*=/.test(block)) {
        block = block.replace(
          /(_class = "C_OP_RenderModels"\r?\n)/,
          `$1\t\t\tm_flRadiusScale =\n\t\t\t${literalFloatBlock(0.55)}\n`,
        );
      }

      out += block;
      cursor = start + blockEndRel;
    }

    text = out;
  }

  if (hits < 1) {
    BuildError.fail("soul halo patch: no colored soul_orb cores found");
  }

  return text;
}

/**
 * glow07 used soft additive bloom (AddSelfAmount 4). Grid must not —
 * that fill was the armored orange ball. Keep dots only.
 */
function toneDownHaloSprite(text: string): string {
  const idx = text.indexOf(`m_hTexture = resource:"${SOUL_GRID_REL}"`);
  if (idx < 0) {
    BuildError.fail("soul halo patch: grid texture missing before tone-down");
  }

  const start = text.lastIndexOf('_class = "C_OP_RenderSprites"', idx);
  if (start < 0) {
    BuildError.fail("soul halo patch: RenderSprites opener missing");
  }

  const after = text.slice(start);
  const endRel = after.search(/\n\t\t\},?\r?\n\t\t\{\r?\n\t\t\t_class = "C_OP_Render/);
  const blockEnd = endRel >= 0 ? start + endRel : text.length;
  let block = text.slice(start, blockEnd);

  const before = block;
  block = block.replace(
    /(m_flAlphaScale\s*=\s*\{\s*m_nType = "PF_TYPE_LITERAL"\s+m_nMapType = "PF_MAP_TYPE_DIRECT"\s+m_flLiteralValue = )\d+(?:\.\d+)?/,
    "$10.35",
  );
  block = block.replace(
    /(m_flAddSelfAmount\s*=\s*\{\s*m_nType = "PF_TYPE_LITERAL"\s+m_nMapType = "PF_MAP_TYPE_DIRECT"\s+m_flLiteralValue = )\d+(?:\.\d+)?/,
    "$10.0",
  );
  block = block.replace(
    /m_LiteralColor = \[ 253, 131, 25 \]/g,
    "m_LiteralColor = [ 255, 255, 255 ]",
  );

  if (block === before || !/m_flAddSelfAmount[\s\S]*?m_flLiteralValue = 0(?:\.0)?/.test(block)) {
    BuildError.fail("soul halo patch: failed to tone down AddSelfAmount");
  }

  return text.slice(0, start) + block + text.slice(blockEnd);
}

function patchOrbHalo(text: string, size: number): string {
  text = normalizeVpcfHeader(text);

  // Do NOT touch m_flConstantRadius — dark shell IgnoreRadius needs vanilla 8.

  const before = text;
  text = text.replaceAll(
    'm_hTexture = resource:"materials/particle/glows/glow07.vtex"',
    `m_hTexture = resource:"${SOUL_GRID_REL}"`,
  );

  if (text === before) {
    BuildError.fail("soul halo patch: glow07 texture reference not found");
  }

  text = text.replace(/^\t\t\tm_nAlpha2Field = 27\r?\n/gm, "");

  text = freezeRadiusInit(text);
  text = injectRadiusLockOperator(text);
  text = ensureShellIgnoresParticleRadius(text);
  text = armorDimColoredCores(text);
  text = setHaloRadiusScale(text, size);
  text = toneDownHaloSprite(text);

  // Darker shell base tint (armored dark layer).
  text = text.replace(/m_LiteralColor = \[ 47, 47, 47 \]/g, "m_LiteralColor = [ 22, 22, 22 ]");
  text = text.replace(/m_LiteralColor = \[ 32, 32, 32 \]/g, "m_LiteralColor = [ 16, 16, 16 ]");

  if (
    !/m_flConstantRadius = 8(?:\.0)?\b/.test(text) ||
    !text.includes("m_nOutputField = 3") ||
    !text.includes(`m_flLiteralValue = ${size}`) ||
    !text.includes(SOUL_GRID_REL) ||
    !text.includes("y = 0.06") ||
    !/m_flAddSelfAmount\s*=\s*\{\s*m_nType = "PF_TYPE_LITERAL"\s+m_nMapType = "PF_MAP_TYPE_DIRECT"\s+m_flLiteralValue = 0(?:\.0)?/.test(
      text,
    )
  ) {
    BuildError.fail("soul halo patch: verification failed — size/glow/armor dim incomplete");
  }

  return text;
}

function compileOne(paths: ProjectPaths, file: string): void {
  const proc = spawnSync(paths.compiler, ["-nop4", "-f", "-i", file], {
    encoding: "utf8",
    cwd: path.dirname(paths.compiler),
  });

  if (proc.status !== 0) {
    if (proc.stdout) process.stdout.write(proc.stdout);
    if (proc.stderr) process.stderr.write(proc.stderr);
    BuildError.fail(`compile failed: ${path.basename(file)}`);
  }
}

function stageSoulGridTexture(paths: ProjectPaths): void {
  const assetDir = path.join(paths.root, "assets", "materials", "particle", "mntbliss");
  const png = path.join(assetDir, "soul_orb_dot_grid.png");
  const vtex = path.join(assetDir, "soul_orb_dot_grid.vtex");

  if (!fs.existsSync(png) || !fs.existsSync(vtex)) {
    BuildError.fail("missing vendored soul grid texture under assets/materials/particle/mntbliss");
  }

  const contentDir = path.join(paths.csdk, "content", "citadel", "materials", "particle", "mntbliss");
  fs.mkdirSync(contentDir, { recursive: true });
  fs.copyFileSync(png, path.join(contentDir, "soul_orb_dot_grid.png"));
  fs.copyFileSync(vtex, path.join(contentDir, "soul_orb_dot_grid.vtex"));

  Log.ok("✨", "soul halo · compiling dot-grid texture");
  compileOne(paths, path.join(contentDir, "soul_orb_dot_grid.vtex"));

  const compiled = path.join(
    paths.csdk,
    "game",
    "citadel",
    "materials",
    "particle",
    "mntbliss",
    "soul_orb_dot_grid.vtex_c",
  );
  const packed = path.join(paths.gameOut, "materials", "particle", "mntbliss", "soul_orb_dot_grid.vtex_c");

  if (!fs.existsSync(compiled)) {
    BuildError.fail(`Missing compiled soul grid texture: ${compiled}`);
  }

  fs.mkdirSync(path.dirname(packed), { recursive: true });
  fs.copyFileSync(compiled, packed);
}

function assertPackedParticles(paths: ProjectPaths, size: number): void {
  for (const rel of SOUL_MODEL_PARTICLES) {
    const compiledName = `${path.basename(rel, ".vpcf")}.vpcf_c`;
    const packed = path.join(paths.gameOut, "particles", path.dirname(rel), compiledName);
    const content = path.join(paths.csdk, "content", "citadel", "particles", rel);

    if (!fs.existsSync(packed)) {
      BuildError.fail(`missing packed particle: ${compiledName}`);
    }

    const src = fs.readFileSync(content, "utf8");
    if (!src.includes(`m_flLiteralValue = ${size}`)) {
      BuildError.fail(`content vpcf missing size ${size}: ${rel}`);
    }
    if (!src.includes("m_nOutputField = 3")) {
      BuildError.fail(`content vpcf missing radius lock op: ${rel}`);
    }
    if (!/m_flConstantRadius = 8(?:\.0)?\b/.test(src)) {
      BuildError.fail(`content vpcf ConstantRadius not vanilla 8: ${rel}`);
    }
    if (!src.includes("generic_soul_orb_shell.vmat") || !src.includes("m_bIgnoreRadius = true")) {
      BuildError.fail(`content vpcf shell missing IgnoreRadius: ${rel}`);
    }

    Log.ok("✨", `locked ${path.basename(rel)} → haloScale=${size} shell@ConstantRadius`);
  }
}

/** Stage halo-only patched models, compile, copy into addon gameOut. */
export function compileBrightSoulOrbs(paths: ProjectPaths, cfg: HudConfig): void {
  const size = readHaloSize(cfg);

  stageSoulGridTexture(paths);

  const assetRoot = path.join(paths.root, "assets", "particles");
  const contentCitadel = path.join(paths.csdk, "content", "citadel");
  const gameCitadel = path.join(paths.csdk, "game", "citadel");
  const staged: string[] = [];

  for (const rel of SOUL_MODEL_PARTICLES) {
    const src = path.join(assetRoot, rel);

    if (!fs.existsSync(src)) {
      BuildError.fail(`missing vendored soul particle: assets/particles/${rel}`);
    }

    const text = patchOrbHalo(fs.readFileSync(src, "utf8"), size);
    const dest = path.join(contentCitadel, "particles", rel);

    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, text);
    staged.push(dest);
  }

  Log.ok("✨", `soul halo · scale=${size} · armor-dim cores via CP1.z · ${staged.length}`);

  const args = ["-nop4", "-f", ...staged.flatMap((file) => ["-i", file])];
  const proc = spawnSync(paths.compiler, args, {
    encoding: "utf8",
    cwd: path.dirname(paths.compiler),
  });

  if (proc.status !== 0) {
    if (proc.stdout) process.stdout.write(proc.stdout);
    if (proc.stderr) process.stderr.write(proc.stderr);
    BuildError.fail("soul orb particle compile failed");
  }

  for (const src of staged) {
    const rel = path.relative(path.join(contentCitadel, "particles"), src);
    const compiledName = `${path.basename(src, ".vpcf")}.vpcf_c`;
    const compiled = path.join(gameCitadel, "particles", path.dirname(rel), compiledName);
    const packed = path.join(paths.gameOut, "particles", path.dirname(rel), compiledName);

    if (!fs.existsSync(compiled)) {
      BuildError.fail(`Missing compiled soul particle: ${compiled}`);
    }

    fs.mkdirSync(path.dirname(packed), { recursive: true });
    fs.copyFileSync(compiled, packed);
  }

  assertPackedParticles(paths, size);

  for (const stale of [
    "generic/spirit_orb_ambient_trail_dark.vpcf_c",
    "generic/spirit_orb_ambient_flash.vpcf_c",
    "generic/spirit_orb_ambient_burst.vpcf_c",
  ]) {
    const packed = path.join(paths.gameOut, "particles", stale);
    if (fs.existsSync(packed)) fs.unlinkSync(packed);
  }
}
