/** Rewrite one property inside the first matching CSS rule. */
export class CssReplacement {
  constructor(
    readonly from: string,
    readonly to: string,
  ) {}

  static many(pairs: Array<[string, string]>): CssReplacement[] {
    return pairs.map(([from, to]) => new CssReplacement(from, to));
  }
}
