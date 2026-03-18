export interface GameContentBundle {
  version: string;
  exportedAt: string;
  tags: TagDefinitions;
  storageKeys: StorageKeyDef[];
  statusEffects: StatusEffectTemplate[];
  items: ItemTemplate[];
  skills: SkillTemplate[];
  combos: ComboRuleTemplate[];
  interactables: InteractableTemplate[];
  world: WorldTemplate;
  recipes: RecipeTemplate[];
}

export interface TagDefinitions {
  activityTags: ActivityTagDef[];
  abilityTags: AbilityTagDef[];
}

export interface ActivityTagDef {
  id: string;
  label: string;
  description: string;
  color: string;
}

export interface AbilityTagDef {
  id: string;
  label: string;
  description: string;
}

export interface StorageKeyDef {
  id: string;
  label: string;
  type: "flag" | "counter" | "value";
  defaultValue: boolean | number | string;
  description: string;
}

export type EquipmentSlot =
  | "head"
  | "shoulders"
  | "chest"
  | "hands"
  | "legs"
  | "feet"
  | "back"
  | "mainHand"
  | "offHand"
  | "rune";

export interface ItemStats {
  attack?: number;
  activityPowerMultiplier?: number;
  defense?: number;
  energyRegen?: number;
  speedMultiplier?: number;
  energyCostMultiplier?: number;
}

export interface ItemTemplate {
  id: string;
  name: string;
  description: string;
  folder?: string;
  slot?: EquipmentSlot;
  stackable: boolean;
  stats: ItemStats;
  eventHooks: ItemEventHook[];
  placeable?: boolean;
  placementEffects?: PlacementEffect[];
}

export type ItemEventType =
  | "on_equip"
  | "on_unequip"
  | "on_hit"
  | "on_kill"
  | "on_interact"
  | "on_explore"
  | "on_damage_taken"
  | "on_tick";

export interface ItemEventHook {
  id: string;
  event: ItemEventType;
  condition?: string;
  actions: EventAction[];
}

export type EventActionType =
  | "apply_status"
  | "remove_status"
  | "deal_bonus_damage"
  | "heal"
  | "restore_energy"
  | "grant_xp"
  | "set_storage"
  | "custom";

export interface EventAction {
  type: EventActionType;
  statusEffectId?: string;
  targetSkillId?: string;
  storageKeyId?: string;
  storageOperation?: "set" | "increment" | "decrement" | "toggle";
  value?: number | string | boolean;
  customScript?: string;
}

export type StatusRemovalType = "timed" | "conditional" | "both";

export interface StatusEffectTemplate {
  id: string;
  name: string;
  description: string;
  folder?: string;
  removalType: StatusRemovalType;
  durationMs?: number;
  removeCondition?: string;
  statModifiers: StatModifier[];
  stackable: boolean;
  maxStacks: number;
  color: string;
}

export interface StatModifier {
  stat: string;
  operation: "add" | "multiply";
  value: number;
}

export interface SkillTemplate {
  id: string;
  name: string;
  folder?: string;
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

export interface ComboRuleTemplate {
  id: string;
  folder?: string;
  fromSkillId: string;
  toSkillId: string;
  activityTag: string;
  windowMs: number;
  timeMultiplier: number;
  energyMultiplier: number;
  label: string;
}

export interface InteractableTemplate {
  id: string;
  name: string;
  description: string;
  folder?: string;
  activityTag: string;
  allowedAbilityTags: string[];
  requiredLevel: number;
  effectiveHealth: { min: number; max: number };
  barColor: string;
  accentColor: string;
  meterLabel: string;
  lootTable: LootTableEntry[];
  xpRewards: XpReward[];
  spawnCondition?: string;
  abilities: InteractableAbility[];
  onInteractEffects: StorageEffect[];
  onDestroyEffects: StorageEffect[];
  image?: string;
  sounds?: {
    onHit?: string;
    onDestroy?: string;
    onAbilityCast?: string;
  };
}

export interface InteractableAbility {
  name: string;
  castTimeMs: number;
  cooldownMs: number;
  effect: string;
  resistedByPassiveId?: string;
  resistChancePerLevel: number;
}

export interface LootTableEntry {
  id: string;
  itemId: string;
  quantityMin: number;
  quantityMax: number;
  dropChance: number;
  weight: number;
  condition?: string;
}

export interface XpReward {
  skillId: string;
  amount: number;
}

export interface StorageEffect {
  storageKeyId: string;
  operation: "set" | "increment" | "decrement" | "toggle";
  value?: boolean | number | string;
  condition?: string;
}

export interface WorldTemplate {
  id: string;
  name: string;
  gridWidth: number;
  gridHeight: number;
  rooms: RoomTemplate[];
  startingRoomId: string;
  defaultSlotCount: number;
  startingItemIds: string[];
}

export interface RoomTemplate {
  id: string;
  name: string;
  description: string;
  level?: number;
  gridX: number;
  gridY: number;
  slotCount: number;
  entryCondition?: string;
  ambientSound?: string;
  backgroundImage?: string;
  spawnTable: SpawnTableEntry[];
  fixedInteractables: FixedInteractable[];
  specialConnections: RoomConnection[];
  seedOverrides: SeedOverride[];
}

export interface SpawnTableEntry {
  id: string;
  interactableId: string;
  spawnChance: number;
  minCount: number;
  maxCount: number;
  condition?: string;
}

export interface FixedInteractable {
  interactableId: string;
  condition?: string;
}

export interface RoomConnection {
  targetRoomId: string;
  label: string;
  condition?: string;
}

export interface SeedOverride {
  condition: string;
  seed: number | string;
  priority: number;
}

export type PlacementEffectType = "stat_aura" | "spawn_modifier";

export interface PlacementEffect {
  id: string;
  type: PlacementEffectType;
  stat?: keyof ItemStats;
  value?: number;
  targetTag?: string;
  spawnChanceMultiplier?: number;
}

export interface RecipeIngredient {
  itemId: string;
  qty: number;
}

export interface RecipeTemplate {
  id: string;
  name: string;
  folder?: string;
  stationTag?: string;
  unlockCondition?: string;
  ingredients: RecipeIngredient[];
  outputItemId: string;
  outputQty: number;
}
