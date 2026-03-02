import { useParams, useNavigate } from "react-router-dom";
import { PageShell } from "../layout/PageShell";
import { useRecipeStore } from "../../stores/recipeStore";
import { useItemStore } from "../../stores/itemStore";
import { useTagStore } from "../../stores/tagStore";
import type { RecipeIngredient } from "../../schema/types";

function newIngredientId() {
  return `ing_${Date.now()}`;
}

export function RecipeEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { recipes, updateRecipe } = useRecipeStore();
  const { items } = useItemStore();
  const { activityTags } = useTagStore();

  const recipe = recipes.find((r) => r.id === id);

  if (!recipe) {
    return (
      <PageShell title="Recipe Not Found">
        <p>No recipe with id "{id}".</p>
        <button className="btn" onClick={() => navigate("/recipes")}>
          Back to Recipes
        </button>
      </PageShell>
    );
  }

  const update = (patch: Parameters<typeof updateRecipe>[1]) =>
    updateRecipe(recipe.id, patch);

  const addIngredient = () => {
    const ing: RecipeIngredient = { itemId: "", qty: 1 };
    update({ ingredients: [...recipe.ingredients, ing] });
  };

  const updateIngredient = (index: number, patch: Partial<RecipeIngredient>) => {
    const next = recipe.ingredients.map((ing, i) =>
      i === index ? { ...ing, ...patch } : ing
    );
    update({ ingredients: next });
  };

  const removeIngredient = (index: number) => {
    update({ ingredients: recipe.ingredients.filter((_, i) => i !== index) });
  };

  return (
    <PageShell
      title={recipe.name || recipe.id}
      actions={
        <button className="btn" onClick={() => navigate("/recipes")}>
          Back to Recipes
        </button>
      }
    >
      {/* Basic Properties */}
      <section className="editor-section">
        <h3 className="section-title">Basic Properties</h3>
        <div className="form-grid">
          <div className="form-field">
            <label className="field-label">ID</label>
            <input className="input" value={recipe.id} disabled />
          </div>
          <div className="form-field">
            <label className="field-label">Name</label>
            <input
              className="input"
              value={recipe.name}
              onChange={(e) => update({ name: e.target.value })}
            />
          </div>
          <div className="form-field">
            <label className="field-label">Folder</label>
            <input
              className="input"
              value={recipe.folder || ""}
              onChange={(e) => update({ folder: e.target.value || undefined })}
              placeholder="e.g. Weapons, Structures..."
            />
          </div>
          <div className="form-field">
            <label className="field-label">Station Tag</label>
            <select
              className="input"
              value={recipe.stationTag || ""}
              onChange={(e) => update({ stationTag: e.target.value || undefined })}
            >
              <option value="">(Free — no station required)</option>
              {activityTags.map((t) => (
                <option key={t.id} value={t.id}>{t.label || t.id}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Unlock Condition */}
      <section className="editor-section">
        <h3 className="section-title">Unlock Condition</h3>
        <p className="section-desc">
          DSL expression that must be true for this recipe to be visible and usable.
          Leave blank to always unlock. Use <code>player.has_item("id")</code> to create crafting trees.
        </p>
        <textarea
          className="input"
          rows={3}
          style={{ fontFamily: "monospace", fontSize: 13 }}
          value={recipe.unlockCondition || ""}
          onChange={(e) => update({ unlockCondition: e.target.value || undefined })}
          placeholder={'e.g. player.has_item("workbench") AND skill("carpentry").level >= 2'}
        />
      </section>

      {/* Ingredients */}
      <section className="editor-section">
        <h3 className="section-title">Ingredients</h3>
        <p className="section-desc">Items consumed when the recipe is crafted.</p>
        {recipe.ingredients.length > 0 && (
          <table className="editor-table" style={{ marginBottom: 12 }}>
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {recipe.ingredients.map((ing, i) => (
                <tr key={i}>
                  <td>
                    <select
                      className="input"
                      value={ing.itemId}
                      onChange={(e) => updateIngredient(i, { itemId: e.target.value })}
                    >
                      <option value="">(select item)</option>
                      {items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name || item.id}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      className="input"
                      min={1}
                      style={{ width: 72 }}
                      value={ing.qty}
                      onChange={(e) => updateIngredient(i, { qty: Math.max(1, Number(e.target.value)) })}
                    />
                  </td>
                  <td>
                    <button
                      className="btn btn--danger btn--sm"
                      onClick={() => removeIngredient(i)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <button className="btn btn--sm" onClick={addIngredient}>
          + Add Ingredient
        </button>
      </section>

      {/* Output */}
      <section className="editor-section">
        <h3 className="section-title">Output</h3>
        <p className="section-desc">Item produced when crafting succeeds.</p>
        <div className="form-grid">
          <div className="form-field">
            <label className="field-label">Output Item</label>
            <select
              className="input"
              value={recipe.outputItemId}
              onChange={(e) => update({ outputItemId: e.target.value })}
            >
              <option value="">(select item)</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name || item.id}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label className="field-label">Output Qty</label>
            <input
              type="number"
              className="input"
              min={1}
              style={{ width: 72 }}
              value={recipe.outputQty}
              onChange={(e) => update({ outputQty: Math.max(1, Number(e.target.value)) })}
            />
          </div>
        </div>
      </section>
    </PageShell>
  );
}
