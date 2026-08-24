import fs from "node:fs";
import path from "node:path";

import { BuildError } from "./BuildError.ts";
import { CsdkInstall } from "./CsdkInstall.ts";
import { LocalPaths } from "./LocalPaths.ts";
import { SteamLibrary } from "./SteamLibrary.ts";

/** Resolved Deadlock + CSDK + extract + output paths. */
export class ProjectPaths {
  constructor(
    readonly root: string,
    readonly deadlock: string,
    readonly csdk: string,
  ) {}

  get extract(): string {
    const vendored = path.join(this.root, "assets", "panorama");

    if (fs.existsSync(vendored)) return vendored;

    const nextToGame = path.join(this.deadlock, "_hud_extract", "panorama");

    if (fs.existsSync(nextToGame)) return nextToGame;

    return vendored;
  }

  get npcUnitsSrc(): string {
    const vendored = path.join(this.root, "assets", "scripts", "npc_units.vdata");

    if (fs.existsSync(vendored)) return vendored;

    return path.join(this.deadlock, "_extract_decompiled_scripts", "scripts", "npc_units.vdata");
  }

  get configJson(): string {
    return path.join(this.root, "config.json");
  }

  get pathsJson(): string {
    return path.join(this.root, LocalPaths.fileName);
  }

  get playerCss(): string {
    return path.join(this.root, "panorama", "styles", "hud_hp_bottom_center.css");
  }

  get unitCss(): string {
    return path.join(this.root, "panorama", "styles", "unit_hp_top_chunky.css");
  }

  get minimapCss(): string {
    return path.join(this.root, "panorama", "styles", "hud_minimap_rounded.css");
  }

  get heartCss(): string {
    return path.join(this.root, "panorama", "styles", "hud_heart_crosshair.css");
  }

  get inventoryCss(): string {
    return path.join(this.root, "panorama", "styles", "hud_clear_inventory.css");
  }

  get compiler(): string {
    return path.join(this.csdk, "game", "bin_cs2", "win64", "resourcecompiler.exe");
  }

  get packer(): string {
    return path.join(this.csdk, "game", "bin", "win64", "CSDKCfgVPK.exe");
  }

  get content(): string {
    return path.join(this.csdk, "content", "citadel_addons", "hp_bar");
  }

  get gameOut(): string {
    return path.join(this.csdk, "game", "citadel_addons", "hp_bar");
  }

  get addons(): string {
    return path.join(this.deadlock, "game", "citadel", "addons");
  }

  get outVpk(): string {
    return path.join(this.addons, "pak01_dir.vpk");
  }

  static resolve(root: string): ProjectPaths {
    const local = LocalPaths.read(path.join(root, LocalPaths.fileName));
    return new ProjectPaths(root, ProjectPaths.deadlockRoot(root, local), ProjectPaths.csdkRoot(root, local));
  }

  static findDeadlock(root: string): string | undefined {
    const local = LocalPaths.read(path.join(root, LocalPaths.fileName));
    const explicit = ProjectPaths.explicitDeadlock(local);

    if (explicit && SteamLibrary.isDeadlock(explicit)) return explicit;

    return ProjectPaths.autoDeadlock(root);
  }

  private static explicitDeadlock(local: LocalPaths): string | undefined {
    const env = process.env.DEADLOCK_ROOT || process.env.MNTBLISS_DEADLOCK;
    const raw = LocalPaths.expand(env) || local.deadlock_root;

    return raw ? path.resolve(raw) : undefined;
  }

  private static autoDeadlock(root: string): string | undefined {
    const parent = path.resolve(path.dirname(root));

    if (SteamLibrary.isDeadlock(parent)) return parent;

    return SteamLibrary.findDeadlock();
  }

  private static deadlockRoot(root: string, local: LocalPaths): string {
    const explicit = ProjectPaths.explicitDeadlock(local);

    if (explicit && SteamLibrary.isDeadlock(explicit)) return explicit;

    const found = ProjectPaths.autoDeadlock(root);

    if (found) return found;

    const looked = [path.resolve(path.dirname(root)), ...SteamLibrary.candidates()];

    BuildError.fail(
      "Could not find Deadlock automatically.\n\n" +
        `Set deadlock_root in ${LocalPaths.fileName}, for example:\n` +
        `  "deadlock_root": "D:/SteamLibrary/steamapps/common/Deadlock"\n\n` +
        "Looked in:\n" +
        looked.map((dir) => `  ${dir}`).join("\n"),
    );
  }

  private static csdkRoot(root: string, local: LocalPaths): string {
    const env = LocalPaths.expand(process.env.CSDK_ROOT || process.env.MNTBLISS_CSDK);
    const explicit = env || local.csdk_root;

    if (explicit) {
      const resolved = CsdkInstall.unwrap(explicit);

      if (resolved) return resolved;
    }

    const found = CsdkInstall.find(root);

    if (found) return found;

    BuildError.fail(
      "Could not find Reduced CSDK 12 automatically.\n\n" +
        `Set csdk_root in ${LocalPaths.fileName} to the folder that contains\n` +
        "game/bin_cs2/win64/resourcecompiler.exe, for example:\n" +
        `  "csdk_root": "C:/Users/you/Downloads/Reduced_CSDK_12"\n\n` +
        "Looked in:\n" +
        CsdkInstall.candidates(root).map((dir) => `  ${dir}`).join("\n"),
    );
  }
}
