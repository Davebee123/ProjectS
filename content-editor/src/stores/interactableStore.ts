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
    description: "A sturdy oak tree. Chop it down for logs.",
    activityTag: "tree",
    allowedAbilityTags: ["chop"],
    requiredLevel: 0,
    effectiveHealth: { min: 80, max: 120 },
    barColor: "#5a8a5e",
    accentColor: "#7aaa7e",
    meterLabel: "Integrity",
    lootTable: [
      { id: "lt_log", itemId: "log", quantityMin: 1, quantityMax: 3, dropChance: 100, weight: 10 },
      { id: "lt_sap", itemId: "tree_sap", quantityMin: 1, quantityMax: 1, dropChance: 30, weight: 5 },
    ],
    xpRewards: [{ skillId: "treecutting", amount: 15 }],
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
