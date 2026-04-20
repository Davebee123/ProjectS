import { promises as fs } from "node:fs";
import path from "node:path";
import type { ValidationIssue } from "../../shared/content/validation.js";
import { validateBundle } from "../../shared/content/validation.js";
import type {
  ContentProjectConfig,
  LoadedContentSource,
  LoadedEntity,
  LoadedWorldSource,
  WorldSource,
} from "../../shared/content/source.js";
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
  WorldTemplate,
} from "../../shared/content/types.js";
import {
  pathExists,
  readJsonFile,
  relativeRepoPath,
  sortById,
  sortRooms,
  walkJsonFiles,
} from "./utils.js";

async function loadEntityDir<T>(repoRoot: string, dirPath: string): Promise<LoadedEntity<T>[]> {
  const files = await walkJsonFiles(dirPath);
  return Promise.all(
    files.map(async (filePath) => ({
      value: await readJsonFile<T>(filePath),
      sourcePath: relativeRepoPath(repoRoot, filePath),
    }))
  );
}

async function loadWorlds(repoRoot: string, worldsRoot: string): Promise<LoadedWorldSource[]> {
  if (!(await pathExists(worldsRoot))) {
    return [];
  }

  const entries = await fs.readdir(worldsRoot, { withFileTypes: true });
  const worlds: LoadedWorldSource[] = [];

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) {
      continue;
    }

    const directoryPath = path.join(worldsRoot, entry.name);
    const worldFilePath = path.join(directoryPath, "world.json");
    if (!(await pathExists(worldFilePath))) {
      continue;
    }

    const world = await readJsonFile<WorldSource>(worldFilePath);
    const roomFiles = await loadEntityDir<RoomTemplate>(repoRoot, path.join(directoryPath, "rooms"));
    worlds.push({
      world: {
        value: world,
        sourcePath: relativeRepoPath(repoRoot, worldFilePath),
      },
      rooms: roomFiles,
      directoryPath: relativeRepoPath(repoRoot, directoryPath),
    });
  }

  return worlds;
}

export async function loadContentSource(repoRoot: string = process.cwd()): Promise<LoadedContentSource> {
  const contentRoot = path.join(repoRoot, "content");
  const projectFilePath = path.join(contentRoot, "project.json");

  return {
    project: {
      value: await readJsonFile<ContentProjectConfig>(projectFilePath),
      sourcePath: relativeRepoPath(repoRoot, projectFilePath),
    },
    activityTags: await loadEntityDir<ActivityTagDef>(repoRoot, path.join(contentRoot, "tags", "activity")),
    abilityTags: await loadEntityDir<AbilityTagDef>(repoRoot, path.join(contentRoot, "tags", "ability")),
    storageKeys: await loadEntityDir<StorageKeyDef>(repoRoot, path.join(contentRoot, "storage-keys")),
    statusEffects: await loadEntityDir<StatusEffectTemplate>(repoRoot, path.join(contentRoot, "status-effects")),
    items: await loadEntityDir<ItemTemplate>(repoRoot, path.join(contentRoot, "items")),
    itemClasses: await loadEntityDir<ItemClassDef>(repoRoot, path.join(contentRoot, "item-classes")),
    affixTables: await loadEntityDir<AffixTableDef>(repoRoot, path.join(contentRoot, "affix-tables")),
    modifierStats: await loadEntityDir<ModifierStatDef>(repoRoot, path.join(contentRoot, "modifier-stats")),
    itemBases: await loadEntityDir<ItemBase>(repoRoot, path.join(contentRoot, "item-bases")),
    affixes: await loadEntityDir<AffixDefinition>(repoRoot, path.join(contentRoot, "affixes")),
    itemQualityRules: await loadEntityDir<ItemQualityRuleSet>(repoRoot, path.join(contentRoot, "item-quality-rules")),
    uniqueItems: await loadEntityDir<UniqueItem>(repoRoot, path.join(contentRoot, "unique-items")),
    itemSets: await loadEntityDir<ItemSetDefinition>(repoRoot, path.join(contentRoot, "item-sets")),
    skills: await loadEntityDir<SkillTemplate>(repoRoot, path.join(contentRoot, "skills")),
    combos: await loadEntityDir<ComboRuleTemplate>(repoRoot, path.join(contentRoot, "combos")),
    interactables: await loadEntityDir<InteractableTemplate>(repoRoot, path.join(contentRoot, "interactables")),
    dialogues: await loadEntityDir<DialogueTemplate>(repoRoot, path.join(contentRoot, "dialogues")),
    cutscenes: await loadEntityDir<CutsceneTemplate>(repoRoot, path.join(contentRoot, "cutscenes")),
    quests: await loadEntityDir<QuestTemplate>(repoRoot, path.join(contentRoot, "quests")),
    recipes: await loadEntityDir<RecipeTemplate>(repoRoot, path.join(contentRoot, "recipes")),
    weathers: await loadEntityDir<WeatherTemplate>(repoRoot, path.join(contentRoot, "weathers")),
    worlds: await loadWorlds(repoRoot, path.join(contentRoot, "worlds")),
  };
}

