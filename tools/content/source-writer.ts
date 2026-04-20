import path from "node:path";
import { promises as fs } from "node:fs";
import type { LoadedContentSource, LoadedEntity, LoadedWorldSource } from "../../shared/content/source.js";
import type {
  AbilityTagDef,
  AffixDefinition,
  AffixTableDef,
  ActivityTagDef,
  ComboRuleTemplate,
  CutsceneTemplate,
  DialogueTemplate,
  GameContentBundle,
  InteractableTemplate,
  ItemBase,
  ItemClassDef,
  ItemQualityRuleSet,
  ItemSetDefinition,
  ItemTemplate,
  ModifierStatDef,
  QuestTemplate,
  RecipeTemplate,
  RoomTemplate,
  SkillTemplate,
  StatusEffectTemplate,
  StorageKeyDef,
  UniqueItem,
  WeatherTemplate,
} from "../../shared/content/types.js";
import { buildBundleFromSource, loadContentSource } from "./pipeline.js";
import { pathExists, sanitizePathSegment, writeJsonFile } from "./utils.js";

function categoryPath(folder: string | undefined, fallback: string): string {
  const raw = folder?.trim() || fallback;
  return sanitizePathSegment(raw);
}

function withoutFolder<T extends { folder?: string }>(value: T): Omit<T, "folder"> {
  const { folder: _folder, ...rest } = value;
  return rest;
}

function itemFallback(item: ItemTemplate): string {
  return item.slot ? "equipment" : "resources";
}

function getPrimaryWorld(source: LoadedContentSource): LoadedWorldSource | undefined {
  return source.worlds.find((world) => world.world.value.id === source.project.value.primaryWorldId);
}

function toAbsolutePath(repoRoot: string, relativePath: string): string {
  return path.resolve(repoRoot, relativePath);
}

async function removeEmptyAncestors(startDir: string, stopDir: string): Promise<void> {
  let currentDir = startDir;
  const stop = path.resolve(stopDir);

  while (currentDir.startsWith(stop) && currentDir !== stop) {
    const entries = await fs.readdir(currentDir);
    if (entries.length > 0) {
      return;
    }
    await fs.rmdir(currentDir);
    currentDir = path.dirname(currentDir);
  }
}

async function removeManagedFile(filePath: string, stopDir: string): Promise<void> {
  await fs.rm(filePath, { force: true });
  await removeEmptyAncestors(path.dirname(filePath), stopDir);
}

function entityTargetPath<T extends { id: string; folder?: string }>(
  repoRoot: string,
  baseDir: string,
  entity: T,
  fallback: string
): string {
  const folder = categoryPath(entity.folder, fallback);
  return path.join(repoRoot, baseDir, folder, `${entity.id}.json`);
}

async function syncSimpleEntities<T extends { id: string }>(params: {
  repoRoot: string;
  baseDir: string;
  desired: T[];
  existing: LoadedEntity<T>[];
}): Promise<void> {
  const { repoRoot, baseDir, desired, existing } = params;
  const baseAbs = path.join(repoRoot, baseDir);
  const existingPathsById = new Map(existing.map((entity) => [entity.value.id, toAbsolutePath(repoRoot, entity.sourcePath)]));
  const desiredIds = new Set<string>();

  for (const entity of desired) {
    desiredIds.add(entity.id);
    const targetPath = path.join(baseAbs, `${entity.id}.json`);
    const oldPath = existingPathsById.get(entity.id);
    if (oldPath && path.normalize(oldPath) !== path.normalize(targetPath)) {
      await removeManagedFile(oldPath, baseAbs);
    }
    await writeJsonFile(targetPath, entity);
  }

  for (const entity of existing) {
    if (desiredIds.has(entity.value.id)) {
      continue;
    }
    await removeManagedFile(toAbsolutePath(repoRoot, entity.sourcePath), baseAbs);
  }
}

async function syncFolderedEntities<T extends { id: string; folder?: string }>(params: {
  repoRoot: string;
  baseDir: string;
  desired: T[];
  existing: LoadedEntity<T>[];
  fallbackFor: (entity: T) => string;
}): Promise<void> {
  const { repoRoot, baseDir, desired, existing, fallbackFor } = params;
  const baseAbs = path.join(repoRoot, baseDir);
  const existingPathsById = new Map(existing.map((entity) => [entity.value.id, toAbsolutePath(repoRoot, entity.sourcePath)]));
  const desiredIds = new Set<string>();

  for (const entity of desired) {
    desiredIds.add(entity.id);
    const targetPath = entityTargetPath(repoRoot, baseDir, entity, fallbackFor(entity));
    const oldPath = existingPathsById.get(entity.id);
    if (oldPath && path.normalize(oldPath) !== path.normalize(targetPath)) {
      await removeManagedFile(oldPath, baseAbs);
    }
    await writeJsonFile(targetPath, withoutFolder(entity));
  }

  for (const entity of existing) {
    if (desiredIds.has(entity.value.id)) {
      continue;
    }
    await removeManagedFile(toAbsolutePath(repoRoot, entity.sourcePath), baseAbs);
  }
}

