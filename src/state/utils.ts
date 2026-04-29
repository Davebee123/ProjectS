/**
 * Pure utility functions used by the reducer and selectors.
 * Extracted from App.tsx — no side effects, no bundle access.
 */
import { evaluateCondition, type EvalContext } from "../data/evaluator";
import type {
  GameState,
  FloatingText,
  FloatingZone,
  UnlockCue,
  ObjectEmoteCue,
  ActiveEffect,
  InventoryItem,
  EquipmentItemInstance,
  SkillState,
  WorldObject,
} from "./types";
import type { StatusEffectDef, EventActionDef } from "../data/loader";
import { getBundle } from "../data/loader";
import {
  checkSkillUnlocks,
  createLegacyEquipmentInstance,
  createWorldObjectFromInteractableDef,
  rollLootDrops,
} from "../data/bridge";

// ── Seeded RNG ──

export function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Log helper ──

export function appendLog(log: string[], line: string): string[] {
  return [line, ...log].slice(0, 10);
}

// ── Floating text ──

export function pushFloatingText(
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

export function pushObjectEmoteCue(
  objectEmoteCues: ObjectEmoteCue[],
  objectId: string,
  text: string,
  now: number,
  durationMs = 2400
): ObjectEmoteCue[] {
  const trimmedText = text.trim();
  const safeDurationMs = Math.max(600, durationMs);
  if (!trimmedText) {
    return objectEmoteCues.filter((cue) => cue.expiresAt > now);
  }

  return [
    ...objectEmoteCues.filter((cue) => cue.expiresAt > now && cue.objectId !== objectId),
    {
      id: `emote_${objectId}_${now}_${Math.random().toString(36).slice(2, 8)}`,
      objectId,
      text: trimmedText,
      createdAt: now,
      expiresAt: now + safeDurationMs,
      durationMs: safeDurationMs,
    },
  ].slice(-8);
}

// ── Unlock cues ──

export function addUnlockCue(cues: UnlockCue[], skillId: string, now: number): UnlockCue[] {
  const filtered = cues.filter((entry) => entry.skillId !== skillId && entry.expiresAt > now);
  return [...filtered, { skillId, expiresAt: now + 1200 }];
}

// ── Build DSL evaluation context from game state ──

export function buildEvalContext(state: GameState): EvalContext {
  return buildEvalContextForTarget(state);
}

export function buildEvalContextForTarget(
  state: GameState,
  options?: {
    selfEffects?: ActiveEffect[];
    targetTag?: string;
    targetEffects?: ActiveEffect[];
  }
): EvalContext {
  const selfEffects = options?.selfEffects ?? state.activeEffects;
  return {
    hasItem: (id) =>
      state.inventory.some((i) => i.id === id) ||
      state.inventoryEquipment.some((i) => i.legacyItemId === id || i.baseId === id),
    itemCount: (id) =>
      (state.inventory.find((i) => i.id === id)?.qty ?? 0) +
      state.inventoryEquipment.filter((i) => i.legacyItemId === id || i.baseId === id).length,
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
    hasQuest: (id) => state.playerStorage[`quest_granted:${id}`] === true,
    hasCompletedQuest: (id) => state.playerStorage[`quest_completed:${id}`] === true,
    skillLevel: (id) => state.skills.find((s) => s.id === id)?.level ?? 0,
    skillUnlocked: (id) => state.skills.find((s) => s.id === id)?.unlocked ?? false,
    hasEffect: (id) => (selfEffects ?? []).some((e) => e.effectId === id),
    effectStacks: (id) => (selfEffects ?? []).find((e) => e.effectId === id)?.stacks ?? 0,
    roomId: state.currentRoomId,
    exploreCount: state.exploreCount,
    targetTag: options?.targetTag,
    targetHasEffect: (id) => (options?.targetEffects ?? []).some((e) => e.effectId === id),
    targetEffectStacks: (id) => (options?.targetEffects ?? []).find((e) => e.effectId === id)?.stacks ?? 0,
  };
}

// ── Storage effect processing ──

export function applyStorageEffect(
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

// ── Status effect helpers ──

export function applyStatusEffect(
  activeEffects: ActiveEffect[],
  def: StatusEffectDef,
  now: number
): ActiveEffect[] {
  const existing = activeEffects.find((e) => e.effectId === def.id);
  if (existing) {
    if (!def.stackable) {
      return activeEffects.map((e) =>
        e.effectId === def.id ? { ...e, appliedAt: now } : e
      );
    }
    const newStacks = Math.min(existing.stacks + 1, def.maxStacks);
    return activeEffects.map((e) =>
      e.effectId === def.id ? { ...e, stacks: newStacks, appliedAt: now } : e
    );
  }
  return [...activeEffects, { effectId: def.id, stacks: 1, appliedAt: now }];
}

function markIntervalTimer(
  activeEffects: ActiveEffect[],
  effectId: string,
  hookId: string,
  now: number
): ActiveEffect[] {
  return activeEffects.map((entry) =>
    entry.effectId === effectId
      ? {
          ...entry,
          intervalTimers: {
            ...(entry.intervalTimers ?? {}),
            [hookId]: now,
          },
        }
      : entry
  );
}

export function removeStatusEffect(activeEffects: ActiveEffect[], effectId: string): ActiveEffect[] {
  return activeEffects.filter((e) => e.effectId !== effectId);
}

export function mergeInventoryItems(inventory: InventoryItem[], drops: InventoryItem[]): InventoryItem[] {
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

export function grantItemToInventories(
  stackables: InventoryItem[],
  equipmentItems: EquipmentItemInstance[],
  itemDef: NonNullable<ReturnType<NonNullable<ReturnType<typeof getBundle>>["items"]["find"]>>,
  quantity: number
): { stackables: InventoryItem[]; equipmentItems: EquipmentItemInstance[] } {
  if (!itemDef.slot) {
    return {
      stackables: mergeInventoryItems(stackables, [{
        id: itemDef.id,
        name: itemDef.name,
        qty: quantity,
        slot: itemDef.slot,
        attack: itemDef.stats.attack,
        defense: itemDef.stats.defense,
        energyRegen: itemDef.stats.energyRegen,
        activityPowerMultiplier: itemDef.stats.activityPowerMultiplier,
        speedMultiplier: itemDef.stats.speedMultiplier,
        energyCostMultiplier: itemDef.stats.energyCostMultiplier,
      }]),
      equipmentItems,
    };
  }

  return {
    stackables,
    equipmentItems: [
      ...equipmentItems,
      ...Array.from({ length: quantity }, () => createLegacyEquipmentInstance(itemDef)),
    ],
  };
}

export type EventActionEntityTarget =
  | { kind: "player" }
  | { kind: "object"; objectId: string };

export interface EventActionExecutionContext {
  bearer?: EventActionEntityTarget;
  target?: EventActionEntityTarget;
}

function resolveEventActionTarget(
  action: EventActionDef,
  context?: EventActionExecutionContext
): EventActionEntityTarget | null {
  switch (action.target ?? "player") {
    case "player":
      return { kind: "player" };
    case "bearer":
      return context?.bearer ?? null;
    case "target":
      return context?.target ?? null;
    default:
      return { kind: "player" };
  }
}

export function awardSkillXp(
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

// ── Event hook execution ──

export function executeEventActions(
  actions: EventActionDef[],
  state: GameState,
  bundle: NonNullable<ReturnType<typeof getBundle>>,
  context?: EventActionExecutionContext
  ): Partial<{
    activeEffects: ActiveEffect[];
    objects: WorldObject[];
    playerStorage: Record<string, boolean | number | string>;
    seenQuestIds: string[];
    energy: number;
    mana: number;
    health: number;
  inventory: InventoryItem[];
  inventoryEquipment: EquipmentItemInstance[];
  skills: SkillState[];
  unlockCues: UnlockCue[];
  objectEmoteCues: ObjectEmoteCue[];
  travelToRoomId: string;
  startCutsceneId: string;
  log: string[];
}> {
  let activeEffects = [...(state.activeEffects ?? [])];
  let objects = [...state.objects];
  let playerStorage = state.playerStorage;
  let energy = state.energy;
  let mana = state.mana;
  let health = state.health;
  let inventory = [...state.inventory];
  let inventoryEquipment = [...state.inventoryEquipment];
  let skills = [...state.skills];
  let unlockCues = [...state.unlockCues];
  let objectEmoteCues = [...state.objectEmoteCues];
  let travelToRoomId: string | undefined;
  let startCutsceneId: string | undefined;
  const logLines: string[] = [];

  for (const action of actions) {
    if (action.condition) {
      const actionState = {
        ...state,
        activeEffects,
        objects,
        playerStorage,
        energy,
        mana,
        health,
        inventory,
        inventoryEquipment,
        skills,
        unlockCues,
        objectEmoteCues,
      };
      if (!evaluateCondition(action.condition, buildEvalContext(actionState))) {
        continue;
      }
    }
    switch (action.type) {
      case "apply_status": {
        if (!action.statusEffectId) break;
        const def = bundle.statusEffects?.find((s) => s.id === action.statusEffectId);
        if (def) {
          const resolvedTarget = resolveEventActionTarget(action, context);
          if (!resolvedTarget || resolvedTarget.kind === "player") {
            activeEffects = applyStatusEffect(activeEffects, def, state.now);
            logLines.push(`${def.name} applied.`);
          } else {
            const targetObject = objects.find((entry) => entry.id === resolvedTarget.objectId);
            if (!targetObject) break;
            objects = objects.map((entry) =>
              entry.id === resolvedTarget.objectId
                ? {
                    ...entry,
                    activeEffects: applyStatusEffect(entry.activeEffects ?? [], def, state.now),
                  }
                : entry
            );
            logLines.push(`${def.name} applied to ${targetObject.name}.`);
          }
        }
        break;
      }
      case "remove_status": {
        if (!action.statusEffectId) break;
        const def = bundle.statusEffects?.find((s) => s.id === action.statusEffectId);
        if (def) {
          const resolvedTarget = resolveEventActionTarget(action, context);
          if (!resolvedTarget || resolvedTarget.kind === "player") {
            activeEffects = removeStatusEffect(activeEffects, action.statusEffectId);
            logLines.push(`${def.name} removed.`);
          } else {
            const targetObject = objects.find((entry) => entry.id === resolvedTarget.objectId);
            if (!targetObject) break;
            objects = objects.map((entry) =>
              entry.id === resolvedTarget.objectId
                ? {
                    ...entry,
                    activeEffects: removeStatusEffect(entry.activeEffects ?? [], action.statusEffectId!),
                  }
                : entry
            );
            logLines.push(`${def.name} removed from ${targetObject.name}.`);
          }
        }
        break;
      }
      case "transform_interactable": {
        if (!action.interactableId) break;
        const resolvedTarget = resolveEventActionTarget(action, context);
        if (!resolvedTarget || resolvedTarget.kind !== "object") {
          break;
        }
        const targetObject = objects.find((entry) => entry.id === resolvedTarget.objectId);
        const nextDef = bundle.interactables.find((entry) => entry.id === action.interactableId);
        if (!targetObject || !nextDef) {
          break;
        }
        const integrityRatio = targetObject.maxIntegrity > 0
          ? targetObject.integrity / targetObject.maxIntegrity
          : 1;
        const transformedObject = createWorldObjectFromInteractableDef(bundle, nextDef, {
          id: targetObject.id,
          integrityRatio,
          drops: targetObject.drops,
          activeEffects: targetObject.activeEffects,
          now: state.now,
        });
        objects = objects.map((entry) =>
          entry.id === targetObject.id
            ? {
                ...transformedObject,
                sourceRoomId: targetObject.sourceRoomId,
                sourceSpawnEntryId: targetObject.sourceSpawnEntryId,
                neverRespawnAfterDefeat: targetObject.neverRespawnAfterDefeat,
              }
            : entry
        );
        logLines.push(`${targetObject.name} became ${nextDef.name}.`);
        break;
      }
      case "spawn_interactable": {
        if (!action.interactableId) break;
        const def = bundle.interactables.find((entry) => entry.id === action.interactableId);
        if (!def) break;
        const ctx = buildEvalContext({
          ...state,
          activeEffects,
          objects,
          playerStorage,
          energy,
          mana,
          health,
          inventory,
          inventoryEquipment,
          skills,
          unlockCues,
        });
        const object = createWorldObjectFromInteractableDef(bundle, def, {
          id: `${def.id}_spawned_${state.now}_${objects.length}`,
          drops: rollLootDrops(bundle, def, seededRandom(state.seed + state.now + objects.length), ctx),
          now: state.now,
          revealStartedAt: state.now,
          revealDurationMs:
            typeof action.durationMs === "number" && action.durationMs > 0
              ? action.durationMs
              : undefined,
        });
        objects = [...objects, object];
        logLines.push(`${def.name} appeared.`);
        break;
      }
      case "show_emote": {
        const text = (action.emoteText || action.customScript || "").trim();
        if (!text) break;
        const chance = Math.max(0, Math.min(100, action.emoteChance ?? 100));
        if (chance <= 0 || Math.random() * 100 >= chance) break;
        const resolvedTarget = resolveEventActionTarget(action, context);
        if (!resolvedTarget || resolvedTarget.kind !== "object") break;
        objectEmoteCues = pushObjectEmoteCue(
          objectEmoteCues,
          resolvedTarget.objectId,
          text,
          state.now,
          action.durationMs
        );
        break;
      }
      case "set_storage": {
        if (!action.storageKeyId) break;
        playerStorage = applyStorageEffect(playerStorage, {
          storageKeyId: action.storageKeyId,
          operation: action.storageOperation ?? "set",
          value: action.value,
        });
        break;
      }
      case "grant_item": {
        if (!action.itemId) break;
        const itemDef = bundle.items.find((item) => item.id === action.itemId);
        if (!itemDef) break;
        const qty = Math.max(1, Math.floor(action.quantity ?? 1));
        const granted = grantItemToInventories(inventory, inventoryEquipment, itemDef, qty);
        inventory = granted.stackables;
        inventoryEquipment = granted.equipmentItems;
        logLines.push(`Received ${qty} ${itemDef.name}.`);
        break;
      }
      case "grant_quest": {
        if (!action.questId) break;
        const questDef = bundle.quests.find((quest) => quest.id === action.questId);
        if (!questDef) break;
        const questKey = `quest_granted:${action.questId}`;
        const alreadyGranted = playerStorage[questKey] === true;
        playerStorage = applyStorageEffect(playerStorage, {
          storageKeyId: questKey,
          operation: "set",
          value: true,
        });
        if (!alreadyGranted) {
          logLines.push(`Quest accepted: ${questDef.name}.`);
        }
        break;
      }
      case "complete_quest": {
        if (!action.questId) break;
        const questDef = bundle.quests.find((quest) => quest.id === action.questId);
        if (!questDef) break;
        const grantedKey = `quest_granted:${action.questId}`;
        const completeKey = `quest_completed:${action.questId}`;
        const alreadyCompleted = playerStorage[completeKey] === true;
        playerStorage = applyStorageEffect(playerStorage, {
          storageKeyId: grantedKey,
          operation: "set",
          value: true,
        });
        playerStorage = applyStorageEffect(playerStorage, {
          storageKeyId: completeKey,
          operation: "set",
          value: true,
        });
        if (!alreadyCompleted) {
          logLines.push(`Quest completed: ${questDef.name}.`);
        }
        break;
      }
      case "travel_to_room": {
        if (action.roomId) {
          travelToRoomId = action.roomId;
        }
        break;
      }
      case "start_cutscene": {
        if (action.cutsceneId) {
          startCutsceneId = action.cutsceneId;
        }
        break;
      }
      case "heal": {
        const amount = typeof action.value === "number" ? action.value : 0;
        const resolvedTarget = resolveEventActionTarget(action, context);
        if (!resolvedTarget || resolvedTarget.kind === "player") {
          health = Math.min(state.maxHealth, health + amount);
          if (amount > 0) logLines.push(`+${amount} health.`);
        } else {
          const targetObject = objects.find((entry) => entry.id === resolvedTarget.objectId);
          if (!targetObject) break;
          objects = objects.map((entry) =>
            entry.id === resolvedTarget.objectId
              ? {
                  ...entry,
                  integrity: Math.min(entry.maxIntegrity, entry.integrity + amount),
                }
              : entry
          );
          if (amount > 0) logLines.push(`${targetObject.name} recovered ${amount}.`);
        }
        break;
      }
      case "damage": {
        const amount = typeof action.value === "number" ? Math.max(0, action.value) : 0;
        const resolvedTarget = resolveEventActionTarget(action, context);
        if (!resolvedTarget || resolvedTarget.kind === "player") {
          health = Math.max(0, health - amount);
          if (amount > 0) logLines.push(`-${amount} health.`);
        } else {
          const targetObject = objects.find((entry) => entry.id === resolvedTarget.objectId);
          if (!targetObject) break;
          objects = objects.map((entry) =>
            entry.id === resolvedTarget.objectId
              ? {
                  ...entry,
                  integrity: Math.max(0, entry.integrity - amount),
                }
              : entry
          );
          if (amount > 0) logLines.push(`${targetObject.name} took ${amount}.`);
        }
        break;
      }
      case "restore_energy": {
        const amount = typeof action.value === "number" ? action.value : 0;
        energy = Math.min(state.maxEnergy, energy + amount);
        if (amount > 0) logLines.push(`+${amount} energy.`);
        break;
      }
      case "restore_mana": {
        const amount = typeof action.value === "number" ? action.value : 0;
        mana = Math.min(state.maxMana, mana + amount);
        if (amount > 0) logLines.push(`+${amount} mana.`);
        break;
      }
      case "damage_energy": {
        const amount = typeof action.value === "number" ? Math.max(0, action.value) : 0;
        energy = Math.max(0, energy - amount);
        if (amount > 0) logLines.push(`-${amount} energy.`);
        break;
      }
      case "damage_mana": {
        const amount = typeof action.value === "number" ? Math.max(0, action.value) : 0;
        mana = Math.max(0, mana - amount);
        if (amount > 0) logLines.push(`-${amount} mana.`);
        break;
      }
      case "grant_xp": {
        if (!action.targetSkillId || typeof action.value !== "number" || action.value <= 0) break;
        const xpResult = awardSkillXp(skills, action.targetSkillId, action.value);
        skills = xpResult.skills;
        logLines.push(`+${action.value} XP to ${bundle.skills.find((skill) => skill.id === action.targetSkillId)?.name ?? action.targetSkillId}.`);
        const actionState = {
          ...state,
          activeEffects,
          playerStorage,
          energy,
          mana,
          health,
          inventory,
          inventoryEquipment,
          skills,
          unlockCues,
        };
        const unlockedIds = checkSkillUnlocks(skills, buildEvalContext(actionState));
        for (const skillId of unlockedIds) {
          const skill = skills.find((entry) => entry.id === skillId);
          if (!skill || skill.unlocked) continue;
          skills = skills.map((entry) => entry.id === skillId ? { ...entry, unlocked: true } : entry);
          unlockCues = addUnlockCue(unlockCues, skillId, state.now);
          logLines.push(`${skill.name} learned.`);
        }
        break;
      }
    }
  }

  return {
    activeEffects,
    objects,
    playerStorage,
    energy,
    mana,
    health,
    inventory,
    inventoryEquipment,
    skills,
    unlockCues,
    objectEmoteCues,
    travelToRoomId,
    startCutsceneId,
    log: logLines,
  };
}

export function executeItemEventHooks(
  itemIds: string[],
  eventName: string,
  state: GameState,
  bundle: NonNullable<ReturnType<typeof getBundle>>
): Partial<{
  activeEffects: ActiveEffect[];
  playerStorage: Record<string, boolean | number | string>;
  energy: number;
  mana: number;
  health: number;
  inventory: InventoryItem[];
  inventoryEquipment: EquipmentItemInstance[];
  skills: SkillState[];
  unlockCues: UnlockCue[];
  objectEmoteCues: ObjectEmoteCue[];
  travelToRoomId: string;
  startCutsceneId: string;
  log: string[];
}> {
  let activeEffects = [...(state.activeEffects ?? [])];
  let playerStorage = state.playerStorage;
  let energy = state.energy;
  let mana = state.mana;
  let health = state.health;
  let inventory = [...state.inventory];
  let inventoryEquipment = [...state.inventoryEquipment];
  let skills = [...state.skills];
  let unlockCues = [...state.unlockCues];
  let objectEmoteCues = [...state.objectEmoteCues];
  let travelToRoomId: string | undefined;
  let startCutsceneId: string | undefined;
  const logLines: string[] = [];
  const ctx = buildEvalContext(state);

  for (const itemId of itemIds) {
    const itemDef = bundle.items.find((i) => i.id === itemId);
    if (!itemDef?.eventHooks) continue;
    for (const hook of itemDef.eventHooks) {
      if (hook.event !== eventName) continue;
      if (hook.condition && !evaluateCondition(hook.condition, ctx)) continue;
      const result = executeEventActions(
        hook.actions,
        {
          ...state,
          activeEffects,
          playerStorage,
          energy,
          mana,
          health,
          inventory,
          inventoryEquipment,
          skills,
          unlockCues,
          objectEmoteCues,
        },
        bundle
      );
      if (result.activeEffects) activeEffects = result.activeEffects;
      if (result.playerStorage) playerStorage = result.playerStorage;
      if (result.energy !== undefined) energy = result.energy;
      if (result.mana !== undefined) mana = result.mana;
      if (result.health !== undefined) health = result.health;
      if (result.inventory) inventory = result.inventory;
      if (result.inventoryEquipment) inventoryEquipment = result.inventoryEquipment;
      if (result.skills) skills = result.skills;
      if (result.unlockCues) unlockCues = result.unlockCues;
      if (result.objectEmoteCues) objectEmoteCues = result.objectEmoteCues;
      if (result.travelToRoomId) travelToRoomId = result.travelToRoomId;
      if (result.startCutsceneId) startCutsceneId = result.startCutsceneId;
      if (result.log) logLines.push(...result.log);
    }
  }

  return {
    activeEffects,
    playerStorage,
    energy,
    mana,
    health,
    inventory,
    inventoryEquipment,
    skills,
    unlockCues,
    objectEmoteCues,
    travelToRoomId,
    startCutsceneId,
    log: logLines,
  };
}

export function executeStatusEffectHooks(
  target: { kind: "player" } | { kind: "object"; objectId: string },
  eventName: "on_hit" | "on_damage_taken" | "on_kill",
  state: GameState,
  bundle: NonNullable<ReturnType<typeof getBundle>>,
  interactionTarget?: EventActionEntityTarget
): Partial<{
  activeEffects: ActiveEffect[];
  objects: WorldObject[];
  playerStorage: Record<string, boolean | number | string>;
  energy: number;
  mana: number;
  health: number;
  inventory: InventoryItem[];
  inventoryEquipment: EquipmentItemInstance[];
  skills: SkillState[];
  unlockCues: UnlockCue[];
  objectEmoteCues: ObjectEmoteCue[];
  travelToRoomId: string;
  startCutsceneId: string;
  log: string[];
}> {
  let activeEffects = [...(state.activeEffects ?? [])];
  let objects = [...state.objects];
  let playerStorage = state.playerStorage;
  let energy = state.energy;
  let mana = state.mana;
  let health = state.health;
  let inventory = [...state.inventory];
  let inventoryEquipment = [...state.inventoryEquipment];
  let skills = [...state.skills];
  let unlockCues = [...state.unlockCues];
  let objectEmoteCues = [...state.objectEmoteCues];
  let travelToRoomId: string | undefined;
  let startCutsceneId: string | undefined;
  const logLines: string[] = [];

  const mergeActionResult = (
    result: Partial<{
      activeEffects: ActiveEffect[];
      objects: WorldObject[];
      playerStorage: Record<string, boolean | number | string>;
      seenQuestIds: string[];
      energy: number;
      mana: number;
      health: number;
      inventory: InventoryItem[];
      inventoryEquipment: EquipmentItemInstance[];
      skills: SkillState[];
      unlockCues: UnlockCue[];
      objectEmoteCues: ObjectEmoteCue[];
      travelToRoomId: string;
      startCutsceneId: string;
      log: string[];
    }>
  ) => {
    if (result.activeEffects) activeEffects = result.activeEffects;
    if (result.objects) objects = result.objects;
    if (result.playerStorage) playerStorage = result.playerStorage;
    if (result.energy !== undefined) energy = result.energy;
    if (result.mana !== undefined) mana = result.mana;
    if (result.health !== undefined) health = result.health;
    if (result.inventory) inventory = result.inventory;
    if (result.inventoryEquipment) inventoryEquipment = result.inventoryEquipment;
    if (result.skills) skills = result.skills;
    if (result.unlockCues) unlockCues = result.unlockCues;
    if (result.objectEmoteCues) objectEmoteCues = result.objectEmoteCues;
    if (result.travelToRoomId) travelToRoomId = result.travelToRoomId;
    if (result.startCutsceneId) startCutsceneId = result.startCutsceneId;
    if (result.log) logLines.push(...result.log);
  };

  const getCurrentObject = () =>
    target.kind === "object"
      ? objects.find((entry) => entry.id === target.objectId) ?? null
      : null;

  const sourceEffects =
    target.kind === "player"
      ? [...(state.activeEffects ?? [])]
      : [...(getCurrentObject()?.activeEffects ?? [])];

  for (const active of sourceEffects) {
    const def = bundle.statusEffects.find((entry) => entry.id === active.effectId);
    if (!def?.eventHooks || def.eventHooks.length === 0) {
      continue;
    }

    for (const hook of def.eventHooks) {
      if (hook.event !== eventName) {
        continue;
      }

      const currentState = {
        ...state,
        activeEffects,
        objects,
        playerStorage,
        energy,
        mana,
        health,
        inventory,
        inventoryEquipment,
        skills,
        unlockCues,
        objectEmoteCues,
      };
      const currentObject = getCurrentObject();
      const hookContext =
        target.kind === "player"
          ? buildEvalContext(currentState)
          : buildEvalContextForTarget(currentState, {
              targetTag: currentObject?.tag,
              targetEffects: currentObject?.activeEffects,
            });

      if (hook.condition && !evaluateCondition(hook.condition, hookContext)) {
        continue;
      }

      if (target.kind === "player") {
        mergeActionResult(
          executeEventActions(hook.actions, currentState, bundle, {
            bearer: { kind: "player" },
            target: interactionTarget,
          })
        );
        continue;
      }

      for (const action of hook.actions) {
        const bearerObject = getCurrentObject();
        if (!bearerObject) {
          break;
        }

        const actionState = {
          ...state,
          activeEffects,
          objects,
          playerStorage,
          energy,
          mana,
          health,
          inventory,
          inventoryEquipment,
          skills,
          unlockCues,
          objectEmoteCues,
        };
        const actionContext = buildEvalContextForTarget(actionState, {
          targetTag: bearerObject.tag,
          targetEffects: bearerObject.activeEffects,
        });

        if (action.condition && !evaluateCondition(action.condition, actionContext)) {
          continue;
        }

        switch (action.type) {
          case "apply_status": {
            if (!action.statusEffectId) break;
            const effectDef = bundle.statusEffects.find((entry) => entry.id === action.statusEffectId);
            if (!effectDef) break;
            objects = objects.map((entry) =>
              entry.id === bearerObject.id
                ? {
                    ...entry,
                    activeEffects: applyStatusEffect(entry.activeEffects ?? [], effectDef, state.now),
                  }
                : entry
            );
            break;
          }

          case "remove_status": {
            if (!action.statusEffectId) break;
            objects = objects.map((entry) =>
              entry.id === bearerObject.id
                ? {
                    ...entry,
                    activeEffects: removeStatusEffect(entry.activeEffects ?? [], action.statusEffectId!),
                  }
                : entry
            );
            break;
          }

          case "heal": {
            const amount = typeof action.value === "number" ? Math.max(0, action.value) : 0;
            if (amount <= 0) break;
            objects = objects.map((entry) =>
              entry.id === bearerObject.id
                ? {
                    ...entry,
                    integrity: Math.min(entry.maxIntegrity, entry.integrity + amount),
                  }
                : entry
            );
            logLines.push(`${bearerObject.name} recovered ${amount}.`);
            break;
          }

          case "damage": {
            const amount = typeof action.value === "number" ? Math.max(0, action.value) : 0;
            if (amount <= 0) break;
            objects = objects.map((entry) =>
              entry.id === bearerObject.id
                ? {
                    ...entry,
                    integrity: Math.max(0, entry.integrity - amount),
                  }
                : entry
            );
            logLines.push(`${bearerObject.name} took ${amount}.`);
            break;
          }

          default: {
            mergeActionResult(
              executeEventActions([action], actionState, bundle, {
                bearer: { kind: "object", objectId: bearerObject.id },
                target: interactionTarget,
              })
            );
            break;
          }
        }
      }
    }
  }

  return {
    activeEffects,
    objects,
    playerStorage,
    energy,
    mana,
    health,
    inventory,
    inventoryEquipment,
    skills,
    unlockCues,
    objectEmoteCues,
    travelToRoomId,
    startCutsceneId,
    log: logLines,
  };
}

export function executeStatusEffectIntervalHooks(
  target: { kind: "player" } | { kind: "object"; objectId: string },
  state: GameState,
  bundle: NonNullable<ReturnType<typeof getBundle>>
): Partial<{
  activeEffects: ActiveEffect[];
  objects: WorldObject[];
  playerStorage: Record<string, boolean | number | string>;
  energy: number;
  mana: number;
  health: number;
  inventory: InventoryItem[];
  inventoryEquipment: EquipmentItemInstance[];
  skills: SkillState[];
  unlockCues: UnlockCue[];
  objectEmoteCues: ObjectEmoteCue[];
  travelToRoomId: string;
  startCutsceneId: string;
  log: string[];
}> {
  let activeEffects = [...(state.activeEffects ?? [])];
  let objects = [...state.objects];
  let playerStorage = state.playerStorage;
  let energy = state.energy;
  let mana = state.mana;
  let health = state.health;
  let inventory = [...state.inventory];
  let inventoryEquipment = [...state.inventoryEquipment];
  let skills = [...state.skills];
  let unlockCues = [...state.unlockCues];
  let objectEmoteCues = [...state.objectEmoteCues];
  let travelToRoomId: string | undefined;
  let startCutsceneId: string | undefined;
  const logLines: string[] = [];

  const mergeActionResult = (
    result: Partial<{
      activeEffects: ActiveEffect[];
      objects: WorldObject[];
      playerStorage: Record<string, boolean | number | string>;
      energy: number;
      mana: number;
      health: number;
      inventory: InventoryItem[];
      inventoryEquipment: EquipmentItemInstance[];
      skills: SkillState[];
      unlockCues: UnlockCue[];
      objectEmoteCues: ObjectEmoteCue[];
      travelToRoomId: string;
      startCutsceneId: string;
      log: string[];
    }>
  ) => {
    if (result.activeEffects) activeEffects = result.activeEffects;
    if (result.objects) objects = result.objects;
    if (result.playerStorage) playerStorage = result.playerStorage;
    if (result.energy !== undefined) energy = result.energy;
    if (result.mana !== undefined) mana = result.mana;
    if (result.health !== undefined) health = result.health;
    if (result.inventory) inventory = result.inventory;
    if (result.inventoryEquipment) inventoryEquipment = result.inventoryEquipment;
    if (result.skills) skills = result.skills;
    if (result.unlockCues) unlockCues = result.unlockCues;
    if (result.objectEmoteCues) objectEmoteCues = result.objectEmoteCues;
    if (result.travelToRoomId) travelToRoomId = result.travelToRoomId;
    if (result.startCutsceneId) startCutsceneId = result.startCutsceneId;
    if (result.log) logLines.push(...result.log);
  };

  const getCurrentObject = () =>
    target.kind === "object"
      ? objects.find((entry) => entry.id === target.objectId) ?? null
      : null;

  const sourceEffects =
    target.kind === "player"
      ? [...(activeEffects ?? [])]
      : [...(getCurrentObject()?.activeEffects ?? [])];

  for (const active of sourceEffects) {
    const def = bundle.statusEffects.find((entry) => entry.id === active.effectId);
    if (!def?.eventHooks?.length) {
      continue;
    }

    for (const hook of def.eventHooks) {
      if (hook.event !== "on_interval" || typeof hook.intervalMs !== "number" || hook.intervalMs <= 0) {
        continue;
      }

      const lastTriggeredAt = active.intervalTimers?.[hook.id] ?? active.appliedAt;
      if (state.now - lastTriggeredAt < hook.intervalMs) {
        continue;
      }

      const currentState = {
        ...state,
        activeEffects,
        objects,
        playerStorage,
        energy,
        mana,
        health,
        inventory,
        inventoryEquipment,
        skills,
        unlockCues,
        objectEmoteCues,
      };
      const currentObject = getCurrentObject();
      const hookContext =
        target.kind === "player"
          ? buildEvalContext(currentState)
          : buildEvalContextForTarget(currentState, {
              targetTag: currentObject?.tag,
              targetEffects: currentObject?.activeEffects,
            });

      if (hook.condition && !evaluateCondition(hook.condition, hookContext)) {
        continue;
      }

      if (target.kind === "player") {
        mergeActionResult(
          executeEventActions(hook.actions, currentState, bundle, {
            bearer: { kind: "player" },
          })
        );
        activeEffects = markIntervalTimer(activeEffects, active.effectId, hook.id, state.now);
        continue;
      }

      for (const action of hook.actions) {
        const bearerObject = getCurrentObject();
        if (!bearerObject) {
          break;
        }

        const actionState = {
          ...state,
          activeEffects,
          objects,
          playerStorage,
          energy,
          mana,
          health,
          inventory,
          inventoryEquipment,
          skills,
          unlockCues,
          objectEmoteCues,
        };
        const actionContext = buildEvalContextForTarget(actionState, {
          targetTag: bearerObject.tag,
          targetEffects: bearerObject.activeEffects,
        });

        if (action.condition && !evaluateCondition(action.condition, actionContext)) {
          continue;
        }

        switch (action.type) {
          case "apply_status": {
            if (!action.statusEffectId) break;
            const effectDef = bundle.statusEffects.find((entry) => entry.id === action.statusEffectId);
            if (!effectDef) break;
            objects = objects.map((entry) =>
              entry.id === bearerObject.id
                ? {
                    ...entry,
                    activeEffects: applyStatusEffect(entry.activeEffects ?? [], effectDef, state.now),
                  }
                : entry
            );
            break;
          }

          case "remove_status": {
            if (!action.statusEffectId) break;
            objects = objects.map((entry) =>
              entry.id === bearerObject.id
                ? {
                    ...entry,
                    activeEffects: removeStatusEffect(entry.activeEffects ?? [], action.statusEffectId!),
                  }
                : entry
            );
            break;
          }

          case "heal": {
            const amount = typeof action.value === "number" ? Math.max(0, action.value) : 0;
            if (amount <= 0) break;
            objects = objects.map((entry) =>
              entry.id === bearerObject.id
                ? {
                    ...entry,
                    integrity: Math.min(entry.maxIntegrity, entry.integrity + amount),
                  }
                : entry
            );
            logLines.push(`${bearerObject.name} recovered ${amount}.`);
            break;
          }

          case "damage": {
            const amount = typeof action.value === "number" ? Math.max(0, action.value) : 0;
            if (amount <= 0) break;
            objects = objects.map((entry) =>
              entry.id === bearerObject.id
                ? {
                    ...entry,
                    integrity: Math.max(0, entry.integrity - amount),
                  }
                : entry
            );
            logLines.push(`${bearerObject.name} took ${amount}.`);
            break;
          }

          default: {
            mergeActionResult(
              executeEventActions([action], actionState, bundle, {
                bearer: { kind: "object", objectId: bearerObject.id },
              })
            );
            break;
          }
        }
      }

      const refreshedObject = getCurrentObject();
      if (refreshedObject) {
        objects = objects.map((entry) =>
          entry.id === refreshedObject.id
            ? {
                ...entry,
                activeEffects: markIntervalTimer(entry.activeEffects ?? [], active.effectId, hook.id, state.now),
              }
            : entry
        );
      }
    }
  }

  return {
    activeEffects,
    objects,
    playerStorage,
    energy,
    mana,
    health,
    inventory,
    inventoryEquipment,
    skills,
    unlockCues,
    objectEmoteCues,
    travelToRoomId,
    startCutsceneId,
    log: logLines,
  };
}

export function mergeHookResult(
  state: GameState,
  result: Partial<{
    activeEffects: ActiveEffect[];
    objects: WorldObject[];
    playerStorage: Record<string, boolean | number | string>;
    seenQuestIds: string[];
    energy: number;
    mana: number;
    health: number;
    inventory: InventoryItem[];
    inventoryEquipment: EquipmentItemInstance[];
    skills: SkillState[];
    unlockCues: UnlockCue[];
    objectEmoteCues: ObjectEmoteCue[];
    log: string[];
  }>
): GameState {
  let nextLog = state.log;
  for (const line of result.log ?? []) {
    nextLog = appendLog(nextLog, line);
  }
  return {
    ...state,
    activeEffects: result.activeEffects ?? state.activeEffects,
      objects: result.objects ?? state.objects,
      playerStorage: result.playerStorage ?? state.playerStorage,
      seenQuestIds: result.seenQuestIds ?? state.seenQuestIds,
      energy: result.energy ?? state.energy,
      mana: result.mana ?? state.mana,
      health: result.health ?? state.health,
    inventory: result.inventory ?? state.inventory,
    inventoryEquipment: result.inventoryEquipment ?? state.inventoryEquipment,
    skills: result.skills ?? state.skills,
    unlockCues: result.unlockCues ?? state.unlockCues,
    objectEmoteCues: result.objectEmoteCues ?? state.objectEmoteCues,
    log: nextLog,
  };
}
