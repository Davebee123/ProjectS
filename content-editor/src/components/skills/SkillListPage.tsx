import { useState } from "react";
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
            {skills.map((skill) => (
              <tr key={skill.id}>
                <td className="cell-id">{skill.id}</td>
                <td>
                  <button
                    className="link-btn"
                    onClick={() => navigate(`/skills/${skill.id}`)}
                  >
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
                  <button
                    className="btn btn--danger btn--sm"
                    onClick={() => removeSkill(skill.id)}
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
