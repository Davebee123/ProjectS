import { createDefaultItem, useItemStore } from "../../stores/itemStore";
import { useItemizationStore } from "../../stores/itemizationStore";
import { CollapsibleEditorSection } from "../shared/CollapsibleEditorSection";
import { ConditionEditor } from "../shared/ConditionEditor";
import { ReferencePicker } from "../shared/ReferencePicker";
import type { LootTableEntry } from "../../schema/types";
import { createUniqueId } from "../../utils/ids";

interface Props {
  entries: LootTableEntry[];
  onChange: (entries: LootTableEntry[]) => void;
}

let _ltId = 0;
function nextLtId() {
  return `lt_${Date.now()}_${_ltId++}`;
}

function describeLootTarget(
  entry: LootTableEntry,
  itemOptions: Array<{ id: string; label: string }>,
  itemBaseOptions: Array<{ id: string; label: string }>
) {
  if ((entry.dropType ?? "item") === "item_base") {
    return itemBaseOptions.find((option) => option.id === entry.itemBaseId)?.label ?? "(unset item base)";
  }
  return itemOptions.find((option) => option.id === entry.itemId)?.label ?? "(unset item)";
}

function describeLootEntry(
  entry: LootTableEntry,
  itemOptions: Array<{ id: string; label: string }>,
  itemBaseOptions: Array<{ id: string; label: string }>
) {
  const quantityLabel =
    entry.quantityMin === entry.quantityMax
      ? `${entry.quantityMin} qty`
      : `${entry.quantityMin}-${entry.quantityMax} qty`;
  const target = describeLootTarget(entry, itemOptions, itemBaseOptions);
  return `${(entry.dropType ?? "item") === "item_base" ? "Item Base" : "Item"} • ${target} • ${quantityLabel} • ${entry.dropChance}%`;
}

function describeRollSettings(entry: LootTableEntry) {
  const min = entry.itemLevelMin ?? "?";
  const max = entry.itemLevelMax ?? "?";
  return `iLvl ${min}-${max} • ${entry.qualityRuleSetId || "default rule"}`;
}

function describeCondition(entry: LootTableEntry) {
  return entry.condition?.trim() ? "Custom DSL" : "Always eligible";
}

