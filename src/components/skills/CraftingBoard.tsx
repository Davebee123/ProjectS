import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useGame } from "../../GameContext";
import { getItemDefs, getRecipeDefs, type ItemDef, type RecipeDef } from "../../data/loader";
import { evaluateCondition } from "../../data/evaluator";
import { buildEvalContext } from "../../state";

interface ResolvedIngredient {
  itemId: string;
  name: string;
  required: number;
  held: number;
  satisfied: boolean;
}

interface ResolvedRecipe {
  recipe: RecipeDef;
  output: ItemDef | undefined;
  description: string;
  image?: string;
  ingredients: ResolvedIngredient[];
  canCraft: boolean;
}

interface ActiveCraftingTooltip {
  recipeId: string;
  anchorEl: HTMLElement;
  requirements: ResolvedIngredient[];
}

function groupRecipesByFolder(recipes: ResolvedRecipe[]) {
  const groups = new Map<string, ResolvedRecipe[]>();
  for (const recipe of recipes) {
    const folder = recipe.recipe.folder?.trim() || "Misc";
    if (!groups.has(folder)) {
      groups.set(folder, []);
    }
    groups.get(folder)?.push(recipe);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([folder, entries]) => [
      folder,
      [...entries].sort((left, right) => left.recipe.name.localeCompare(right.recipe.name)),
    ] as const);
}

