/** One CSS value from config.json, with Panorama unit conversions. */
export class CssValue {
  constructor(readonly raw: string) {}

  asPx(): string {
    const text = this.raw.trim().toLowerCase().replaceAll(" ", "");

    if (text.endsWith("px")) return text;

    return `${Math.max(Number(text), 1)}px`;
  }

  asOpacity(): string {
    const text = this.raw.trim().toLowerCase().replaceAll(" ", "");

    if (text.endsWith("%")) {
      return String(Math.max(Math.min(Number(text.slice(0, -1)) / 100, 1), 0));
    }

    const number = Number(text);

    if (number > 1) return String(Math.max(Math.min(number / 100, 1), 0));

    return String(Math.max(Math.min(number, 1), 0));
  }

  asSignedPx(): string {
    let text = this.raw.trim().toLowerCase().replaceAll(" ", "");

    if (text.endsWith("px")) text = text.slice(0, -2);

    return `${Number(text)}px`;
  }

  asUiScale(): string {
    const text = this.raw.trim().toLowerCase().replaceAll("px", "");

    if (text.endsWith("%")) return text;

    const number = Number(text);

    if (number <= 10) return `${number * 100}%`;

    return `${number}%`;
  }

  asNumber(): number {
    return Number(this.asSignedPx().replace("px", ""));
  }
}
