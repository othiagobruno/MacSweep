import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { diskSize, mapLimit } from "./exec";
import type {
  JunkCategoryId,
  JunkItem,
  ScanProgress,
  SystemJunkResult,
} from "../../shared/types";

const DAY_MS = 24 * 60 * 60 * 1000;

interface CategorySpec {
  id: JunkCategoryId;
  dirs: string[];
  defaultSelected: boolean;
  /** Only include entries not modified for this many days. */
  minAgeDays?: number;
  /** Entry names to skip (exact match or prefix ending with "*"). */
  skip?: string[];
}

/**
 * Entries that are system-managed, in active use by macOS, or would only be
 * recreated immediately. Skipping them avoids permission errors on clean.
 */
const CACHE_SKIP = [
  "com.apple.*",
  "CloudKit",
  "FamilyCircle",
  "GeoServices",
  "Homebrew", // reported separately under developer caches
];

function categorySpecs(ownCacheNames: string[]): CategorySpec[] {
  const home = os.homedir();
  return [
    {
      id: "userCache",
      dirs: [`${home}/Library/Caches`],
      defaultSelected: true,
      skip: [...CACHE_SKIP, ...ownCacheNames],
    },
    {
      id: "userLogs",
      dirs: [`${home}/Library/Logs`],
      defaultSelected: true,
      skip: ["com.apple.*"],
    },
    {
      id: "tempFiles",
      dirs: [os.tmpdir()],
      defaultSelected: true,
      minAgeDays: 3,
    },
    {
      id: "trash",
      dirs: [`${home}/.Trash`],
      defaultSelected: true,
    },
    {
      id: "oldDownloads",
      dirs: [`${home}/Downloads`],
      defaultSelected: false,
      minAgeDays: 90,
    },
    {
      id: "xcode",
      dirs: [
        `${home}/Library/Developer/Xcode/DerivedData`,
        `${home}/Library/Developer/Xcode/iOS DeviceSupport`,
        `${home}/Library/Developer/CoreSimulator/Caches`,
      ],
      defaultSelected: true,
    },
    {
      id: "devCaches",
      dirs: [
        `${home}/.npm/_cacache`,
        `${home}/Library/Caches/Homebrew`,
        `${home}/.gradle/caches`,
        `${home}/.cache`,
      ],
      defaultSelected: false,
    },
  ];
}

function matchesSkip(name: string, patterns: string[] = []): boolean {
  const lower = name.toLowerCase();
  return patterns.some((p) =>
    p.endsWith("*")
      ? lower.startsWith(p.slice(0, -1).toLowerCase())
      : lower === p.toLowerCase(),
  );
}

async function scanCategory(spec: CategorySpec): Promise<SystemJunkResult> {
  const entries: string[] = [];
  let accessDenied = false;
  const cutoff = spec.minAgeDays ? Date.now() - spec.minAgeDays * DAY_MS : 0;

  for (const dir of spec.dirs) {
    let names: string[];
    try {
      names = await fs.promises.readdir(dir);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "EPERM" || code === "EACCES") accessDenied = true;
      continue;
    }

    for (const name of names) {
      if (name === ".DS_Store" || name === ".localized") continue;
      if (matchesSkip(name, spec.skip)) continue;
      const full = path.join(dir, name);
      if (cutoff) {
        try {
          const st = await fs.promises.lstat(full);
          if (st.mtimeMs > cutoff) continue;
        } catch {
          continue;
        }
      }
      entries.push(full);
    }
  }

  const files: JunkItem[] = (
    await mapLimit(entries, 8, async (full) => ({
      path: full,
      name: path.basename(full),
      size: await diskSize(full),
    }))
  ).filter((item) => item.size > 0);

  files.sort((a, b) => b.size - a.size);

  return {
    id: spec.id,
    files,
    totalSize: files.reduce((sum, f) => sum + f.size, 0),
    defaultSelected: spec.defaultSelected,
    accessDenied: accessDenied && files.length === 0 ? true : undefined,
  };
}

export async function scanSystemJunk(
  options: {
    onProgress?: (progress: ScanProgress) => void;
    ownCacheNames?: string[];
  } = {},
): Promise<SystemJunkResult[]> {
  const specs = categorySpecs(options.ownCacheNames ?? []);
  const results: SystemJunkResult[] = [];

  for (let i = 0; i < specs.length; i++) {
    options.onProgress?.({
      progress: Math.round((i / specs.length) * 100),
      categoryId: specs[i].id,
    });
    const result = await scanCategory(specs[i]);
    if (result.files.length > 0 || result.accessDenied) results.push(result);
  }

  options.onProgress?.({ progress: 100 });
  results.sort((a, b) => b.totalSize - a.totalSize);
  return results;
}
