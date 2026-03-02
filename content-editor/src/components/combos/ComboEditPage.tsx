import { useParams, useNavigate } from "react-router-dom";
import { PageShell } from "../layout/PageShell";
import { useComboStore } from "../../stores/comboStore";
import { useSkillStore } from "../../stores/skillStore";
import { useTagStore } from "../../stores/tagStore";

export function ComboEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { combos, updateCombo } = useComboStore();
  const { skills } = useSkillStore();
  const { activityTags } = useTagStore();
  const combo = combos.find((c) => c.id === id);

  const activeSkills = skills.filter((s) => s.kind === "active");

  if (!combo) {
    return (
      <PageShell title="Combo Not Found">
        <p>No combo with id "{id}".</p>
        <button className="btn" onClick={() => navigate("/combos")}>
          Back to Combos
        </button>
      </PageShell>
    );
  }

  const update = (patch: Partial<typeof combo>) =>
    updateCombo(combo.id, patch);

  // Check for conflicts: another combo with the same from→to on the same tag
  const conflicts = combos.filter(
    (c) =>
      c.id !== combo.id &&
      c.fromSkillId === combo.fromSkillId &&
      c.toSkillId === combo.toSkillId &&
      c.activityTag === combo.activityTag &&
      c.fromSkillId !== "" &&
      c.toSkillId !== ""
  );

  return (
    <PageShell
      title={combo.label || combo.id}
      actions={
        <button className="btn" onClick={() => navigate("/combos")}>
          Back to Combos
        </button>
      }
    >
      <section className="editor-section">
        <h3 className="section-title">Combo Properties</h3>
        <div className="form-grid">
          <div className="form-field">
            <label className="field-label">ID</label>
            <input className="input" value={combo.id} disabled />
          </div>
          <div className="form-field">
            <label className="field-label">Label</label>
            <input
              className="input"
              value={combo.label}
              onChange={(e) => update({ label: e.target.value })}
              placeholder="e.g. Double Chop"
            />
          </div>
          <div className="form-field">
            <label className="field-label">Folder</label>
            <input
              className="input"
              value={combo.folder || ""}
              onChange={(e) => update({ folder: e.target.value || undefined })}
              placeholder="e.g. Combat, Utility..."
            />
          </div>
        </div>
      </section>

      <section className="editor-section">
        <h3 className="section-title">Chain</h3>
        <p className="section-desc">
          The "from" skill must be used first, then the "to" skill within the
          window to trigger the combo bonus.
        </p>
        <div className="form-grid">
          <div className="form-field">
            <label className="field-label">From Skill</label>
            <select
              className="input select"
              value={combo.fromSkillId}
              onChange={(e) => update({ fromSkillId: e.target.value })}
            >
              <option value="">-- Select --</option>
              {activeSkills.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 24, color: "var(--text-muted)" }}>→</span>
          </div>
          <div className="form-field">
            <label className="field-label">To Skill</label>
            <select
              className="input select"
              value={combo.toSkillId}
              onChange={(e) => update({ toSkillId: e.target.value })}
            >
              <option value="">-- Select --</option>
              {activeSkills.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-grid" style={{ marginTop: 16 }}>
          <div className="form-field">
            <label className="field-label">Activity Tag</label>
            <select
              className="input select"
              value={combo.activityTag}
              onChange={(e) => update({ activityTag: e.target.value })}
            >
              <option value="">Any activity</option>
              {activityTags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label || t.id}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label className="field-label">Window (ms)</label>
            <input
              type="number"
              className="input"
              value={combo.windowMs}
              onChange={(e) =>
                update({ windowMs: Number(e.target.value) })
              }
            />
          </div>
        </div>

        {conflicts.length > 0 && (
          <div className="validation-warning" style={{ marginTop: 12 }}>
            ⚠ Conflict: {conflicts.length} other combo(s) share the same
            from→to→tag chain: {conflicts.map((c) => c.label || c.id).join(", ")}
          </div>
        )}
      </section>

      <section className="editor-section">
        <h3 className="section-title">Bonuses</h3>
        <p className="section-desc">
          Multipliers applied when the combo triggers. Values below 1.0 reduce
          cost/time (good), above 1.0 increase them.
        </p>
        <div className="form-grid">
          <div className="form-field">
            <label className="field-label">Time Multiplier</label>
            <input
              type="number"
              className="input"
              step="0.05"
              value={combo.timeMultiplier}
              onChange={(e) =>
                update({ timeMultiplier: Number(e.target.value) })
              }
            />
          </div>
          <div className="form-field">
            <label className="field-label">Energy Multiplier</label>
            <input
              type="number"
              className="input"
              step="0.05"
              value={combo.energyMultiplier}
              onChange={(e) =>
                update({ energyMultiplier: Number(e.target.value) })
              }
            />
          </div>
        </div>
      </section>
    </PageShell>
  );
}
