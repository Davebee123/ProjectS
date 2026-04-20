import { createDefaultInteractable, useInteractableStore } from "../../stores/interactableStore";
import { ConditionEditor } from "../shared/ConditionEditor";
import { ReferencePicker } from "../shared/ReferencePicker";
import type { SpawnTableEntry } from "../../schema/types";
import { createUniqueId } from "../../utils/ids";

interface Props {
  entries: SpawnTableEntry[];
  onChange: (entries: SpawnTableEntry[]) => void;
}

let _stId = 0;
function nextStId() {
  return `st_${Date.now()}_${_stId++}`;
}

export function SpawnTablePanel({ entries, onChange }: Props) {
  const { interactables, addInteractable } = useInteractableStore();
  const interactableOptions = interactables.map((interactable) => ({
    id: interactable.id,
    label: interactable.name,
    meta: `${interactable.activityTag || "no activity"} • Level ${interactable.requiredLevel}`,
  }));

  const createAndLinkInteractable = (name: string) => {
    const id = createUniqueId(name, interactables.map((interactable) => interactable.id));
    addInteractable(createDefaultInteractable(id, name));
    return id;
  };

  const add = () => {
    onChange([
      ...entries,
      {
        id: nextStId(),
        interactableId: "",
        spawnChance: 100,
        minCount: 1,
        maxCount: 1,
        neverRespawnAfterDefeat: false,
      },
    ]);
  };

  const update = (idx: number, patch: Partial<SpawnTableEntry>) => {
    const updated = [...entries];
    updated[idx] = { ...updated[idx], ...patch };
    onChange(updated);
  };

  const remove = (idx: number) => onChange(entries.filter((_, i) => i !== idx));

  return (
    <section className="editor-section">
      <h3 className="section-title">Spawn Table</h3>
      <p className="section-desc">
        Interactables that can spawn when the player Explores this room. Each
        entry is rolled independently — spawn chance determines if it appears,
        then count is randomized within min/max.
      </p>

      {entries.map((entry, idx) => (
        <div key={entry.id} className="hook-card">
          <div className="hook-header">
            <ReferencePicker
              value={entry.interactableId}
              options={interactableOptions}
              compact
              showSelectedPreview={false}
              placeholder="Select interactable..."
              onChange={(value) => update(idx, { interactableId: value })}
              onCreate={createAndLinkInteractable}
              createPlaceholder="New interactable name..."
            />
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
              <label className="field-label">Spawn Chance (%)</label>
              <input
                type="number"
                className="input"
                min={0}
                max={100}
                value={entry.spawnChance}
                onChange={(e) =>
                  update(idx, { spawnChance: Number(e.target.value) })
                }
              />
            </div>
            <div className="form-field">
              <label className="field-label">Min Count</label>
              <input
                type="number"
                className="input"
                min={0}
                value={entry.minCount}
                onChange={(e) =>
                  update(idx, { minCount: Number(e.target.value) })
                }
              />
            </div>
            <div className="form-field">
              <label className="field-label">Max Count</label>
              <input
                type="number"
                className="input"
                min={0}
                value={entry.maxCount}
                onChange={(e) =>
                  update(idx, { maxCount: Number(e.target.value) })
                }
              />
            </div>
            <div className="form-field">
              <label className="field-label">Persistence</label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={entry.neverRespawnAfterDefeat === true}
                  onChange={(e) =>
                    update(idx, { neverRespawnAfterDefeat: e.target.checked || undefined })
                  }
                />
                <span>Never respawn after defeat</span>
              </label>
            </div>
            <div className="form-field form-field--wide">
              <label className="field-label">Condition (optional)</label>
              <ConditionEditor
                value={entry.condition || ""}
                onChange={(v) =>
                  update(idx, { condition: v || undefined })
                }
                placeholder="Optional spawn condition..."
              />
            </div>
          </div>
        </div>
      ))}

      <button className="btn btn--primary" onClick={add}>
        + Add Spawn Entry
      </button>
    </section>
  );
}
