/**
 * Creates the initial game state from the loaded bundle.
 */
import { getBundle } from "../data/loader";
import {
  skillDefsToStates,
  buildStartingInventory,
} from "../data/bridge";
import type { GameState, EquipmentSlot } from "./types";
import { generateObjectsForRoom, pickWeather } from "./reducer";

const ALL_EQUIPMENT_SLOTS: EquipmentSlot[] = [
  "head", "shoulders", "chest", "hands",
  "legs", "feet", "back", "mainHand", "offHand",
];

export function createInitialState(): GameState {
  const bundle = getBundle();
  const now = Date.now();

  // Skills from bundle
  const skills = bundle ? skillDefsToStates(bundle.skills) : [];

  // Starting inventory from bundle (equippable items)
  const inventory = bundle ? buildStartingInventory(bundle) : [];

  // World info
  const world = bundle?.world;
  const startingRoomId = world?.startingRoomId ?? "";
  const roomName = world?.rooms.find((r) => r.id === startingRoomId)?.name ?? "Unknown";

  // Initialize player storage from bundle defaults
  const playerStorage: Record<string, boolean | number | string> = {};
  if (bundle?.storageKeys) {
    for (const key of bundle.storageKeys) {
      playerStorage[key.id] = key.defaultValue;
    }
  }

  // Auto-equip items that have slots (map old slot names for compatibility)
  const equipment = Object.fromEntries(
    ALL_EQUIPMENT_SLOTS.map((s) => [s, null])
  ) as Record<EquipmentSlot, string | null>;

  for (const item of inventory) {
    if (!item.slot || item.slot === "rune") continue;
    if (!equipment[item.slot as EquipmentSlot]) {
      equipment[item.slot as EquipmentSlot] = item.id;
    }
  }

  const seed = 9103;
  const weather = pickWeather(seed);

  // Build a temporary state for object generation
  const tempState: GameState = {
    seed,
    exploreCount: 1,
    currentRoomId: startingRoomId,
    playerStorage,
    skills,
    objects: [],
    selectedObjectId: null,
    inventory,
    equipment,
    feyRunes: [null, null, null, null, null, null],
    // Vitals
    health: 100,
    maxHealth: 100,
    mana: 50,
    maxMana: 50,
    baseManaRegen: 1,
    energy: 100,
    maxEnergy: 100,
    baseEnergyRegen: 3,
    // Weather
    weather,
    // Player progression
    playerName: "Adventurer",
    playerLevel: 1,
    playerXp: 0,
    playerXpToNext: 100,
    // Backpack
    backpackPage: 0,
    backpackSlots: 30,
    // Actions
    action: null,
    exploreAction: null,
    autoSkillId: null,
    successfulUpwardHits: 0,
    downwardBonusReady: false,
    sidePrepUpwardStreak: 0,
    sidePrepDownwardHit: false,
    chopBuffUntil: 0,
    lastAction: null,
    log: [`Entered ${roomName}.`],
    floatTexts: [],
    unlockCues: [],
    destroyedObjectCues: [],
    objectBatchStartedAt: now - 10000,
    openWindow: null,
    placedObjects: [],
    activeEffects: [],
    now,
    lastTickAt: now,
  };

  const objects = generateObjectsForRoom(startingRoomId, seed, tempState, true);

  return {
    ...tempState,
    objects,
    selectedObjectId: objects[0]?.id ?? null,
  };
}
