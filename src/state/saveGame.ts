import { getBundle } from "../data/loader";
import type { WorldObject } from "../data/bridge";
import { createInitialState } from "./initialState";
import type { ActiveEffect, GameState } from "./types";

const SAVE_VERSION = 1;
const LEGACY_MANUAL_SAVE_KEY = "ifrpg-save-manual-v1";
const MANUAL_SAVE_KEY = "ifrpg-save-manuals-v1";
const AUTOSAVE_KEY = "ifrpg-save-auto-v1";
const AUTOSAVE_ID = "__autosave__";

export type SaveSlotKind = "manual" | "autosave";

interface SavedActiveEffect {
  effectId: string;
  stacks: number;
  remainingMs?: number;
  intervalRemainingMs?: Record<string, number>;
}

interface SavedWorldObject extends Omit<WorldObject, "activeEffects" | "abilityCooldowns" | "revealStartedAt"> {
  activeEffects: SavedActiveEffect[];
  abilityCooldownRemainingMs: number[];
  revealElapsedMs?: number;
}

interface SavedGameSnapshot {
  seed: number;
  exploreCount: number;
  currentRoomId: string;
  previousRoomId: string | null;
  roomSpawnCounts: GameState["roomSpawnCounts"];
  playerStorage: GameState["playerStorage"];
  seenQuestIds: GameState["seenQuestIds"];
  announcedQuestIds: GameState["announcedQuestIds"];
  skills: GameState["skills"];
  objects: SavedWorldObject[];
  selectedObjectId: string | null;
  inventory: GameState["inventory"];
  inventoryEquipment: GameState["inventoryEquipment"];
  equipment: GameState["equipment"];
  feyRunes: GameState["feyRunes"];
  quickSlots: GameState["quickSlots"];
  quickSlotCooldownRemainingMs: number[];
  health: number;
  maxHealth: number;
  mana: number;
  maxMana: number;
  baseManaRegen: number;
  energy: number;
  maxEnergy: number;
  baseEnergyRegen: number;
  weather: GameState["weather"];
  playerName: string;
  playerLevel: number;
  playerXp: number;
  playerXpToNext: number;
  backpackPage: number;
  backpackSlots: number;
  bioboardSlots: GameState["bioboardSlots"];
  autoSkillId: string | null;
  weaponAutoEnabled: boolean;
  successfulUpwardHits: number;
  downwardBonusReady: boolean;
  sidePrepUpwardStreak: number;
  sidePrepDownwardHit: boolean;
  chopBuffRemainingMs: number;
  log: string[];
  questProgressSeen: GameState["questProgressSeen"];
  openWindow: GameState["openWindow"];
  placedObjects: GameState["placedObjects"];
  activeEffects: SavedActiveEffect[];
}

interface SavedGameFile {
  id: string;
  name: string;
  version: number;
  slot: SaveSlotKind;
  savedAt: number;
  roomId: string;
  roomName: string;
  playerLevel: number;
  snapshot: SavedGameSnapshot;
}

export interface SaveSummary {
  id: string;
  slot: SaveSlotKind;
  name: string;
  savedAt: number;
  roomId: string;
  roomName: string;
  playerLevel: number;
}

