import { useSkillStore } from "../../stores/skillStore";
import { useInteractableStore } from "../../stores/interactableStore";
import type { InteractableAbility } from "../../schema/types";
import { ReferencePicker } from "../shared/ReferencePicker";

interface Props {
  activityTag?: string;
  abilityBehaviorMode?: "priority" | "sequence";
  abilities: InteractableAbility[];
  onChange: (abilities: InteractableAbility[]) => void;
}

function defaultAbility(): InteractableAbility {
  return {
    cooldownMs: 10000,
    resistChancePerLevel: 5,
  };
}

export function AbilitiesPanel({ activityTag, abilityBehaviorMode, abilities, onChange }: Props) {
  const { skills } = useSkillStore();
  const { interactables } = useInteractableStore();
  const passiveSkills = skills.filter((s) => s.kind === "passive");
  const interactableSkillOptions = skills
    .filter((skill) => skill.kind === "active" && skill.usableByInteractables)
    .map((skill) => ({
      id: skill.id,
      label: skill.name,
      meta: `${skill.system || "gathering"}${skill.combatSchool ? ` • ${skill.combatSchool}` : ""} • ${Math.round(skill.baseDurationMs / 100) / 10}s`,
      description: skill.bioboardPrimaryText || skill.description || undefined,
    }));
  const interactableOptions = interactables.map((entry) => ({
    id: entry.id,
    label: entry.name,
    meta: entry.activityTag || "interactable",
    description: entry.description || undefined,
  }));
  const targetModeOptions =
    activityTag === "friendly"
      ? [
          { value: "selected_enemy", label: "Selected Enemy" },
          { value: "random_enemy", label: "Random Enemy" },
          { value: "lowest_hp_enemy", label: "Lowest HP Enemy" },
          { value: "highest_hp_enemy", label: "Highest HP Enemy" },
          { value: "specific_interactable", label: "Specific Interactable" },
        ]
      : [
          { value: "player", label: "Player" },
          { value: "friendly_or_player", label: "Friendly or Player" },
          { value: "random_friendly", label: "Random Friendly" },
          { value: "lowest_hp_friendly", label: "Lowest HP Friendly" },
          { value: "highest_hp_friendly", label: "Highest HP Friendly" },
          { value: "specific_interactable", label: "Specific Interactable" },
        ];

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
        {activityTag === "friendly"
          ? "Abilities the interactable can use against hostile interactables."
          : "Abilities the interactable can use against the player."} Prefer linking to
        real authored skills so the interactable uses the same effect logic as the
        skills system. Legacy direct abilities are still supported for simple cases.
        {abilityBehaviorMode === "sequence"
          ? " Sequence mode will cast these in list order and loop."
          : " Priority mode will cast the first ready ability in the list."}
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
            <div className="form-field form-field--wide">
              <label className="field-label">Linked Skill</label>
              <ReferencePicker
                value={ab.skillId || ""}
                options={interactableSkillOptions}
                onChange={(value) =>
                  update(idx, {
                    skillId: value || undefined,
                    ...(value ? { damage: undefined } : {}),
                  })
                }
                placeholder="Use legacy custom ability"
                noneLabel="Legacy custom ability"
                showSelectedPreview
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
              <label className="field-label">Target</label>
              <select
                className="input select"
                value={ab.targetMode || (activityTag === "friendly" ? "selected_enemy" : "player")}
                onChange={(e) =>
                  update(idx, {
                    targetMode: e.target.value as InteractableAbility["targetMode"],
                    targetInteractableId:
                      e.target.value === "specific_interactable" ? ab.targetInteractableId : undefined,
                  })
                }
              >
                {targetModeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            {ab.targetMode === "specific_interactable" && (
              <div className="form-field form-field--wide">
                <label className="field-label">Specific Target</label>
                <ReferencePicker
                  value={ab.targetInteractableId || ""}
                  options={interactableOptions}
                  onChange={(value) => update(idx, { targetInteractableId: value || undefined })}
                  placeholder="Choose interactable target"
                  noneLabel="No target"
                  showSelectedPreview
                />
              </div>
            )}
            {ab.skillId ? (
              <>
                <div className="form-field">
                  <label className="field-label">Cast Time</label>
                  <input
                    className="input"
                    value={`${Math.round(((skills.find((skill) => skill.id === ab.skillId)?.baseDurationMs ?? 0) / 100)) / 10}s`}
                    disabled
                  />
                </div>
              </>
            ) : (
              <>
                <div className="form-field">
                  <label className="field-label">Name</label>
                  <input
                    className="input"
                    value={ab.name || ""}
                    onChange={(e) => update(idx, { name: e.target.value })}
                    placeholder="e.g. Root Strike"
                  />
                </div>
                <div className="form-field form-field--wide">
                  <label className="field-label">Effect Description</label>
                  <input
                    className="input"
                    value={ab.effect || ""}
                    onChange={(e) => update(idx, { effect: e.target.value })}
                    placeholder="What does this ability do?"
                  />
                </div>
                <div className="form-field">
                  <label className="field-label">Cast Time (ms)</label>
                  <input
                    type="number"
                    className="input"
                    value={ab.castTimeMs ?? 3000}
                    onChange={(e) =>
                      update(idx, { castTimeMs: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="form-field">
                  <label className="field-label">Damage</label>
                  <input
                    type="number"
                    className="input"
                    value={ab.damage ?? 1}
                    onChange={(e) =>
                      update(idx, { damage: Number(e.target.value) })
                    }
                  />
                </div>
              </>
            )}
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
