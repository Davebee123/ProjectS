import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { GameContentBundle } from "../schema/types";
import { useTagStore } from "./tagStore";
import { useStorageKeyStore } from "./storageKeyStore";
import { useItemStore } from "./itemStore";
import { useSkillStore } from "./skillStore";
import { useStatusEffectStore } from "./statusEffectStore";
import { useInteractableStore } from "./interactableStore";
import { useWorldStore } from "./worldStore";
import { useComboStore } from "./comboStore";
import { useRecipeStore } from "./recipeStore";

interface ProjectState {
  projectName: string;
  setProjectName: (name: string) => void;
  exportBundle: () => GameContentBundle;
  importBundle: (bundle: GameContentBundle) => void;
  downloadJson: () => void;
  resetAllStores: () => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projectName: "Incremental Fantasy RPG",

      setProjectName: (name) => set({ projectName: name }),

      exportBundle: () => {
        const tags = useTagStore.getState();
        const storage = useStorageKeyStore.getState();
        const itemState = useItemStore.getState();
        const skillState = useSkillStore.getState();
        const fxState = useStatusEffectStore.getState();
        const interactState = useInteractableStore.getState();
        const worldState = useWorldStore.getState();
        const comboState = useComboStore.getState();

        const bundle: GameContentBundle = {
          version: "1.0.0",
          exportedAt: new Date().toISOString(),
          tags: {
            activityTags: tags.activityTags,
            abilityTags: tags.abilityTags,
          },
          storageKeys: storage.storageKeys,
          statusEffects: fxState.statusEffects,
          items: itemState.items,
          skills: skillState.skills,
          combos: comboState.combos,
          recipes: useRecipeStore.getState().recipes,
          interactables: interactState.interactables,
          world: worldState.world,
        };

        return bundle;
      },

      importBundle: (bundle) => {
        const tagStore = useTagStore.getState();
        const storageStore = useStorageKeyStore.getState();

        if (bundle.tags) {
          tagStore.loadTags(bundle.tags.activityTags, bundle.tags.abilityTags);
        }
        if (bundle.storageKeys) {
          storageStore.loadStorageKeys(bundle.storageKeys);
        }
        if (bundle.items) {
          useItemStore.getState().loadItems(bundle.items);
        }
        if (bundle.skills) {
          useSkillStore.getState().loadSkills(bundle.skills);
        }
        if (bundle.statusEffects) {
          useStatusEffectStore.getState().loadStatusEffects(bundle.statusEffects);
        }
        if (bundle.interactables) {
          useInteractableStore.getState().loadInteractables(bundle.interactables);
        }
        if (bundle.combos) {
          useComboStore.getState().loadCombos(bundle.combos);
        }
        if (bundle.recipes) {
          useRecipeStore.getState().loadRecipes(bundle.recipes);
        }
        if (bundle.world) {
          useWorldStore.getState().loadWorld(bundle.world);
        }
      },

      downloadJson: () => {
        const bundle = get().exportBundle();
        const json = JSON.stringify(bundle, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "game-content.json";
        a.click();
        URL.revokeObjectURL(url);
      },

      resetAllStores: () => {
        // Clear all localStorage keys for editor stores
        const keys = [
          "editor-tags", "editor-storage-keys", "editor-items",
          "editor-skills", "editor-status-effects", "editor-interactables",
          "editor-combos", "editor-recipes", "editor-world", "editor-project",
        ];
        for (const key of keys) {
          localStorage.removeItem(key);
        }
        // Reload page to reset to defaults
        window.location.reload();
      },
    }),
    {
      name: "editor-project",
      partialize: (state) => ({ projectName: state.projectName }),
    }
  )
);
