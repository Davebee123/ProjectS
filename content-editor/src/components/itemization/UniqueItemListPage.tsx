import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "../layout/PageShell";
import { createDefaultUniqueItem, useItemizationStore } from "../../stores/itemizationStore";

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export function UniqueItemListPage() {
  const { uniqueItems, addUniqueItem, removeUniqueItem } = useItemizationStore();
  const navigate = useNavigate();
  const [newName, setNewName] = useState("");
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () =>
      uniqueItems.filter((item) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return item.name.toLowerCase().includes(q) || item.id.toLowerCase().includes(q);
      }),
    [uniqueItems, search]
  );

  return (
    <PageShell title="Unique Items">
      <section className="editor-section">
        <p className="section-desc">
          Author fixed non-random unique gear definitions on top of item bases.
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
              <th>Base</th>
              <th>Modifiers</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id}>
                <td className="cell-id">{item.id}</td>
                <td>
                  <button className="link-btn" onClick={() => navigate(`/itemization/uniques/${item.id}`)}>
                    {item.name}
                  </button>
                </td>
                <td>{item.baseId}</td>
                <td>{item.modifiers.length}</td>
                <td>
                  <button className="btn btn--danger btn--sm" onClick={() => removeUniqueItem(item.id)}>
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
            placeholder="New unique item name..."
          />
          <button
            className="btn btn--primary"
            onClick={() => {
              const name = newName.trim();
              if (!name) return;
              const id = slugify(name);
              if (uniqueItems.some((entry) => entry.id === id)) return;
              addUniqueItem(createDefaultUniqueItem(id, name));
              setNewName("");
              navigate(`/itemization/uniques/${id}`);
            }}
          >
            Add Unique Item
          </button>
        </div>
      </section>
    </PageShell>
  );
}
