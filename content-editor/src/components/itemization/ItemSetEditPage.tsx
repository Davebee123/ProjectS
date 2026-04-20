import { useNavigate, useParams } from "react-router-dom";
import { PageShell } from "../layout/PageShell";
import { CsvField, ModifierPayloadListEditor } from "./ItemizationEditors";
import { useItemizationStore } from "../../stores/itemizationStore";

export function ItemSetEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { itemSets, modifierStats, updateItemSet } = useItemizationStore();
  const itemSet = itemSets.find((entry) => entry.id === id);

  if (!itemSet) {
    return (
      <PageShell title="Item Set Not Found">
        <p>No item set with id "{id}".</p>
        <button className="btn" onClick={() => navigate("/itemization/sets")}>
          Back to Item Sets
        </button>
      </PageShell>
    );
  }

  const update = (patch: Parameters<typeof updateItemSet>[1]) => updateItemSet(itemSet.id, patch);

  return (
    <PageShell
      title={itemSet.name}
      actions={
        <button className="btn" onClick={() => navigate("/itemization/sets")}>
          Back to Item Sets
        </button>
      }
    >
      <section className="editor-section">
        <h3 className="section-title">Basic Properties</h3>
        <div className="form-grid">
          <div className="form-field">
            <label className="field-label">ID</label>
            <input className="input" value={itemSet.id} disabled />
          </div>
          <div className="form-field">
            <label className="field-label">Name</label>
            <input className="input" value={itemSet.name} onChange={(e) => update({ name: e.target.value })} />
          </div>
          <div className="form-field form-field--wide">
            <label className="field-label">Description</label>
            <input
              className="input"
              value={itemSet.description ?? ""}
              onChange={(e) => update({ description: e.target.value || undefined })}
            />
          </div>
          <CsvField
            label="Set Item IDs (CSV)"
            value={itemSet.itemIds}
            onChange={(itemIds) => update({ itemIds })}
            placeholder="hunter_blade, hunter_cloak"
          />
        </div>
      </section>

      <section className="editor-section">
        <div className="editor-subsection-header">
          <div>
            <h3 className="section-title" style={{ marginBottom: 0 }}>Set Bonuses</h3>
            <p className="section-desc">
              Author piece thresholds and their modifier payloads.
            </p>
          </div>
          <button
            className="btn btn--sm"
            onClick={() =>
              update({
                bonuses: [
                  ...itemSet.bonuses,
                  {
                    piecesRequired: itemSet.bonuses.length + 2,
                    modifiers: [],
                  },
                ],
              })
            }
          >
            + Add Bonus
          </button>
        </div>
        {itemSet.bonuses.map((bonus, index) => (
          <div key={`${itemSet.id}_bonus_${index}`} className="editor-subsection">
            <div className="editor-subsection-header">
              <h4 className="section-title" style={{ marginBottom: 0 }}>Bonus {index + 1}</h4>
              <button
                className="btn btn--danger btn--sm"
                onClick={() => update({ bonuses: itemSet.bonuses.filter((_, bonusIndex) => bonusIndex !== index) })}
              >
                Remove
              </button>
            </div>
            <div className="form-grid">
              <div className="form-field">
                <label className="field-label">Pieces Required</label>
                <input
                  type="number"
                  min={1}
                  className="input"
                  value={bonus.piecesRequired}
                  onChange={(e) =>
                    update({
                      bonuses: itemSet.bonuses.map((entry, bonusIndex) => (
                        bonusIndex === index
                          ? { ...entry, piecesRequired: Math.max(1, Number(e.target.value) || 1) }
                          : entry
                      )),
                    })
                  }
                />
              </div>
            </div>
            <ModifierPayloadListEditor
              title={`Bonus ${index + 1} Modifiers`}
              modifiers={bonus.modifiers}
              modifierStats={modifierStats}
              onChange={(modifiers) =>
                update({
                  bonuses: itemSet.bonuses.map((entry, bonusIndex) => (
                    bonusIndex === index ? { ...entry, modifiers } : entry
                  )),
                })
              }
            />
          </div>
        ))}
      </section>
    </PageShell>
  );
}
