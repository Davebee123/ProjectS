import { useEffect, useMemo, useReducer, useState } from "react";
import { getBundle, loadBundle } from "./data/loader";
import { evaluateCondition, type EvalContext } from "./data/evaluator";
import {
  skillDefsToStates,
  comboDefsToRules,
  buildStartingInventory,
  generateObjectsFromRoom,
  resolveItemNames,
  checkSkillUnlocks,
  getAvailableRecipes,
  type SkillState,
  type InventoryItem,
  type WorldObject,
  type ComboRule,
} from "./data/bridge";
import type { RecipeDef } from "./data/loader";

type EquipmentSlot = "weapon" | "armor" | "accessory";
type WindowKey = "inventory" | "equipment" | "crafting" | "log";
type FloatingZone = "skills" | "objects";

interface PlacedObject {
  instanceId: string;
  itemId: string;
  itemName: string;
  roomId: string;
}

// ActionState, ExploreState, LastAction, etc. are game-specific
interface ActionState {
  skillId: string;
  objectId: string;
  startedAt: number;
  endsAt: number;
  durationMs: number;
  energyCost: number;
  comboLabel?: string;
}

interface ExploreState {
  seed: number;
  startedAt: number;
  endsAt: number;
}

interface LastAction {
  skillId: string;
  objectId: string;
  tag: string;
  at: number;
}

interface FloatingText {
  id: string;
  text: string;
  zone: FloatingZone;
  skillId?: string;
  objectId?: string;
  createdAt: number;
  durationMs: number;
}

interface UnlockCue {
  skillId: string;
  expiresAt: number;
}

interface GameState {
  seed: number;
  exploreCount: number;
  currentRoomId: string;
  playerStorage: Record<string, boolean | number | string>;
  skills: SkillState[];
  objects: WorldObject[];
  selectedObjectId: string | null;
  inventory: InventoryItem[];
  equipment: Record<EquipmentSlot, string | null>;
  energy: number;
  maxEnergy: number;
  baseEnergyRegen: number;
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
  objectBatchStartedAt: number;
  openWindow: WindowKey | null;
  placedObjects: PlacedObject[];
  now: number;
  lastTickAt: number;
}

type GameAction =
  | { type: "EXPLORE" }
  | { type: "SELECT_OBJECT"; objectId: string }
  | { type: "SET_AUTO_SKILL"; skillId: string }
  | { type: "TOGGLE_WINDOW"; window: WindowKey }
  | { type: "EQUIP_ITEM"; itemId: string }
  | { type: "UNEQUIP_SLOT"; slot: EquipmentSlot }
  | { type: "CRAFT_ITEM"; recipeId: string }
  | { type: "PLACE_ITEM"; itemId: string }
  | { type: "REMOVE_PLACED_ITEM"; instanceId: string }
  | { type: "TRAVEL"; roomId: string }
  | { type: "TICK"; now: number };

interface CastMetrics {
  durationMs: number;
  energyCost: number;
  combo: ComboRule | null;
}

interface ActionPlan {
  action: ActionState;
  nextEnergy: number;
}

// ── Loaded game data (set once at startup) ──
let _combos: ComboRule[] = [];

// ── Utility functions ──

function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function appendLog(log: string[], line: string): string[] {
  return [line, ...log].slice(0, 10);
}

function pushFloatingText(
  floatTexts: FloatingText[],
  text: string,
  now: number,
  options?: {
    durationMs?: number;
    zone?: FloatingZone;
    skillId?: string;
    objectId?: string;
  }
): FloatingText[] {
  const durationMs = options?.durationMs ?? 1600;
  return [
    {
      id: `${now}_${Math.random().toString(36).slice(2, 8)}`,
      text,
      zone: options?.zone ?? "skills",
      skillId: options?.skillId,
      objectId: options?.objectId,
      createdAt: now,
      durationMs,
    },
    ...floatTexts,
  ].slice(0, 6);
}

function addUnlockCue(cues: UnlockCue[], skillId: string, now: number): UnlockCue[] {
  const filtered = cues.filter((entry) => entry.skillId !== skillId && entry.expiresAt > now);
  return [...filtered, { skillId, expiresAt: now + 1200 }];
}

// ── Build evaluation context from game state ──

function buildEvalContext(state: GameState): EvalContext {
  return {
    hasItem: (id) => state.inventory.some((i) => i.id === id),
    itemCount: (id) => state.inventory.find((i) => i.id === id)?.qty ?? 0,
    flag: (id) => state.playerStorage[id] === true,
    counter: (id) => {
      const v = state.playerStorage[id];
      return typeof v === "number" ? v : 0;
    },
    value: (id) => {
      const v = state.playerStorage[id];
      if (typeof v === "boolean") return v ? 1 : 0;
      return v ?? "";
    },
    skillLevel: (id) => state.skills.find((s) => s.id === id)?.level ?? 0,
    skillUnlocked: (id) => state.skills.find((s) => s.id === id)?.unlocked ?? false,
    roomId: state.currentRoomId,
    exploreCount: state.exploreCount,
  };
}

// ── Storage effect processing ──

function applyStorageEffect(
  storage: Record<string, boolean | number | string>,
  effect: { storageKeyId: string; operation: string; value?: number | string | boolean }
): Record<string, boolean | number | string> {
  const next = { ...storage };
  const current = next[effect.storageKeyId];
  switch (effect.operation) {
    case "set":
      next[effect.storageKeyId] = effect.value ?? true;
      break;
    case "increment": {
      const num = typeof current === "number" ? current : 0;
      const amount = typeof effect.value === "number" ? effect.value : 1;
      next[effect.storageKeyId] = num + amount;
      break;
    }
    case "decrement": {
      const num = typeof current === "number" ? current : 0;
      const amount = typeof effect.value === "number" ? effect.value : 1;
      next[effect.storageKeyId] = num - amount;
      break;
    }
    case "toggle":
      next[effect.storageKeyId] = current !== true;
      break;
  }
  return next;
}

// ── Combo lookup (uses loaded combos) ──

function findCombo(
  lastAction: LastAction | null,
  skillId: string,
  tag: string,
  now: number
): ComboRule | null {
  if (!lastAction) return null;
  return (
    _combos.find(
      (rule) =>
        rule.from === lastAction.skillId &&
        rule.to === skillId &&
        rule.tag === tag &&
        now - lastAction.at <= rule.windowMs
    ) ?? null
  );
}

// ── Skill helpers ──

function getSkill(skills: SkillState[], skillId: string): SkillState | null {
  return skills.find((entry) => entry.id === skillId) ?? null;
}

function getRelevantPassiveLevel(skills: SkillState[], tag: string): number {
  const passives = skills.filter((s) => s.kind === "passive" && s.tags.includes(tag));
  if (passives.length === 0) return 1;
  return Math.max(...passives.map((s) => s.level));
}

function getSuccessChance(playerLevel: number, objectLevel: number): number {
  if (playerLevel >= objectLevel) return 100;
  const deficit = objectLevel - playerLevel;
  return Math.max(25, 100 - deficit * 12);
}

function isSideChopReady(state: GameState): boolean {
  return state.sidePrepUpwardStreak >= 2 && state.sidePrepDownwardHit;
}

function isChopBuffActive(state: GameState): boolean {
  return state.now < state.chopBuffUntil;
}

// ── Inventory helpers ──

function mergeDrops(inventory: InventoryItem[], drops: InventoryItem[]): InventoryItem[] {
  const next = [...inventory];
  for (const drop of drops) {
    const existingIndex = next.findIndex((item) => item.id === drop.id);
    if (existingIndex >= 0) {
      const existing = next[existingIndex];
      next[existingIndex] = { ...existing, qty: existing.qty + drop.qty };
      continue;
    }
    next.push({ ...drop });
  }
  return next;
}

