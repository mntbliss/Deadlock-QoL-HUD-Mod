import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { BuildError } from "../types/BuildError.ts";
import { CompileInput } from "../types/CompileInput.ts";
import type { ProjectPaths } from "../types/ProjectPaths.ts";

export function compileFiles(paths: ProjectPaths, inputs: CompileInput[]): void {
  if (!fs.existsSync(paths.compiler)) {
    BuildError.fail(`Missing compiler: ${paths.compiler}`);
  }

  const args = ["-nop4", "-f"];

  for (const file of inputs) args.push("-i", file.source);

  console.log("Compiling", inputs.length, "files...");

  const proc = spawnSync(paths.compiler, args, { encoding: "utf8" });

  if (proc.stdout) process.stdout.write(proc.stdout);
  if (proc.stderr) process.stderr.write(proc.stderr);
  if (proc.status !== 0) BuildError.fail(`resourcecompiler failed with code ${proc.status}`);
}

export function assertCompiled(paths: ProjectPaths, inputs: CompileInput[]): string[] {
  return inputs.map((src) => {
    const out = src.compiledPath(paths);

    if (!fs.existsSync(out)) BuildError.fail(`Missing compiled output: ${out}`);

    return out;
  });
}

export function packVpk(paths: ProjectPaths): void {
  if (!fs.existsSync(paths.packer)) {
    BuildError.fail(`Missing packer: ${paths.packer}`);
  }

  fs.mkdirSync(paths.addons, { recursive: true });

  const stagedPath = paths.outVpk.replace(/\.vpk$/i, ".vpk.new");

  if (fs.existsSync(stagedPath)) fs.unlinkSync(stagedPath);

  console.log("Packing", stagedPath);

  const proc = spawnSync(paths.packer, [paths.gameOut, stagedPath], { encoding: "utf8" });

  if (proc.stdout) process.stdout.write(proc.stdout);
  if (proc.stderr) process.stderr.write(proc.stderr);
  if (proc.status !== 0) BuildError.fail(`CSDKCfgVPK failed with code ${proc.status}`);
  if (!fs.existsSync(stagedPath)) BuildError.fail("VPK was not created");

  copyShareableVpk(paths, stagedPath);

  try {
    if (fs.existsSync(paths.outVpk)) fs.unlinkSync(paths.outVpk);

    fs.renameSync(stagedPath, paths.outVpk);
    console.log(`OK: ${paths.outVpk} (${fs.statSync(paths.outVpk).size} bytes)`);
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";

    if (code === "EPERM" || code === "EBUSY") {
      console.log(`Game is locking ${path.basename(paths.outVpk)}.`);
      console.log(`Shareable pack is in compiled\\pak01_dir.vpk`);
      console.log("Fully close Deadlock, then run enable_mod.bat or install_compiled.bat.");
      process.exit(2);
    }

    throw err;
  }
}

function copyShareableVpk(paths: ProjectPaths, from: string): void {
  const destDir = path.join(paths.root, "compiled");
  const dest = path.join(destDir, "pak01_dir.vpk");

  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(from, dest);
  console.log(`Shareable copy: ${dest} (${fs.statSync(dest).size} bytes)`);
}
