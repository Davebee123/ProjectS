import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { InteractableTemplate } from "../schema/types";

interface InteractableState {
  interactables: InteractableTemplate[];
  addInteractable: (t: InteractableTemplate) => void;
  updateInteractable: (id: string, patch: Partial<InteractableTemplate>) => void;
  removeInteractable: (id: string) => void;
  loadInteractables: (ts: InteractableTemplate[]) => void;
}

export function createDefaultInteractable(id: string, name: string): InteractableTemplate {
  return {
    id,
    name,
    description: "",
    activityTag: "",
    allowedAbilityTags: [],
    requiredLevel: 0,
    effectiveHealth: { min: 50, max: 100 },
    barColor: "#5a8a5e",
    accentColor: "#7aaa7e",
    meterLabel: "HP",
    lootTable: [],
    xpRewards: [],
    abilities: [],
    onInteractEffects: [],
    onDestroyEffects: [],
  };
}

const SEED_INTERACTABLES: InteractableTemplate[] = [
  {
    id: "oak_tree",
    name: "Oak Tree",
    folder: "trees",
    description: "A sturdy oak. Yields logs and sap when felled.",
    activityTag: "tree",
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
];

export const useInteractableStore = create<InteractableState>()(
  persist(
    (set) => ({
      interactables: SEED_INTERACTABLES,

      addInteractable: (t) =>
        set((s) => ({ interactables: [...s.interactables, t] })),

      updateInteractable: (id, patch) =>
        set((s) => ({
          interactables: s.interactables.map((t) =>
            t.id === id ? { ...t, ...patch } : t
          ),
        })),

      removeInteractable: (id) =>
        set((s) => ({ interactables: s.interactables.filter((t) => t.id !== id) })),

      loadInteractables: (ts) => set({ interactables: ts }),
    }),
    {
      name: "editor-interactables",
      partialize: (state) => ({ interactables: state.interactables }),
    }
  )
);
