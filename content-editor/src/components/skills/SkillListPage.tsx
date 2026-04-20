import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "../layout/PageShell";
import { createDefaultSkill, useSkillStore } from "../../stores/skillStore";
import type { SkillTemplate } from "../../schema/types";

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function makeUniqueId(base: string, existing: Set<string>): string {
  if (!existing.has(base)) {
    return base;
  }
  let index = 2;
  while (existing.has(`${base}_${index}`)) {
    index += 1;
  }
  return `${base}_${index}`;
}

type SkillStatusFilter = "all" | "attention" | "ready";

interface SkillDiagnostics {
  issueCount: number;
}

function analyzeSkill(skill: SkillTemplate): SkillDiagnostics {
  const missingDescription = !skill.description.trim();
  const missingActivityTags = skill.activityTags.length === 0;
  const missingCombatPayload =
    skill.kind === "active" &&
    skill.system === "combat" &&
    (skill.effects?.length ?? 0) === 0 &&
    !skill.bioboardPrimaryText?.trim();
  const missingPassiveLink =
    skill.kind === "active" &&
    (skill.system ?? "gathering") === "gathering" &&
    !skill.linkedPassiveId;

  return {
    issueCount:
      Number(missingDescription) +
      Number(missingActivityTags) +
      Number(missingCombatPayload) +
      Number(missingPassiveLink),
  };
}

function duplicateSkill(source: SkillTemplate, skills: SkillTemplate[]): SkillTemplate {
  const existingIds = new Set(skills.map((skill) => skill.id));
  const nextId = makeUniqueId(`${source.id}_copy`, existingIds);
  return {
    ...source,
    id: nextId,
    name: `${source.name} Copy`,
  };
}

export function SkillListPage() {
  const { skills, addSkill, removeSkill } = useSkillStore();
  const navigate = useNavigate();
  const [newName, setNewName] = useState("");
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | "passive" | "active">("all");
  const [statusFilter, setStatusFilter] = useState<SkillStatusFilter>("all");
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());

  const skillRows = useMemo(
    () =>
      skills.map((skill) => ({
        skill,
        diagnostics: analyzeSkill(skill),
      })),
    [skills]
  );

  const filtered = useMemo(() => {
    return skillRows.filter(({ skill, diagnostics }) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        skill.name.toLowerCase().includes(q) ||
        skill.id.toLowerCase().includes(q) ||
        (skill.folder ?? "").toLowerCase().includes(q);

      if (!matchesSearch) {
        return false;
      }
      if (kindFilter !== "all" && skill.kind !== kindFilter) {
        return false;
      }
      if (statusFilter === "attention") {
        return diagnostics.issueCount > 0;
      }
      if (statusFilter === "ready") {
        return diagnostics.issueCount === 0;
      }
      return true;
    });
  }, [kindFilter, search, skillRows, statusFilter]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const row of filtered) {
      const key = row.skill.folder?.trim() || "(Ungrouped)";
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(row);
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
    if (skills.some((skill) => skill.id === id)) return;
    addSkill(createDefaultSkill(id, name));
    setNewName("");
    navigate(`/skills/${id}`);
  };

  const handleDuplicate = (skill: SkillTemplate) => {
    const duplicate = duplicateSkill(skill, skills);
    addSkill(duplicate);
    navigate(`/skills/${duplicate.id}`);
  };

  return (
    <PageShell title="Skills">
      <section className="editor-section">
        <p className="section-desc">
          Define passive and active skill templates with XP curves, unlock conditions, and gathering or combat behavior.
        </p>
        <div className="filter-bar">
          <input
            className="input"
            placeholder="Search name, ID, or folder..."
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
          <select
            className="input select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as SkillStatusFilter)}
          >
            <option value="all">Status: All</option>
            <option value="attention">Needs Attention</option>
            <option value="ready">Ready</option>
          </select>
        </div>
        <table className="editor-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Kind</th>
              <th>System</th>
              <th>Tags</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {groups.map(([folderName, groupSkills]) => {
              const collapsed = collapsedFolders.has(folderName);
              return (
                <React.Fragment key={folderName}>
                  <tr>
                    <td colSpan={7} style={{ padding: 0 }}>
                      <div className="folder-header" onClick={() => toggleFolder(folderName)}>
                        <span className={`folder-chevron${collapsed ? "" : " folder-chevron--open"}`}>{">"}</span>
                        {folderName}
                        <span className="folder-count">({groupSkills.length})</span>
                      </div>
                    </td>
                  </tr>
                  {!collapsed &&
                    groupSkills
                      .slice()
                      .sort((a, b) => a.skill.name.localeCompare(b.skill.name))
                      .map(({ skill, diagnostics }) => (
                        <tr key={skill.id}>
                          <td className="cell-id">{skill.id}</td>
                          <td>
                            <button className="link-btn" onClick={() => navigate(`/skills/${skill.id}`)}>
                              {skill.name}
                            </button>
                          </td>
                          <td>
                            <span className={`kind-badge kind-badge--${skill.kind}`}>{skill.kind}</span>
                          </td>
                          <td>{skill.system || "gathering"}</td>
                          <td>{skill.activityTags.join(", ") || "-"}</td>
                          <td>
                            {diagnostics.issueCount === 0 ? (
                              <span className="editor-badge editor-badge--ok">Ready</span>
                            ) : (
                              <span className="editor-badge editor-badge--warn">
                                {diagnostics.issueCount} issue{diagnostics.issueCount === 1 ? "" : "s"}
                              </span>
                            )}
                          </td>
                          <td>
                            <div className="entity-row-actions">
                              <button className="btn btn--sm" onClick={() => handleDuplicate(skill)}>
                                Duplicate
                              </button>
                              <button className="btn btn--danger btn--sm" onClick={() => removeSkill(skill.id)}>
                                Remove
                              </button>
                            </div>
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
