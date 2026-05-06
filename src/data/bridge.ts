/**
 * Bridge module: converts editor JSON bundle types into the game's runtime types.
 * This keeps App.tsx clean — it just calls bridge functions.
 */
import type {
  ItemBaseDef,
  GameContentBundle,
  SkillDef,
  ItemDef,
  ComboDef,
  InteractableDef,
  RecipeDef,
  ItemQuality,
  ModifierPayloadDef,
  ItemRequirementsDef,
  LootEntryDef,
} from "./loader";
import { evaluateCondition, type EvalContext } from "./evaluator";
import { rollEquipmentInstance } from "./itemization";

// ── Game runtime types (must match App.tsx) ──

export interface SkillState {
  id: string;
  name: string;
  kind: "passive" | "active";
  unlocked: boolean;
  system?: "gathering" | "combat";
  combatSchool?: "string" | "entropy" | "genesis" | "chaos";
  image?: string;
  baseManaCost?: number;
  bioboardSubcategory?: string;
  bioboardPrimaryText?: string;
  bioboardSecondaryText?: string;
  usageProfile?: SkillDef["usageProfile"];
  effects?: SkillDef["effects"];
  statusInteractions?: SkillDef["statusInteractions"];
  tags: string[];
  playerTargetTags?: string[];
  abilityTags: string[];
  linkedPassiveId?: string;
  level: number;
  xp: number;
  xpToNext: number;
  baseDurationMs: number;
  baseEnergyCost: number;
  basePower: number;
  basePowerMax?: number;
  powerPerLevel: number;
  powerPerLevelMax?: number;
  barColor: string;
  accentColor: string;
  description: string;
  castSound?: string;
  castSoundVolume?: number;
  castSoundOnComplete?: boolean;
  hitSound?: string;
  hitSoundVolume?: number;
  tickSound?: string;
  tickSoundVolume?: number;
  perkMilestones: SkillDef["perkMilestones"];
  unlockCondition?: string;
  xpScaling: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  qty: number;
  slot?: "head" | "shoulders" | "chest" | "hands" | "legs" | "feet" | "back" | "mainHand" | "offHand" | "rune";
  attack?: number;
  activityPowerMultiplier?: number;
  backpackSlots?: number;
  defense?: number;
  energyRegen?: number;
  speedMultiplier?: number;
  energyCostMultiplier?: number;
}

export interface RolledAffix {
  affixId: string;
  tier: number;
  rolledValue: number;
}

export interface EquipmentItemInstance {
  instanceId: string;
  sourceType: "legacy" | "base" | "crafted" | "unique" | "set";
  legacyItemId?: string;
  baseId?: string;
  quality: ItemQuality;
  itemLevel: number;
  prefixes: RolledAffix[];
  suffixes: RolledAffix[];
  implicitUnlocked: boolean;
  uniqueItemId?: string;
  setItemId?: string;
  nameOverride?: string;
  imageOverride?: string;
}

export interface WorldObjectAbility {
  skillId?: string;
  name: string;
  castTimeMs: number;
  cooldownMs: number;
  targetMode?: InteractableDef["abilities"][number]["targetMode"];
  targetInteractableId?: string;
  damage?: number;
  effect: string;
  resistedByPassiveId?: string;
  resistChancePerLevel: number;
}

export interface WorldObjectDrop {
  kind: "item" | "equipment";
  id: string;
  name: string;
  qty: number;
  inventoryItem?: InventoryItem;
  equipmentItems?: EquipmentItemInstance[];
}

export interface ResolvedEquipmentItem {
  instanceId: string;
  name: string;
  description: string;
  additionalEffectsText?: string;
  image?: string;
  slot?: ItemDef["slot"];
  quality: ItemQuality;
  itemLevel: number;
  requirements?: ItemRequirementsDef;
  modifiers: ModifierPayloadDef[];
  attackTags?: string[];
  sourceType: EquipmentItemInstance["sourceType"];
  legacyItemId?: string;
  baseId?: string;
  uniqueItemId?: string;
  setItemId?: string;
}

export interface StartingInventoryBundle {
  stackables: InventoryItem[];
  equipmentItems: EquipmentItemInstance[];
}

