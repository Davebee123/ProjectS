/**
 * Game reducer and all helper functions — extracted from App.tsx.
 */
import { getBundle, getWeatherDefs } from "../data/loader";
import {
  generateObjectsFromRoom,
  checkSkillUnlocks,
  createWorldObjectFromInteractableDef,
  getAvailableRecipes,
  rollLootDrops,
  resolveEquipmentItem,
  type SkillState,
  type InventoryItem,
  type EquipmentItemInstance,
  type WorldObject,
  type ComboRule,
} from "../data/bridge";
import { evaluateCondition } from "../data/evaluator";
import { playSound, playAmbient, playMusic } from "../audio";
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
  pushObjectEmoteCue,
  addUnlockCue,
  buildEvalContext,
  buildEvalContextForTarget,
  applyStatusEffect,
  removeStatusEffect,
  mergeInventoryItems,
  grantItemToInventories,
  awardSkillXp,
  executeEventActions,
  executeItemEventHooks,
  executeStatusEffectHooks,
  executeStatusEffectIntervalHooks,
  mergeHookResult,
} from "./utils";
import { isRoomReachable } from "./worldNavigation";
import { getSkillTickMoments } from "./skillTicks";
import { TRAVEL_DURATION_MS, TRAVEL_ENERGY_COST } from "./travel";
import { getVisibleQuestIds } from "./quests";

// ── Loaded game data (set once at startup) ──
let _combos: ComboRule[] = [];

export function setCombos(combos: ComboRule[]): void {
  _combos = combos;
}

// ── Weather ──

export function pickWeather(seed: number): WeatherType {
  const weathers = getWeatherDefs();
  if (weathers.length === 0) return "clear";

  const rng = seededRandom(seed + 777);
  const roll = rng();

  const totalWeight = weathers.reduce((sum, w) => sum + w.weight, 0);
  if (totalWeight <= 0) return weathers[0].id;

  let cumulative = 0;
  for (const w of weathers) {
    cumulative += w.weight / totalWeight;
    if (roll < cumulative) return w.id;
  }
  return weathers[weathers.length - 1].id;
}

const DEFAULT_MODIFIERS = { energyRegenMult: 1.0, manaRegenMult: 1.0, successChanceMod: 0 };

function playHostileSkillHitSound(skillId: string | undefined | null): void {
  if (!skillId) return;
  const hitSkillDef = getBundle()?.skills.find((entry) => entry.id === skillId);
  if (hitSkillDef?.hitSound) {
    playSound(hitSkillDef.hitSound, hitSkillDef.hitSoundVolume ?? 1);
  }
}

export function getWeatherModifiers(weather: WeatherType): {
  energyRegenMult: number;
  manaRegenMult: number;
  successChanceMod: number;
} {
  const def = getWeatherDefs().find((w) => w.id === weather);
  if (!def) return DEFAULT_MODIFIERS;
  return {
    energyRegenMult: def.energyRegenMult,
    manaRegenMult: def.manaRegenMult,
    successChanceMod: def.successChanceMod,
  };
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

function playerHasStatusRestriction(
  state: GameState,
  restriction: "preventsSpellCasting" | "preventsWeaponAbilities"
): boolean {
  const bundle = getBundle();
  if (!bundle || state.activeEffects.length === 0) {
    return false;
  }

  return state.activeEffects.some((active) => {
    const def = bundle.statusEffects.find((effect) => effect.id === active.effectId);
    return Boolean(def?.[restriction]);
  });
}

function isSpellSkill(skill: SkillState): boolean {
  return skill.system === "combat" && !skill.usageProfile?.weaponRequirement;
}

function isWeaponAbilitySkill(skill: SkillState): boolean {
  return skill.system === "combat" && Boolean(skill.usageProfile?.weaponRequirement);
}

function isPlayerSkillBlockedByStatus(state: GameState, skill: SkillState): boolean {
  if (isSpellSkill(skill) && playerHasStatusRestriction(state, "preventsSpellCasting")) {
    return true;
  }
  if (isWeaponAbilitySkill(skill) && playerHasStatusRestriction(state, "preventsWeaponAbilities")) {
    return true;
  }
  return false;
}

function getPlayerSkillBlockedMessage(state: GameState, skill: SkillState): string | null {
  if (isSpellSkill(skill) && playerHasStatusRestriction(state, "preventsSpellCasting")) {
    return `${skill.name} cannot be cast while spell casting is prevented.`;
  }
  if (isWeaponAbilitySkill(skill) && playerHasStatusRestriction(state, "preventsWeaponAbilities")) {
    return `${skill.name} cannot be used while weapon abilities are prevented.`;
  }
  return null;
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

function normalizeReceiptRarity(value: string | undefined): "common" | "uncommon" | "rare" {
  if (value === "uncommon") return "uncommon";
  if (value === "rare" || value === "epic" || value === "set" || value === "unique") return "rare";
  return "common";
}

function buildLootReceiptEntries(
  drops: WorldObject["drops"]
): GameState["lootReceiptCues"][number]["entries"] {
  const bundle = getBundle();
  if (!bundle || drops.length === 0) {
    return [];
  }

  return drops.flatMap((drop, index) => {
    if (drop.kind === "item") {
      const itemDef = bundle.items.find((item) => item.id === drop.id);
      return [{
        id: `${drop.id}_${index}`,
        name: itemDef?.name ?? drop.name,
        qty: drop.qty,
        image: itemDef?.image,
        rarityClass: normalizeReceiptRarity(itemDef?.rarity),
      }];
    }

    const firstEquipmentItem = drop.equipmentItems?.[0];
    const resolved = firstEquipmentItem ? resolveEquipmentItem(firstEquipmentItem, bundle) : null;
    return [{
      id: firstEquipmentItem?.instanceId ?? `${drop.id}_${index}`,
      name: resolved?.name ?? drop.name,
      qty: drop.qty,
      image: resolved?.image,
      rarityClass: normalizeReceiptRarity(resolved?.quality),
    }];
  });
}

function pushLootReceiptCue(
  state: GameState,
  drops: WorldObject["drops"],
  objectId: string
): GameState["lootReceiptCues"] {
  const entries = buildLootReceiptEntries(drops);
  const activeCues = state.lootReceiptCues.filter((cue) => cue.expiresAt > state.now);
  if (entries.length === 0) {
    return activeCues;
  }

  return [
    ...activeCues,
    {
      id: `loot_${state.now}_${Math.random().toString(36).slice(2, 8)}`,
      objectId,
      entries,
      appearsAt: state.now + 520,
      expiresAt: state.now + 4000,
    },
  ];
}

function pushQuestReceiptCues(
  _prevState: GameState,
  nextState: GameState
): Pick<GameState, "announcedQuestIds" | "questReceiptCues"> {
  const nextVisibleQuestIds = getVisibleQuestIds(nextState);
  const newQuestIds = nextVisibleQuestIds.filter(
    (questId) => !nextState.announcedQuestIds.includes(questId)
  );

  if (newQuestIds.length === 0) {
    return {
      announcedQuestIds: nextState.announcedQuestIds,
      questReceiptCues: nextState.questReceiptCues.filter((cue) => cue.expiresAt > nextState.now),
    };
  }

  const bundle = getBundle();
  const activeCues = nextState.questReceiptCues.filter((cue) => cue.expiresAt > nextState.now);
  const nextCues = newQuestIds
    .map((questId, index) => {
      const quest = bundle?.quests.find((entry) => entry.id === questId);
      if (!quest) {
        return null;
      }

      return {
        id: `quest_${questId}_${nextState.now}_${index}`,
        questId,
        name: quest.name,
        description: quest.description,
        appearsAt: nextState.now + 120,
        expiresAt: nextState.now + 3200,
      };
    })
    .filter((cue): cue is GameState["questReceiptCues"][number] => Boolean(cue));

  return {
    announcedQuestIds: Array.from(new Set([...nextState.announcedQuestIds, ...newQuestIds])),
    questReceiptCues: [...activeCues, ...nextCues].slice(-4),
  };
}

function resolveObjectDropsOnDestroy(
  state: GameState,
  targetObject: WorldObject
): WorldObject["drops"] {
  const bundle = getBundle();
  if (!bundle || !targetObject.interactableId) {
    return targetObject.drops;
  }

  const interactableDef = bundle.interactables.find((entry) => entry.id === targetObject.interactableId);
  if (!interactableDef) {
    return targetObject.drops;
  }

  return rollLootDrops(bundle, interactableDef, Math.random, buildEvalContext(state));
}

function getPermanentSpawnDefeatKey(object: WorldObject): string | null {
  if (!object.neverRespawnAfterDefeat || !object.sourceRoomId || !object.sourceSpawnEntryId) {
    return null;
  }
  return `spawn_defeated:${object.sourceRoomId}:${object.sourceSpawnEntryId}`;
}

function markSpawnDefeated(
  playerStorage: GameState["playerStorage"],
  object: WorldObject
): GameState["playerStorage"] {
  const interactableDefeatKey = object.interactableId
    ? `interactable_defeated:${object.interactableId}`
    : null;
  const defeatKey = getPermanentSpawnDefeatKey(object);
  const nextStorage =
    interactableDefeatKey
      ? {
          ...playerStorage,
          [interactableDefeatKey]:
            typeof playerStorage[interactableDefeatKey] === "number"
              ? (playerStorage[interactableDefeatKey] as number) + 1
              : 1,
        }
      : playerStorage;

  if (!defeatKey || nextStorage[defeatKey] === true) {
    return nextStorage;
  }
  return {
    ...nextStorage,
    [defeatKey]: true,
  };
}

function applyInteractableFormRules(state: GameState): GameState {
  const bundle = getBundle();
  if (!bundle || state.objects.length === 0) {
    return state;
  }

  const transformedIds = new Set<string>();
  let nextLog = state.log;
  const nextObjects = state.objects.map((object) => {
    const matchingRule = (object.formRules ?? []).find((rule) => {
      if (!rule.condition || !rule.interactableId || rule.interactableId === object.interactableId) {
        return false;
      }
      const ctx = buildEvalContextForTarget(state, {
        targetTag: object.tag,
        targetEffects: object.activeEffects,
      });
      return evaluateCondition(rule.condition, ctx);
    });

    if (!matchingRule) {
      return object;
    }

    const nextDef = bundle.interactables.find((entry) => entry.id === matchingRule.interactableId);
    if (!nextDef) {
      return object;
    }

    const integrityRatio = object.maxIntegrity > 0 ? object.integrity / object.maxIntegrity : 1;
    const transformed = createWorldObjectFromInteractableDef(bundle, nextDef, {
      id: object.id,
      integrityRatio,
      drops: object.drops,
      activeEffects: object.activeEffects,
      now: state.now,
    });

    transformedIds.add(object.id);
    nextLog = appendLog(nextLog, `${object.name} became ${nextDef.name}.`);
    return {
      ...transformed,
      sourceRoomId: object.sourceRoomId,
      sourceSpawnEntryId: object.sourceSpawnEntryId,
      neverRespawnAfterDefeat: object.neverRespawnAfterDefeat,
    };
  });

  if (transformedIds.size === 0) {
    return state;
  }

  const actionInvolved = (objectId: string | undefined) => Boolean(objectId && transformedIds.has(objectId));
  return {
    ...state,
    objects: nextObjects,
    action: actionInvolved(state.action?.objectId) ? null : state.action,
    weaponAction: actionInvolved(state.weaponAction?.objectId) ? null : state.weaponAction,
    hostileAction:
      actionInvolved(state.hostileAction?.objectId) || actionInvolved(state.hostileAction?.targetObjectId)
        ? null
        : state.hostileAction,
    friendlyAction:
      actionInvolved(state.friendlyAction?.objectId) || actionInvolved(state.friendlyAction?.targetObjectId)
        ? null
        : state.friendlyAction,
    log: nextLog,
  };
}

function isSideChopReady(state: GameState): boolean {
  return state.sidePrepUpwardStreak >= 2 && state.sidePrepDownwardHit;
}

function isChopBuffActive(state: GameState): boolean {
  return state.now < state.chopBuffUntil;
}

// ── Inventory helpers ──



// ── Equipment stats ──

function getEquippedItems(state: GameState): EquipmentItemInstance[] {
  const equipIds = Object.values(state.equipment).filter((value): value is string => Boolean(value));
  const runeIds = (state.feyRunes ?? []).filter((value): value is string => Boolean(value));
  const allIds = [...equipIds, ...runeIds];
  return allIds
    .map((instanceId) => state.inventoryEquipment.find((item) => item.instanceId === instanceId))
    .filter((item): item is EquipmentItemInstance => Boolean(item));
}

function getEquippedLegacyItemIds(state: GameState): string[] {
  return getEquippedItems(state)
    .map((item) => item.legacyItemId)
    .filter((itemId): itemId is string => Boolean(itemId));
}

function getResolvedMainHandWeapon(state: GameState) {
  const bundle = getBundle();
  if (!bundle) return null;
  const instanceId = state.equipment.mainHand;
  if (!instanceId) return null;
  const item = state.inventoryEquipment.find((entry) => entry.instanceId === instanceId);
  if (!item) return null;
  const resolved = resolveEquipmentItem(item, bundle);
  return resolved?.slot === "mainHand" ? resolved : null;
}

export function getEquipmentStats(state: GameState, targetTag?: string): {
  attack: number;
  activityPowerMultiplier: number;
  backpackSlotBonus: number;
  defense: number;
  damageReduction: number;
  energyRegen: number;
  speedMultiplier: number;
  energyCostMultiplier: number;
} {
  const bundle = getBundle();
  const equippedItems = bundle
    ? getEquippedItems(state)
        .map((item) => resolveEquipmentItem(item, bundle))
        .filter((item): item is NonNullable<ReturnType<typeof resolveEquipmentItem>> => Boolean(item))
    : [];
  const base = equippedItems.reduce(
    (stats, item) => {
      const attackTagsMatch = !item.attackTags || item.attackTags.length === 0 || (targetTag !== undefined && item.attackTags.includes(targetTag));
      for (const modifier of item.modifiers) {
          // Skip modifier if its scope has a targetTag that doesn't match
          if (modifier.scope?.targetTag && (targetTag === undefined || modifier.scope.targetTag !== targetTag)) continue;
          switch (modifier.statId) {
            case "flat_weapon_damage":
              if (!attackTagsMatch) break;
              if (modifier.operation === "add") stats.attack += modifier.value;
              else stats.attack *= modifier.value;
              break;
            case "all_damage_multiplier":
              if (modifier.operation === "multiply") stats.activityPowerMultiplier *= modifier.value;
              else stats.activityPowerMultiplier += modifier.value;
              break;
            case "backpack_slots":
              if (modifier.operation === "add") stats.backpackSlotBonus += modifier.value;
              else stats.backpackSlotBonus *= modifier.value;
              break;
            case "physical_resist":
              if (modifier.operation === "add") stats.defense += modifier.value;
              else stats.defense *= modifier.value;
              break;
          case "energy_regen":
            if (modifier.operation === "add") stats.energyRegen += modifier.value;
            else stats.energyRegen *= modifier.value;
            break;
          case "cast_time_multiplier":
            if (modifier.operation === "multiply") stats.speedMultiplier *= modifier.value;
            else stats.speedMultiplier += modifier.value;
            break;
          case "energy_cost_multiplier":
            if (modifier.operation === "multiply") stats.energyCostMultiplier *= modifier.value;
            else stats.energyCostMultiplier += modifier.value;
            break;
          case "damage_reduction":
            if (modifier.operation === "add") stats.damageReduction += modifier.value;
            else stats.damageReduction *= modifier.value;
            break;
        }
      }
      return stats;
    },
      {
        attack: 0,
        activityPowerMultiplier: 1,
        backpackSlotBonus: 0,
        defense: 0,
        damageReduction: 0,
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
            case "backpackSlots":
              if (mod.operation === "multiply") base.backpackSlotBonus *= Math.pow(mod.value, multiplier);
              else base.backpackSlotBonus += mod.value * multiplier;
              break;
            case "damageReduction":
              if (mod.operation === "add") base.damageReduction += mod.value * multiplier;
              else base.damageReduction *= Math.pow(mod.value, multiplier);
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
            case "backpackSlots": base.backpackSlotBonus += fx.value; break;
          }
        }
      }
    }

  return base;
}

export function getBackpackSlotCapacity(state: GameState): number {
  return Math.max(0, Math.floor(state.backpackSlots + getEquipmentStats(state).backpackSlotBonus));
}

function isEquipmentInstanceVisibleInBackpack(
  state: GameState,
  instanceId: string,
  slot: string | undefined
): boolean {
  if (!slot) {
    return true;
  }
  if (slot === "rune") {
    return !state.feyRunes.includes(instanceId);
  }
  return state.equipment[slot as keyof GameState["equipment"]] !== instanceId;
}

function getBackpackOccupancy(state: GameState): number {
  const bundle = getBundle();
  let occupied = state.inventory.length;

  if (!bundle) {
    return occupied + state.inventoryEquipment.length;
  }

  for (const item of state.inventoryEquipment) {
    const resolved = resolveEquipmentItem(item, bundle);
    if (!resolved) {
      occupied += 1;
      continue;
    }
    if (isEquipmentInstanceVisibleInBackpack(state, item.instanceId, resolved.slot)) {
      occupied += 1;
    }
  }

  return occupied;
}

function canApplyEquipmentChangeWithoutOverflow(
  state: GameState,
  nextEquipment: GameState["equipment"]
): { ok: boolean; occupied: number; capacity: number } {
  const nextState = {
    ...state,
    equipment: nextEquipment,
  };
  const occupied = getBackpackOccupancy(nextState);
  const capacity = getBackpackSlotCapacity(nextState);
  return {
    ok: occupied <= capacity,
    occupied,
    capacity,
  };
}

export function getActivityProgressValue(
  skill: SkillState,
  gear: ReturnType<typeof getEquipmentStats>
): number {
  const milestones = getActiveMilestoneModifiers(skill);
  const levelBonus = Math.max(0, skill.level - 1);
  const powerMin = skill.basePower + skill.powerPerLevel * levelBonus;
  const powerMax = (skill.basePowerMax ?? skill.basePower) + (skill.powerPerLevelMax ?? skill.powerPerLevel) * levelBonus;
  const scaled = powerMin < powerMax ? powerMin + Math.random() * (powerMax - powerMin) : powerMin;
  return Math.max(1, Math.round(((scaled + milestones.powerBonus) * milestones.powerMultiplier + gear.attack) * gear.activityPowerMultiplier));
}

// ── Cast metrics ──

function getCastMetrics(
  state: GameState,
  skill: SkillState,
  target: WorldObject,
  now: number
): CastMetrics {
  const gear = getEquipmentStats(state, target.tag);
  const combo =
    skill.id === "downward_chop" && state.downwardBonusReady
      ? findCombo(state.lastAction, skill.id, target.tag, now)
      : null;
  const isBonusDownward = skill.id === "downward_chop" && state.downwardBonusReady;
  const effectiveBaseDuration = isBonusDownward ? 2000 : skill.baseDurationMs;
  const comboTimeMultiplier = isBonusDownward ? 1 : combo?.timeMultiplier ?? 1;
  const comboEnergyMultiplier = isBonusDownward ? 1 : combo?.energyMultiplier ?? 1;
  const targetCtx = buildEvalContextForTarget(state, {
    targetTag: target.tag,
    targetEffects: target.activeEffects,
  });
  const activeStatusInteractions = (skill.statusInteractions ?? []).filter(
    (interaction) => !interaction.condition || evaluateCondition(interaction.condition, targetCtx)
  );
  const statusDurationMultiplier = activeStatusInteractions.reduce(
    (acc, interaction) => acc * (interaction.durationMultiplier ?? 1),
    1
  );
  const statusDurationBonus = activeStatusInteractions.reduce(
    (acc, interaction) => acc + (interaction.durationBonusMs ?? 0),
    0
  );
  const statusEnergyMultiplier = activeStatusInteractions.reduce(
    (acc, interaction) => acc * (interaction.energyMultiplier ?? 1),
    1
  );
  const statusEnergyBonus = activeStatusInteractions.reduce(
    (acc, interaction) => acc + (interaction.energyBonus ?? 0),
    0
  );
  const milestones = getActiveMilestoneModifiers(skill);
  const durationMs = Math.max(
    350,
    Math.round(
      effectiveBaseDuration *
      comboTimeMultiplier *
      statusDurationMultiplier *
      milestones.durationMultiplier *
      gear.speedMultiplier +
      statusDurationBonus
    )
  );
  const energyCost = Math.max(
    0,
    Math.round(
      (skill.baseEnergyCost + milestones.energyCostModifier) *
      comboEnergyMultiplier *
      statusEnergyMultiplier *
      gear.energyCostMultiplier +
      statusEnergyBonus
    )
  );
  const tickMomentsMs = getSkillTickMoments(skill, durationMs);

  return { durationMs, energyCost, tickMomentsMs, combo };
}

// ── Action planning ──

function makeActionPlan(state: GameState, skillId: string, now: number): ActionPlan | null {
  if (state.action) return null;
  if (state.exploreAction) return null;
  if (state.travelAction) return null;

  const target = state.objects.find((entry) => entry.id === state.selectedObjectId);
  if (!target) return null;

  const skill = state.skills.find((entry) => entry.id === skillId && entry.kind === "active");
  if (!skill) return null;
  if (!skill.unlocked) return null;
  if (isPlayerSkillBlockedByStatus(state, skill)) return null;
  if (skill.id === "side_chop" && !isSideChopReady(state)) return null;
  if (!canSkillBeUsedOnSelectedObject(skill, target)) return null;

  const metrics = getCastMetrics(state, skill, target, now);
  if (state.energy < metrics.energyCost) return null;
  const linkedPassive = skill.linkedPassiveId
    ? getSkill(state.skills, skill.linkedPassiveId)
    : null;
  const passiveLevel = linkedPassive?.level ?? 1;
  const successChance = getSuccessChance(passiveLevel, target.requiredLevel);
  const successRoll = Math.random() * 100 < successChance;

  return {
    action: {
      skillId: skill.id,
      objectId: target.id,
      startedAt: now,
      endsAt: now + metrics.durationMs,
      durationMs: metrics.durationMs,
      energyCost: metrics.energyCost,
      successRoll,
      tickMomentsMs: metrics.tickMomentsMs,
      resolvedTickCount: 0,
      comboLabel: metrics.combo?.label,
    },
    nextEnergy: state.energy - metrics.energyCost,
  };
}

