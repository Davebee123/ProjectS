import { useSkillStore } from "../../stores/skillStore";
import type { InteractableAbility } from "../../schema/types";

interface Props {
  abilities: InteractableAbility[];
  onChange: (abilities: InteractableAbility[]) => void;
}

function defaultAbility(): InteractableAbility {
  return {
    name: "",
    castTimeMs: 3000,
    cooldownMs: 10000,
    effect: "",
    resistChancePerLevel: 5,
  };
}

export function AbilitiesPanel({ abilities, onChange }: Props) {
  const { skills } = useSkillStore();
  const passiveSkills = skills.filter((s) => s.kind === "passive");

  const add = () => onChange([...abilities, defaultAbility()]);

  const update = (idx: number, patch: Partial<InteractableAbility>) => {
    const updated = [...abilities];
    updated[idx] = { ...updated[idx], ...patch };
    onChange(updated);
  };

  const remove = (idx: number) => onChange(abilities.filter((_, i) => i !== idx));

  return (
    <section className="editor-section">
      <h3 className="section-title">Abilities</h3>
      <p className="section-desc">
        Abilities the interactable can use against the player (e.g. an enemy
        casting spells, a trap triggering). Each ability has a cast time,
        cooldown, and can optionally be resisted by a passive skill.
      </p>

      {abilities.map((ab, idx) => (
        <div key={idx} className="hook-card">
          <div className="hook-header">
            <strong style={{ fontSize: 13 }}>Ability #{idx + 1}</strong>
            <span style={{ flex: 1 }} />
            <button
              className="btn btn--danger btn--sm"
              onClick={() => remove(idx)}
            >
              Remove
            </button>
          </div>

          <div className="form-grid">
            <div className="form-field">
              <label className="field-label">Name</label>
              <input
                className="input"
                value={ab.name}
                onChange={(e) => update(idx, { name: e.target.value })}
                placeholder="e.g. Root Strike"
              />
            </div>
            <div className="form-field form-field--wide">
              <label className="field-label">Effect Description</label>
              <input
                className="input"
                value={ab.effect}
                onChange={(e) => update(idx, { effect: e.target.value })}
                placeholder="What does this ability do?"
              />
            </div>
            <div className="form-field">
              <label className="field-label">Cast Time (ms)</label>
              <input
                type="number"
                className="input"
                value={ab.castTimeMs}
                onChange={(e) =>
                  update(idx, { castTimeMs: Number(e.target.value) })
                }
              />
            </div>
            <div className="form-field">
              <label className="field-label">Cooldown (ms)</label>
              <input
                type="number"
                className="input"
                value={ab.cooldownMs}
                onChange={(e) =>
                  update(idx, { cooldownMs: Number(e.target.value) })
                }
              />
            </div>
            <div className="form-field">
              <label className="field-label">Resisted By (passive skill)</label>
              <select
                className="input select"
                value={ab.resistedByPassiveId || ""}
                onChange={(e) =>
                  update(idx, {
                    resistedByPassiveId: e.target.value || undefined,
                  })
                }
              >
                <option value="">None</option>
                {passiveSkills.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label className="field-label">Resist % per Level</label>
              <input
                type="number"
                className="input"
                step="0.5"
                value={ab.resistChancePerLevel}
                onChange={(e) =>
                  update(idx, {
                    resistChancePerLevel: Number(e.target.value),
                  })
                }
              />
            </div>
          </div>
        </div>
      ))}

      <button className="btn btn--primary" onClick={add}>
        + Add Ability
      </button>
    </section>
  );
}
