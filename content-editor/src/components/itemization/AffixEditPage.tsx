import { useNavigate, useParams } from "react-router-dom";
import { PageShell } from "../layout/PageShell";
import { CsvField, ModifierPayloadListEditor } from "./ItemizationEditors";
import { useItemizationStore } from "../../stores/itemizationStore";
import { useTagStore } from "../../stores/tagStore";
import type { AffixTier, EquipmentSlot } from "../../schema/types";

const SLOT_OPTIONS: EquipmentSlot[] = [
  "head",
  "shoulders",
  "chest",
  "hands",
  "legs",
  "feet",
  "back",
  "mainHand",
  "offHand",
  "rune",
];

export function AffixEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { affixes, affixTables, itemClasses, modifierStats, updateAffix } = useItemizationStore();
  const { activityTags } = useTagStore();
  const affix = affixes.find((entry) => entry.id === id);

  if (!affix) {
    return (
      <PageShell title="Affix Not Found">
        <p>No affix with id "{id}".</p>
        <button className="btn" onClick={() => navigate("/itemization/affixes")}>
          Back to Affixes
        </button>
      </PageShell>
    );
  }

  const update = (patch: Parameters<typeof updateAffix>[1]) => updateAffix(affix.id, patch);

  const toggleSlot = (slot: EquipmentSlot) => {
    const current = affix.allowedSlots ?? [];
    const next = current.includes(slot) ? current.filter((entry) => entry !== slot) : [...current, slot];
    update({ allowedSlots: next.length > 0 ? next : undefined });
  };

  const toggleItemClass = (itemClassId: string) => {
    const current = affix.allowedItemClasses ?? [];
    const next = current.includes(itemClassId)
      ? current.filter((entry) => entry !== itemClassId)
      : [...current, itemClassId];
    update({ allowedItemClasses: next.length > 0 ? next : undefined });
  };

  const updateTier = (index: number, patch: Partial<AffixTier>) => {
    update({
      tiers: affix.tiers.map((tier, tierIndex) => (tierIndex === index ? { ...tier, ...patch } : tier)),
    });
  };

  const addTier = () => {
    update({
      tiers: [
        ...affix.tiers,
        {
          tier: affix.tiers.length + 1,
          itemLevelMin: 1,
          itemLevelMax: 10,
          rollMin: 1,
          rollMax: 1,
        },
      ],
    });
  };

  const removeTier = (index: number) => {
    update({
      tiers: affix.tiers.filter((_, tierIndex) => tierIndex !== index),
    });
  };

  return (
    <PageShell
      title={affix.nameTemplate}
      actions={
        <button className="btn" onClick={() => navigate("/itemization/affixes")}>
          Back to Affixes
        </button>
      }
    >
      <section className="editor-section">
        <h3 className="section-title">Basic Properties</h3>
        <div className="form-grid">
          <div className="form-field">
            <label className="field-label">ID</label>
            <input className="input" value={affix.id} disabled />
          </div>
          <div className="form-field">
            <label className="field-label">Name Template</label>
            <input
              className="input"
              value={affix.nameTemplate}
              onChange={(e) => update({ nameTemplate: e.target.value })}
            />
          </div>
          <div className="form-field">
            <label className="field-label">Kind</label>
            <select
              className="input select"
              value={affix.kind}
              onChange={(e) => update({ kind: e.target.value as "prefix" | "suffix" })}
            >
              <option value="prefix">prefix</option>
              <option value="suffix">suffix</option>
            </select>
          </div>
          <div className="form-field">
            <label className="field-label">Folder</label>
            <input
              className="input"
              value={affix.folder ?? ""}
              onChange={(e) => update({ folder: e.target.value || undefined })}
              placeholder="prefixes"
            />
          </div>
          <div className="form-field">
            <label className="field-label">Affix Table</label>
            <select
              className="input select"
              value={affix.tableId}
              onChange={(e) => update({ tableId: e.target.value })}
            >
              {affixTables.map((table) => (
                <option key={table.id} value={table.id}>
                  {table.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label className="field-label">Weight</label>
            <input
              type="number"
              min={0}
              className="input"
              value={affix.weight}
              onChange={(e) => update({ weight: Math.max(0, Number(e.target.value) || 0) })}
            />
          </div>
          <div className="form-field form-field--wide">
            <label className="field-label">Description</label>
            <input
              className="input"
              value={affix.description ?? ""}
              onChange={(e) => update({ description: e.target.value || undefined })}
            />
          </div>
          <div className="form-field">
            <label className="field-label">Exclusive Group</label>
            <input
              className="input"
              value={affix.exclusiveGroup ?? ""}
              onChange={(e) => update({ exclusiveGroup: e.target.value || undefined })}
              placeholder="optional family key"
            />
          </div>
          <CsvField
            label="Required Tags (CSV)"
            value={affix.requiredTags}
            onChange={(values) => update({ requiredTags: values.length > 0 ? values : undefined })}
            placeholder="weapon, melee"
          />
        </div>
      </section>

      <section className="editor-section">
        <h3 className="section-title">Allowed Slots</h3>
        <div className="tag-list">
          {SLOT_OPTIONS.map((slot) => {
            const selected = affix.allowedSlots?.includes(slot) ?? false;
            return (
              <button
                key={slot}
                type="button"
                className={`tag-chip ${selected ? "tag-chip--selected" : ""}`}
                onClick={() => toggleSlot(slot)}
              >
                <span className="tag-chip-label">{slot}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="editor-section">
        <h3 className="section-title">Allowed Item Classes</h3>
        <div className="tag-list">
          {itemClasses.map((itemClass) => {
            const selected = affix.allowedItemClasses?.includes(itemClass.id) ?? false;
            return (
              <button
                key={itemClass.id}
                type="button"
                className={`tag-chip ${selected ? "tag-chip--selected" : ""}`}
                onClick={() => toggleItemClass(itemClass.id)}
              >
                <span className="tag-chip-label">{itemClass.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="editor-section">
        <div className="editor-subsection-header">
          <div>
            <h3 className="section-title" style={{ marginBottom: 0 }}>Tiers</h3>
            <p className="section-desc">
              Tier weights are optional. If omitted, runtime falls back to the default tier weighting model.
            </p>
          </div>
          <button className="btn btn--sm" onClick={addTier}>
            + Add Tier
          </button>
        </div>
        <table className="editor-table">
          <thead>
            <tr>
              <th>Tier</th>
              <th>ILvl Min</th>
              <th>ILvl Max</th>
              <th>Roll Min</th>
              <th>Roll Max</th>
              <th>Weight</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {affix.tiers.map((tier, index) => (
              <tr key={`${affix.id}_tier_${index}`}>
                <td>
                  <input
                    type="number"
                    className="input"
                    value={tier.tier}
                    onChange={(e) => updateTier(index, { tier: Math.max(1, Number(e.target.value) || 1) })}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    className="input"
                    value={tier.itemLevelMin}
                    onChange={(e) => updateTier(index, { itemLevelMin: Math.max(1, Number(e.target.value) || 1) })}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    className="input"
                    value={tier.itemLevelMax}
                    onChange={(e) => updateTier(index, { itemLevelMax: Math.max(1, Number(e.target.value) || 1) })}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    className="input"
                    value={tier.rollMin}
                    onChange={(e) => updateTier(index, { rollMin: Number(e.target.value) || 0 })}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    className="input"
                    value={tier.rollMax}
                    onChange={(e) => updateTier(index, { rollMax: Number(e.target.value) || 0 })}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    className="input"
                    value={tier.weight ?? ""}
                    onChange={(e) => updateTier(index, { weight: e.target.value ? Math.max(0, Number(e.target.value) || 0) : undefined })}
                    placeholder="default"
                  />
                </td>
                <td>
                  <button className="btn btn--danger btn--sm" onClick={() => removeTier(index)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <ModifierPayloadListEditor
        title="Affix Modifiers"
        description="Each modifier consumes the tier's rolled value."
        modifiers={affix.modifiers.map((modifier) => ({ ...modifier, value: 0 }))}
        modifierStats={modifierStats}
        activityTags={activityTags}
        onChange={(modifiers) =>
          update({
            modifiers: modifiers.map((modifier) => ({
              statId: modifier.statId,
              operation: modifier.operation,
              valueSource: "rolled_value",
              scope: modifier.scope,
            })),
          })
        }
      />
    </PageShell>
  );
}
