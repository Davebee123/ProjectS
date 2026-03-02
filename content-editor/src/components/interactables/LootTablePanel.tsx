import { useItemStore } from "../../stores/itemStore";
import type { LootTableEntry } from "../../schema/types";

interface Props {
  entries: LootTableEntry[];
  onChange: (entries: LootTableEntry[]) => void;
}

let _ltId = 0;
function nextLtId() {
  return `lt_${Date.now()}_${_ltId++}`;
}

export function LootTablePanel({ entries, onChange }: Props) {
  const { items } = useItemStore();

  const add = () => {
    onChange([
      ...entries,
      {
        id: nextLtId(),
        itemId: "",
        quantityMin: 1,
        quantityMax: 1,
        dropChance: 100,
        weight: 10,
      },
    ]);
  };

  const update = (idx: number, patch: Partial<LootTableEntry>) => {
    const updated = [...entries];
    updated[idx] = { ...updated[idx], ...patch };
    onChange(updated);
  };

  const remove = (idx: number) => onChange(entries.filter((_, i) => i !== idx));

  return (
    <section className="editor-section">
      <h3 className="section-title">Loot Table</h3>
      <p className="section-desc">
        Items dropped when this interactable is destroyed. Each entry has a drop
        chance (0–100), a weight for relative frequency, and a quantity range.
      </p>
      <table className="editor-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty Min</th>
            <th>Qty Max</th>
            <th>Drop %</th>
            <th>Weight</th>
            <th>Condition</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, idx) => (
            <tr key={entry.id}>
              <td>
                <select
                  className="input select"
                  value={entry.itemId}
                  onChange={(e) => update(idx, { itemId: e.target.value })}
                >
                  <option value="">-- Select item --</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <input
                  type="number"
                  className="input input--sm"
                  value={entry.quantityMin}
                  onChange={(e) =>
                    update(idx, { quantityMin: Number(e.target.value) })
                  }
                />
              </td>
              <td>
                <input
                  type="number"
                  className="input input--sm"
                  value={entry.quantityMax}
                  onChange={(e) =>
                    update(idx, { quantityMax: Number(e.target.value) })
                  }
                />
              </td>
              <td>
                <input
                  type="number"
                  className="input input--sm"
                  value={entry.dropChance}
                  onChange={(e) =>
                    update(idx, { dropChance: Number(e.target.value) })
                  }
                />
              </td>
              <td>
                <input
                  type="number"
                  className="input input--sm"
                  value={entry.weight}
                  onChange={(e) =>
                    update(idx, { weight: Number(e.target.value) })
                  }
                />
              </td>
              <td>
                <input
                  className="input input--code"
                  value={entry.condition || ""}
                  onChange={(e) =>
                    update(idx, { condition: e.target.value || undefined })
                  }
                  placeholder="optional DSL"
                  style={{ minWidth: 120 }}
                />
              </td>
              <td>
                <button
                  className="btn btn--danger btn--sm"
                  onClick={() => remove(idx)}
                >
                  X
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="btn btn--sm" onClick={add}>
        + Add Loot Entry
      </button>
    </section>
  );
}