function canSkillBeUsedOnSelectedObject(skill: SkillState, target: WorldObject): boolean {
  const isSelfTargetCombatSkill =
    skill.system === "combat" &&
    skill.usageProfile?.usageContext === "combat" &&
    skill.usageProfile?.targetPattern === "self";

  if (!isSelfTargetCombatSkill && !skill.tags.includes(target.tag)) {
    return false;
  }

  if (target.allowedAbilityTags.length > 0 && !target.allowedAbilityTags.some((tag) => skill.abilityTags.includes(tag))) {
    return false;
  }

  return true;
}

function isHostileCastingBlocked(state: GameState): boolean {
  return Boolean(state.activeCutscene || state.exploreAction || state.travelAction);
}

function isEnemyObject(object: WorldObject): boolean {
  return object.tag === "enemy";
}

function isFriendlyObject(object: WorldObject): boolean {
  return object.tag === "friendly";
}

function resolveObjectDialogueId(state: GameState, object: WorldObject): string | null {
  const routes = object.dialogueRoutes ?? [];
  if (routes.length > 0) {
    const ctx = buildEvalContextForTarget(state, {
      targetTag: object.tag,
      targetEffects: object.activeEffects,
    });
    for (const route of routes) {
      if (!route.dialogueId) {
        continue;
      }
      if (!route.condition || evaluateCondition(route.condition, ctx)) {
        return route.dialogueId;
      }
    }
  }
  return object.dialogueId ?? null;
}

type InteractableCombatTarget =
  | { kind: "player" }
  | { kind: "object"; objectId: string };

function getAliveObjectsByTag(
  state: GameState,
  tag: string,
  excludeObjectId?: string
): WorldObject[] {
  return state.objects.filter(
    (entry) => entry.tag === tag && entry.integrity > 0 && entry.id !== excludeObjectId
  );
}

function chooseRandomObject(objects: WorldObject[]): WorldObject | null {
  if (objects.length === 0) {
    return null;
  }
  return objects[Math.floor(Math.random() * objects.length)] ?? null;
}

function resolveInteractableAbilityTarget(
  state: GameState,
  sourceObject: WorldObject,
  ability: WorldObject["abilities"][number]
): InteractableCombatTarget | null {
  const targetMode = ability.targetMode ?? (isFriendlyObject(sourceObject) ? "selected_enemy" : "player");

  switch (targetMode) {
    case "player":
      return { kind: "player" };
    case "friendly_or_player": {
      const target = chooseRandomObject(getAliveObjectsByTag(state, "friendly", sourceObject.id));
      return target ? { kind: "object", objectId: target.id } : { kind: "player" };
    }
    case "selected_enemy": {
      const selectedTarget = state.objects.find((entry) => entry.id === state.selectedObjectId);
      if (selectedTarget && isEnemyObject(selectedTarget) && selectedTarget.integrity > 0) {
        return { kind: "object", objectId: selectedTarget.id };
      }
      const fallbackEnemy = getAliveObjectsByTag(state, "enemy", sourceObject.id)[0];
      return fallbackEnemy ? { kind: "object", objectId: fallbackEnemy.id } : null;
    }
    case "random_enemy": {
      const target = chooseRandomObject(getAliveObjectsByTag(state, "enemy", sourceObject.id));
      return target ? { kind: "object", objectId: target.id } : null;
    }
    case "lowest_hp_enemy": {
      const target = [...getAliveObjectsByTag(state, "enemy", sourceObject.id)].sort(
        (left, right) => left.integrity - right.integrity
      )[0];
      return target ? { kind: "object", objectId: target.id } : null;
    }
    case "highest_hp_enemy": {
      const target = [...getAliveObjectsByTag(state, "enemy", sourceObject.id)].sort(
        (left, right) => right.integrity - left.integrity
      )[0];
      return target ? { kind: "object", objectId: target.id } : null;
    }
    case "random_friendly": {
      const target = chooseRandomObject(getAliveObjectsByTag(state, "friendly", sourceObject.id));
      return target ? { kind: "object", objectId: target.id } : null;
    }
    case "lowest_hp_friendly": {
      const target = [...getAliveObjectsByTag(state, "friendly", sourceObject.id)].sort(
        (left, right) => left.integrity - right.integrity
      )[0];
      return target ? { kind: "object", objectId: target.id } : null;
    }
    case "highest_hp_friendly": {
      const target = [...getAliveObjectsByTag(state, "friendly", sourceObject.id)].sort(
        (left, right) => right.integrity - left.integrity
      )[0];
      return target ? { kind: "object", objectId: target.id } : null;
    }
    case "specific_interactable": {
      if (!ability.targetInteractableId) {
        return null;
      }
      const target = state.objects.find(
        (entry) =>
          entry.interactableId === ability.targetInteractableId &&
          entry.integrity > 0 &&
          entry.id !== sourceObject.id
      );
      return target ? { kind: "object", objectId: target.id } : null;
    }
    default:
      return null;
  }
}

function playRoomAudio(room: { backgroundMusic?: string; ambientSound?: string } | null | undefined): void {
  playMusic(room?.backgroundMusic ?? "");
  playAmbient(room?.ambientSound ?? "");
}

function playInteractableAbilityCastSound(
  state: GameState,
  plan: { objectId: string; skillId?: string }
): void {
  const bundle = getBundle();
  if (!bundle) {
    return;
  }

  const sourceObject = state.objects.find((entry) => entry.id === plan.objectId);
  const linkedSkill = plan.skillId
    ? bundle.skills.find((skill) => skill.id === plan.skillId)
    : undefined;

  if (linkedSkill?.castSound) {
    playSound(linkedSkill.castSound, linkedSkill.castSoundVolume ?? 1);
    return;
  }

  const sourceDef = sourceObject
    ? bundle.interactables.find((interactable) => interactable.id === sourceObject.interactableId)
    : undefined;
  if (sourceDef?.sounds?.onAbilityCast) {
    playSound(sourceDef.sounds.onAbilityCast, sourceDef.sounds.onAbilityCastVolume ?? 1);
  }
}

function canInteractableSkillTarget(
  state: GameState,
  linkedSkill: SkillState | null,
  target: InteractableCombatTarget | null
): boolean {
  if (!target) {
    return false;
  }
  if (!linkedSkill || target.kind === "player") {
    return true;
  }
  const targetObject = state.objects.find((entry) => entry.id === target.objectId);
  return Boolean(targetObject && linkedSkill.tags.includes(targetObject.tag));
}

function createHostileActionPlan(state: GameState, now: number): GameState["hostileAction"] {
  if (isHostileCastingBlocked(state) || state.health <= 0) {
    return null;
  }

  for (const object of state.objects) {
    if (!isEnemyObject(object) || resolveObjectDialogueId(state, object) || object.integrity <= 0 || object.abilities.length === 0) {
      continue;
    }

    const abilitySelection =
      object.abilityBehaviorMode === "sequence"
        ? (() => {
            const nextIndex = object.nextAbilityIndex;
            const ability = object.abilities[nextIndex];
            const linkedSkill = ability?.skillId ? getSkill(state.skills, ability.skillId) : null;
            const target = ability ? resolveInteractableAbilityTarget(state, object, ability) : null;
            return ability &&
              (object.abilityCooldowns[nextIndex] ?? 0) <= now &&
              canInteractableSkillTarget(state, linkedSkill, target)
              ? { abilityIndex: nextIndex, target }
              : null;
          })()
        : (() => {
            for (let index = 0; index < object.abilities.length; index += 1) {
              if ((object.abilityCooldowns[index] ?? 0) > now) {
                continue;
              }
              const ability = object.abilities[index];
              const linkedSkill = ability.skillId ? getSkill(state.skills, ability.skillId) : null;
              const target = resolveInteractableAbilityTarget(state, object, ability);
              if (canInteractableSkillTarget(state, linkedSkill, target)) {
                return { abilityIndex: index, target };
              }
            }
            return null;
          })();
    if (!abilitySelection) {
      continue;
    }

    const ability = object.abilities[abilitySelection.abilityIndex];
    const linkedSkill = ability.skillId ? getSkill(state.skills, ability.skillId) : null;
    const passive =
      abilitySelection.target?.kind === "player" && ability.resistedByPassiveId
        ? getSkill(state.skills, ability.resistedByPassiveId)
        : null;
    const durationMs = Math.max(0, ability.castTimeMs);
    const resistChance = passive
      ? Math.max(0, Math.min(95, passive.level * ability.resistChancePerLevel))
      : 0;
    const resisted =
      abilitySelection.target?.kind === "player" && resistChance > 0
        ? Math.random() * 100 < resistChance
        : false;
    return {
      objectId: object.id,
      targetObjectId:
        abilitySelection.target?.kind === "object" ? abilitySelection.target.objectId : undefined,
      abilityIndex: abilitySelection.abilityIndex,
      abilityName: ability.name,
      skillId: linkedSkill?.id,
      startedAt: now,
      endsAt: now + durationMs,
      durationMs,
      damage: ability.damage,
      resisted,
      tickMomentsMs: linkedSkill ? getSkillTickMoments(linkedSkill, durationMs) : [],
      resolvedTickCount: 0,
      damageDealt: 0,
    };
  }

  return null;
}

function createFriendlyActionPlan(state: GameState, now: number): GameState["friendlyAction"] {
  if (isHostileCastingBlocked(state) || state.health <= 0) {
    return null;
  }

  for (const object of state.objects) {
    if (!isFriendlyObject(object) || resolveObjectDialogueId(state, object) || object.integrity <= 0 || object.abilities.length === 0) {
      continue;
    }

    const abilitySelection =
      object.abilityBehaviorMode === "sequence"
        ? (() => {
            const nextIndex = object.nextAbilityIndex;
            const ability = object.abilities[nextIndex];
            const linkedSkill = ability?.skillId ? getSkill(state.skills, ability.skillId) : null;
            const target = ability ? resolveInteractableAbilityTarget(state, object, ability) : null;
            return ability &&
              target?.kind === "object" &&
              (object.abilityCooldowns[nextIndex] ?? 0) <= now &&
              canInteractableSkillTarget(state, linkedSkill, target)
              ? { abilityIndex: nextIndex, target }
              : null;
          })()
        : (() => {
            for (let index = 0; index < object.abilities.length; index += 1) {
              if ((object.abilityCooldowns[index] ?? 0) > now) {
                continue;
              }
              const ability = object.abilities[index];
              const linkedSkill = ability.skillId ? getSkill(state.skills, ability.skillId) : null;
              const target = resolveInteractableAbilityTarget(state, object, ability);
              if (target?.kind === "object" && canInteractableSkillTarget(state, linkedSkill, target)) {
                return { abilityIndex: index, target };
              }
            }
            return null;
          })();
    if (!abilitySelection || abilitySelection.target.kind !== "object") {
      continue;
    }

    const ability = object.abilities[abilitySelection.abilityIndex];
    const linkedSkill = ability.skillId
      ? getSkill(state.skills, ability.skillId)
      : null;
    const durationMs = Math.max(0, ability.castTimeMs);
    return {
      objectId: object.id,
      targetObjectId: abilitySelection.target.objectId,
      abilityIndex: abilitySelection.abilityIndex,
      abilityName: ability.name,
      skillId: linkedSkill?.id,
      startedAt: now,
      endsAt: now + durationMs,
      durationMs,
      damage: ability.damage,
      tickMomentsMs: linkedSkill ? getSkillTickMoments(linkedSkill, durationMs) : [],
      resolvedTickCount: 0,
      damageDealt: 0,
    };
  }

  return null;
}

/** Collect aggregated milestone bonuses for a skill at its current level. */
function getActiveMilestoneModifiers(skill: SkillState): {
  powerBonus: number;
  powerMultiplier: number;
  durationMultiplier: number;
  energyCostModifier: number;
  applyStatuses: Array<{ statusEffectId: string; chance: number }>;
} {
  const result = {
    powerBonus: 0,
    powerMultiplier: 1,
    durationMultiplier: 1,
    energyCostModifier: 0,
    applyStatuses: [] as Array<{ statusEffectId: string; chance: number }>,
  };
  for (const milestone of skill.perkMilestones ?? []) {
    if (skill.level < milestone.level || !milestone.effects) continue;
    for (const effect of milestone.effects) {
      switch (effect.type) {
        case "power_bonus":
          result.powerBonus += effect.value;
          break;
        case "power_multiplier":
          result.powerMultiplier *= effect.value;
          break;
        case "duration_multiplier":
          result.durationMultiplier *= effect.value;
          break;
        case "energy_cost_modifier":
          result.energyCostModifier += effect.value;
          break;
        case "apply_status":
          result.applyStatuses.push({
            statusEffectId: effect.statusEffectId,
            chance: effect.chance ?? 100,
          });
          break;
      }
    }
  }
  return result;
}

/** Roll a random power value between the skill's min and max, accounting for level scaling. */
function rollSkillPower(skill: SkillState, _abilityDamageOverride?: number): number {
  // Note: the legacy `abilityDamageOverride` arg is intentionally ignored so that
  // skill-based interactable abilities always use the skill's basePower/basePowerMax.
  // Non-skill abilities take a different code path and don't reach here.
  const levelBonus = Math.max(0, skill.level - 1);
  const min = skill.basePower + skill.powerPerLevel * levelBonus;
  const max = (skill.basePowerMax ?? skill.basePower) + (skill.powerPerLevelMax ?? skill.powerPerLevel) * levelBonus;
  if (min >= max) return min;
  return min + Math.random() * (max - min);
}

function getHostileSkillPulseImpact(
  state: GameState,
  skill: SkillState,
  sourceObject: WorldObject,
  ability: WorldObject["abilities"][number],
  options?: { splitAcrossTicks?: boolean; tickCount?: number }
): number {
  const effectCtx = buildEvalContextForTarget(state, {
    selfEffects: sourceObject.activeEffects,
    targetTag: "player",
    targetEffects: state.activeEffects,
  });
  const activeStatusInteractions = (skill.statusInteractions ?? []).filter(
    (interaction) => !interaction.condition || evaluateCondition(interaction.condition, effectCtx)
  );
  const powerMultiplier = activeStatusInteractions.reduce(
    (acc, interaction) => acc * (interaction.powerMultiplier ?? 1),
    1
  );
  const powerBonus = activeStatusInteractions.reduce(
    (acc, interaction) => acc + (interaction.powerBonus ?? 0),
    0
  );
  const milestones = getActiveMilestoneModifiers(skill);
  const basePower = rollSkillPower(skill, ability.damage);
  const fullImpact = Math.max(
    0,
    Math.round(((basePower || 0) + milestones.powerBonus) * milestones.powerMultiplier * powerMultiplier + powerBonus)
  );

  if (!options?.splitAcrossTicks || !options.tickCount || options.tickCount <= 0) {
    return fullImpact;
  }

  return fullImpact > 0
    ? Math.max(1, Math.round(fullImpact / options.tickCount))
    : 0;
}

function getFriendlySkillPulseImpact(
  state: GameState,
  skill: SkillState,
  sourceObject: WorldObject,
  targetObject: WorldObject,
  ability: WorldObject["abilities"][number],
  options?: { splitAcrossTicks?: boolean; tickCount?: number }
): number {
  const effectCtx = buildEvalContextForTarget(state, {
    selfEffects: sourceObject.activeEffects,
    targetTag: targetObject.tag,
    targetEffects: targetObject.activeEffects,
  });
  const activeStatusInteractions = (skill.statusInteractions ?? []).filter(
    (interaction) => !interaction.condition || evaluateCondition(interaction.condition, effectCtx)
  );
  const powerMultiplier = activeStatusInteractions.reduce(
    (acc, interaction) => acc * (interaction.powerMultiplier ?? 1),
    1
  );
  const powerBonus = activeStatusInteractions.reduce(
    (acc, interaction) => acc + (interaction.powerBonus ?? 0),
    0
  );
  const milestones = getActiveMilestoneModifiers(skill);
  const basePower = rollSkillPower(skill, ability.damage);
  const fullImpact = Math.max(
    0,
    Math.round(((basePower || 0) + milestones.powerBonus) * milestones.powerMultiplier * powerMultiplier + powerBonus)
  );

  if (!options?.splitAcrossTicks || !options.tickCount || options.tickCount <= 0) {
    return fullImpact;
  }

  return fullImpact > 0
    ? Math.max(1, Math.round(fullImpact / options.tickCount))
    : 0;
}

function pushSkillEffectObjectEmote(
  state: GameState,
  effect: NonNullable<SkillState["effects"]>[number],
  sourceObject: WorldObject | null,
  targetObject: WorldObject | null
): GameState {
  const text = effect.customText?.trim();
  if (!text) {
    return state;
  }
  const chance = Math.max(0, Math.min(100, effect.emoteChance ?? 100));
  if (chance <= 0 || Math.random() * 100 >= chance) {
    return state;
  }

  const objectId =
    effect.target === "self"
      ? sourceObject?.id
      : effect.target === "target"
        ? targetObject?.id
        : undefined;

  if (!objectId) {
    return state;
  }

  return {
    ...state,
    objectEmoteCues: pushObjectEmoteCue(
      state.objectEmoteCues,
      objectId,
      text,
      state.now,
      effect.durationMs
    ),
  };
}

function executeTriggeredHostileSkillEffects(
  state: GameState,
  sourceObject: WorldObject,
  ability: WorldObject["abilities"][number],
  skill: SkillState,
  trigger: "on_tick" | "on_cast_complete",
  options?: { resisted?: boolean; splitAcrossTicks?: boolean }
): { state: GameState; damageDealt: number; handledDamage: boolean } {
  const bundle = getBundle();
  if (!bundle) {
    return { state, damageDealt: 0, handledDamage: false };
  }

  let nextState = state;
  let damageDealt = 0;
  let handledDamage = false;

  const getCurrentSource = () =>
    nextState.objects.find((entry) => entry.id === sourceObject.id) ?? null;

  const matchingEffects = (skill.effects ?? []).filter((effect) => {
    if (effect.trigger !== trigger) {
      return false;
    }
    const currentSource = getCurrentSource();
    const effectCtx = buildEvalContextForTarget(nextState, {
      selfEffects: currentSource?.activeEffects ?? sourceObject.activeEffects,
      targetTag: "player",
      targetEffects: nextState.activeEffects,
    });
    return !effect.condition || evaluateCondition(effect.condition, effectCtx);
  });

  for (const effect of matchingEffects) {
    const currentSource = getCurrentSource();
    if (!currentSource) {
      break;
    }

    switch (effect.type) {
      case "damage": {
        handledDamage = true;
        const baseAmount =
          typeof effect.value === "number"
            ? Math.max(0, Math.round(effect.value))
            : getHostileSkillPulseImpact(nextState, skill, currentSource, ability, {
                splitAcrossTicks: options?.splitAcrossTicks,
                tickCount: options?.splitAcrossTicks ? state.hostileAction?.tickMomentsMs.length : undefined,
              });
        const amount =
          effect.target === "self"
            ? baseAmount
            : options?.resisted
              ? 0
              : baseAmount;
        const targetAction = effect.target === "self" ? "bearer" : "target";
        nextState = applyHookResultState(
          nextState,
          executeEventActions(
            [{ type: "damage", target: targetAction, value: amount }],
            nextState,
            bundle,
            {
              bearer: { kind: "object", objectId: currentSource.id },
              target: { kind: "player" },
            }
          )
        );
        if (targetAction === "target" && amount > 0) {
          damageDealt += amount;
          nextState = {
            ...nextState,
            playerHitCue: {
              id: `player_hit_${nextState.now}`,
              text: `-${amount}`,
              expiresAt: nextState.now + 900,
            },
            playerHitShakeUntil: nextState.now + 320,
          };
        }
        break;
      }

      case "apply_status":
      case "remove_status": {
        if (!effect.statusEffectId) {
          break;
        }
        nextState = applyHookResultState(
          nextState,
          executeEventActions(
            [{
              type: effect.type,
              target: effect.target === "self" ? "bearer" : "target",
              statusEffectId: effect.statusEffectId,
            }],
            nextState,
            bundle,
            {
              bearer: { kind: "object", objectId: currentSource.id },
              target: { kind: "player" },
            }
          )
        );
        break;
      }

      case "heal": {
        const amount = Math.max(0, Math.round(typeof effect.value === "number" ? effect.value : 0));
        if (amount <= 0) {
          break;
        }
        nextState = applyHookResultState(
          nextState,
          executeEventActions(
            [{
              type: "heal",
              target: effect.target === "self" ? "bearer" : "target",
              value: amount,
            }],
            nextState,
            bundle,
            {
              bearer: { kind: "object", objectId: currentSource.id },
              target: { kind: "player" },
            }
          )
        );
        break;
      }

      case "grant_resource":
      case "consume_resource": {
        if (effect.target === "self") {
          break;
        }
        const amount = Math.max(
          0,
          Math.round(
            typeof effect.resourceAmount === "number"
              ? effect.resourceAmount
              : typeof effect.value === "number"
                ? effect.value
                : 0
          )
        );
        if (amount <= 0) {
          break;
        }
        const resourceLabel = (effect.resourceLabel ?? "").toLowerCase();
        const actionType =
          effect.type === "grant_resource"
            ? resourceLabel === "mana"
              ? "restore_mana"
              : "restore_energy"
            : resourceLabel === "mana"
              ? "damage_mana"
              : "damage_energy";
        nextState = applyHookResultState(
          nextState,
          executeEventActions(
            [{ type: actionType, value: amount }],
            nextState,
            bundle,
            {
              bearer: { kind: "object", objectId: currentSource.id },
              target: { kind: "player" },
            }
          )
        );
        break;
      }

      case "show_emote": {
        nextState = pushSkillEffectObjectEmote(nextState, effect, currentSource, null);
        break;
      }

      default:
        break;
    }
  }

  return { state: nextState, damageDealt, handledDamage };
}

