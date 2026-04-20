import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "../layout/PageShell";
import { createDefaultCutscene, useCutsceneStore } from "../../stores/cutsceneStore";

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export function CutsceneListPage() {
  const { cutscenes, addCutscene, removeCutscene } = useCutsceneStore();
  const navigate = useNavigate();
  const [newName, setNewName] = useState("");
  const [search, setSearch] = useState("");
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    return cutscenes.filter((cutscene) => {
      if (!search) {
        return true;
      }
      const query = search.toLowerCase();
      return cutscene.name.toLowerCase().includes(query) || cutscene.id.toLowerCase().includes(query);
    });
  }, [cutscenes, search]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof cutscenes>();
    for (const cutscene of filtered) {
      const key = cutscene.folder?.trim() || "(Ungrouped)";
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(cutscene);
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
    if (cutscenes.some((cutscene) => cutscene.id === id)) return;
    addCutscene(createDefaultCutscene(id, name));
    setNewName("");
    navigate(`/cutscenes/${id}`);
  };

  return (
    <PageShell title="Cutscenes">
      <section className="editor-section">
        <p className="section-desc">
          Author narrative scene sequences with full-screen text steps, dialogue handoffs, and start/exit actions.
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
              <th>ID</th>
              <th>Name</th>
              <th>Start Step</th>
              <th>Steps</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {groups.map(([folderName, groupCutscenes]) => {
              const collapsed = collapsedFolders.has(folderName);
              return (
                <React.Fragment key={folderName}>
                  <tr>
                    <td colSpan={5} style={{ padding: 0 }}>
                      <div className="folder-header" onClick={() => toggleFolder(folderName)}>
                        <span className={`folder-chevron${collapsed ? "" : " folder-chevron--open"}`}>▶</span>
                        {folderName}
                        <span className="folder-count">({groupCutscenes.length})</span>
                      </div>
                    </td>
                  </tr>
                  {!collapsed && groupCutscenes.map((cutscene) => (
                    <tr key={cutscene.id}>
                      <td className="cell-id">{cutscene.id}</td>
                      <td>
                        <button className="link-btn" onClick={() => navigate(`/cutscenes/${cutscene.id}`)}>
                          {cutscene.name}
                        </button>
                      </td>
                      <td>{cutscene.startStepId}</td>
                      <td>{cutscene.steps.length}</td>
                      <td>
                        <button className="btn btn--danger btn--sm" onClick={() => removeCutscene(cutscene.id)}>
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
            placeholder="New cutscene name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="input"
          />
          <button className="btn btn--primary" onClick={handleAdd}>
            Add Cutscene
          </button>
        </div>
      </section>
    </PageShell>
  );
}
