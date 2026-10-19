import path from "node:path";
import os from "node:os";
import { run } from "./exec";
import type {
  FileKind,
  LargeFile,
  LargeFileScanOptions,
} from "../../shared/types";

const MAX_RESULTS = 200;

const KIND_BY_EXT: Record<string, FileKind> = {};
const register = (kind: FileKind, exts: string[]) =>
  exts.forEach((e) => (KIND_BY_EXT[e] = kind));

register("video", [".mp4", ".mov", ".m4v", ".avi", ".mkv", ".webm", ".wmv"]);
register("audio", [".mp3", ".wav", ".aiff", ".flac", ".m4a", ".aac", ".ogg"]);
register("image", [".jpg", ".jpeg", ".png", ".heic", ".tiff", ".raw", ".psd"]);
register("archive", [".zip", ".rar", ".7z", ".tar", ".gz", ".tgz", ".xz"]);
register("diskImage", [".dmg", ".iso", ".pkg", ".img", ".vmdk", ".qcow2"]);
register("document", [".pdf", ".key", ".pages", ".numbers", ".docx", ".pptx"]);

export function fileKind(extension: string): FileKind {
  return KIND_BY_EXT[extension.toLowerCase()] ?? "other";
}

/** Build the argument list for `find`, without going through a shell. */
export function buildFindArgs(
  root: string,
  options: Required<LargeFileScanOptions>,
): string[] {
  const exclusions = [
    "*/Library/Application Support/MobileSync/*",
    "*/.Trash/*",
    "*/node_modules/*",
    "*/.git/*",
    "*/Library/Containers/*",
    "*/Library/Group Containers/*",
    "*/Library/Mobile Documents/*",
    "*/Pictures/Photos Library.photoslibrary/*",
  ];
  if (!options.scanHidden) exclusions.push("*/.*");
  if (options.skipSystemFiles) exclusions.push(`${root}/Library/*`);
  for (const folder of options.excludedFolders) {
    const clean = folder.replace(/\/+$/, "").replace(/^~(?=\/|$)/, root);
    if (clean) exclusions.push(`${clean}/*`);
  }

  const args = [root, "-xdev", "-maxdepth", String(options.maxDepth)];
  for (const pattern of exclusions) args.push("-not", "-path", pattern);
  args.push(
    "-type",
    "f",
    "-size",
    `+${options.minSizeMB}M`,
    "-exec",
    "stat",
    "-f",
    "%z|%m|%a|%N",
    "{}",
    "+",
  );
  return args;
}

export function parseStatLines(stdout: string): LargeFile[] {
  const files: LargeFile[] = [];
  for (const line of stdout.split("\n")) {
    if (!line) continue;
    const [sizeRaw, mtimeRaw, atimeRaw, ...rest] = line.split("|");
    const filePath = rest.join("|");
    const size = parseInt(sizeRaw, 10);
    if (!filePath || !Number.isFinite(size)) continue;
    const extension = path.extname(filePath).toLowerCase();
    files.push({
      path: filePath,
      name: path.basename(filePath),
      size,
      lastModified: new Date(parseInt(mtimeRaw, 10) * 1000).toISOString(),
      lastAccessed: new Date(parseInt(atimeRaw, 10) * 1000).toISOString(),
      extension,
      kind: fileKind(extension),
    });
  }
  return files;
}

export async function scanLargeFiles(
  options: LargeFileScanOptions = {},
): Promise<LargeFile[]> {
  const home = os.homedir();
  const resolved: Required<LargeFileScanOptions> = {
    minSizeMB: Math.max(1, Math.round(options.minSizeMB ?? 50)),
    maxDepth: Math.min(20, Math.max(1, Math.round(options.maxDepth ?? 5))),
    excludedFolders: Array.isArray(options.excludedFolders)
      ? options.excludedFolders.filter((f) => typeof f === "string")
      : [],
    scanHidden: Boolean(options.scanHidden),
    skipSystemFiles: options.skipSystemFiles ?? true,
  };

  let stdout = "";
  try {
    stdout = await run("find", buildFindArgs(home, resolved), {
      timeout: 5 * 60 * 1000,
    });
  } catch (err) {
    // find exits non-zero when some folders are unreadable but still prints
    // everything it could read.
    stdout = (err as { stdout?: string }).stdout ?? "";
  }

  return parseStatLines(stdout)
    .sort((a, b) => b.size - a.size)
    .slice(0, MAX_RESULTS);
}