export interface WorldObject {
  id: string;
  name: string;
  tag: string;
  sourceRoomId?: string;
  sourceSpawnEntryId?: string;
  neverRespawnAfterDefeat?: boolean;
  abilityBehaviorMode: "priority" | "sequence";
  allowedAbilityTags: string[];
  requiredLevel: number;
  maxIntegrity: number;
  integrity: number;
  barColor: string;
  accentColor: string;
  meterLabel: string;
  drops: WorldObjectDrop[];
  interactableId: string;
  xpRewards: { skillId: string; amount: number }[];
  formRules?: InteractableDef["formRules"];
  image?: string;
  imagePositionX?: number;
  imagePositionY?: number;
  dialogueId?: string;
  dialogueRoutes?: Array<{
    dialogueId: string;
    condition?: string;
  }>;
  portraitImage?: string;
  abilities: WorldObjectAbility[];
  abilityCooldowns: number[];
  initialAbilityDelayMs?: number;
  nextAbilityIndex: number;
  revealStartedAt?: number;
  revealDelayMs?: number;
  revealDurationMs?: number;
  activeEffects: Array<{
    effectId: string;
    stacks: number;
    appliedAt: number;
    intervalTimers?: Record<string, number>;
  }>;
}

export interface ComboRule {
  from: string;
  to: string;
  tag: string;
  windowMs: number;
  timeMultiplier: number;
  energyMultiplier: number;
  label: string;
}

export const DEFAULT_INTERACTABLE_INITIAL_ABILITY_DELAY_MS = 3000;

function getInitialAbilityReadyAt(def: InteractableDef, now?: number): number {
  if (now === undefined || (def.activityTag !== "enemy" && def.activityTag !== "friendly") || (def.abilities ?? []).length === 0) {
    return 0;
  }
  const delayMs = Math.max(0, def.initialAbilityDelayMs ?? DEFAULT_INTERACTABLE_INITIAL_ABILITY_DELAY_MS);
  return now + delayMs;
}

function resolveWorldObjectAbility(
  ability: InteractableDef["abilities"][number],
  bundle: GameContentBundle
): WorldObjectAbility {
  const linkedSkill = ability.skillId
    ? bundle.skills.find((skill) => skill.id === ability.skillId)
    : null;

  if (linkedSkill) {
    return {
      skillId: linkedSkill.id,
      name: linkedSkill.name,
      castTimeMs: ability.castTimeMs ?? linkedSkill.baseDurationMs,
      cooldownMs: ability.cooldownMs,
      targetMode: ability.targetMode,
      targetInteractableId: ability.targetInteractableId,
      damage: ability.damage,
      effect: linkedSkill.bioboardPrimaryText || linkedSkill.description || "",
      resistedByPassiveId: ability.resistedByPassiveId,
      resistChancePerLevel: ability.resistChancePerLevel,
    };
  }

  return {
    name: ability.name ?? "Ability",
    castTimeMs: ability.castTimeMs ?? 0,
    cooldownMs: ability.cooldownMs,
    targetMode: ability.targetMode,
    targetInteractableId: ability.targetInteractableId,
    damage: ability.damage ?? 0,
    effect: ability.effect ?? "",
    resistedByPassiveId: ability.resistedByPassiveId,
    resistChancePerLevel: ability.resistChancePerLevel,
  };
}

