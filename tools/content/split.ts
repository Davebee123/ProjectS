import path from "node:path";
import type { GameContentBundle } from "../../shared/content/types.js";
import { writeContentSourceFromBundle } from "./source-writer.js";
import { readJsonFile } from "./utils.js";

async function main(): Promise<void> {
  const repoRoot = process.cwd();
  const inputPath = process.argv[2]
    ? path.resolve(repoRoot, process.argv[2])
    : path.join(repoRoot, "public", "data", "game-content.json");

  const bundle = await readJsonFile<GameContentBundle>(inputPath);
  await writeContentSourceFromBundle(bundle, repoRoot);

  console.log(`Split ${path.relative(repoRoot, inputPath)} into content/`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
