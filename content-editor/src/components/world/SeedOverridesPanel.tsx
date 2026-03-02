import { ConditionEditor } from "../shared/ConditionEditor";
import type { SeedOverride } from "../../schema/types";

interface Props {
  overrides: SeedOverride[];
  onChange: (overrides: SeedOverride[]) => void;
}

export function SeedOverridesPanel({ overrides, onChange }: Props) {
  const add = () => {
    onChange([
      ...overrides,
      { condition: "", seed: 0, priority: overrides.length },
    ]);
  };

  const update = (idx: number, patch: Partial<SeedOverride>) => {
    const updated = [...overrides];
    updated[idx] = { ...updated[idx], ...patch };
    onChange(updated);
  };

  const remove = (idx: number) =>
    onChange(overrides.filter((_, i) => i !== idx));

  return (
    <section className="editor-section">
      <h3 className="section-title">Seed Overrides</h3>
      <p className="section-desc">
        Override the procedural seed when conditions are met. Higher priority
        overrides are checked first. Use this to create hand-crafted or
        event-driven room layouts.
      </p>

      {overrides.map((ov, idx) => (
        <div key={idx} className="hook-card">
          <div className="hook-header">
            <strong style={{ fontSize: 13 }}>Override #{idx + 1}</strong>
            <span style={{ flex: 1 }} />
            <button
              className="btn btn--danger btn--sm"
              onClick={() => remove(idx)}
            >
              Remove
            </button>
          </div>
          <div className="form-grid">
            <div className="form-field form-field--wide">
              <label className="field-label">Condition</label>
              <ConditionEditor
                value={ov.condition}
                onChange={(v) => update(idx, { condition: v })}
                placeholder='e.g. player.flag("pressed_red_button")'
              />
            </div>
            <div className="form-field">
              <label className="field-label">Seed Value</label>
              <input
                className="input"
                value={String(ov.seed)}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  update(idx, {
                    seed: isNaN(n) ? e.target.value : n,
                  });
                }}
                placeholder="Fixed number or storage key ID"
              />
            </div>
            <div className="form-field">
              <label className="field-label">Priority</label>
              <input
                type="number"
                className="input"
                value={ov.priority}
                onChange={(e) =>
                  update(idx, { priority: Number(e.target.value) })
                }
              />
            </div>
          </div>
        </div>
      ))}

      <button className="btn btn--sm" onClick={add}>
        + Add Seed Override
      </button>
    </section>
  );
}
