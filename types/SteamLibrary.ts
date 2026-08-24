import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/** Steam library folders and the Deadlock install inside them. */
export class SteamLibrary {
  static isDeadlock(dir: string): boolean {
    return fs.existsSync(path.join(dir, "game", "citadel"));
  }

  static findDeadlock(): string | undefined {
    for (const dir of this.candidates()) {
      if (this.isDeadlock(dir)) return dir;
    }
    return undefined;
  }

  static candidates(): string[] {
    const out: string[] = [];

    for (const steam of this.steamInstalls()) {
      out.push(path.join(steam, "steamapps", "common", "Deadlock"));
      out.push(...this.deadlocksFromVdf(path.join(steam, "steamapps", "libraryfolders.vdf")));
    }

    for (const letter of "CDEFGH") {
      out.push(`${letter}:/SteamLibrary/steamapps/common/Deadlock`);
      out.push(`${letter}:/Steam/steamapps/common/Deadlock`);
    }

    return [...new Set(out.map((dir) => path.resolve(dir)))];
  }

  private static steamInstalls(): string[] {
    const guesses = [
      "C:/Program Files (x86)/Steam",
      "C:/Program Files/Steam",
      this.registrySteamPath(),
    ];
    const found: string[] = [];

    for (const dir of guesses) {
      if (!dir) continue;

      const resolved = path.resolve(dir);

      if (fs.existsSync(resolved) && !found.includes(resolved)) found.push(resolved);
    }

    return found;
  }

  private static deadlocksFromVdf(vdf: string): string[] {
    if (!fs.existsSync(vdf)) return [];

    const text = fs.readFileSync(vdf, "utf8");
    const out: string[] = [];

    for (const match of text.matchAll(/"path"\s+"([^"]+)"/g)) {
      const lib = (match[1] ?? "").replaceAll("\\\\", "\\");

      if (lib) out.push(path.join(lib, "steamapps", "common", "Deadlock"));
    }

    return out;
  }

  private static registrySteamPath(): string | undefined {
    if (process.platform !== "win32") return undefined;

    const proc = spawnSync("reg", ["query", "HKCU\\Software\\Valve\\Steam", "/v", "SteamPath"], {
      encoding: "utf8",
    });

    if (proc.status !== 0 || !proc.stdout) return undefined;

    const match = proc.stdout.match(/SteamPath\s+REG_SZ\s+(.+)/i);
    const value = match?.[1]?.trim();

    return value || undefined;
  }
}
