import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "../layout/PageShell";
import { createDefaultItemSet, useItemizationStore } from "../../stores/itemizationStore";

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export function ItemSetListPage() {
  const { itemSets, addItemSet, removeItemSet } = useItemizationStore();
  const navigate = useNavigate();
  const [newName, setNewName] = useState("");
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () =>
      itemSets.filter((itemSet) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return itemSet.name.toLowerCase().includes(q) || itemSet.id.toLowerCase().includes(q);
      }),
    [itemSets, search]
  );

  return (
    <PageShell title="Item Sets">
      <section className="editor-section">
        <p className="section-desc">
          Author set membership and multi-piece bonuses. Set item ids are currently freeform ids until dedicated set-item entities are added.
        </p>
        <div className="filter-bar">
          <input
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or ID..."
          />
        </div>
        <table className="editor-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Items</th>
              <th>Bonuses</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((itemSet) => (
              <tr key={itemSet.id}>
                <td className="cell-id">{itemSet.id}</td>
                <td>
                  <button className="link-btn" onClick={() => navigate(`/itemization/sets/${itemSet.id}`)}>
                    {itemSet.name}
                  </button>
                </td>
                <td>{itemSet.itemIds.length}</td>
                <td>{itemSet.bonuses.length}</td>
                <td>
                  <button className="btn btn--danger btn--sm" onClick={() => removeItemSet(itemSet.id)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="add-row">
          <input
            className="input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New item set name..."
          />
          <button
            className="btn btn--primary"
            onClick={() => {
              const name = newName.trim();
              if (!name) return;
              const id = slugify(name);
              if (itemSets.some((entry) => entry.id === id)) return;
              addItemSet(createDefaultItemSet(id, name));
              setNewName("");
              navigate(`/itemization/sets/${id}`);
            }}
          >
            Add Item Set
          </button>
        </div>
      </section>
    </PageShell>
  );
}
