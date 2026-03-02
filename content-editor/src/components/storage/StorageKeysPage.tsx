import { useState } from "react";
import { PageShell } from "../layout/PageShell";
import { useStorageKeyStore } from "../../stores/storageKeyStore";
import type { StorageKeyDef } from "../../schema/types";

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

const TYPE_OPTIONS: { value: StorageKeyDef["type"]; label: string; defaultVal: boolean | number | string }[] = [
  { value: "flag", label: "Flag (boolean)", defaultVal: false },
  { value: "counter", label: "Counter (number)", defaultVal: 0 },
  { value: "value", label: "Value (string/number)", defaultVal: "" },
];

export function StorageKeysPage() {
  const { storageKeys, addStorageKey, updateStorageKey, removeStorageKey } =
    useStorageKeyStore();
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<StorageKeyDef["type"]>("flag");

  const handleAdd = () => {
    const label = newLabel.trim();
    if (!label) return;
    const id = slugify(label);
    if (storageKeys.some((k) => k.id === id)) return;
    const defaultValue = TYPE_OPTIONS.find((o) => o.value === newType)!.defaultVal;
    addStorageKey({ id, label, type: newType, defaultValue, description: "" });
    setNewLabel("");
  };

  return (
    <PageShell title="Storage Keys">
      <section className="editor-section">
        <p className="section-desc">
          Storage keys track player state — flags (on/off), counters (numbers), and
          values (arbitrary). Interactables can set these, and conditions can read them.
        </p>
        <table className="editor-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Label</th>
              <th>Type</th>
              <th>Default</th>
              <th>Description</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {storageKeys.map((key) => (
              <StorageKeyRow
                key={key.id}
                storageKey={key}
                onUpdate={updateStorageKey}
                onRemove={removeStorageKey}
              />
            ))}
          </tbody>
        </table>
        <div className="add-row">
          <input
            type="text"
            placeholder="New storage key label..."
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="input"
          />
          <select
            className="input select"
            value={newType}
            onChange={(e) => setNewType(e.target.value as StorageKeyDef["type"])}
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button className="btn btn--primary" onClick={handleAdd}>
            Add
          </button>
        </div>
      </section>
    </PageShell>
  );
}

function StorageKeyRow({
  storageKey: sk,
  onUpdate,
  onRemove,
}: {
  storageKey: StorageKeyDef;
  onUpdate: (id: string, patch: Partial<StorageKeyDef>) => void;
  onRemove: (id: string) => void;
}) {
  const renderDefault = () => {
    if (sk.type === "flag") {
      return (
        <input
          type="checkbox"
          checked={sk.defaultValue as boolean}
          onChange={(e) => onUpdate(sk.id, { defaultValue: e.target.checked })}
        />
      );
    }
    if (sk.type === "counter") {
      return (
        <input
          type="number"
          className="input input--sm"
          value={sk.defaultValue as number}
          onChange={(e) => onUpdate(sk.id, { defaultValue: Number(e.target.value) })}
        />
      );
    }
    return (
      <input
        className="input input--sm"
        value={String(sk.defaultValue)}
        onChange={(e) => onUpdate(sk.id, { defaultValue: e.target.value })}
        placeholder="default value"
      />
    );
  };

  return (
    <tr>
      <td className="cell-id">{sk.id}</td>
      <td>
        <input
          className="input"
          value={sk.label}
          onChange={(e) => onUpdate(sk.id, { label: e.target.value })}
        />
      </td>
      <td>
        <select
          className="input select"
          value={sk.type}
          onChange={(e) => {
            const type = e.target.value as StorageKeyDef["type"];
            const defaultValue = type === "flag" ? false : type === "counter" ? 0 : "";
            onUpdate(sk.id, { type, defaultValue });
          }}
        >
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </td>
      <td>{renderDefault()}</td>
      <td>
        <input
          className="input"
          value={sk.description}
          onChange={(e) => onUpdate(sk.id, { description: e.target.value })}
          placeholder="Description..."
        />
      </td>
      <td>
        <button className="btn btn--danger btn--sm" onClick={() => onRemove(sk.id)}>
          Remove
        </button>
      </td>
    </tr>
  );
}
