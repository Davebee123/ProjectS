import { useParams, useNavigate } from "react-router-dom";
import { PageShell } from "../layout/PageShell";
import { useInteractableStore } from "../../stores/interactableStore";
import { useTagStore } from "../../stores/tagStore";
import { SingleTagPicker, TagPicker } from "../shared/TagPicker";
import { ColorPicker } from "../shared/ColorPicker";
import { NumberRange } from "../shared/NumberRange";
import { AbilitiesPanel } from "./AbilitiesPanel";
import { LootTablePanel } from "./LootTablePanel";
import { XpRewardsPanel } from "./XpRewardsPanel";
import { StorageEffectsPanel } from "./StorageEffectsPanel";
import { ConditionEditor } from "../shared/ConditionEditor";

export function InteractableEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { interactables, updateInteractable } = useInteractableStore();
  const { activityTags, abilityTags } = useTagStore();
  const item = interactables.find((t) => t.id === id);

  if (!item) {
    return (
      <PageShell title="Not Found">
        <p>No interactable with id "{id}".</p>
        <button className="btn" onClick={() => navigate("/interactables")}>
          Back to Interactables
        </button>
      </PageShell>
    );
  }

  const update = (patch: Partial<typeof item>) =>
    updateInteractable(item.id, patch);

  return (
    <PageShell
      title={item.name}
      actions={
        <button className="btn" onClick={() => navigate("/interactables")}>
          Back to Interactables
        </button>
      }
    >
      {/* ── Basic Properties ── */}
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
              onChange={(e) => update({ name: e.target.value })}
            />
          </div>
          <div className="form-field form-field--wide">
            <label className="field-label">Description</label>
            <input
              className="input"
              value={item.description}
              onChange={(e) => update({ description: e.target.value })}
              placeholder="What this interactable does..."
            />
          </div>
          <div className="form-field">
            <SingleTagPicker
              label="Activity Tag"
              tags={activityTags}
              selected={item.activityTag}
              onChange={(activityTag) => update({ activityTag })}
            />
          </div>
          <div className="form-field">
            <label className="field-label">Required Level</label>
            <input
              type="number"
              className="input"
              value={item.requiredLevel}
              onChange={(e) =>
                update({ requiredLevel: Number(e.target.value) })
              }
            />
          </div>
          <div className="form-field">
            <label className="field-label">Folder</label>
            <input
              className="input"
              value={item.folder || ""}
              onChange={(e) => update({ folder: e.target.value || undefined })}
              placeholder="e.g. Trees, Enemies..."
            />
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <TagPicker
            label="Allowed Ability Tags"
            tags={abilityTags}
            selected={item.allowedAbilityTags}
            onChange={(allowedAbilityTags) => update({ allowedAbilityTags })}
          />
        </div>
      </section>

      {/* ── Health + Appearance ── */}
      <section className="editor-section">
        <h3 className="section-title">Health &amp; Appearance</h3>
        <div className="form-grid">
          <div className="form-field">
            <NumberRange
              label="Effective Health Range"
              min={item.effectiveHealth.min}
              max={item.effectiveHealth.max}
              onMinChange={(min) =>
                update({ effectiveHealth: { ...item.effectiveHealth, min } })
              }
              onMaxChange={(max) =>
                update({ effectiveHealth: { ...item.effectiveHealth, max } })
              }
            />
          </div>
          <div className="form-field">
            <label className="field-label">Meter Label</label>
            <input
              className="input"
              value={item.meterLabel}
              onChange={(e) => update({ meterLabel: e.target.value })}
              placeholder='e.g. "Integrity", "HP"'
            />
          </div>
          <div className="form-field">
            <ColorPicker
              label="Bar Color"
              value={item.barColor}
              onChange={(barColor) => update({ barColor })}
            />
          </div>
          <div className="form-field">
            <ColorPicker
              label="Accent Color"
              value={item.accentColor}
              onChange={(accentColor) => update({ accentColor })}
            />
          </div>
        </div>
      </section>

      {/* ── Spawn Condition ── */}
      <section className="editor-section">
        <h3 className="section-title">Spawn Condition</h3>
        <p className="section-desc">
          Optional DSL condition that must be true for this interactable to appear
          in spawn tables.
        </p>
        <ConditionEditor
          value={item.spawnCondition || ""}
          onChange={(v) =>
            update({ spawnCondition: v || undefined })
          }
          placeholder='e.g. skill("mining").level >= 5'
        />
      </section>

      {/* ── Abilities ── */}
      <AbilitiesPanel
        abilities={item.abilities}
        onChange={(abilities) => update({ abilities })}
      />

      {/* ── Loot Table ── */}
      <LootTablePanel
        entries={item.lootTable}
        onChange={(lootTable) => update({ lootTable })}
      />

      {/* ── XP Rewards ── */}
      <XpRewardsPanel
        rewards={item.xpRewards}
        onChange={(xpRewards) => update({ xpRewards })}
      />

      {/* ── Storage Effects ── */}
      <StorageEffectsPanel
        label="On Interact Effects"
        description="Storage effects triggered each time the player interacts with this object."
        effects={item.onInteractEffects}
        onChange={(onInteractEffects) => update({ onInteractEffects })}
      />

      <StorageEffectsPanel
        label="On Destroy Effects"
        description="Storage effects triggered when this interactable's health reaches zero."
        effects={item.onDestroyEffects}
        onChange={(onDestroyEffects) => update({ onDestroyEffects })}
      />
    </PageShell>
  );
}
