import { useInteractableStore } from "../../stores/interactableStore";
import { ConditionEditor } from "../shared/ConditionEditor";
import type { FixedInteractable } from "../../schema/types";

interface Props {
  entries: FixedInteractable[];
  onChange: (entries: FixedInteractable[]) => void;
}

export function FixedInteractablesPanel({ entries, onChange }: Props) {
  const { interactables } = useInteractableStore();

  const add = () => {
    onChange([...entries, { interactableId: "" }]);
  };

  const update = (idx: number, patch: Partial<FixedInteractable>) => {
    const updated = [...entries];
    updated[idx] = { ...updated[idx], ...patch };
    onChange(updated);
  };

  const remove = (idx: number) => onChange(entries.filter((_, i) => i !== idx));

  return (
    <section className="editor-section">
      <h3 className="section-title">Fixed Interactables</h3>
      <p className="section-desc">
        Persistent interactables that always appear in this room (NPCs,
        landmarks, quest objects). They don't roll from the spawn table and
        persist across Explores.
      </p>

      {entries.map((entry, idx) => (
        <div key={idx} className="action-row" style={{ marginBottom: 8 }}>
          <select
            className="input select"
            value={entry.interactableId}
            onChange={(e) =>
              update(idx, { interactableId: e.target.value })
            }
          >
            <option value="">-- Select --</option>
            {interactables.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <div style={{ flex: 1 }}>
            <ConditionEditor
              value={entry.condition || ""}
              onChange={(v) =>
                update(idx, { condition: v || undefined })
              }
              placeholder="Visibility condition (optional)"
            />
          </div>
          <button
            className="btn btn--danger btn--sm"
            onClick={() => remove(idx)}
          >
            X
          </button>
        </div>
      ))}

      <button className="btn btn--sm" onClick={add}>
        + Add Fixed Interactable
      </button>
    </section>
  );
}
