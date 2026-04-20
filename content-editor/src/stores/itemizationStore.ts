import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AffixDefinition,
  AffixTableDef,
  ItemBase,
  ItemClassDef,
  ItemQualityRuleBand,
  ItemQualityRuleSet,
  ItemSetDefinition,
  ModifierStatDef,
  UniqueItem,
} from "../schema/types";

interface ItemizationState {
  itemClasses: ItemClassDef[];
  affixTables: AffixTableDef[];
  modifierStats: ModifierStatDef[];
  itemBases: ItemBase[];
  affixes: AffixDefinition[];
  itemQualityRules: ItemQualityRuleSet[];
  uniqueItems: UniqueItem[];
  itemSets: ItemSetDefinition[];
  addItemClass: (itemClass: ItemClassDef) => void;
  updateItemClass: (id: string, patch: Partial<ItemClassDef>) => void;
  removeItemClass: (id: string) => void;
  addAffixTable: (table: AffixTableDef) => void;
  updateAffixTable: (id: string, patch: Partial<AffixTableDef>) => void;
  removeAffixTable: (id: string) => void;
  addModifierStat: (stat: ModifierStatDef) => void;
  updateModifierStat: (id: string, patch: Partial<ModifierStatDef>) => void;
  removeModifierStat: (id: string) => void;
  addItemBase: (itemBase: ItemBase) => void;
  updateItemBase: (id: string, patch: Partial<ItemBase>) => void;
  removeItemBase: (id: string) => void;
  addAffix: (affix: AffixDefinition) => void;
  updateAffix: (id: string, patch: Partial<AffixDefinition>) => void;
  removeAffix: (id: string) => void;
  addItemQualityRule: (rule: ItemQualityRuleSet) => void;
  updateItemQualityRule: (id: string, patch: Partial<ItemQualityRuleSet>) => void;
  removeItemQualityRule: (id: string) => void;
  addUniqueItem: (item: UniqueItem) => void;
  updateUniqueItem: (id: string, patch: Partial<UniqueItem>) => void;
  removeUniqueItem: (id: string) => void;
  addItemSet: (itemSet: ItemSetDefinition) => void;
  updateItemSet: (id: string, patch: Partial<ItemSetDefinition>) => void;
  removeItemSet: (id: string) => void;
  loadItemization: (payload: Pick<
    ItemizationState,
    | "itemClasses"
    | "affixTables"
    | "modifierStats"
    | "itemBases"
    | "affixes"
    | "itemQualityRules"
    | "uniqueItems"
    | "itemSets"
  >) => void;
}

const DEFAULT_QUALITY_RULE_BANDS: ItemQualityRuleBand[] = [
  {
    itemLevelMin: 1,
    itemLevelMax: 10,
    qualityWeights: { common: 75, uncommon: 25, rare: 0 },
  },
  {
    itemLevelMin: 11,
    itemLevelMax: 20,
    qualityWeights: { common: 66, uncommon: 29, rare: 5 },
    rareAffixCountWeights: { 2: 100 },
  },
  {
    itemLevelMin: 21,
    itemLevelMax: 30,
    qualityWeights: { common: 63, uncommon: 30, rare: 7 },
    rareAffixCountWeights: { 2: 88, 3: 12 },
  },
  {
    itemLevelMin: 31,
    itemLevelMax: 40,
    qualityWeights: { common: 60, uncommon: 31, rare: 9 },
    rareAffixCountWeights: { 3: 78, 4: 18, 5: 4 },
  },
  {
    itemLevelMin: 41,
    itemLevelMax: 50,
    qualityWeights: { common: 57, uncommon: 31, rare: 12 },
    rareAffixCountWeights: { 3: 28, 4: 62, 5: 10 },
  },
];

export function createDefaultItemClass(id: string, label: string): ItemClassDef {
  return {
    id,
    label,
    slot: "mainHand",
    handedness: "one_hand",
    tags: [],
  };
}

export function createDefaultAffixTable(id: string, label: string): AffixTableDef {
  return {
    id,
    label,
    description: "",
  };
}

export function createDefaultModifierStat(id: string, label: string): ModifierStatDef {
  return {
    id,
    label,
    category: "utility",
    supportsScope: false,
    supportedOperations: ["add"],
  };
}

export function createDefaultItemBase(id: string, name: string): ItemBase {
  return {
    id,
    name,
    description: "",
    slot: "mainHand",
    inventoryCategory: "weapons",
    itemClassId: "dagger",
    requirements: {
      playerLevel: 1,
      skills: [],
    },
    baseModifiers: [],
    affixTableIds: [],
    tags: [],
  };
}

