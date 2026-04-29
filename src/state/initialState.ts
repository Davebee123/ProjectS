/**
 * Creates the initial game state from the loaded bundle.
 */
import { getBundle } from "../data/loader";
import {
  skillDefsToStates,
  buildStartingInventory,
  resolveEquipmentItem,
} from "../data/bridge";
import type { GameState, EquipmentSlot } from "./types";
import { getVisibleQuestIds } from "./quests";
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
  const startingInventory = bundle ? buildStartingInventory(bundle) : { stackables: [], equipmentItems: [] };

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

  for (const instance of startingInventory.equipmentItems) {
    if (!bundle) continue;
    const resolved = resolveEquipmentItem(instance, bundle);
    if (!resolved?.slot || resolved.slot === "rune") continue;
    if (!equipment[resolved.slot as EquipmentSlot]) {
      equipment[resolved.slot as EquipmentSlot] = instance.instanceId;
    }
  }

  const seed = 9103;
  const weather = pickWeather(seed);

  // Build a temporary state for object generation
  const tempState: GameState = {
    seed,
    exploreCount: 1,
    currentRoomId: startingRoomId,
    previousRoomId: null,
    roomSpawnCounts: {},
    playerStorage,
    seenQuestIds: [],
    announcedQuestIds: [],
    skills,
    objects: [],
    selectedObjectId: null,
    inventory: startingInventory.stackables,
    inventoryEquipment: startingInventory.equipmentItems,
    equipment,
    feyRunes: [null, null, null, null, null, null],
    quickSlots: [null, null, null, null],
    quickSlotCooldowns: [0, 0, 0, 0],
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
    backpackSlots: 3,
    bioboardSlots: [null],
    // Actions
    action: null,
    exploreAction: null,
    craftingAction: null,
    travelAction: null,
    hostileAction: null,
    friendlyAction: null,
    weaponAction: null,
    activeDialogue: null,
    activeCutscene: null,
    autoSkillId: null,
    weaponAutoEnabled: true,
    successfulUpwardHits: 0,
    downwardBonusReady: false,
    sidePrepUpwardStreak: 0,
    sidePrepDownwardHit: false,
    chopBuffUntil: 0,
    lastAction: null,
    log: [`Entered ${roomName}.`],
    floatTexts: [],
    playerHitCue: null,
    playerHitShakeUntil: 0,
    weaponAttackAnimateUntil: 0,
    unlockCues: [],
    destroyedObjectCues: [],
    objectAttackCues: [],
    objectEmoteCues: [],
    lootReceiptCues: [],
    questReceiptCues: [],
    questProgressCues: [],
    questProgressSeen: {},
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
    seenQuestIds: getVisibleQuestIds(tempState),
    announcedQuestIds: getVisibleQuestIds(tempState),
    selectedObjectId: null,
  };
}
