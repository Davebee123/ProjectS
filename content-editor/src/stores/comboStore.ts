import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ComboRuleTemplate } from "../schema/types";

interface ComboState {
  combos: ComboRuleTemplate[];
  addCombo: (combo: ComboRuleTemplate) => void;
  updateCombo: (id: string, patch: Partial<ComboRuleTemplate>) => void;
  removeCombo: (id: string) => void;
  loadCombos: (combos: ComboRuleTemplate[]) => void;
}

export function createDefaultCombo(id: string): ComboRuleTemplate {
  return {
    id,
    fromSkillId: "",
    toSkillId: "",
    activityTag: "",
    windowMs: 2000,
    timeMultiplier: 0.8,
    energyMultiplier: 0.9,
    label: "",
  };
}

export const useComboStore = create<ComboState>()(
  persist(
    (set) => ({
      combos: [
        {
          id: "upward_to_downward",
          folder: "tree",
          fromSkillId: "upward_chop",
          toSkillId: "downward_chop",
          activityTag: "tree",
          windowMs: 5000,
          timeMultiplier: 0.5,
          energyMultiplier: 0.5,
          label: "UPWARD -> DOWNWARD",
        },
      ],

      addCombo: (combo) =>
        set((s) => ({ combos: [...s.combos, combo] })),

      updateCombo: (id, patch) =>
        set((s) => ({
          combos: s.combos.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),

      removeCombo: (id) =>
        set((s) => ({ combos: s.combos.filter((c) => c.id !== id) })),

      loadCombos: (combos) => set({ combos }),
    }),
    {
      name: "editor-combos",
      partialize: (state) => ({ combos: state.combos }),
    }
  )
);
