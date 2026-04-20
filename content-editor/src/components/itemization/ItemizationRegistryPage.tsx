import { useState } from "react";
import { PageShell } from "../layout/PageShell";
import {
  createDefaultAffixTable,
  createDefaultItemClass,
  createDefaultItemQualityRule,
  createDefaultModifierStat,
  useItemizationStore,
} from "../../stores/itemizationStore";
import type {
  EquipmentSlot,
  ModifierOperation,
  ModifierStatCategory,
} from "../../schema/types";

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

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

const CATEGORY_OPTIONS: ModifierStatCategory[] = [
  "resource",
  "regen",
  "resistance",
  "damage",
  "timing",
  "cost",
  "utility",
];

const OPERATION_OPTIONS: ModifierOperation[] = ["add", "multiply"];

function parseCsv(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function ItemizationRegistryPage() {
  const {
    itemClasses,
    affixTables,
    modifierStats,
    itemQualityRules,
    addItemClass,
    updateItemClass,
    removeItemClass,
    addAffixTable,
    updateAffixTable,
    removeAffixTable,
    addModifierStat,
    updateModifierStat,
    removeModifierStat,
    addItemQualityRule,
    updateItemQualityRule,
    removeItemQualityRule,
  } = useItemizationStore();

  const [newClassName, setNewClassName] = useState("");
  const [newTableName, setNewTableName] = useState("");
  const [newStatName, setNewStatName] = useState("");
  const [newRuleName, setNewRuleName] = useState("");

  return (
    <PageShell title="Itemization Registries">
      <section className="editor-section">
        <div className="editor-subsection-header">
          <div>
            <h3 className="section-title" style={{ marginBottom: 0 }}>Item Classes</h3>
            <p className="section-desc">
              Registry of equip classes. Bases reference these instead of hardcoded enums.
            </p>
          </div>
        </div>
        <table className="editor-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Label</th>
              <th>Slot</th>
              <th>Handedness</th>
              <th>Tags</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {itemClasses.map((itemClass) => (
              <tr key={itemClass.id}>
                <td className="cell-id">{itemClass.id}</td>
                <td>
                  <input
                    className="input"
                    value={itemClass.label}
                    onChange={(e) => updateItemClass(itemClass.id, { label: e.target.value })}
                  />
                </td>
                <td>
                  <select
                    className="input select"
                    value={itemClass.slot}
                    onChange={(e) => updateItemClass(itemClass.id, { slot: e.target.value as EquipmentSlot })}
                  >
                    {SLOT_OPTIONS.map((slot) => (
                      <option key={slot} value={slot}>
                        {slot}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    className="input select"
                    value={itemClass.handedness ?? ""}
                    onChange={(e) =>
                      updateItemClass(itemClass.id, {
                        handedness: (e.target.value || undefined) as "one_hand" | "two_hand" | undefined,
                      })
                    }
                  >
                    <option value="">n/a</option>
                    <option value="one_hand">one_hand</option>
                    <option value="two_hand">two_hand</option>
                  </select>
                </td>
                <td>
                  <input
                    className="input"
                    value={(itemClass.tags ?? []).join(", ")}
                    onChange={(e) => updateItemClass(itemClass.id, { tags: parseCsv(e.target.value) })}
                  />
                </td>
                <td>
                  <button className="btn btn--danger btn--sm" onClick={() => removeItemClass(itemClass.id)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="add-row">
          <input
            className="input"
            value={newClassName}
            onChange={(e) => setNewClassName(e.target.value)}
            placeholder="New item class label..."
          />
          <button
            className="btn btn--primary"
            onClick={() => {
              const label = newClassName.trim();
              if (!label) return;
              const id = slugify(label);
              if (itemClasses.some((entry) => entry.id === id)) return;
              addItemClass(createDefaultItemClass(id, label));
              setNewClassName("");
            }}
          >
            Add Item Class
          </button>
        </div>
      </section>

      <section className="editor-section">
        <div className="editor-subsection-header">
          <div>
            <h3 className="section-title" style={{ marginBottom: 0 }}>Affix Tables</h3>
            <p className="section-desc">
              Pool registry used by item bases and affixes to control compatibility.
            </p>
          </div>
        </div>
        <table className="editor-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Label</th>
              <th>Description</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {affixTables.map((table) => (
              <tr key={table.id}>
                <td className="cell-id">{table.id}</td>
                <td>
                  <input
                    className="input"
                    value={table.label}
                    onChange={(e) => updateAffixTable(table.id, { label: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    className="input"
                    value={table.description ?? ""}
                    onChange={(e) => updateAffixTable(table.id, { description: e.target.value || undefined })}
                  />
                </td>
                <td>
                  <button className="btn btn--danger btn--sm" onClick={() => removeAffixTable(table.id)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="add-row">
          <input
            className="input"
            value={newTableName}
            onChange={(e) => setNewTableName(e.target.value)}
            placeholder="New affix table label..."
          />
          <button
            className="btn btn--primary"
            onClick={() => {
              const label = newTableName.trim();
              if (!label) return;
              const id = slugify(label);
              if (affixTables.some((entry) => entry.id === id)) return;
              addAffixTable(createDefaultAffixTable(id, label));
              setNewTableName("");
            }}
          >
            Add Affix Table
          </button>
        </div>
      </section>

      <section className="editor-section">
        <div className="editor-subsection-header">
          <div>
            <h3 className="section-title" style={{ marginBottom: 0 }}>Modifier Stats</h3>
            <p className="section-desc">
              Gameplay stat registry. New stats can be authored here and wired into runtime handling later.
            </p>
          </div>
        </div>
        <table className="editor-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Label</th>
              <th>Category</th>
              <th>Scoped</th>
              <th>Operations</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {modifierStats.map((stat) => (
              <tr key={stat.id}>
                <td className="cell-id">{stat.id}</td>
                <td>
                  <input
                    className="input"
                    value={stat.label}
                    onChange={(e) => updateModifierStat(stat.id, { label: e.target.value })}
                  />
                </td>
                <td>
                  <select
                    className="input select"
                    value={stat.category}
                    onChange={(e) => updateModifierStat(stat.id, { category: e.target.value as ModifierStatCategory })}
                  >
                    {CATEGORY_OPTIONS.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={stat.supportsScope}
                      onChange={(e) => updateModifierStat(stat.id, { supportsScope: e.target.checked })}
                    />
                    Supports scope
                  </label>
                </td>
                <td>
                  <div className="tag-list">
                    {OPERATION_OPTIONS.map((operation) => {
                      const selected = stat.supportedOperations.includes(operation);
                      return (
                        <button
                          key={operation}
                          type="button"
                          className={`tag-chip ${selected ? "tag-chip--selected" : ""}`}
                          onClick={() => {
                            const next = selected
                              ? stat.supportedOperations.filter((entry) => entry !== operation)
                              : [...stat.supportedOperations, operation];
                            updateModifierStat(stat.id, {
                              supportedOperations: next.length > 0 ? next : [operation],
                            });
                          }}
                        >
                          <span className="tag-chip-label">{operation}</span>
                        </button>
                      );
                    })}
                  </div>
                </td>
                <td>
                  <button className="btn btn--danger btn--sm" onClick={() => removeModifierStat(stat.id)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="add-row">
          <input
            className="input"
            value={newStatName}
            onChange={(e) => setNewStatName(e.target.value)}
            placeholder="New modifier stat label..."
          />
          <button
            className="btn btn--primary"
            onClick={() => {
              const label = newStatName.trim();
              if (!label) return;
              const id = slugify(label);
              if (modifierStats.some((entry) => entry.id === id)) return;
              addModifierStat(createDefaultModifierStat(id, label));
              setNewStatName("");
            }}
          >
            Add Modifier Stat
          </button>
        </div>
      </section>

      <section className="editor-section">
        <div className="editor-subsection-header">
          <div>
            <h3 className="section-title" style={{ marginBottom: 0 }}>Quality Rules</h3>
            <p className="section-desc">
              Author the item-level quality and rare-affix-count distributions here.
            </p>
          </div>
        </div>
        {itemQualityRules.map((rule) => (
          <div key={rule.id} className="editor-subsection">
            <div className="editor-subsection-header">
              <h4 className="section-title" style={{ marginBottom: 0 }}>{rule.label || rule.id}</h4>
              <button className="btn btn--danger btn--sm" onClick={() => removeItemQualityRule(rule.id)}>
                Remove
              </button>
            </div>
            <div className="form-grid">
              <div className="form-field">
                <label className="field-label">ID</label>
                <input className="input" value={rule.id} disabled />
              </div>
              <div className="form-field">
                <label className="field-label">Label</label>
                <input
                  className="input"
                  value={rule.label}
                  onChange={(e) => updateItemQualityRule(rule.id, { label: e.target.value })}
                />
              </div>
            </div>
            <table className="editor-table" style={{ marginTop: 16 }}>
              <thead>
                <tr>
                  <th>ILvl Min</th>
                  <th>ILvl Max</th>
                  <th>Common</th>
                  <th>Uncommon</th>
                  <th>Rare</th>
                  <th>2 Affix</th>
                  <th>3 Affix</th>
                  <th>4 Affix</th>
                  <th>5 Affix</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rule.bands.map((band, bandIndex) => (
                  <tr key={`${rule.id}_${bandIndex}`}>
                    <td>
                      <input
                        type="number"
                        className="input"
                        value={band.itemLevelMin}
                        onChange={(e) => {
                          const nextBands = rule.bands.map((entry, index) => (
                            index === bandIndex ? { ...entry, itemLevelMin: Number(e.target.value) || 1 } : entry
                          ));
                          updateItemQualityRule(rule.id, { bands: nextBands });
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="input"
                        value={band.itemLevelMax}
                        onChange={(e) => {
                          const nextBands = rule.bands.map((entry, index) => (
                            index === bandIndex ? { ...entry, itemLevelMax: Number(e.target.value) || 1 } : entry
                          ));
                          updateItemQualityRule(rule.id, { bands: nextBands });
                        }}
                      />
                    </td>
                    {(["common", "uncommon", "rare"] as const).map((quality) => (
                      <td key={quality}>
                        <input
                          type="number"
                          className="input"
                          value={band.qualityWeights[quality]}
                          onChange={(e) => {
                            const nextBands = rule.bands.map((entry, index) => (
                              index === bandIndex
                                ? {
                                    ...entry,
                                    qualityWeights: {
                                      ...entry.qualityWeights,
                                      [quality]: Math.max(0, Number(e.target.value) || 0),
                                    },
                                  }
                                : entry
                            ));
                            updateItemQualityRule(rule.id, { bands: nextBands });
                          }}
                        />
                      </td>
                    ))}
                    {[2, 3, 4, 5].map((count) => (
                      <td key={count}>
                        <input
                          type="number"
                          className="input"
                          value={band.rareAffixCountWeights?.[count as 2 | 3 | 4 | 5] ?? ""}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const nextWeights = { ...(band.rareAffixCountWeights ?? {}) };
                            if (raw === "") {
                              delete nextWeights[count as 2 | 3 | 4 | 5];
                            } else {
                              nextWeights[count as 2 | 3 | 4 | 5] = Math.max(0, Number(raw) || 0);
                            }
                            const nextBands = rule.bands.map((entry, index) => (
                              index === bandIndex
                                ? {
                                    ...entry,
                                    rareAffixCountWeights:
                                      Object.keys(nextWeights).length > 0 ? nextWeights : undefined,
                                  }
                                : entry
                            ));
                            updateItemQualityRule(rule.id, { bands: nextBands });
                          }}
                        />
                      </td>
                    ))}
                    <td>
                      <button
                        className="btn btn--danger btn--sm"
                        onClick={() => {
                          updateItemQualityRule(rule.id, {
                            bands: rule.bands.filter((_, index) => index !== bandIndex),
                          });
                        }}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              className="btn btn--sm"
              style={{ marginTop: 12 }}
              onClick={() =>
                updateItemQualityRule(rule.id, {
                  bands: [
                    ...rule.bands,
                    {
                      itemLevelMin: 1,
                      itemLevelMax: 1,
                      qualityWeights: { common: 100, uncommon: 0, rare: 0 },
                    },
                  ],
                })
              }
            >
              + Add Band
            </button>
          </div>
        ))}
        <div className="add-row">
          <input
            className="input"
            value={newRuleName}
            onChange={(e) => setNewRuleName(e.target.value)}
            placeholder="New quality rule label..."
          />
          <button
            className="btn btn--primary"
            onClick={() => {
              const label = newRuleName.trim();
              if (!label) return;
              const id = slugify(label);
              if (itemQualityRules.some((entry) => entry.id === id)) return;
              addItemQualityRule(createDefaultItemQualityRule(id, label));
              setNewRuleName("");
            }}
          >
            Add Quality Rule
          </button>
        </div>
      </section>
    </PageShell>
  );
}
