import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const FOLDER_NAMES = ["Reduced_CSDK_12", "Reduced CSDK 12", "reduced_csdk_12"];

/** Reduced CSDK 12 folder that contains resourcecompiler.exe. */
export class CsdkInstall {
  static isRoot(dir: string): boolean {
    return fs.existsSync(path.join(dir, "game", "bin_cs2", "win64", "resourcecompiler.exe"));
  }

  /** Accept either the inner SDK folder or the zip wrapper around it. */
  static unwrap(dir: string): string | undefined {
    const resolved = path.resolve(dir);

    if (this.isRoot(resolved)) return resolved;

    for (const name of FOLDER_NAMES) {
      const nested = path.join(resolved, name);

      if (this.isRoot(nested)) return nested;
    }

    return undefined;
  }

  static find(repoRoot: string, extra: string[] = []): string | undefined {
    for (const dir of extra.concat(this.candidates(repoRoot))) {
      const root = this.unwrap(dir);

      if (root) return root;
    }

    return undefined;
  }

  static candidates(repoRoot: string): string[] {
    const home = os.homedir();
    const bases = [
      repoRoot,
      path.dirname(repoRoot),
      path.join(home, "Downloads"),
      path.join(home, "Desktop"),
      path.join(home, "Documents"),
    ];
    const out: string[] = [];

    for (const base of bases) {
      for (const name of FOLDER_NAMES) out.push(path.join(base, name));
    }

    return out;
  }
}
