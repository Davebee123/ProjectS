/**
 * Game state types — extracted from App.tsx.
 * Single source of truth for all game state interfaces.
 */
import type { SkillState, InventoryItem, EquipmentItemInstance, WorldObject, ComboRule } from "../data/bridge";

// Re-export bridge types used across the state layer
export type { SkillState, InventoryItem, EquipmentItemInstance, WorldObject, ComboRule };

export type EquipmentSlot =
  | "head" | "shoulders" | "chest" | "hands"
  | "legs" | "feet" | "back"
  | "mainHand" | "offHand";

/** Weather state ID — matches WeatherTemplate.id from bundle */
export type WeatherType = string;
export type WindowKey = "inventory" | "equipment" | "crafting" | "log";
export type FloatingZone = "skills" | "objects";

export interface PlacedObject {
  instanceId: string;
  itemId: string;
  itemName: string;
  roomId: string;
}

export interface ActiveEffect {
  effectId: string;
  stacks: number;
  appliedAt: number;
  intervalTimers?: Record<string, number>;
}

export interface ActionState {
  skillId: string;
  objectId: string;
  startedAt: number;
  endsAt: number;
  durationMs: number;
  energyCost: number;
  successRoll: boolean;
  tickMomentsMs: number[];
  resolvedTickCount: number;
  comboLabel?: string;
}

export interface ExploreState {
  seed: number;
  startedAt: number;
  endsAt: number;
}

export interface CraftingState {
  recipeId: string;
  startedAt: number;
  endsAt: number;
  durationMs: number;
  outputItemId: string;
  outputQty: number;
  outputName: string;
}

export interface TravelState {
  roomId: string;
  roomName: string;
  startedAt: number;
  endsAt: number;
  durationMs: number;
  energyCost: number;
}

export interface HostileActionState {
  objectId: string;
  targetObjectId?: string;
  abilityIndex: number;
  abilityName: string;
  skillId?: string;
  startedAt: number;
  endsAt: number;
  durationMs: number;
  damage?: number;
  resisted: boolean;
  tickMomentsMs: number[];
  resolvedTickCount: number;
  damageDealt: number;
}

export interface FriendlyActionState {
  objectId: string;
  targetObjectId: string;
  abilityIndex: number;
  abilityName: string;
  skillId?: string;
  startedAt: number;
  endsAt: number;
  durationMs: number;
  damage?: number;
  tickMomentsMs: number[];
  resolvedTickCount: number;
  damageDealt: number;
}

export interface WeaponActionState {
  objectId: string;
  weaponName: string;
  startedAt: number;
  endsAt: number;
  durationMs: number;
  damage: number;
}

export interface LastAction {
  skillId: string;
  objectId: string;
  tag: string;
  at: number;
}

export interface FloatingText {
  id: string;
  text: string;
  zone: FloatingZone;
  skillId?: string;
  objectId?: string;
  createdAt: number;
  durationMs: number;
}

export interface PlayerHitCue {
  id: string;
  text: string;
  expiresAt: number;
}

export interface UnlockCue {
  skillId: string;
  expiresAt: number;
}

export interface DestroyedObjectCue {
  object: WorldObject;
  createdAt: number;
  expiresAt: number;
  index: number;
}

export interface ObjectAttackCue {
  id: string;
  objectId: string;
  expiresAt: number;
}

export interface ObjectEmoteCue {
  id: string;
  objectId: string;
  text: string;
  createdAt: number;
  expiresAt: number;
  durationMs: number;
}

export interface LootReceiptEntry {
  id: string;
  name: string;
  qty: number;
  image?: string;
  rarityClass: "common" | "uncommon" | "rare";
}

export interface LootReceiptCue {
  id: string;
  objectId: string;
  entries: LootReceiptEntry[];
  appearsAt: number;
  expiresAt: number;
}

export interface QuestReceiptCue {
  id: string;
  questId: string;
  name: string;
  description: string;
  appearsAt: number;
  expiresAt: number;
}

export interface QuestProgressCue {
  id: string;
  questId: string;
  objectiveId: string;
  title: string;
  currentValue: number;
  requiredValue: number;
  appearsAt: number;
  expiresAt: number;
}

export interface PassiveProgressCue {
  id: string;
  skillId: string;
  skillName: string;
  level: number;
  previousLevel: number;
  currentValue: number;
  requiredValue: number;
  previousValue: number;
  previousRequiredValue: number;
  xpGained: number;
  leveledUp: boolean;
  barColor: string;
  accentColor: string;
  appearsAt: number;
  expiresAt: number;
  revision: number;
}

export interface DialogueState {
  objectId: string | null;
  dialogueId: string;
  nodeId: string;
  speakerName?: string;
  portraitImage?: string;
  portraitImagePositionX?: number;
  portraitImagePositionY?: number;
  portraitImageFit?: "cover" | "contain";
  meterLabel?: string;
  integrity?: number;
  maxIntegrity?: number;
}

export interface CutsceneState {
  cutsceneId: string;
  stepId: string;
  awaitingDialogue: boolean;
}

