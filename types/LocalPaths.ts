import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { BuildError } from "./BuildError.ts";

/** Optional Deadlock / CSDK roots from paths.json. Invalid paths are ignored so a committed file does not break other machines. */
export class LocalPaths {
  deadlock_root?: string;
  csdk_root?: string;

  static fileName = "paths.json";

  static read(file: string): LocalPaths {
    const out = new LocalPaths();

    if (!fs.existsSync(file)) return out;

    const raw: unknown = JSON.parse(fs.readFileSync(file, "utf8"));

    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
      BuildError.fail(`${path.basename(file)} must be a JSON object`);
    }

    const obj = raw as Record<string, unknown>;
    const deadlock = LocalPaths.expand(obj.deadlock_root);
    const csdk = LocalPaths.expand(obj.csdk_root);

    if (deadlock) out.deadlock_root = deadlock;
    if (csdk) out.csdk_root = csdk;

    return out;
  }

  static expand(value: unknown): string {
    if (typeof value !== "string") return "";

    let text = value.trim().replace(/^["']|["']$/g, "");

    if (!text) return "";

    text = text.replace(/%([^%]+)%/g, (_, name: string) => process.env[name] ?? "");

    if (text.startsWith("~/") || text.startsWith("~\\")) {
      text = path.join(os.homedir(), text.slice(2));
    }

    return text.trim();
  }
}
