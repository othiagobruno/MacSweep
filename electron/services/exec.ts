import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const MAX_BUFFER = 64 * 1024 * 1024;

/**
 * Run a binary with arguments (no shell involved, so no injection risk).
 * Resolves with stdout; rejects on non-zero exit.
 */
export async function run(
  file: string,
  args: string[] = [],
  options: { timeout?: number } = {},
): Promise<string> {
  const { stdout } = await execFileAsync(file, args, {
    maxBuffer: MAX_BUFFER,
    timeout: options.timeout ?? 0,
  });
  return stdout;
}

/** Like run(), but never throws — returns stdout or null. */
export async function tryRun(
  file: string,
  args: string[] = [],
  options: { timeout?: number } = {},
): Promise<string | null> {
  try {
    return await run(file, args, options);
  } catch {
    return null;
  }
}

/** Quote a value for safe interpolation into a POSIX shell command. */
export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** Escape a string so it can be embedded in an AppleScript string literal. */
function appleScriptString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export class AdminCancelledError extends Error {
  constructor() {
    super("Authorization cancelled by user");
    this.name = "AdminCancelledError";
  }
}

/**
 * Run a shell command as root through the native macOS password prompt.
 * Every dynamic value inside `command` MUST be quoted with shellQuote().
 */
export async function runAsAdmin(
  command: string,
  prompt = "MacSweep needs your permission to continue.",
): Promise<string> {
  const script = `do shell script ${appleScriptString(command)} with prompt ${appleScriptString(prompt)} with administrator privileges`;
  try {
    return await run("osascript", ["-e", script]);
  } catch (err) {
    if (isCancelled(err)) throw new AdminCancelledError();
    throw err;
  }
}

export function isCancelled(err: unknown): boolean {
  if (err instanceof AdminCancelledError) return true;
  const msg = errorMessage(err);
  return msg.includes("(-128)") || msg.includes("User canceled");
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Map with bounded concurrency, preserving input order. */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await fn(items[index], index);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

/**
 * Size on disk in bytes using `du`, which is far faster than walking in JS.
 * `du` exits non-zero when any single entry is unreadable but still prints
 * the total for everything else, so that partial total is used.
 */
export async function diskSize(target: string): Promise<number> {
  let out: string;
  try {
    out = await run("du", ["-sk", target]);
  } catch (err) {
    out = (err as { stdout?: string }).stdout ?? "";
  }
  const kb = parseInt(out.split("\t")[0], 10);
  return Number.isFinite(kb) ? kb * 1024 : 0;
}
