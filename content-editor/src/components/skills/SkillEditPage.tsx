import { useParams, useNavigate } from "react-router-dom";
import { PageShell } from "../layout/PageShell";
import { useSkillStore } from "../../stores/skillStore";
import { useTagStore } from "../../stores/tagStore";
import { TagPicker } from "../shared/TagPicker";
import { ColorPicker } from "../shared/ColorPicker";
import { EntitySelect } from "../shared/EntitySelect";
import { ConditionEditor } from "../shared/ConditionEditor";

export function SkillEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { skills, updateSkill } = useSkillStore();
  const { activityTags, abilityTags } = useTagStore();
  const skill = skills.find((s) => s.id === id);

  if (!skill) {
    return (
      <PageShell title="Skill Not Found">
        <p>No skill with id "{id}".</p>
        <button className="btn" onClick={() => navigate("/skills")}>
          Back to Skills
        </button>
      </PageShell>
    );
  }

  const passiveSkills = skills.filter((s) => s.kind === "passive");

  return (
    <PageShell
      title={skill.name}
      actions={
        <button className="btn" onClick={() => navigate("/skills")}>
          Back to Skills
        </button>
      }
    >
      <section className="editor-section">
        <h3 className="section-title">Basic Properties</h3>
        <div className="form-grid">
          <div className="form-field">
            <label className="field-label">ID</label>
            <input className="input" value={skill.id} disabled />
          </div>
          <div className="form-field">
            <label className="field-label">Name</label>
            <input
              className="input"
              value={skill.name}
              onChange={(e) => updateSkill(skill.id, { name: e.target.value })}
            />
          </div>
          <div className="form-field">
            <label className="field-label">Kind</label>
            <select
              className="input select"
              value={skill.kind}
              onChange={(e) =>
                updateSkill(skill.id, { kind: e.target.value as "passive" | "active" })
              }
            >
              <option value="passive">Passive</option>
              <option value="active">Active</option>
            </select>
          </div>
          <div className="form-field form-field--wide">
            <label className="field-label">Description</label>
            <input
              className="input"
              value={skill.description}
              onChange={(e) => updateSkill(skill.id, { description: e.target.value })}
              placeholder="Skill description..."
            />
          </div>
        </div>
      </section>

      <section className="editor-section">
        <h3 className="section-title">Tags</h3>
        <TagPicker
          label="Activity Tags"
          tags={activityTags}
          selected={skill.activityTags}
          onChange={(tags) => updateSkill(skill.id, { activityTags: tags })}
        />
        <div style={{ height: 12 }} />
        <TagPicker
          label="Ability Tags"
          tags={abilityTags}
          selected={skill.abilityTags}
          onChange={(tags) => updateSkill(skill.id, { abilityTags: tags })}
        />
      </section>

      {skill.kind === "active" && (
        <section className="editor-section">
          <h3 className="section-title">Active Skill Settings</h3>
          <div className="form-grid">
            <div className="form-field">
              <EntitySelect
                label="Linked Passive"
                entities={passiveSkills.map((s) => ({ id: s.id, name: s.name }))}
                value={skill.linkedPassiveId || ""}
                onChange={(v) => updateSkill(skill.id, { linkedPassiveId: v || undefined })}
                placeholder="No linked passive"
              />
            </div>
            <div className="form-field">
              <label className="field-label">Cast Duration (ms)</label>
              <input
                type="number"
                className="input"
                value={skill.baseDurationMs}
                onChange={(e) =>
                  updateSkill(skill.id, { baseDurationMs: Number(e.target.value) })
                }
              />
            </div>
            <div className="form-field">
              <label className="field-label">Energy Cost</label>
              <input
                type="number"
                className="input"
                value={skill.baseEnergyCost}
                onChange={(e) =>
                  updateSkill(skill.id, { baseEnergyCost: Number(e.target.value) })
                }
              />
            </div>
            <div className="form-field">
              <label className="field-label">Base Power</label>
              <input
                type="number"
                className="input"
                value={skill.basePower}
                onChange={(e) =>
                  updateSkill(skill.id, { basePower: Number(e.target.value) })
                }
              />
            </div>
            <div className="form-field">
              <label className="field-label">Power per Level</label>
              <input
                type="number"
                className="input"
                value={skill.powerPerLevel}
                onChange={(e) =>
                  updateSkill(skill.id, { powerPerLevel: Number(e.target.value) })
                }
              />
            </div>
          </div>
        </section>
      )}

      <section className="editor-section">
        <h3 className="section-title">XP Curve</h3>
        <div className="form-grid">
          <div className="form-field">
            <label className="field-label">Base XP to Next Level</label>
            <input
              type="number"
              className="input"
              value={skill.baseXpToNext}
              onChange={(e) =>
                updateSkill(skill.id, { baseXpToNext: Number(e.target.value) })
              }
            />
          </div>
          <div className="form-field">
            <label className="field-label">XP Scaling (per level)</label>
            <input
              type="number"
              className="input"
              step="0.01"
              value={skill.xpScaling}
              onChange={(e) =>
                updateSkill(skill.id, { xpScaling: Number(e.target.value) })
              }
            />
          </div>
        </div>
      </section>

      <section className="editor-section">
        <h3 className="section-title">Appearance</h3>
        <div className="form-grid">
          <div className="form-field">
            <ColorPicker
              label="Bar Color"
              value={skill.barColor}
              onChange={(v) => updateSkill(skill.id, { barColor: v })}
            />
          </div>
          <div className="form-field">
            <ColorPicker
              label="Accent Color"
              value={skill.accentColor}
              onChange={(v) => updateSkill(skill.id, { accentColor: v })}
            />
          </div>
        </div>
      </section>

      <section className="editor-section">
        <h3 className="section-title">Unlock Condition</h3>
        <p className="section-desc">
          DSL expression that must be true for this skill to unlock. Leave empty for always
          unlocked.
        </p>
        <ConditionEditor
          value={skill.unlockCondition || ""}
          onChange={(v) =>
            updateSkill(skill.id, { unlockCondition: v || undefined })
          }
          placeholder='e.g. skill("treecutting").level >= 3'
        />
      </section>
    </PageShell>
  );
}
