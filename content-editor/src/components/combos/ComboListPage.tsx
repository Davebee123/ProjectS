import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "../layout/PageShell";
import { useComboStore, createDefaultCombo } from "../../stores/comboStore";
import { useSkillStore } from "../../stores/skillStore";

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export function ComboListPage() {
  const { combos, addCombo, removeCombo } = useComboStore();
  const { skills } = useSkillStore();
  const navigate = useNavigate();
  const [newLabel, setNewLabel] = useState("");
  const [search, setSearch] = useState("");
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());

  const skillName = (id: string) =>
    skills.find((s) => s.id === id)?.name || id || "—";

  const filtered = useMemo(() => {
    return combos.filter((c) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !c.label.toLowerCase().includes(q) &&
          !c.id.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [combos, search]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof combos>();
    for (const c of filtered) {
      const key = c.folder?.trim() || "(Ungrouped)";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
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
    const label = newLabel.trim();
    if (!label) return;
    const id = slugify(label);
    if (combos.some((c) => c.id === id)) return;
    const combo = createDefaultCombo(id);
    combo.label = label;
    addCombo(combo);
    setNewLabel("");
    navigate(`/combos/${id}`);
  };

  return (
    <PageShell title="Combos">
      <section className="editor-section">
        <p className="section-desc">
          Define combo chains between active skills. When a player uses the
          "from" skill and then uses the "to" skill within the time window, the
          combo triggers with modified cast time and energy cost.
        </p>
        <div className="filter-bar">
          <input
            className="input"
            placeholder="Search label or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <table className="editor-table">
          <thead>
            <tr>
              <th>Label</th>
              <th>From</th>
              <th>To</th>
              <th>Window</th>
              <th>Time ×</th>
              <th>Energy ×</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {groups.map(([folderName, groupItems]) => {
              const collapsed = collapsedFolders.has(folderName);
              return (
                <React.Fragment key={folderName}>
                  <tr>
                    <td colSpan={7} style={{ padding: 0 }}>
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
                    groupItems.map((combo) => (
                      <tr key={combo.id}>
                        <td>
                          <button
                            className="link-btn"
                            onClick={() => navigate(`/combos/${combo.id}`)}
                          >
                            {combo.label || combo.id}
                          </button>
                        </td>
                        <td>{skillName(combo.fromSkillId)}</td>
                        <td>{skillName(combo.toSkillId)}</td>
                        <td>{combo.windowMs}ms</td>
                        <td>×{combo.timeMultiplier}</td>
                        <td>×{combo.energyMultiplier}</td>
                        <td>
                          <button
                            className="btn btn--danger btn--sm"
                            onClick={() => removeCombo(combo.id)}
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
            placeholder="New combo label..."
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="input"
          />
          <button className="btn btn--primary" onClick={handleAdd}>
            Add Combo
          </button>
        </div>
      </section>
    </PageShell>
  );
}
