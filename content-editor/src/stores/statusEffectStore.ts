import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { StatusEffectTemplate } from "../schema/types";

interface StatusEffectState {
  statusEffects: StatusEffectTemplate[];
  addStatusEffect: (effect: StatusEffectTemplate) => void;
  updateStatusEffect: (id: string, patch: Partial<StatusEffectTemplate>) => void;
  removeStatusEffect: (id: string) => void;
  loadStatusEffects: (effects: StatusEffectTemplate[]) => void;
}

export function createDefaultStatusEffect(id: string, name: string): StatusEffectTemplate {
  return {
    id,
    name,
    description: "",
    removalType: "timed",
    durationMs: 10000,
    statModifiers: [],
    stackable: false,
    maxStacks: 1,
    color: "#c4a44a",
  };
}

export const useStatusEffectStore = create<StatusEffectState>()(
  persist(
    (set) => ({
      statusEffects: [],

      addStatusEffect: (effect) =>
        set((s) => ({ statusEffects: [...s.statusEffects, effect] })),

      updateStatusEffect: (id, patch) =>
        set((s) => ({
          statusEffects: s.statusEffects.map((e) =>
            e.id === id ? { ...e, ...patch } : e
          ),
        })),

      removeStatusEffect: (id) =>
        set((s) => ({ statusEffects: s.statusEffects.filter((e) => e.id !== id) })),

      loadStatusEffects: (effects) => set({ statusEffects: effects }),
    }),
    {
      name: "editor-status-effects",
      partialize: (state) => ({ statusEffects: state.statusEffects }),
    }
  )
);