function awardSkillXp(
  skills: SkillState[],
  skillId: string,
  amount: number
): { skills: SkillState[]; levelUps: number; newLevel: number } {
  let levelUps = 0;
  let newLevel = 0;
  const nextSkills = skills.map((skill) => {
    if (skill.id !== skillId) return skill;

    let nextXp = skill.xp + amount;
    let nextXpToNext = skill.xpToNext;
    let nextLevel = skill.level;
    const scaling = skill.xpScaling ?? 1.18;

    while (nextXp >= nextXpToNext) {
      nextXp -= nextXpToNext;
      nextLevel += 1;
      levelUps += 1;
      nextXpToNext = Math.max(25, Math.round(nextXpToNext * scaling));
    }

    newLevel = nextLevel;
    return { ...skill, xp: nextXp, xpToNext: nextXpToNext, level: nextLevel };
  });

  return { skills: nextSkills, levelUps, newLevel };
}

// ── Equipment stats ──

function getEquippedItems(state: GameState): InventoryItem[] {
  const ids = Object.values(state.equipment).filter((value): value is string => Boolean(value));
  return ids
    .map((itemId) => state.inventory.find((item) => item.id === itemId))
    .filter((item): item is InventoryItem => Boolean(item));
}

function getEquipmentStats(state: GameState): {
  attack: number;
  activityPowerMultiplier: number;
  defense: number;
  energyRegen: number;
  speedMultiplier: number;
  energyCostMultiplier: number;
} {
  const equippedItems = getEquippedItems(state);
  const base = equippedItems.reduce(
    (stats, item) => ({
      attack: stats.attack + (item.attack ?? 0),
      activityPowerMultiplier: stats.activityPowerMultiplier * (item.activityPowerMultiplier ?? 1),
      defense: stats.defense + (item.defense ?? 0),
      energyRegen: stats.energyRegen + (item.energyRegen ?? 0),
      speedMultiplier: stats.speedMultiplier * (item.speedMultiplier ?? 1),
      energyCostMultiplier: stats.energyCostMultiplier * (item.energyCostMultiplier ?? 1),
    }),
    {
      attack: 0,
      activityPowerMultiplier: 1,
      defense: 0,
      energyRegen: 0,
      speedMultiplier: 1,
      energyCostMultiplier: 1,
    }
  );

  // Apply stat_aura from placed objects in the current room
  const bundle = getBundle();
  if (bundle) {
    const roomPlaced = state.placedObjects.filter((p) => p.roomId === state.currentRoomId);
    for (const placed of roomPlaced) {
      const itemDef = bundle.items.find((i) => i.id === placed.itemId);
      if (!itemDef?.placementEffects) continue;
      for (const fx of itemDef.placementEffects) {
        if (fx.type !== "stat_aura" || !fx.stat || fx.value == null) continue;
        switch (fx.stat) {
          case "attack": base.attack += fx.value; break;
          case "defense": base.defense += fx.value; break;
          case "energyRegen": base.energyRegen += fx.value; break;
          case "speedMultiplier": base.speedMultiplier *= fx.value; break;
          case "energyCostMultiplier": base.energyCostMultiplier *= fx.value; break;
          case "activityPowerMultiplier": base.activityPowerMultiplier *= fx.value; break;
        }
      }
    }
  }

  return base;
}

function getActivityProgressValue(
  skill: SkillState,
  gear: ReturnType<typeof getEquipmentStats>
): number {
  const scaled = skill.basePower + skill.powerPerLevel * Math.max(0, skill.level - 1);
  return Math.max(1, Math.round((scaled + gear.attack) * gear.activityPowerMultiplier));
}

// ── Cast metrics ──

function getCastMetrics(
  state: GameState,
  skill: SkillState,
  target: WorldObject,
  now: number
): CastMetrics {
  const gear = getEquipmentStats(state);
  const combo =
    skill.id === "downward_chop" && state.downwardBonusReady
      ? findCombo(state.lastAction, skill.id, target.tag, now)
      : null;
  const isBonusDownward = skill.id === "downward_chop" && state.downwardBonusReady;
  const effectiveBaseDuration = isBonusDownward ? 2000 : skill.baseDurationMs;
  const comboTimeMultiplier = isBonusDownward ? 1 : combo?.timeMultiplier ?? 1;
  const comboEnergyMultiplier = isBonusDownward ? 1 : combo?.energyMultiplier ?? 1;
  const durationMs = Math.max(
    350,
    Math.round(effectiveBaseDuration * comboTimeMultiplier * gear.speedMultiplier)
  );
  const energyCost = Math.max(
    1,
    Math.round(skill.baseEnergyCost * comboEnergyMultiplier * gear.energyCostMultiplier)
  );

  return { durationMs, energyCost, combo };
}

// ── Action planning ──

function makeActionPlan(state: GameState, skillId: string, now: number): ActionPlan | null {
  if (state.action) return null;
  if (state.exploreAction) return null;

  const target = state.objects.find((entry) => entry.id === state.selectedObjectId);
  if (!target) return null;

  const skill = state.skills.find((entry) => entry.id === skillId && entry.kind === "active");
  if (!skill) return null;
  if (!skill.unlocked) return null;
  if (skill.id === "side_chop" && !isSideChopReady(state)) return null;
  if (!skill.tags.includes(target.tag)) return null;
  if (target.allowedAbilityTags.length > 0 && !target.allowedAbilityTags.some((t) => skill.abilityTags.includes(t))) return null;

  const metrics = getCastMetrics(state, skill, target, now);
  if (state.energy < metrics.energyCost) return null;

  return {
    action: {
      skillId: skill.id,
      objectId: target.id,
      startedAt: now,
      endsAt: now + metrics.durationMs,
      durationMs: metrics.durationMs,
      energyCost: metrics.energyCost,
      comboLabel: metrics.combo?.label,
    },
    nextEnergy: state.energy - metrics.energyCost,
  };
}

// ── Object generation from room ──

function generateObjectsForRoom(
  roomId: string,
  seed: number,
  state: GameState,
  forceStarter = false
): WorldObject[] {
  const bundle = getBundle();
  if (!bundle) return [];

  const world = bundle.world;
  const room = world.rooms.find((r) => r.id === roomId);
  if (!room) return [];

  const rng = seededRandom(seed);
  const ctx = buildEvalContext(state);
  const itemDefs = bundle.items;

  const objects = generateObjectsFromRoom(
    room.spawnTable,
    bundle.interactables,
    seed,
    rng,
    ctx
  );

  // Resolve item names on drops
  for (const obj of objects) {
    obj.drops = resolveItemNames(obj.drops, itemDefs);
  }

  // Prepend fixed interactables (always present, condition-gated)
  const fixedObjects: WorldObject[] = [];
  for (const fixed of room.fixedInteractables ?? []) {
    if (fixed.condition && !evaluateCondition(fixed.condition, ctx)) continue;
    const def = bundle.interactables.find((d) => d.id === fixed.interactableId);
    if (!def) continue;
    const integrity = def.effectiveHealth.min;
    fixedObjects.push({
      id: `fixed_${def.id}_${roomId}`,
      name: def.name,
      tag: def.activityTag,
      allowedAbilityTags: def.allowedAbilityTags ?? [],
      requiredLevel: def.requiredLevel,
      maxIntegrity: integrity,
      integrity,
      barColor: def.barColor,
      accentColor: def.accentColor,
      meterLabel: def.meterLabel,
      drops: [],
      interactableId: def.id,
      xpRewards: def.xpRewards,
    });
  }

  // Fixed interactables are always present; random spawn table is capped to slotCount
  const slotCount = room.slotCount || world.defaultSlotCount || 5;
  const capped = [...fixedObjects, ...objects.slice(0, slotCount)];

  // If forceStarter and we got objects, keep fixed + first spawn
  if (forceStarter) {
    const firstSpawn = objects[0];
    return firstSpawn ? [...fixedObjects, firstSpawn] : fixedObjects;
  }

  return capped;
}

