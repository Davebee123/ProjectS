import { useStorageKeyStore } from "../../stores/storageKeyStore";
import type { StorageEffect } from "../../schema/types";

interface Props {
  label: string;
  description: string;
  effects: StorageEffect[];
  onChange: (effects: StorageEffect[]) => void;
}

export function StorageEffectsPanel({ label, description, effects, onChange }: Props) {
  const { storageKeys } = useStorageKeyStore();

  const add = () => {
    onChange([...effects, { storageKeyId: "", operation: "set" }]);
  };

  const update = (idx: number, patch: Partial<StorageEffect>) => {
    const updated = [...effects];
    updated[idx] = { ...updated[idx], ...patch };
    onChange(updated);
  };

  const remove = (idx: number) => onChange(effects.filter((_, i) => i !== idx));

  return (
    <section className="editor-section">
      <h3 className="section-title">{label}</h3>
      <p className="section-desc">{description}</p>

      {effects.map((fx, idx) => (
        <div key={idx} className="action-row" style={{ marginBottom: 8 }}>
          <select
            className="input select"
            value={fx.storageKeyId}
            onChange={(e) => update(idx, { storageKeyId: e.target.value })}
          >
            <option value="">-- Select key --</option>
            {storageKeys.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label} ({k.type})
              </option>
            ))}
          </select>

          <select
            className="input select"
            value={fx.operation}
            onChange={(e) =>
              update(idx, {
                operation: e.target.value as StorageEffect["operation"],
              })
            }
          >
            <option value="set">Set</option>
            <option value="increment">Increment</option>
            <option value="decrement">Decrement</option>
            <option value="toggle">Toggle</option>
          </select>

          <input
            className="input input--sm"
            placeholder="Value"
            value={String(fx.value ?? "")}
            onChange={(e) => update(idx, { value: e.target.value })}
          />

          <button className="btn btn--danger btn--sm" onClick={() => remove(idx)}>
            X
          </button>
        </div>
      ))}

      <button className="btn btn--sm" onClick={add}>
        + Add Effect
      </button>
    </section>
  );
}
