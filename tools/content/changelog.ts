import path from "node:path";
import type { ChangelogConfig, ChangelogData, ChangelogEntry, ChangelogRelease, ChangelogReleaseSpec } from "../../shared/content/changelog.js";
import type { GameContentBundle, InteractableTemplate, ItemTemplate, RoomTemplate, SkillTemplate } from "../../shared/content/types.js";
import { buildBundleFromSource, loadContentSource } from "./pipeline.js";
import { pathExists, readJsonFile, sortById, writeJsonFile, walkJsonFiles } from "./utils.js";

function stringifyComparable<T>(value: T): string {
  return JSON.stringify(value);
}

function loadMap<T extends { id: string }>(list: T[]): Map<string, T> {
  return new Map(list.map((value) => [value.id, value]));
}

function diffNamedEntities<T extends { id: string; name: string }>(
  beforeList: T[],
  afterList: T[],
  onAdd: (entity: T) => string,
  onRemove: (entity: T) => string,
  onChange: (before: T, after: T) => string | null
): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  const before = loadMap(beforeList);
  const after = loadMap(afterList);

  for (const entity of [...after.values()].sort(sortById)) {
    const previous = before.get(entity.id);
    if (!previous) {
      entries.push({ category: "new", text: onAdd(entity), source: "auto" });
      continue;
    }
    const changed = onChange(previous, entity);
    if (changed) {
      entries.push({ category: "changes", text: changed, source: "auto" });
    }
  }

  for (const entity of [...before.values()].sort(sortById)) {
    if (after.has(entity.id)) {
      continue;
    }
    entries.push({ category: "changes", text: onRemove(entity), source: "auto" });
  }

  return entries;
}

function diffSkills(before: SkillTemplate[], after: SkillTemplate[]): ChangelogEntry[] {
  return diffNamedEntities(
    before,
    after,
    (skill) => skill.kind === "active" ? `Added ability: ${skill.name}.` : `Added passive skill: ${skill.name}.`,
    (skill) => `Removed ${skill.kind === "active" ? "ability" : "passive skill"}: ${skill.name}.`,
    (prev, next) => {
      if (
        prev.unlockCondition !== next.unlockCondition &&
        prev.baseDurationMs === next.baseDurationMs &&
        prev.baseEnergyCost === next.baseEnergyCost &&
        prev.basePower === next.basePower &&
        prev.powerPerLevel === next.powerPerLevel
      ) {
        return `Adjusted unlock requirements for ${next.name}.`;
      }
      if (
        prev.baseDurationMs !== next.baseDurationMs ||
        prev.baseEnergyCost !== next.baseEnergyCost ||
        prev.basePower !== next.basePower ||
        prev.powerPerLevel !== next.powerPerLevel
      ) {
        return `Rebalanced ${next.name}.`;
      }
      if (stringifyComparable(prev) !== stringifyComparable(next)) {
        return `Updated ${next.name}.`;
      }
      return null;
    }
  );
}

function diffInteractables(before: InteractableTemplate[], after: InteractableTemplate[]): ChangelogEntry[] {
  return diffNamedEntities(
    before,
    after,
    (interactable) => `Added interactable: ${interactable.name}.`,
    (interactable) => `Removed interactable: ${interactable.name}.`,
    (prev, next) => {
      if (
        prev.requiredLevel !== next.requiredLevel ||
        stringifyComparable(prev.effectiveHealth) !== stringifyComparable(next.effectiveHealth) ||
        stringifyComparable(prev.lootTable) !== stringifyComparable(next.lootTable) ||
        stringifyComparable(prev.xpRewards) !== stringifyComparable(next.xpRewards)
      ) {
        return `Adjusted ${next.name}.`;
      }
      if (stringifyComparable(prev) !== stringifyComparable(next)) {
        return `Updated ${next.name}.`;
      }
      return null;
    }
  );
}

function diffItems(before: ItemTemplate[], after: ItemTemplate[]): ChangelogEntry[] {
  return diffNamedEntities(
    before,
    after,
    (item) => `Added item: ${item.name}.`,
    (item) => `Removed item: ${item.name}.`,
    (prev, next) => {
      if (
        stringifyComparable(prev.stats) !== stringifyComparable(next.stats) ||
        prev.slot !== next.slot
      ) {
        return `Adjusted ${next.name}.`;
      }
      if (stringifyComparable(prev) !== stringifyComparable(next)) {
        return `Updated ${next.name}.`;
      }
      return null;
    }
  );
}