// ── Resolve completed action ──

function resolveCompletedAction(state: GameState): GameState {
  if (!state.action) return state;

  const usedSkill = state.skills.find((entry) => entry.id === state.action?.skillId);
  const targetObject = state.objects.find((entry) => entry.id === state.action?.objectId);
  if (!usedSkill || !targetObject) return { ...state, action: null };

  // Find the linked passive for success chance
  const linkedPassive = usedSkill.linkedPassiveId
    ? getSkill(state.skills, usedSkill.linkedPassiveId)
    : null;
  const passiveLevel = linkedPassive?.level ?? 1;
  const successChance = getSuccessChance(passiveLevel, targetObject.requiredLevel);
  const didSucceed = Math.random() * 100 < successChance;

  const gear = getEquipmentStats(state);
  const baseImpact = getActivityProgressValue(usedSkill, gear);
  const chopBonus = usedSkill.abilityTags.includes("chop") && isChopBuffActive(state) ? 2 : 0;
  const impact = didSucceed ? baseImpact + chopBonus : 0;
  const remainingIntegrity = Math.max(0, targetObject.integrity - impact);
  const updatedObjects = state.objects.map((entry) =>
    entry.id === targetObject.id ? { ...entry, integrity: remainingIntegrity } : entry
  );

  let updatedSkills = state.skills;
  let updatedLog = state.log;
  let updatedFloatTexts = state.floatTexts;
  let nextSuccessfulUpwardHits = state.successfulUpwardHits;
  let nextDownwardBonusReady = state.downwardBonusReady;
  let nextSidePrepUpwardStreak = state.sidePrepUpwardStreak;
  let nextSidePrepDownwardHit = state.sidePrepDownwardHit;
  let nextChopBuffUntil = state.chopBuffUntil;
  let nextUnlockCues = state.unlockCues;
  let nextPlayerStorage = state.playerStorage;

  // Downward bonus expiry logic (legacy mechanic for existing content)
  const missedDownwardBonusWindow = state.downwardBonusReady && usedSkill.id !== "downward_chop";
  if (missedDownwardBonusWindow) {
    nextDownwardBonusReady = false;
    nextSuccessfulUpwardHits = 0;
    updatedLog = appendLog(updatedLog, "Downward Chop bonus expired.");
    updatedFloatTexts = pushFloatingText(updatedFloatTexts, "DOWNWARD BONUS LOST", state.now, {
      durationMs: 1300,
      zone: "skills",
      skillId: "downward_chop",
    });
  }

  if (didSucceed && impact > 0) {
    updatedFloatTexts = pushFloatingText(
      updatedFloatTexts,
      `-${impact}`,
      state.now,
      remainingIntegrity <= 0
        ? { durationMs: 1000, zone: "objects" }
        : { durationMs: 1000, zone: "objects", objectId: targetObject.id }
    );
  }

  if (didSucceed) {
    // Award XP — data-driven via xpRewards, fallback to legacy behavior
    const xpRewards = targetObject.xpRewards ?? [];
    if (xpRewards.length > 0) {
      for (const reward of xpRewards) {
        const xpResult = awardSkillXp(updatedSkills, reward.skillId, reward.amount);
        updatedSkills = xpResult.skills;
        const rewardSkillName = updatedSkills.find((s) => s.id === reward.skillId)?.name ?? reward.skillId;
        updatedFloatTexts = pushFloatingText(
          updatedFloatTexts,
          `+${reward.amount} ${rewardSkillName} XP`,
          state.now,
          { zone: "skills", skillId: reward.skillId }
        );
        if (xpResult.levelUps > 0) {
          updatedLog = appendLog(updatedLog, `${rewardSkillName} reached Lv ${xpResult.newLevel}.`);
        }
      }
    } else {
      // Fallback: give XP to the used skill + its linked passive
      const primaryXpGain = 2;
      const primaryXp = awardSkillXp(updatedSkills, usedSkill.id, primaryXpGain);
      updatedSkills = primaryXp.skills;
      updatedFloatTexts = pushFloatingText(
        updatedFloatTexts,
        `+${primaryXpGain} ${usedSkill.name} XP`,
        state.now,
        { zone: "skills", skillId: usedSkill.id }
      );
      if (primaryXp.levelUps > 0) {
        updatedLog = appendLog(updatedLog, `${usedSkill.name} reached Lv ${primaryXp.newLevel}.`);
      }

      if (usedSkill.linkedPassiveId) {
        const passiveXpGain = 3;
        const passiveXp = awardSkillXp(updatedSkills, usedSkill.linkedPassiveId, passiveXpGain);
        updatedSkills = passiveXp.skills;
        const passiveName = updatedSkills.find((entry) => entry.id === usedSkill.linkedPassiveId)?.name;
        if (passiveName) {
          updatedFloatTexts = pushFloatingText(
            updatedFloatTexts,
            `+${passiveXpGain} ${passiveName} XP`,
            state.now,
            { zone: "skills", skillId: usedSkill.linkedPassiveId }
          );
        }
        if (passiveXp.levelUps > 0 && passiveName) {
          updatedLog = appendLog(updatedLog, `${passiveName} reached Lv ${passiveXp.newLevel}.`);
        }
      }
    }

    // Check skill unlocks via DSL conditions (data-driven)
    const ctx = buildEvalContext({ ...state, skills: updatedSkills });
    const newlyUnlocked = checkSkillUnlocks(updatedSkills, ctx);
    for (const skillId of newlyUnlocked) {
      updatedSkills = updatedSkills.map((skill) =>
        skill.id === skillId ? { ...skill, unlocked: true } : skill
      );
      nextUnlockCues = addUnlockCue(nextUnlockCues, skillId, state.now);
      const unlockName = updatedSkills.find((s) => s.id === skillId)?.name ?? skillId;
      updatedLog = appendLog(updatedLog, `Learned ${unlockName}.`);
      updatedFloatTexts = pushFloatingText(
        updatedFloatTexts,
        `NEW SKILL: ${unlockName.toUpperCase()}`,
        state.now,
        { durationMs: 2000, zone: "skills", skillId }
      );
      updatedFloatTexts = pushFloatingText(
        updatedFloatTexts,
        `NEW ABILITY LEARNED: ${unlockName.toUpperCase()}`,
        state.now,
        { durationMs: 2200, zone: "skills" }
      );
    }

    // Legacy bonus mechanics (keep for existing content compatibility)
    const downwardSkill = getSkill(updatedSkills, "downward_chop");
    const downwardUnlockedNow = downwardSkill?.unlocked ?? false;
    if (usedSkill.id === "upward_chop") {
      if (!nextDownwardBonusReady && downwardUnlockedNow && !missedDownwardBonusWindow) {
        if (!newlyUnlocked.includes("downward_chop")) {
          nextSuccessfulUpwardHits = Math.min(3, nextSuccessfulUpwardHits + 1);
        }
        if (nextSuccessfulUpwardHits >= 3) {
          nextDownwardBonusReady = true;
          nextSuccessfulUpwardHits = 0;
          updatedLog = appendLog(updatedLog, "Downward Chop bonus ready.");
          updatedFloatTexts = pushFloatingText(updatedFloatTexts, "DOWNWARD BONUS READY", state.now, {
            durationMs: 1800,
            zone: "skills",
            skillId: "downward_chop",
          });
        }
      } else if (!nextDownwardBonusReady) {
        nextSuccessfulUpwardHits = 0;
      }
      nextSidePrepUpwardStreak = Math.min(2, nextSidePrepUpwardStreak + 1);
    } else if (usedSkill.id === "downward_chop") {
      nextSuccessfulUpwardHits = 0;
      nextSidePrepDownwardHit = true;
      if (nextSidePrepUpwardStreak < 2) {
        nextSidePrepUpwardStreak = 0;
      }
    } else {
      nextSuccessfulUpwardHits = 0;
      nextSidePrepUpwardStreak = 0;
    }

    // Side chop buff (only fires if side_chop skill exists in content)
    if (usedSkill.id === "side_chop") {
      nextChopBuffUntil = state.now + 10000;
      nextSidePrepUpwardStreak = 0;
      nextSidePrepDownwardHit = false;
      updatedLog = appendLog(updatedLog, "Side Chop activated. Chop abilities gain +2 for 10s.");
      updatedFloatTexts = pushFloatingText(updatedFloatTexts, "CHOP +2 (10s)", state.now, {
        durationMs: 2000,
        zone: "skills",
        skillId: "side_chop",
      });
    }
  } else {
    updatedLog = appendLog(
      updatedLog,
      `${usedSkill.name} missed ${targetObject.name} (${successChance}% success chance).`
    );
    updatedFloatTexts = pushFloatingText(updatedFloatTexts, "MISS", state.now, {
      durationMs: 1000,
      zone: "objects",
      objectId: targetObject.id,
    });
    nextSuccessfulUpwardHits = 0;
    nextSidePrepUpwardStreak = 0;
  }

  let updatedInventory = state.inventory;
  let resolvedObjects = updatedObjects;
  let nextSelectedObjectId = state.selectedObjectId;
  let nextAutoSkillId = state.autoSkillId;
  let nextEnergy = state.energy;

  // Downward bonus energy restore (legacy mechanic)
  if (usedSkill.id === "downward_chop" && nextDownwardBonusReady) {
    const restoredEnergy = 25;
    nextEnergy = Math.min(state.maxEnergy, state.energy + restoredEnergy);
    nextDownwardBonusReady = false;
    nextSuccessfulUpwardHits = 0;
    if (nextAutoSkillId === "downward_chop") {
      nextAutoSkillId = null;
    }
    updatedLog = appendLog(updatedLog, `Downward Chop bonus consumed. Restored ${restoredEnergy} ⚡.`);
    updatedFloatTexts = pushFloatingText(updatedFloatTexts, `+${restoredEnergy} ⚡`, state.now, {
      zone: "skills",
      skillId: "downward_chop",
    });
  }

  if (didSucceed && remainingIntegrity <= 0) {
    updatedInventory = mergeDrops(updatedInventory, targetObject.drops);
    resolvedObjects = updatedObjects.filter((entry) => entry.id !== targetObject.id);
    for (const drop of targetObject.drops) {
      updatedFloatTexts = pushFloatingText(updatedFloatTexts, `+${drop.qty} ${drop.name}`, state.now, {
        zone: "objects",
      });
    }

    const dropText = targetObject.drops.map((drop) => `${drop.qty} ${drop.name}`).join(", ");
    updatedLog = appendLog(updatedLog, `${targetObject.name} completed. Loot: ${dropText}.`);

    // Process onDestroy storage effects
    if (targetObject.interactableId) {
      const bundle = getBundle();
      const interDef = bundle?.interactables.find((i) => i.id === targetObject.interactableId);
      if (interDef?.onDestroyEffects) {
        for (const effect of interDef.onDestroyEffects) {
          nextPlayerStorage = applyStorageEffect(nextPlayerStorage, effect);
        }
      }
    }

    if (targetObject.id === state.selectedObjectId) {
      nextSelectedObjectId = null;
      nextAutoSkillId = null;
      updatedLog = appendLog(updatedLog, "Target destroyed. Auto-cast stopped.");
    }
  } else if (didSucceed) {
    updatedLog = appendLog(updatedLog, `${usedSkill.name} dealt ${impact} to ${targetObject.name}.`);

    // Process onInteract storage effects
    if (targetObject.interactableId) {
      const bundle = getBundle();
      const interDef = bundle?.interactables.find((i) => i.id === targetObject.interactableId);
      if (interDef?.onInteractEffects) {
        for (const effect of interDef.onInteractEffects) {
          nextPlayerStorage = applyStorageEffect(nextPlayerStorage, effect);
        }
      }
    }
  }

  return {
    ...state,
    skills: updatedSkills,
    inventory: updatedInventory,
    objects: resolvedObjects,
    selectedObjectId: nextSelectedObjectId,
    autoSkillId: nextAutoSkillId,
    energy: nextEnergy,
    successfulUpwardHits: nextSuccessfulUpwardHits,
    downwardBonusReady: nextDownwardBonusReady,
    sidePrepUpwardStreak: nextSidePrepUpwardStreak,
    sidePrepDownwardHit: nextSidePrepDownwardHit,
    chopBuffUntil: nextChopBuffUntil,
    playerStorage: nextPlayerStorage,
    action: null,
    lastAction: {
      skillId: usedSkill.id,
      objectId: targetObject.id,
      tag: targetObject.tag,
      at: state.now,
    },
    log: updatedLog,
    floatTexts: updatedFloatTexts,
    unlockCues: nextUnlockCues,
  };
}