function executeTriggeredFriendlySkillEffects(
  state: GameState,
  sourceObject: WorldObject,
  targetObject: WorldObject,
  ability: WorldObject["abilities"][number],
  skill: SkillState,
  trigger: "on_tick" | "on_cast_complete",
  options?: { splitAcrossTicks?: boolean }
): { state: GameState; damageDealt: number; handledDamage: boolean } {
  const bundle = getBundle();
  if (!bundle) {
    return { state, damageDealt: 0, handledDamage: false };
  }

  let nextState = state;
  let damageDealt = 0;
  let handledDamage = false;

  const getCurrentSource = () =>
    nextState.objects.find((entry) => entry.id === sourceObject.id) ?? null;
  const getCurrentTarget = () =>
    nextState.objects.find((entry) => entry.id === targetObject.id) ?? null;

  const matchingEffects = (skill.effects ?? []).filter((effect) => {
    if (effect.trigger !== trigger) {
      return false;
    }
    const currentSource = getCurrentSource();
    const currentTarget = getCurrentTarget();
    const effectCtx = buildEvalContextForTarget(nextState, {
      selfEffects: currentSource?.activeEffects ?? sourceObject.activeEffects,
      targetTag: currentTarget?.tag ?? targetObject.tag,
      targetEffects: currentTarget?.activeEffects ?? targetObject.activeEffects,
    });
    return !effect.condition || evaluateCondition(effect.condition, effectCtx);
  });

  for (const effect of matchingEffects) {
    const currentSource = getCurrentSource();
    const currentTarget = getCurrentTarget();
    if (!currentSource || !currentTarget) {
      break;
    }

    switch (effect.type) {
      case "damage": {
        handledDamage = true;
        const amount =
          typeof effect.value === "number"
            ? Math.max(0, Math.round(effect.value))
            : getFriendlySkillPulseImpact(nextState, skill, currentSource, currentTarget, ability, {
                splitAcrossTicks: options?.splitAcrossTicks,
                tickCount: options?.splitAcrossTicks ? state.friendlyAction?.tickMomentsMs.length : undefined,
              });
        const targetAction = effect.target === "self" ? "bearer" : "target";
        nextState = applyHookResultState(
          nextState,
          executeEventActions(
            [{ type: "damage", target: targetAction, value: amount }],
            nextState,
            bundle,
            {
              bearer: { kind: "object", objectId: currentSource.id },
              target: { kind: "object", objectId: currentTarget.id },
            }
          )
        );
        if (amount > 0) {
          const floatTargetId = targetAction === "target" ? currentTarget.id : currentSource.id;
          nextState = {
            ...nextState,
            floatTexts: pushFloatingText(nextState.floatTexts, `-${amount}`, nextState.now, {
              durationMs: 1000,
              zone: "objects",
              objectId: floatTargetId,
            }),
          };
        }
        if (targetAction === "target" && amount > 0) {
          damageDealt += amount;
        }
        break;
      }

      case "apply_status":
      case "remove_status": {
        if (!effect.statusEffectId) {
          break;
        }
        nextState = applyHookResultState(
          nextState,
          executeEventActions(
            [{
              type: effect.type,
              target: effect.target === "self" ? "bearer" : "target",
              statusEffectId: effect.statusEffectId,
            }],
            nextState,
            bundle,
            {
              bearer: { kind: "object", objectId: currentSource.id },
              target: { kind: "object", objectId: currentTarget.id },
            }
          )
        );
        break;
      }

      case "heal": {
        const amount = Math.max(0, Math.round(typeof effect.value === "number" ? effect.value : 0));
        if (amount <= 0) {
          break;
        }
        nextState = applyHookResultState(
          nextState,
          executeEventActions(
            [{
              type: "heal",
              target: effect.target === "self" ? "bearer" : "target",
              value: amount,
            }],
            nextState,
            bundle,
            {
              bearer: { kind: "object", objectId: currentSource.id },
              target: { kind: "object", objectId: currentTarget.id },
            }
          )
        );
        break;
      }

      case "show_emote": {
        nextState = pushSkillEffectObjectEmote(nextState, effect, currentSource, currentTarget);
        break;
      }

      default:
        break;
    }
  }

  return { state: nextState, damageDealt, handledDamage };
}

function resolveDueHostileActionTicks(state: GameState): GameState {
  if (!state.hostileAction || state.hostileAction.tickMomentsMs.length === 0) {
    return state;
  }

  let nextState = state;

  while (
    nextState.hostileAction &&
    nextState.hostileAction.resolvedTickCount < nextState.hostileAction.tickMomentsMs.length
  ) {
    const nextTickMoment = nextState.hostileAction.tickMomentsMs[nextState.hostileAction.resolvedTickCount];
    if (nextState.now < nextState.hostileAction.startedAt + nextTickMoment) {
      break;
    }

    const sourceObject = nextState.objects.find((entry) => entry.id === nextState.hostileAction?.objectId);
    const targetObject = nextState.hostileAction?.targetObjectId
      ? nextState.objects.find((entry) => entry.id === nextState.hostileAction?.targetObjectId)
      : null;
    if (!sourceObject || (nextState.hostileAction?.targetObjectId && !targetObject)) {
      return { ...nextState, hostileAction: null };
    }

    const ability = sourceObject.abilities[nextState.hostileAction.abilityIndex];
    const linkedSkill = nextState.hostileAction.skillId
      ? getSkill(nextState.skills, nextState.hostileAction.skillId)
      : null;
    const currentHostileAction = nextState.hostileAction;
    if (!currentHostileAction) {
      return { ...nextState, hostileAction: null };
    }

    let nextHostileAction = {
      ...currentHostileAction,
      resolvedTickCount: currentHostileAction.resolvedTickCount + 1,
    };

    if (!linkedSkill || !ability) {
      nextState = { ...nextState, hostileAction: nextHostileAction };
      continue;
    }

    let tickDamageDealt = 0;
    if (targetObject) {
      const previousIntegrity = targetObject.integrity;
      const effectResult = executeTriggeredFriendlySkillEffects(
        nextState,
        sourceObject,
        targetObject,
        ability,
        linkedSkill,
        "on_tick",
        { splitAcrossTicks: true }
      );
      nextState = effectResult.state;
      tickDamageDealt = effectResult.damageDealt;

      if (!effectResult.handledDamage) {
        const currentSource = nextState.objects.find((entry) => entry.id === sourceObject.id) ?? sourceObject;
        const currentTarget = nextState.objects.find((entry) => entry.id === targetObject.id) ?? targetObject;
        const tickImpact = getFriendlySkillPulseImpact(nextState, linkedSkill, currentSource, currentTarget, ability, {
          splitAcrossTicks: true,
          tickCount: currentHostileAction.tickMomentsMs.length,
        });
        if (tickImpact > 0) {
          const remainingIntegrity = Math.max(0, currentTarget.integrity - tickImpact);
          nextState = {
            ...nextState,
            objects: nextState.objects.map((entry) =>
              entry.id === currentTarget.id
                ? { ...entry, integrity: remainingIntegrity }
                : entry
            ),
            floatTexts: pushFloatingText(
              nextState.floatTexts,
              `-${tickImpact}`,
              nextState.now,
              { durationMs: 1000, zone: "objects", objectId: currentTarget.id }
            ),
          };
          tickDamageDealt = tickImpact;
        }
      }

      if (tickDamageDealt > 0) {
        const hookBundle = getBundle();
        if (hookBundle) {
          nextState = applyHookResultState(
            nextState,
            executeStatusEffectHooks(
              { kind: "object", objectId: sourceObject.id },
              "on_hit",
              nextState,
              hookBundle,
              { kind: "object", objectId: targetObject.id }
            )
          );
          nextState = applyHookResultState(
            nextState,
            executeStatusEffectHooks(
              { kind: "object", objectId: targetObject.id },
              "on_damage_taken",
              nextState,
              hookBundle,
              { kind: "object", objectId: sourceObject.id }
            )
          );
        }
      }

      const latestTarget = nextState.objects.find((entry) => entry.id === targetObject.id);
      if (previousIntegrity > 0 && (latestTarget?.integrity ?? 0) <= 0) {
        const hookBundle = getBundle();
        if (hookBundle) {
          nextState = applyHookResultState(
            nextState,
            executeStatusEffectHooks(
              { kind: "object", objectId: sourceObject.id },
              "on_kill",
              nextState,
              hookBundle,
              { kind: "object", objectId: targetObject.id }
            )
          );
        }
      }
    } else {
      const previousHealth = nextState.health;
      const effectResult = executeTriggeredHostileSkillEffects(
        nextState,
        sourceObject,
        ability,
        linkedSkill,
        "on_tick",
        {
          resisted: currentHostileAction.resisted,
          splitAcrossTicks: true,
        }
      );
      nextState = effectResult.state;

      tickDamageDealt = effectResult.damageDealt;
      if (!effectResult.handledDamage && !currentHostileAction.resisted) {
        const currentSource = nextState.objects.find((entry) => entry.id === sourceObject.id) ?? sourceObject;
        const tickImpactRaw = getHostileSkillPulseImpact(nextState, linkedSkill, currentSource, ability, {
          splitAcrossTicks: true,
          tickCount: currentHostileAction.tickMomentsMs.length,
        });
        const tickImpact = Math.max(0, tickImpactRaw - getEquipmentStats(nextState).damageReduction);
        if (tickImpact > 0) {
          nextState = {
            ...nextState,
            health: Math.max(0, nextState.health - tickImpact),
            playerHitCue: {
              id: `player_hit_${nextState.now}`,
              text: `-${tickImpact}`,
              expiresAt: nextState.now + 900,
            },
            playerHitShakeUntil: nextState.now + 320,
          };
          tickDamageDealt = tickImpact;
        }
      }

      if (tickDamageDealt > 0) {
        if (nextState.health < previousHealth) {
          playHostileSkillHitSound(linkedSkill?.id ?? ability.skillId);
        }
        const hookBundle = getBundle();
        if (hookBundle) {
          nextState = applyHookResultState(
            nextState,
            executeStatusEffectHooks(
              { kind: "object", objectId: sourceObject.id },
              "on_hit",
              nextState,
              hookBundle,
              { kind: "player" }
            )
          );
          nextState = applyHookResultState(
            nextState,
            executeStatusEffectHooks(
              { kind: "player" },
              "on_damage_taken",
              nextState,
              hookBundle,
              { kind: "object", objectId: sourceObject.id }
            )
          );
        }
      }

      if (previousHealth > 0 && nextState.health <= 0) {
        let defeatState: GameState = {
          ...nextState,
          log: appendLog(nextState.log, "You were defeated."),
        };
        const hookBundle = getBundle();
        if (hookBundle) {
          defeatState = applyHookResultState(
            defeatState,
            executeStatusEffectHooks(
              { kind: "object", objectId: sourceObject.id },
              "on_kill",
              defeatState,
              hookBundle,
              { kind: "player" }
            )
          );
        }
        nextState = defeatState;
      }
    }

    nextHostileAction = {
      ...nextHostileAction,
      damageDealt: nextHostileAction.damageDealt + tickDamageDealt,
    };

    if ((targetObject && (nextState.objects.find((entry) => entry.id === targetObject.id)?.integrity ?? 0) <= 0) || (!targetObject && nextState.health <= 0)) {
      nextHostileAction = {
        ...nextHostileAction,
        endsAt: nextState.now,
      };
    }

    nextState = {
      ...nextState,
      hostileAction: nextHostileAction,
    };
  }

  return nextState;
}

function resolveCompletedHostileAction(state: GameState): GameState {
  if (!state.hostileAction) {
    return state;
  }

  const hostileAction = state.hostileAction;
  const sourceObject = state.objects.find((entry) => entry.id === hostileAction.objectId);
  const targetObject = hostileAction.targetObjectId
    ? state.objects.find((entry) => entry.id === hostileAction.targetObjectId)
    : null;
  if (!sourceObject || (hostileAction.targetObjectId && !targetObject)) {
    return { ...state, hostileAction: null };
  }

  const ability = sourceObject.abilities[hostileAction.abilityIndex];
  if (!ability) {
    return { ...state, hostileAction: null };
  }

  const actionHasTicks = hostileAction.tickMomentsMs.length > 0;
  const linkedSkill = hostileAction.skillId
    ? getSkill(state.skills, hostileAction.skillId)
    : null;

  if (targetObject) {
    let nextState: GameState = state;
    let completionDamage = 0;

    if (linkedSkill) {
      const interactionCtx = buildEvalContextForTarget(nextState, {
        selfEffects: sourceObject.activeEffects,
        targetTag: targetObject.tag,
        targetEffects: targetObject.activeEffects,
      });
      const activeStatusInteractions = (linkedSkill.statusInteractions ?? []).filter(
        (interaction) => !interaction.condition || evaluateCondition(interaction.condition, interactionCtx)
      );
      let nextSourceEffects = sourceObject.activeEffects ?? [];
      let nextTargetEffects = targetObject.activeEffects ?? [];
      const bundle = getBundle();

      for (const interaction of activeStatusInteractions) {
        if (interaction.consumeStatusEffectId) {
          if ((interaction.consumeStatusTarget ?? "target") === "self") {
            nextSourceEffects = removeStatusEffect(nextSourceEffects, interaction.consumeStatusEffectId);
          } else {
            nextTargetEffects = removeStatusEffect(nextTargetEffects, interaction.consumeStatusEffectId);
          }
        }

        if (interaction.applyStatusEffectId && bundle) {
          const effectDef = bundle.statusEffects.find((effect) => effect.id === interaction.applyStatusEffectId);
          if (!effectDef) {
            continue;
          }
          if ((interaction.applyStatusTarget ?? "target") === "self") {
            nextSourceEffects = applyStatusEffect(nextSourceEffects, effectDef, nextState.now);
          } else {
            nextTargetEffects = applyStatusEffect(nextTargetEffects, effectDef, nextState.now);
          }
        }
      }

      nextState = {
        ...nextState,
        objects: nextState.objects.map((entry) =>
          entry.id === sourceObject.id
            ? { ...entry, activeEffects: nextSourceEffects }
            : entry.id === targetObject.id
              ? { ...entry, activeEffects: nextTargetEffects }
              : entry
        ),
      };

      const effectResult = executeTriggeredFriendlySkillEffects(
        nextState,
        nextState.objects.find((entry) => entry.id === sourceObject.id) ?? sourceObject,
        nextState.objects.find((entry) => entry.id === targetObject.id) ?? targetObject,
        ability,
        linkedSkill,
        "on_cast_complete"
      );
      nextState = effectResult.state;
      completionDamage = effectResult.damageDealt;

      if (!effectResult.handledDamage && !actionHasTicks) {
        const currentSource = nextState.objects.find((entry) => entry.id === sourceObject.id) ?? sourceObject;
        const currentTarget = nextState.objects.find((entry) => entry.id === targetObject.id) ?? targetObject;
        const impact = getFriendlySkillPulseImpact(nextState, linkedSkill, currentSource, currentTarget, ability);
        if (impact > 0) {
          nextState = {
            ...nextState,
            objects: nextState.objects.map((entry) =>
              entry.id === currentTarget.id
                ? { ...entry, integrity: Math.max(0, entry.integrity - impact) }
                : entry
            ),
            floatTexts: pushFloatingText(nextState.floatTexts, `-${impact}`, nextState.now, {
              durationMs: 1000,
              zone: "objects",
              objectId: currentTarget.id,
            }),
          };
          completionDamage = impact;
        }
      }
    } else {
      completionDamage = Math.max(0, hostileAction.damage ?? 0);
      if (completionDamage > 0) {
        nextState = {
          ...nextState,
          objects: nextState.objects.map((entry) =>
            entry.id === targetObject.id
              ? { ...entry, integrity: Math.max(0, entry.integrity - completionDamage) }
              : entry
          ),
          floatTexts: pushFloatingText(nextState.floatTexts, `-${completionDamage}`, nextState.now, {
            durationMs: 1000,
            zone: "objects",
            objectId: targetObject.id,
          }),
        };
      }
    }

    if (completionDamage > 0) {
      const hookBundle = getBundle();
      if (hookBundle) {
        nextState = applyHookResultState(
          nextState,
          executeStatusEffectHooks(
            { kind: "object", objectId: sourceObject.id },
            "on_hit",
            nextState,
            hookBundle,
            { kind: "object", objectId: targetObject.id }
          )
        );
        nextState = applyHookResultState(
          nextState,
          executeStatusEffectHooks(
            { kind: "object", objectId: targetObject.id },
            "on_damage_taken",
            nextState,
            hookBundle,
            { kind: "object", objectId: sourceObject.id }
          )
        );
      }
    }

    const currentTarget = nextState.objects.find((entry) => entry.id === targetObject.id);
    if (targetObject.integrity > 0 && (currentTarget?.integrity ?? 0) <= 0) {
      const hookBundle = getBundle();
      if (hookBundle) {
        nextState = applyHookResultState(
          nextState,
          executeStatusEffectHooks(
            { kind: "object", objectId: sourceObject.id },
            "on_kill",
            nextState,
            hookBundle,
            { kind: "object", objectId: targetObject.id }
          )
        );
      }
    }

    nextState = {
      ...nextState,
      hostileAction: null,
      objects: nextState.objects.map((entry) =>
        entry.id === sourceObject.id
          ? {
              ...entry,
              abilityCooldowns: entry.abilityCooldowns.map((cooldownAt, index) =>
                index === hostileAction.abilityIndex ? state.now + ability.cooldownMs : cooldownAt
              ),
              nextAbilityIndex:
                entry.abilityBehaviorMode === "sequence" && entry.abilities.length > 0
                  ? (hostileAction.abilityIndex + 1) % entry.abilities.length
                  : entry.nextAbilityIndex,
            }
          : entry
      ),
      objectAttackCues: [
        ...nextState.objectAttackCues.filter((cue) => cue.objectId !== sourceObject.id),
        {
          id: `object_attack_${sourceObject.id}_${state.now}`,
          objectId: sourceObject.id,
          expiresAt: state.now + 380,
        },
      ],
    };

    return {
      ...nextState,
      log: appendLog(
        nextState.log,
        completionDamage > 0
          ? `${sourceObject.name} used ${ability.name} on ${targetObject.name} for ${hostileAction.damageDealt + completionDamage} damage.`
          : `${sourceObject.name} used ${ability.name} on ${targetObject.name}.`
      ),
    };
  }

  const healthBeforeCompletion = state.health;
  let nextState: GameState = state;
  let completionDamage = 0;

  if (linkedSkill) {
    const interactionCtx = buildEvalContextForTarget(nextState, {
      selfEffects: sourceObject.activeEffects,
      targetTag: "player",
      targetEffects: nextState.activeEffects,
    });
    const activeStatusInteractions = (linkedSkill.statusInteractions ?? []).filter(
      (interaction) => !interaction.condition || evaluateCondition(interaction.condition, interactionCtx)
    );
    let nextPlayerEffects = nextState.activeEffects ?? [];
    let nextSourceEffects = sourceObject.activeEffects ?? [];
    const bundle = getBundle();

    for (const interaction of activeStatusInteractions) {
      if (interaction.consumeStatusEffectId) {
        if ((interaction.consumeStatusTarget ?? "target") === "self") {
          nextSourceEffects = removeStatusEffect(nextSourceEffects, interaction.consumeStatusEffectId);
        } else {
          nextPlayerEffects = removeStatusEffect(nextPlayerEffects, interaction.consumeStatusEffectId);
        }
      }

      if (interaction.applyStatusEffectId && bundle) {
        const effectDef = bundle.statusEffects.find((effect) => effect.id === interaction.applyStatusEffectId);
        if (!effectDef) {
          continue;
        }
        if ((interaction.applyStatusTarget ?? "target") === "self") {
          nextSourceEffects = applyStatusEffect(nextSourceEffects, effectDef, nextState.now);
        } else {
          nextPlayerEffects = applyStatusEffect(nextPlayerEffects, effectDef, nextState.now);
        }
      }
    }

    nextState = {
      ...nextState,
      activeEffects: nextPlayerEffects,
      objects: nextState.objects.map((entry) =>
        entry.id === sourceObject.id
          ? { ...entry, activeEffects: nextSourceEffects }
          : entry
      ),
    };

    const effectResult = executeTriggeredHostileSkillEffects(
      nextState,
      nextState.objects.find((entry) => entry.id === sourceObject.id) ?? sourceObject,
      ability,
      linkedSkill,
      "on_cast_complete",
      { resisted: hostileAction.resisted }
    );
    nextState = effectResult.state;
    completionDamage = effectResult.damageDealt;

    if (!effectResult.handledDamage && !actionHasTicks && !hostileAction.resisted) {
      const currentSource = nextState.objects.find((entry) => entry.id === sourceObject.id) ?? sourceObject;
      const impactRaw = getHostileSkillPulseImpact(nextState, linkedSkill, currentSource, ability);
      const impact = Math.max(0, impactRaw - getEquipmentStats(nextState).damageReduction);
      if (impact > 0) {
        nextState = {
          ...nextState,
          health: Math.max(0, nextState.health - impact),
          playerHitCue: {
            id: `player_hit_${nextState.now}`,
            text: `-${impact}`,
            expiresAt: nextState.now + 900,
          },
          playerHitShakeUntil: nextState.now + 320,
        };
        completionDamage = impact;
      }
    }
  } else if (!hostileAction.resisted) {
    completionDamage = Math.max(0, (hostileAction.damage ?? 0) - getEquipmentStats(nextState).damageReduction);
    if (completionDamage > 0) {
      nextState = {
        ...nextState,
        health: Math.max(0, nextState.health - completionDamage),
        playerHitCue: {
          id: `player_hit_${nextState.now}`,
          text: `-${completionDamage}`,
          expiresAt: nextState.now + 900,
        },
        playerHitShakeUntil: nextState.now + 320,
      };
    }
  }

  const totalDamage = hostileAction.damageDealt + completionDamage;
  if (completionDamage > 0) {
    if (nextState.health < healthBeforeCompletion) {
      playHostileSkillHitSound(linkedSkill?.id ?? ability.skillId);
    }
    const hookBundle = getBundle();
    if (hookBundle) {
      nextState = applyHookResultState(
        nextState,
        executeStatusEffectHooks(
          { kind: "object", objectId: sourceObject.id },
          "on_hit",
          nextState,
          hookBundle,
          { kind: "player" }
        )
      );
      nextState = applyHookResultState(
        nextState,
        executeStatusEffectHooks(
          { kind: "player" },
          "on_damage_taken",
          nextState,
          hookBundle,
          { kind: "object", objectId: sourceObject.id }
        )
      );
    }
  }

  nextState = {
    ...nextState,
    hostileAction: null,
    objects: nextState.objects.map((entry) =>
      entry.id === sourceObject.id
        ? {
            ...entry,
            abilityCooldowns: entry.abilityCooldowns.map((cooldownAt, index) =>
              index === hostileAction.abilityIndex ? state.now + ability.cooldownMs : cooldownAt
            ),
            nextAbilityIndex:
              entry.abilityBehaviorMode === "sequence" && entry.abilities.length > 0
                ? (hostileAction.abilityIndex + 1) % entry.abilities.length
                : entry.nextAbilityIndex,
          }
        : entry
    ),
    objectAttackCues: [
      ...nextState.objectAttackCues.filter((cue) => cue.objectId !== sourceObject.id),
      {
        id: `object_attack_${sourceObject.id}_${state.now}`,
        objectId: sourceObject.id,
        expiresAt: state.now + 380,
      },
    ],
  };

  let nextLog = appendLog(
    nextState.log,
    hostileAction.resisted && totalDamage === 0
      ? `You resisted the damage from ${sourceObject.name}'s ${ability.name}.`
      : totalDamage > 0
        ? `${sourceObject.name} used ${ability.name} for ${totalDamage} damage.`
        : `${sourceObject.name} used ${ability.name}.`
  );

  if (healthBeforeCompletion > 0 && nextState.health <= 0) {
    nextLog = appendLog(nextLog, "You were defeated.");
    const hookBundle = getBundle();
    if (hookBundle) {
      nextState = applyHookResultState(
        { ...nextState, log: nextLog },
        executeStatusEffectHooks(
          { kind: "object", objectId: sourceObject.id },
          "on_kill",
          { ...nextState, log: nextLog },
          hookBundle,
          { kind: "player" }
        )
      );
      nextLog = nextState.log;
    }
  }

  return {
    ...nextState,
    log: nextLog,
  };
}