export function createDefaultAffix(id: string, nameTemplate: string): AffixDefinition {
  return {
    id,
    kind: "prefix",
    nameTemplate,
    description: "",
    tableId: "global_equipment",
    weight: 100,
    tiers: [
      {
        tier: 1,
        itemLevelMin: 1,
        itemLevelMax: 10,
        rollMin: 1,
        rollMax: 3,
      },
    ],
    modifiers: [
      {
        statId: "health",
        operation: "add",
        valueSource: "rolled_value",
      },
    ],
  };
}

export function createDefaultItemQualityRule(id: string, label: string): ItemQualityRuleSet {
  return {
    id,
    label,
    bands: structuredClone(DEFAULT_QUALITY_RULE_BANDS),
  };
}

export function createDefaultUniqueItem(id: string, name: string): UniqueItem {
  return {
    id,
    name,
    description: "",
    baseId: "starter_dagger",
    modifiers: [],
    tags: [],
  };
}

export function createDefaultItemSet(id: string, name: string): ItemSetDefinition {
  return {
    id,
    name,
    description: "",
    itemIds: [],
    bonuses: [
      {
        piecesRequired: 2,
        modifiers: [],
      },
    ],
  };
}

const SEED_ITEM_CLASSES: ItemClassDef[] = [
  { id: "one_handed_sword", label: "One-Handed Sword", slot: "mainHand", handedness: "one_hand", tags: ["weapon", "melee", "blade"] },
  { id: "dagger", label: "Dagger", slot: "mainHand", handedness: "one_hand", tags: ["weapon", "melee", "blade"] },
  { id: "mace", label: "Mace", slot: "mainHand", handedness: "one_hand", tags: ["weapon", "melee", "blunt"] },
  { id: "two_handed_maul", label: "Two-Handed Maul", slot: "mainHand", handedness: "two_hand", tags: ["weapon", "melee", "blunt", "heavy"] },
  { id: "two_handed_rifle", label: "Two-Handed Rifle", slot: "mainHand", handedness: "two_hand", tags: ["weapon", "ranged", "rifle"] },
  { id: "staff", label: "Staff", slot: "mainHand", handedness: "two_hand", tags: ["weapon", "casting"] },
  { id: "focus", label: "Focus", slot: "offHand", handedness: "one_hand", tags: ["offhand", "casting"] },
  { id: "shield", label: "Shield", slot: "offHand", handedness: "one_hand", tags: ["offhand", "defense"] },
  { id: "light_armor", label: "Light Armor", slot: "chest", tags: ["armor", "light"] },
  { id: "heavy_armor", label: "Heavy Armor", slot: "chest", tags: ["armor", "heavy"] },
  { id: "cloak", label: "Cloak", slot: "back", tags: ["armor", "back"] },
  { id: "fey_rune", label: "Fey Rune", slot: "rune", tags: ["rune"] },
];

const SEED_AFFIX_TABLES: AffixTableDef[] = [
  { id: "global_equipment", label: "Global Equipment", description: "Shared affix pool for all equippable gear." },
  { id: "weapon_general", label: "Weapon General", description: "General weapon affixes for all weapon bases." },
  { id: "weapon_melee", label: "Weapon Melee", description: "Affixes shared by melee weapons." },
  { id: "weapon_ranged", label: "Weapon Ranged", description: "Affixes shared by ranged weapons." },
  { id: "weapon_casting", label: "Weapon Casting", description: "Affixes for casting-focused weapons." },
  { id: "weapon_blade", label: "Weapon Blade", description: "Affixes for blades such as swords and daggers." },
  { id: "weapon_blunt", label: "Weapon Blunt", description: "Affixes for maces and mauls." },
  { id: "weapon_rifle", label: "Weapon Rifle", description: "Affixes specific to rifles." },
  { id: "armor_general", label: "Armor General", description: "Affixes shared by armor pieces." },
  { id: "armor_defense", label: "Armor Defense", description: "Defensive affixes for armor." },
  { id: "armor_resistance", label: "Armor Resistance", description: "Resistance affixes for armor and shields." },
  { id: "offhand_general", label: "Offhand General", description: "Affixes for focuses and shields." },
  { id: "fey_rune_general", label: "Fey Rune General", description: "Affixes for fey rune equipment." },
];

