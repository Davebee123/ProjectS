import { useState } from "react";
import { PageShell } from "../layout/PageShell";
import { useTagStore } from "../../stores/tagStore";
import type { ActivityTagDef, AbilityTagDef } from "../../schema/types";

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function TagManagerPage() {
  const {
    activityTags,
    abilityTags,
    addActivityTag,
    updateActivityTag,
    removeActivityTag,
    addAbilityTag,
    updateAbilityTag,
    removeAbilityTag,
  } = useTagStore();

  const [newActivityLabel, setNewActivityLabel] = useState("");
  const [newAbilityLabel, setNewAbilityLabel] = useState("");

  const handleAddActivity = () => {
    const label = newActivityLabel.trim();
    if (!label) return;
    const id = slugify(label);
    if (activityTags.some((t) => t.id === id)) return;
    addActivityTag({ id, label, description: "", color: "#555555" });
    setNewActivityLabel("");
  };

  const handleAddAbility = () => {
    const label = newAbilityLabel.trim();
    if (!label) return;
    const id = slugify(label);
    if (abilityTags.some((t) => t.id === id)) return;
    addAbilityTag({ id, label, description: "" });
    setNewAbilityLabel("");
  };

  return (
    <PageShell title="Tag Manager">
      <section className="editor-section">
        <h3 className="section-title">Activity Tags</h3>
        <p className="section-desc">
          Activity tags categorize interactable types (e.g., tree, mine, fish).
        </p>
        <table className="editor-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Label</th>
              <th>Description</th>
              <th>Color</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {activityTags.map((tag) => (
              <ActivityTagRow
                key={tag.id}
                tag={tag}
                onUpdate={updateActivityTag}
                onRemove={removeActivityTag}
              />
            ))}
          </tbody>
        </table>
        <div className="add-row">
          <input
            type="text"
            placeholder="New activity tag label..."
            value={newActivityLabel}
            onChange={(e) => setNewActivityLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddActivity()}
            className="input"
          />
          <button className="btn btn--primary" onClick={handleAddActivity}>
            Add
          </button>
        </div>
      </section>

      <section className="editor-section">
        <h3 className="section-title">Ability Tags</h3>
        <p className="section-desc">
          Ability tags categorize player abilities (e.g., chop, mine, cast).
        </p>
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
            {abilityTags.map((tag) => (
              <AbilityTagRow
                key={tag.id}
                tag={tag}
                onUpdate={updateAbilityTag}
                onRemove={removeAbilityTag}
              />
            ))}
          </tbody>
        </table>
        <div className="add-row">
          <input
            type="text"
            placeholder="New ability tag label..."
            value={newAbilityLabel}
            onChange={(e) => setNewAbilityLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddAbility()}
            className="input"
          />
          <button className="btn btn--primary" onClick={handleAddAbility}>
            Add
          </button>
        </div>
      </section>
    </PageShell>
  );
}

function ActivityTagRow({
  tag,
  onUpdate,
  onRemove,
}: {
  tag: ActivityTagDef;
  onUpdate: (id: string, patch: Partial<ActivityTagDef>) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <tr>
      <td className="cell-id">{tag.id}</td>
      <td>
        <input
          className="input"
          value={tag.label}
          onChange={(e) => onUpdate(tag.id, { label: e.target.value })}
        />
      </td>
      <td>
        <input
          className="input"
          value={tag.description}
          onChange={(e) => onUpdate(tag.id, { description: e.target.value })}
          placeholder="Description..."
        />
      </td>
      <td>
        <input
          type="color"
          className="color-input"
          value={tag.color}
          onChange={(e) => onUpdate(tag.id, { color: e.target.value })}
        />
      </td>
      <td>
        <button className="btn btn--danger btn--sm" onClick={() => onRemove(tag.id)}>
          Remove
        </button>
      </td>
    </tr>
  );
}

function AbilityTagRow({
  tag,
  onUpdate,
  onRemove,
}: {
  tag: AbilityTagDef;
  onUpdate: (id: string, patch: Partial<AbilityTagDef>) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <tr>
      <td className="cell-id">{tag.id}</td>
      <td>
        <input
          className="input"
          value={tag.label}
          onChange={(e) => onUpdate(tag.id, { label: e.target.value })}
        />
      </td>
      <td>
        <input
          className="input"
          value={tag.description}
          onChange={(e) => onUpdate(tag.id, { description: e.target.value })}
          placeholder="Description..."
        />
      </td>
      <td>
        <button className="btn btn--danger btn--sm" onClick={() => onRemove(tag.id)}>
          Remove
        </button>
      </td>
    </tr>
  );
}
