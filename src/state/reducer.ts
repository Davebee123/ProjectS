/**
 * Game reducer and all helper functions — extracted from App.tsx.
 */
import { getBundle } from "../data/loader";
import {
  generateObjectsFromRoom,
  resolveItemNames,
  checkSkillUnlocks,
  getAvailableRecipes,
  type SkillState,
  type InventoryItem,
  type WorldObject,
  type ComboRule,
} from "../data/bridge";
import { evaluateCondition } from "../data/evaluator";
import { playSound, playAmbient } from "../audio";
import type {
  GameState,
  GameAction,
  LastAction,
  PlacedObject,
  CastMetrics,
  ActionPlan,
  WeatherType,
} from "./types";
import {
  seededRandom,
  appendLog,
  pushFloatingText,
  addUnlockCue,
  buildEvalContext,
  applyStorageEffect,
  executeItemEventHooks,
  mergeHookResult,
} from "./utils";

// ── Loaded game data (set once at startup) ──
let _combos: ComboRule[] = [];

export function setCombos(combos: ComboRule[]): void {
  _combos = combos;
}

// ── Weather ──

export function pickWeather(seed: number): WeatherType {
  const rng = seededRandom(seed + 777);
  const roll = rng();
  if (roll < 0.4) return "clear";
  if (roll < 0.7) return "cloudy";
  if (roll < 0.9) return "rainy";
  return "stormy";
}

export function getWeatherModifiers(weather: WeatherType): {
  energyRegenMult: number;
  manaRegenMult: number;
  successChanceMod: number;
} {
  switch (weather) {
    case "clear": return { energyRegenMult: 1.0, manaRegenMult: 1.0, successChanceMod: 0 };
    case "cloudy": return { energyRegenMult: 1.0, manaRegenMult: 1.1, successChanceMod: 0 };
    case "rainy": return { energyRegenMult: 0.85, manaRegenMult: 1.25, successChanceMod: -5 };
    case "stormy": return { energyRegenMult: 0.7, manaRegenMult: 1.5, successChanceMod: -10 };
  }
}

// ── Combo lookup ──

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

export function getRelevantPassiveLevel(skills: SkillState[], tag: string): number {
  const passives = skills.filter((s) => s.kind === "passive" && s.tags.includes(tag));
  if (passives.length === 0) return 1;
  return Math.max(...passives.map((s) => s.level));
}

export function getSuccessChance(playerLevel: number, objectLevel: number): number {
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
  // Equipment slots + rune slots
  const equipIds = Object.values(state.equipment).filter((value): value is string => Boolean(value));
  const runeIds = (state.feyRunes ?? []).filter((value): value is string => Boolean(value));
  const allIds = [...equipIds, ...runeIds];
  return allIds
    .map((itemId) => state.inventory.find((item) => item.id === itemId))
    .filter((item): item is InventoryItem => Boolean(item));
}