async function syncWorld(repoRoot: string, bundle: GameContentBundle, existingSource?: LoadedContentSource): Promise<void> {
  const worldsRoot = path.join(repoRoot, "content", "worlds");
  const desiredWorldDir = path.join(worldsRoot, bundle.world.id);
  const desiredWorldFile = path.join(desiredWorldDir, "world.json");
  const desiredRoomIds = new Set(bundle.world.rooms.map((room) => room.id));

  const existingPrimaryWorld = existingSource ? getPrimaryWorld(existingSource) : undefined;
  const existingDesiredWorld = existingSource?.worlds.find((world) => world.world.value.id === bundle.world.id);

  if (existingPrimaryWorld && existingPrimaryWorld.world.value.id !== bundle.world.id) {
    await removeManagedFile(toAbsolutePath(repoRoot, existingPrimaryWorld.world.sourcePath), path.join(worldsRoot, existingPrimaryWorld.world.value.id));
    for (const room of existingPrimaryWorld.rooms) {
      await removeManagedFile(
        toAbsolutePath(repoRoot, room.sourcePath),
        path.join(worldsRoot, existingPrimaryWorld.world.value.id)
      );
    }
  }

  const { rooms, ...worldMeta } = bundle.world;
  await writeJsonFile(desiredWorldFile, worldMeta);

  const existingRoomPathsById = new Map(
    (existingDesiredWorld?.rooms ?? []).map((room) => [room.value.id, toAbsolutePath(repoRoot, room.sourcePath)])
  );
  const roomsDir = path.join(desiredWorldDir, "rooms");

  for (const room of rooms) {
    const targetPath = path.join(roomsDir, `${room.id}.json`);
    const oldPath = existingRoomPathsById.get(room.id);
    if (oldPath && path.normalize(oldPath) !== path.normalize(targetPath)) {
      await removeManagedFile(oldPath, desiredWorldDir);
    }
    await writeJsonFile(targetPath, room);
  }

  for (const room of existingDesiredWorld?.rooms ?? []) {
    if (desiredRoomIds.has(room.value.id)) {
      continue;
    }
    await removeManagedFile(toAbsolutePath(repoRoot, room.sourcePath), desiredWorldDir);
  }
}