function resolveDueFriendlyActionTicks(state: GameState): GameState {
  if (!state.friendlyAction || state.friendlyAction.tickMomentsMs.length === 0) {
    return state;
  }

  let nextState = state;

  while (
    nextState.friendlyAction &&
    nextState.friendlyAction.resolvedTickCount < nextState.friendlyAction.tickMomentsMs.length
  ) {
    const nextTickMoment = nextState.friendlyAction.tickMomentsMs[nextState.friendlyAction.resolvedTickCount];
    if (nextState.now < nextState.friendlyAction.startedAt + nextTickMoment) {
      break;
    }

    const sourceObject = nextState.objects.find((entry) => entry.id === nextState.friendlyAction?.objectId);
    const targetObject = nextState.objects.find((entry) => entry.id === nextState.friendlyAction?.targetObjectId);
    if (!sourceObject || !targetObject) {
      return { ...nextState, friendlyAction: null };
    }

    const ability = sourceObject.abilities[nextState.friendlyAction.abilityIndex];
    const linkedSkill = nextState.friendlyAction.skillId
      ? getSkill(nextState.skills, nextState.friendlyAction.skillId)
      : null;
    const currentFriendlyAction = nextState.friendlyAction;
    if (!currentFriendlyAction) {
      return { ...nextState, friendlyAction: null };
    }

    let nextFriendlyAction = {
      ...currentFriendlyAction,
      resolvedTickCount: currentFriendlyAction.resolvedTickCount + 1,
    };

    if (!linkedSkill || !ability) {
      nextState = { ...nextState, friendlyAction: nextFriendlyAction };
      continue;
    }

    const previousIntegrity = targetObject.integrity;
    const effectResult = executeTriggeredFriendlySkillEffects(
      nextState,
      sourceObject,
      targetObject,
      ability,
      linkedSkill,
      "on_tick",
      { splitAcrossTicks: true }
    );
    nextState = effectResult.state;

    let tickDamageDealt = effectResult.damageDealt;
    if (!effectResult.handledDamage) {
      const currentSource = nextState.objects.find((entry) => entry.id === sourceObject.id) ?? sourceObject;
      const currentTarget = nextState.objects.find((entry) => entry.id === targetObject.id) ?? targetObject;
      const tickImpact = getFriendlySkillPulseImpact(nextState, linkedSkill, currentSource, currentTarget, ability, {
        splitAcrossTicks: true,
        tickCount: currentFriendlyAction.tickMomentsMs.length,
      });
      if (tickImpact > 0) {
        const remainingIntegrity = Math.max(0, currentTarget.integrity - tickImpact);
        nextState = {
          ...nextState,
          objects: nextState.objects.map((entry) =>
            entry.id === currentTarget.id
              ? { ...entry, integrity: remainingIntegrity }
              : entry
          ),
          floatTexts: pushFloatingText(
            nextState.floatTexts,
            `-${tickImpact}`,
            nextState.now,
            { durationMs: 1000, zone: "objects", objectId: currentTarget.id }
          ),
        };
        tickDamageDealt = tickImpact;
      }
    }

    if (tickDamageDealt > 0) {
      const hookBundle = getBundle();
      if (hookBundle) {
        nextState = applyHookResultState(
          nextState,
          executeStatusEffectHooks(
            { kind: "object", objectId: sourceObject.id },
            "on_hit",
            nextState,
            hookBundle,
            { kind: "object", objectId: targetObject.id }
          )
        );
        nextState = applyHookResultState(
          nextState,
          executeStatusEffectHooks(
            { kind: "object", objectId: targetObject.id },
            "on_damage_taken",
            nextState,
            hookBundle,
            { kind: "object", objectId: sourceObject.id }
          )
        );
      }
    }

    const latestTarget = nextState.objects.find((entry) => entry.id === targetObject.id);
    if (previousIntegrity > 0 && (latestTarget?.integrity ?? 0) <= 0) {
      const hookBundle = getBundle();
      if (hookBundle) {
        nextState = applyHookResultState(
          nextState,
          executeStatusEffectHooks(
            { kind: "object", objectId: sourceObject.id },
            "on_kill",
            nextState,
            hookBundle,
            { kind: "object", objectId: targetObject.id }
          )
        );
      }
    }

    nextFriendlyAction = {
      ...nextFriendlyAction,
      damageDealt: nextFriendlyAction.damageDealt + tickDamageDealt,
    };

    if ((latestTarget?.integrity ?? 0) <= 0) {
      nextFriendlyAction = {
        ...nextFriendlyAction,
        endsAt: nextState.now,
      };
    }

    nextState = {
      ...nextState,
      friendlyAction: nextFriendlyAction,
    };
  }

  return nextState;
}

function resolveCompletedFriendlyAction(state: GameState): GameState {
  if (!state.friendlyAction) {
    return state;
  }

  const friendlyAction = state.friendlyAction;
  const sourceObject = state.objects.find((entry) => entry.id === friendlyAction.objectId);
  const targetObject = state.objects.find((entry) => entry.id === friendlyAction.targetObjectId);
  if (!sourceObject || !targetObject) {
    return { ...state, friendlyAction: null };
  }

  const ability = sourceObject.abilities[friendlyAction.abilityIndex];
  if (!ability) {
    return { ...state, friendlyAction: null };
  }

  const actionHasTicks = friendlyAction.tickMomentsMs.length > 0;
  const linkedSkill = friendlyAction.skillId
    ? getSkill(state.skills, friendlyAction.skillId)
    : null;
  let nextState: GameState = state;
  let completionDamage = 0;

  if (linkedSkill) {
    const interactionCtx = buildEvalContextForTarget(nextState, {
      selfEffects: sourceObject.activeEffects,
      targetTag: targetObject.tag,
      targetEffects: targetObject.activeEffects,
    });
    const activeStatusInteractions = (linkedSkill.statusInteractions ?? []).filter(
      (interaction) => !interaction.condition || evaluateCondition(interaction.condition, interactionCtx)
    );
    let nextSourceEffects = sourceObject.activeEffects ?? [];
    let nextTargetEffects = targetObject.activeEffects ?? [];
    const bundle = getBundle();

    for (const interaction of activeStatusInteractions) {
      if (interaction.consumeStatusEffectId) {
        if ((interaction.consumeStatusTarget ?? "target") === "self") {
          nextSourceEffects = removeStatusEffect(nextSourceEffects, interaction.consumeStatusEffectId);
        } else {
          nextTargetEffects = removeStatusEffect(nextTargetEffects, interaction.consumeStatusEffectId);
        }
      }

      if (interaction.applyStatusEffectId && bundle) {
        const effectDef = bundle.statusEffects.find((effect) => effect.id === interaction.applyStatusEffectId);
        if (!effectDef) {
          continue;
        }
        if ((interaction.applyStatusTarget ?? "target") === "self") {
          nextSourceEffects = applyStatusEffect(nextSourceEffects, effectDef, nextState.now);
        } else {
          nextTargetEffects = applyStatusEffect(nextTargetEffects, effectDef, nextState.now);
        }
      }
    }

    nextState = {
      ...nextState,
      objects: nextState.objects.map((entry) =>
        entry.id === sourceObject.id
          ? { ...entry, activeEffects: nextSourceEffects }
          : entry.id === targetObject.id
            ? { ...entry, activeEffects: nextTargetEffects }
            : entry
      ),
    };

    const effectResult = executeTriggeredFriendlySkillEffects(
      nextState,
      nextState.objects.find((entry) => entry.id === sourceObject.id) ?? sourceObject,
      nextState.objects.find((entry) => entry.id === targetObject.id) ?? targetObject,
      ability,
      linkedSkill,
      "on_cast_complete"
    );
    nextState = effectResult.state;
    completionDamage = effectResult.damageDealt;

    if (!effectResult.handledDamage && !actionHasTicks) {
      const currentSource = nextState.objects.find((entry) => entry.id === sourceObject.id) ?? sourceObject;
      const currentTarget = nextState.objects.find((entry) => entry.id === targetObject.id) ?? targetObject;
      const impact = getFriendlySkillPulseImpact(nextState, linkedSkill, currentSource, currentTarget, ability);
      if (impact > 0) {
        nextState = {
          ...nextState,
          objects: nextState.objects.map((entry) =>
            entry.id === currentTarget.id
              ? { ...entry, integrity: Math.max(0, entry.integrity - impact) }
              : entry
          ),
          floatTexts: pushFloatingText(nextState.floatTexts, `-${impact}`, nextState.now, {
            durationMs: 1000,
            zone: "objects",
            objectId: currentTarget.id,
          }),
        };
        completionDamage = impact;
      }
    }
  } else {
    completionDamage = Math.max(0, friendlyAction.damage ?? 0);
    if (completionDamage > 0) {
      nextState = {
        ...nextState,
        objects: nextState.objects.map((entry) =>
          entry.id === targetObject.id
            ? { ...entry, integrity: Math.max(0, entry.integrity - completionDamage) }
            : entry
        ),
        floatTexts: pushFloatingText(nextState.floatTexts, `-${completionDamage}`, nextState.now, {
          durationMs: 1000,
          zone: "objects",
          objectId: targetObject.id,
        }),
      };
    }
  }

  if (completionDamage > 0) {
    const hookBundle = getBundle();
    if (hookBundle) {
      nextState = applyHookResultState(
        nextState,
        executeStatusEffectHooks(
          { kind: "object", objectId: sourceObject.id },
          "on_hit",
          nextState,
          hookBundle,
          { kind: "object", objectId: targetObject.id }
        )
      );
      nextState = applyHookResultState(
        nextState,
        executeStatusEffectHooks(
          { kind: "object", objectId: targetObject.id },
          "on_damage_taken",
          nextState,
          hookBundle,
          { kind: "object", objectId: sourceObject.id }
        )
      );
    }
  }

  const currentTarget = nextState.objects.find((entry) => entry.id === targetObject.id);
  if (targetObject.integrity > 0 && (currentTarget?.integrity ?? 0) <= 0) {
    const hookBundle = getBundle();
    if (hookBundle) {
      nextState = applyHookResultState(
        nextState,
        executeStatusEffectHooks(
          { kind: "object", objectId: sourceObject.id },
          "on_kill",
          nextState,
          hookBundle,
          { kind: "object", objectId: targetObject.id }
        )
      );
    }
  }

  nextState = {
    ...nextState,
    friendlyAction: null,
    objects: nextState.objects.map((entry) =>
      entry.id === sourceObject.id
        ? {
            ...entry,
            abilityCooldowns: entry.abilityCooldowns.map((cooldownAt, index) =>
              index === friendlyAction.abilityIndex ? state.now + ability.cooldownMs : cooldownAt
            ),
            nextAbilityIndex:
              entry.abilityBehaviorMode === "sequence" && entry.abilities.length > 0
                ? (friendlyAction.abilityIndex + 1) % entry.abilities.length
                : entry.nextAbilityIndex,
          }
        : entry
    ),
    objectAttackCues: [
      ...nextState.objectAttackCues.filter((cue) => cue.objectId !== sourceObject.id),
      {
        id: `object_attack_${sourceObject.id}_${state.now}`,
        objectId: sourceObject.id,
        expiresAt: state.now + 380,
      },
    ],
  };

  return {
    ...nextState,
    log: appendLog(
      nextState.log,
      completionDamage > 0
        ? `${sourceObject.name} used ${ability.name} on ${targetObject.name} for ${friendlyAction.damageDealt + completionDamage} damage.`
        : `${sourceObject.name} used ${ability.name} on ${targetObject.name}.`
    ),
  };
}

function isWeaponAutoBlocked(state: GameState): boolean {
  return Boolean(
    state.activeCutscene ||
      state.exploreAction ||
      state.travelAction ||
      state.health <= 0 ||
      playerHasStatusRestriction(state, "preventsWeaponAbilities")
  );
}

function createWeaponActionPlan(state: GameState, now: number): GameState["weaponAction"] {
  // Weapon combat is authored through skills. Weapons no longer create automatic attacks.
  void state;
  void now;
  return null;
}