const SEED_MODIFIER_STATS: ModifierStatDef[] = [
  { id: "health", label: "Health", category: "resource", supportsScope: false, supportedOperations: ["add", "multiply"] },
  { id: "mana", label: "Mana", category: "resource", supportsScope: false, supportedOperations: ["add", "multiply"] },
  { id: "energy", label: "Energy", category: "resource", supportsScope: false, supportedOperations: ["add", "multiply"] },
  { id: "health_regen", label: "Health Regen", category: "regen", supportsScope: false, supportedOperations: ["add", "multiply"] },
  { id: "mana_regen", label: "Mana Regen", category: "regen", supportsScope: false, supportedOperations: ["add", "multiply"] },
  { id: "energy_regen", label: "Energy Regen", category: "regen", supportsScope: false, supportedOperations: ["add", "multiply"] },
  { id: "backpack_slots", label: "Backpack Slots", category: "utility", supportsScope: false, supportedOperations: ["add"] },
  { id: "physical_resist", label: "Physical Resist", category: "resistance", supportsScope: false, supportedOperations: ["add", "multiply"] },
  { id: "string_resist", label: "String Resist", category: "resistance", supportsScope: false, supportedOperations: ["add", "multiply"] },
  { id: "entropy_resist", label: "Entropy Resist", category: "resistance", supportsScope: false, supportedOperations: ["add", "multiply"] },
  { id: "genesis_resist", label: "Genesis Resist", category: "resistance", supportsScope: false, supportedOperations: ["add", "multiply"] },
  { id: "chaos_resist", label: "Chaos Resist", category: "resistance", supportsScope: false, supportedOperations: ["add", "multiply"] },
  { id: "all_damage_multiplier", label: "All Damage Multiplier", category: "damage", supportsScope: false, supportedOperations: ["multiply"] },
  { id: "flat_weapon_damage", label: "Flat Weapon Damage", category: "damage", supportsScope: false, supportedOperations: ["add"] },
  { id: "melee_damage_multiplier", label: "Melee Damage Multiplier", category: "damage", supportsScope: false, supportedOperations: ["multiply"] },
  { id: "ranged_damage_multiplier", label: "Ranged Damage Multiplier", category: "damage", supportsScope: false, supportedOperations: ["multiply"] },
  { id: "string_damage_multiplier", label: "String Damage Multiplier", category: "damage", supportsScope: true, supportedOperations: ["multiply"] },
  { id: "entropy_damage_multiplier", label: "Entropy Damage Multiplier", category: "damage", supportsScope: true, supportedOperations: ["multiply"] },
  { id: "genesis_damage_multiplier", label: "Genesis Damage Multiplier", category: "damage", supportsScope: true, supportedOperations: ["multiply"] },
  { id: "chaos_damage_multiplier", label: "Chaos Damage Multiplier", category: "damage", supportsScope: true, supportedOperations: ["multiply"] },
  { id: "cast_time_multiplier", label: "Cast Time Multiplier", category: "timing", supportsScope: true, supportedOperations: ["multiply"] },
  { id: "recharge_rate_multiplier", label: "Recharge Rate Multiplier", category: "timing", supportsScope: true, supportedOperations: ["multiply"] },
  { id: "energy_cost_multiplier", label: "Energy Cost Multiplier", category: "cost", supportsScope: true, supportedOperations: ["multiply"] },
  { id: "mana_cost_multiplier", label: "Mana Cost Multiplier", category: "cost", supportsScope: true, supportedOperations: ["multiply"] },
];