function createManualSaveId(): string {
  return `manual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function serializeActiveEffects(activeEffects: ActiveEffect[], now: number): SavedActiveEffect[] {
  const bundle = getBundle();
  return activeEffects.map((entry) => {
    const def = bundle?.statusEffects?.find((effect) => effect.id === entry.effectId);
    const remainingMs =
      typeof def?.durationMs === "number"
        ? Math.max(0, def.durationMs - (now - entry.appliedAt))
        : undefined;

    const intervalRemainingMs = Object.fromEntries(
      Object.entries(entry.intervalTimers ?? {}).flatMap(([hookId, lastTriggeredAt]) => {
        const hook = def?.eventHooks?.find((candidate) => candidate.id === hookId);
        if (!hook?.intervalMs) {
          return [];
        }
        return [[hookId, Math.max(0, hook.intervalMs - (now - lastTriggeredAt))]];
      })
    );

    return {
      effectId: entry.effectId,
      stacks: entry.stacks,
      remainingMs,
      intervalRemainingMs: Object.keys(intervalRemainingMs).length > 0 ? intervalRemainingMs : undefined,
    };
  });
}

function deserializeActiveEffects(saved: SavedActiveEffect[], now: number): ActiveEffect[] {
  const bundle = getBundle();
  return saved.map((entry) => {
    const def = bundle?.statusEffects?.find((effect) => effect.id === entry.effectId);
    const appliedAt =
      typeof entry.remainingMs === "number" && typeof def?.durationMs === "number"
        ? now - Math.max(0, def.durationMs - entry.remainingMs)
        : now;

    const intervalTimers = Object.fromEntries(
      Object.entries(entry.intervalRemainingMs ?? {}).flatMap(([hookId, remainingMs]) => {
        const hook = def?.eventHooks?.find((candidate) => candidate.id === hookId);
        if (!hook?.intervalMs) {
          return [];
        }
        return [[hookId, now - Math.max(0, hook.intervalMs - remainingMs)]];
      })
    );

    return {
      effectId: entry.effectId,
      stacks: entry.stacks,
      appliedAt,
      intervalTimers: Object.keys(intervalTimers).length > 0 ? intervalTimers : undefined,
    };
  });
}

function serializeWorldObject(object: WorldObject, now: number): SavedWorldObject {
  return {
    ...object,
    activeEffects: serializeActiveEffects(object.activeEffects ?? [], now),
    abilityCooldownRemainingMs: object.abilityCooldowns.map((cooldownAt) => Math.max(0, cooldownAt - now)),
    revealElapsedMs:
      typeof object.revealStartedAt === "number"
        ? Math.max(0, now - object.revealStartedAt)
        : undefined,
  };
}

function deserializeWorldObject(object: SavedWorldObject, now: number): WorldObject {
  return {
    ...object,
    activeEffects: deserializeActiveEffects(object.activeEffects ?? [], now),
    abilityCooldowns: object.abilityCooldownRemainingMs.map((remainingMs) =>
      remainingMs > 0 ? now + remainingMs : 0
    ),
    revealStartedAt:
      typeof object.revealElapsedMs === "number"
        ? now - object.revealElapsedMs
        : undefined,
  };
}

function buildSavedGameFile(
  state: GameState,
  options: { slot: SaveSlotKind; id: string; name: string }
): SavedGameFile {
  const bundle = getBundle();
  const roomName =
    bundle?.world.rooms.find((room) => room.id === state.currentRoomId)?.name ?? state.currentRoomId;

  return {
    id: options.id,
    name: options.name,
    version: SAVE_VERSION,
    slot: options.slot,
    savedAt: Date.now(),
    roomId: state.currentRoomId,
    roomName,
    playerLevel: state.playerLevel,
    snapshot: {
      seed: state.seed,
      exploreCount: state.exploreCount,
      currentRoomId: state.currentRoomId,
      previousRoomId: state.previousRoomId,
      roomSpawnCounts: state.roomSpawnCounts,
      playerStorage: state.playerStorage,
      seenQuestIds: state.seenQuestIds,
      announcedQuestIds: state.announcedQuestIds,
      skills: state.skills,
      objects: state.objects.map((object) => serializeWorldObject(object, state.now)),
      selectedObjectId: state.selectedObjectId,
      inventory: state.inventory,
      inventoryEquipment: state.inventoryEquipment,
      equipment: state.equipment,
      feyRunes: state.feyRunes,
      quickSlots: state.quickSlots,
      quickSlotCooldownRemainingMs: state.quickSlotCooldowns.map((cooldownAt) => Math.max(0, cooldownAt - state.now)),
      health: state.health,
      maxHealth: state.maxHealth,
      mana: state.mana,
      maxMana: state.maxMana,
      baseManaRegen: state.baseManaRegen,
      energy: state.energy,
      maxEnergy: state.maxEnergy,
      baseEnergyRegen: state.baseEnergyRegen,
      weather: state.weather,
      playerName: state.playerName,
      playerLevel: state.playerLevel,
      playerXp: state.playerXp,
      playerXpToNext: state.playerXpToNext,
      backpackPage: state.backpackPage,
      backpackSlots: state.backpackSlots,
      bioboardSlots: state.bioboardSlots,
      autoSkillId: state.autoSkillId,
      weaponAutoEnabled: state.weaponAutoEnabled,
      successfulUpwardHits: state.successfulUpwardHits,
      downwardBonusReady: state.downwardBonusReady,
      sidePrepUpwardStreak: state.sidePrepUpwardStreak,
      sidePrepDownwardHit: state.sidePrepDownwardHit,
      chopBuffRemainingMs: Math.max(0, state.chopBuffUntil - state.now),
      log: state.log,
      questProgressSeen: state.questProgressSeen,
      openWindow: state.openWindow,
      placedObjects: state.placedObjects,
      activeEffects: serializeActiveEffects(state.activeEffects, state.now),
    },
  };
}

function parseSaveFile(raw: string | null): SavedGameFile | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as SavedGameFile;
    if (parsed.version !== SAVE_VERSION) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function parseSaveFiles(raw: string | null): SavedGameFile[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as SavedGameFile[];
    return Array.isArray(parsed) ? parsed.filter((entry) => entry.version === SAVE_VERSION) : [];
  } catch {
    return [];
  }
}

function toSaveSummary(file: SavedGameFile): SaveSummary {
  return {
    id: file.id,
    slot: file.slot,
    name: file.name,
    savedAt: file.savedAt,
    roomId: file.roomId,
    roomName: file.roomName,
    playerLevel: file.playerLevel,
  };
}

function readManualSaveFiles(): SavedGameFile[] {
  const manuals = parseSaveFiles(localStorage.getItem(MANUAL_SAVE_KEY));
  if (manuals.length > 0) {
    return manuals.sort((left, right) => right.savedAt - left.savedAt);
  }

  const legacy = parseSaveFile(localStorage.getItem(LEGACY_MANUAL_SAVE_KEY));
  if (!legacy) {
    return [];
  }

  return [
    {
      ...legacy,
      id: legacy.id || createManualSaveId(),
      name: legacy.name || "Manual Save",
      slot: "manual",
    },
  ];
}

function writeManualSaveFiles(files: SavedGameFile[]): void {
  localStorage.setItem(MANUAL_SAVE_KEY, JSON.stringify(files));
}

export function canManualSave(state: GameState): boolean {
  return !state.action &&
    !state.exploreAction &&
    !state.craftingAction &&
    !state.travelAction &&
    !state.hostileAction &&
    !state.friendlyAction &&
    !state.weaponAction &&
    !state.activeDialogue &&
    !state.activeCutscene &&
    state.health > 0;
}

export function createManualSave(state: GameState, name: string): SaveSummary {
  const trimmedName = name.trim() || "Manual Save";
  const file = buildSavedGameFile(state, {
    slot: "manual",
    id: createManualSaveId(),
    name: trimmedName,
  });
  const nextFiles = [file, ...readManualSaveFiles()].sort((left, right) => right.savedAt - left.savedAt);
  writeManualSaveFiles(nextFiles);
  localStorage.removeItem(LEGACY_MANUAL_SAVE_KEY);
  return toSaveSummary(file);
}

export function saveAutosave(state: GameState): SaveSummary {
  const file = buildSavedGameFile(state, {
    slot: "autosave",
    id: AUTOSAVE_ID,
    name: "Autosave",
  });
  localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(file));
  return toSaveSummary(file);
}

export function getAutosaveSummary(): SaveSummary | null {
  const file = parseSaveFile(localStorage.getItem(AUTOSAVE_KEY));
  if (!file) {
    return null;
  }
  return toSaveSummary(file);
}

export function listManualSaveSummaries(): SaveSummary[] {
  return readManualSaveFiles().map(toSaveSummary);
}

export function deleteManualSave(id: string): SaveSummary[] {
  const nextFiles = readManualSaveFiles().filter((file) => file.id !== id);
  writeManualSaveFiles(nextFiles);
  return nextFiles.map(toSaveSummary);
}

export function getAllSaveSummaries(): SaveSummary[] {
  return [getAutosaveSummary(), ...listManualSaveSummaries()]
    .filter((entry): entry is SaveSummary => Boolean(entry))
    .sort((left, right) => right.savedAt - left.savedAt);
}

export function getLatestSaveSummary(): SaveSummary | null {
  return getAllSaveSummaries()[0] ?? null;
}

function hydrateSaveFile(file: SavedGameFile): GameState {
  const now = Date.now();
  const baseState = createInitialState();
  const snapshot = file.snapshot;
  const restoredObjects = snapshot.objects.map((object) => deserializeWorldObject(object, now));
  const selectedObjectId = restoredObjects.some((object) => object.id === snapshot.selectedObjectId)
    ? snapshot.selectedObjectId
    : null;

  return {
    ...baseState,
    seed: snapshot.seed,
    exploreCount: snapshot.exploreCount,
    currentRoomId: snapshot.currentRoomId,
    previousRoomId: snapshot.previousRoomId,
    roomSpawnCounts: snapshot.roomSpawnCounts,
    playerStorage: snapshot.playerStorage,
    seenQuestIds: snapshot.seenQuestIds,
    announcedQuestIds: snapshot.announcedQuestIds,
    skills: snapshot.skills,
    objects: restoredObjects,
    selectedObjectId,
    inventory: snapshot.inventory,
    inventoryEquipment: snapshot.inventoryEquipment,
    equipment: snapshot.equipment,
    feyRunes: snapshot.feyRunes,
    quickSlots: snapshot.quickSlots,
    quickSlotCooldowns: snapshot.quickSlotCooldownRemainingMs.map((remainingMs) =>
      remainingMs > 0 ? now + remainingMs : 0
    ) as GameState["quickSlotCooldowns"],
    health: snapshot.health,
    maxHealth: snapshot.maxHealth,
    mana: snapshot.mana,
    maxMana: snapshot.maxMana,
    baseManaRegen: snapshot.baseManaRegen,
    energy: snapshot.energy,
    maxEnergy: snapshot.maxEnergy,
    baseEnergyRegen: snapshot.baseEnergyRegen,
    isDefeated: false,
    weather: snapshot.weather,
    playerName: snapshot.playerName,
    playerLevel: snapshot.playerLevel,
    playerXp: snapshot.playerXp,
    playerXpToNext: snapshot.playerXpToNext,
    backpackPage: snapshot.backpackPage,
    backpackSlots: snapshot.backpackSlots,
    bioboardSlots: snapshot.bioboardSlots,
    autoSkillId: snapshot.autoSkillId,
    weaponAutoEnabled: snapshot.weaponAutoEnabled,
    successfulUpwardHits: snapshot.successfulUpwardHits,
    downwardBonusReady: snapshot.downwardBonusReady,
    sidePrepUpwardStreak: snapshot.sidePrepUpwardStreak,
    sidePrepDownwardHit: snapshot.sidePrepDownwardHit,
    chopBuffUntil: now + snapshot.chopBuffRemainingMs,
    lastAction: null,
    log: snapshot.log,
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
    passiveProgressCues: [],
    questProgressSeen: snapshot.questProgressSeen,
    objectBatchStartedAt: now,
    openWindow: snapshot.openWindow,
    placedObjects: snapshot.placedObjects,
    activeEffects: deserializeActiveEffects(snapshot.activeEffects, now),
    action: null,
    exploreAction: null,
    craftingAction: null,
    travelAction: null,
    hostileAction: null,
    friendlyAction: null,
    weaponAction: null,
    activeDialogue: null,
    activeCutscene: null,
    now,
    lastTickAt: now,
  };
}

export function loadSaveById(id: string): GameState | null {
  const file =
    id === AUTOSAVE_ID
      ? parseSaveFile(localStorage.getItem(AUTOSAVE_KEY))
      : readManualSaveFiles().find((entry) => entry.id === id) ?? null;
  if (!file) {
    return null;
  }
  return hydrateSaveFile(file);
}

export function loadLatestSave(): GameState | null {
  const latest = getLatestSaveSummary();
  if (!latest) {
    return null;
  }
  return loadSaveById(latest.id);
}
