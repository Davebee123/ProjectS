import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RecipeTemplate } from "../schema/types";

interface RecipeState {
  recipes: RecipeTemplate[];
  addRecipe: (recipe: RecipeTemplate) => void;
  updateRecipe: (id: string, patch: Partial<RecipeTemplate>) => void;
  removeRecipe: (id: string) => void;
  loadRecipes: (recipes: RecipeTemplate[]) => void;
}

export function createDefaultRecipe(id: string): RecipeTemplate {
  return {
    id,
    name: id,
    stationTag: "",
    unlockCondition: "",
    ingredients: [],
    outputItemId: "",
    outputQty: 1,
  };
}

export const useRecipeStore = create<RecipeState>()(
  persist(
    (set) => ({
      recipes: [],

      addRecipe: (recipe) =>
        set((s) => ({ recipes: [...s.recipes, recipe] })),

      updateRecipe: (id, patch) =>
        set((s) => ({
          recipes: s.recipes.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        })),

      removeRecipe: (id) =>
        set((s) => ({ recipes: s.recipes.filter((r) => r.id !== id) })),

      loadRecipes: (recipes) => set({ recipes }),
    }),
    {
      name: "editor-recipes",
      partialize: (state) => ({ recipes: state.recipes }),
    }
  )
);
