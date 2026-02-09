import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const execAsync = promisify(exec);

interface FileInfo {
  path: string;
  size: number;
  name: string;
}

interface JunkCategory {
  category: string;
  files: FileInfo[];
  totalSize: number;
}

async function getDirectorySize(dirPath: string): Promise<number> {
  try {
    const { stdout } = await execAsync(`du -sk "${dirPath}" 2>/dev/null`);
    const sizeKb = parseInt(stdout.split("\t")[0], 10);
    return sizeKb * 1024;
  } catch {
    return 0;
  }
}

async function getFilesInDirectory(
  dirPath: string,
  maxDepth: number = 2,
): Promise<FileInfo[]> {
  const files: FileInfo[] = [];
  try {
    const { stdout } = await execAsync(
      `find "${dirPath}" -maxdepth ${maxDepth} -type f -exec stat -f "%z %N" {} \\; 2>/dev/null | head -100`,
    );
    const lines = stdout.trim().split("\n").filter(Boolean);
    for (const line of lines) {
      const spaceIdx = line.indexOf(" ");
      if (spaceIdx === -1) continue;
      const size = parseInt(line.substring(0, spaceIdx), 10);
      const filePath = line.substring(spaceIdx + 1);
      files.push({
        path: filePath,
        size,
        name: path.basename(filePath),
      });
    }
  } catch {
    // Directory might not exist or not be accessible
  }
  return files;
}

async function scanCategoryDirs(
  categoryName: string,
  dirs: string[],
): Promise<JunkCategory> {
  const allFiles: FileInfo[] = [];
  let totalSize = 0;

  for (const dir of dirs) {
    const resolvedDir = dir.replace("~", os.homedir());
    if (!fs.existsSync(resolvedDir)) continue;

    const files = await getFilesInDirectory(resolvedDir, 2);
    allFiles.push(...files);
    const size = await getDirectorySize(resolvedDir);
    totalSize += size;
  }

  allFiles.sort((a, b) => b.size - a.size);

  return {
    category: categoryName,
    files: allFiles.slice(0, 50),
    totalSize,
  };
}

export async function scanSystemJunk(): Promise<JunkCategory[]> {
  const home = os.homedir();
  const categories: JunkCategory[] = [];

  // User Caches
  categories.push(
    await scanCategoryDirs("User Cache", [`${home}/Library/Caches`]),
  );

  // System Logs
  categories.push(
    await scanCategoryDirs("System Logs", [`${home}/Library/Logs`, "/var/log"]),
  );

  // Temporary Files
  categories.push(
    await scanCategoryDirs("Temporary Files", ["/tmp", "/private/var/folders"]),
  );

  // Downloads (old files > 30 days)
  try {
    const { stdout } = await execAsync(
      `find "${home}/Downloads" -maxdepth 1 -type f -mtime +30 -exec stat -f "%z %N" {} \\; 2>/dev/null | head -50`,
    );
    const files: FileInfo[] = [];
    let totalSize = 0;
    const lines = stdout.trim().split("\n").filter(Boolean);
    for (const line of lines) {
      const spaceIdx = line.indexOf(" ");
      if (spaceIdx === -1) continue;
      const size = parseInt(line.substring(0, spaceIdx), 10);
      const filePath = line.substring(spaceIdx + 1);
      files.push({
        path: filePath,
        size,
        name: path.basename(filePath),
      });
      totalSize += size;
    }
    files.sort((a, b) => b.size - a.size);
    categories.push({
      category: "Old Downloads",
      files,
      totalSize,
    });
  } catch {
    categories.push({
      category: "Old Downloads",
      files: [],
      totalSize: 0,
    });
  }

  // Xcode derived data
  const xcodeDir = `${home}/Library/Developer/Xcode/DerivedData`;
  if (fs.existsSync(xcodeDir)) {
    categories.push(await scanCategoryDirs("Xcode Derived Data", [xcodeDir]));
  }

  // Brew cache
  const brewCache = `${home}/Library/Caches/Homebrew`;
  if (fs.existsSync(brewCache)) {
    categories.push(await scanCategoryDirs("Homebrew Cache", [brewCache]));
  }

  categories.sort((a, b) => b.totalSize - a.totalSize);
  return categories;
}

export interface ScanOptions {
  minSizeMB?: number;
  maxDepth?: number;
  excludedFolders?: string[];
  scanHidden?: boolean;
}

export async function scanLargeFiles(options: ScanOptions = {}): Promise<
  Array<{
    path: string;
    name: string;
    size: number;
    lastModified: string;
    extension: string;
  }>
> {
  const {
    minSizeMB = 50,
    maxDepth = 5,
    excludedFolders = [],
    scanHidden = false,
  } = options;

  const home = os.homedir();
  const results: Array<{
    path: string;
    name: string;
    size: number;
    lastModified: string;
    extension: string;
  }> = [];

  // Build exclusion clauses
  const defaultExclusions = [
    "*/Library/Application Support/MobileSync/*",
    "*/.Trash/*",
    "*/node_modules/*",
    "*/.git/*",
  ];

  if (!scanHidden) {
    defaultExclusions.push("*/.*/*");
  }

  const allExclusions = [
    ...defaultExclusions,
    ...excludedFolders.map((f) => `${f}/*`),
  ];

  const exclusionStr = allExclusions.map((e) => `-not -path "${e}"`).join(" ");

  try {
    const { stdout } = await execAsync(
      `find "${home}" -maxdepth ${maxDepth} -type f -size +${minSizeMB}M ` +
        `${exclusionStr} ` +
        `-exec stat -f "%z|%m|%N" {} \\; 2>/dev/null | sort -t'|' -k1 -rn | head -50`,
    );

    const lines = stdout.trim().split("\n").filter(Boolean);
    for (const line of lines) {
      const parts = line.split("|");
      if (parts.length < 3) continue;
      const size = parseInt(parts[0], 10);
      const mtime = parseInt(parts[1], 10);
      const filePath = parts.slice(2).join("|");
      const ext = path.extname(filePath).toLowerCase();

      results.push({
        path: filePath,
        name: path.basename(filePath),
        size,
        lastModified: new Date(mtime * 1000).toISOString(),
        extension: ext || "unknown",
      });
    }
  } catch {
    // Scan failed
  }

  return results;
}

export async function scanApplications(): Promise<
  Array<{
    name: string;
    path: string;
    size: number;
  }>
> {
  const apps: Array<{ name: string; path: string; size: number }> = [];

  try {
    const { stdout } = await execAsync("ls -1 /Applications 2>/dev/null");
    const entries = stdout.trim().split("\n").filter(Boolean);

    for (const entry of entries) {
      if (!entry.endsWith(".app")) continue;
      const appPath = `/Applications/${entry}`;
      const size = await getDirectorySize(appPath);
      apps.push({
        name: entry.replace(".app", ""),
        path: appPath,
        size,
      });
    }

    apps.sort((a, b) => b.size - a.size);
  } catch {
    // Failed to list apps
  }

  return apps;
}
