import path from "node:path";

import { BuildError } from "./BuildError.ts";
import type { ProjectPaths } from "./ProjectPaths.ts";

const SUFFIX: Record<string, string> = {
  ".css": ".vcss_c",
  ".xml": ".vxml_c",
  ".vdata": ".vdata_c",
  ".svg": ".vsvg_c",
};

/** One source file staged for resourcecompiler. */
export class CompileInput {
  constructor(readonly source: string) {}

  compiledPath(paths: ProjectPaths): string {
    const rel = path.relative(paths.content, this.source);
    const ext = path.extname(this.source).toLowerCase();
    const suffix = SUFFIX[ext];

    if (!suffix) BuildError.fail(`Unknown source type: ${this.source}`);

    return path.join(paths.gameOut, path.dirname(rel), `${path.basename(this.source, ext)}${suffix}`);
  }
}
