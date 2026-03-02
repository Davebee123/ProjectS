import { useParams, useNavigate } from "react-router-dom";
import { PageShell } from "../layout/PageShell";
import { useItemStore } from "../../stores/itemStore";
import { EventHooksPanel } from "./EventHooksPanel";
import type { EquipmentSlot, ItemStats } from "../../schema/types";

const SLOT_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "None (material/consumable)" },
  { value: "weapon", label: "Weapon" },
  { value: "armor", label: "Armor" },
  { value: "accessory", label: "Accessory" },
];

const STAT_FIELDS: { key: keyof ItemStats; label: string; step: string }[] = [
  { key: "attack", label: "Attack", step: "1" },
  { key: "defense", label: "Defense", step: "1" },
  { key: "energyRegen", label: "Energy Regen", step: "0.5" },
  { key: "activityPowerMultiplier", label: "Activity Power Multiplier", step: "0.01" },
  { key: "speedMultiplier", label: "Speed Multiplier", step: "0.01" },
  { key: "energyCostMultiplier", label: "Energy Cost Multiplier", step: "0.01" },
];

export function ItemEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { items, updateItem } = useItemStore();
  const item = items.find((i) => i.id === id);

  if (!item) {
    return (
      <PageShell title="Item Not Found">
        <p>No item with id "{id}".</p>
        <button className="btn" onClick={() => navigate("/items")}>
          Back to Items
        </button>
      </PageShell>
    );
  }

  const updateStat = (key: keyof ItemStats, raw: string) => {
    const val = raw === "" ? undefined : Number(raw);
    updateItem(item.id, { stats: { ...item.stats, [key]: val } });
  };

  return (
    <PageShell
      title={item.name}
      actions={
        <button className="btn" onClick={() => navigate("/items")}>
          Back to Items
        </button>
      }
    >
      <section className="editor-section">
        <h3 className="section-title">Basic Properties</h3>
        <div className="form-grid">
          <div className="form-field">
            <label className="field-label">ID</label>
            <input className="input" value={item.id} disabled />
          </div>
          <div className="form-field">
            <label className="field-label">Name</label>
            <input
              className="input"
              value={item.name}
              onChange={(e) => updateItem(item.id, { name: e.target.value })}
            />
          </div>
          <div className="form-field form-field--wide">
            <label className="field-label">Description</label>
            <input
              className="input"
              value={item.description}
              onChange={(e) => updateItem(item.id, { description: e.target.value })}
              placeholder="Item description..."
            />
          </div>
          <div className="form-field">
            <label className="field-label">Equipment Slot</label>
            <select
              className="input select"
              value={item.slot || ""}
              onChange={(e) =>
                updateItem(item.id, {
                  slot: (e.target.value || undefined) as EquipmentSlot | undefined,
                })
              }
            >
              {SLOT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label className="field-label">Stackable</label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={item.stackable}
                onChange={(e) => updateItem(item.id, { stackable: e.target.checked })}
              />
              Can stack in inventory
            </label>
          </div>
        </div>
      </section>

      <section className="editor-section">
        <h3 className="section-title">Stats</h3>
        <p className="section-desc">
          Leave blank for stats that don't apply. Multipliers default to 1.0 (no effect).
        </p>
        <div className="form-grid">
          {STAT_FIELDS.map((sf) => (
            <div className="form-field" key={sf.key}>
              <label className="field-label">{sf.label}</label>
              <input
                type="number"
                className="input"
                step={sf.step}
                value={item.stats[sf.key] ?? ""}
                onChange={(e) => updateStat(sf.key, e.target.value)}
                placeholder={sf.key.includes("Multiplier") ? "1.0" : "0"}
              />
            </div>
          ))}
        </div>
      </section>

      <EventHooksPanel
        hooks={item.eventHooks}
        onChange={(eventHooks) => updateItem(item.id, { eventHooks })}
      />
    </PageShell>
  );
}
