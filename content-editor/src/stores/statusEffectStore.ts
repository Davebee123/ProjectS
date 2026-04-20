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
    iconImage: undefined,
    removalType: "timed",
    durationMs: 10000,
    statModifiers: [],
    preventsSpellCasting: false,
    preventsWeaponAbilities: false,
    stackable: false,
    maxStacks: 1,
    color: "#c4a44a",
    eventHooks: [],
  };
}

export const useStatusEffectStore = create<StatusEffectState>()(
  persist(
    (set) => ({
      statusEffects: [
        {
          id: "suspended",
          name: "Suspended",
          description: "The target is suspended in the air and vulnerable to follow-up abilities.",
          folder: "control",
          iconImage: "/icons/status/suspended.svg",
          removalType: "timed",
          durationMs: 6000,
          statModifiers: [],
          preventsSpellCasting: false,
          preventsWeaponAbilities: false,
          stackable: false,
          maxStacks: 1,
          color: "#7c8cff",
          eventHooks: [],
        },
        {
          id: "armor_shredded",
          name: "Armor Shredded",
          description: "The target's defenses are broken down by follow-up attacks.",
          folder: "debuffs",
          iconImage: "/icons/status/armor-shredded.svg",
          removalType: "timed",
          durationMs: 8000,
          statModifiers: [],
          preventsSpellCasting: false,
          preventsWeaponAbilities: false,
          stackable: false,
          maxStacks: 1,
          color: "#ff744e",
          eventHooks: [],
        },
      ],

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
