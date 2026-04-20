import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ActivityTagDef, AbilityTagDef } from "../schema/types";
import { useComboStore } from "./comboStore";
import { useInteractableStore } from "./interactableStore";
import { useRecipeStore } from "./recipeStore";
import { useSkillStore } from "./skillStore";

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

function removeTagId(ids: string[], removedId: string): string[] {
  return ids.filter((id) => id !== removedId);
}

function cleanupActivityTagReferences(removedId: string): void {
  useSkillStore.setState((state) => ({
    skills: state.skills.map((skill) => ({
      ...skill,
      activityTags: removeTagId(skill.activityTags, removedId),
    })),
  }));
  useInteractableStore.setState((state) => ({
    interactables: state.interactables.map((interactable) => ({
      ...interactable,
      activityTag: interactable.activityTag === removedId ? "" : interactable.activityTag,
    })),
  }));
  useComboStore.setState((state) => ({
    combos: state.combos.map((combo) => ({
      ...combo,
      activityTag: combo.activityTag === removedId ? "" : combo.activityTag,
    })),
  }));
  useRecipeStore.setState((state) => ({
    recipes: state.recipes.map((recipe) => ({
      ...recipe,
      stationTag: recipe.stationTag === removedId ? "" : recipe.stationTag,
    })),
  }));
}

function cleanupAbilityTagReferences(removedId: string): void {
  useSkillStore.setState((state) => ({
    skills: state.skills.map((skill) => ({
      ...skill,
      abilityTags: removeTagId(skill.abilityTags, removedId),
    })),
  }));
  useInteractableStore.setState((state) => ({
    interactables: state.interactables.map((interactable) => ({
      ...interactable,
      allowedAbilityTags: removeTagId(interactable.allowedAbilityTags, removedId),
    })),
  }));
}

export const useTagStore = create<TagState>()(
  persist(
    (set) => ({
      activityTags: [
        { id: "tree", label: "Tree", description: "Woodcutting activities", color: "#415236" },
        { id: "npc", label: "NPC", description: "Conversation and dialogue targets", color: "#8c8c8c" },
        { id: "enemy", label: "Enemy", description: "Hostile combat targets", color: "#8a4f4f" },
        { id: "friendly", label: "Friendly", description: "Allied combat targets and companions", color: "#4f6d8a" },
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

      removeActivityTag: (id) => {
        cleanupActivityTagReferences(id);
        set((s) => ({ activityTags: s.activityTags.filter((t) => t.id !== id) }));
      },

      addAbilityTag: (tag) =>
        set((s) => ({ abilityTags: [...s.abilityTags, tag] })),

      updateAbilityTag: (id, patch) =>
        set((s) => ({
          abilityTags: s.abilityTags.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),

      removeAbilityTag: (id) => {
        cleanupAbilityTagReferences(id);
        set((s) => ({ abilityTags: s.abilityTags.filter((t) => t.id !== id) }));
      },

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