export function createWorldObjectFromInteractableDef(
  bundle: GameContentBundle,
  def: InteractableDef,
  options?: {
    id?: string;
    integrityRatio?: number;
    drops?: WorldObjectDrop[];
    activeEffects?: WorldObject["activeEffects"];
    now?: number;
    revealStartedAt?: number;
    revealDelayMs?: number;
    revealDurationMs?: number;
  }
): WorldObject {
  const maxIntegrity = Math.max(1, def.effectiveHealth.min);
  const integrityRatio = options?.integrityRatio ?? 1;
  const integrity = Math.max(0, Math.min(maxIntegrity, Math.round(maxIntegrity * integrityRatio)));

  const initialAbilityReadyAt = getInitialAbilityReadyAt(def, options?.now);

  return {
    id: options?.id ?? def.id,
    name: def.name,
    tag: def.activityTag,
    abilityBehaviorMode: def.abilityBehaviorMode ?? "priority",
    allowedAbilityTags: def.allowedAbilityTags ?? [],
    requiredLevel: def.requiredLevel,
    maxIntegrity,
    integrity,
    barColor: def.barColor,
    accentColor: def.accentColor,
    meterLabel: def.meterLabel,
    drops: options?.drops ?? [],
    interactableId: def.id,
    xpRewards: def.xpRewards,
    formRules: def.formRules ?? [],
    image: def.image,
    imagePositionX: def.imagePositionX,
    imagePositionY: def.imagePositionY,
    dialogueId: def.npc?.dialogueId,
    dialogueRoutes: def.npc?.dialogues?.map((entry) => ({
      dialogueId: entry.dialogueId,
      condition: entry.condition,
    })),
    portraitImage: def.npc?.portraitImage,
    abilities: (def.abilities ?? []).map((ability) => resolveWorldObjectAbility(ability, bundle)),
    abilityCooldowns: (def.abilities ?? []).map(() => initialAbilityReadyAt),
    initialAbilityDelayMs: def.initialAbilityDelayMs,
    nextAbilityIndex: 0,
    revealStartedAt: options?.revealStartedAt,
    revealDelayMs: options?.revealDelayMs,
    revealDurationMs: options?.revealDurationMs,
    activeEffects: options?.activeEffects ?? [],
  };
}

// ── Conversion functions ──

/**
 * Convert SkillDefs into initial runtime SkillStates.
 * All skills start at level 1, xp 0, unlocked based on whether they have
 * an unlock condition (no condition = unlocked by default).
 */
export function skillDefsToStates(defs: SkillDef[]): SkillState[] {
  return defs.map((d) => ({
    id: d.id,
    name: d.name,
    kind: d.kind,
    unlocked: !d.unlockCondition, // no condition = auto-unlock
    system: d.system,
    combatSchool: d.combatSchool,
    image: d.image,
    baseManaCost: d.baseManaCost,
    bioboardSubcategory: d.bioboardSubcategory,
    bioboardPrimaryText: d.bioboardPrimaryText,
    bioboardSecondaryText: d.bioboardSecondaryText,
    usageProfile: d.usageProfile,
    effects: d.effects ?? [],
    statusInteractions: d.statusInteractions ?? [],
    tags: d.activityTags,
    playerTargetTags: d.playerTargetTags,
    abilityTags: d.abilityTags,
    linkedPassiveId: d.linkedPassiveId,
    level: 1,
    xp: 0,
    xpToNext: d.baseXpToNext,
    baseDurationMs: d.baseDurationMs,
    baseEnergyCost: d.baseEnergyCost,
    basePower: d.basePower,
    basePowerMax: d.basePowerMax,
    powerPerLevel: d.powerPerLevel,
    powerPerLevelMax: d.powerPerLevelMax,
    barColor: d.barColor,
    accentColor: d.accentColor,
    description: d.description,
    castSound: d.castSound,
    castSoundVolume: d.castSoundVolume,
    castSoundOnComplete: d.castSoundOnComplete,
    hitSound: d.hitSound,
    hitSoundVolume: d.hitSoundVolume,
    tickSound: d.tickSound,
    tickSoundVolume: d.tickSoundVolume,
    perkMilestones: [...(d.perkMilestones ?? [])].sort((a, b) => a.level - b.level),
    unlockCondition: d.unlockCondition,
    xpScaling: d.xpScaling,
  }));
}

/**
 * Convert an ItemDef into an InventoryItem with qty=1.
 */
export function itemDefToInventory(def: ItemDef, qty = 1): InventoryItem {
  return {
    id: def.id,
    name: def.name,
    qty,
    slot: def.slot,
    attack: def.stats.attack,
    defense: def.stats.defense,
    energyRegen: def.stats.energyRegen,
    activityPowerMultiplier: def.stats.activityPowerMultiplier,
    backpackSlots: def.stats.backpackSlots,
    speedMultiplier: def.stats.speedMultiplier,
    energyCostMultiplier: def.stats.energyCostMultiplier,
  };
}