export function LootTablePanel({ entries, onChange }: Props) {
  const { items, addItem } = useItemStore();
  const { itemBases, itemClasses, itemQualityRules } = useItemizationStore();
  const itemOptions = items.map((item) => ({
    id: item.id,
    label: item.name || item.id,
    meta: `${item.inventoryCategory || "misc"} / ${item.rarity || "common"}${
      item.slot ? ` / ${item.slot}` : ""
    }`,
  }));
  const itemBaseOptions = itemBases.map((itemBase) => ({
    id: itemBase.id,
    label: itemBase.name,
    meta: `${itemBase.inventoryCategory} / ${itemBase.slot} / ${
      itemClasses.find((itemClass) => itemClass.id === itemBase.itemClassId)?.label ??
      itemBase.itemClassId
    }`,
  }));

  const createAndLinkItem = (name: string) => {
    const id = createUniqueId(name, items.map((item) => item.id));
    addItem(createDefaultItem(id, name));
    return id;
  };

  const add = () => {
    onChange([
      ...entries,
      {
        id: nextLtId(),
        dropType: "item",
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
        Author static item drops or rolled equipment-base drops. Quantity controls stack count for
        items or instance count for equipment.
      </p>
      <div className="stack-lg">
        {entries.map((entry, idx) => {
          const dropType = entry.dropType ?? "item";
          return (
            <div key={entry.id} className="editor-subsection">
              <div className="section-header-row">
                <div>
                  <h4 className="section-title" style={{ marginBottom: 0 }}>
                    Loot Entry {idx + 1}
                  </h4>
                  <p className="section-desc" style={{ marginBottom: 0 }}>
                    {describeLootEntry(entry, itemOptions, itemBaseOptions)}
                  </p>
                </div>
                <button className="btn btn--danger btn--sm" onClick={() => remove(idx)}>
                  Remove
                </button>
              </div>

              <div className="form-grid">
                <div className="form-field">
                  <label className="field-label">Type</label>
                  <select
                    className="input"
                    value={dropType}
                    onChange={(e) =>
                      update(idx, {
                        dropType: e.target.value as "item" | "item_base",
                        itemId: e.target.value === "item" ? entry.itemId || "" : undefined,
                        itemBaseId:
                          e.target.value === "item_base" ? entry.itemBaseId || "" : undefined,
                      })
                    }
                  >
                    <option value="item">Item</option>
                    <option value="item_base">Item Base</option>
                  </select>
                </div>

                <div className="form-field">
                  {dropType === "item" ? (
                    <ReferencePicker
                      label="Target Item"
                      value={entry.itemId ?? ""}
                      options={itemOptions}
                      placeholder="Select item..."
                      onChange={(value) => update(idx, { itemId: value || undefined })}
                      onCreate={createAndLinkItem}
                      createPlaceholder="New item name..."
                    />
                  ) : (
                    <ReferencePicker
                      label="Target Item Base"
                      value={entry.itemBaseId ?? ""}
                      options={itemBaseOptions}
                      placeholder="Select item base..."
                      onChange={(value) => update(idx, { itemBaseId: value || undefined })}
                    />
                  )}
                </div>

                <div className="form-field">
                  <label className="field-label">Qty Min</label>
                  <input
                    type="number"
                    className="input"
                    value={entry.quantityMin}
                    onChange={(e) => update(idx, { quantityMin: Number(e.target.value) })}
                  />
                </div>

                <div className="form-field">
                  <label className="field-label">Qty Max</label>
                  <input
                    type="number"
                    className="input"
                    value={entry.quantityMax}
                    onChange={(e) => update(idx, { quantityMax: Number(e.target.value) })}
                  />
                </div>

                <div className="form-field">
                  <label className="field-label">Drop %</label>
                  <input
                    type="number"
                    className="input"
                    value={entry.dropChance}
                    onChange={(e) => update(idx, { dropChance: Number(e.target.value) })}
                  />
                </div>

                <div className="form-field">
                  <label className="field-label">Weight</label>
                  <input
                    type="number"
                    className="input"
                    value={entry.weight}
                    onChange={(e) => update(idx, { weight: Number(e.target.value) })}
                  />
                </div>
              </div>

              {dropType === "item_base" ? (
                <CollapsibleEditorSection
                  title="Equipment Roll Settings"
                  summary={describeRollSettings(entry)}
                  defaultOpen={false}
                >
                  <div className="form-grid">
                    <div className="form-field">
                      <label className="field-label">Item Level Min</label>
                      <input
                        type="number"
                        className="input"
                        value={entry.itemLevelMin ?? ""}
                        onChange={(e) =>
                          update(idx, {
                            itemLevelMin:
                              e.target.value === "" ? undefined : Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="form-field">
                      <label className="field-label">Item Level Max</label>
                      <input
                        type="number"
                        className="input"
                        value={entry.itemLevelMax ?? ""}
                        onChange={(e) =>
                          update(idx, {
                            itemLevelMax:
                              e.target.value === "" ? undefined : Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="form-field form-field--wide">
                      <label className="field-label">Quality Rule Set</label>
                      <select
                        className="input"
                        value={entry.qualityRuleSetId ?? ""}
                        onChange={(e) =>
                          update(idx, { qualityRuleSetId: e.target.value || undefined })
                        }
                      >
                        <option value="">default</option>
                        {itemQualityRules.map((rule) => (
                          <option key={rule.id} value={rule.id}>
                            {rule.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </CollapsibleEditorSection>
              ) : null}

              <CollapsibleEditorSection
                title="Condition"
                summary={describeCondition(entry)}
                defaultOpen={false}
              >
                <p className="section-desc">
                  Optional DSL condition controlling whether this entry can roll.
                </p>
                <ConditionEditor
                  value={entry.condition || ""}
                  onChange={(value) => update(idx, { condition: value || undefined })}
                  placeholder='Optional, e.g. player.hasQuest("agri_intro")'
                />
              </CollapsibleEditorSection>
            </div>
          );
        })}
      </div>
      <button className="btn btn--sm" onClick={add}>
        + Add Loot Entry
      </button>
    </section>
  );
}
