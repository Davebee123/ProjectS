import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "../layout/PageShell";
import {
  useStatusEffectStore,
  createDefaultStatusEffect,
} from "../../stores/statusEffectStore";

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export function StatusEffectListPage() {
  const { statusEffects, addStatusEffect, removeStatusEffect } =
    useStatusEffectStore();
  const navigate = useNavigate();
  const [newName, setNewName] = useState("");
  const [search, setSearch] = useState("");
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    return statusEffects.filter((fx) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !fx.name.toLowerCase().includes(q) &&
          !fx.id.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [statusEffects, search]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof statusEffects>();
    for (const fx of filtered) {
      const key = fx.folder?.trim() || "(Ungrouped)";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(fx);
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
    if (statusEffects.some((e) => e.id === id)) return;
    addStatusEffect(createDefaultStatusEffect(id, name));
    setNewName("");
    navigate(`/status-effects/${id}`);
  };

  return (
    <PageShell title="Status Effects">
      <section className="editor-section">
        <p className="section-desc">
          Define buffs and debuffs — timed effects, persistent conditions, or
          both. These can be applied by items, interactables, or abilities.
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
              <th>Removal</th>
              <th>Duration</th>
              <th>Modifiers</th>
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
                      <div
                        className="folder-header"
                        onClick={() => toggleFolder(folderName)}
                      >
                        <span
                          className={`folder-chevron${collapsed ? "" : " folder-chevron--open"}`}
                        >
                          ▶
                        </span>
                        {folderName}
                        <span className="folder-count">
                          ({groupItems.length})
                        </span>
                      </div>
                    </td>
                  </tr>
                  {!collapsed &&
                    groupItems.map((fx) => (
                      <tr key={fx.id}>
                        <td className="cell-id">{fx.id}</td>
                        <td>
                          <button
                            className="link-btn"
                            onClick={() => navigate(`/status-effects/${fx.id}`)}
                          >
                            <span
                              className="fx-dot"
                              style={{ backgroundColor: fx.color }}
                            />
                            {fx.name}
                          </button>
                        </td>
                        <td>
                          <span
                            className={`removal-badge removal-badge--${fx.removalType}`}
                          >
                            {fx.removalType}
                          </span>
                        </td>
                        <td>
                          {fx.durationMs
                            ? `${(fx.durationMs / 1000).toFixed(1)}s`
                            : "—"}
                        </td>
                        <td>{fx.statModifiers.length}</td>
                        <td>
                          <button
                            className="btn btn--danger btn--sm"
                            onClick={() => removeStatusEffect(fx.id)}
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
            placeholder="New status effect name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="input"
          />
          <button className="btn btn--primary" onClick={handleAdd}>
            Add Effect
          </button>
        </div>
      </section>
    </PageShell>
  );
}