function slugId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function resolveRolledAffixModifiers(instance: EquipmentItemInstance, bundle: GameContentBundle): ModifierPayloadDef[] {
  return [...instance.prefixes, ...instance.suffixes].flatMap((rolledAffix) => {
    const affix = bundle.affixes.find((entry) => entry.id === rolledAffix.affixId);
    if (!affix) return [];
    return affix.modifiers.map((modifier) => ({
      statId: modifier.statId,
      operation: modifier.operation,
      value: rolledAffix.rolledValue,
      scope: modifier.scope,
    }));
  });
}

export function createLegacyEquipmentInstance(item: ItemDef, options?: {
  sourceType?: EquipmentItemInstance["sourceType"];
  quality?: ItemQuality;
  itemLevel?: number;
}): EquipmentItemInstance {
  return {
    instanceId: slugId(item.id),
    sourceType: options?.sourceType ?? "legacy",
    legacyItemId: item.id,
    quality: options?.quality ?? (item.rarity === "rare" ? "rare" : item.rarity === "uncommon" ? "uncommon" : "common"),
    itemLevel: options?.itemLevel ?? 1,
    prefixes: [],
    suffixes: [],
    implicitUnlocked: false,
  };
}

export function createBaseEquipmentInstance(
  itemBase: ItemBaseDef,
  quality: ItemQuality,
  itemLevel: number
): EquipmentItemInstance {
  return {
    instanceId: slugId(itemBase.id),
    sourceType: "base",
    baseId: itemBase.id,
    quality,
    itemLevel,
    prefixes: [],
    suffixes: [],
    implicitUnlocked: Boolean(itemBase.implicit && itemLevel >= itemBase.implicit.unlockItemLevel),
  };
}

function createWorldDropFromItemDef(itemDef: ItemDef, qty: number): WorldObjectDrop {
  if (!itemDef.slot) {
    return {
      kind: "item",
      id: itemDef.id,
      name: itemDef.name,
      qty,
      inventoryItem: itemDefToInventory(itemDef, qty),
    };
  }

  const equipmentItems = Array.from({ length: qty }, () => createLegacyEquipmentInstance(itemDef));
  return {
    kind: "equipment",
    id: itemDef.id,
    name: itemDef.name,
    qty: equipmentItems.length,
    equipmentItems,
  };
}

function createWorldDropFromBaseEntry(
  entry: LootEntryDef,
  bundle: GameContentBundle,
  qty: number,
  rng: () => number
): WorldObjectDrop | null {
  if (!entry.itemBaseId) return null;
  const itemLevelMin = Math.max(1, entry.itemLevelMin ?? 1);
  const itemLevelMax = Math.max(itemLevelMin, entry.itemLevelMax ?? itemLevelMin);
  const equipmentItems = Array.from({ length: qty }, () => {
    const itemLevel =
      itemLevelMin === itemLevelMax
        ? itemLevelMin
        : itemLevelMin + Math.floor(rng() * (itemLevelMax - itemLevelMin + 1));
    return rollEquipmentInstance({
      bundle,
      baseId: entry.itemBaseId!,
      itemLevel,
      qualityRuleSetId: entry.qualityRuleSetId,
      rng,
    }).instance;
  });

  if (equipmentItems.length === 0) return null;
  const base = bundle.itemBases.find((itemBase) => itemBase.id === entry.itemBaseId);
  return {
    kind: "equipment",
    id: entry.itemBaseId,
    name: base?.name ?? entry.itemBaseId,
    qty: equipmentItems.length,
    equipmentItems,
  };
}