export interface GameState {
  seed: number;
  exploreCount: number;
  currentRoomId: string;
  previousRoomId: string | null;
  /** Per-room spawn counters: roomSpawnCounts[roomId][interactableId] = number of times spawned via explore. */
  roomSpawnCounts: Record<string, Record<string, number>>;
  playerStorage: Record<string, boolean | number | string>;
  seenQuestIds: string[];
  announcedQuestIds: string[];
  skills: SkillState[];
  objects: WorldObject[];
  selectedObjectId: string | null;
  inventory: InventoryItem[];
  inventoryEquipment: EquipmentItemInstance[];
  equipment: Record<EquipmentSlot, string | null>;
  feyRunes: [string | null, string | null, string | null, string | null, string | null, string | null];
  /** Quick slot bindings: 4 slots, each holds an itemId (ItemTemplate id) of a
   *  stackable consumable, or null. Click to consume one stack and fire the
   *  item's on_use event hooks. */
  quickSlots: [string | null, string | null, string | null, string | null];
  /** Cooldown end-timestamps (ms since epoch) per quick slot index. */
  quickSlotCooldowns: [number, number, number, number];
  // Vitals
  health: number;
  maxHealth: number;
  mana: number;
  maxMana: number;
  baseManaRegen: number;
  energy: number;
  maxEnergy: number;
  baseEnergyRegen: number;
  isDefeated: boolean;
  // Weather
  weather: WeatherType;
  // Player progression
  playerName: string;
  playerLevel: number;
  playerXp: number;
  playerXpToNext: number;
  // Backpack pagination
  backpackPage: number;
  backpackSlots: number;
  bioboardSlots: Array<string | null>;
  action: ActionState | null;
  exploreAction: ExploreState | null;
  craftingAction: CraftingState | null;
  travelAction: TravelState | null;
  hostileAction: HostileActionState | null;
  friendlyAction: FriendlyActionState | null;
  weaponAction: WeaponActionState | null;
  activeDialogue: DialogueState | null;
  activeCutscene: CutsceneState | null;
  autoSkillId: string | null;
  weaponAutoEnabled: boolean;
  successfulUpwardHits: number;
  downwardBonusReady: boolean;
  sidePrepUpwardStreak: number;
  sidePrepDownwardHit: boolean;
  chopBuffUntil: number;
  lastAction: LastAction | null;
  log: string[];
  floatTexts: FloatingText[];
  playerHitCue: PlayerHitCue | null;
  playerHitShakeUntil: number;
  weaponAttackAnimateUntil: number;
  unlockCues: UnlockCue[];
  destroyedObjectCues: DestroyedObjectCue[];
  objectAttackCues: ObjectAttackCue[];
  objectEmoteCues: ObjectEmoteCue[];
  lootReceiptCues: LootReceiptCue[];
  questReceiptCues: QuestReceiptCue[];
  questProgressCues: QuestProgressCue[];
  passiveProgressCues: PassiveProgressCue[];
  /** Last seen structured progress value per objectiveId. Used to detect positive deltas and emit progress cues. */
  questProgressSeen: Record<string, number>;
  objectBatchStartedAt: number;
  openWindow: WindowKey | null;
  placedObjects: PlacedObject[];
  activeEffects: ActiveEffect[];
  now: number;
  lastTickAt: number;
}

export type GameAction =
  | { type: "LOAD_GAME"; state: GameState }
  | { type: "EXPLORE" }
  | { type: "ACKNOWLEDGE_VISIBLE_QUESTS" }
  | { type: "SELECT_OBJECT"; objectId: string }
  | { type: "CLEAR_SELECTED_OBJECT" }
  | { type: "ADVANCE_DIALOGUE" }
  | { type: "CHOOSE_DIALOGUE_OPTION"; optionId: string }
  | { type: "CLOSE_DIALOGUE" }
  | { type: "ADVANCE_CUTSCENE" }
  | { type: "START_CUTSCENE"; cutsceneId: string }
  | { type: "SET_AUTO_SKILL"; skillId: string }
  | { type: "TOGGLE_WEAPON_AUTO" }
  | { type: "TOGGLE_WINDOW"; window: WindowKey }
  | { type: "EQUIP_ITEM"; instanceId: string }
  | { type: "UNEQUIP_SLOT"; slot: EquipmentSlot }
  | { type: "SET_RUNE"; slot: 0 | 1 | 2 | 3 | 4 | 5; instanceId: string }
  | { type: "REMOVE_RUNE"; slot: 0 | 1 | 2 | 3 | 4 | 5 }
  | { type: "BIND_QUICK_SLOT"; slot: 0 | 1 | 2 | 3; itemId: string }
  | { type: "CLEAR_QUICK_SLOT"; slot: 0 | 1 | 2 | 3 }
  | { type: "USE_QUICK_SLOT"; slot: 0 | 1 | 2 | 3 }
  | { type: "CRAFT_ITEM"; recipeId: string }
  | { type: "PLACE_ITEM"; itemId: string }
  | { type: "REMOVE_PLACED_ITEM"; instanceId: string }
  | { type: "TRAVEL"; roomId: string }
  | { type: "SET_BACKPACK_PAGE"; page: number }
  | { type: "ASSIGN_BIOBOARD_SKILL"; skillId: string }
  | { type: "REMOVE_BIOBOARD_SKILL"; slotIndex: number }
  | { type: "DISMISS_LOOT_RECEIPT"; cueId: string }
  | { type: "TICK"; now: number };

export interface CastMetrics {
  durationMs: number;
  energyCost: number;
  tickMomentsMs: number[];
  combo: ComboRule | null;
}

export interface ActionPlan {
  action: ActionState;
  nextEnergy: number;
}
