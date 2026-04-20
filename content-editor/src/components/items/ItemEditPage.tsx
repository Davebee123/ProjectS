import { useParams, useNavigate } from "react-router-dom";
import { PageShell } from "../layout/PageShell";
import { useItemStore } from "../../stores/itemStore";
import { EventHooksPanel } from "./EventHooksPanel";
import { EditorItemPreview, type EditorItemPreviewRow } from "../shared/EditorItemPreview";
import type {
  EquipmentSlot,
  InventoryCategory,
  ItemRarity,
  ItemStats,
  PlacementEffect,
  PlacementEffectType,
} from "../../schema/types";
import { useTagStore } from "../../stores/tagStore";

const SLOT_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "None (material/consumable)" },
  { value: "head", label: "Head" },
  { value: "shoulders", label: "Shoulders" },
  { value: "chest", label: "Chest" },
  { value: "hands", label: "Hands" },
  { value: "legs", label: "Legs" },
  { value: "feet", label: "Feet" },
  { value: "back", label: "Back" },
  { value: "mainHand", label: "Main Hand" },
  { value: "offHand", label: "Off Hand" },
  { value: "rune", label: "Fey Rune" },
];

const STAT_FIELDS: { key: keyof ItemStats; label: string; step: string }[] = [
  { key: "attack", label: "Attack", step: "1" },
  { key: "defense", label: "Defense", step: "1" },
  { key: "energyRegen", label: "Energy Regen", step: "0.5" },
  { key: "activityPowerMultiplier", label: "Activity Power Multiplier", step: "0.01" },
  { key: "backpackSlots", label: "Backpack Slots", step: "1" },
  { key: "speedMultiplier", label: "Speed Multiplier", step: "0.01" },
  { key: "energyCostMultiplier", label: "Energy Cost Multiplier", step: "0.01" },
];

const RARITY_OPTIONS: { value: ItemRarity; label: string }[] = [
  { value: "common", label: "Common" },
  { value: "uncommon", label: "Uncommon" },
  { value: "rare", label: "Rare" },
  { value: "epic", label: "Epic" },
];

const INVENTORY_CATEGORY_OPTIONS: { value: InventoryCategory; label: string }[] = [
  { value: "weapons", label: "Weapons" },
  { value: "armor", label: "Armor" },
  { value: "consumables", label: "Consumables" },
  { value: "fey_runes", label: "Fey Runes" },
  { value: "materials", label: "Materials" },
  { value: "quest_items", label: "Quest Items" },
  { value: "misc", label: "Misc" },
];

