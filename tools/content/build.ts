import path from "node:path";
import { writeChangelogData } from "./changelog.js";
import { buildBundleFromSource, loadContentSource, validateBuiltBundle } from "./pipeline.js";
import { writeJsonFile } from "./utils.js";

async function main(): Promise<void> {
  const repoRoot = process.cwd();
  const source = await loadContentSource(repoRoot);
  const issues = validateBuiltBundle(source);
  const errors = issues.filter((issue) => issue.severity === "error");

  for (const issue of issues) {
    const prefix = issue.severity === "error" ? "ERROR" : "WARN";
    console.error(`[${prefix}] ${issue.message}`);
  }

  if (errors.length > 0) {
    process.exitCode = 1;
    return;
  }

  const bundle = buildBundleFromSource(source);
  const outputPath = path.join(repoRoot, "public", "data", "game-content.json");
  await writeJsonFile(outputPath, bundle);
  const changelog = await writeChangelogData(repoRoot);
  console.log(`Wrote ${path.relative(repoRoot, outputPath)}`);
  console.log(`Wrote public/data/changelog.json (${changelog.releases.length} release entries)`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
