import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "../layout/PageShell";
import { useItemStore, createDefaultItem } from "../../stores/itemStore";

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export function ItemListPage() {
  const { items, addItem, removeItem } = useItemStore();
  const navigate = useNavigate();
  const [newName, setNewName] = useState("");

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    const id = slugify(name);
    if (items.some((i) => i.id === id)) return;
    addItem(createDefaultItem(id, name));
    setNewName("");
    navigate(`/items/${id}`);
  };

  return (
    <PageShell title="Items">
      <section className="editor-section">
        <p className="section-desc">
          Define item templates — equipment, consumables, and materials.
        </p>
        <table className="editor-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Slot</th>
              <th>Stackable</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td className="cell-id">{item.id}</td>
                <td>
                  <button
                    className="link-btn"
                    onClick={() => navigate(`/items/${item.id}`)}
                  >
                    {item.name}
                  </button>
                </td>
                <td>{item.slot || "—"}</td>
                <td>{item.stackable ? "Yes" : "No"}</td>
                <td>
                  <button
                    className="btn btn--danger btn--sm"
                    onClick={() => removeItem(item.id)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="add-row">
          <input
            type="text"
            placeholder="New item name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="input"
          />
          <button className="btn btn--primary" onClick={handleAdd}>
            Add Item
          </button>
        </div>
      </section>
    </PageShell>
  );
}