function resolveCompletedWeaponAction(state: GameState): GameState {
  if (!state.weaponAction) {
    return state;
  }

  const weaponAction = state.weaponAction;
  const targetObject = state.objects.find((entry) => entry.id === weaponAction.objectId);
  if (!targetObject || targetObject.id !== state.selectedObjectId || targetObject.tag !== "enemy") {
    return {
      ...state,
      weaponAction: null,
    };
  }

  const remainingIntegrity = Math.max(0, targetObject.integrity - weaponAction.damage);
  const bundle = getBundle();
  const interactableDef = bundle?.interactables.find((entry) => entry.id === targetObject.interactableId);
  if (weaponAction.damage > 0 && interactableDef?.sounds?.onHit) {
    playSound(interactableDef.sounds.onHit, interactableDef.sounds.onHitVolume ?? 1);
  }

  let nextState: GameState = {
    ...state,
    objects: state.objects.map((entry) =>
      entry.id === targetObject.id
        ? { ...entry, integrity: remainingIntegrity }
        : entry
    ),
    weaponAction: null,
    weaponAttackAnimateUntil: weaponAction.damage > 0 ? state.now + 240 : state.weaponAttackAnimateUntil,
    floatTexts:
      weaponAction.damage > 0
        ? pushFloatingText(
            state.floatTexts,
            `-${weaponAction.damage}`,
            state.now,
            { durationMs: 1000, zone: "objects", objectId: targetObject.id }
          )
        : state.floatTexts,
    log: appendLog(
      state.log,
      `${weaponAction.weaponName} hit ${targetObject.name} for ${weaponAction.damage}.`
    ),
  };

  if (weaponAction.damage > 0 && bundle) {
    nextState = applyHookResultState(
      nextState,
      executeStatusEffectHooks(
        { kind: "player" },
        "on_hit",
        nextState,
        bundle,
        { kind: "object", objectId: targetObject.id }
      )
    );
    nextState = applyHookResultState(
      nextState,
      executeStatusEffectHooks(
        { kind: "object", objectId: targetObject.id },
        "on_damage_taken",
        nextState,
        bundle,
        { kind: "player" }
      )
    );
  }

  const currentTarget = nextState.objects.find((entry) => entry.id === targetObject.id);
  if ((currentTarget?.integrity ?? remainingIntegrity) > 0) {
    return nextState;
  }

  const resolvedDrops = resolveObjectDropsOnDestroy(nextState, targetObject);
  const stackableDrops = resolvedDrops.flatMap((drop) =>
    drop.kind === "item" && drop.inventoryItem ? [drop.inventoryItem] : []
  );
  const equipmentDrops = resolvedDrops.flatMap((drop) =>
    drop.kind === "equipment" ? (drop.equipmentItems ?? []) : []
  );
  const updatedInventory = mergeInventoryItems(nextState.inventory, stackableDrops);
  const updatedEquipmentInventory = [...nextState.inventoryEquipment, ...equipmentDrops];
  const destroyedIndex = state.objects.findIndex((entry) => entry.id === targetObject.id);

  let nextLog = appendLog(nextState.log, `${targetObject.name} defeated.`);
  for (const drop of resolvedDrops) {
    nextState = {
      ...nextState,
      floatTexts: pushFloatingText(nextState.floatTexts, `+${drop.qty} ${drop.name}`, state.now, {
        zone: "objects",
      }),
    };
  }
  if (resolvedDrops.length > 0) {
    const dropText = resolvedDrops.map((drop) => `${drop.qty} ${drop.name}`).join(", ");
    nextLog = appendLog(nextLog, `${targetObject.name} dropped ${dropText}.`);
  }
  if (interactableDef?.sounds?.onDestroy) {
    playSound(interactableDef.sounds.onDestroy, interactableDef.sounds.onDestroyVolume ?? 1);
  }

  const nextPlayerStorage = markSpawnDefeated(nextState.playerStorage, targetObject);

  let finalState: GameState = {
    ...nextState,
    playerStorage: nextPlayerStorage,
    inventory: updatedInventory,
    inventoryEquipment: updatedEquipmentInventory,
    objects: nextState.objects.filter((entry) => entry.id !== targetObject.id),
    action: state.action?.objectId === targetObject.id ? null : state.action,
    hostileAction:
      state.hostileAction?.objectId === targetObject.id || state.hostileAction?.targetObjectId === targetObject.id
        ? null
        : state.hostileAction,
    friendlyAction:
      state.friendlyAction?.objectId === targetObject.id || state.friendlyAction?.targetObjectId === targetObject.id
        ? null
        : state.friendlyAction,
    weaponAttackAnimateUntil: weaponAction.damage > 0 ? state.now + 240 : state.weaponAttackAnimateUntil,
    selectedObjectId: state.selectedObjectId === targetObject.id ? null : state.selectedObjectId,
    activeDialogue: state.selectedObjectId === targetObject.id ? null : state.activeDialogue,
    destroyedObjectCues: [
      ...state.destroyedObjectCues,
      {
        object: { ...targetObject, integrity: 0 },
        createdAt: state.now,
        expiresAt: state.now + 4600,
        index: destroyedIndex >= 0 ? destroyedIndex : state.objects.length,
      },
    ],
    lootReceiptCues: pushLootReceiptCue(state, resolvedDrops, targetObject.id),
    log: nextLog,
  };

  if (bundle) {
    finalState = applyHookResultState(
      finalState,
      executeStatusEffectHooks(
        { kind: "player" },
        "on_kill",
        finalState,
        bundle,
        { kind: "object", objectId: targetObject.id }
      )
    );
  }

  return finalState;
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

  const objects = generateObjectsFromRoom(
    bundle,
    roomId,
    room.spawnTable,
    bundle.interactables,
    seed,
    rng,
    ctx,
    state.now
  );

  // Prepend fixed interactables (always present, condition-gated)
  const fixedObjects: WorldObject[] = [];
  for (const fixed of room.fixedInteractables ?? []) {
    if (fixed.condition && !evaluateCondition(fixed.condition, ctx)) continue;
    const def = bundle.interactables.find((d) => d.id === fixed.interactableId);
    if (!def) continue;
    fixedObjects.push(
      createWorldObjectFromInteractableDef(bundle, def, {
        id: `fixed_${def.id}_${roomId}`,
        drops: [],
        now: state.now,
      })
    );
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

function getActionPulseImpact(
  state: GameState,
  skill: SkillState,
  targetObject: WorldObject,
  options?: { splitAcrossTicks?: boolean }
): number {
  const gear = getEquipmentStats(state, targetObject.tag);
  const baseImpact = getActivityProgressValue(skill, gear);
  const chopBonus = skill.abilityTags.includes("chop") && isChopBuffActive(state) ? 2 : 0;
  const targetCtx = buildEvalContextForTarget(state, {
    targetTag: targetObject.tag,
    targetEffects: targetObject.activeEffects,
  });
  const activeStatusInteractions = (skill.statusInteractions ?? []).filter(
    (interaction) => !interaction.condition || evaluateCondition(interaction.condition, targetCtx)
  );
  const powerMultiplier = activeStatusInteractions.reduce(
    (acc, interaction) => acc * (interaction.powerMultiplier ?? 1),
    1
  );
  const powerBonus = activeStatusInteractions.reduce(
    (acc, interaction) => acc + (interaction.powerBonus ?? 0),
    0
  );
  const fullImpact = Math.max(0, Math.round((baseImpact + chopBonus) * powerMultiplier + powerBonus));

  if (!options?.splitAcrossTicks || !state.action || state.action.tickMomentsMs.length === 0) {
    return fullImpact;
  }

  return fullImpact > 0
    ? Math.max(1, Math.round(fullImpact / state.action.tickMomentsMs.length))
    : 0;
}

function executeTriggeredSkillEffects(
  state: GameState,
  skill: SkillState,
  targetObject: WorldObject,
  trigger: "on_tick" | "on_cast_complete"
): { state: GameState; damageDealt: number; handledDamage: boolean } {
  const bundle = getBundle();
  if (!bundle) {
    return { state, damageDealt: 0, handledDamage: false };
  }

  let nextState = state;
  let damageDealt = 0;
  let handledDamage = false;

  const getCurrentTarget = () =>
    nextState.objects.find((entry) => entry.id === targetObject.id) ?? null;

  const matchingEffects = (skill.effects ?? []).filter((effect) => {
    if (effect.trigger !== trigger) {
      return false;
    }
    const currentTarget = getCurrentTarget();
    const effectCtx = buildEvalContextForTarget(nextState, {
      targetTag: currentTarget?.tag ?? targetObject.tag,
      targetEffects: currentTarget?.activeEffects ?? targetObject.activeEffects,
    });
    return !effect.condition || evaluateCondition(effect.condition, effectCtx);
  });

  for (const effect of matchingEffects) {
    const currentTarget = getCurrentTarget();
    if (!currentTarget) {
      break;
    }

    switch (effect.type) {
      case "damage": {
        handledDamage = true;
        const amount = Math.max(
          0,
          Math.round(
            typeof effect.value === "number"
              ? effect.value
              : getActionPulseImpact(nextState, skill, currentTarget, {
                  splitAcrossTicks: trigger === "on_tick",
                })
          )
        );
        if (amount <= 0) {
          break;
        }

        const remainingIntegrity = Math.max(0, currentTarget.integrity - amount);
        nextState = {
          ...nextState,
          objects: nextState.objects.map((entry) =>
            entry.id === currentTarget.id
              ? { ...entry, integrity: remainingIntegrity }
              : entry
          ),
          floatTexts: pushFloatingText(
            nextState.floatTexts,
            `-${amount}`,
            nextState.now,
            { durationMs: 1000, zone: "objects", objectId: currentTarget.id }
          ),
        };
        damageDealt += amount;
        break;
      }

      case "apply_status": {
        if (!effect.statusEffectId) {
          break;
        }
        const effectDef = bundle.statusEffects.find((entry) => entry.id === effect.statusEffectId);
        if (!effectDef) {
          break;
        }
        if (effect.target === "self") {
          nextState = {
            ...nextState,
            activeEffects: applyStatusEffect(nextState.activeEffects ?? [], effectDef, nextState.now),
          };
        } else if (effect.target === "target") {
          nextState = {
            ...nextState,
            objects: nextState.objects.map((entry) =>
              entry.id === currentTarget.id
                ? {
                    ...entry,
                    activeEffects: applyStatusEffect(entry.activeEffects ?? [], effectDef, nextState.now),
                  }
                : entry
            ),
          };
        }
        break;
      }

      case "remove_status": {
        if (!effect.statusEffectId) {
          break;
        }
        if (effect.target === "self") {
          nextState = {
            ...nextState,
            activeEffects: removeStatusEffect(nextState.activeEffects ?? [], effect.statusEffectId),
          };
        } else if (effect.target === "target") {
          nextState = {
            ...nextState,
            objects: nextState.objects.map((entry) =>
              entry.id === currentTarget.id
                ? {
                    ...entry,
                    activeEffects: removeStatusEffect(entry.activeEffects ?? [], effect.statusEffectId!),
                  }
                : entry
            ),
          };
        }
        break;
      }

      case "heal": {
        const amount = Math.max(0, Math.round(typeof effect.value === "number" ? effect.value : 0));
        if (amount <= 0) {
          break;
        }
        nextState = {
          ...nextState,
          health: Math.min(nextState.maxHealth, nextState.health + amount),
          floatTexts: pushFloatingText(nextState.floatTexts, `+${amount} HP`, nextState.now, {
            zone: "skills",
            skillId: skill.id,
          }),
        };
        break;
      }

      case "grant_resource": {
        const resourceLabel = (effect.resourceLabel ?? "").toLowerCase();
        const amount = Math.max(
          0,
          Math.round(
            typeof effect.resourceAmount === "number"
              ? effect.resourceAmount
              : typeof effect.value === "number"
                ? effect.value
                : 0
          )
        );
        if (amount <= 0) {
          break;
        }
        if (resourceLabel === "mana") {
          nextState = {
            ...nextState,
            mana: Math.min(nextState.maxMana, nextState.mana + amount),
            floatTexts: pushFloatingText(nextState.floatTexts, `+${amount} Mana`, nextState.now, {
              zone: "skills",
              skillId: skill.id,
            }),
          };
        } else {
          nextState = {
            ...nextState,
            energy: Math.min(nextState.maxEnergy, nextState.energy + amount),
            floatTexts: pushFloatingText(nextState.floatTexts, `+${amount} Energy`, nextState.now, {
              zone: "skills",
              skillId: skill.id,
            }),
          };
        }
        break;
      }

      case "consume_resource": {
        const resourceLabel = (effect.resourceLabel ?? "").toLowerCase();
        const amount = Math.max(
          0,
          Math.round(
            typeof effect.resourceAmount === "number"
              ? effect.resourceAmount
              : typeof effect.value === "number"
                ? effect.value
                : 0
          )
        );
        if (amount <= 0) {
          break;
        }
        if (resourceLabel === "mana") {
          nextState = {
            ...nextState,
            mana: Math.max(0, nextState.mana - amount),
          };
        } else {
          nextState = {
            ...nextState,
            energy: Math.max(0, nextState.energy - amount),
          };
        }
        break;
      }

      case "show_emote": {
        nextState = pushSkillEffectObjectEmote(nextState, effect, null, currentTarget);
        break;
      }

      default:
        break;
    }
  }

  if (damageDealt > 0) {
    const hitSkillDef = bundle.skills.find((entry) => entry.id === skill.id);
    if (hitSkillDef?.hitSound) playSound(hitSkillDef.hitSound, hitSkillDef.hitSoundVolume ?? 1);
    const hitInterDef = bundle.interactables.find((entry) => entry.id === targetObject.interactableId);
    if (hitInterDef?.sounds?.onHit) playSound(hitInterDef.sounds.onHit, hitInterDef.sounds.onHitVolume ?? 1);
  }

  return { state: nextState, damageDealt, handledDamage };
}

function resolveDueActionTicks(state: GameState): GameState {
  if (!state.action || state.action.tickMomentsMs.length === 0) {
    return state;
  }

  let nextState = state;

  while (nextState.action && nextState.action.resolvedTickCount < nextState.action.tickMomentsMs.length) {
    const nextTickMoment = nextState.action.tickMomentsMs[nextState.action.resolvedTickCount];
    if (nextState.now < nextState.action.startedAt + nextTickMoment) {
      break;
    }

    const usedSkill = nextState.skills.find((entry) => entry.id === nextState.action?.skillId);
    const targetObject = nextState.objects.find((entry) => entry.id === nextState.action?.objectId);
    if (!usedSkill || !targetObject) {
      return { ...nextState, action: null };
    }

    let nextAction = {
      ...nextState.action,
      resolvedTickCount: nextState.action.resolvedTickCount + 1,
    };

    if (!nextState.action.successRoll) {
      nextState = { ...nextState, action: nextAction };
      continue;
    }

    const effectResult = executeTriggeredSkillEffects(nextState, usedSkill, targetObject, "on_tick");
    nextState = effectResult.state;

    if (!effectResult.handledDamage) {
      const currentTarget = nextState.objects.find((entry) => entry.id === targetObject.id);
      if (!currentTarget) {
        return { ...nextState, action: null };
      }
      const tickImpact = getActionPulseImpact(nextState, usedSkill, currentTarget, { splitAcrossTicks: true });
      const remainingIntegrity = Math.max(0, currentTarget.integrity - tickImpact);
      nextState = {
        ...nextState,
        objects: nextState.objects.map((entry) =>
          entry.id === currentTarget.id
            ? { ...entry, integrity: remainingIntegrity }
            : entry
        ),
        floatTexts:
          tickImpact > 0
            ? pushFloatingText(
                nextState.floatTexts,
                `-${tickImpact}`,
                nextState.now,
                { durationMs: 1000, zone: "objects", objectId: currentTarget.id }
              )
            : nextState.floatTexts,
      };
    }

    const postTickTarget = nextState.objects.find((entry) => entry.id === targetObject.id);
    const remainingIntegrity = postTickTarget?.integrity ?? 0;
    const tickDamageDealt =
      effectResult.handledDamage
        ? effectResult.damageDealt
        : Math.max(
            0,
            (postTickTarget ? targetObject.integrity - postTickTarget.integrity : 0)
          );

    if (tickDamageDealt > 0) {
      const hookBundle = getBundle();
      if (hookBundle) {
        const hitResult = executeItemEventHooks(
          getEquippedLegacyItemIds(nextState),
          "on_hit",
          nextState,
          hookBundle
        );
        nextState = applyHookResultState(nextState, hitResult);
        nextState = applyHookResultState(
          nextState,
          executeStatusEffectHooks(
            { kind: "player" },
            "on_hit",
            nextState,
            hookBundle,
            { kind: "object", objectId: targetObject.id }
          )
        );
        nextState = applyHookResultState(
          nextState,
          executeStatusEffectHooks(
            { kind: "object", objectId: targetObject.id },
            "on_damage_taken",
            nextState,
            hookBundle,
            { kind: "player" }
          )
        );
      }
    }

    const latestTarget = nextState.objects.find((entry) => entry.id === targetObject.id);
    if ((latestTarget?.integrity ?? remainingIntegrity) <= 0) {
      nextAction = {
        ...nextAction,
        endsAt: nextState.now,
      };
    }

    nextState = {
      ...nextState,
      action: nextAction,
    };

    if (remainingIntegrity <= 0) {
      break;
    }
  }

  return nextState;
}

// ── Resolve completed action ──

function resolveCompletedAction(state: GameState): GameState {
  if (!state.action) return state;

  const usedSkill = state.skills.find((entry) => entry.id === state.action?.skillId);
  const targetObject = state.objects.find((entry) => entry.id === state.action?.objectId);
  if (!usedSkill || !targetObject) return { ...state, action: null };
  const actionHasTicks = state.action.tickMomentsMs.length > 0;

  // Find the linked passive for success chance
  const linkedPassive = usedSkill.linkedPassiveId
    ? getSkill(state.skills, usedSkill.linkedPassiveId)
    : null;
  const passiveLevel = linkedPassive?.level ?? 1;
  const successChance = getSuccessChance(passiveLevel, targetObject.requiredLevel);
  const didSucceed = state.action.successRoll;
  const targetCtx = buildEvalContextForTarget(state, {
    targetTag: targetObject.tag,
    targetEffects: targetObject.activeEffects,
  });
  const activeStatusInteractions = (usedSkill.statusInteractions ?? []).filter(
    (interaction) => !interaction.condition || evaluateCondition(interaction.condition, targetCtx)
  );
  let impact = didSucceed && !actionHasTicks
    ? getActionPulseImpact(state, usedSkill, targetObject)
    : 0;
  let nextTargetEffects = [...(targetObject.activeEffects ?? [])];
  let nextActiveEffects = state.activeEffects ?? [];
  let effectExecutionState: GameState | null = null;
  let completionEffectsHandledDamage = false;

  if (didSucceed) {
    const bundle = getBundle();
    for (const interaction of activeStatusInteractions) {
      if (interaction.consumeStatusEffectId) {
        if ((interaction.consumeStatusTarget ?? "target") === "self") {
          nextActiveEffects = removeStatusEffect(nextActiveEffects, interaction.consumeStatusEffectId);
        } else {
          nextTargetEffects = removeStatusEffect(nextTargetEffects, interaction.consumeStatusEffectId);
        }
      }

      if (interaction.applyStatusEffectId && bundle) {
        const effectDef = bundle.statusEffects.find((effect) => effect.id === interaction.applyStatusEffectId);
        if (!effectDef) {
          continue;
        }
        if ((interaction.applyStatusTarget ?? "target") === "self") {
          nextActiveEffects = applyStatusEffect(nextActiveEffects, effectDef, state.now);
        } else {
          nextTargetEffects = applyStatusEffect(nextTargetEffects, effectDef, state.now);
        }
      }
    }

    // Apply milestone status effects on successful hit
    const milestones = getActiveMilestoneModifiers(usedSkill);
    const bundle2 = getBundle();
    if (bundle2) {
      for (const ms of milestones.applyStatuses) {
        if (ms.chance < 100 && Math.random() * 100 >= ms.chance) continue;
        const effectDef = bundle2.statusEffects.find((e) => e.id === ms.statusEffectId);
        if (effectDef) {
          nextTargetEffects = applyStatusEffect(nextTargetEffects, effectDef, state.now);
        }
      }
    }
  }

  if (didSucceed) {
    const effectResult = executeTriggeredSkillEffects(
      {
        ...state,
        activeEffects: nextActiveEffects,
        objects: state.objects.map((entry) =>
          entry.id === targetObject.id
            ? { ...entry, activeEffects: nextTargetEffects }
            : entry
        ),
      },
      usedSkill,
      targetObject,
      "on_cast_complete"
    );

    effectExecutionState = effectResult.state;
    completionEffectsHandledDamage = effectResult.handledDamage;
    nextActiveEffects = effectResult.state.activeEffects ?? nextActiveEffects;
    nextTargetEffects =
      effectResult.state.objects.find((entry) => entry.id === targetObject.id)?.activeEffects ?? nextTargetEffects;

    if (effectResult.handledDamage) {
      impact = effectResult.damageDealt;
    }
  }

  const targetObjectAfterEffects = effectExecutionState?.objects.find((entry) => entry.id === targetObject.id) ?? targetObject;
  const preDamageIntegrity = targetObjectAfterEffects.integrity;
  const remainingIntegrity = completionEffectsHandledDamage
    ? preDamageIntegrity
    : Math.max(0, preDamageIntegrity - impact);
  let updatedObjects = effectExecutionState
    ? effectExecutionState.objects.map((entry) =>
        entry.id === targetObject.id
          ? { ...entry, integrity: remainingIntegrity, activeEffects: nextTargetEffects }
          : entry
      )
    : state.objects.map((entry) =>
        entry.id === targetObject.id
          ? { ...entry, integrity: remainingIntegrity, activeEffects: nextTargetEffects }
          : entry
      );

  let updatedSkills = state.skills;
  let updatedLog = state.log;
  let updatedFloatTexts = effectExecutionState?.floatTexts ?? state.floatTexts;
  let nextSuccessfulUpwardHits = state.successfulUpwardHits;
  let nextDownwardBonusReady = state.downwardBonusReady;
  let nextSidePrepUpwardStreak = state.sidePrepUpwardStreak;
  let nextSidePrepDownwardHit = state.sidePrepDownwardHit;
  let nextChopBuffUntil = state.chopBuffUntil;
  let nextUnlockCues = state.unlockCues;
  let nextDestroyedObjectCues = state.destroyedObjectCues;
  let nextLootReceiptCues = state.lootReceiptCues;
  let nextObjectEmoteCues = effectExecutionState?.objectEmoteCues ?? state.objectEmoteCues;
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

  if (didSucceed && impact > 0 && !completionEffectsHandledDamage) {
    updatedFloatTexts = pushFloatingText(
      updatedFloatTexts,
      `-${impact}`,
      state.now,
      { durationMs: 1000, zone: "objects", objectId: targetObject.id }
    );
    // Play skill hit sound and interactable on_hit sound
    const soundBundle = getBundle();
    const hitSkillDef = soundBundle?.skills.find((s) => s.id === usedSkill.id);
    if (hitSkillDef?.hitSound) playSound(hitSkillDef.hitSound, hitSkillDef.hitSoundVolume ?? 1);
    const hitInterDef = soundBundle?.interactables.find((i) => i.id === targetObject.interactableId);
    if (hitInterDef?.sounds?.onHit) playSound(hitInterDef.sounds.onHit, hitInterDef.sounds.onHitVolume ?? 1);
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
  let updatedEquipmentInventory = state.inventoryEquipment;
  let resolvedObjects = updatedObjects;
  let nextSelectedObjectId = state.selectedObjectId;
  let nextAutoSkillId = state.autoSkillId;
  let nextEnergy = effectExecutionState?.energy ?? state.energy;
  let nextHealth = effectExecutionState?.health ?? state.health;
  let nextMana = effectExecutionState?.mana ?? state.mana;
  let nextActiveDialogue = state.activeDialogue;
  let pendingTravelToRoomId: string | null = null;
  let pendingStartCutsceneId: string | null = null;
  const hookBundle = getBundle();
  let finalRemainingIntegrity = remainingIntegrity;

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

  if (hookBundle && didSucceed) {
    const equippedIds = getEquippedLegacyItemIds(state);

    if (impact > 0) {
      const hitResult = executeItemEventHooks(
        equippedIds,
        "on_hit",
        {
          ...state,
          activeEffects: nextActiveEffects,
          playerStorage: nextPlayerStorage,
          energy: nextEnergy,
          health: nextHealth,
          inventory: updatedInventory,
          inventoryEquipment: updatedEquipmentInventory,
          skills: updatedSkills,
          unlockCues: nextUnlockCues,
          objectEmoteCues: nextObjectEmoteCues,
        },
        hookBundle
      );
      if (hitResult.activeEffects) nextActiveEffects = hitResult.activeEffects;
      if (hitResult.playerStorage) nextPlayerStorage = hitResult.playerStorage;
      if (hitResult.energy !== undefined) nextEnergy = hitResult.energy;
      if (hitResult.health !== undefined) nextHealth = hitResult.health;
      if (hitResult.inventory) updatedInventory = hitResult.inventory;
      if (hitResult.inventoryEquipment) updatedEquipmentInventory = hitResult.inventoryEquipment;
      if (hitResult.skills) updatedSkills = hitResult.skills;
      if (hitResult.unlockCues) nextUnlockCues = hitResult.unlockCues;
      if (hitResult.objectEmoteCues) nextObjectEmoteCues = hitResult.objectEmoteCues;
      if (hitResult.travelToRoomId) pendingTravelToRoomId = hitResult.travelToRoomId;
      if (hitResult.startCutsceneId) pendingStartCutsceneId = hitResult.startCutsceneId;
      for (const line of hitResult.log ?? []) updatedLog = appendLog(updatedLog, line);

      const statusHitResult = executeStatusEffectHooks(
        { kind: "player" },
        "on_hit",
        {
          ...state,
          activeEffects: nextActiveEffects,
          objects: updatedObjects,
          playerStorage: nextPlayerStorage,
          energy: nextEnergy,
          health: nextHealth,
          inventory: updatedInventory,
          inventoryEquipment: updatedEquipmentInventory,
          skills: updatedSkills,
          unlockCues: nextUnlockCues,
          objectEmoteCues: nextObjectEmoteCues,
          log: updatedLog,
        },
        hookBundle,
        { kind: "object", objectId: targetObject.id }
      );
      if (statusHitResult.activeEffects) nextActiveEffects = statusHitResult.activeEffects;
      if (statusHitResult.objects) updatedObjects = statusHitResult.objects;
      if (statusHitResult.playerStorage) nextPlayerStorage = statusHitResult.playerStorage;
      if (statusHitResult.energy !== undefined) nextEnergy = statusHitResult.energy;
      if (statusHitResult.health !== undefined) nextHealth = statusHitResult.health;
      if (statusHitResult.inventory) updatedInventory = statusHitResult.inventory;
      if (statusHitResult.inventoryEquipment) updatedEquipmentInventory = statusHitResult.inventoryEquipment;
      if (statusHitResult.skills) updatedSkills = statusHitResult.skills;
      if (statusHitResult.unlockCues) nextUnlockCues = statusHitResult.unlockCues;
      if (statusHitResult.objectEmoteCues) nextObjectEmoteCues = statusHitResult.objectEmoteCues;
      if (statusHitResult.travelToRoomId) pendingTravelToRoomId = statusHitResult.travelToRoomId;
      if (statusHitResult.startCutsceneId) pendingStartCutsceneId = statusHitResult.startCutsceneId;
      for (const line of statusHitResult.log ?? []) updatedLog = appendLog(updatedLog, line);

      const objectStatusResult = executeStatusEffectHooks(
        { kind: "object", objectId: targetObject.id },
        "on_damage_taken",
        {
          ...state,
          activeEffects: nextActiveEffects,
          objects: updatedObjects,
          playerStorage: nextPlayerStorage,
          energy: nextEnergy,
          health: nextHealth,
          inventory: updatedInventory,
          inventoryEquipment: updatedEquipmentInventory,
          skills: updatedSkills,
          unlockCues: nextUnlockCues,
          objectEmoteCues: nextObjectEmoteCues,
          log: updatedLog,
        },
        hookBundle,
        { kind: "player" }
      );
      if (objectStatusResult.activeEffects) nextActiveEffects = objectStatusResult.activeEffects;
      if (objectStatusResult.objects) updatedObjects = objectStatusResult.objects;
      if (objectStatusResult.playerStorage) nextPlayerStorage = objectStatusResult.playerStorage;
      if (objectStatusResult.energy !== undefined) nextEnergy = objectStatusResult.energy;
      if (objectStatusResult.health !== undefined) nextHealth = objectStatusResult.health;
      if (objectStatusResult.inventory) updatedInventory = objectStatusResult.inventory;
      if (objectStatusResult.inventoryEquipment) updatedEquipmentInventory = objectStatusResult.inventoryEquipment;
      if (objectStatusResult.skills) updatedSkills = objectStatusResult.skills;
      if (objectStatusResult.unlockCues) nextUnlockCues = objectStatusResult.unlockCues;
      if (objectStatusResult.objectEmoteCues) nextObjectEmoteCues = objectStatusResult.objectEmoteCues;
      if (objectStatusResult.travelToRoomId) pendingTravelToRoomId = objectStatusResult.travelToRoomId;
      if (objectStatusResult.startCutsceneId) pendingStartCutsceneId = objectStatusResult.startCutsceneId;
      for (const line of objectStatusResult.log ?? []) updatedLog = appendLog(updatedLog, line);
    }

    finalRemainingIntegrity =
      updatedObjects.find((entry) => entry.id === targetObject.id)?.integrity ?? remainingIntegrity;
  }

  resolvedObjects = updatedObjects;

  if (didSucceed && finalRemainingIntegrity <= 0) {
    const destroyedIndex = state.objects.findIndex((entry) => entry.id === targetObject.id);
    const resolvedDrops = resolveObjectDropsOnDestroy(
      {
        ...state,
        activeEffects: nextActiveEffects,
        objects: updatedObjects,
        playerStorage: nextPlayerStorage,
        energy: nextEnergy,
        health: nextHealth,
        inventory: updatedInventory,
        inventoryEquipment: updatedEquipmentInventory,
        skills: updatedSkills,
        unlockCues: nextUnlockCues,
      },
      targetObject
    );
    const stackableDrops = resolvedDrops.flatMap((drop) =>
      drop.kind === "item" && drop.inventoryItem ? [drop.inventoryItem] : []
    );
    const equipmentDrops = resolvedDrops.flatMap((drop) =>
      drop.kind === "equipment" ? (drop.equipmentItems ?? []) : []
    );
    updatedInventory = mergeInventoryItems(updatedInventory, stackableDrops);
    updatedEquipmentInventory = [...updatedEquipmentInventory, ...equipmentDrops];
    nextPlayerStorage = markSpawnDefeated(nextPlayerStorage, targetObject);
    resolvedObjects = updatedObjects.filter((entry) => entry.id !== targetObject.id);
    nextDestroyedObjectCues = [
      ...nextDestroyedObjectCues,
      {
        object: { ...targetObject, integrity: 0 },
        createdAt: state.now,
        expiresAt: state.now + 4600,
        index: destroyedIndex >= 0 ? destroyedIndex : state.objects.length,
      },
    ];
    nextLootReceiptCues = pushLootReceiptCue(
      {
        ...state,
        lootReceiptCues: nextLootReceiptCues,
        inventory: updatedInventory,
        inventoryEquipment: updatedEquipmentInventory,
      },
      resolvedDrops,
      targetObject.id
    );
    for (const drop of resolvedDrops) {
      updatedFloatTexts = pushFloatingText(updatedFloatTexts, `+${drop.qty} ${drop.name}`, state.now, {
        zone: "objects",
      });
    }

    const dropText = resolvedDrops.map((drop) => `${drop.qty} ${drop.name}`).join(", ");
    updatedLog = appendLog(
      updatedLog,
      dropText ? `${targetObject.name} completed. Loot: ${dropText}.` : `${targetObject.name} completed.`
    );

    // Process onDestroy actions + destroy sound
    if (targetObject.interactableId) {
      const bundle = getBundle();
      const interDef = bundle?.interactables.find((i) => i.id === targetObject.interactableId);
      if (bundle && interDef?.onDestroyEffects?.length) {
        const destroyResult = executeEventActions(
          interDef.onDestroyEffects,
          {
            ...state,
            activeEffects: nextActiveEffects,
            objects: updatedObjects,
            playerStorage: nextPlayerStorage,
            energy: nextEnergy,
            health: nextHealth,
            inventory: updatedInventory,
            inventoryEquipment: updatedEquipmentInventory,
            skills: updatedSkills,
            unlockCues: nextUnlockCues,
            objectEmoteCues: nextObjectEmoteCues,
          },
          bundle,
          { bearer: { kind: "object", objectId: targetObject.id } }
        );
        if (destroyResult.activeEffects) nextActiveEffects = destroyResult.activeEffects;
        if (destroyResult.objects) updatedObjects = destroyResult.objects;
        if (destroyResult.playerStorage) nextPlayerStorage = destroyResult.playerStorage;
        if (destroyResult.energy !== undefined) nextEnergy = destroyResult.energy;
        if (destroyResult.health !== undefined) nextHealth = destroyResult.health;
        if (destroyResult.inventory) updatedInventory = destroyResult.inventory;
        if (destroyResult.inventoryEquipment) updatedEquipmentInventory = destroyResult.inventoryEquipment;
        if (destroyResult.skills) updatedSkills = destroyResult.skills;
        if (destroyResult.unlockCues) nextUnlockCues = destroyResult.unlockCues;
        if (destroyResult.objectEmoteCues) nextObjectEmoteCues = destroyResult.objectEmoteCues;
        if (destroyResult.travelToRoomId) pendingTravelToRoomId = destroyResult.travelToRoomId;
        if (destroyResult.startCutsceneId) pendingStartCutsceneId = destroyResult.startCutsceneId;
        for (const line of destroyResult.log ?? []) updatedLog = appendLog(updatedLog, line);
      }
      if (interDef?.sounds?.onDestroy) playSound(interDef.sounds.onDestroy, interDef.sounds.onDestroyVolume ?? 1);
    }

    if (targetObject.id === state.selectedObjectId) {
      nextSelectedObjectId = null;
      nextAutoSkillId = null;
      nextActiveDialogue = null;
      updatedLog = appendLog(updatedLog, "Target destroyed. Auto-cast stopped.");
    }
  } else if (didSucceed) {
    updatedLog = appendLog(
      updatedLog,
      actionHasTicks
        ? `${usedSkill.name} completed against ${targetObject.name}.`
        : `${usedSkill.name} dealt ${impact} to ${targetObject.name}.`
    );

    // Process onInteract actions
    if (targetObject.interactableId) {
      const bundle = getBundle();
      const interDef = bundle?.interactables.find((i) => i.id === targetObject.interactableId);
      if (bundle && interDef?.onInteractEffects?.length) {
        const interactableResult = executeEventActions(
          interDef.onInteractEffects,
          {
            ...state,
            activeEffects: nextActiveEffects,
            objects: updatedObjects,
            playerStorage: nextPlayerStorage,
            energy: nextEnergy,
            health: nextHealth,
            inventory: updatedInventory,
            inventoryEquipment: updatedEquipmentInventory,
            skills: updatedSkills,
            unlockCues: nextUnlockCues,
            objectEmoteCues: nextObjectEmoteCues,
          },
          bundle,
          { bearer: { kind: "object", objectId: targetObject.id } }
        );
        if (interactableResult.activeEffects) nextActiveEffects = interactableResult.activeEffects;
        if (interactableResult.objects) updatedObjects = interactableResult.objects;
        if (interactableResult.playerStorage) nextPlayerStorage = interactableResult.playerStorage;
        if (interactableResult.energy !== undefined) nextEnergy = interactableResult.energy;
        if (interactableResult.health !== undefined) nextHealth = interactableResult.health;
        if (interactableResult.inventory) updatedInventory = interactableResult.inventory;
        if (interactableResult.inventoryEquipment) updatedEquipmentInventory = interactableResult.inventoryEquipment;
        if (interactableResult.skills) updatedSkills = interactableResult.skills;
        if (interactableResult.unlockCues) nextUnlockCues = interactableResult.unlockCues;
        if (interactableResult.objectEmoteCues) nextObjectEmoteCues = interactableResult.objectEmoteCues;
        if (interactableResult.travelToRoomId) pendingTravelToRoomId = interactableResult.travelToRoomId;
        if (interactableResult.startCutsceneId) pendingStartCutsceneId = interactableResult.startCutsceneId;
        for (const line of interactableResult.log ?? []) updatedLog = appendLog(updatedLog, line);
      }
    }
  }

  // ── Item event hooks for equipped items ──
  if (hookBundle && didSucceed) {
    const equippedIds = getEquippedLegacyItemIds(state);

    // on_kill: fires when interactable is destroyed
    if (finalRemainingIntegrity <= 0) {
      const killResult = executeItemEventHooks(
        equippedIds,
        "on_kill",
        {
          ...state,
          activeEffects: nextActiveEffects,
          playerStorage: nextPlayerStorage,
          energy: nextEnergy,
          health: nextHealth,
          inventory: updatedInventory,
          inventoryEquipment: updatedEquipmentInventory,
          skills: updatedSkills,
          unlockCues: nextUnlockCues,
          objectEmoteCues: nextObjectEmoteCues,
        },
        hookBundle
      );
      if (killResult.activeEffects) nextActiveEffects = killResult.activeEffects;
      if (killResult.playerStorage) nextPlayerStorage = killResult.playerStorage;
      if (killResult.energy !== undefined) nextEnergy = killResult.energy;
      if (killResult.health !== undefined) nextHealth = killResult.health;
      if (killResult.inventory) updatedInventory = killResult.inventory;
      if (killResult.inventoryEquipment) updatedEquipmentInventory = killResult.inventoryEquipment;
      if (killResult.skills) updatedSkills = killResult.skills;
      if (killResult.unlockCues) nextUnlockCues = killResult.unlockCues;
      if (killResult.objectEmoteCues) nextObjectEmoteCues = killResult.objectEmoteCues;
      if (killResult.travelToRoomId) pendingTravelToRoomId = killResult.travelToRoomId;
      if (killResult.startCutsceneId) pendingStartCutsceneId = killResult.startCutsceneId;
      for (const line of killResult.log ?? []) updatedLog = appendLog(updatedLog, line);

      const statusKillResult = executeStatusEffectHooks(
        { kind: "player" },
        "on_kill",
        {
          ...state,
          activeEffects: nextActiveEffects,
          objects: updatedObjects,
          playerStorage: nextPlayerStorage,
          energy: nextEnergy,
          health: nextHealth,
          inventory: updatedInventory,
          inventoryEquipment: updatedEquipmentInventory,
          skills: updatedSkills,
          unlockCues: nextUnlockCues,
          objectEmoteCues: nextObjectEmoteCues,
          log: updatedLog,
        },
        hookBundle,
        { kind: "object", objectId: targetObject.id }
      );
      if (statusKillResult.activeEffects) nextActiveEffects = statusKillResult.activeEffects;
      if (statusKillResult.objects) updatedObjects = statusKillResult.objects;
      if (statusKillResult.playerStorage) nextPlayerStorage = statusKillResult.playerStorage;
      if (statusKillResult.energy !== undefined) nextEnergy = statusKillResult.energy;
      if (statusKillResult.health !== undefined) nextHealth = statusKillResult.health;
      if (statusKillResult.inventory) updatedInventory = statusKillResult.inventory;
      if (statusKillResult.inventoryEquipment) updatedEquipmentInventory = statusKillResult.inventoryEquipment;
      if (statusKillResult.skills) updatedSkills = statusKillResult.skills;
      if (statusKillResult.unlockCues) nextUnlockCues = statusKillResult.unlockCues;
      if (statusKillResult.objectEmoteCues) nextObjectEmoteCues = statusKillResult.objectEmoteCues;
      if (statusKillResult.travelToRoomId) pendingTravelToRoomId = statusKillResult.travelToRoomId;
      if (statusKillResult.startCutsceneId) pendingStartCutsceneId = statusKillResult.startCutsceneId;
      for (const line of statusKillResult.log ?? []) updatedLog = appendLog(updatedLog, line);
    }

    // on_interact: fires on every successful action
    const interactResult = executeItemEventHooks(
      equippedIds,
      "on_interact",
      {
        ...state,
        activeEffects: nextActiveEffects,
        playerStorage: nextPlayerStorage,
        energy: nextEnergy,
        health: nextHealth,
        inventory: updatedInventory,
        inventoryEquipment: updatedEquipmentInventory,
        skills: updatedSkills,
        unlockCues: nextUnlockCues,
        objectEmoteCues: nextObjectEmoteCues,
      },
      hookBundle
    );
    if (interactResult.activeEffects) nextActiveEffects = interactResult.activeEffects;
    if (interactResult.playerStorage) nextPlayerStorage = interactResult.playerStorage;
    if (interactResult.energy !== undefined) nextEnergy = interactResult.energy;
    if (interactResult.health !== undefined) nextHealth = interactResult.health;
    if (interactResult.inventory) updatedInventory = interactResult.inventory;
    if (interactResult.inventoryEquipment) updatedEquipmentInventory = interactResult.inventoryEquipment;
    if (interactResult.skills) updatedSkills = interactResult.skills;
    if (interactResult.unlockCues) nextUnlockCues = interactResult.unlockCues;
    if (interactResult.objectEmoteCues) nextObjectEmoteCues = interactResult.objectEmoteCues;
    if (interactResult.travelToRoomId) pendingTravelToRoomId = interactResult.travelToRoomId;
    if (interactResult.startCutsceneId) pendingStartCutsceneId = interactResult.startCutsceneId;
    for (const line of interactResult.log ?? []) updatedLog = appendLog(updatedLog, line);
  }

  const nextState = {
    ...state,
    skills: updatedSkills,
    inventory: updatedInventory,
    inventoryEquipment: updatedEquipmentInventory,
    objects: resolvedObjects,
    selectedObjectId: nextSelectedObjectId,
    activeDialogue: nextActiveDialogue,
    autoSkillId: nextAutoSkillId,
    energy: nextEnergy,
    health: nextHealth,
    mana: nextMana,
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
    objectEmoteCues: nextObjectEmoteCues,
    destroyedObjectCues: nextDestroyedObjectCues,
    lootReceiptCues: nextLootReceiptCues,
    objectAttackCues: state.objectAttackCues,
  };

  const traveledState = pendingTravelToRoomId
    ? travelToRoomState(nextState, pendingTravelToRoomId, { ignoreReachability: true })
    : nextState;
  return pendingStartCutsceneId
    ? startCutsceneState(
        {
          ...traveledState,
          activeDialogue: null,
        },
        pendingStartCutsceneId
      )
    : traveledState;
}

// ── Reducer ──

function clearSelectedObjectState(state: GameState): GameState {
  if (!state.selectedObjectId && !state.action && !state.autoSkillId && !state.weaponAction) {
    return state;
  }

  let nextEnergy = state.energy;
  let nextLog = state.log;

  if (state.action) {
    const canceledSkillName =
      state.skills.find((entry) => entry.id === state.action?.skillId)?.name ?? "Current Ability";
    nextEnergy = Math.min(state.maxEnergy, state.energy + state.action.energyCost);
    nextLog = appendLog(nextLog, `${canceledSkillName} canceled.`);
  }

  return {
    ...state,
    selectedObjectId: null,
    activeDialogue: null,
    autoSkillId: null,
    action: null,
    weaponAction: null,
    weaponAutoEnabled: true,
    weaponAttackAnimateUntil: 0,
    energy: nextEnergy,
    log: nextLog,
  };
}

function travelToRoomState(
  state: GameState,
  roomId: string,
  options?: { ignoreReachability?: boolean }
): GameState {
  const bundle = getBundle();
  const targetRoom = bundle?.world.rooms.find((room) => room.id === roomId);
  if (!targetRoom) {
    return state;
  }

  if (!options?.ignoreReachability && roomId !== state.currentRoomId && !isRoomReachable(state, roomId)) {
    return { ...state, log: appendLog(state.log, `Cannot travel to ${targetRoom.name} from here.`) };
  }

  if (targetRoom.entryCondition) {
    const ctx = buildEvalContext(state);
    if (!evaluateCondition(targetRoom.entryCondition, ctx)) {
      return { ...state, log: appendLog(state.log, `Cannot enter ${targetRoom.name}.`) };
    }
  }

  const nextObjects = generateObjectsForRoom(roomId, state.seed, { ...state, currentRoomId: roomId });
  playRoomAudio(targetRoom);

  return {
    ...state,
    currentRoomId: roomId,
    previousRoomId: state.currentRoomId !== roomId ? state.currentRoomId : state.previousRoomId,
    objects: nextObjects,
    selectedObjectId: null,
    activeDialogue: null,
    action: null,
    exploreAction: null,
    travelAction: null,
    hostileAction: null,
    friendlyAction: null,
    weaponAction: null,
    autoSkillId: null,
    weaponAutoEnabled: true,
    weaponAttackAnimateUntil: 0,
    objectBatchStartedAt: state.now,
    weather: pickWeather(state.seed + roomId.length),
    destroyedObjectCues: [],
    objectAttackCues: [],
    objectEmoteCues: [],
    log: appendLog(state.log, `Travelled to ${targetRoom.name}.`),
  };
}

function beginTravelActionState(state: GameState, roomId: string): GameState {
  const bundle = getBundle();
  const targetRoom = bundle?.world.rooms.find((room) => room.id === roomId);
  if (!targetRoom) {
    return state;
  }

  if (state.travelAction) {
    return state;
  }

  if (state.action) {
    return { ...state, log: appendLog(state.log, "Finish the current cast before travelling.") };
  }

  if (state.exploreAction) {
    return { ...state, log: appendLog(state.log, "Finish exploring before travelling.") };
  }

  if (!isRoomReachable(state, roomId)) {
    return { ...state, log: appendLog(state.log, `Cannot travel to ${targetRoom.name} from here.`) };
  }

  if (targetRoom.entryCondition) {
    const ctx = buildEvalContext(state);
    if (!evaluateCondition(targetRoom.entryCondition, ctx)) {
      return { ...state, log: appendLog(state.log, `Cannot enter ${targetRoom.name}.`) };
    }
  }

  if (state.energy < TRAVEL_ENERGY_COST) {
    return {
      ...state,
      log: appendLog(state.log, `Not enough energy to travel to ${targetRoom.name}. (${TRAVEL_ENERGY_COST} energy required)`),
    };
  }

  return {
    ...state,
    energy: state.energy - TRAVEL_ENERGY_COST,
    selectedObjectId: null,
    activeDialogue: null,
    autoSkillId: null,
    hostileAction: null,
    friendlyAction: null,
    weaponAction: null,
    travelAction: {
      roomId,
      roomName: targetRoom.name,
      startedAt: state.now,
      endsAt: state.now + TRAVEL_DURATION_MS,
      durationMs: TRAVEL_DURATION_MS,
      energyCost: TRAVEL_ENERGY_COST,
    },
    log: appendLog(state.log, `Traveling to ${targetRoom.name}...`),
  };
}

function applyDialogueActions(
  state: GameState,
  actions: NonNullable<ReturnType<typeof getBundle>>["dialogues"][number]["nodes"][number]["onEnterEffects"],
  context?: Parameters<typeof executeEventActions>[3]
): Pick<GameState, "activeEffects" | "objects" | "playerStorage" | "energy" | "mana" | "health" | "inventory" | "inventoryEquipment" | "skills" | "unlockCues" | "log"> & {
  objectEmoteCues: GameState["objectEmoteCues"];
  travelToRoomId?: string;
  startCutsceneId?: string;
} {
  const bundle = getBundle();
  if (!bundle || !actions || actions.length === 0) {
    return {
      activeEffects: state.activeEffects,
      objects: state.objects,
      playerStorage: state.playerStorage,
      energy: state.energy,
      mana: state.mana,
      health: state.health,
      inventory: state.inventory,
      inventoryEquipment: state.inventoryEquipment,
      skills: state.skills,
      unlockCues: state.unlockCues,
      objectEmoteCues: state.objectEmoteCues,
      log: state.log,
      travelToRoomId: undefined,
      startCutsceneId: undefined,
    };
  }

  const result = executeEventActions(actions, state, bundle, context);
  let nextLog = state.log;
  for (const line of result.log ?? []) {
    nextLog = appendLog(nextLog, line);
  }

  return {
    activeEffects: result.activeEffects ?? state.activeEffects,
    objects: result.objects ?? state.objects,
    playerStorage: result.playerStorage ?? state.playerStorage,
    energy: result.energy ?? state.energy,
    mana: result.mana ?? state.mana,
    health: result.health ?? state.health,
    inventory: result.inventory ?? state.inventory,
    inventoryEquipment: result.inventoryEquipment ?? state.inventoryEquipment,
    skills: result.skills ?? state.skills,
    unlockCues: result.unlockCues ?? state.unlockCues,
    objectEmoteCues: result.objectEmoteCues ?? state.objectEmoteCues,
    log: nextLog,
    travelToRoomId: result.travelToRoomId,
    startCutsceneId: result.startCutsceneId,
  };
}

interface DialogueSessionSeed {
  objectId?: string | null;
  speakerName?: string;
  portraitImage?: string;
  meterLabel?: string;
  integrity?: number;
  maxIntegrity?: number;
}

function applyNarrativeActionResult(
  state: GameState,
  actionResult: ReturnType<typeof applyDialogueActions>,
  options?: { clearDialogue?: boolean; clearCutscene?: boolean }
): GameState {
  let nextState: GameState = {
    ...state,
    activeEffects: actionResult.activeEffects,
    objects: actionResult.objects,
    playerStorage: actionResult.playerStorage,
    energy: actionResult.energy,
    mana: actionResult.mana,
    health: actionResult.health,
    inventory: actionResult.inventory,
    inventoryEquipment: actionResult.inventoryEquipment,
    skills: actionResult.skills,
    unlockCues: actionResult.unlockCues,
    objectEmoteCues: actionResult.objectEmoteCues,
    log: actionResult.log,
    activeDialogue: options?.clearDialogue ? null : state.activeDialogue,
    activeCutscene: options?.clearCutscene ? null : state.activeCutscene,
  };

  if (actionResult.travelToRoomId) {
    nextState = travelToRoomState(nextState, actionResult.travelToRoomId, {
      ignoreReachability: true,
    });
  }

  if (actionResult.startCutsceneId) {
    nextState = startCutsceneState(
      {
        ...nextState,
        activeDialogue: null,
        activeCutscene: null,
      },
      actionResult.startCutsceneId
    );
  }

  return nextState;
}

function enterDialogueNode(
  state: GameState,
  dialogueId: string,
  nodeId: string,
  seed?: DialogueSessionSeed
): GameState {
  const dialogue = getBundle()?.dialogues.find((entry) => entry.id === dialogueId);
  const node = dialogue?.nodes.find((entry) => entry.id === nodeId);
  if (!dialogue || !node) {
    return {
      ...state,
      activeDialogue: null,
    };
  }

  const actionResult = applyDialogueActions(
    state,
    node.onEnterEffects,
    seed?.objectId ? { bearer: { kind: "object", objectId: seed.objectId } } : undefined
  );

  if (actionResult.travelToRoomId || actionResult.startCutsceneId) {
    return applyNarrativeActionResult(state, actionResult, {
      clearDialogue: true,
      clearCutscene: Boolean(state.activeCutscene?.awaitingDialogue),
    });
  }

  return {
    ...state,
    activeDialogue: {
      objectId: seed?.objectId ?? null,
      dialogueId,
      nodeId: node.id,
      speakerName: seed?.speakerName,
      portraitImage: seed?.portraitImage,
      meterLabel: seed?.meterLabel,
      integrity: seed?.integrity,
      maxIntegrity: seed?.maxIntegrity,
    },
    activeEffects: actionResult.activeEffects,
    objects: actionResult.objects,
    playerStorage: actionResult.playerStorage,
    energy: actionResult.energy,
    mana: actionResult.mana,
    health: actionResult.health,
    inventory: actionResult.inventory,
    inventoryEquipment: actionResult.inventoryEquipment,
    skills: actionResult.skills,
    unlockCues: actionResult.unlockCues,
    objectEmoteCues: actionResult.objectEmoteCues,
    log: actionResult.log,
  };
}

function completeCutsceneState(state: GameState): GameState {
  if (!state.activeCutscene) {
    return state;
  }

  const cutscene = getBundle()?.cutscenes.find((entry) => entry.id === state.activeCutscene?.cutsceneId);
  if (!cutscene) {
    return {
      ...state,
      activeCutscene: null,
    };
  }

  const clearedState: GameState = {
    ...state,
    activeCutscene: null,
    activeDialogue: null,
  };
  const currentRoom = getBundle()?.world.rooms.find((entry) => entry.id === clearedState.currentRoomId);
  playRoomAudio(currentRoom);
  const actionResult = applyDialogueActions(clearedState, cutscene.onCompleteEffects);
  if (actionResult.travelToRoomId || actionResult.startCutsceneId) {
    return applyNarrativeActionResult(clearedState, actionResult, {
      clearDialogue: true,
      clearCutscene: true,
    });
  }

  return {
    ...clearedState,
    activeEffects: actionResult.activeEffects,
    objects: actionResult.objects,
    playerStorage: actionResult.playerStorage,
    energy: actionResult.energy,
    mana: actionResult.mana,
    health: actionResult.health,
    inventory: actionResult.inventory,
    inventoryEquipment: actionResult.inventoryEquipment,
    skills: actionResult.skills,
    unlockCues: actionResult.unlockCues,
    objectEmoteCues: actionResult.objectEmoteCues,
    log: appendLog(actionResult.log, `Scene ended: ${cutscene.name}.`),
  };
}

function enterCutsceneStep(state: GameState, cutsceneId: string, stepId: string): GameState {
  const cutscene = getBundle()?.cutscenes.find((entry) => entry.id === cutsceneId);
  const step = cutscene?.steps.find((entry) => entry.id === stepId);
  if (!cutscene || !step) {
    return {
      ...state,
      activeCutscene: null,
    };
  }

  const clearedState: GameState = {
    ...state,
    activeDialogue: null,
  };
  if (step.ambientSound !== undefined) {
    playAmbient(step.ambientSound);
  }
  if (step.soundEffect) {
    playSound(step.soundEffect);
  }
  const actionResult = applyDialogueActions(clearedState, step.onEnterEffects);
  if (actionResult.travelToRoomId || actionResult.startCutsceneId) {
    return applyNarrativeActionResult(
      {
        ...clearedState,
        activeCutscene: null,
      },
      actionResult,
      { clearDialogue: true, clearCutscene: true }
    );
  }

  const nextState: GameState = {
    ...clearedState,
    activeEffects: actionResult.activeEffects,
    objects: actionResult.objects,
    playerStorage: actionResult.playerStorage,
    energy: actionResult.energy,
    mana: actionResult.mana,
    health: actionResult.health,
    inventory: actionResult.inventory,
    inventoryEquipment: actionResult.inventoryEquipment,
    skills: actionResult.skills,
    unlockCues: actionResult.unlockCues,
    objectEmoteCues: actionResult.objectEmoteCues,
    log: actionResult.log,
    activeCutscene: {
      cutsceneId,
      stepId,
      awaitingDialogue: step.kind === "dialogue",
    },
  };

  if (step.kind !== "dialogue") {
    return nextState;
  }

  if (!step.dialogueId) {
    return step.nextStepId ? enterCutsceneStep(nextState, cutsceneId, step.nextStepId) : completeCutsceneState(nextState);
  }

  const dialogue = getBundle()?.dialogues.find((entry) => entry.id === step.dialogueId);
  if (!dialogue) {
    return step.nextStepId ? enterCutsceneStep(nextState, cutsceneId, step.nextStepId) : completeCutsceneState(nextState);
  }

  return enterDialogueNode(nextState, dialogue.id, dialogue.startNodeId, {
    objectId: null,
    speakerName: step.speakerName || cutscene.name,
    portraitImage: step.portraitImage,
  });
}

export function startCutsceneState(state: GameState, cutsceneId: string): GameState {
  const cutscene = getBundle()?.cutscenes.find((entry) => entry.id === cutsceneId);
  if (!cutscene) {
    return {
      ...state,
      log: appendLog(state.log, `Cutscene "${cutsceneId}" was not found.`),
    };
  }

  const clearedState: GameState = {
    ...state,
    activeDialogue: null,
    activeCutscene: null,
  };
  const actionResult = applyDialogueActions(clearedState, cutscene.onStartEffects);
  if (actionResult.travelToRoomId || actionResult.startCutsceneId) {
    return applyNarrativeActionResult(clearedState, actionResult, {
      clearDialogue: true,
      clearCutscene: true,
    });
  }

  return enterCutsceneStep(
    {
      ...clearedState,
      activeEffects: actionResult.activeEffects,
      objects: actionResult.objects,
      playerStorage: actionResult.playerStorage,
      energy: actionResult.energy,
      mana: actionResult.mana,
      health: actionResult.health,
      inventory: actionResult.inventory,
      inventoryEquipment: actionResult.inventoryEquipment,
      skills: actionResult.skills,
      unlockCues: actionResult.unlockCues,
      objectEmoteCues: actionResult.objectEmoteCues,
      log: appendLog(actionResult.log, `Scene started: ${cutscene.name}.`),
    },
    cutscene.id,
    cutscene.startStepId
  );
}

function advanceCutsceneState(state: GameState): GameState {
  if (!state.activeCutscene) {
    return state;
  }

  const cutscene = getBundle()?.cutscenes.find((entry) => entry.id === state.activeCutscene?.cutsceneId);
  const step = cutscene?.steps.find((entry) => entry.id === state.activeCutscene?.stepId);
  if (!cutscene || !step || step.kind !== "text") {
    return state;
  }

  const actionResult = applyDialogueActions(state, step.onContinueEffects);
  if (actionResult.travelToRoomId || actionResult.startCutsceneId) {
    return applyNarrativeActionResult(
      {
        ...state,
        activeCutscene: null,
        activeDialogue: null,
      },
      actionResult,
      { clearDialogue: true, clearCutscene: true }
    );
  }

  const progressedState: GameState = {
      ...state,
      activeEffects: actionResult.activeEffects,
      objects: actionResult.objects,
      playerStorage: actionResult.playerStorage,
    energy: actionResult.energy,
    mana: actionResult.mana,
    health: actionResult.health,
    inventory: actionResult.inventory,
    inventoryEquipment: actionResult.inventoryEquipment,
    skills: actionResult.skills,
    unlockCues: actionResult.unlockCues,
    objectEmoteCues: actionResult.objectEmoteCues,
    log: actionResult.log,
  };

  return step.nextStepId
    ? enterCutsceneStep(progressedState, cutscene.id, step.nextStepId)
    : completeCutsceneState(progressedState);
}

function resumeCutsceneAfterDialogue(state: GameState): GameState {
  if (!state.activeCutscene?.awaitingDialogue) {
    return state;
  }

  const cutscene = getBundle()?.cutscenes.find((entry) => entry.id === state.activeCutscene?.cutsceneId);
  const step = cutscene?.steps.find((entry) => entry.id === state.activeCutscene?.stepId);
  if (!cutscene || !step || step.kind !== "dialogue") {
    return {
      ...state,
      activeCutscene: null,
    };
  }

  return step.nextStepId
    ? enterCutsceneStep(
        {
          ...state,
          activeDialogue: null,
        },
        cutscene.id,
        step.nextStepId
      )
    : completeCutsceneState({
        ...state,
        activeDialogue: null,
      });
}

function resolveDestroyedObjectsFromTickState(state: GameState): GameState {
  let nextState = state;
  const deadObjectIds = nextState.objects.filter((entry) => entry.integrity <= 0).map((entry) => entry.id);

  for (const objectId of deadObjectIds) {
    const targetObject = nextState.objects.find((entry) => entry.id === objectId);
    if (!targetObject) {
      continue;
    }

    const destroyedIndex = nextState.objects.findIndex((entry) => entry.id === objectId);
    const resolvedDrops = resolveObjectDropsOnDestroy(nextState, targetObject);
    const stackableDrops = resolvedDrops.flatMap((drop) =>
      drop.kind === "item" && drop.inventoryItem ? [drop.inventoryItem] : []
    );
    const equipmentDrops = resolvedDrops.flatMap((drop) =>
      drop.kind === "equipment" ? (drop.equipmentItems ?? []) : []
    );
    let nextFloatTexts = nextState.floatTexts;
    for (const drop of resolvedDrops) {
      nextFloatTexts = pushFloatingText(nextFloatTexts, `+${drop.qty} ${drop.name}`, nextState.now, {
        zone: "objects",
      });
    }

    const hadSelection = nextState.selectedObjectId === objectId;
    const dropText = resolvedDrops.map((drop) => `${drop.qty} ${drop.name}`).join(", ");
    let nextLog = appendLog(
      nextState.log,
      dropText ? `${targetObject.name} was destroyed. Loot: ${dropText}.` : `${targetObject.name} was destroyed.`
    );
    if (hadSelection) {
      nextLog = appendLog(nextLog, "Target destroyed. Auto-cast stopped.");
    }

    let workingState: GameState = {
      ...nextState,
      playerStorage: markSpawnDefeated(nextState.playerStorage, targetObject),
      inventory: mergeInventoryItems(nextState.inventory, stackableDrops),
      inventoryEquipment: [...nextState.inventoryEquipment, ...equipmentDrops],
      objects: nextState.objects.filter((entry) => entry.id !== objectId),
      selectedObjectId: hadSelection ? null : nextState.selectedObjectId,
      activeDialogue: hadSelection ? null : nextState.activeDialogue,
      autoSkillId: hadSelection ? null : nextState.autoSkillId,
      action: nextState.action?.objectId === objectId ? null : nextState.action,
      weaponAction: nextState.weaponAction?.objectId === objectId ? null : nextState.weaponAction,
      hostileAction:
        nextState.hostileAction?.objectId === objectId || nextState.hostileAction?.targetObjectId === objectId
          ? null
          : nextState.hostileAction,
      friendlyAction:
        nextState.friendlyAction?.objectId === objectId || nextState.friendlyAction?.targetObjectId === objectId
          ? null
          : nextState.friendlyAction,
      destroyedObjectCues: [
        ...nextState.destroyedObjectCues,
        {
          object: { ...targetObject, integrity: 0 },
          createdAt: nextState.now,
          expiresAt: nextState.now + 4600,
          index: destroyedIndex >= 0 ? destroyedIndex : nextState.objects.length,
        },
      ],
      lootReceiptCues: pushLootReceiptCue(
        {
          ...nextState,
          inventory: mergeInventoryItems(nextState.inventory, stackableDrops),
          inventoryEquipment: [...nextState.inventoryEquipment, ...equipmentDrops],
        },
        resolvedDrops,
        targetObject.id
      ),
      floatTexts: nextFloatTexts,
      log: nextLog,
    };

    if (targetObject.interactableId) {
      const bundle = getBundle();
      const interDef = bundle?.interactables.find((entry) => entry.id === targetObject.interactableId);
      if (bundle && interDef?.onDestroyEffects?.length) {
        workingState = applyHookResultState(
          workingState,
          executeEventActions(interDef.onDestroyEffects, workingState, bundle)
        );
      }
      if (interDef?.sounds?.onDestroy) {
        playSound(interDef.sounds.onDestroy, interDef.sounds.onDestroyVolume ?? 1);
      }
    }

    nextState = workingState;
    if (nextState.activeCutscene || nextState.currentRoomId !== state.currentRoomId) {
      return nextState;
    }
  }

  return nextState;
}

function applyHookResultState(
  state: GameState,
    result: Partial<{
      activeEffects: GameState["activeEffects"];
      objects: GameState["objects"];
      playerStorage: GameState["playerStorage"];
      seenQuestIds: string[];
      energy: number;
      mana: number;
      health: number;
    inventory: InventoryItem[];
    inventoryEquipment: EquipmentItemInstance[];
    skills: SkillState[];
    unlockCues: GameState["unlockCues"];
    objectEmoteCues: GameState["objectEmoteCues"];
    travelToRoomId: string;
    startCutsceneId: string;
    log: string[];
  }>
): GameState {
  const mergedState = mergeHookResult(state, result);
  const traveledState = result.travelToRoomId
    ? travelToRoomState(mergedState, result.travelToRoomId, { ignoreReachability: true })
    : mergedState;
  return result.startCutsceneId
    ? startCutsceneState(
        {
          ...traveledState,
          activeDialogue: null,
        },
        result.startCutsceneId
      )
    : traveledState;
}

export function reducer(state: GameState, action: GameAction): GameState {
  if (state.activeCutscene) {
    switch (action.type) {
      case "TICK":
      case "ADVANCE_CUTSCENE":
      case "ADVANCE_DIALOGUE":
      case "CHOOSE_DIALOGUE_OPTION":
      case "CLOSE_DIALOGUE":
        break;
      default:
        return state;
    }
  }

  switch (action.type) {
    case "EXPLORE": {
      if (state.action) {
        return {
          ...state,
          log: appendLog(state.log, "Finish the current cast before exploring."),
        };
      }

      if (state.travelAction) {
        return {
          ...state,
          log: appendLog(state.log, "Finish travelling before exploring."),
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
        activeDialogue: null,
        hostileAction: null,
        friendlyAction: null,
        weaponAction: null,
        weaponAutoEnabled: true,
        weaponAttackAnimateUntil: 0,
        destroyedObjectCues: [],
        objectAttackCues: [],
        objectEmoteCues: [],
        log: appendLog(state.log, "Exploring..."),
      };
      }

    case "ACKNOWLEDGE_VISIBLE_QUESTS": {
      const visibleQuestIds = getVisibleQuestIds(state);
      const nextSeenQuestIds = Array.from(new Set([...state.seenQuestIds, ...visibleQuestIds]));
      if (nextSeenQuestIds.length === state.seenQuestIds.length) {
        return state;
      }
      return {
        ...state,
        seenQuestIds: nextSeenQuestIds,
      };
    }

    case "SELECT_OBJECT": {
      const selectedObject = state.objects.find((entry) => entry.id === action.objectId);
      if (!selectedObject) {
        return state;
      }
      const resolvedDialogueId = resolveObjectDialogueId(state, selectedObject);

      let nextState =
        resolvedDialogueId
          ? state.activeDialogue?.objectId === selectedObject.id && state.activeDialogue.dialogueId === resolvedDialogueId
            ? {
                ...state,
                selectedObjectId: action.objectId,
                weaponAction: null,
                weaponAutoEnabled:
                  state.selectedObjectId !== action.objectId ? true : state.weaponAutoEnabled,
                weaponAttackAnimateUntil: 0,
              }
            : enterDialogueNode(
                {
                  ...state,
                  selectedObjectId: action.objectId,
                  weaponAction: null,
                  weaponAutoEnabled:
                    state.selectedObjectId !== action.objectId ? true : state.weaponAutoEnabled,
                  weaponAttackAnimateUntil: 0,
                },
                resolvedDialogueId,
                getBundle()?.dialogues.find((entry) => entry.id === resolvedDialogueId)?.startNodeId ?? "",
                {
                  objectId: selectedObject.id,
                  speakerName: selectedObject.name,
                  portraitImage: selectedObject.image || selectedObject.portraitImage,
                  meterLabel: selectedObject.meterLabel,
                  integrity: selectedObject.integrity,
                  maxIntegrity: selectedObject.maxIntegrity,
                }
              )
          : {
              ...state,
              selectedObjectId: action.objectId,
              activeDialogue: null,
              weaponAction: null,
              weaponAutoEnabled:
                state.selectedObjectId !== action.objectId ? true : state.weaponAutoEnabled,
              weaponAttackAnimateUntil: 0,
            };

      if (!resolvedDialogueId && nextState.autoSkillId && !nextState.action) {
        const plan = makeActionPlan(nextState, nextState.autoSkillId, state.now);
        if (plan) {
          // castSound is managed by App.tsx useEffect
          nextState = {
            ...nextState,
            action: plan.action,
            energy: plan.nextEnergy,
          };
        }
      }

      if (!resolvedDialogueId && !nextState.weaponAction) {
        const weaponPlan = createWeaponActionPlan(nextState, state.now);
        if (weaponPlan) {
          nextState = {
            ...nextState,
            weaponAction: weaponPlan,
          };
        }
      }

      return nextState;
    }

    case "CLEAR_SELECTED_OBJECT": {
      return clearSelectedObjectState(state);
    }

    case "ADVANCE_DIALOGUE": {
      if (!state.activeDialogue) return state;
      const dialogue = getBundle()?.dialogues.find((entry) => entry.id === state.activeDialogue?.dialogueId);
      const node = dialogue?.nodes.find((entry) => entry.id === state.activeDialogue?.nodeId);
      if (!dialogue || !node) {
        return state.activeCutscene?.awaitingDialogue
          ? resumeCutsceneAfterDialogue({ ...state, activeDialogue: null })
          : { ...state, activeDialogue: null };
      }
      if (!node.nextNodeId) {
        const closedState = {
          ...state,
          activeDialogue: null,
          log: appendLog(state.log, "Conversation ended."),
        };
        return state.activeCutscene?.awaitingDialogue
          ? resumeCutsceneAfterDialogue(closedState)
          : closedState;
      }
      return enterDialogueNode(state, dialogue.id, node.nextNodeId, state.activeDialogue);
    }

    case "CHOOSE_DIALOGUE_OPTION": {
      if (!state.activeDialogue) return state;
      const dialogue = getBundle()?.dialogues.find((entry) => entry.id === state.activeDialogue?.dialogueId);
      const node = dialogue?.nodes.find((entry) => entry.id === state.activeDialogue?.nodeId);
      const option = node?.options.find((entry) => entry.id === action.optionId);
      if (!dialogue || !node || !option) {
        return state;
      }
      const ctx = buildEvalContext(state);
      if (option.condition && !evaluateCondition(option.condition, ctx)) {
        return state;
      }

      const dialogueActionContext = state.activeDialogue.objectId
        ? { bearer: { kind: "object" as const, objectId: state.activeDialogue.objectId } }
        : undefined;
      const optionResult = applyDialogueActions(state, option.effects, dialogueActionContext);
      if (optionResult.travelToRoomId || optionResult.startCutsceneId) {
        return applyNarrativeActionResult(
          {
            ...state,
            activeDialogue: null,
          },
          optionResult,
          {
            clearDialogue: true,
            clearCutscene: Boolean(state.activeCutscene?.awaitingDialogue),
          }
        );
      }
      if (option.closeDialogue || !option.nextNodeId) {
        const closedState = {
          ...state,
          activeEffects: optionResult.activeEffects,
          objects: optionResult.objects,
          playerStorage: optionResult.playerStorage,
          energy: optionResult.energy,
          health: optionResult.health,
          inventory: optionResult.inventory,
          inventoryEquipment: optionResult.inventoryEquipment,
          skills: optionResult.skills,
          unlockCues: optionResult.unlockCues,
          objectEmoteCues: optionResult.objectEmoteCues,
          activeDialogue: null,
          log: appendLog(optionResult.log, "Conversation ended."),
        };
        return state.activeCutscene?.awaitingDialogue
          ? resumeCutsceneAfterDialogue(closedState)
          : closedState;
      }

      return enterDialogueNode(
        {
          ...state,
          activeEffects: optionResult.activeEffects,
          objects: optionResult.objects,
          playerStorage: optionResult.playerStorage,
          energy: optionResult.energy,
          health: optionResult.health,
          inventory: optionResult.inventory,
          inventoryEquipment: optionResult.inventoryEquipment,
          skills: optionResult.skills,
          unlockCues: optionResult.unlockCues,
          objectEmoteCues: optionResult.objectEmoteCues,
          log: optionResult.log,
        },
        dialogue.id,
        option.nextNodeId,
        state.activeDialogue
      );
    }

    case "CLOSE_DIALOGUE": {
      if (!state.activeDialogue) return state;
      const closedState = {
        ...state,
        activeDialogue: null,
        log: appendLog(state.log, "Conversation ended."),
      };
      return state.activeCutscene?.awaitingDialogue
        ? resumeCutsceneAfterDialogue(closedState)
        : closedState;
    }

    case "ADVANCE_CUTSCENE": {
      return advanceCutsceneState(state);
    }

    case "START_CUTSCENE": {
      return startCutsceneState(
        {
          ...state,
          activeDialogue: null,
          hostileAction: null,
          friendlyAction: null,
          weaponAction: null,
          weaponAutoEnabled: true,
          weaponAttackAnimateUntil: 0,
          activeCutscene: null,
          objectAttackCues: [],
          objectEmoteCues: [],
        },
        action.cutsceneId
      );
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

      const blockedMessage = getPlayerSkillBlockedMessage(state, skill);
      if (blockedMessage) {
        return {
          ...state,
          autoSkillId: state.autoSkillId === action.skillId ? null : state.autoSkillId,
          action: state.action?.skillId === action.skillId ? null : state.action,
          log: appendLog(state.log, blockedMessage),
        };
      }

      const skillDef = getBundle()?.skills.find((entry) => entry.id === action.skillId);
      const autoCastDisabled = skillDef?.disableAutoCast === true;

      let nextState: GameState = {
        ...state,
        autoSkillId: autoCastDisabled ? null : action.skillId,
        log: appendLog(
          state.log,
          autoCastDisabled ? `Casting ${skill.name}.` : `Auto-cast set: ${skill.name}.`
        ),
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
        // castSound is managed by App.tsx useEffect
        nextState = {
          ...nextState,
          action: plan.action,
          energy: plan.nextEnergy,
        };
      }

      return nextState;
    }

    case "TOGGLE_WEAPON_AUTO": {
      const nextEnabled = !state.weaponAutoEnabled;

      if (!nextEnabled) {
        return {
          ...state,
          weaponAutoEnabled: false,
          weaponAction: null,
          weaponAttackAnimateUntil: 0,
          log: appendLog(state.log, "Weapon auto-attack paused."),
        };
      }

      if (playerHasStatusRestriction(state, "preventsWeaponAbilities")) {
        return {
          ...state,
          weaponAutoEnabled: false,
          weaponAction: null,
          weaponAttackAnimateUntil: 0,
          log: appendLog(state.log, "Weapon abilities are currently prevented."),
        };
      }

      let nextState: GameState = {
        ...state,
        weaponAutoEnabled: true,
        log: appendLog(state.log, "Weapon auto-attack enabled."),
      };

      if (!nextState.weaponAction) {
        const weaponPlan = createWeaponActionPlan(nextState, state.now);
        if (weaponPlan) {
          nextState = {
            ...nextState,
            weaponAction: weaponPlan,
          };
        }
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
        const bundle = getBundle();
        if (!bundle) return state;
        const item = state.inventoryEquipment.find((entry) => entry.instanceId === action.instanceId);
        if (!item) return state;
        const resolved = resolveEquipmentItem(item, bundle);
        if (!resolved?.slot || resolved.slot === "rune") return state;

        const nextEquipment = { ...state.equipment, [resolved.slot]: item.instanceId };
        const capacityCheck = canApplyEquipmentChangeWithoutOverflow(state, nextEquipment);
        if (!capacityCheck.ok) {
          return {
            ...state,
            log: appendLog(
              state.log,
              `Cannot equip ${resolved.name}: backpack would exceed capacity (${capacityCheck.occupied}/${capacityCheck.capacity}).`
            ),
          };
        }

        const isWeaponSlot = resolved.slot === "mainHand" || resolved.slot === "offHand";
        playSound(
          isWeaponSlot
            ? "/Sound Files/UI/Equip_Dagger.wav"
            : "/Sound Files/UI/Equip_Armour.wav",
          0.6,
        );

        let nextState: GameState = {
          ...state,
          equipment: nextEquipment,
          weaponAction: resolved.slot === "mainHand" ? null : state.weaponAction,
          weaponAttackAnimateUntil: resolved.slot === "mainHand" ? 0 : state.weaponAttackAnimateUntil,
          log: appendLog(state.log, `${resolved.name} equipped in ${resolved.slot}.`),
        };

      const previousInstanceId = state.equipment[resolved.slot];
      if (previousInstanceId) {
        const previousItem = state.inventoryEquipment.find((entry) => entry.instanceId === previousInstanceId);
        if (previousItem?.legacyItemId) {
          const unequipResult = executeItemEventHooks([previousItem.legacyItemId], "on_unequip", nextState, bundle);
          nextState = applyHookResultState(nextState, unequipResult);
        }
      }
      if (item.legacyItemId) {
        const equipResult = executeItemEventHooks([item.legacyItemId], "on_equip", nextState, bundle);
        nextState = applyHookResultState(nextState, equipResult);
      }

      return nextState;
    }

    case "UNEQUIP_SLOT": {
        const previousInstanceId = state.equipment[action.slot];
        if (!previousInstanceId) return state;

        const nextEquipment = { ...state.equipment, [action.slot]: null };
        const capacityCheck = canApplyEquipmentChangeWithoutOverflow(state, nextEquipment);
        if (!capacityCheck.ok) {
          const bundle = getBundle();
          const previousItem = bundle
            ? state.inventoryEquipment.find((entry) => entry.instanceId === previousInstanceId)
            : undefined;
          const previousName = previousItem && bundle
            ? resolveEquipmentItem(previousItem, bundle)?.name ?? action.slot
            : action.slot;
          return {
            ...state,
            log: appendLog(
              state.log,
              `Cannot unequip ${previousName}: backpack would exceed capacity (${capacityCheck.occupied}/${capacityCheck.capacity}).`
            ),
          };
        }

        const bundle = getBundle();
        let nextState: GameState = {
          ...state,
          equipment: nextEquipment,
          weaponAction: action.slot === "mainHand" ? null : state.weaponAction,
          weaponAttackAnimateUntil: action.slot === "mainHand" ? 0 : state.weaponAttackAnimateUntil,
          log: appendLog(state.log, `${action.slot} slot is now empty.`),
        };

      if (bundle) {
        const previousItem = state.inventoryEquipment.find((entry) => entry.instanceId === previousInstanceId);
        if (previousItem?.legacyItemId) {
          const unequipResult = executeItemEventHooks([previousItem.legacyItemId], "on_unequip", nextState, bundle);
          nextState = applyHookResultState(nextState, unequipResult);
        }
      }

      return nextState;
    }

    case "CRAFT_ITEM": {
      const bundle = getBundle();
      if (!bundle) return state;

      if (state.craftingAction) {
        return {
          ...state,
          log: appendLog(state.log, "Already crafting an item."),
        };
      }

      const recipe = (bundle.recipes ?? []).find((r) => r.id === action.recipeId);
      if (!recipe) return state;

      const ctx = buildEvalContext(state);
      const available = getAvailableRecipes(bundle.recipes ?? [], state.inventory, ctx, undefined);
      if (!available.find((r) => r.id === action.recipeId)) {
        return { ...state, log: appendLog(state.log, "Cannot craft: missing ingredients or conditions not met.") };
      }

      const outputDef = bundle.items.find((i) => i.id === recipe.outputItemId);
      if (!outputDef) return state;

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

      return {
        ...state,
        inventory: nextInventory,
        craftingAction: {
          recipeId: recipe.id,
          startedAt: state.now,
          endsAt: state.now + Math.max(100, recipe.craftTimeMs ?? 2000),
          durationMs: Math.max(100, recipe.craftTimeMs ?? 2000),
          outputItemId: outputDef.id,
          outputQty: recipe.outputQty,
          outputName: outputDef.name,
        },
        log: appendLog(state.log, `Crafting ${outputDef.name}...`),
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
              backpackSlots: itemDef?.stats.backpackSlots,
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
      return beginTravelActionState(state, action.roomId);
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
        playerHitCue: state.playerHitCue && state.playerHitCue.expiresAt > now ? state.playerHitCue : null,
        weaponAttackAnimateUntil: state.weaponAttackAnimateUntil > now ? state.weaponAttackAnimateUntil : 0,
        unlockCues: state.unlockCues.filter((entry) => entry.expiresAt > now),
        destroyedObjectCues: state.destroyedObjectCues.filter((entry) => entry.expiresAt > now),
        objectAttackCues: state.objectAttackCues.filter((entry) => entry.expiresAt > now),
        objectEmoteCues: state.objectEmoteCues.filter((entry) => entry.expiresAt > now),
        lootReceiptCues: state.lootReceiptCues.filter((entry) => entry.expiresAt > now),
        questReceiptCues: state.questReceiptCues.filter((entry) => entry.expiresAt > now),
      };

      if (nextState.craftingAction && now >= nextState.craftingAction.endsAt) {
        const completedCraft = nextState.craftingAction;
        const craftBundle = getBundle();
        const outputDef = craftBundle?.items.find((item) => item.id === completedCraft.outputItemId);
        if (outputDef) {
          const granted = grantItemToInventories(
            nextState.inventory,
            nextState.inventoryEquipment,
            outputDef,
            completedCraft.outputQty
          );

          nextState = {
            ...nextState,
            inventory: granted.stackables,
            inventoryEquipment: granted.equipmentItems,
            craftingAction: null,
            floatTexts: pushFloatingText(
              nextState.floatTexts,
              `+${completedCraft.outputQty} ${outputDef.name}`,
              now,
              { zone: "skills", durationMs: 1500 }
            ),
            log: appendLog(
              nextState.log,
              `Crafted ${completedCraft.outputQty}x ${outputDef.name}.`
            ),
          };
        } else {
          nextState = {
            ...nextState,
            craftingAction: null,
          };
        }
      }

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
          selectedObjectId: null,
          activeDialogue: null,
          exploreAction: null,
          hostileAction: null,
          friendlyAction: null,
          weaponAction: null,
          destroyedObjectCues: [],
          objectAttackCues: [],
          objectEmoteCues: [],
          objectBatchStartedAt: now,
          log: appendLog(nextState.log, `Exploration #${nextExploreCount} generated ${nextObjects.length} objects.`),
        };

        // Fire on_explore hooks for equipped items
        const exploreBundle = getBundle();
        if (exploreBundle) {
          const equippedIds = getEquippedLegacyItemIds(nextState);
          const exploreResult = executeItemEventHooks(equippedIds, "on_explore", nextState, exploreBundle);
          nextState = applyHookResultState(nextState, exploreResult);
        }
      }

      if (nextState.travelAction) {
        if (now < nextState.travelAction.endsAt) {
          return nextState;
        }

        const completedTravel = nextState.travelAction;
        nextState = travelToRoomState(
          {
            ...nextState,
            travelAction: null,
          },
          completedTravel.roomId,
          { ignoreReachability: true }
        );
      }

      if (nextState.action && nextState.action.tickMomentsMs.length > 0) {
        nextState = resolveDueActionTicks(nextState);
      }

      if (nextState.action && now >= nextState.action.endsAt) {
        nextState = resolveCompletedAction(nextState);
      }

      if (nextState.hostileAction) {
        const hostileObjectExists = nextState.objects.some((entry) => entry.id === nextState.hostileAction?.objectId);
        const hostileTargetExists =
          !nextState.hostileAction.targetObjectId ||
          nextState.objects.some((entry) => entry.id === nextState.hostileAction?.targetObjectId);
        if (!hostileObjectExists || !hostileTargetExists) {
          nextState = {
            ...nextState,
            hostileAction: null,
          };
        } else {
          if (nextState.hostileAction.tickMomentsMs.length > 0) {
            nextState = resolveDueHostileActionTicks(nextState);
          }
          if (!isHostileCastingBlocked(nextState) && now >= (nextState.hostileAction?.endsAt ?? 0)) {
            nextState = resolveCompletedHostileAction(nextState);
          }
        }
      }

      if (!nextState.hostileAction && !isHostileCastingBlocked(nextState)) {
        const hostilePlan = createHostileActionPlan(nextState, now);
        if (hostilePlan) {
          playInteractableAbilityCastSound(nextState, hostilePlan);
          nextState = {
            ...nextState,
            hostileAction: hostilePlan,
          };
        }
      }

      if (nextState.friendlyAction) {
        const friendlySourceExists = nextState.objects.some((entry) => entry.id === nextState.friendlyAction?.objectId);
        const friendlyTargetExists = nextState.objects.some((entry) => entry.id === nextState.friendlyAction?.targetObjectId);
        if (!friendlySourceExists || !friendlyTargetExists) {
          nextState = {
            ...nextState,
            friendlyAction: null,
          };
        } else {
          if (nextState.friendlyAction.tickMomentsMs.length > 0) {
            nextState = resolveDueFriendlyActionTicks(nextState);
          }
          if (!isHostileCastingBlocked(nextState) && now >= (nextState.friendlyAction?.endsAt ?? 0)) {
            nextState = resolveCompletedFriendlyAction(nextState);
          }
        }
      }

      if (!nextState.friendlyAction && !isHostileCastingBlocked(nextState)) {
        const friendlyPlan = createFriendlyActionPlan(nextState, now);
        if (friendlyPlan) {
          playInteractableAbilityCastSound(nextState, friendlyPlan);
          nextState = {
            ...nextState,
            friendlyAction: friendlyPlan,
          };
        }
      }

      if (nextState.weaponAction) {
        const selectedTargetStillValid =
          nextState.selectedObjectId === nextState.weaponAction.objectId &&
          nextState.objects.some((entry) => entry.id === nextState.weaponAction?.objectId && entry.tag === "enemy");
        if (!selectedTargetStillValid || !getResolvedMainHandWeapon(nextState) || isWeaponAutoBlocked(nextState)) {
          nextState = {
            ...nextState,
            weaponAction: null,
          };
        } else if (now >= nextState.weaponAction.endsAt) {
          nextState = resolveCompletedWeaponAction(nextState);
        }
      }

      if (!nextState.weaponAction && !isWeaponAutoBlocked(nextState)) {
        const weaponPlan = createWeaponActionPlan(nextState, now);
        if (weaponPlan) {
          nextState = {
            ...nextState,
            weaponAction: weaponPlan,
          };
        }
      }

      if (!nextState.action && nextState.autoSkillId) {
        const selectedExists = nextState.objects.some((entry) => entry.id === nextState.selectedObjectId);
        if (!selectedExists) {
          nextState = {
            ...nextState,
            selectedObjectId: null,
            activeDialogue: null,
            autoSkillId: null,
          };
          return nextState;
        }

        const plan = makeActionPlan(nextState, nextState.autoSkillId, now);
        if (plan) {
          // castSound is managed by App.tsx useEffect
          nextState = {
            ...nextState,
            action: plan.action,
            energy: plan.nextEnergy,
          };
        }
      }

      // ── Status effect expiry ──
      const tickBundle = getBundle();
      const healthBeforeIntervalHooks = nextState.health;
      if (tickBundle && (nextState.activeEffects ?? []).length > 0) {
        nextState = applyHookResultState(
          nextState,
          executeStatusEffectIntervalHooks({ kind: "player" }, nextState, tickBundle)
        );
      }

      if (tickBundle && nextState.objects.some((object) => (object.activeEffects ?? []).length > 0)) {
        const objectIdsWithEffects = nextState.objects
          .filter((object) => (object.activeEffects ?? []).length > 0)
          .map((object) => object.id);
        for (const objectId of objectIdsWithEffects) {
          if (!nextState.objects.some((object) => object.id === objectId)) {
            continue;
          }
          nextState = applyHookResultState(
            nextState,
            executeStatusEffectIntervalHooks({ kind: "object", objectId }, nextState, tickBundle)
          );
        }
      }

      nextState = resolveDestroyedObjectsFromTickState(nextState);

      if (healthBeforeIntervalHooks > 0 && nextState.health <= 0) {
        nextState = {
          ...nextState,
          log: appendLog(nextState.log, "You were defeated."),
        };
      }

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

      if (tickBundle && nextState.objects.some((object) => (object.activeEffects ?? []).length > 0)) {
        const nextObjects = nextState.objects.map((object) => {
          if (!object.activeEffects || object.activeEffects.length === 0) {
            return object;
          }
          const ctx = buildEvalContextForTarget(nextState, {
            targetTag: object.tag,
            targetEffects: object.activeEffects,
          });
          const filteredEffects = object.activeEffects.filter((active) => {
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
          if (filteredEffects.length === object.activeEffects.length) {
            return object;
          }
          return { ...object, activeEffects: filteredEffects };
        });
        if (nextObjects.some((object, index) => object !== nextState.objects[index])) {
          nextState = { ...nextState, objects: nextObjects };
        }
      }

      // ── on_tick hooks for equipped items ──
      if (tickBundle) {
        const equippedIds = getEquippedLegacyItemIds(nextState);
        const tickResult = executeItemEventHooks(equippedIds, "on_tick", nextState, tickBundle);
        if (
          tickResult.activeEffects ||
          tickResult.playerStorage ||
          tickResult.energy !== undefined ||
          tickResult.travelToRoomId ||
          tickResult.startCutsceneId
        ) {
          nextState = applyHookResultState(nextState, tickResult);
        }
      }

      nextState = applyInteractableFormRules(nextState);

      const questPopupState = pushQuestReceiptCues(state, nextState);
      nextState = {
        ...nextState,
        announcedQuestIds: questPopupState.announcedQuestIds,
        questReceiptCues: questPopupState.questReceiptCues,
      };

      return nextState;
    }

    case "SET_RUNE": {
      const bundle = getBundle();
      if (!bundle) return state;
      const item = state.inventoryEquipment.find((entry) => entry.instanceId === action.instanceId);
      if (!item) return state;
      const resolved = resolveEquipmentItem(item, bundle);
      if (!resolved || resolved.slot !== "rune") return state;
      const runes = [...state.feyRunes] as [string | null, string | null, string | null, string | null, string | null, string | null];
      runes[action.slot] = item.instanceId;
      return {
        ...state,
        feyRunes: runes,
        log: appendLog(state.log, `${resolved.name} set in rune slot ${action.slot + 1}.`),
      };
    }

    case "REMOVE_RUNE": {
      const currentId = state.feyRunes[action.slot];
      if (!currentId) return state;
      const bundle = getBundle();
      const currentItem = bundle
        ? state.inventoryEquipment.find((entry) => entry.instanceId === currentId)
        : undefined;
      const name = bundle && currentItem
        ? resolveEquipmentItem(currentItem, bundle)?.name ?? "Rune"
        : "Rune";
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

    case "DISMISS_LOOT_RECEIPT": {
      const dismissedCue = state.lootReceiptCues.find((cue) => cue.id === action.cueId);
      const nextLootCues = state.lootReceiptCues.filter((cue) => cue.id !== action.cueId);
      // Also expire the destroyed object cue that was holding the grid slot
      const nextDestroyed = dismissedCue
        ? state.destroyedObjectCues.map((cue) =>
            cue.object.id === dismissedCue.objectId ? { ...cue, expiresAt: Math.min(cue.expiresAt, state.now + 350) } : cue
          )
        : state.destroyedObjectCues;
      return { ...state, lootReceiptCues: nextLootCues, destroyedObjectCues: nextDestroyed };
    }

    case "ASSIGN_BIOBOARD_SKILL": {
      const skill = state.skills.find((entry) => entry.id === action.skillId && entry.kind === "active");
      if (!skill || skill.system !== "combat") {
        return state;
      }
      if (state.bioboardSlots.includes(action.skillId)) {
        return state;
      }
      const nextIndex = state.bioboardSlots.findIndex((slotId) => slotId === null);
      if (nextIndex === -1) {
        return {
          ...state,
          log: appendLog(state.log, "No open bioboard slots available."),
        };
      }
      const nextSlots = [...state.bioboardSlots];
      nextSlots[nextIndex] = action.skillId;
      return {
        ...state,
        bioboardSlots: nextSlots,
        log: appendLog(state.log, `${skill.name} slotted to bioboard.`),
      };
    }

    case "REMOVE_BIOBOARD_SKILL": {
      const slotId = state.bioboardSlots[action.slotIndex];
      if (!slotId) {
        return state;
      }
      const skillName = state.skills.find((entry) => entry.id === slotId)?.name ?? "Ability";
      const nextSlots = [...state.bioboardSlots];
      nextSlots[action.slotIndex] = null;
      return {
        ...state,
        bioboardSlots: nextSlots,
        log: appendLog(state.log, `${skillName} removed from bioboard.`),
      };
    }

    default:
      return state;
  }
}