// ── Create initial state from loaded bundle ──

function createInitialState(): GameState {
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

  // Auto-equip items that have slots
  const equipment: Record<EquipmentSlot, string | null> = { weapon: null, armor: null, accessory: null };
  for (const item of inventory) {
    if (item.slot && !equipment[item.slot]) {
      equipment[item.slot] = item.id;
    }
  }

  const seed = 9103;

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
    energy: 100,
    maxEnergy: 100,
    baseEnergyRegen: 3,
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
    objectBatchStartedAt: now - 10000,
    openWindow: null,
    placedObjects: [],
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

// ── Reducer ──

function reducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "EXPLORE": {
      if (state.action) {
        return {
          ...state,
          log: appendLog(state.log, "Finish the current cast before exploring."),
        };
      }

      if (state.exploreAction) return state;

      // Check for seed overrides from the current room
      const bundle = getBundle();
      const room = bundle?.world.rooms.find((r) => r.id === state.currentRoomId);
      let nextSeed: number;

      if (room?.seedOverrides && room.seedOverrides.length > 0) {
        const ctx = buildEvalContext(state);
        const sorted = [...room.seedOverrides].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
        let overrideSeed: number | null = null;
        for (const override of sorted) {
          if (evaluateCondition(override.condition, ctx)) {
            if (typeof override.seed === "number") {
              overrideSeed = override.seed;
            } else {
              const val = state.playerStorage[override.seed];
              overrideSeed = typeof val === "number" ? val : state.seed + 7919;
            }
            break;
          }
        }
        nextSeed = overrideSeed ?? state.seed + 7919;
      } else {
        nextSeed = state.seed + 7919;
      }

      return {
        ...state,
        exploreAction: {
          seed: nextSeed,
          startedAt: state.now,
          endsAt: state.now + 2000,
        },
        log: appendLog(state.log, "Exploring..."),
      };
    }

    case "SELECT_OBJECT": {
      let nextState: GameState = {
        ...state,
        selectedObjectId: action.objectId,
      };

      if (nextState.autoSkillId && !nextState.action) {
        const plan = makeActionPlan(nextState, nextState.autoSkillId, state.now);
        if (plan) {
          nextState = {
            ...nextState,
            action: plan.action,
            energy: plan.nextEnergy,
          };
        }
      }

      return nextState;
    }

    case "SET_AUTO_SKILL": {
      if (state.autoSkillId === action.skillId) {
        return {
          ...state,
          autoSkillId: null,
          action: null,
          log: appendLog(state.log, "Auto-cast stopped."),
        };
      }

      const skill = state.skills.find((entry) => entry.id === action.skillId && entry.kind === "active");
      if (!skill) return state;

      if (!skill.unlocked) {
        const lockMessage = `${skill.name} is locked. ${skill.description}`;
        return {
          ...state,
          log: appendLog(state.log, lockMessage),
        };
      }

      if (skill.id === "side_chop" && !isSideChopReady(state)) {
        return {
          ...state,
          log: appendLog(
            state.log,
            "Side Chop requires 2 successful consecutive Upward Chops and 1 successful Downward Chop."
          ),
        };
      }

      let nextState: GameState = {
        ...state,
        autoSkillId: action.skillId,
        log: appendLog(state.log, `Auto-cast set: ${skill.name}.`),
      };

      if (state.action && state.action.skillId !== action.skillId) {
        const canceledSkillName =
          state.skills.find((entry) => entry.id === state.action?.skillId)?.name ?? "Current Ability";
        nextState = {
          ...nextState,
          action: null,
          energy: Math.min(state.maxEnergy, state.energy + state.action.energyCost),
          log: appendLog(nextState.log, `${canceledSkillName} canceled.`),
        };
      }

      const plan = makeActionPlan(nextState, action.skillId, state.now);
      if (plan) {
        nextState = {
          ...nextState,
          action: plan.action,
          energy: plan.nextEnergy,
        };
      }

      return nextState;
    }

    case "TOGGLE_WINDOW": {
      return {
        ...state,
        openWindow: state.openWindow === action.window ? null : action.window,
      };
    }

    case "EQUIP_ITEM": {
      const item = state.inventory.find((entry) => entry.id === action.itemId);
      if (!item?.slot) return state;

      return {
        ...state,
        equipment: {
          ...state.equipment,
          [item.slot]: item.id,
        },
        log: appendLog(state.log, `${item.name} equipped in ${item.slot}.`),
      };
    }

    case "UNEQUIP_SLOT": {
      if (!state.equipment[action.slot]) return state;

      return {
        ...state,
        equipment: {
          ...state.equipment,
          [action.slot]: null,
        },
        log: appendLog(state.log, `${action.slot} slot is now empty.`),
      };
    }

    case "CRAFT_ITEM": {
      const bundle = getBundle();
      if (!bundle) return state;

      const recipe = (bundle.recipes ?? []).find((r) => r.id === action.recipeId);
      if (!recipe) return state;

      const ctx = buildEvalContext(state);
      const available = getAvailableRecipes(bundle.recipes ?? [], state.inventory, ctx, undefined);
      if (!available.find((r) => r.id === action.recipeId)) {
        return { ...state, log: appendLog(state.log, "Cannot craft: missing ingredients or conditions not met.") };
      }

      // Consume ingredients
      let nextInventory = [...state.inventory];
      for (const ing of recipe.ingredients) {
        const idx = nextInventory.findIndex((i) => i.id === ing.itemId);
        if (idx === -1) return state;
        const held = nextInventory[idx];
        if (held.qty <= ing.qty) {
          nextInventory = nextInventory.filter((_, i) => i !== idx);
        } else {
          nextInventory = nextInventory.map((item, i) =>
            i === idx ? { ...item, qty: item.qty - ing.qty } : item
          );
        }
      }

      // Add output
      const outputDef = bundle.items.find((i) => i.id === recipe.outputItemId);
      if (!outputDef) return state;

      const existingIdx = nextInventory.findIndex((i) => i.id === recipe.outputItemId);
      if (existingIdx !== -1) {
        nextInventory = nextInventory.map((item, i) =>
          i === existingIdx ? { ...item, qty: item.qty + recipe.outputQty } : item
        );
      } else {
        nextInventory = [
          ...nextInventory,
          {
            id: outputDef.id,
            name: outputDef.name,
            qty: recipe.outputQty,
            slot: outputDef.slot,
            attack: outputDef.stats.attack,
            defense: outputDef.stats.defense,
            energyRegen: outputDef.stats.energyRegen,
            activityPowerMultiplier: outputDef.stats.activityPowerMultiplier,
            speedMultiplier: outputDef.stats.speedMultiplier,
            energyCostMultiplier: outputDef.stats.energyCostMultiplier,
          },
        ];
      }

      return {
        ...state,
        inventory: nextInventory,
        log: appendLog(state.log, `Crafted ${recipe.outputQty}x ${outputDef.name}.`),
      };
    }

    case "PLACE_ITEM": {
      const bundle = getBundle();
      if (!bundle) return state;

      const itemDef = bundle.items.find((i) => i.id === action.itemId);
      if (!itemDef?.placeable) return state;

      // Consume 1 from inventory
      const idx = state.inventory.findIndex((i) => i.id === action.itemId);
      if (idx === -1) return state;

      const held = state.inventory[idx];
      let nextInventory: InventoryItem[];
      if (held.qty <= 1) {
        nextInventory = state.inventory.filter((_, i) => i !== idx);
      } else {
        nextInventory = state.inventory.map((item, i) =>
          i === idx ? { ...item, qty: item.qty - 1 } : item
        );
      }

      const newPlaced: PlacedObject = {
        instanceId: `placed_${action.itemId}_${state.now}`,
        itemId: action.itemId,
        itemName: itemDef.name,
        roomId: state.currentRoomId,
      };

      return {
        ...state,
        inventory: nextInventory,
        placedObjects: [...state.placedObjects, newPlaced],
        log: appendLog(state.log, `Placed ${itemDef.name} in ${state.currentRoomId}.`),
      };
    }

    case "REMOVE_PLACED_ITEM": {
      const bundle = getBundle();
      const placed = state.placedObjects.find((p) => p.instanceId === action.instanceId);
      if (!placed) return state;

      // Return item to inventory
      const existingIdx = state.inventory.findIndex((i) => i.id === placed.itemId);
      let nextInventory: InventoryItem[];
      if (existingIdx !== -1) {
        nextInventory = state.inventory.map((item, i) =>
          i === existingIdx ? { ...item, qty: item.qty + 1 } : item
        );
      } else {
        const itemDef = bundle?.items.find((i) => i.id === placed.itemId);
        nextInventory = [
          ...state.inventory,
          {
            id: placed.itemId,
            name: placed.itemName,
            qty: 1,
            slot: itemDef?.slot,
            attack: itemDef?.stats.attack,
            defense: itemDef?.stats.defense,
            energyRegen: itemDef?.stats.energyRegen,
            activityPowerMultiplier: itemDef?.stats.activityPowerMultiplier,
            speedMultiplier: itemDef?.stats.speedMultiplier,
            energyCostMultiplier: itemDef?.stats.energyCostMultiplier,
          },
        ];
      }

      return {
        ...state,
        inventory: nextInventory,
        placedObjects: state.placedObjects.filter((p) => p.instanceId !== action.instanceId),
        log: appendLog(state.log, `Picked up ${placed.itemName}.`),
      };
    }

    case "TRAVEL": {
      if (state.action) {
        return { ...state, log: appendLog(state.log, "Finish the current action before travelling.") };
      }

      const bundle = getBundle();
      const targetRoom = bundle?.world.rooms.find((r) => r.id === action.roomId);
      if (!targetRoom) return state;

      // Check entry condition
      if (targetRoom.entryCondition) {
        const ctx = buildEvalContext(state);
        if (!evaluateCondition(targetRoom.entryCondition, ctx)) {
          return { ...state, log: appendLog(state.log, `Cannot enter ${targetRoom.name}.`) };
        }
      }

      const nextObjects = generateObjectsForRoom(action.roomId, state.seed, { ...state, currentRoomId: action.roomId });

      return {
        ...state,
        currentRoomId: action.roomId,
        objects: nextObjects,
        selectedObjectId: nextObjects[0]?.id ?? null,
        action: null,
        exploreAction: null,
        autoSkillId: null,
        objectBatchStartedAt: state.now,
        log: appendLog(state.log, `Travelled to ${targetRoom.name}.`),
      };
    }

    case "TICK": {
      const now = action.now;
      const deltaSeconds = Math.max(0, (now - state.lastTickAt) / 1000);
      const gear = getEquipmentStats(state);

      let nextState: GameState = {
        ...state,
        now,
        lastTickAt: now,
        energy: Math.min(state.maxEnergy, state.energy + (state.baseEnergyRegen + gear.energyRegen) * deltaSeconds),
        floatTexts: state.floatTexts.filter((entry) => now - entry.createdAt <= entry.durationMs),
        unlockCues: state.unlockCues.filter((entry) => entry.expiresAt > now),
      };

      if (nextState.exploreAction) {
        if (now < nextState.exploreAction.endsAt) {
          return nextState;
        }

        const nextObjects = generateObjectsForRoom(
          nextState.currentRoomId,
          nextState.exploreAction.seed,
          nextState
        );
        const nextExploreCount = nextState.exploreCount + 1;
        nextState = {
          ...nextState,
          seed: nextState.exploreAction.seed,
          exploreCount: nextExploreCount,
          objects: nextObjects,
          selectedObjectId: nextObjects[0]?.id ?? null,
          exploreAction: null,
          objectBatchStartedAt: now,
          log: appendLog(nextState.log, `Exploration #${nextExploreCount} generated ${nextObjects.length} objects.`),
        };
      }

      if (nextState.action && now >= nextState.action.endsAt) {
        nextState = resolveCompletedAction(nextState);
      }

      if (!nextState.action && nextState.autoSkillId) {
        const selectedExists = nextState.objects.some((entry) => entry.id === nextState.selectedObjectId);
        if (!selectedExists) {
          nextState = {
            ...nextState,
            selectedObjectId: null,
            autoSkillId: null,
          };
          return nextState;
        }

        const plan = makeActionPlan(nextState, nextState.autoSkillId, now);
        if (plan) {
          nextState = {
            ...nextState,
            action: plan.action,
            energy: plan.nextEnergy,
          };
        }
      }

      return nextState;
    }

    default:
      return state;
  }
}

