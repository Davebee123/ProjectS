/**
 * Bridge module: converts editor JSON bundle types into the game's runtime types.
 * This keeps App.tsx clean — it just calls bridge functions.
 */
import type {
  GameContentBundle,
  SkillDef,
  ItemDef,
  ComboDef,
  InteractableDef,
  RecipeDef,
} from "./loader";
import { evaluateCondition, type EvalContext } from "./evaluator";

// ── Game runtime types (must match App.tsx) ──

export interface SkillState {
  id: string;
  name: string;
  kind: "passive" | "active";
  unlocked: boolean;
  tags: string[];
  abilityTags: string[];
  linkedPassiveId?: string;
  level: number;
  xp: number;
  xpToNext: number;
  baseDurationMs: number;
  baseEnergyCost: number;
  basePower: number;
  powerPerLevel: number;
  barColor: string;
  accentColor: string;
  description: string;
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
  defense?: number;
  energyRegen?: number;
  speedMultiplier?: number;
  energyCostMultiplier?: number;
}

export interface WorldObject {
  id: string;
  name: string;
  tag: string;
  allowedAbilityTags: string[];
  requiredLevel: number;
  maxIntegrity: number;
  integrity: number;
  barColor: string;
  accentColor: string;
  meterLabel: string;
  drops: InventoryItem[];
  interactableId: string;
  xpRewards: { skillId: string; amount: number }[];
  image?: string;
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
    tags: d.activityTags,
    abilityTags: d.abilityTags,
    linkedPassiveId: d.linkedPassiveId,
    level: 1,
    xp: 0,
    xpToNext: d.baseXpToNext,
    baseDurationMs: d.baseDurationMs,
    baseEnergyCost: d.baseEnergyCost,
    basePower: d.basePower,
    powerPerLevel: d.powerPerLevel,
    barColor: d.barColor,
    accentColor: d.accentColor,
    description: d.description,
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
    speedMultiplier: def.stats.speedMultiplier,
    energyCostMultiplier: def.stats.energyCostMultiplier,
  };
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
  interactable: InteractableDef,
  rng: () => number,
  ctx?: EvalContext
): InventoryItem[] {
  const drops: InventoryItem[] = [];

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

    drops.push({
      id: entry.itemId,
      name: entry.itemId, // will be resolved by the game
      qty,
    });
  }

  return drops;
}

/**
 * Spawn world objects from a room's spawn table using interactable defs.
 */
export function generateObjectsFromRoom(
  spawnTable: { interactableId: string; spawnChance: number; minCount: number; maxCount: number; condition?: string }[],
  interactableDefs: InteractableDef[],
  seed: number,
  rng: () => number,
  ctx?: EvalContext
): WorldObject[] {
  const objects: WorldObject[] = [];
  const interMap = new Map(interactableDefs.map((d) => [d.id, d]));

  for (const entry of spawnTable) {
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

      objects.push({
        id: `${def.id}_${seed}_${objects.length}`,
        name: def.name,
        tag: def.activityTag,
        allowedAbilityTags: def.allowedAbilityTags ?? [],
        requiredLevel: def.requiredLevel,
        maxIntegrity: integrity,
        integrity,
        barColor: def.barColor,
        accentColor: def.accentColor,
        meterLabel: def.meterLabel,
        drops: rollLootDrops(def, rng, ctx),
        interactableId: def.id,
        xpRewards: def.xpRewards,
        image: def.image,
      });
    }
  }

  return objects;
}

/**
 * Resolve item names from defs (since loot rolls only have IDs).
 */
export function resolveItemNames(
  drops: InventoryItem[],
  itemDefs: ItemDef[]
): InventoryItem[] {
  const defMap = new Map(itemDefs.map((d) => [d.id, d]));
  return drops.map((drop) => {
    const def = defMap.get(drop.id);
    if (def) {
      return {
        ...drop,
        name: def.name,
        slot: def.slot,
        attack: def.stats.attack,
        defense: def.stats.defense,
        energyRegen: def.stats.energyRegen,
        activityPowerMultiplier: def.stats.activityPowerMultiplier,
        speedMultiplier: def.stats.speedMultiplier,
        energyCostMultiplier: def.stats.energyCostMultiplier,
      };
    }
    return drop;
  });
}

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
 * Build the starting inventory from the world's startingItemIds.
 * Falls back to equippable items if no explicit starting items defined.
 */
export function buildStartingInventory(bundle: GameContentBundle): InventoryItem[] {
  const startingIds = bundle.world?.startingItemIds;
  if (startingIds && startingIds.length > 0) {
    // Use explicit starting items
    return startingIds
      .map((id) => bundle.items.find((item) => item.id === id))
      .filter((item): item is ItemDef => Boolean(item))
      .map((item) => itemDefToInventory(item, 1));
  }
  // Fallback: return equippable items as starting inventory
  return bundle.items
    .filter((item) => item.slot)
    .map((item) => itemDefToInventory(item, 1));
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
