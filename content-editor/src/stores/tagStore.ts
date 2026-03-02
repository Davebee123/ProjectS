import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ActivityTagDef, AbilityTagDef } from "../schema/types";

interface TagState {
  activityTags: ActivityTagDef[];
  abilityTags: AbilityTagDef[];
  addActivityTag: (tag: ActivityTagDef) => void;
  updateActivityTag: (id: string, patch: Partial<ActivityTagDef>) => void;
  removeActivityTag: (id: string) => void;
  addAbilityTag: (tag: AbilityTagDef) => void;
  updateAbilityTag: (id: string, patch: Partial<AbilityTagDef>) => void;
  removeAbilityTag: (id: string) => void;
  loadTags: (activity: ActivityTagDef[], ability: AbilityTagDef[]) => void;
}

export const useTagStore = create<TagState>()(
  persist(
    (set) => ({
      activityTags: [
        { id: "tree", label: "Tree", description: "Woodcutting activities", color: "#415236" },
      ],
      abilityTags: [
        { id: "chop", label: "Chop", description: "Chopping abilities" },
      ],

      addActivityTag: (tag) =>
        set((s) => ({ activityTags: [...s.activityTags, tag] })),

      updateActivityTag: (id, patch) =>
        set((s) => ({
          activityTags: s.activityTags.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),

      removeActivityTag: (id) =>
        set((s) => ({ activityTags: s.activityTags.filter((t) => t.id !== id) })),

      addAbilityTag: (tag) =>
        set((s) => ({ abilityTags: [...s.abilityTags, tag] })),

      updateAbilityTag: (id, patch) =>
        set((s) => ({
          abilityTags: s.abilityTags.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),

      removeAbilityTag: (id) =>
        set((s) => ({ abilityTags: s.abilityTags.filter((t) => t.id !== id) })),

      loadTags: (activity, ability) =>
        set({ activityTags: activity, abilityTags: ability }),
    }),
    {
      name: "editor-tags",
      partialize: (state) => ({
        activityTags: state.activityTags,
        abilityTags: state.abilityTags,
      }),
    }
  )
);
