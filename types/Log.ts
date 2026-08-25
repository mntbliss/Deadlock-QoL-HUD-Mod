/** Cute one-line build logs: [emoji] [OK|WARN|ERROR] message */
export class Log {
  private static readonly reset = "\x1b[0m";
  private static readonly green = "\x1b[32m";
  private static readonly red = "\x1b[91m";
  private static readonly orange = "\x1b[38;5;208m";
  private static readonly purple = "\x1b[38;5;177m";

  private static line(emoji: string, status: string, color: string, message: string): string {
    return `[${emoji}] [${color}${status}${this.reset}] ${message}`;
  }

  static ok(emoji: string, message: string): void {
    console.log(this.line(emoji, "OK", this.green, message));
  }

  static warn(emoji: string, message: string): void {
    console.error(this.line(emoji, "WARN", this.orange, message));
  }

  static error(emoji: string, message: string): void {
    console.error(this.line(emoji, "ERROR", this.red, message));
  }

  static loading(filePath: string): void {
    const normalized = filePath.replaceAll("\\", "/");

    console.log(`>> Loading: ${this.purple}${normalized}${this.reset}`);
  }
}
