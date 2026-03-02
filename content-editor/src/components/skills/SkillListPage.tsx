import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "../layout/PageShell";
import { useSkillStore, createDefaultSkill } from "../../stores/skillStore";

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export function SkillListPage() {
  const { skills, addSkill, removeSkill } = useSkillStore();
  const navigate = useNavigate();
  const [newName, setNewName] = useState("");
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | "passive" | "active">("all");
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    return skills.filter((sk) => {
      if (search) {
        const q = search.toLowerCase();
        if (!sk.name.toLowerCase().includes(q) && !sk.id.toLowerCase().includes(q)) return false;
      }
      if (kindFilter !== "all" && sk.kind !== kindFilter) return false;
      return true;
    });
  }, [skills, search, kindFilter]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof skills>();
    for (const sk of filtered) {
      const key = sk.folder?.trim() || "(Ungrouped)";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(sk);
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
    if (skills.some((s) => s.id === id)) return;
    addSkill(createDefaultSkill(id, name));
    setNewName("");
    navigate(`/skills/${id}`);
  };

  return (
    <PageShell title="Skills">
      <section className="editor-section">
        <p className="section-desc">
          Define passive and active skill templates with XP curves and unlock conditions.
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
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as typeof kindFilter)}
          >
            <option value="all">Kind: All</option>
            <option value="passive">Passive</option>
            <option value="active">Active</option>
          </select>
        </div>
        <table className="editor-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Kind</th>
              <th>Tags</th>
              <th>Unlock Condition</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {groups.map(([folderName, groupSkills]) => {
              const collapsed = collapsedFolders.has(folderName);
              return (
                <React.Fragment key={folderName}>
                  <tr>
                    <td colSpan={6} style={{ padding: 0 }}>
                      <div className="folder-header" onClick={() => toggleFolder(folderName)}>
                        <span className={`folder-chevron${collapsed ? "" : " folder-chevron--open"}`}>▶</span>
                        {folderName}
                        <span className="folder-count">({groupSkills.length})</span>
                      </div>
                    </td>
                  </tr>
                  {!collapsed && groupSkills.map((skill) => (
                    <tr key={skill.id}>
                      <td className="cell-id">{skill.id}</td>
                      <td>
                        <button className="link-btn" onClick={() => navigate(`/skills/${skill.id}`)}>
                          {skill.name}
                        </button>
                      </td>
                      <td>
                        <span className={`kind-badge kind-badge--${skill.kind}`}>
                          {skill.kind}
                        </span>
                      </td>
                      <td>{skill.activityTags.join(", ") || "—"}</td>
                      <td className="cell-id">{skill.unlockCondition || "—"}</td>
                      <td>
                        <button className="btn btn--danger btn--sm" onClick={() => removeSkill(skill.id)}>
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
            placeholder="New skill name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="input"
          />
          <button className="btn btn--primary" onClick={handleAdd}>
            Add Skill
          </button>
        </div>
      </section>
    </PageShell>
  );
}