export async function writeContentSourceFromBundle(
  bundle: GameContentBundle,
  repoRoot: string = process.cwd()
): Promise<void> {
  const contentRoot = path.join(repoRoot, "content");
  const projectPath = path.join(contentRoot, "project.json");
  const existingSource = (await pathExists(projectPath)) ? await loadContentSource(repoRoot) : undefined;

  await writeJsonFile(projectPath, {
    schemaVersion: 1,
    bundleVersion: bundle.version,
    primaryWorldId: bundle.world.id,
  });

  await syncSimpleEntities<ActivityTagDef>({
    repoRoot,
    baseDir: path.join("content", "tags", "activity"),
    desired: bundle.tags.activityTags,
    existing: existingSource?.activityTags ?? [],
  });

  await syncSimpleEntities<AbilityTagDef>({
    repoRoot,
    baseDir: path.join("content", "tags", "ability"),
    desired: bundle.tags.abilityTags,
    existing: existingSource?.abilityTags ?? [],
  });

  await syncSimpleEntities<StorageKeyDef>({
    repoRoot,
    baseDir: path.join("content", "storage-keys"),
    desired: bundle.storageKeys,
    existing: existingSource?.storageKeys ?? [],
  });

  await syncSimpleEntities<ItemClassDef>({
    repoRoot,
    baseDir: path.join("content", "item-classes"),
    desired: bundle.itemClasses ?? [],
    existing: existingSource?.itemClasses ?? [],
  });

  await syncSimpleEntities<AffixTableDef>({
    repoRoot,
    baseDir: path.join("content", "affix-tables"),
    desired: bundle.affixTables ?? [],
    existing: existingSource?.affixTables ?? [],
  });

  await syncSimpleEntities<ModifierStatDef>({
    repoRoot,
    baseDir: path.join("content", "modifier-stats"),
    desired: bundle.modifierStats ?? [],
    existing: existingSource?.modifierStats ?? [],
  });

  await syncFolderedEntities<StatusEffectTemplate>({
    repoRoot,
    baseDir: path.join("content", "status-effects"),
    desired: bundle.statusEffects,
    existing: existingSource?.statusEffects ?? [],
    fallbackFor: () => "ungrouped",
  });

  await syncFolderedEntities<ItemTemplate>({
    repoRoot,
    baseDir: path.join("content", "items"),
    desired: bundle.items,
    existing: existingSource?.items ?? [],
    fallbackFor: item => itemFallback(item),
  });

  await syncFolderedEntities<ItemBase>({
    repoRoot,
    baseDir: path.join("content", "item-bases"),
    desired: bundle.itemBases ?? [],
    existing: existingSource?.itemBases ?? [],
    fallbackFor: base => base.inventoryCategory || "ungrouped",
  });

  await syncFolderedEntities<AffixDefinition>({
    repoRoot,
    baseDir: path.join("content", "affixes"),
    desired: bundle.affixes ?? [],
    existing: existingSource?.affixes ?? [],
    fallbackFor: affix => affix.kind,
  });

  await syncSimpleEntities<ItemQualityRuleSet>({
    repoRoot,
    baseDir: path.join("content", "item-quality-rules"),
    desired: bundle.itemQualityRules ?? [],
    existing: existingSource?.itemQualityRules ?? [],
  });

  await syncFolderedEntities<UniqueItem>({
    repoRoot,
    baseDir: path.join("content", "unique-items"),
    desired: bundle.uniqueItems ?? [],
    existing: existingSource?.uniqueItems ?? [],
    fallbackFor: uniqueItem => uniqueItem.folder || "ungrouped",
  });

  await syncSimpleEntities<ItemSetDefinition>({
    repoRoot,
    baseDir: path.join("content", "item-sets"),
    desired: bundle.itemSets ?? [],
    existing: existingSource?.itemSets ?? [],
  });

  await syncFolderedEntities<SkillTemplate>({
    repoRoot,
    baseDir: path.join("content", "skills"),
    desired: bundle.skills,
    existing: existingSource?.skills ?? [],
    fallbackFor: skill => skill.kind,
  });

  await syncFolderedEntities<ComboRuleTemplate>({
    repoRoot,
    baseDir: path.join("content", "combos"),
    desired: bundle.combos,
    existing: existingSource?.combos ?? [],
    fallbackFor: combo => combo.activityTag || "ungrouped",
  });

  await syncFolderedEntities<InteractableTemplate>({
    repoRoot,
    baseDir: path.join("content", "interactables"),
    desired: bundle.interactables,
    existing: existingSource?.interactables ?? [],
    fallbackFor: interactable => interactable.activityTag || "ungrouped",
  });

  await syncFolderedEntities<DialogueTemplate>({
    repoRoot,
    baseDir: path.join("content", "dialogues"),
    desired: bundle.dialogues ?? [],
    existing: existingSource?.dialogues ?? [],
    fallbackFor: dialogue => dialogue.folder || "ungrouped",
  });

  await syncFolderedEntities<CutsceneTemplate>({
    repoRoot,
    baseDir: path.join("content", "cutscenes"),
    desired: bundle.cutscenes ?? [],
    existing: existingSource?.cutscenes ?? [],
    fallbackFor: cutscene => cutscene.folder || "ungrouped",
  });

  await syncFolderedEntities<QuestTemplate>({
    repoRoot,
    baseDir: path.join("content", "quests"),
    desired: bundle.quests ?? [],
    existing: existingSource?.quests ?? [],
    fallbackFor: quest => quest.category || "ungrouped",
  });

  await syncFolderedEntities<RecipeTemplate>({
    repoRoot,
    baseDir: path.join("content", "recipes"),
    desired: bundle.recipes,
    existing: existingSource?.recipes ?? [],
    fallbackFor: recipe => recipe.stationTag || "ungrouped",
  });

  await syncSimpleEntities<WeatherTemplate>({
    repoRoot,
    baseDir: path.join("content", "weathers"),
    desired: bundle.weathers ?? [],
    existing: existingSource?.weathers ?? [],
  });

  await syncWorld(repoRoot, bundle, existingSource);
}

export async function writeRuntimeBundleFromSource(repoRoot: string = process.cwd()): Promise<GameContentBundle> {
  const source = await loadContentSource(repoRoot);
  const bundle = buildBundleFromSource(source);
  await writeJsonFile(path.join(repoRoot, "public", "data", "game-content.json"), bundle);
  return bundle;
}
