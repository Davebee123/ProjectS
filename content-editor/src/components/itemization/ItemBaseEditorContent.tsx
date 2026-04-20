import { CsvField, ItemRequirementsEditor, ModifierPayloadListEditor } from "./ItemizationEditors";
import { EditorItemPreview, type EditorItemPreviewRow } from "../shared/EditorItemPreview";
import { useItemizationStore } from "../../stores/itemizationStore";
import { useSkillStore } from "../../stores/skillStore";
import type { EquipmentSlot, InventoryCategory, ItemImplicit } from "../../schema/types";

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

const INVENTORY_CATEGORIES: InventoryCategory[] = [
  "weapons",
  "armor",
  "consumables",
  "fey_runes",
  "materials",
  "quest_items",
  "misc",
];

interface Props {
  itemBaseId: string;
}

export function ItemBaseEditorContent({ itemBaseId }: Props) {
  const { itemBases, itemClasses, affixTables, modifierStats, updateItemBase } = useItemizationStore();
  const safeItemBases = Array.isArray(itemBases) ? itemBases : [];
  const safeItemClasses = Array.isArray(itemClasses) ? itemClasses : [];
  const safeAffixTables = Array.isArray(affixTables) ? affixTables : [];
  const safeModifierStats = Array.isArray(modifierStats) ? modifierStats : [];
  const skills = useSkillStore((state) => state.skills);
  const skillIds = Array.isArray(skills) ? skills.map((skill) => skill.id) : [];
  const itemBase = safeItemBases.find((entry) => entry.id === itemBaseId);

  if (!itemBase) {
    return <p>No item base with id "{itemBaseId}".</p>;
  }

  const safeRequirements = {
    playerLevel: itemBase.requirements?.playerLevel,
    skills: itemBase.requirements?.skills ?? [],
  };
  const safeBaseModifiers = itemBase.baseModifiers ?? [];
  const safeAffixTableIds = itemBase.affixTableIds ?? [];
  const safeTags = itemBase.tags ?? [];
  const safeImplicit = itemBase.implicit
    ? {
        ...itemBase.implicit,
        modifiers: itemBase.implicit.modifiers ?? [],
      }
    : undefined;

  const update = (patch: Parameters<typeof updateItemBase>[1]) => updateItemBase(itemBase.id, patch);

  const toggleAffixTable = (tableId: string) => {
    const next = safeAffixTableIds.includes(tableId)
      ? safeAffixTableIds.filter((entry) => entry !== tableId)
      : [...safeAffixTableIds, tableId];
    update({ affixTableIds: next });
  };

  const setImplicit = (implicit: ItemImplicit | undefined) => {
    update({ implicit });
  };

  const previewRows: EditorItemPreviewRow[] = safeBaseModifiers.map((modifier) => {
    const stat = safeModifierStats.find((entry) => entry.id === modifier.statId);
    const scopeLabel = modifier.scope ? ` (${modifier.scope})` : "";
    const value = modifier.operation === "multiply" ? `x${modifier.value}` : `+${modifier.value}`;

    return {
      label: `${stat?.label ?? modifier.statId}${scopeLabel}`,
      value,
    };
  });
  const selectedItemClass = safeItemClasses.find((entry) => entry.id === itemBase.itemClassId);

  return (
    <>
      <section className="editor-section">
        <h3 className="section-title">Basic Properties</h3>
        <div className="form-grid">
          <div className="form-field">
            <label className="field-label">ID</label>
            <input className="input" value={itemBase.id} disabled />
          </div>
          <div className="form-field">
            <label className="field-label">Name</label>
            <input className="input" value={itemBase.name} onChange={(e) => update({ name: e.target.value })} />
          </div>
          <div className="form-field form-field--wide">
            <label className="field-label">Description</label>
            <input
              className="input"
              value={itemBase.description}
              onChange={(e) => update({ description: e.target.value })}
            />
          </div>
          <div className="form-field form-field--wide">
            <label className="field-label">Additional Effects Text</label>
            <input
              className="input"
              value={itemBase.additionalEffectsText ?? ""}
              onChange={(e) => update({ additionalEffectsText: e.target.value || undefined })}
              placeholder="Optional freeform effect text shown below stats"
            />
          </div>
          <div className="form-field">
            <label className="field-label">Folder</label>
            <input
              className="input"
              value={itemBase.folder ?? ""}
              onChange={(e) => update({ folder: e.target.value || undefined })}
              placeholder="weapons"
            />
          </div>
          <div className="form-field">
            <label className="field-label">Image</label>
            <input
              className="input"
              value={itemBase.image ?? ""}
              onChange={(e) => update({ image: e.target.value || undefined })}
              placeholder="/icons/items/example.png"
            />
          </div>
          <div className="form-field">
            <label className="field-label">Slot</label>
            <select
              className="input select"
              value={itemBase.slot}
              onChange={(e) => update({ slot: e.target.value as EquipmentSlot })}
            >
              {SLOT_OPTIONS.map((slot) => (
                <option key={slot} value={slot}>
                  {slot}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label className="field-label">Inventory Category</label>
            <select
              className="input select"
              value={itemBase.inventoryCategory}
              onChange={(e) => update({ inventoryCategory: e.target.value as InventoryCategory })}
            >
              {INVENTORY_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label className="field-label">Item Class</label>
            <select
              className="input select"
              value={itemBase.itemClassId}
              onChange={(e) => update({ itemClassId: e.target.value })}
            >
              {safeItemClasses.map((itemClass) => (
                <option key={itemClass.id} value={itemClass.id}>
                  {itemClass.label}
                </option>
              ))}
            </select>
          </div>
          <CsvField
            label="Tags (CSV)"
            value={safeTags}
            onChange={(values) => update({ tags: values })}
            placeholder="starter, blade"
          />
        </div>
      </section>

      <section className="editor-section">
        <h3 className="section-title">Preview</h3>
        <p className="section-desc">Compact runtime-style preview for this equipment base.</p>
        <EditorItemPreview
          name={itemBase.name}
          description={itemBase.description}
          additionalEffectsText={itemBase.additionalEffectsText}
          image={itemBase.image}
          rarity="common"
          meta={[
            itemBase.inventoryCategory,
            itemBase.slot,
            selectedItemClass?.label ?? itemBase.itemClassId,
          ]}
          rows={previewRows}
        />
      </section>

      <ItemRequirementsEditor
        requirements={safeRequirements}
        skillIds={skillIds}
        onChange={(requirements) => update({ requirements })}
      />

      <ModifierPayloadListEditor
        title="Base Modifiers"
        description="Fixed modifiers that always apply for this base."
        modifiers={safeBaseModifiers}
        modifierStats={safeModifierStats}
        onChange={(baseModifiers) => update({ baseModifiers })}
      />

      <section className="editor-section">
        <div className="editor-subsection-header">
          <div>
            <h3 className="section-title" style={{ marginBottom: 0 }}>Implicit</h3>
            <p className="section-desc">
              Base-specific implicit that unlocks when the item instance reaches the configured item level.
            </p>
          </div>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={Boolean(safeImplicit)}
              onChange={(e) =>
                setImplicit(
                  e.target.checked
                    ? {
                        id: `${itemBase.id}_implicit`,
                        name: `${itemBase.name} Implicit`,
                        unlockItemLevel: 11,
                        modifiers: [],
                      }
                    : undefined
                )
              }
            />
            Has implicit
          </label>
        </div>
        {safeImplicit ? (
          <>
            <div className="form-grid">
              <div className="form-field">
                <label className="field-label">Implicit ID</label>
                <input
                  className="input"
                  value={safeImplicit.id}
                  onChange={(e) => setImplicit({ ...safeImplicit, id: e.target.value })}
                />
              </div>
              <div className="form-field">
                <label className="field-label">Implicit Name</label>
                <input
                  className="input"
                  value={safeImplicit.name}
                  onChange={(e) => setImplicit({ ...safeImplicit, name: e.target.value })}
                />
              </div>
              <div className="form-field">
                <label className="field-label">Unlock Item Level</label>
                <input
                  type="number"
                  min={1}
                  className="input"
                  value={safeImplicit.unlockItemLevel}
                  onChange={(e) =>
                    setImplicit({
                      ...safeImplicit,
                      unlockItemLevel: Math.max(1, Number(e.target.value) || 1),
                    })
                  }
                />
              </div>
            </div>
            <ModifierPayloadListEditor
              title="Implicit Modifiers"
              modifiers={safeImplicit.modifiers}
              modifierStats={safeModifierStats}
              onChange={(modifiers) => setImplicit({ ...safeImplicit, modifiers })}
            />
          </>
        ) : null}
      </section>

      <section className="editor-section">
        <h3 className="section-title">Affix Tables</h3>
        <p className="section-desc">
          Select the affix pools this base can draw from when random gear rolls are implemented.
        </p>
        <div className="tag-list">
          {safeAffixTables.map((table) => {
            const selected = safeAffixTableIds.includes(table.id);
            return (
              <button
                key={table.id}
                type="button"
                className={`tag-chip ${selected ? "tag-chip--selected" : ""}`}
                onClick={() => toggleAffixTable(table.id)}
              >
                <span className="tag-chip-label">{table.label}</span>
              </button>
            );
          })}
        </div>
      </section>
    </>
  );
}