export function resolveEquipmentItem(
  instance: EquipmentItemInstance,
  bundle: GameContentBundle
): ResolvedEquipmentItem | null {
  if (instance.legacyItemId) {
    const item = bundle.items.find((entry) => entry.id === instance.legacyItemId);
    if (!item) return null;
    const modifiers: ModifierPayloadDef[] = [];
    if (item.stats.attack !== undefined) {
      modifiers.push({ statId: "flat_weapon_damage", operation: "add", value: item.stats.attack });
    }
    if (item.stats.energyRegen !== undefined) {
      modifiers.push({ statId: "energy_regen", operation: "add", value: item.stats.energyRegen });
    }
    if (item.stats.activityPowerMultiplier !== undefined) {
      modifiers.push({ statId: "all_damage_multiplier", operation: "multiply", value: item.stats.activityPowerMultiplier });
    }
    if (item.stats.backpackSlots !== undefined) {
      modifiers.push({ statId: "backpack_slots", operation: "add", value: item.stats.backpackSlots });
    }
    if (item.stats.speedMultiplier !== undefined) {
      modifiers.push({ statId: "cast_time_multiplier", operation: "multiply", value: item.stats.speedMultiplier });
    }
    if (item.stats.energyCostMultiplier !== undefined) {
      modifiers.push({ statId: "energy_cost_multiplier", operation: "multiply", value: item.stats.energyCostMultiplier });
    }
    if (item.stats.defense !== undefined) {
      modifiers.push({ statId: "physical_resist", operation: "add", value: item.stats.defense });
    }
    return {
      instanceId: instance.instanceId,
      name: instance.nameOverride ?? item.name,
      description: item.description,
      additionalEffectsText: item.additionalEffectsText,
      image: instance.imageOverride ?? item.image,
      slot: item.slot,
      quality: instance.quality,
      itemLevel: instance.itemLevel,
      modifiers,
      attackTags: item.stats.attackTags,
      sourceType: instance.sourceType,
      legacyItemId: item.id,
    };
  }

  if (instance.baseId) {
    const itemBase = bundle.itemBases.find((entry) => entry.id === instance.baseId);
    if (!itemBase) return null;

    let modifiers: ModifierPayloadDef[] = [
      ...itemBase.baseModifiers,
      ...resolveRolledAffixModifiers(instance, bundle),
    ];
    if (instance.implicitUnlocked && itemBase.implicit) {
      modifiers = [...modifiers, ...itemBase.implicit.modifiers];
    }

    if (instance.uniqueItemId) {
      const uniqueItem = bundle.uniqueItems.find((entry) => entry.id === instance.uniqueItemId);
      if (uniqueItem) {
        modifiers = [...modifiers, ...uniqueItem.modifiers];
      }
    }

    return {
      instanceId: instance.instanceId,
      name: instance.nameOverride ?? (
        instance.uniqueItemId
          ? bundle.uniqueItems.find((entry) => entry.id === instance.uniqueItemId)?.name ?? itemBase.name
          : itemBase.name
      ),
      description:
        (instance.uniqueItemId
          ? bundle.uniqueItems.find((entry) => entry.id === instance.uniqueItemId)?.description
          : undefined) ?? itemBase.description,
      additionalEffectsText:
        (instance.uniqueItemId
          ? bundle.uniqueItems.find((entry) => entry.id === instance.uniqueItemId)?.additionalEffectsText
          : undefined) ?? itemBase.additionalEffectsText,
      image:
        instance.imageOverride ??
        (instance.uniqueItemId
          ? bundle.uniqueItems.find((entry) => entry.id === instance.uniqueItemId)?.image
          : undefined) ??
        itemBase.image,
      slot: itemBase.slot,
      quality: instance.quality,
      itemLevel: instance.itemLevel,
      requirements:
        (instance.uniqueItemId
          ? bundle.uniqueItems.find((entry) => entry.id === instance.uniqueItemId)?.requirementsOverride
          : undefined) ?? itemBase.requirements,
      modifiers,
      sourceType: instance.sourceType,
      baseId: itemBase.id,
      uniqueItemId: instance.uniqueItemId,
      setItemId: instance.setItemId,
    };
  }

  return null;
}

/**
 * Convert ComboDefs into runtime ComboRules.
 */
export function comboDefsToRules(defs: ComboDef[]): ComboRule[] {
  return defs.map((d) => ({
    from: d.fromSkillId,
    to: d.toSkillId,
    tag: d.activityTag,
    windowMs: d.windowMs,
    timeMultiplier: d.timeMultiplier,
    energyMultiplier: d.energyMultiplier,
    label: d.label,
  }));
}

/**
 * Roll loot drops from an interactable's loot table.
 */