function withoutFolder<T extends { folder?: string }>(value: T): Omit<T, "folder"> {
  const { folder: _folder, ...rest } = value;
  return rest;
}

function deriveFolder(sourcePath: string, basePrefix: string): string | undefined {
  const normalizedPrefix = `${basePrefix.split(path.sep).join("/")}/`;
  if (!sourcePath.startsWith(normalizedPrefix)) {
    return undefined;
  }
  const relativePath = sourcePath.slice(normalizedPrefix.length);
  const folder = path.posix.dirname(relativePath);
  return folder === "." ? undefined : folder;
}

function withDerivedFolder<T extends { folder?: string }>(
  entity: LoadedEntity<T>,
  basePrefix: string
): T {
  const folder = deriveFolder(entity.sourcePath, basePrefix);
  if (!folder) {
    return withoutFolder(entity.value) as T;
  }
  return {
    ...withoutFolder(entity.value),
    folder,
  } as T;
}

function getPrimaryWorld(source: LoadedContentSource): LoadedWorldSource | undefined {
  return source.worlds.find((world) => world.world.value.id === source.project.value.primaryWorldId);
}

export function validateContentSource(source: LoadedContentSource): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (source.project.value.schemaVersion !== 1) {
    issues.push({
      severity: "warning",
      message: `Unsupported schemaVersion ${source.project.value.schemaVersion} in ${source.project.sourcePath}`,
    });
  }

  const checkFileName = (entity: LoadedEntity<{ id: string }>, label: string): void => {
    const expected = `${entity.value.id}.json`;
    const actual = path.posix.basename(entity.sourcePath);
    if (actual !== expected) {
      issues.push({
        severity: "error",
        message: `${label} "${entity.value.id}" should be stored as "${expected}" but is "${actual}"`,
      });
    }
  };

  for (const entity of source.activityTags) checkFileName(entity, "Activity tag");
  for (const entity of source.abilityTags) checkFileName(entity, "Ability tag");
  for (const entity of source.storageKeys) checkFileName(entity, "Storage key");
  for (const entity of source.statusEffects) checkFileName(entity, "Status effect");
  for (const entity of source.items) checkFileName(entity, "Item");
  for (const entity of source.itemClasses) checkFileName(entity, "Item class");
  for (const entity of source.affixTables) checkFileName(entity, "Affix table");
  for (const entity of source.modifierStats) checkFileName(entity, "Modifier stat");
  for (const entity of source.itemBases) checkFileName(entity, "Item base");
  for (const entity of source.affixes) checkFileName(entity, "Affix");
  for (const entity of source.itemQualityRules) checkFileName(entity, "Item quality rule set");
  for (const entity of source.uniqueItems) checkFileName(entity, "Unique item");
  for (const entity of source.itemSets) checkFileName(entity, "Item set");
  for (const entity of source.skills) checkFileName(entity, "Skill");
  for (const entity of source.combos) checkFileName(entity, "Combo");
  for (const entity of source.interactables) checkFileName(entity, "Interactable");
  for (const entity of source.dialogues) checkFileName(entity, "Dialogue");
  for (const entity of source.cutscenes) checkFileName(entity, "Cutscene");
  for (const entity of source.quests) checkFileName(entity, "Quest");
  for (const entity of source.recipes) checkFileName(entity, "Recipe");
  for (const entity of source.weathers) checkFileName(entity, "Weather");
  for (const world of source.worlds) {
    if (path.posix.basename(world.world.sourcePath) !== "world.json") {
      issues.push({
        severity: "error",
        message: `World "${world.world.value.id}" should be stored as "world.json" inside content/worlds/${world.world.value.id}/`,
      });
    }
    if (path.posix.basename(world.directoryPath) !== world.world.value.id) {
      issues.push({
        severity: "error",
        message: `World "${world.world.value.id}" should live in content/worlds/${world.world.value.id}/`,
      });
    }
    for (const room of world.rooms) {
      checkFileName(room, "Room");
    }
  }

  const primaryWorld = getPrimaryWorld(source);
  if (!primaryWorld) {
    issues.push({
      severity: "error",
      message: `Primary world "${source.project.value.primaryWorldId}" was not found under content/worlds/`,
    });
  }

  if (source.worlds.length > 1) {
    issues.push({
      severity: "warning",
      message: "Multiple worlds exist in content/, but the generated runtime bundle only includes the configured primary world",
    });
  }

  return issues;
}