function diffRooms(before: RoomTemplate[], after: RoomTemplate[]): ChangelogEntry[] {
  return diffNamedEntities(
    before,
    after,
    (room) => `Added location: ${room.name}.`,
    (room) => `Removed location: ${room.name}.`,
    (prev, next) => {
      if (
        stringifyComparable(prev.spawnTable) !== stringifyComparable(next.spawnTable) ||
        stringifyComparable(prev.fixedInteractables) !== stringifyComparable(next.fixedInteractables) ||
        stringifyComparable(prev.specialConnections) !== stringifyComparable(next.specialConnections)
      ) {
        return `Updated ${next.name}.`;
      }
      if (stringifyComparable(prev) !== stringifyComparable(next)) {
        return `Adjusted ${next.name}.`;
      }
      return null;
    }
  );
}

function autoEntriesFromDiff(before: GameContentBundle, after: GameContentBundle): ChangelogEntry[] {
  return [
    ...diffSkills(before.skills, after.skills),
    ...diffInteractables(before.interactables, after.interactables),
    ...diffItems(before.items, after.items),
    ...diffRooms(before.world.rooms, after.world.rooms),
  ];
}

async function loadManualFragments(repoRoot: string, version: string): Promise<ChangelogEntry[]> {
  const dirPath = path.join(repoRoot, "changelog", "fragments", version);
  if (!(await pathExists(dirPath))) {
    return [];
  }
  const files = await walkJsonFiles(dirPath);
  const entries = await Promise.all(files.map((filePath) => readJsonFile<ChangelogEntry>(filePath)));
  return entries;
}

async function loadSnapshot(repoRoot: string, version: string): Promise<GameContentBundle> {
  return readJsonFile<GameContentBundle>(path.join(repoRoot, "changelog", "snapshots", `${version}.json`));
}

export async function loadChangelogConfig(repoRoot: string = process.cwd()): Promise<ChangelogConfig> {
  return readJsonFile<ChangelogConfig>(path.join(repoRoot, "changelog", "config.json"));
}

function resolveCompareToVersion(
  releases: ChangelogReleaseSpec[],
  spec: ChangelogReleaseSpec,
  index: number
): string | null {
  if (typeof spec.compareTo === "string") {
    return spec.compareTo;
  }
  if (spec.compareTo === null) {
    return null;
  }

  if (spec.target === "current") {
    const laterSnapshot = releases.slice(index + 1).find((entry) => entry.target === "snapshot");
    if (laterSnapshot) {
      return laterSnapshot.version;
    }
    const anySnapshot = releases.find((entry) => entry.target === "snapshot");
    return anySnapshot?.version ?? null;
  }

  return null;
}

async function buildRelease(
  repoRoot: string,
  currentBundle: GameContentBundle,
  spec: ChangelogReleaseSpec,
  compareToVersion: string | null
): Promise<ChangelogRelease> {
  const targetBundle = spec.target === "current"
    ? currentBundle
    : await loadSnapshot(repoRoot, spec.version);
  const baselineBundle = compareToVersion ? await loadSnapshot(repoRoot, compareToVersion) : null;
  const autoEntries = baselineBundle ? autoEntriesFromDiff(baselineBundle, targetBundle) : [];
  const manualEntries = await loadManualFragments(repoRoot, spec.version);

  return {
    version: spec.version,
    date: spec.date,
    title: spec.title,
    entries: [...autoEntries, ...manualEntries],
  };
}

export async function buildChangelogData(repoRoot: string = process.cwd()): Promise<ChangelogData> {
  const config = await loadChangelogConfig(repoRoot);
  const source = await loadContentSource(repoRoot);
  const currentBundle = buildBundleFromSource(source);

  const releases = await Promise.all(
    config.releases.map((spec, index) =>
      buildRelease(
        repoRoot,
        currentBundle,
        spec,
        resolveCompareToVersion(config.releases, spec, index)
      )
    )
  );

  return {
    generatedAt: new Date().toISOString(),
    releases: releases.filter((release) => release.entries.length > 0),
  };
}

export async function writeChangelogData(repoRoot: string = process.cwd()): Promise<ChangelogData> {
  const data = await buildChangelogData(repoRoot);
  const outputPath = path.join(repoRoot, "public", "data", "changelog.json");
  await writeJsonFile(outputPath, data);
  return data;
}