const SEED_ITEM_BASES: ItemBase[] = [
  {
    id: "starter_dagger",
    name: "Starter Dagger",
    description: "A basic dagger issued to new adventurers.",
    slot: "mainHand",
    inventoryCategory: "weapons",
    itemClassId: "dagger",
    requirements: {
      playerLevel: 1,
      skills: [],
    },
    baseModifiers: [
      {
        statId: "flat_weapon_damage",
        operation: "add",
        value: 2,
      },
    ],
    implicit: {
      id: "dagger_quick_edge",
      name: "Quick Edge",
      unlockItemLevel: 11,
      modifiers: [
        {
          statId: "cast_time_multiplier",
          operation: "multiply",
          value: 0.95,
        },
      ],
    },
    affixTableIds: ["global_equipment", "weapon_general", "weapon_melee", "weapon_blade"],
    tags: ["starter"],
  },
  {
    id: "entropy_preview_rifle",
    name: "Long Rifle Of Power",
    description: "A long rifle tuned for unstable entropy discharge.",
    additionalEffectsText: "When casting Entropy abilities, there is a chance that you heal 10 health.",
    folder: "weapons",
    slot: "mainHand",
    inventoryCategory: "weapons",
    itemClassId: "two_handed_rifle",
    requirements: {
      playerLevel: 1,
      skills: [],
    },
    baseModifiers: [
      {
        statId: "flat_weapon_damage",
        operation: "add",
        value: 8,
      },
      {
        statId: "entropy_resist",
        operation: "add",
        value: 10,
      },
      {
        statId: "entropy_damage_multiplier",
        operation: "multiply",
        value: 1.05,
      },
    ],
    implicit: {
      id: "entropy_preview_rifle_precision",
      name: "Entropy Precision",
      unlockItemLevel: 11,
      modifiers: [
        {
          statId: "cast_time_multiplier",
          operation: "multiply",
          value: 0.94,
        },
      ],
    },
    affixTableIds: ["global_equipment", "weapon_general", "weapon_ranged", "weapon_rifle"],
    tags: ["preview"],
  },
  {
    id: "weathered_dagger",
    name: "Weathered Dagger",
    description: "A worn blade scavenged from the wilds. Still sharp enough to matter.",
    folder: "weapons",
    slot: "mainHand",
    inventoryCategory: "weapons",
    itemClassId: "dagger",
    requirements: {
      playerLevel: 1,
      skills: [],
    },
    baseModifiers: [
      {
        statId: "flat_weapon_damage",
        operation: "add",
        value: 3,
      },
    ],
    implicit: {
      id: "weathered_dagger_quick_edge",
      name: "Quick Edge",
      unlockItemLevel: 11,
      modifiers: [
        {
          statId: "cast_time_multiplier",
          operation: "multiply",
          value: 0.95,
        },
      ],
    },
    affixTableIds: ["global_equipment", "weapon_general", "weapon_melee", "weapon_blade"],
    tags: ["drop_test"],
  },
];

const SEED_AFFIXES: AffixDefinition[] = [
  {
    id: "forceful",
    kind: "prefix",
    nameTemplate: "Forceful",
    description: "Adds flat weapon damage.",
    folder: "prefixes",
    tableId: "weapon_general",
    weight: 100,
    tiers: [
      { tier: 1, itemLevelMin: 1, itemLevelMax: 10, rollMin: 1, rollMax: 2 },
      { tier: 2, itemLevelMin: 11, itemLevelMax: 20, rollMin: 2, rollMax: 4 },
      { tier: 3, itemLevelMin: 21, itemLevelMax: 30, rollMin: 4, rollMax: 6 },
      { tier: 4, itemLevelMin: 31, itemLevelMax: 40, rollMin: 6, rollMax: 8 },
      { tier: 5, itemLevelMin: 41, itemLevelMax: 50, rollMin: 8, rollMax: 10 },
    ],
    modifiers: [
      {
        statId: "flat_weapon_damage",
        operation: "add",
        valueSource: "rolled_value",
      },
    ],
  },
  {
    id: "of_focus",
    kind: "suffix",
    nameTemplate: "of Focus",
    description: "Adds energy regeneration.",
    folder: "suffixes",
    tableId: "global_equipment",
    weight: 100,
    tiers: [
      { tier: 1, itemLevelMin: 1, itemLevelMax: 10, rollMin: 1, rollMax: 1 },
      { tier: 2, itemLevelMin: 11, itemLevelMax: 20, rollMin: 1, rollMax: 2 },
      { tier: 3, itemLevelMin: 21, itemLevelMax: 30, rollMin: 2, rollMax: 3 },
      { tier: 4, itemLevelMin: 31, itemLevelMax: 40, rollMin: 3, rollMax: 4 },
      { tier: 5, itemLevelMin: 41, itemLevelMax: 50, rollMin: 4, rollMax: 5 },
    ],
    modifiers: [
      {
        statId: "energy_regen",
        operation: "add",
        valueSource: "rolled_value",
      },
    ],
  },
];

const SEED_ITEM_QUALITY_RULES: ItemQualityRuleSet[] = [
  createDefaultItemQualityRule("default", "Default Equipment Quality Rules"),
];

