import { promises as fs } from "node:fs";
import path from "node:path";

export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

export async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function walkJsonFiles(dirPath: string): Promise<string[]> {
  if (!(await pathExists(dirPath))) {
    return [];
  }

  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkJsonFiles(entryPath)));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".json")) {
      files.push(entryPath);
    }
  }

  return files;
}

export function relativeRepoPath(repoRoot: string, filePath: string): string {
  return path.relative(repoRoot, filePath).split(path.sep).join("/");
}

export function sortById<T extends { id: string }>(left: T, right: T): number {
  return left.id.localeCompare(right.id);
}

export function sortRooms<T extends { id: string; gridX: number; gridY: number }>(left: T, right: T): number {
  if (left.gridY !== right.gridY) {
    return left.gridY - right.gridY;
  }
  if (left.gridX !== right.gridX) {
    return left.gridX - right.gridX;
  }
  return left.id.localeCompare(right.id);
}

export function sanitizePathSegment(segment: string): string {
  return segment
    .trim()
    .replace(/[<>:"|?*]/g, "-")
    .replace(/[\\/]+/g, "/");
}