export function buildBundleFromSource(source: LoadedContentSource, exportedAt: string = new Date().toISOString()): GameContentBundle {
  const primaryWorld = getPrimaryWorld(source);
  if (!primaryWorld) {
    throw new Error(`Primary world "${source.project.value.primaryWorldId}" not found`);
  }

  const world: WorldTemplate = {
    ...primaryWorld.world.value,
    rooms: primaryWorld.rooms.map((room) => room.value).sort(sortRooms),
  };

  return {
    version: source.project.value.bundleVersion,
    exportedAt,
    tags: {
      activityTags: source.activityTags.map((tag) => tag.value).sort(sortById),
      abilityTags: source.abilityTags.map((tag) => tag.value).sort(sortById),
    },
    storageKeys: source.storageKeys.map((key) => key.value).sort(sortById),
    statusEffects: source.statusEffects
      .map((effect) => withDerivedFolder(effect, "content/status-effects"))
      .sort(sortById),
    items: source.items
      .map((item) => withDerivedFolder(item, "content/items"))
      .sort(sortById),
    itemClasses: source.itemClasses.map((entry) => entry.value).sort(sortById),
    affixTables: source.affixTables.map((entry) => entry.value).sort(sortById),
    modifierStats: source.modifierStats.map((entry) => entry.value).sort(sortById),
    itemBases: source.itemBases
      .map((entry) => withDerivedFolder(entry, "content/item-bases"))
      .sort(sortById),
    affixes: source.affixes
      .map((entry) => withDerivedFolder(entry, "content/affixes"))
      .sort(sortById),
    itemQualityRules: source.itemQualityRules.map((entry) => entry.value).sort(sortById),
    uniqueItems: source.uniqueItems
      .map((entry) => withDerivedFolder(entry, "content/unique-items"))
      .sort(sortById),
    itemSets: source.itemSets.map((entry) => entry.value).sort(sortById),
    skills: source.skills
      .map((skill) => withDerivedFolder(skill, "content/skills"))
      .sort(sortById),
    combos: source.combos
      .map((combo) => withDerivedFolder(combo, "content/combos"))
      .sort(sortById),
    interactables: source.interactables
      .map((interactable) => withDerivedFolder(interactable, "content/interactables"))
      .sort(sortById),
    dialogues: source.dialogues
      .map((dialogue) => withDerivedFolder(dialogue, "content/dialogues"))
      .sort(sortById),
    cutscenes: source.cutscenes
      .map((cutscene) => withDerivedFolder(cutscene, "content/cutscenes"))
      .sort(sortById),
    quests: source.quests
      .map((quest) => withDerivedFolder(quest, "content/quests"))
      .sort(sortById),
    world,
    recipes: source.recipes
      .map((recipe) => withDerivedFolder(recipe, "content/recipes"))
      .sort(sortById),
    weathers: source.weathers.map((w) => w.value).sort(sortById),
  };
}

export function validateBuiltBundle(source: LoadedContentSource): ValidationIssue[] {
  const sourceIssues = validateContentSource(source);
  try {
    const bundle = buildBundleFromSource(source, "1970-01-01T00:00:00.000Z");
    return [...sourceIssues, ...validateBundle(bundle)];
  } catch (error) {
    return [
      ...sourceIssues,
      {
        severity: "error",
        message: error instanceof Error ? error.message : String(error),
      },
    ];
  }
}
