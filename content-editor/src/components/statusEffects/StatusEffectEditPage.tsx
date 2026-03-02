import { useParams, useNavigate } from "react-router-dom";
import { PageShell } from "../layout/PageShell";
import { useStatusEffectStore } from "../../stores/statusEffectStore";
import { ColorPicker } from "../shared/ColorPicker";
import { ConditionEditor } from "../shared/ConditionEditor";
import type { StatusRemovalType, StatModifier } from "../../schema/types";

const REMOVAL_OPTIONS: { value: StatusRemovalType; label: string }[] = [
  { value: "timed", label: "Timed (expires after duration)" },
  { value: "conditional", label: "Conditional (removed when condition met)" },
  { value: "both", label: "Both (whichever happens first)" },
];

const STAT_OPTIONS = [
  "attack",
  "defense",
  "energyRegen",
  "activityPowerMultiplier",
  "speedMultiplier",
  "energyCostMultiplier",
  "maxEnergy",
  "basePower",
];

export function StatusEffectEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { statusEffects, updateStatusEffect } = useStatusEffectStore();
  const fx = statusEffects.find((e) => e.id === id);

  if (!fx) {
    return (
      <PageShell title="Status Effect Not Found">
        <p>No status effect with id "{id}".</p>
        <button className="btn" onClick={() => navigate("/status-effects")}>
          Back to Status Effects
        </button>
      </PageShell>
    );
  }

  const addModifier = () => {
    updateStatusEffect(fx.id, {
      statModifiers: [
        ...fx.statModifiers,
        { stat: "attack", operation: "add", value: 0 },
      ],
    });
  };

  const updateModifier = (idx: number, patch: Partial<StatModifier>) => {
    const mods = [...fx.statModifiers];
    mods[idx] = { ...mods[idx], ...patch };
    updateStatusEffect(fx.id, { statModifiers: mods });
  };

  const removeModifier = (idx: number) => {
    updateStatusEffect(fx.id, {
      statModifiers: fx.statModifiers.filter((_, i) => i !== idx),
    });
  };

  return (
    <PageShell
      title={fx.name}
      actions={
        <button className="btn" onClick={() => navigate("/status-effects")}>
          Back to Status Effects
        </button>
      }
    >
      <section className="editor-section">
        <h3 className="section-title">Basic Properties</h3>
        <div className="form-grid">
          <div className="form-field">
            <label className="field-label">ID</label>
            <input className="input" value={fx.id} disabled />
          </div>
          <div className="form-field">
            <label className="field-label">Name</label>
            <input
              className="input"
              value={fx.name}
              onChange={(e) => updateStatusEffect(fx.id, { name: e.target.value })}
            />
          </div>
          <div className="form-field form-field--wide">
            <label className="field-label">Description</label>
            <input
              className="input"
              value={fx.description}
              onChange={(e) =>
                updateStatusEffect(fx.id, { description: e.target.value })
              }
              placeholder="What this effect does..."
            />
          </div>
          <div className="form-field">
            <ColorPicker
              label="Color"
              value={fx.color}
              onChange={(v) => updateStatusEffect(fx.id, { color: v })}
            />
          </div>
          <div className="form-field">
            <label className="field-label">Folder</label>
            <input
              className="input"
              value={fx.folder || ""}
              onChange={(e) =>
                updateStatusEffect(fx.id, { folder: e.target.value || undefined })
              }
              placeholder="e.g. Buffs, Debuffs..."
            />
          </div>
        </div>
      </section>

      <section className="editor-section">
        <h3 className="section-title">Removal</h3>
        <div className="form-grid">
          <div className="form-field">
            <label className="field-label">Removal Type</label>
            <select
              className="input select"
              value={fx.removalType}
              onChange={(e) =>
                updateStatusEffect(fx.id, {
                  removalType: e.target.value as StatusRemovalType,
                })
              }
            >
              {REMOVAL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          {(fx.removalType === "timed" || fx.removalType === "both") && (
            <div className="form-field">
              <label className="field-label">Duration (ms)</label>
              <input
                type="number"
                className="input"
                value={fx.durationMs ?? 10000}
                onChange={(e) =>
                  updateStatusEffect(fx.id, { durationMs: Number(e.target.value) })
                }
              />
            </div>
          )}
          {(fx.removalType === "conditional" || fx.removalType === "both") && (
            <div className="form-field form-field--wide">
              <label className="field-label">Remove Condition (DSL)</label>
              <ConditionEditor
                value={fx.removeCondition || ""}
                onChange={(v) =>
                  updateStatusEffect(fx.id, {
                    removeCondition: v || undefined,
                  })
                }
                placeholder='e.g. player.has_item("antidote")'
              />
            </div>
          )}
        </div>
      </section>

      <section className="editor-section">
        <h3 className="section-title">Stacking</h3>
        <div className="form-grid">
          <div className="form-field">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={fx.stackable}
                onChange={(e) =>
                  updateStatusEffect(fx.id, { stackable: e.target.checked })
                }
              />
              Stackable
            </label>
          </div>
          {fx.stackable && (
            <div className="form-field">
              <label className="field-label">Max Stacks</label>
              <input
                type="number"
                className="input"
                min={1}
                value={fx.maxStacks}
                onChange={(e) =>
                  updateStatusEffect(fx.id, { maxStacks: Number(e.target.value) })
                }
              />
            </div>
          )}
        </div>
      </section>

      <section className="editor-section">
        <h3 className="section-title">Stat Modifiers</h3>
        <p className="section-desc">
          How this effect changes player stats while active. "Add" adds a flat
          value; "Multiply" multiplies the stat (1.2 = +20%).
        </p>
        <table className="editor-table">
          <thead>
            <tr>
              <th>Stat</th>
              <th>Operation</th>
              <th>Value</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {fx.statModifiers.map((mod, idx) => (
              <tr key={idx}>
                <td>
                  <select
                    className="input select"
                    value={mod.stat}
                    onChange={(e) => updateModifier(idx, { stat: e.target.value })}
                  >
                    {STAT_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    className="input select"
                    value={mod.operation}
                    onChange={(e) =>
                      updateModifier(idx, {
                        operation: e.target.value as "add" | "multiply",
                      })
                    }
                  >
                    <option value="add">Add (+)</option>
                    <option value="multiply">Multiply (x)</option>
                  </select>
                </td>
                <td>
                  <input
                    type="number"
                    className="input input--sm"
                    step="0.01"
                    value={mod.value}
                    onChange={(e) =>
                      updateModifier(idx, { value: Number(e.target.value) })
                    }
                  />
                </td>
                <td>
                  <button
                    className="btn btn--danger btn--sm"
                    onClick={() => removeModifier(idx)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="btn btn--primary" onClick={addModifier}>
          Add Modifier
        </button>
      </section>
    </PageShell>
  );
}