export function rollLootDrops(
  bundle: GameContentBundle,
  interactable: InteractableDef,
  rng: () => number,
  ctx?: EvalContext
): WorldObjectDrop[] {
  const drops: WorldObjectDrop[] = [];
  const itemDefMap = new Map(bundle.items.map((item) => [item.id, item]));

  for (const entry of interactable.lootTable) {
    // Check condition if present
    if (entry.condition && ctx) {
      if (!evaluateCondition(entry.condition, ctx)) continue;
    }

    // Roll drop chance (0-100)
    if (rng() * 100 > entry.dropChance) continue;

    // Roll quantity
    const qty =
      entry.quantityMin === entry.quantityMax
        ? entry.quantityMin
        : entry.quantityMin +
          Math.floor(rng() * (entry.quantityMax - entry.quantityMin + 1));

    if (qty <= 0) continue;

    if ((entry.dropType ?? "item") === "item_base") {
      const equipmentDrop = createWorldDropFromBaseEntry(entry, bundle, qty, rng);
      if (equipmentDrop) {
        drops.push(equipmentDrop);
      }
      continue;
    }

    const itemDef = entry.itemId ? itemDefMap.get(entry.itemId) : undefined;
    if (!itemDef) continue;
    drops.push(createWorldDropFromItemDef(itemDef, qty));
  }

  return drops;
}

/**
 * Spawn world objects from a room's spawn table using interactable defs.
 */
export function generateObjectsFromRoom(
  bundle: GameContentBundle,
  roomId: string,
  spawnTable: {
    id: string;
    interactableId: string;
    spawnChance: number;
    minCount: number;
    maxCount: number;
    neverRespawnAfterDefeat?: boolean;
    condition?: string;
  }[],
  interactableDefs: InteractableDef[],
  seed: number,
  rng: () => number,
  ctx?: EvalContext,
  now?: number
): WorldObject[] {
  const objects: WorldObject[] = [];
  const interMap = new Map(interactableDefs.map((d) => [d.id, d]));

  for (const entry of spawnTable) {
    if (entry.neverRespawnAfterDefeat && ctx?.flag(`spawn_defeated:${roomId}:${entry.id}`)) {
      continue;
    }

    // Check condition
    if (entry.condition && ctx) {
      if (!evaluateCondition(entry.condition, ctx)) continue;
    }

    // Roll spawn chance
    if (rng() * 100 > entry.spawnChance) continue;

    const def = interMap.get(entry.interactableId);
    if (!def) continue;

    // Check interactable's own spawn condition
    if (def.spawnCondition && ctx) {
      if (!evaluateCondition(def.spawnCondition, ctx)) continue;
    }

    // Roll count
    const count =
      entry.minCount === entry.maxCount
        ? entry.minCount
        : entry.minCount +
          Math.floor(rng() * (entry.maxCount - entry.minCount + 1));

    for (let i = 0; i < count; i++) {
      const integrity =
        def.effectiveHealth.min === def.effectiveHealth.max
          ? def.effectiveHealth.min
          : def.effectiveHealth.min +
            Math.floor(
              rng() *
                (def.effectiveHealth.max - def.effectiveHealth.min + 1)
            );

      const initialAbilityReadyAt = getInitialAbilityReadyAt(def, now);
      objects.push({
        id: `${def.id}_${seed}_${objects.length}`,
        name: def.name,
        tag: def.activityTag,
        sourceRoomId: roomId,
        sourceSpawnEntryId: entry.id,
        neverRespawnAfterDefeat: entry.neverRespawnAfterDefeat === true,
        abilityBehaviorMode: def.abilityBehaviorMode ?? "priority",
        allowedAbilityTags: def.allowedAbilityTags ?? [],
        requiredLevel: def.requiredLevel,
        maxIntegrity: integrity,
        integrity,
        barColor: def.barColor,
        accentColor: def.accentColor,
        meterLabel: def.meterLabel,
        drops: rollLootDrops(bundle, def, rng, ctx),
        interactableId: def.id,
        xpRewards: def.xpRewards,
        formRules: def.formRules ?? [],
        image: def.image,
        imagePositionX: def.imagePositionX,
        imagePositionY: def.imagePositionY,
        dialogueId: def.npc?.dialogueId,
        dialogueRoutes: def.npc?.dialogues?.map((route) => ({
          dialogueId: route.dialogueId,
          condition: route.condition,
        })),
        portraitImage: def.npc?.portraitImage,
        abilities: (def.abilities ?? []).map((ability) => resolveWorldObjectAbility(ability, bundle)),
        abilityCooldowns: (def.abilities ?? []).map(() => initialAbilityReadyAt),
        initialAbilityDelayMs: def.initialAbilityDelayMs,
        nextAbilityIndex: 0,
        activeEffects: [],
      });
    }
  }

  return objects;
}

