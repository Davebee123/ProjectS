import path from "node:path";
import { buildBundleFromSource, loadContentSource } from "./pipeline.js";
import { writeJsonFile } from "./utils.js";

async function main(): Promise<void> {
  const repoRoot = process.cwd();
  const version = process.argv[2];

  if (!version) {
    throw new Error("Usage: npm run changelog:snapshot -- <version>");
  }

  const source = await loadContentSource(repoRoot);
  const bundle = buildBundleFromSource(source);
  const outputPath = path.join(repoRoot, "changelog", "snapshots", `${version}.json`);
  await writeJsonFile(outputPath, bundle);
  console.log(`Wrote ${path.relative(repoRoot, outputPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
