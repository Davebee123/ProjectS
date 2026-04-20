/**
 * Loads a GameContentBundle JSON file and provides typed access.
 * This is the bridge between authored content and the runtime.
 */

export type {
  GameContentBundle,
  StorageKeyDef,
  StatusEffectTemplate as StatusEffectDef,
  StatusEffectEventType,
  StatusEffectEventHook,
  PlacementEffect as PlacementEffectDef,
  ItemBase as ItemBaseDef,
  ItemClassDef,
  ItemQuality,
  ItemQualityRuleSet as ItemQualityRuleSetDef,
  AffixDefinition as AffixDef,
  AffixTableDef,
  ModifierStatDef,
  ModifierPayload as ModifierPayloadDef,
  UniqueItem as UniqueItemDef,
  ItemSetDefinition as ItemSetDef,
  ItemRequirements as ItemRequirementsDef,
  InventoryCategory,
  ItemTemplate as ItemDef,
  ItemRarity,
  RecipeTemplate as RecipeDef,
  QuestTemplate as QuestDef,
  QuestObjective as QuestObjectiveDef,
  QuestProgress as QuestProgressDef,
  QuestProgressSource as QuestProgressSourceDef,
  QuestCategory,
  ItemEventHook as EventHookDef,
  EventAction as EventActionDef,
  SkillTemplate as SkillDef,
  ComboRuleTemplate as ComboDef,
  CombatSchool,
  CutsceneTemplate as CutsceneDef,
  DialogueTemplate as DialogueDef,
  InteractableTemplate as InteractableDef,
  LootTableEntry as LootEntryDef,
  InteractableAbility as AbilityDef,
  StorageEffect as StorageEffectDef,
  WorldTemplate as WorldDef,
  RoomTemplate as RoomDef,
  SpawnTableEntry as SpawnEntryDef,
  WeatherTemplate as WeatherDef,
} from "../../shared/content/types";

import type {
  GameContentBundle,
  ItemTemplate,
  ItemBase,
  ItemClassDef,
  ItemQualityRuleSet,
  AffixDefinition,
  AffixTableDef,
  ModifierStatDef,
  UniqueItem,
  ItemSetDefinition,
  RecipeTemplate,
  QuestTemplate,
  ComboRuleTemplate,
  CutsceneTemplate,
  SkillTemplate,
  InteractableTemplate,
  DialogueTemplate,
  WeatherTemplate,
  WorldTemplate,
} from "../../shared/content/types";

let bundle: GameContentBundle | null = null;

export function loadBundle(data: GameContentBundle): void {
  bundle = data;
}

export async function loadBundleFromUrl(url: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load bundle: ${response.status}`);
  }
  const data = (await response.json()) as GameContentBundle;
  loadBundle(data);
}

export function getBundle(): GameContentBundle | null {
  return bundle;
}

export function isBundleLoaded(): boolean {
  return bundle !== null;
}

export function getSkillDefs(): SkillTemplate[] {
  return bundle?.skills ?? [];
}

export function getItemDefs(): ItemTemplate[] {
  return bundle?.items ?? [];
}

export function getItemBaseDefs(): ItemBase[] {
  return bundle?.itemBases ?? [];
}

export function getItemClassDefs(): ItemClassDef[] {
  return bundle?.itemClasses ?? [];
}

export function getAffixDefs(): AffixDefinition[] {
  return bundle?.affixes ?? [];
}

export function getAffixTableDefs(): AffixTableDef[] {
  return bundle?.affixTables ?? [];
}

export function getModifierStatDefs(): ModifierStatDef[] {
  return bundle?.modifierStats ?? [];
}

export function getItemQualityRuleSets(): ItemQualityRuleSet[] {
  return bundle?.itemQualityRules ?? [];
}

export function getUniqueItemDefs(): UniqueItem[] {
  return bundle?.uniqueItems ?? [];
}

export function getItemSetDefs(): ItemSetDefinition[] {
  return bundle?.itemSets ?? [];
}

export function getComboDefs(): ComboRuleTemplate[] {
  return bundle?.combos ?? [];
}

export function getInteractableDefs(): InteractableTemplate[] {
  return bundle?.interactables ?? [];
}

export function getDialogueDefs(): DialogueTemplate[] {
  return bundle?.dialogues ?? [];
}

export function getCutsceneDefs(): CutsceneTemplate[] {
  return bundle?.cutscenes ?? [];
}

export function getWorld(): WorldTemplate | null {
  return bundle?.world ?? null;
}

export function getItemDef(id: string): ItemTemplate | undefined {
  return bundle?.items.find((item) => item.id === id);
}

export function getItemBaseDef(id: string): ItemBase | undefined {
  return bundle?.itemBases.find((itemBase) => itemBase.id === id);
}

export function getSkillDef(id: string): SkillTemplate | undefined {
  return bundle?.skills.find((skill) => skill.id === id);
}

export function getInteractableDef(id: string): InteractableTemplate | undefined {
  return bundle?.interactables.find((interactable) => interactable.id === id);
}

export function getDialogueDef(id: string): DialogueTemplate | undefined {
  return bundle?.dialogues.find((dialogue) => dialogue.id === id);
}

export function getCutsceneDef(id: string): CutsceneTemplate | undefined {
  return bundle?.cutscenes.find((cutscene) => cutscene.id === id);
}

export function getRecipeDefs(): RecipeTemplate[] {
  return bundle?.recipes ?? [];
}

export function getRecipeDef(id: string): RecipeTemplate | undefined {
  return bundle?.recipes.find((recipe) => recipe.id === id);
}

export function getQuestDefs(): QuestTemplate[] {
  return bundle?.quests ?? [];
}

export function getWeatherDefs(): WeatherTemplate[] {
  return bundle?.weathers ?? [];
}

export function getWeatherDef(id: string): WeatherTemplate | undefined {
  return bundle?.weathers?.find((w) => w.id === id);
}
