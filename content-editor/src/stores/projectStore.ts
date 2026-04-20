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
import { useQuestStore } from "./questStore";
import { useDialogueStore } from "./dialogueStore";
import { useCutsceneStore } from "./cutsceneStore";
import { useItemizationStore } from "./itemizationStore";
import { useWeatherStore } from "./weatherStore";
import { getComparableBundleSignature } from "../utils/bundleSignature";

interface ProjectState {
  projectName: string;
  lastRepoLoadAt?: string;
  lastRepoSaveAt?: string;
  lastSyncedBundleSignature?: string;
  setProjectName: (name: string) => void;
  exportBundle: () => GameContentBundle;
  importBundle: (bundle: GameContentBundle) => void;
  downloadJson: () => void;
  resetAllStores: () => void;
  markRepoLoaded: (bundle?: GameContentBundle) => void;
  markRepoSaved: (bundle?: GameContentBundle) => void;
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
        const dialogueState = useDialogueStore.getState();
        const cutsceneState = useCutsceneStore.getState();
        const questState = useQuestStore.getState();
        const itemizationState = useItemizationStore.getState();
        const weatherState = useWeatherStore.getState();

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
          itemClasses: itemizationState.itemClasses,
          affixTables: itemizationState.affixTables,
          modifierStats: itemizationState.modifierStats,
          itemBases: itemizationState.itemBases,
          affixes: itemizationState.affixes,
          itemQualityRules: itemizationState.itemQualityRules,
          uniqueItems: itemizationState.uniqueItems,
          itemSets: itemizationState.itemSets,
          skills: skillState.skills,
          combos: comboState.combos,
          dialogues: dialogueState.dialogues,
          cutscenes: cutsceneState.cutscenes,
          quests: questState.quests,
          recipes: useRecipeStore.getState().recipes,
          interactables: interactState.interactables,
          world: worldState.world,
          weathers: weatherState.weathers,
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
        useItemizationStore.getState().loadItemization({
          itemClasses: bundle.itemClasses ?? [],
          affixTables: bundle.affixTables ?? [],
          modifierStats: bundle.modifierStats ?? [],
          itemBases: bundle.itemBases ?? [],
          affixes: bundle.affixes ?? [],
          itemQualityRules: bundle.itemQualityRules ?? [],
          uniqueItems: bundle.uniqueItems ?? [],
          itemSets: bundle.itemSets ?? [],
        });
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
        useDialogueStore.getState().loadDialogues(bundle.dialogues ?? []);
        useCutsceneStore.getState().loadCutscenes(bundle.cutscenes ?? []);
        useQuestStore.getState().loadQuests(bundle.quests ?? []);
        if (bundle.recipes) {
          useRecipeStore.getState().loadRecipes(bundle.recipes);
        }
        if (bundle.world) {
          useWorldStore.getState().loadWorld(bundle.world);
        }
        if (bundle.weathers) {
          useWeatherStore.getState().loadWeathers(bundle.weathers);
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
          "editor-combos", "editor-quests", "editor-recipes", "editor-world", "editor-project",
          "editor-dialogues",
          "editor-cutscenes",
          "editor-itemization",
          "editor-weathers",
        ];
        for (const key of keys) {
          localStorage.removeItem(key);
        }
        // Reload page to reset to defaults
        window.location.reload();
      },

      markRepoLoaded: (bundle) =>
        set({
          lastRepoLoadAt: new Date().toISOString(),
          lastSyncedBundleSignature: getComparableBundleSignature(bundle ?? get().exportBundle()),
        }),

      markRepoSaved: (bundle) =>
        set({
          lastRepoSaveAt: new Date().toISOString(),
          lastSyncedBundleSignature: getComparableBundleSignature(bundle ?? get().exportBundle()),
        }),
    }),
    {
      name: "editor-project",
      partialize: (state) => ({
        projectName: state.projectName,
        lastRepoLoadAt: state.lastRepoLoadAt,
        lastRepoSaveAt: state.lastRepoSaveAt,
        lastSyncedBundleSignature: state.lastSyncedBundleSignature,
      }),
    }
  )
);