export function ItemEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { items, updateItem } = useItemStore();
  const { activityTags } = useTagStore();
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

  const previewRows: EditorItemPreviewRow[] = STAT_FIELDS.flatMap((field) => {
    const value = item.stats[field.key];
    if (value == null) {
      return [];
    }
    return [
      {
        label: field.label,
        value: String(value),
      },
    ];
  });

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
            <label className="field-label">Image</label>
            <input
              className="input"
              value={item.image || ""}
              onChange={(e) => updateItem(item.id, { image: e.target.value || undefined })}
              placeholder="/icons/items/example.png"
            />
          </div>
          <div className="form-field">
            <label className="field-label">Rarity</label>
            <select
              className="input select"
              value={item.rarity || "common"}
              onChange={(e) =>
                updateItem(item.id, {
                  rarity: e.target.value as ItemRarity,
                })
              }
            >
              {RARITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label className="field-label">Backpack Category</label>
            <select
              className="input select"
              value={item.inventoryCategory || "misc"}
              onChange={(e) =>
                updateItem(item.id, {
                  inventoryCategory: e.target.value as InventoryCategory,
                })
              }
            >
              {INVENTORY_CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
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
          <div className="form-field">
            <label className="field-label">Folder</label>
            <input
              className="input"
              value={item.folder || ""}
              onChange={(e) => updateItem(item.id, { folder: e.target.value || undefined })}
              placeholder="e.g. Weapons, Materials..."
            />
          </div>
        </div>
      </section>

      <section className="editor-section">
        <h3 className="section-title">Preview</h3>
        <p className="section-desc">Quick runtime-style read of this item.</p>
        <EditorItemPreview
          name={item.name}
          description={item.description}
          additionalEffectsText={item.additionalEffectsText}
          image={item.image}
          rarity={item.rarity}
          meta={[
            item.inventoryCategory || "misc",
            item.slot || (item.stackable ? "stackable" : "inventory item"),
          ]}
          rows={previewRows}
        />
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

        {item.stats.attack != null && item.stats.attack > 0 && (
          <div className="form-field" style={{ marginTop: 12 }}>
            <label className="field-label">Attack Applies To Tags</label>
            <p className="section-desc" style={{ marginBottom: 6 }}>
              If set, this item's attack bonus only applies against interactables with a matching tag.
              Leave empty to apply to all targets.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {(item.stats.attackTags ?? []).map((tag) => (
                <span key={tag} className="tag-pill">
                  {tag}
                  <button
                    type="button"
                    className="tag-pill-remove"
                    onClick={() =>
                      updateItem(item.id, {
                        stats: {
                          ...item.stats,
                          attackTags: (item.stats.attackTags ?? []).filter((t) => t !== tag),
                        },
                      })
                    }
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <select
              className="input"
              value=""
              onChange={(e) => {
                if (!e.target.value) return;
                const existing = item.stats.attackTags ?? [];
                if (existing.includes(e.target.value)) return;
                updateItem(item.id, {
                  stats: { ...item.stats, attackTags: [...existing, e.target.value] },
                });
              }}
            >
              <option value="">Add tag…</option>
              {activityTags
                .filter((tag) => !(item.stats.attackTags ?? []).includes(tag.id))
                .map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.label}
                  </option>
                ))}
            </select>
          </div>
        )}
      </section>

      {/* Placement */}
      <section className="editor-section">
        <h3 className="section-title">World Placement</h3>
        <p className="section-desc">
          Placeable items can be placed in a room from the inventory. While placed, they emit
          ongoing effects (stat auras or spawn modifiers) until removed by the player.
        </p>
        <div className="form-field" style={{ marginBottom: 16 }}>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={item.placeable ?? false}
              onChange={(e) =>
                updateItem(item.id, {
                  placeable: e.target.checked || undefined,
                  placementEffects: e.target.checked ? (item.placementEffects ?? []) : undefined,
                })
              }
            />
            Item can be placed in the world
          </label>
        </div>

        {item.placeable && (
          <>
            {(item.placementEffects ?? []).length > 0 && (
              <table className="editor-table" style={{ marginBottom: 12 }}>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Detail</th>
                    <th>Value</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(item.placementEffects ?? []).map((fx, i) => {
                    const effects = item.placementEffects ?? [];
                    const updateFx = (patch: Partial<PlacementEffect>) => {
                      const next = effects.map((e, idx) => idx === i ? { ...e, ...patch } : e);
                      updateItem(item.id, { placementEffects: next });
                    };
                    const removeFx = () =>
                      updateItem(item.id, { placementEffects: effects.filter((_, idx) => idx !== i) });

                    return (
                      <tr key={fx.id}>
                        <td>
                          <select
                            className="input"
                            value={fx.type}
                            onChange={(e) => updateFx({ type: e.target.value as PlacementEffectType })}
                          >
                            <option value="stat_aura">Stat Aura</option>
                            <option value="spawn_modifier">Spawn Modifier</option>
                          </select>
                        </td>
                        <td>
                          {fx.type === "stat_aura" ? (
                            <select
                              className="input"
                              value={fx.stat ?? ""}
                              onChange={(e) => updateFx({ stat: e.target.value as keyof ItemStats || undefined })}
                            >
                              <option value="">(choose stat)</option>
                              {STAT_FIELDS.map((sf) => (
                                <option key={sf.key} value={sf.key}>{sf.label}</option>
                              ))}
                            </select>
                          ) : (
                            <select
                              className="input"
                              value={fx.targetTag ?? ""}
                              onChange={(e) => updateFx({ targetTag: e.target.value || undefined })}
                            >
                              <option value="">(any tag)</option>
                              {activityTags.map((t) => (
                                <option key={t.id} value={t.id}>{t.label || t.id}</option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td>
                          <input
                            type="number"
                            className="input"
                            step="0.01"
                            style={{ width: 80 }}
                            value={fx.type === "stat_aura" ? (fx.value ?? "") : (fx.spawnChanceMultiplier ?? "")}
                            placeholder={fx.type === "stat_aura" ? "flat bonus" : "multiplier"}
                            onChange={(e) => {
                              const n = e.target.value === "" ? undefined : Number(e.target.value);
                              if (fx.type === "stat_aura") updateFx({ value: n });
                              else updateFx({ spawnChanceMultiplier: n });
                            }}
                          />
                        </td>
                        <td>
                          <button className="btn btn--danger btn--sm" onClick={removeFx}>
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            <button
              className="btn btn--sm"
              onClick={() => {
                const newFx: PlacementEffect = {
                  id: `fx_${Date.now()}`,
                  type: "stat_aura",
                };
                updateItem(item.id, {
                  placementEffects: [...(item.placementEffects ?? []), newFx],
                });
              }}
            >
              + Add Placement Effect
            </button>
          </>
        )}
      </section>

      <EventHooksPanel
        hooks={item.eventHooks}
        onChange={(eventHooks) => updateItem(item.id, { eventHooks })}
      />
    </PageShell>
  );
}
