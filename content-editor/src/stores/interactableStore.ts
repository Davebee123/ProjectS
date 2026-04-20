import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { InteractableTemplate } from "../schema/types";
import { normalizeInteractableTemplate } from "../utils/interactables";

interface InteractableState {
  interactables: InteractableTemplate[];
  addInteractable: (t: InteractableTemplate) => void;
  updateInteractable: (id: string, patch: Partial<InteractableTemplate>) => void;
  removeInteractable: (id: string) => void;
  loadInteractables: (ts: InteractableTemplate[]) => void;
}

export type InteractableTemplatePreset =
  | "blank"
  | "enemy"
  | "friendly"
  | "npc"
  | "gathering_node";

export function createDefaultInteractable(id: string, name: string): InteractableTemplate {
  return {
    id,
    name,
    description: "",
    activityTag: "",
    abilityBehaviorMode: "priority",
    initialAbilityDelayMs: 3000,
    allowedAbilityTags: [],
    requiredLevel: 0,
    effectiveHealth: { min: 50, max: 100 },
    barColor: "#5a8a5e",
    accentColor: "#7aaa7e",
    meterLabel: "HP",
    lootTable: [],
    xpRewards: [],
    formRules: [],
    abilities: [],
    onInteractEffects: [],
    onDestroyEffects: [],
    imagePositionX: 50,
    imagePositionY: 50,
  };
}

export function createInteractableFromTemplate(
  id: string,
  name: string,
  preset: InteractableTemplatePreset
): InteractableTemplate {
  const base = createDefaultInteractable(id, name);

  switch (preset) {
    case "enemy":
      return {
        ...base,
        folder: "enemies",
        description: "A hostile creature.",
        activityTag: "enemy",
        requiredLevel: 1,
        effectiveHealth: { min: 30, max: 30 },
        barColor: "#A72727",
        accentColor: "#A72727",
        meterLabel: "HP",
      };
    case "npc":
      return {
        ...base,
        folder: "npcs",
        description: "A character who can be spoken to.",
        activityTag: "npc",
        effectiveHealth: { min: 100, max: 100 },
        barColor: "#7a7a7a",
        accentColor: "#d7d14a",
        meterLabel: "Favor",
        npc: {
          dialogues: [],
        },
      };
    case "friendly":
      return {
        ...base,
        folder: "companions",
        description: "An allied combat companion.",
        activityTag: "friendly",
        requiredLevel: 1,
        effectiveHealth: { min: 60, max: 60 },
        barColor: "#3f627f",
        accentColor: "#6e9fc8",
        meterLabel: "HP",
      };
    case "gathering_node":
      return {
        ...base,
        folder: "nodes",
        description: "A harvestable world object.",
        activityTag: "tree",
        allowedAbilityTags: ["chop"],
        requiredLevel: 1,
        effectiveHealth: { min: 80, max: 120 },
        barColor: "#524436",
        accentColor: "#796652",
        meterLabel: "Resources",
      };
    case "blank":
    default:
      return base;
  }
}

