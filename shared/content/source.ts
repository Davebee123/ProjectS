import type {
  AbilityTagDef,
  ActivityTagDef,
  ComboRuleTemplate,
  InteractableTemplate,
  ItemTemplate,
  RecipeTemplate,
  RoomTemplate,
  SkillTemplate,
  StatusEffectTemplate,
  StorageKeyDef,
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
  skills: LoadedEntity<SkillTemplate>[];
  combos: LoadedEntity<ComboRuleTemplate>[];
  interactables: LoadedEntity<InteractableTemplate>[];
  recipes: LoadedEntity<RecipeTemplate>[];
  worlds: LoadedWorldSource[];
}
