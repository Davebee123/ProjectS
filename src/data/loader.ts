/**
 * Loads a GameContentBundle JSON file and provides typed access.
 * This is the bridge between authored content and the runtime.
 */

export type {
  GameContentBundle,
  StorageKeyDef,
  StatusEffectTemplate as StatusEffectDef,
  PlacementEffect as PlacementEffectDef,
  ItemTemplate as ItemDef,
  RecipeTemplate as RecipeDef,
  ItemEventHook as EventHookDef,
  EventAction as EventActionDef,
  SkillTemplate as SkillDef,
  ComboRuleTemplate as ComboDef,
  InteractableTemplate as InteractableDef,
  LootTableEntry as LootEntryDef,
  InteractableAbility as AbilityDef,
  StorageEffect as StorageEffectDef,
  WorldTemplate as WorldDef,
  RoomTemplate as RoomDef,
  SpawnTableEntry as SpawnEntryDef,
} from "../../shared/content/types";

import type {
  GameContentBundle,
  ItemTemplate,
  RecipeTemplate,
  ComboRuleTemplate,
  SkillTemplate,
  InteractableTemplate,
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

export function getComboDefs(): ComboRuleTemplate[] {
  return bundle?.combos ?? [];
}

export function getInteractableDefs(): InteractableTemplate[] {
  return bundle?.interactables ?? [];
}

export function getWorld(): WorldTemplate | null {
  return bundle?.world ?? null;
}

export function getItemDef(id: string): ItemTemplate | undefined {
  return bundle?.items.find((item) => item.id === id);
}

export function getSkillDef(id: string): SkillTemplate | undefined {
  return bundle?.skills.find((skill) => skill.id === id);
}

export function getInteractableDef(id: string): InteractableTemplate | undefined {
  return bundle?.interactables.find((interactable) => interactable.id === id);
}

export function getRecipeDefs(): RecipeTemplate[] {
  return bundle?.recipes ?? [];
}

export function getRecipeDef(id: string): RecipeTemplate | undefined {
  return bundle?.recipes.find((recipe) => recipe.id === id);
}
