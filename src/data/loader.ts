/**
 * Loads a GameContentBundle JSON file and provides typed access.
 * This is the bridge between the content editor's output and the game runtime.
 */

// Re-use the same types the editor exports
export interface GameContentBundle {
  version: string;
  exportedAt: string;
  tags: {
    activityTags: { id: string; label: string; color: string }[];
    abilityTags: { id: string; label: string }[];
  };
  storageKeys: StorageKeyDef[];
  statusEffects: StatusEffectDef[];
  items: ItemDef[];
  skills: SkillDef[];
  combos: ComboDef[];
  interactables: InteractableDef[];
  world: WorldDef;
  recipes: RecipeDef[];
}

export interface StorageKeyDef {
  id: string;
  label: string;
  type: "flag" | "counter" | "value";
  defaultValue: boolean | number | string;
}

export interface StatusEffectDef {
  id: string;
  name: string;
  description: string;
  removalType: "timed" | "conditional" | "both";
  durationMs?: number;
  removeCondition?: string;
  statModifiers: { stat: string; operation: "add" | "multiply"; value: number }[];
  stackable: boolean;
  maxStacks: number;
  color: string;
}

export interface PlacementEffectDef {
  id: string;
  type: "stat_aura" | "spawn_modifier";
  stat?: string;
  value?: number;
  targetTag?: string;
  spawnChanceMultiplier?: number;
}

export interface ItemDef {
  id: string;
  name: string;
  description: string;
  slot?: "weapon" | "armor" | "accessory";
  stackable: boolean;
  stats: {
    attack?: number;
    defense?: number;
    energyRegen?: number;
    activityPowerMultiplier?: number;
    speedMultiplier?: number;
    energyCostMultiplier?: number;
  };
  eventHooks: EventHookDef[];
  placeable?: boolean;
  placementEffects?: PlacementEffectDef[];
}

export interface RecipeDef {
  id: string;
  name: string;
  stationTag?: string;
  unlockCondition?: string;
  ingredients: { itemId: string; qty: number }[];
  outputItemId: string;
  outputQty: number;
}

export interface EventHookDef {
  id: string;
  event: string;
  condition?: string;
  actions: EventActionDef[];
}

export interface EventActionDef {
  type: string;
  statusEffectId?: string;
  targetSkillId?: string;
  storageKeyId?: string;
  storageOperation?: string;
  value?: number | string | boolean;
  customScript?: string;
}

export interface SkillDef {
  id: string;
  name: string;
  kind: "passive" | "active";
  activityTags: string[];
  abilityTags: string[];
  linkedPassiveId?: string;
  baseDurationMs: number;
  baseEnergyCost: number;
  basePower: number;
  powerPerLevel: number;
  baseXpToNext: number;
  xpScaling: number;
  barColor: string;
  accentColor: string;
  description: string;
  unlockCondition?: string;
  castSound?: string;
  hitSound?: string;
}

export interface ComboDef {
  id: string;
  fromSkillId: string;
  toSkillId: string;
  activityTag: string;
  windowMs: number;
  timeMultiplier: number;
  energyMultiplier: number;
  label: string;
}

export interface InteractableDef {
  id: string;
  name: string;
  description: string;
  activityTag: string;
  allowedAbilityTags: string[];
  requiredLevel: number;
  effectiveHealth: { min: number; max: number };
  barColor: string;
  accentColor: string;
  meterLabel: string;
  lootTable: LootEntryDef[];
  xpRewards: { skillId: string; amount: number }[];
  abilities: AbilityDef[];
  onInteractEffects: StorageEffectDef[];
  onDestroyEffects: StorageEffectDef[];
  spawnCondition?: string;
  sounds?: {
    onHit?: string;
    onDestroy?: string;
    onAbilityCast?: string;
  };
}

export interface LootEntryDef {
  id: string;
  itemId: string;
  quantityMin: number;
  quantityMax: number;
  dropChance: number;
  weight: number;
  condition?: string;
}

export interface AbilityDef {
  name: string;
  castTimeMs: number;
  cooldownMs: number;
  effect: string;
  resistedByPassiveId?: string;
  resistChancePerLevel: number;
}

export interface StorageEffectDef {
  storageKeyId: string;
  operation: "set" | "increment" | "decrement" | "toggle";
  value?: number | string | boolean;
  condition?: string;
}

export interface WorldDef {
  id: string;
  name: string;
  gridWidth: number;
  gridHeight: number;
  rooms: RoomDef[];
  startingRoomId: string;
  defaultSlotCount: number;
  startingItemIds?: string[];
}

export interface RoomDef {
  id: string;
  name: string;
  description: string;
  gridX: number;
  gridY: number;
  slotCount: number;
  spawnTable: SpawnEntryDef[];
  fixedInteractables: { interactableId: string; condition?: string }[];
  specialConnections: { targetRoomId: string; label: string; condition?: string }[];
  seedOverrides: { condition: string; seed: number | string; priority: number }[];
  entryCondition?: string;
}

export interface SpawnEntryDef {
  id: string;
  interactableId: string;
  spawnChance: number;
  minCount: number;
  maxCount: number;
  condition?: string;
}

// ============================================================
// LOADER
// ============================================================

let _bundle: GameContentBundle | null = null;

/**
 * Load a content bundle from a JSON object (already parsed).
 */
export function loadBundle(data: GameContentBundle): void {
  _bundle = data;
}

/**
 * Load a content bundle from a URL (fetches and parses).
 */
export async function loadBundleFromUrl(url: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load bundle: ${res.status}`);
  const data = await res.json();
  loadBundle(data);
}

/**
 * Get the loaded bundle. Returns null if nothing loaded.
 */
export function getBundle(): GameContentBundle | null {
  return _bundle;
}

/**
 * Check if a bundle is loaded.
 */
export function isBundleLoaded(): boolean {
  return _bundle !== null;
}

// ============================================================
// CONVENIENCE ACCESSORS
// ============================================================

export function getSkillDefs(): SkillDef[] {
  return _bundle?.skills ?? [];
}

export function getItemDefs(): ItemDef[] {
  return _bundle?.items ?? [];
}

export function getComboDefs(): ComboDef[] {
  return _bundle?.combos ?? [];
}

export function getInteractableDefs(): InteractableDef[] {
  return _bundle?.interactables ?? [];
}

export function getWorld(): WorldDef | null {
  return _bundle?.world ?? null;
}

export function getItemDef(id: string): ItemDef | undefined {
  return _bundle?.items.find((i) => i.id === id);
}

export function getSkillDef(id: string): SkillDef | undefined {
  return _bundle?.skills.find((s) => s.id === id);
}

export function getInteractableDef(id: string): InteractableDef | undefined {
  return _bundle?.interactables.find((t) => t.id === id);
}

export function getRecipeDefs(): RecipeDef[] {
  return _bundle?.recipes ?? [];
}

export function getRecipeDef(id: string): RecipeDef | undefined {
  return _bundle?.recipes.find((r) => r.id === id);
}
