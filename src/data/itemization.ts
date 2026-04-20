import type {
  AffixDefinition,
  GameContentBundle,
  ItemBase,
  ItemQuality,
  ItemQualityRuleBand,
  ItemQualityRuleSet,
} from "../../shared/content/types";
import type { EquipmentItemInstance, RolledAffix } from "./bridge";

type AffixKind = AffixDefinition["kind"];

interface WeightedEntry<T> {
  value: T;
  weight: number;
}

export interface RandomItemRollRequest {
  bundle: GameContentBundle;
  baseId: string;
  itemLevel: number;
  qualityRuleSetId?: string;
  rng?: () => number;
}

export interface RandomItemRollResult {
  instance: EquipmentItemInstance;
  base: ItemBase;
  qualityRuleSet: ItemQualityRuleSet;
  band: ItemQualityRuleBand;
}

const DEFAULT_TIER_WEIGHTS: Record<number, number[]> = {
  1: [100],
  2: [65, 35],
  3: [50, 32, 18],
  4: [40, 30, 20, 10],
  5: [34, 27, 20, 12, 7],
};

function weightedPick<T>(entries: WeightedEntry<T>[], rng: () => number): T | null {
  const total = entries.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
  if (total <= 0) return null;
  let roll = rng() * total;
  for (const entry of entries) {
    roll -= Math.max(0, entry.weight);
    if (roll <= 0) {
      return entry.value;
    }
  }
  return entries[entries.length - 1]?.value ?? null;
}

function createBaseEquipmentInstance(
  itemBase: ItemBase,
  quality: ItemQuality,
  itemLevel: number,
  rng: () => number
): EquipmentItemInstance {
  return {
    instanceId: `${itemBase.id}_${Math.floor(rng() * 1_000_000_000).toString(36)}`,
    sourceType: "base",
    baseId: itemBase.id,
    quality,
    itemLevel,
    prefixes: [],
    suffixes: [],
    implicitUnlocked: Boolean(itemBase.implicit && itemLevel >= itemBase.implicit.unlockItemLevel),
  };
}

function getQualityRuleSet(bundle: GameContentBundle, qualityRuleSetId?: string): ItemQualityRuleSet {
  return (
    bundle.itemQualityRules.find((entry) => entry.id === qualityRuleSetId) ??
    bundle.itemQualityRules[0] ?? {
      id: "default",
      label: "Default",
      bands: [],
    }
  );
}

function getBand(ruleSet: ItemQualityRuleSet, itemLevel: number): ItemQualityRuleBand {
  const band = ruleSet.bands.find((entry) => itemLevel >= entry.itemLevelMin && itemLevel <= entry.itemLevelMax);
  if (!band) {
    throw new Error(`No item quality rule band covers item level ${itemLevel}.`);
  }
  return band;
}

function rollQuality(band: ItemQualityRuleBand, rng: () => number): ItemQuality {
  const quality = weightedPick<ItemQuality>(
    [
      { value: "common", weight: band.qualityWeights.common },
      { value: "uncommon", weight: band.qualityWeights.uncommon },
      { value: "rare", weight: band.qualityWeights.rare },
    ],
    rng
  );
  return quality ?? "common";
}

function rollRareAffixCount(band: ItemQualityRuleBand, rng: () => number): 2 | 3 | 4 | 5 {
  const weights = band.rareAffixCountWeights ?? { 2: 100 };
  const count = weightedPick<2 | 3 | 4 | 5>(
    ([2, 3, 4, 5] as const)
      .map((value) => ({
        value,
        weight: weights[value] ?? 0,
      }))
      .filter((entry) => entry.weight > 0),
    rng
  );
  return count ?? 2;
}

function getAffixTargets(quality: ItemQuality, band: ItemQualityRuleBand, rng: () => number): { prefixes: number; suffixes: number } {
  if (quality === "common") return { prefixes: 0, suffixes: 0 };
  if (quality === "uncommon") {
    return rng() < 0.5 ? { prefixes: 1, suffixes: 0 } : { prefixes: 0, suffixes: 1 };
  }

  const count = rollRareAffixCount(band, rng);
  if (count === 2) return { prefixes: 1, suffixes: 1 };
  if (count === 3) return rng() < 0.5 ? { prefixes: 2, suffixes: 1 } : { prefixes: 1, suffixes: 2 };
  if (count === 4) return { prefixes: 2, suffixes: 2 };
  return rng() < 0.5 ? { prefixes: 3, suffixes: 2 } : { prefixes: 2, suffixes: 3 };
}

