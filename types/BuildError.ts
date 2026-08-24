export class BuildError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode = 1) {
    super(message);
    this.name = "BuildError";
    this.exitCode = exitCode;
  }

  static fail(message: string, exitCode = 1): never {
    console.error(message);
    process.exit(exitCode);
  }
}