// ── UI Components ──

interface MeterRowProps {
  name: string;
  level: number;
  value: number;
  max: number;
  color: string;
  accent: string;
  details?: string;
  muted?: boolean;
  selected?: boolean;
  auto?: boolean;
  badge?: string;
  floatingLabels?: string[];
  abilityTooltip?: string;
  isHitShaking?: boolean;
  unlockFadeIn?: boolean;
  showAccent?: boolean;
  accentProgressPct?: number;
  variant?: "active" | "passive" | "object";
  onClick?: () => void;
}

function MeterRow({
  name,
  level,
  value,
  max,
  color,
  accent,
  details,
  muted,
  selected,
  auto,
  badge,
  floatingLabels,
  abilityTooltip,
  isHitShaking,
  unlockFadeIn,
  showAccent = true,
  accentProgressPct = 100,
  variant = "active",
  onClick,
}: MeterRowProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const accentPct = Math.max(0, Math.min(100, accentProgressPct));
  const isInteractive = Boolean(onClick);

  return (
    <button
      type="button"
      className={`meter-row meter-row-${variant} ${muted ? "is-muted" : ""} ${selected ? "is-selected" : ""} ${auto ? "is-auto" : ""} ${isHitShaking ? "is-hit-shaking" : ""} ${unlockFadeIn ? "is-unlock-in" : ""} ${!isInteractive ? "is-static" : ""}`}
      onClick={onClick}
      title={abilityTooltip}
      aria-label={abilityTooltip}
    >
      <div className="meter-headline">
        <span>{name}</span>
        {badge ? <span className="combo-badge">{badge}</span> : null}
      </div>
      {floatingLabels && floatingLabels.length > 0 ? (
        <div className="meter-inline-floats">
          {floatingLabels.map((entry, index) => (
            <div key={`${entry}_${index}`} className="meter-inline-float">
              {entry}
            </div>
          ))}
        </div>
      ) : null}
      <div className="meter-main">
        <div className="meter-frame">
          <div className="meter-track">
            <div className="meter-fill" style={{ width: `${pct}%`, background: color }} />
            {showAccent ? (
              <div className="meter-accent">
                <div className="meter-accent-fill" style={{ width: `${accentPct}%`, background: accent }} />
              </div>
            ) : null}
            <div className="meter-content">
              <span className="meter-level">{level}</span>
              <span className="meter-values">
                {Math.floor(value)}/{Math.floor(max)}
              </span>
              {details ? <span className="meter-details">{details}</span> : null}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

// ── Game App (renders after content is loaded) ──

function GameApp() {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);

  useEffect(() => {
    const timer = window.setInterval(() => {
      dispatch({ type: "TICK", now: Date.now() });
    }, 100);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  // Get room name from bundle
  const roomName = useMemo(() => {
    const bundle = getBundle();
    return bundle?.world.rooms.find((r) => r.id === state.currentRoomId)?.name ?? "Unknown Location";
  }, [state.currentRoomId]);

  const roomExits = useMemo(() => {
    const bundle = getBundle();
    const room = bundle?.world.rooms.find((r) => r.id === state.currentRoomId);
    if (!room?.specialConnections?.length) return [];
    const ctx = buildEvalContext(state);
    return room.specialConnections.filter((c) => !c.condition || evaluateCondition(c.condition, ctx));
  }, [state.currentRoomId, state.playerStorage, state.skills]);

  const selectedObject = useMemo(
    () => state.objects.find((entry) => entry.id === state.selectedObjectId) ?? null,
    [state.objects, state.selectedObjectId]
  );

  const passiveSkills = useMemo(
    () => state.skills.filter((entry) => entry.kind === "passive"),
    [state.skills]
  );

  const activeSkills = useMemo(
    () => state.skills.filter((entry) => entry.kind === "active" && entry.unlocked),
    [state.skills]
  );

  const unlockFadeSet = useMemo(
    () => new Set(state.unlockCues.filter((entry) => entry.expiresAt > state.now).map((entry) => entry.skillId)),
    [state.unlockCues, state.now]
  );

  const equipmentStats = useMemo(() => getEquipmentStats(state), [state]);

  const availableRecipes = useMemo(() => {
    const bundle = getBundle();
    if (!bundle) return [] as RecipeDef[];
    const ctx = buildEvalContext(state);
    return getAvailableRecipes(bundle.recipes ?? [], state.inventory, ctx, undefined);
  }, [state.inventory, state.playerStorage, state.skills, state.currentRoomId]);

  const roomPlacedObjects = useMemo(
    () => state.placedObjects.filter((p) => p.roomId === state.currentRoomId),
    [state.placedObjects, state.currentRoomId]
  );

  const placeableInventoryItems = useMemo(() => {
    const bundle = getBundle();
    if (!bundle) return [] as InventoryItem[];
    return state.inventory.filter((item) => bundle.items.find((d) => d.id === item.id)?.placeable);
  }, [state.inventory]);

  const actionProgress = state.action
    ? Math.max(0, Math.min(100, ((state.now - state.action.startedAt) / state.action.durationMs) * 100))
    : 0;
  const isExploring = Boolean(state.exploreAction);
  const exploreProgress = state.exploreAction
    ? Math.max(
        0,
        Math.min(100, ((state.now - state.exploreAction.startedAt) / (state.exploreAction.endsAt - state.exploreAction.startedAt)) * 100)
      )
    : 0;

  const skillFloatMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const entry of state.floatTexts) {
      if (entry.zone !== "skills" || !entry.skillId) continue;
      const existing = map.get(entry.skillId) ?? [];
      existing.push(entry.text);
      map.set(entry.skillId, existing);
    }
    return map;
  }, [state.floatTexts]);

  const objectFloatMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const entry of state.floatTexts) {
      if (entry.zone !== "objects" || !entry.objectId) continue;
      const existing = map.get(entry.objectId) ?? [];
      existing.push(entry.text);
      map.set(entry.objectId, existing);
    }
    return map;
  }, [state.floatTexts]);

  const skillAreaFloatTexts = useMemo(
    () => state.floatTexts.filter((entry) => entry.zone === "skills" && !entry.skillId).map((entry) => entry.text),
    [state.floatTexts]
  );

  const objectAreaFloatTexts = useMemo(
    () => state.floatTexts.filter((entry) => entry.zone === "objects" && !entry.objectId).map((entry) => entry.text),
    [state.floatTexts]
  );

  const timedStatusBadges = useMemo(() => {
    const badges: Array<{
      id: string;
      type: "buff" | "debuff";
      label: string;
      seconds: number;
    }> = [];

    const chopBuffRemainingMs = state.chopBuffUntil - state.now;
    if (chopBuffRemainingMs > 0) {
      badges.push({
        id: "chop_buff",
        type: "buff",
        label: "Chop +2",
        seconds: Math.ceil(chopBuffRemainingMs / 1000),
      });
    }

    return badges;
  }, [state.chopBuffUntil, state.now]);

  return (
    <div className="app-shell">
      <header className="hud animate-in">
        <div className="hud-block">
          <p className="eyebrow">Location</p>
          <h1>{roomName}</h1>
          <p className="seed-line">
            Seed <strong>{state.seed}</strong> | Explore #{state.exploreCount}
          </p>
          {roomExits.length > 0 && (
            <div className="exits-strip">
              {roomExits.map((exit) => (
                <button
                  key={exit.targetRoomId}
                  type="button"
                  className="exit-button"
                  onClick={() => dispatch({ type: "TRAVEL", roomId: exit.targetRoomId })}
                >
                  {exit.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="hud-block hud-energy">
          <p className="eyebrow">Player Energy</p>
          <div className="energy-track">
            <div
              className="energy-fill"
              style={{ width: `${Math.max(0, Math.min(100, (state.energy / state.maxEnergy) * 100))}%` }}
            />
          </div>
          <p className="seed-line">
            {Math.floor(state.energy)}/{state.maxEnergy} (+
            {(state.baseEnergyRegen + equipmentStats.energyRegen).toFixed(1)} / sec)
          </p>
          <div className="status-strip">
            {timedStatusBadges.length > 0 ? (
              timedStatusBadges.map((status) => (
                <div
                  key={status.id}
                  className={`status-pill ${status.type === "buff" ? "is-buff" : "is-debuff"}`}
                  title={`${status.label} (${status.seconds}s)`}
                >
                  <span className="status-arrow">{status.type === "buff" ? "^" : "v"}</span>
                  <span className="status-timer">{status.seconds}s</span>
                </div>
              ))
            ) : (
              <div className="status-pill is-empty" title="No active effects">
                <span className="status-arrow">.</span>
                <span className="status-timer">--</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <section className="window-controls">
        <button
          type="button"
          className={`window-toggle ${state.openWindow === "inventory" ? "is-open" : ""}`}
          onClick={() => dispatch({ type: "TOGGLE_WINDOW", window: "inventory" })}
        >
          Inventory
        </button>
        <button
          type="button"
          className={`window-toggle ${state.openWindow === "equipment" ? "is-open" : ""}`}
          onClick={() => dispatch({ type: "TOGGLE_WINDOW", window: "equipment" })}
        >
          Equipment
        </button>
        <button
          type="button"
          className={`window-toggle ${state.openWindow === "crafting" ? "is-open" : ""}`}
          onClick={() => dispatch({ type: "TOGGLE_WINDOW", window: "crafting" })}
        >
          Crafting
        </button>
        <button
          type="button"
          className={`window-toggle ${state.openWindow === "log" ? "is-open" : ""}`}
          onClick={() => dispatch({ type: "TOGGLE_WINDOW", window: "log" })}
        >
          Log
        </button>
      </section>

      {state.openWindow ? (
        <section className="panel window-panel">
          {state.openWindow === "inventory" ? (
            <>
              <p className="panel-title">Inventory</p>
              {state.inventory.length === 0 ? (
                <p className="empty-text">Inventory is empty.</p>
              ) : (
                <ul className="inventory-list">
                  {state.inventory.map((item) => {
                    const equippedInSlot = item.slot ? state.equipment[item.slot] === item.id : false;
                    return (
                      <li key={item.id} className="inventory-row">
                        <span>
                          {item.name} x{item.qty}
                        </span>
                        {item.slot ? (
                          <button
                            type="button"
                            className={`equip-button ${equippedInSlot ? "is-equipped" : ""}`}
                            onClick={() => dispatch({ type: "EQUIP_ITEM", itemId: item.id })}
                          >
                            {equippedInSlot ? "Equipped" : `Equip ${item.slot}`}
                          </button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          ) : null}

          {state.openWindow === "equipment" ? (
            <>
              <p className="panel-title">Equipment</p>
              <div className="equipment-slots">
                {(Object.keys(state.equipment) as EquipmentSlot[]).map((slot) => {
                  const itemId = state.equipment[slot];
                  const itemName = itemId ? state.inventory.find((item) => item.id === itemId)?.name ?? "Unknown" : "Empty";

                  return (
                    <div key={slot} className="equipment-row">
                      <span>{slot}</span>
                      <div className="equipment-row-right">
                        <span>{itemName}</span>
                        {itemId ? (
                          <button type="button" className="unequip-button" onClick={() => dispatch({ type: "UNEQUIP_SLOT", slot })}>
                            Clear
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="stats-readout">
                <p>Attack: {equipmentStats.attack}</p>
                <p>Defense: {equipmentStats.defense}</p>
                <p>Energy Regen Bonus: +{equipmentStats.energyRegen.toFixed(1)}</p>
                <p>Action Speed Multiplier: x{equipmentStats.speedMultiplier.toFixed(2)}</p>
              </div>
            </>
          ) : null}

          {state.openWindow === "crafting" ? (
            <>
              <p className="panel-title">Crafting</p>
              {availableRecipes.length === 0 ? (
                <p className="empty-text">No recipes available. Gather materials to unlock crafting.</p>
              ) : (
                <ul className="inventory-list">
                  {availableRecipes.map((recipe) => {
                    const bundle = getBundle();
                    const outputName = bundle?.items.find((i) => i.id === recipe.outputItemId)?.name ?? recipe.outputItemId;
                    const ingredientText = recipe.ingredients
                      .map((ing) => {
                        const iName = bundle?.items.find((i) => i.id === ing.itemId)?.name ?? ing.itemId;
                        return `${ing.qty}x ${iName}`;
                      })
                      .join(", ");
                    return (
                      <li key={recipe.id} className="inventory-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                          <span style={{ fontWeight: 600 }}>{recipe.name || outputName} → {recipe.outputQty}x {outputName}</span>
                          <button
                            type="button"
                            className="equip-button"
                            onClick={() => dispatch({ type: "CRAFT_ITEM", recipeId: recipe.id })}
                          >
                            Craft
                          </button>
                        </div>
                        {ingredientText ? (
                          <span style={{ fontSize: 12, color: "var(--text-muted, #888)" }}>{ingredientText}</span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
              {placeableInventoryItems.length > 0 && (
                <>
                  <p className="panel-title" style={{ marginTop: 16 }}>Place Items</p>
                  <ul className="inventory-list">
                    {placeableInventoryItems.map((item) => (
                      <li key={item.id} className="inventory-row">
                        <span>{item.name} x{item.qty}</span>
                        <button
                          type="button"
                          className="equip-button"
                          onClick={() => dispatch({ type: "PLACE_ITEM", itemId: item.id })}
                        >
                          Place
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {roomPlacedObjects.length > 0 && (
                <>
                  <p className="panel-title" style={{ marginTop: 16 }}>Placed Here</p>
                  <ul className="inventory-list">
                    {roomPlacedObjects.map((placed) => (
                      <li key={placed.instanceId} className="inventory-row">
                        <span>{placed.itemName}</span>
                        <button
                          type="button"
                          className="unequip-button"
                          onClick={() => dispatch({ type: "REMOVE_PLACED_ITEM", instanceId: placed.instanceId })}
                        >
                          Pick up
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          ) : null}

          {state.openWindow === "log" ? (
            <>
              <p className="panel-title">Event Log</p>
              <ul className="log-list">
                {state.log.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      ) : null}

      <section className="arena-grid">
        <aside className="panel animate-in delay-1">
          {skillAreaFloatTexts.length > 0 ? (
            <div className="floating-feed floating-feed-skills">
              {skillAreaFloatTexts.map((entry, index) => (
                <div key={`${entry}_${index}`} className="floating-line">
                  {entry}
                </div>
              ))}
            </div>
          ) : null}
          <p className="panel-title">Skills</p>
          <p className="section-title">Passive</p>
          {passiveSkills.map((skill) => (
            <MeterRow
              key={skill.id}
              variant="passive"
              name={skill.name}
              level={skill.level}
              value={skill.xp}
              max={skill.xpToNext}
              color={skill.barColor}
              accent={skill.accentColor}
              details={skill.description}
              floatingLabels={skillFloatMap.get(skill.id)}
              showAccent={false}
            />
          ))}

          <p className="section-title active-block-title">Active</p>
          {activeSkills.map((skill) => {
            const canTarget = selectedObject ? skill.tags.includes(selectedObject.tag) : false;
            const isDownward = skill.id === "downward_chop";
            const isSide = skill.id === "side_chop";
            const sideReady = isSideChopReady(state);
            const activationPct = state.action?.skillId === skill.id ? actionProgress : 0;
            const isAuto = state.autoSkillId === skill.id;
            const sideBuffSeconds = Math.max(0, Math.ceil((state.chopBuffUntil - state.now) / 1000));
            const sideBuffActive = sideBuffSeconds > 0;
            const castSeconds = isDownward && state.downwardBonusReady ? 2 : skill.baseDurationMs / 1000;
            const shortDetails = `${castSeconds.toFixed(1)}s | \u26A1${skill.baseEnergyCost}`;
            let bonusIndicatorTooltip: string | undefined;

            if (isDownward) {
              bonusIndicatorTooltip = state.downwardBonusReady
                ? "Bonus armed: next Downward Chop restores +25 \u26A1 and casts in 2.0s.\nIf your next action is not Downward Chop, this bonus is lost."
                : `Requirement: land 3 consecutive successful Upward Chops.\nCurrent: ${state.successfulUpwardHits}/3.`;
            }

            if (isSide) {
              if (sideBuffActive) {
                bonusIndicatorTooltip = `Active: chop abilities deal +2 damage for ${sideBuffSeconds}s.`;
              } else if (sideReady) {
                bonusIndicatorTooltip = "Ready: Side Chop can trigger the +2 chop damage buff for 10s.";
              } else {
                bonusIndicatorTooltip = `Requirement: 2 consecutive successful Upward Chops and 1 successful Downward Chop.\nCurrent: U ${Math.min(2, state.sidePrepUpwardStreak)}/2, D ${state.sidePrepDownwardHit ? 1 : 0}/1.`;
              }
            }
            const abilityTooltip =
              bonusIndicatorTooltip ??
              "Bonus setup: successful Upward Chops build Downward and Side bonus requirements.";

            return (
              <MeterRow
                key={skill.id}
                variant="active"
                name={skill.name}
                level={skill.level}
                value={skill.xp}
                max={skill.xpToNext}
                color={skill.barColor}
                accent={skill.accentColor}
                details={shortDetails}
                muted={!canTarget && !isAuto}
                auto={isAuto}
                badge={isAuto ? "AUTO" : undefined}
                floatingLabels={skillFloatMap.get(skill.id)}
                abilityTooltip={abilityTooltip}
                unlockFadeIn={unlockFadeSet.has(skill.id)}
                accentProgressPct={activationPct}
                showAccent
                onClick={() => dispatch({ type: "SET_AUTO_SKILL", skillId: skill.id })}
              />
            );
          })}
        </aside>

        <aside className="panel animate-in delay-2">
          {objectAreaFloatTexts.length > 0 ? (
            <div className="floating-feed floating-feed-objects">
              {objectAreaFloatTexts.map((entry, index) => (
                <div key={`${entry}_${index}`} className="floating-line">
                  {entry}
                </div>
              ))}
            </div>
          ) : null}
          <p className="panel-title">Interactables</p>
          <div className="interactables-list">
            {state.objects.length > 0 ? (
              state.objects.map((object, index) => {
                const objectPassiveLevel = getRelevantPassiveLevel(state.skills, object.tag);
                const successChance = getSuccessChance(objectPassiveLevel, object.requiredLevel);
                const justCompletedChopOnObject =
                  state.lastAction?.objectId === object.id &&
                  state.now - state.lastAction.at <= 220 &&
                  Boolean(state.skills.find((entry) => entry.id === state.lastAction?.skillId)?.abilityTags.includes("chop"));
                const revealDelayMs = index * 500;
                const revealDurationMs = 450;
                const shouldReveal = state.now - state.objectBatchStartedAt <= revealDelayMs + revealDurationMs;
                return (
                  <div
                    key={object.id}
                    className={`object-entry ${shouldReveal ? "is-reveal-in" : ""}`}
                    style={shouldReveal ? { animationDelay: `${revealDelayMs}ms` } : undefined}
                  >
                    <MeterRow
                      variant="object"
                      name={object.name}
                      level={Math.ceil(object.integrity)}
                      value={object.integrity}
                      max={object.maxIntegrity}
                      color={object.barColor}
                      accent={object.accentColor}
                      details={`LV ${object.requiredLevel} | ${successChance}% success`}
                      selected={object.id === state.selectedObjectId}
                      floatingLabels={objectFloatMap.get(object.id)}
                      isHitShaking={justCompletedChopOnObject}
                      accentProgressPct={100}
                      showAccent
                      onClick={() => dispatch({ type: "SELECT_OBJECT", objectId: object.id })}
                    />
                  </div>
                );
              })
            ) : (
              <p className="empty-text">No objects nearby. Press Explore.</p>
            )}
          </div>
        </aside>
      </section>

      <div className="explore-wrap animate-in delay-3">
        <button
          type="button"
          className={`explore-button ${isExploring ? "is-exploring" : ""}`}
          onClick={() => dispatch({ type: "EXPLORE" })}
          disabled={isExploring}
        >
          <span className="explore-label">{isExploring ? "Exploring." : "Explore"}</span>
          {isExploring ? (
            <span className="explore-progress">
              <span className="explore-progress-fill" style={{ width: `${exploreProgress}%` }} />
            </span>
          ) : null}
        </button>
      </div>
    </div>
  );
}

// ── App wrapper (handles loading) ──

function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/data/game-content.json");
        if (res.ok) {
          const data = await res.json();
          loadBundle(data);
          _combos = comboDefsToRules(data.combos ?? []);
        } else {
          setError("No game-content.json found. Export one from the Content Editor.");
        }
      } catch (err) {
        console.warn("Failed to load game content:", err);
        setError("Failed to load game content. Make sure game-content.json exists in public/data/.");
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="app-shell" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <p style={{ color: "#aaa", fontFamily: "monospace" }}>Loading game content...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-shell" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: "1rem" }}>
        <p style={{ color: "#ff6b6b", fontFamily: "monospace", fontSize: "1.1rem" }}>⚠ {error}</p>
        <p style={{ color: "#888", fontFamily: "monospace", fontSize: "0.9rem" }}>
          Place game-content.json in public/data/ and reload.
        </p>
      </div>
    );
  }

  return <GameApp />;
}

export default App;
