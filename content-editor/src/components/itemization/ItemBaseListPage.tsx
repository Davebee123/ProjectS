import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "../layout/PageShell";
import { createDefaultItemBase, useItemizationStore } from "../../stores/itemizationStore";
import { ItemBaseEditorContent } from "./ItemBaseEditorContent";
import { ItemizationErrorBoundary } from "./ItemizationErrorBoundary";

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export function ItemBaseListPage() {
  const { itemBases, addItemBase, removeItemBase } = useItemizationStore();
  const navigate = useNavigate();
  const [newName, setNewName] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      itemBases.filter((itemBase) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return itemBase.name.toLowerCase().includes(q) || itemBase.id.toLowerCase().includes(q);
      }),
    [itemBases, search]
  );

  return (
    <PageShell title="Item Bases">
      <section className="editor-section">
        <p className="section-desc">
          Author rollable equipment bases, their implicits, requirements, and affix pool access.
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
              <th>Class</th>
              <th>Slot</th>
              <th>Affix Tables</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((itemBase) => (
              <tr key={itemBase.id}>
                <td className="cell-id">{itemBase.id}</td>
                <td>
                  <button className="link-btn" onClick={() => setSelectedId(itemBase.id)}>
                    {itemBase.name}
                  </button>
                </td>
                <td>{itemBase.itemClassId}</td>
                <td>{itemBase.slot}</td>
                <td>{itemBase.affixTableIds?.length ?? 0}</td>
                <td>
                  <button
                    className="btn btn--sm"
                    onClick={() => setSelectedId(itemBase.id)}
                    style={{ marginRight: 8 }}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn--sm"
                    onClick={() => navigate(`/itemization/bases/${itemBase.id}`)}
                    style={{ marginRight: 8 }}
                  >
                    Open Route
                  </button>
                  <button className="btn btn--danger btn--sm" onClick={() => removeItemBase(itemBase.id)}>
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
            placeholder="New item base name..."
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              const name = newName.trim();
              if (!name) return;
              const id = slugify(name);
              if (itemBases.some((entry) => entry.id === id)) return;
              addItemBase(createDefaultItemBase(id, name));
              setNewName("");
              navigate(`/itemization/bases/${id}`);
            }}
          />
          <button
            className="btn btn--primary"
            onClick={() => {
              const name = newName.trim();
              if (!name) return;
              const id = slugify(name);
              if (itemBases.some((entry) => entry.id === id)) return;
              addItemBase(createDefaultItemBase(id, name));
              setNewName("");
              navigate(`/itemization/bases/${id}`);
            }}
          >
            Add Item Base
          </button>
        </div>
      </section>

      {selectedId ? (
        <section className="editor-section">
          <div className="editor-subsection-header">
            <div>
              <h3 className="section-title" style={{ marginBottom: 0 }}>
                Editing {itemBases.find((entry) => entry.id === selectedId)?.name ?? selectedId}
              </h3>
              <p className="section-desc">Inline editor for the selected item base.</p>
            </div>
            <button className="btn" onClick={() => setSelectedId(null)}>
              Close Editor
            </button>
          </div>
          <ItemizationErrorBoundary contextLabel={`item base ${selectedId}`}>
            <ItemBaseEditorContent itemBaseId={selectedId} />
          </ItemizationErrorBoundary>
        </section>
      ) : null}
    </PageShell>
  );
}