export const useItemizationStore = create<ItemizationState>()(
  persist(
    (set) => ({
      itemClasses: SEED_ITEM_CLASSES,
      affixTables: SEED_AFFIX_TABLES,
      modifierStats: SEED_MODIFIER_STATS,
      itemBases: SEED_ITEM_BASES,
      affixes: SEED_AFFIXES,
      itemQualityRules: SEED_ITEM_QUALITY_RULES,
      uniqueItems: [],
      itemSets: [],
      addItemClass: (itemClass) => set((state) => ({ itemClasses: [...state.itemClasses, itemClass] })),
      updateItemClass: (id, patch) =>
        set((state) => ({
          itemClasses: state.itemClasses.map((itemClass) => (itemClass.id === id ? { ...itemClass, ...patch } : itemClass)),
        })),
      removeItemClass: (id) => set((state) => ({ itemClasses: state.itemClasses.filter((itemClass) => itemClass.id !== id) })),
      addAffixTable: (table) => set((state) => ({ affixTables: [...state.affixTables, table] })),
      updateAffixTable: (id, patch) =>
        set((state) => ({
          affixTables: state.affixTables.map((table) => (table.id === id ? { ...table, ...patch } : table)),
        })),
      removeAffixTable: (id) => set((state) => ({ affixTables: state.affixTables.filter((table) => table.id !== id) })),
      addModifierStat: (stat) => set((state) => ({ modifierStats: [...state.modifierStats, stat] })),
      updateModifierStat: (id, patch) =>
        set((state) => ({
          modifierStats: state.modifierStats.map((stat) => (stat.id === id ? { ...stat, ...patch } : stat)),
        })),
      removeModifierStat: (id) => set((state) => ({ modifierStats: state.modifierStats.filter((stat) => stat.id !== id) })),
      addItemBase: (itemBase) => set((state) => ({ itemBases: [...state.itemBases, itemBase] })),
      updateItemBase: (id, patch) =>
        set((state) => ({
          itemBases: state.itemBases.map((itemBase) => (itemBase.id === id ? { ...itemBase, ...patch } : itemBase)),
        })),
      removeItemBase: (id) => set((state) => ({ itemBases: state.itemBases.filter((itemBase) => itemBase.id !== id) })),
      addAffix: (affix) => set((state) => ({ affixes: [...state.affixes, affix] })),
      updateAffix: (id, patch) =>
        set((state) => ({
          affixes: state.affixes.map((affix) => (affix.id === id ? { ...affix, ...patch } : affix)),
        })),
      removeAffix: (id) => set((state) => ({ affixes: state.affixes.filter((affix) => affix.id !== id) })),
      addItemQualityRule: (rule) => set((state) => ({ itemQualityRules: [...state.itemQualityRules, rule] })),
      updateItemQualityRule: (id, patch) =>
        set((state) => ({
          itemQualityRules: state.itemQualityRules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)),
        })),
      removeItemQualityRule: (id) =>
        set((state) => ({ itemQualityRules: state.itemQualityRules.filter((rule) => rule.id !== id) })),
      addUniqueItem: (item) => set((state) => ({ uniqueItems: [...state.uniqueItems, item] })),
      updateUniqueItem: (id, patch) =>
        set((state) => ({
          uniqueItems: state.uniqueItems.map((item) => (item.id === id ? { ...item, ...patch } : item)),
        })),
      removeUniqueItem: (id) => set((state) => ({ uniqueItems: state.uniqueItems.filter((item) => item.id !== id) })),
      addItemSet: (itemSet) => set((state) => ({ itemSets: [...state.itemSets, itemSet] })),
      updateItemSet: (id, patch) =>
        set((state) => ({
          itemSets: state.itemSets.map((itemSet) => (itemSet.id === id ? { ...itemSet, ...patch } : itemSet)),
        })),
      removeItemSet: (id) => set((state) => ({ itemSets: state.itemSets.filter((itemSet) => itemSet.id !== id) })),
      loadItemization: (payload) =>
        set({
          itemClasses: payload.itemClasses,
          affixTables: payload.affixTables,
          modifierStats: payload.modifierStats,
          itemBases: payload.itemBases,
          affixes: payload.affixes,
          itemQualityRules: payload.itemQualityRules,
          uniqueItems: payload.uniqueItems,
          itemSets: payload.itemSets,
        }),
    }),
    {
      name: "editor-itemization",
      partialize: (state) => ({
        itemClasses: state.itemClasses,
        affixTables: state.affixTables,
        modifierStats: state.modifierStats,
        itemBases: state.itemBases,
        affixes: state.affixes,
        itemQualityRules: state.itemQualityRules,
        uniqueItems: state.uniqueItems,
        itemSets: state.itemSets,
      }),
    }
  )
);
