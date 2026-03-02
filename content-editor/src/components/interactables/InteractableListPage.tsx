import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "../layout/PageShell";
import {
  useInteractableStore,
  createDefaultInteractable,
} from "../../stores/interactableStore";

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export function InteractableListPage() {
  const { interactables, addInteractable, removeInteractable } =
    useInteractableStore();
  const navigate = useNavigate();
  const [newName, setNewName] = useState("");

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    const id = slugify(name);
    if (interactables.some((t) => t.id === id)) return;
    addInteractable(createDefaultInteractable(id, name));
    setNewName("");
    navigate(`/interactables/${id}`);
  };

  return (
    <PageShell title="Interactables">
      <section className="editor-section">
        <p className="section-desc">
          Define interactable objects — trees, ores, enemies, NPCs, buttons, and
          more. Each interactable has an activity tag, loot table, abilities, and
          storage effects.
        </p>
        <table className="editor-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Activity</th>
              <th>Level</th>
              <th>Abilities</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {interactables.map((t) => (
              <tr key={t.id}>
                <td className="cell-id">{t.id}</td>
                <td>
                  <button
                    className="link-btn"
                    onClick={() => navigate(`/interactables/${t.id}`)}
                  >
                    {t.name}
                  </button>
                </td>
                <td>{t.activityTag || "—"}</td>
                <td>{t.requiredLevel}</td>
                <td>{t.abilities.length}</td>
                <td>
                  <button
                    className="btn btn--danger btn--sm"
                    onClick={() => removeInteractable(t.id)}
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
            placeholder="New interactable name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="input"
          />
          <button className="btn btn--primary" onClick={handleAdd}>
            Add Interactable
          </button>
        </div>
      </section>
    </PageShell>
  );
}