export function CraftingBoard() {
  const { state, dispatch } = useGame();
  const [search, setSearch] = useState("");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [activeTooltip, setActiveTooltip] = useState<ActiveCraftingTooltip | null>(null);
  const activeCraft = state.craftingAction;

  useEffect(() => {
    if (!activeTooltip) return;

    const clearTooltip = () => setActiveTooltip(null);
    window.addEventListener("resize", clearTooltip);
    window.addEventListener("scroll", clearTooltip, true);
    return () => {
      window.removeEventListener("resize", clearTooltip);
      window.removeEventListener("scroll", clearTooltip, true);
    };
  }, [activeTooltip]);

  const groupedRecipes = useMemo(() => {
    const ctx = buildEvalContext(state);
    const itemDefs = new Map(getItemDefs().map((item) => [item.id, item]));

    const visibleRecipes = getRecipeDefs()
      .filter((recipe) => !recipe.unlockCondition || evaluateCondition(recipe.unlockCondition, ctx))
      .map<ResolvedRecipe>((recipe) => {
        const output = itemDefs.get(recipe.outputItemId);
        const ingredients = recipe.ingredients.map<ResolvedIngredient>((ingredient) => {
          const item = itemDefs.get(ingredient.itemId);
          const held = ctx.itemCount(ingredient.itemId);
          return {
            itemId: ingredient.itemId,
            name: item?.name ?? ingredient.itemId,
            required: ingredient.qty,
            held,
            satisfied: held >= ingredient.qty,
          };
        });
        const canCraft = ingredients.every((ingredient) => ingredient.satisfied);
        return {
          recipe,
          output,
          description: recipe.description || output?.description || "",
          image: output?.image,
          ingredients,
          canCraft,
        };
      })
      .filter((recipe) => {
        if (!search.trim()) {
          return true;
        }
        if (activeCraft?.recipeId === recipe.recipe.id) {
          return true;
        }
        const query = search.trim().toLowerCase();
        return (
          recipe.recipe.name.toLowerCase().includes(query) ||
          (recipe.output?.name || "").toLowerCase().includes(query) ||
          recipe.description.toLowerCase().includes(query)
        );
      });

    return groupRecipesByFolder(visibleRecipes);
  }, [activeCraft?.recipeId, search, state]);

  const isSectionOpen = (name: string, index: number) => {
    if (name in openSections) {
      return openSections[name];
    }
    return index === 0;
  };

  return (
    <div className="crafting-board">
      <input
        className="crafting-search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search"
      />

      {groupedRecipes.length > 0 ? groupedRecipes.map(([folder, recipes], index) => {
        const hasActiveCraft = recipes.some(({ recipe }) => recipe.id === activeCraft?.recipeId);
        const open = hasActiveCraft || isSectionOpen(folder, index);
        return (
          <section key={folder} className="crafting-section">
            <button
              type="button"
              className="quest-category-header crafting-category-header"
              onClick={() => setOpenSections((prev) => ({ ...prev, [folder]: !open }))}
            >
              <span>{folder}</span>
              <span className="quest-category-chevron">{open ? "\u25BC" : "\u25B6"}</span>
            </button>

            {open ? (
              <div className="crafting-category-body">
                {recipes.map(({ recipe, image, ingredients, canCraft }) => {
                  const isCrafting = activeCraft?.recipeId === recipe.id;
                  const craftingProgress = isCrafting
                    ? Math.max(
                        0,
                        Math.min(
                          100,
                          ((state.now - activeCraft.startedAt) / activeCraft.durationMs) * 100
                        )
                      )
                    : 0;
                  return (
                    <article
                      key={recipe.id}
                      className={`crafting-card${isCrafting ? " is-crafting" : ""}`}
                      tabIndex={0}
                      onMouseEnter={(e) =>
                        setActiveTooltip({
                          recipeId: recipe.id,
                          anchorEl: e.currentTarget,
                          requirements: ingredients,
                        })}
                      onMouseLeave={() => setActiveTooltip((prev) => (prev?.recipeId === recipe.id ? null : prev))}
                      onFocus={(e) =>
                        setActiveTooltip({
                          recipeId: recipe.id,
                          anchorEl: e.currentTarget,
                          requirements: ingredients,
                        })}
                      onBlur={() => setActiveTooltip((prev) => (prev?.recipeId === recipe.id ? null : prev))}
                    >
                      <div className="crafting-card-top">
                        <div className="crafting-card-image">
                          {image ? <img src={image} alt={recipe.name} /> : <span>Image</span>}
                        </div>
                        <div className="crafting-card-title-row">
                          <div className="crafting-card-title">{recipe.name}</div>
                          <button
                            type="button"
                            className={`crafting-button crafting-button-inline ${canCraft && !activeCraft ? "is-enabled" : "is-disabled"}`}
                            disabled={!canCraft || Boolean(activeCraft)}
                            onClick={() => dispatch({ type: "CRAFT_ITEM", recipeId: recipe.id })}
                          >
                            {canCraft ? "Craft" : "Cannot Craft"}
                          </button>
                        </div>
                      </div>
                      {isCrafting ? (
                        <div className="crafting-card-overlay">
                          <div className="crafting-card-overlay-title">Crafting...</div>
                          <div className="crafting-card-overlay-meter">
                            <div
                              className="crafting-card-overlay-fill"
                              style={{ width: `${craftingProgress}%` }}
                            />
                          </div>
                          <div className="crafting-card-overlay-percent">
                            {Math.round(craftingProgress)}%
                          </div>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            ) : null}
          </section>
        );
      }) : (
        <div className="skills-placeholder-panel">
          <p className="empty-text">No craftable recipes available.</p>
        </div>
      )}

      {activeTooltip && typeof document !== "undefined"
        ? createPortal(
            (() => {
              const rect = activeTooltip.anchorEl.getBoundingClientRect();
              const tooltipWidth = Math.min(360, window.innerWidth - 48);
              const preferredLeft = rect.left;
              const clampedLeft = Math.max(16, Math.min(preferredLeft, window.innerWidth - tooltipWidth - 16));
              const top = rect.bottom + 8;

              return (
                <div
                  className="crafting-floating-tooltip"
                  role="tooltip"
                  style={{ top, left: clampedLeft, width: tooltipWidth }}
                >
                  {activeTooltip.requirements.length > 0 ? (
                    <div className="crafting-floating-tooltip-meta">
                      {activeTooltip.requirements.map((ingredient) => (
                        <div
                          key={`${activeTooltip.recipeId}_${ingredient.itemId}`}
                          className={`crafting-floating-tooltip-meta-row ${ingredient.satisfied ? "is-met" : "is-missing"}`}
                        >
                          <span className="crafting-floating-tooltip-meta-label">{ingredient.name}</span>
                          <span className="crafting-floating-tooltip-meta-value">
                            {Math.min(ingredient.held, ingredient.required)}/{ingredient.required}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="crafting-floating-tooltip-description">No requirements.</p>
                  )}
                </div>
              );
            })(),
            document.body
          )
        : null}
    </div>
  );
}
