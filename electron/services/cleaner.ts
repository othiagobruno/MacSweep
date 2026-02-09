import * as fs from "fs";
import * as path from "path";

interface CleanResult {
  success: boolean;
  freedSpace: number;
  errors: string[];
}

export async function cleanFiles(filePaths: string[]): Promise<CleanResult> {
  let freedSpace = 0;
  const errors: string[] = [];

  for (const filePath of filePaths) {
    try {
      if (!fs.existsSync(filePath)) continue;

      const stats = fs.statSync(filePath);

      if (stats.isDirectory()) {
        const size = await getDirSize(filePath);
        fs.rmSync(filePath, { recursive: true, force: true });
        freedSpace += size;
      } else {
        freedSpace += stats.size;
        fs.unlinkSync(filePath);
      }
    } catch (err: any) {
      errors.push(`Failed to delete ${filePath}: ${err.message}`);
    }
  }

  return {
    success: errors.length === 0,
    freedSpace,
    errors,
  };
}

async function getDirSize(dirPath: string): Promise<number> {
  let size = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isFile()) {
        size += fs.statSync(fullPath).size;
      } else if (entry.isDirectory()) {
        size += await getDirSize(fullPath);
      }
    }
  } catch {
    // Skip inaccessible directories
  }
  return size;
}
