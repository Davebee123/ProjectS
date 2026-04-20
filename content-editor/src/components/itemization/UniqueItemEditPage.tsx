import { useNavigate, useParams } from "react-router-dom";
import { PageShell } from "../layout/PageShell";
import { CsvField, ItemRequirementsEditor, ModifierPayloadListEditor } from "./ItemizationEditors";
import { useItemizationStore } from "../../stores/itemizationStore";
import { useSkillStore } from "../../stores/skillStore";

export function UniqueItemEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { uniqueItems, itemBases, modifierStats, updateUniqueItem } = useItemizationStore();
  const skills = useSkillStore((state) => state.skills);
  const skillIds = Array.isArray(skills) ? skills.map((skill) => skill.id) : [];
  const item = uniqueItems.find((entry) => entry.id === id);

  if (!item) {
    return (
      <PageShell title="Unique Item Not Found">
        <p>No unique item with id "{id}".</p>
        <button className="btn" onClick={() => navigate("/itemization/uniques")}>
          Back to Unique Items
        </button>
      </PageShell>
    );
  }

  const update = (patch: Parameters<typeof updateUniqueItem>[1]) => updateUniqueItem(item.id, patch);

  return (
    <PageShell
      title={item.name}
      actions={
        <button className="btn" onClick={() => navigate("/itemization/uniques")}>
          Back to Unique Items
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
            <input className="input" value={item.name} onChange={(e) => update({ name: e.target.value })} />
          </div>
          <div className="form-field form-field--wide">
            <label className="field-label">Description</label>
            <input
              className="input"
              value={item.description}
              onChange={(e) => update({ description: e.target.value })}
            />
          </div>
          <div className="form-field form-field--wide">
            <label className="field-label">Additional Effects Text</label>
            <input
              className="input"
              value={item.additionalEffectsText ?? ""}
              onChange={(e) => update({ additionalEffectsText: e.target.value || undefined })}
              placeholder="Optional freeform effect text shown below stats"
            />
          </div>
          <div className="form-field">
            <label className="field-label">Folder</label>
            <input
              className="input"
              value={item.folder ?? ""}
              onChange={(e) => update({ folder: e.target.value || undefined })}
              placeholder="weapons"
            />
          </div>
          <div className="form-field">
            <label className="field-label">Image</label>
            <input
              className="input"
              value={item.image ?? ""}
              onChange={(e) => update({ image: e.target.value || undefined })}
              placeholder="/icons/items/unique.png"
            />
          </div>
          <div className="form-field">
            <label className="field-label">Base Item</label>
            <select
              className="input select"
              value={item.baseId}
              onChange={(e) => update({ baseId: e.target.value })}
            >
              {itemBases.map((itemBase) => (
                <option key={itemBase.id} value={itemBase.id}>
                  {itemBase.name}
                </option>
              ))}
            </select>
          </div>
          <CsvField
            label="Tags (CSV)"
            value={item.tags}
            onChange={(values) => update({ tags: values })}
            placeholder="boss_drop, dagger"
          />
        </div>
      </section>

      <ItemRequirementsEditor
        requirements={item.requirementsOverride}
        skillIds={skillIds}
        onChange={(requirementsOverride) => update({ requirementsOverride })}
      />

      <ModifierPayloadListEditor
        title="Unique Modifiers"
        modifiers={item.modifiers}
        modifierStats={modifierStats}
        onChange={(modifiers) => update({ modifiers })}
      />
    </PageShell>
  );
}