function getTierWeight(affix: AffixDefinition, itemLevel: number, tierIndex: number, eligibleCount: number): number {
  const tier = affix.tiers
    .filter((entry) => itemLevel >= entry.itemLevelMin && itemLevel <= entry.itemLevelMax)
    .sort((a, b) => a.tier - b.tier)[tierIndex];
  if (!tier) return 0;
  if (tier.weight !== undefined) return tier.weight;
  return DEFAULT_TIER_WEIGHTS[eligibleCount]?.[tierIndex] ?? 0;
}

function rollAffixTier(affix: AffixDefinition, itemLevel: number, rng: () => number) {
  const eligibleTiers = affix.tiers
    .filter((entry) => itemLevel >= entry.itemLevelMin && itemLevel <= entry.itemLevelMax)
    .sort((a, b) => a.tier - b.tier);
  if (eligibleTiers.length === 0) return null;
  const tier = weightedPick(
    eligibleTiers.map((entry, index) => ({
      value: entry,
      weight: getTierWeight(affix, itemLevel, index, eligibleTiers.length),
    })),
    rng
  );
  return tier ?? eligibleTiers[0];
}

function rollValue(min: number, max: number, rng: () => number): number {
  if (max <= min) return min;
  const rolled = min + (max - min) * rng();
  return Number.isInteger(min) && Number.isInteger(max)
    ? Math.round(rolled)
    : Number(rolled.toFixed(2));
}

function buildCandidatePool(
  bundle: GameContentBundle,
  base: ItemBase,
  kind: AffixKind,
  itemLevel: number,
  taken: RolledAffix[]
): AffixDefinition[] {
  const takenIds = new Set(taken.map((entry) => entry.affixId));
  const takenGroups = new Set(
    taken
      .map((entry) => bundle.affixes.find((affix) => affix.id === entry.affixId)?.exclusiveGroup)
      .filter(Boolean)
  );

  return bundle.affixes.filter((affix) => {
    if (affix.kind !== kind) return false;
    if (!base.affixTableIds.includes(affix.tableId)) return false;
    if (affix.allowedSlots?.length && !affix.allowedSlots.includes(base.slot)) return false;
    if (affix.allowedItemClasses?.length && !affix.allowedItemClasses.includes(base.itemClassId)) return false;
    if (affix.requiredTags?.length && affix.requiredTags.some((tag) => !(base.tags ?? []).includes(tag))) return false;
    if (!affix.tiers.some((tier) => itemLevel >= tier.itemLevelMin && itemLevel <= tier.itemLevelMax)) return false;
    if (takenIds.has(affix.id)) return false;
    if (affix.exclusiveGroup && takenGroups.has(affix.exclusiveGroup)) return false;
    return true;
  });
}

function rollAffixesForKind(
  bundle: GameContentBundle,
  base: ItemBase,
  kind: AffixKind,
  count: number,
  itemLevel: number,
  rng: () => number,
  taken: RolledAffix[]
): RolledAffix[] {
  const rolled: RolledAffix[] = [];
  while (rolled.length < count) {
    const pool = buildCandidatePool(bundle, base, kind, itemLevel, [...taken, ...rolled]);
    if (pool.length === 0) break;
    const affix = weightedPick(
      pool.map((entry) => ({ value: entry, weight: entry.weight })),
      rng
    );
    if (!affix) break;
    const tier = rollAffixTier(affix, itemLevel, rng);
    if (!tier) break;
    rolled.push({
      affixId: affix.id,
      tier: tier.tier,
      rolledValue: rollValue(tier.rollMin, tier.rollMax, rng),
    });
  }
  return rolled;
}

export function rollEquipmentInstance(request: RandomItemRollRequest): RandomItemRollResult {
  const rng = request.rng ?? Math.random;
  const qualityRuleSet = getQualityRuleSet(request.bundle, request.qualityRuleSetId);
  const band = getBand(qualityRuleSet, request.itemLevel);
  const base = request.bundle.itemBases.find((entry) => entry.id === request.baseId);
  if (!base) {
    throw new Error(`Unknown item base "${request.baseId}".`);
  }

  const quality = rollQuality(band, rng);
  const targets = getAffixTargets(quality, band, rng);
  const prefixes = rollAffixesForKind(request.bundle, base, "prefix", targets.prefixes, request.itemLevel, rng, []);
  const suffixes = rollAffixesForKind(request.bundle, base, "suffix", targets.suffixes, request.itemLevel, rng, prefixes);

  const instance = {
    ...createBaseEquipmentInstance(base, quality, request.itemLevel, rng),
    prefixes,
    suffixes,
  };

  return {
    instance,
    base,
    qualityRuleSet,
    band,
  };
}
