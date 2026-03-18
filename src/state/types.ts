/**
 * Game state types — extracted from App.tsx.
 * Single source of truth for all game state interfaces.
 */
import type { SkillState, InventoryItem, WorldObject, ComboRule } from "../data/bridge";

// Re-export bridge types used across the state layer
export type { SkillState, InventoryItem, WorldObject, ComboRule };

export type EquipmentSlot =
  | "head" | "shoulders" | "chest" | "hands"
  | "legs" | "feet" | "back"
  | "mainHand" | "offHand";

export type WeatherType = "clear" | "cloudy" | "rainy" | "stormy";
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
}

export interface ActionState {
  skillId: string;
  objectId: string;
  startedAt: number;
  endsAt: number;
  durationMs: number;
  energyCost: number;
  comboLabel?: string;
}

export interface ExploreState {
  seed: number;
  startedAt: number;
  endsAt: number;
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

export interface GameState {
  seed: number;
  exploreCount: number;
  currentRoomId: string;
  playerStorage: Record<string, boolean | number | string>;
  skills: SkillState[];
  objects: WorldObject[];
  selectedObjectId: string | null;
  inventory: InventoryItem[];
  equipment: Record<EquipmentSlot, string | null>;
  feyRunes: [string | null, string | null, string | null, string | null, string | null, string | null];
  // Vitals
  health: number;
  maxHealth: number;
  mana: number;
  maxMana: number;
  baseManaRegen: number;
  energy: number;
  maxEnergy: number;
  baseEnergyRegen: number;
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
  action: ActionState | null;
  exploreAction: ExploreState | null;
  autoSkillId: string | null;
  successfulUpwardHits: number;
  downwardBonusReady: boolean;
  sidePrepUpwardStreak: number;
  sidePrepDownwardHit: boolean;
  chopBuffUntil: number;
  lastAction: LastAction | null;
  log: string[];
  floatTexts: FloatingText[];
  unlockCues: UnlockCue[];
  destroyedObjectCues: DestroyedObjectCue[];
  objectBatchStartedAt: number;
  openWindow: WindowKey | null;
  placedObjects: PlacedObject[];
  activeEffects: ActiveEffect[];
  now: number;
  lastTickAt: number;
}

export type GameAction =
  | { type: "EXPLORE" }
  | { type: "SELECT_OBJECT"; objectId: string }
  | { type: "SET_AUTO_SKILL"; skillId: string }
  | { type: "TOGGLE_WINDOW"; window: WindowKey }
  | { type: "EQUIP_ITEM"; itemId: string }
  | { type: "UNEQUIP_SLOT"; slot: EquipmentSlot }
  | { type: "SET_RUNE"; slot: 0 | 1 | 2 | 3 | 4 | 5; itemId: string }
  | { type: "REMOVE_RUNE"; slot: 0 | 1 | 2 | 3 | 4 | 5 }
  | { type: "CRAFT_ITEM"; recipeId: string }
  | { type: "PLACE_ITEM"; itemId: string }
  | { type: "REMOVE_PLACED_ITEM"; instanceId: string }
  | { type: "TRAVEL"; roomId: string }
  | { type: "SET_BACKPACK_PAGE"; page: number }
  | { type: "TICK"; now: number };

export interface CastMetrics {
  durationMs: number;
  energyCost: number;
  combo: ComboRule | null;
}

export interface ActionPlan {
  action: ActionState;
  nextEnergy: number;
}
