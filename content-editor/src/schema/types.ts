// ============================================================
// TOP-LEVEL EXPORT BUNDLE
// ============================================================
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
}

// ============================================================
// TAG SYSTEM
// ============================================================
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

// ============================================================
// PLAYER STORAGE / EVENT SYSTEM
// ============================================================
export interface StorageKeyDef {
  id: string;
  label: string;
  type: "flag" | "counter" | "value";
  defaultValue: boolean | number | string;
  description: string;
}

// ============================================================
// ITEM TEMPLATES
// ============================================================
export type EquipmentSlot = "weapon" | "armor" | "accessory";

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
  slot?: EquipmentSlot;
  stackable: boolean;
  stats: ItemStats;
  eventHooks: ItemEventHook[];
}

// ============================================================
// ITEM EVENT HOOKS (freeform scripting per item)
// ============================================================
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
  condition?: string;           // DSL condition — e.g. target.tag == "tree"
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
  statusEffectId?: string;      // for apply_status / remove_status
  targetSkillId?: string;       // for grant_xp
  storageKeyId?: string;        // for set_storage
  storageOperation?: "set" | "increment" | "decrement" | "toggle";
  value?: number | string | boolean;
  customScript?: string;        // freeform DSL for "custom" type
}

// ============================================================
// STATUS EFFECTS
// ============================================================
export type StatusRemovalType = "timed" | "conditional" | "both";

export interface StatusEffectTemplate {
  id: string;
  name: string;
  description: string;
  removalType: StatusRemovalType;
  durationMs?: number;          // for timed / both
  removeCondition?: string;     // DSL condition for conditional / both
  statModifiers: StatModifier[];
  stackable: boolean;
  maxStacks: number;
  color: string;
}

export interface StatModifier {
  stat: string;                 // "attack", "defense", "speedMultiplier", etc.
  operation: "add" | "multiply";
  value: number;
}

// ============================================================
// SKILL TEMPLATES
// ============================================================
export interface SkillTemplate {
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
}

// ============================================================
// COMBO RULES
// ============================================================
export interface ComboRuleTemplate {
  id: string;
  fromSkillId: string;
  toSkillId: string;
  activityTag: string;
  windowMs: number;
  timeMultiplier: number;
  energyMultiplier: number;
  label: string;
}

// ============================================================
// INTERACTABLE TEMPLATES
// ============================================================
export interface InteractableTemplate {
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
  lootTable: LootTableEntry[];
  xpRewards: XpReward[];
  spawnCondition?: string;
  abilities: InteractableAbility[];
  onInteractEffects: StorageEffect[];
  onDestroyEffects: StorageEffect[];
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
}

// ============================================================
// WORLD + ROOMS
// ============================================================
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
  gridX: number;
  gridY: number;
  slotCount: number;
  entryCondition?: string;
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
