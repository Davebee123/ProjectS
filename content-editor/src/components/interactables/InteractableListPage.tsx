import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "../layout/PageShell";
import { useInteractableStore, createDefaultInteractable } from "../../stores/interactableStore";
import { useTagStore } from "../../stores/tagStore";

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export function InteractableListPage() {
  const { interactables, addInteractable, removeInteractable } = useInteractableStore();
  const { activityTags } = useTagStore();
  const navigate = useNavigate();
  const [newName, setNewName] = useState("");
  const [search, setSearch] = useState("");
  const [activityFilter, setActivityFilter] = useState("all");
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    return interactables.filter((t) => {
      if (search) {
        const q = search.toLowerCase();
        if (!t.name.toLowerCase().includes(q) && !t.id.toLowerCase().includes(q)) return false;
      }
      if (activityFilter !== "all" && t.activityTag !== activityFilter) return false;
      return true;
    });
  }, [interactables, search, activityFilter]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof interactables>();
    for (const t of filtered) {
      const key = t.folder?.trim() || "(Ungrouped)";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
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
        <div className="filter-bar">
          <input
            className="input"
            placeholder="Search name or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="input select"
            value={activityFilter}
            onChange={(e) => setActivityFilter(e.target.value)}
          >
            <option value="all">All Activities</option>
            {activityTags.map((t) => (
              <option key={t.id} value={t.id}>{t.label || t.id}</option>
            ))}
          </select>
        </div>
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
            {groups.map(([folderName, groupItems]) => {
              const collapsed = collapsedFolders.has(folderName);
              return (
                <React.Fragment key={folderName}>
                  <tr>
                    <td colSpan={6} style={{ padding: 0 }}>
                      <div className="folder-header" onClick={() => toggleFolder(folderName)}>
                        <span className={`folder-chevron${collapsed ? "" : " folder-chevron--open"}`}>▶</span>
                        {folderName}
                        <span className="folder-count">({groupItems.length})</span>
                      </div>
                    </td>
                  </tr>
                  {!collapsed && groupItems.map((t) => (
                    <tr key={t.id}>
                      <td className="cell-id">{t.id}</td>
                      <td>
                        <button className="link-btn" onClick={() => navigate(`/interactables/${t.id}`)}>
                          {t.name}
                        </button>
                      </td>
                      <td>{t.activityTag || "—"}</td>
                      <td>{t.requiredLevel}</td>
                      <td>{t.abilities.length}</td>
                      <td>
                        <button className="btn btn--danger btn--sm" onClick={() => removeInteractable(t.id)}>
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
