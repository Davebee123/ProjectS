import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "../layout/PageShell";
import { useRecipeStore, createDefaultRecipe } from "../../stores/recipeStore";
import { useItemStore } from "../../stores/itemStore";

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export function RecipeListPage() {
  const { recipes, addRecipe, removeRecipe } = useRecipeStore();
  const { items } = useItemStore();
  const navigate = useNavigate();
  const [newName, setNewName] = useState("");
  const [search, setSearch] = useState("");
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());

  const itemName = (id: string) => items.find((i) => i.id === id)?.name || id || "—";

  const filtered = useMemo(() =>
    recipes.filter((r) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q);
    }),
    [recipes, search]
  );

  const groups = useMemo(() => {
    const map = new Map<string, typeof recipes>();
    for (const r of filtered) {
      const key = r.folder?.trim() || "(Ungrouped)";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === "(Ungrouped)") return 1;
      if (b === "(Ungrouped)") return -1;
      return a.localeCompare(b);
    });
  }, [filtered]);

  const toggleFolder = (name: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    const id = slugify(name);
    if (recipes.some((r) => r.id === id)) return;
    const recipe = createDefaultRecipe(id);
    recipe.name = name;
    addRecipe(recipe);
    setNewName("");
    navigate(`/recipes/${id}`);
  };

  return (
    <PageShell title="Recipes">
      <section className="editor-section">
        <p className="section-desc">
          Define crafting recipes. Ingredients are consumed from inventory to produce an output
          item. Optionally require a crafting station (by activity tag) and an unlock condition.
        </p>
        <div className="filter-bar">
          <input
            className="input"
            placeholder="Search name or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <table className="editor-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Ingredients</th>
              <th>Output</th>
              <th>Station Tag</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {groups.map(([folderName, groupItems]) => {
              const collapsed = collapsedFolders.has(folderName);
              return (
                <React.Fragment key={folderName}>
                  <tr>
                    <td colSpan={5} style={{ padding: 0 }}>
                      <div
                        className="folder-header"
                        onClick={() => toggleFolder(folderName)}
                      >
                        <span className={`folder-chevron${collapsed ? "" : " folder-chevron--open"}`}>
                          ▶
                        </span>
                        {folderName}
                        <span className="folder-count">({groupItems.length})</span>
                      </div>
                    </td>
                  </tr>
                  {!collapsed && groupItems.map((recipe) => (
                    <tr key={recipe.id}>
                      <td>
                        <button
                          className="link-btn"
                          onClick={() => navigate(`/recipes/${recipe.id}`)}
                        >
                          {recipe.name || recipe.id}
                        </button>
                      </td>
                      <td>
                        {recipe.ingredients.length === 0
                          ? "—"
                          : recipe.ingredients
                              .map((i) => `${i.qty}× ${itemName(i.itemId)}`)
                              .join(", ")}
                      </td>
                      <td>
                        {recipe.outputItemId
                          ? `${recipe.outputQty}× ${itemName(recipe.outputItemId)}`
                          : "—"}
                      </td>
                      <td>{recipe.stationTag || <span style={{ color: "var(--text-muted)" }}>Free</span>}</td>
                      <td>
                        <button
                          className="btn btn--danger btn--sm"
                          onClick={() => removeRecipe(recipe.id)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        <div className="add-row">
          <input
            type="text"
            placeholder="New recipe name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="input"
          />
          <button className="btn btn--primary" onClick={handleAdd}>
            Add Recipe
          </button>
        </div>
      </section>
    </PageShell>
  );
}