export function getEquipmentStats(state: GameState): {
  attack: number;
  activityPowerMultiplier: number;
  defense: number;
  energyRegen: number;
  speedMultiplier: number;
  energyCostMultiplier: number;
} {
  const bundle = getBundle();
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

  // Apply stat modifiers from active status effects
  if (bundle) {
    for (const active of state.activeEffects ?? []) {
      const def = bundle.statusEffects?.find((s) => s.id === active.effectId);
      if (!def) continue;
      for (const mod of def.statModifiers) {
        const multiplier = active.stacks;
        switch (mod.stat) {
          case "attack":
            base.attack += mod.operation === "add" ? mod.value * multiplier : 0;
            if (mod.operation === "multiply") base.attack *= Math.pow(mod.value, multiplier);
            break;
          case "defense":
            base.defense += mod.operation === "add" ? mod.value * multiplier : 0;
            if (mod.operation === "multiply") base.defense *= Math.pow(mod.value, multiplier);
            break;
          case "energyRegen":
            base.energyRegen += mod.operation === "add" ? mod.value * multiplier : 0;
            if (mod.operation === "multiply") base.energyRegen *= Math.pow(mod.value, multiplier);
            break;
          case "speedMultiplier":
            if (mod.operation === "multiply") base.speedMultiplier *= Math.pow(mod.value, multiplier);
            else base.speedMultiplier += mod.value * multiplier;
            break;
          case "energyCostMultiplier":
            if (mod.operation === "multiply") base.energyCostMultiplier *= Math.pow(mod.value, multiplier);
            else base.energyCostMultiplier += mod.value * multiplier;
            break;
          case "activityPowerMultiplier":
            if (mod.operation === "multiply") base.activityPowerMultiplier *= Math.pow(mod.value, multiplier);
            else base.activityPowerMultiplier += mod.value * multiplier;
            break;
        }
      }
    }
  }

  // Apply stat_aura from placed objects in the current room
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

export function getActivityProgressValue(
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

export function generateObjectsForRoom(
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
      image: def.image,
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
  let nextDestroyedObjectCues = state.destroyedObjectCues;
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
    // Play skill hit sound and interactable on_hit sound
    const soundBundle = getBundle();
    const hitSkillDef = soundBundle?.skills.find((s) => s.id === usedSkill.id);
    if (hitSkillDef?.hitSound) playSound(hitSkillDef.hitSound);
    const hitInterDef = soundBundle?.interactables.find((i) => i.id === targetObject.interactableId);
    if (hitInterDef?.sounds?.onHit) playSound(hitInterDef.sounds.onHit);
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
    updatedLog = appendLog(updatedLog, `Downward Chop bonus consumed. Restored ${restoredEnergy} \u26A1.`);
    updatedFloatTexts = pushFloatingText(updatedFloatTexts, `+${restoredEnergy} \u26A1`, state.now, {
      zone: "skills",
      skillId: "downward_chop",
    });
  }

  if (didSucceed && remainingIntegrity <= 0) {
    const destroyedIndex = state.objects.findIndex((entry) => entry.id === targetObject.id);
    updatedInventory = mergeDrops(updatedInventory, targetObject.drops);
    resolvedObjects = updatedObjects.filter((entry) => entry.id !== targetObject.id);
    nextDestroyedObjectCues = [
      ...nextDestroyedObjectCues,
      {
        object: { ...targetObject, integrity: 0 },
        createdAt: state.now,
        expiresAt: state.now + 550,
        index: destroyedIndex >= 0 ? destroyedIndex : state.objects.length,
      },
    ];
    for (const drop of targetObject.drops) {
      updatedFloatTexts = pushFloatingText(updatedFloatTexts, `+${drop.qty} ${drop.name}`, state.now, {
        zone: "objects",
      });
    }

    const dropText = targetObject.drops.map((drop) => `${drop.qty} ${drop.name}`).join(", ");
    updatedLog = appendLog(updatedLog, `${targetObject.name} completed. Loot: ${dropText}.`);

    // Process onDestroy storage effects + destroy sound
    if (targetObject.interactableId) {
      const bundle = getBundle();
      const interDef = bundle?.interactables.find((i) => i.id === targetObject.interactableId);
      if (interDef?.onDestroyEffects) {
        for (const effect of interDef.onDestroyEffects) {
          nextPlayerStorage = applyStorageEffect(nextPlayerStorage, effect);
        }
      }
      if (interDef?.sounds?.onDestroy) playSound(interDef.sounds.onDestroy);
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

  // ── Item event hooks for equipped items ──
  let nextActiveEffects = state.activeEffects ?? [];
  const hookBundle = getBundle();
  if (hookBundle && didSucceed) {
    const equippedIds = Object.values(state.equipment).filter((v): v is string => Boolean(v));

    // on_hit: fires on any successful hit
    if (impact > 0) {
      const hitResult = executeItemEventHooks(equippedIds, "on_hit", { ...state, activeEffects: nextActiveEffects, playerStorage: nextPlayerStorage, energy: nextEnergy }, hookBundle);
      if (hitResult.activeEffects) nextActiveEffects = hitResult.activeEffects;
      if (hitResult.playerStorage) nextPlayerStorage = hitResult.playerStorage;
      if (hitResult.energy !== undefined) nextEnergy = hitResult.energy;
      for (const line of hitResult.log ?? []) updatedLog = appendLog(updatedLog, line);
    }

    // on_kill: fires when interactable is destroyed
    if (remainingIntegrity <= 0) {
      const killResult = executeItemEventHooks(equippedIds, "on_kill", { ...state, activeEffects: nextActiveEffects, playerStorage: nextPlayerStorage, energy: nextEnergy }, hookBundle);
      if (killResult.activeEffects) nextActiveEffects = killResult.activeEffects;
      if (killResult.playerStorage) nextPlayerStorage = killResult.playerStorage;
      if (killResult.energy !== undefined) nextEnergy = killResult.energy;
      for (const line of killResult.log ?? []) updatedLog = appendLog(updatedLog, line);
    }

    // on_interact: fires on every successful action
    const interactResult = executeItemEventHooks(equippedIds, "on_interact", { ...state, activeEffects: nextActiveEffects, playerStorage: nextPlayerStorage, energy: nextEnergy }, hookBundle);
    if (interactResult.activeEffects) nextActiveEffects = interactResult.activeEffects;
    if (interactResult.playerStorage) nextPlayerStorage = interactResult.playerStorage;
    if (interactResult.energy !== undefined) nextEnergy = interactResult.energy;
    for (const line of interactResult.log ?? []) updatedLog = appendLog(updatedLog, line);
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
    activeEffects: nextActiveEffects,
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
    destroyedObjectCues: nextDestroyedObjectCues,
  };
}

// ── Reducer ──

export function reducer(state: GameState, action: GameAction): GameState {
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
        destroyedObjectCues: [],
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
          const castDef = getBundle()?.skills.find((s) => s.id === nextState.autoSkillId);
          if (castDef?.castSound) playSound(castDef.castSound);
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
        const castDef = getBundle()?.skills.find((s) => s.id === action.skillId);
        if (castDef?.castSound) playSound(castDef.castSound);
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
      // Rune items go in rune slots, not equipment slots
      if (item.slot === "rune") return state;

      const bundle = getBundle();
      let nextState: GameState = {
        ...state,
        equipment: { ...state.equipment, [item.slot]: item.id },
        log: appendLog(state.log, `${item.name} equipped in ${item.slot}.`),
      };

      if (bundle) {
        const prevItemId = state.equipment[item.slot];
        if (prevItemId) {
          const unequipResult = executeItemEventHooks([prevItemId], "on_unequip", nextState, bundle);
          nextState = mergeHookResult(nextState, unequipResult);
        }
        const equipResult = executeItemEventHooks([item.id], "on_equip", nextState, bundle);
        nextState = mergeHookResult(nextState, equipResult);
      }

      return nextState;
    }

    case "UNEQUIP_SLOT": {
      const prevItemId = state.equipment[action.slot];
      if (!prevItemId) return state;

      const bundle = getBundle();
      let nextState: GameState = {
        ...state,
        equipment: { ...state.equipment, [action.slot]: null },
        log: appendLog(state.log, `${action.slot} slot is now empty.`),
      };

      if (bundle) {
        const unequipResult = executeItemEventHooks([prevItemId], "on_unequip", nextState, bundle);
        nextState = mergeHookResult(nextState, unequipResult);
      }

      return nextState;
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

      playAmbient(targetRoom.ambientSound ?? "");

      return {
        ...state,
        currentRoomId: action.roomId,
        objects: nextObjects,
        selectedObjectId: nextObjects[0]?.id ?? null,
        action: null,
        exploreAction: null,
        autoSkillId: null,
        objectBatchStartedAt: state.now,
        weather: pickWeather(state.seed + action.roomId.length),
        destroyedObjectCues: [],
        log: appendLog(state.log, `Travelled to ${targetRoom.name}.`),
      };
    }

    case "TICK": {
      const now = action.now;
      const deltaSeconds = Math.max(0, (now - state.lastTickAt) / 1000);
      const gear = getEquipmentStats(state);
      const weatherMod = getWeatherModifiers(state.weather);

      let nextState: GameState = {
        ...state,
        now,
        lastTickAt: now,
        energy: Math.min(state.maxEnergy, state.energy + (state.baseEnergyRegen + gear.energyRegen) * weatherMod.energyRegenMult * deltaSeconds),
        health: Math.min(state.maxHealth, state.health + 0.5 * deltaSeconds),
        mana: Math.min(state.maxMana, state.mana + state.baseManaRegen * weatherMod.manaRegenMult * deltaSeconds),
        floatTexts: state.floatTexts.filter((entry) => now - entry.createdAt <= entry.durationMs),
        unlockCues: state.unlockCues.filter((entry) => entry.expiresAt > now),
        destroyedObjectCues: state.destroyedObjectCues.filter((entry) => entry.expiresAt > now),
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
          destroyedObjectCues: [],
          objectBatchStartedAt: now,
          log: appendLog(nextState.log, `Exploration #${nextExploreCount} generated ${nextObjects.length} objects.`),
        };

        // Fire on_explore hooks for equipped items
        const exploreBundle = getBundle();
        if (exploreBundle) {
          const equippedIds = Object.values(nextState.equipment).filter((v): v is string => Boolean(v));
          const exploreResult = executeItemEventHooks(equippedIds, "on_explore", nextState, exploreBundle);
          nextState = mergeHookResult(nextState, exploreResult);
        }
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
          const castDef = getBundle()?.skills.find((s) => s.id === nextState.autoSkillId);
          if (castDef?.castSound) playSound(castDef.castSound);
          nextState = {
            ...nextState,
            action: plan.action,
            energy: plan.nextEnergy,
          };
        }
      }

      // ── Status effect expiry ──
      const tickBundle = getBundle();
      if (tickBundle && (nextState.activeEffects ?? []).length > 0) {
        const ctx = buildEvalContext(nextState);
        const nextActiveEffects = (nextState.activeEffects ?? []).filter((active) => {
          const def = tickBundle.statusEffects?.find((s) => s.id === active.effectId);
          if (!def) return false;
          if (def.removalType === "timed" || def.removalType === "both") {
            if (def.durationMs != null && now - active.appliedAt >= def.durationMs) return false;
          }
          if (def.removalType === "conditional" || def.removalType === "both") {
            if (def.removeCondition && evaluateCondition(def.removeCondition, ctx)) return false;
          }
          return true;
        });
        if (nextActiveEffects.length !== (nextState.activeEffects ?? []).length) {
          nextState = { ...nextState, activeEffects: nextActiveEffects };
        }
      }

      // ── on_tick hooks for equipped items ──
      if (tickBundle) {
        const equippedIds = Object.values(nextState.equipment).filter((v): v is string => Boolean(v));
        const tickResult = executeItemEventHooks(equippedIds, "on_tick", nextState, tickBundle);
        if (tickResult.activeEffects || tickResult.playerStorage || tickResult.energy !== undefined) {
          nextState = mergeHookResult(nextState, tickResult);
        }
      }

      return nextState;
    }

    case "SET_RUNE": {
      const item = state.inventory.find((i) => i.id === action.itemId && i.slot === "rune");
      if (!item) return state;
      const runes = [...state.feyRunes] as [string | null, string | null, string | null, string | null, string | null, string | null];
      runes[action.slot] = item.id;
      return {
        ...state,
        feyRunes: runes,
        log: appendLog(state.log, `${item.name} set in rune slot ${action.slot + 1}.`),
      };
    }

    case "REMOVE_RUNE": {
      const currentId = state.feyRunes[action.slot];
      if (!currentId) return state;
      const name = state.inventory.find((i) => i.id === currentId)?.name ?? "Rune";
      const runes = [...state.feyRunes] as [string | null, string | null, string | null, string | null, string | null, string | null];
      runes[action.slot] = null;
      return {
        ...state,
        feyRunes: runes,
        log: appendLog(state.log, `${name} removed from rune slot ${action.slot + 1}.`),
      };
    }

    case "SET_BACKPACK_PAGE": {
      return { ...state, backpackPage: action.page };
    }

    default:
      return state;
  }
}