/**
 * Resolve item names from defs (since loot rolls only have IDs).
 */
/**
 * Check unlock conditions for all locked skills and return IDs of newly unlockable skills.
 */
export function checkSkillUnlocks(
  skills: SkillState[],
  ctx: EvalContext
): string[] {
  const newlyUnlocked: string[] = [];
  for (const skill of skills) {
    if (skill.unlocked) continue;
    if (!skill.unlockCondition) continue;
    if (evaluateCondition(skill.unlockCondition, ctx)) {
      newlyUnlocked.push(skill.id);
    }
  }
  return newlyUnlocked;
}

/**
 * Build the starting inventory split from the world configuration.
 * Static items stay in stackables. Equippables become fixed equipment instances.
 */
export function buildStartingInventory(bundle: GameContentBundle): StartingInventoryBundle {
  const startingItems = (bundle.world?.startingItemIds ?? [])
    .map((id) => bundle.items.find((item) => item.id === id))
    .filter((item): item is ItemDef => Boolean(item));

  const stackables = startingItems
    .filter((item) => !item.slot)
    .map((item) => itemDefToInventory(item, 1));

  const legacyEquipmentItems = startingItems
    .filter((item) => Boolean(item.slot))
    .map((item) => createLegacyEquipmentInstance(item));

  const configuredBases = bundle.world?.startingEquipmentBaseIds ?? [];
  const starterBaseIds = configuredBases.length > 0
    ? configuredBases
    : (bundle.itemBases.some((entry) => entry.id === "starter_dagger") ? ["starter_dagger"] : []);

  const equipmentItems = [
    ...legacyEquipmentItems,
    ...starterBaseIds
    .map((id) => bundle.itemBases.find((itemBase) => itemBase.id === id))
    .filter((itemBase): itemBase is ItemBaseDef => Boolean(itemBase))
    .map((itemBase) => createBaseEquipmentInstance(itemBase, "common", 1)),
  ];

  return { stackables, equipmentItems };
}

/**
 * Filter recipes that are currently craftable:
 * - unlockCondition passes (or is empty)
 * - player has enough of each ingredient
 * - stationTag matches the active station (or recipe has no station requirement)
 */
export function getAvailableRecipes(
  recipes: RecipeDef[],
  inventory: InventoryItem[],
  ctx: EvalContext,
  activeStationTag?: string
): RecipeDef[] {
  return recipes.filter((recipe) => {
    // Station check
    if (recipe.stationTag && recipe.stationTag !== activeStationTag) return false;
    // Unlock condition
    if (recipe.unlockCondition && !evaluateCondition(recipe.unlockCondition, ctx)) return false;
    // Ingredient check
    for (const ing of recipe.ingredients) {
      const held = inventory.find((i) => i.id === ing.itemId)?.qty ?? 0;
      if (held < ing.qty) return false;
    }
    return true;
  });
}

/**
 * Filter recipes visible to the player (unlock condition passes, regardless of ingredients).
 * Used to show greyed-out recipes the player knows about but can't craft yet.
 */
export function getKnownRecipes(
  recipes: RecipeDef[],
  ctx: EvalContext,
  activeStationTag?: string
): RecipeDef[] {
  return recipes.filter((recipe) => {
    if (recipe.stationTag && recipe.stationTag !== activeStationTag) return false;
    if (recipe.unlockCondition && !evaluateCondition(recipe.unlockCondition, ctx)) return false;
    return true;
  });
}
