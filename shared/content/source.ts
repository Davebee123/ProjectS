import type {
  AbilityTagDef,
  AffixDefinition,
  AffixTableDef,
  ActivityTagDef,
  ComboRuleTemplate,
  CutsceneTemplate,
  DialogueTemplate,
  ItemBase,
  ItemClassDef,
  ItemQualityRuleSet,
  ItemSetDefinition,
  InteractableTemplate,
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
} from "./types.js";

export interface ContentProjectConfig {
  schemaVersion: number;
  bundleVersion: string;
  primaryWorldId: string;
}

export interface WorldSource {
  id: string;
  name: string;
  gridWidth: number;
  gridHeight: number;
  startingRoomId: string;
  defaultSlotCount: number;
  startingItemIds: string[];
  startingEquipmentBaseIds?: string[];
}

export interface LoadedEntity<T> {
  value: T;
  sourcePath: string;
}

export interface LoadedWorldSource {
  world: LoadedEntity<WorldSource>;
  rooms: LoadedEntity<RoomTemplate>[];
  directoryPath: string;
}

export interface LoadedContentSource {
  project: LoadedEntity<ContentProjectConfig>;
  activityTags: LoadedEntity<ActivityTagDef>[];
  abilityTags: LoadedEntity<AbilityTagDef>[];
  storageKeys: LoadedEntity<StorageKeyDef>[];
  statusEffects: LoadedEntity<StatusEffectTemplate>[];
  items: LoadedEntity<ItemTemplate>[];
  itemClasses: LoadedEntity<ItemClassDef>[];
  affixTables: LoadedEntity<AffixTableDef>[];
  modifierStats: LoadedEntity<ModifierStatDef>[];
  itemBases: LoadedEntity<ItemBase>[];
  affixes: LoadedEntity<AffixDefinition>[];
  itemQualityRules: LoadedEntity<ItemQualityRuleSet>[];
  uniqueItems: LoadedEntity<UniqueItem>[];
  itemSets: LoadedEntity<ItemSetDefinition>[];
  skills: LoadedEntity<SkillTemplate>[];
  combos: LoadedEntity<ComboRuleTemplate>[];
  interactables: LoadedEntity<InteractableTemplate>[];
  dialogues: LoadedEntity<DialogueTemplate>[];
  cutscenes: LoadedEntity<CutsceneTemplate>[];
  quests: LoadedEntity<QuestTemplate>[];
  recipes: LoadedEntity<RecipeTemplate>[];
  weathers: LoadedEntity<WeatherTemplate>[];
  worlds: LoadedWorldSource[];
}