const SEED_INTERACTABLES = ([
  {
    id: "oak_tree",
    name: "Oak Tree",
    folder: "trees",
    description: "A sturdy oak. Yields logs and sap when felled.",
    activityTag: "tree",
    abilityBehaviorMode: "priority",
    allowedAbilityTags: ["chop"],
    requiredLevel: 1,
    effectiveHealth: { min: 92, max: 132 },
    barColor: "#524436",
    accentColor: "#796652",
    meterLabel: "Logs",
    lootTable: [
      { id: "lt_oak_log", itemId: "log", quantityMin: 8, quantityMax: 16, dropChance: 100, weight: 1 },
      { id: "lt_oak_sap", itemId: "sap", quantityMin: 1, quantityMax: 3, dropChance: 100, weight: 1 },
      { id: "lt_oak_amber", itemId: "amber_band", quantityMin: 1, quantityMax: 1, dropChance: 15, weight: 1 },
      {
        id: "lt_oak_weathered_dagger",
        dropType: "item_base",
        itemBaseId: "weathered_dagger",
        itemLevelMin: 11,
        itemLevelMax: 20,
        quantityMin: 1,
        quantityMax: 1,
        dropChance: 10,
        weight: 1,
      },
    ],
    xpRewards: [],
    abilities: [],
    onInteractEffects: [],
    onDestroyEffects: [],
    image: "/oak-tree.png",
  },
  {
    id: "birch_tree",
    name: "Birch Tree",
    folder: "trees",
    description: "A tall birch. Harder to fell than oak.",
    activityTag: "tree",
    abilityBehaviorMode: "priority",
    allowedAbilityTags: ["chop"],
    requiredLevel: 5,
    effectiveHealth: { min: 130, max: 176 },
    barColor: "#5a4d3f",
    accentColor: "#8c7459",
    meterLabel: "Logs",
    lootTable: [
      { id: "lt_birch_log", itemId: "log", quantityMin: 8, quantityMax: 16, dropChance: 100, weight: 1 },
      { id: "lt_birch_sap", itemId: "sap", quantityMin: 1, quantityMax: 3, dropChance: 100, weight: 1 },
      { id: "lt_birch_amber", itemId: "amber_band", quantityMin: 1, quantityMax: 1, dropChance: 15, weight: 1 },
    ],
    xpRewards: [],
    abilities: [],
    onInteractEffects: [],
    onDestroyEffects: [],
  },
  {
    id: "dirty_frank",
    name: "Dirty Frank",
    folder: "npcs",
    description: "A grizzled drifter warming himself by the fire.",
    activityTag: "npc",
    abilityBehaviorMode: "priority",
    allowedAbilityTags: [],
    requiredLevel: 1,
    effectiveHealth: { min: 250, max: 250 },
    barColor: "#7a7a7a",
    accentColor: "#d7d14a",
    meterLabel: "Favor",
    lootTable: [],
    xpRewards: [],
    abilities: [],
    onInteractEffects: [],
    onDestroyEffects: [],
    npc: {
      dialogueId: "dirty_frank_intro",
    },
  },
  {
    id: "desperate_rat",
    name: "Desperate Rat",
    folder: "enemies",
    description: "A starving rat with nothing left to lose.",
    activityTag: "enemy",
    abilityBehaviorMode: "priority",
    allowedAbilityTags: [],
    requiredLevel: 1,
    effectiveHealth: { min: 34, max: 34 },
    barColor: "#A72727",
    accentColor: "#A72727",
    meterLabel: "HP",
    lootTable: [],
    xpRewards: [],
    abilities: [
      {
        skillId: "rat_swipe",
        cooldownMs: 4200,
        targetMode: "friendly_or_player",
        damage: 4,
        resistChancePerLevel: 0,
      },
    ],
    onInteractEffects: [],
    onDestroyEffects: [],
    image: "/desperate-rat.png",
  },
  {
    id: "loyal_sprite",
    name: "Loyal Sprite",
    folder: "companions",
    description: "A dim forest sprite that lashes out at nearby threats.",
    activityTag: "friendly",
    abilityBehaviorMode: "priority",
    allowedAbilityTags: [],
    requiredLevel: 1,
    effectiveHealth: { min: 28, max: 28 },
    barColor: "#4F6D8A",
    accentColor: "#82B2D8",
    meterLabel: "HP",
    lootTable: [],
    xpRewards: [],
    abilities: [
      {
        skillId: "companion_strike",
        cooldownMs: 3500,
        damage: 3,
        resistChancePerLevel: 0,
      },
    ],
    onInteractEffects: [],
    onDestroyEffects: [],
  },
] satisfies InteractableTemplate[]).map((template) => normalizeInteractableTemplate(template));

export const useInteractableStore = create<InteractableState>()(
  persist(
    (set) => ({
      interactables: SEED_INTERACTABLES,

      addInteractable: (t) =>
        set((s) => ({ interactables: [...s.interactables, normalizeInteractableTemplate(t)] })),

      updateInteractable: (id, patch) =>
        set((s) => ({
          interactables: s.interactables.map((t) =>
            t.id === id ? normalizeInteractableTemplate({ ...t, ...patch }) : t
          ),
        })),

      removeInteractable: (id) =>
        set((s) => ({ interactables: s.interactables.filter((t) => t.id !== id) })),

      loadInteractables: (ts) => set({ interactables: ts.map(normalizeInteractableTemplate) }),
    }),
    {
      name: "editor-interactables",
      partialize: (state) => ({ interactables: state.interactables }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<InteractableState> | undefined;
        return {
          ...currentState,
          ...persisted,
          interactables: Array.isArray(persisted?.interactables)
            ? persisted.interactables.map(normalizeInteractableTemplate)
            : currentState.interactables,
        };
      },
    }
  )
);
