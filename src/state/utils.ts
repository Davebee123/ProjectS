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
  ActiveEffect,
} from "./types";
import type { StatusEffectDef, EventActionDef } from "../data/loader";
import { getBundle } from "../data/loader";

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

// ── Unlock cues ──

export function addUnlockCue(cues: UnlockCue[], skillId: string, now: number): UnlockCue[] {
  const filtered = cues.filter((entry) => entry.skillId !== skillId && entry.expiresAt > now);
  return [...filtered, { skillId, expiresAt: now + 1200 }];
}

// ── Build DSL evaluation context from game state ──

export function buildEvalContext(state: GameState): EvalContext {
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
    hasEffect: (id) => (state.activeEffects ?? []).some((e) => e.effectId === id),
    effectStacks: (id) => (state.activeEffects ?? []).find((e) => e.effectId === id)?.stacks ?? 0,
    roomId: state.currentRoomId,
    exploreCount: state.exploreCount,
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

export function removeStatusEffect(activeEffects: ActiveEffect[], effectId: string): ActiveEffect[] {
  return activeEffects.filter((e) => e.effectId !== effectId);
}

// ── Event hook execution ──

export function executeEventActions(
  actions: EventActionDef[],
  state: GameState,
  bundle: NonNullable<ReturnType<typeof getBundle>>
): Partial<{ activeEffects: ActiveEffect[]; playerStorage: Record<string, boolean | number | string>; energy: number; log: string[] }> {
  let activeEffects = [...(state.activeEffects ?? [])];
  let playerStorage = state.playerStorage;
  let energy = state.energy;
  const logLines: string[] = [];

  for (const action of actions) {
    switch (action.type) {
      case "apply_status": {
        if (!action.statusEffectId) break;
        const def = bundle.statusEffects?.find((s) => s.id === action.statusEffectId);
        if (def) {
          activeEffects = applyStatusEffect(activeEffects, def, state.now);
          logLines.push(`${def.name} applied.`);
        }
        break;
      }
      case "remove_status": {
        if (!action.statusEffectId) break;
        const def = bundle.statusEffects?.find((s) => s.id === action.statusEffectId);
        if (def) {
          activeEffects = removeStatusEffect(activeEffects, action.statusEffectId);
          logLines.push(`${def.name} removed.`);
        }
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
      case "restore_energy": {
        const amount = typeof action.value === "number" ? action.value : 0;
        energy = Math.min(state.maxEnergy, energy + amount);
        if (amount > 0) logLines.push(`+${amount} energy.`);
        break;
      }
    }
  }

  return { activeEffects, playerStorage, energy, log: logLines };
}

export function executeItemEventHooks(
  itemIds: string[],
  eventName: string,
  state: GameState,
  bundle: NonNullable<ReturnType<typeof getBundle>>
): Partial<{ activeEffects: ActiveEffect[]; playerStorage: Record<string, boolean | number | string>; energy: number; log: string[] }> {
  let activeEffects = [...(state.activeEffects ?? [])];
  let playerStorage = state.playerStorage;
  let energy = state.energy;
  const logLines: string[] = [];
  const ctx = buildEvalContext(state);

  for (const itemId of itemIds) {
    const itemDef = bundle.items.find((i) => i.id === itemId);
    if (!itemDef?.eventHooks) continue;
    for (const hook of itemDef.eventHooks) {
      if (hook.event !== eventName) continue;
      if (hook.condition && !evaluateCondition(hook.condition, ctx)) continue;
      const result = executeEventActions(hook.actions, state, bundle);
      if (result.activeEffects) activeEffects = result.activeEffects;
      if (result.playerStorage) playerStorage = result.playerStorage;
      if (result.energy !== undefined) energy = result.energy;
      if (result.log) logLines.push(...result.log);
    }
  }

  return { activeEffects, playerStorage, energy, log: logLines };
}

export function mergeHookResult(
  state: GameState,
  result: Partial<{ activeEffects: ActiveEffect[]; playerStorage: Record<string, boolean | number | string>; energy: number; log: string[] }>
): GameState {
  let nextLog = state.log;
  for (const line of result.log ?? []) {
    nextLog = appendLog(nextLog, line);
  }
  return {
    ...state,
    activeEffects: result.activeEffects ?? state.activeEffects,
    playerStorage: result.playerStorage ?? state.playerStorage,
    energy: result.energy ?? state.energy,
    log: nextLog,
  };
}
