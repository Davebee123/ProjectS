import { buildChangelogData } from "./changelog.js";
import { loadContentSource, validateBuiltBundle } from "./pipeline.js";

async function main(): Promise<void> {
  const source = await loadContentSource(process.cwd());
  const issues = validateBuiltBundle(source);
  const errors = issues.filter((issue) => issue.severity === "error");

  for (const issue of issues) {
    const prefix = issue.severity === "error" ? "ERROR" : "WARN";
    console.error(`[${prefix}] ${issue.message}`);
  }

  if (issues.length === 0) {
    console.log("Content validation passed");
  }

  if (errors.length > 0) {
    process.exitCode = 1;
    return;
  }

  await buildChangelogData(process.cwd());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
