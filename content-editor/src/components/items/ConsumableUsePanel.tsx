import { ConditionEditor } from "../shared/ConditionEditor";
import { CollapsibleEditorSection } from "../shared/CollapsibleEditorSection";
import { EventActionListEditor } from "../shared/EventActionListEditor";
import { FilePathInput } from "../shared/FilePathInput";
import type { InventoryCategory, ItemEventHook } from "../../schema/types";

const CONSUMABLE_PRESETS = [
  "restore_health",
  "restore_energy",
  "restore_mana",
  "apply_status",
  "remove_status",
] as const;

let consumeHookId = 0;
function nextConsumeHookId() {
  return `on_use_${Date.now()}_${consumeHookId++}`;
}

interface Props {
  hooks: ItemEventHook[];
  inventoryCategory?: InventoryCategory;
  stackable: boolean;
  cooldownMs?: number;
  consumeSound?: string;
  consumeSoundVolume?: number;
  onChange: (hooks: ItemEventHook[]) => void;
  onMakeConsumable: () => void;
  onCooldownChange: (cooldownMs: number | undefined) => void;
  onConsumeSoundChange: (consumeSound: string | undefined) => void;
  onConsumeSoundVolumeChange: (consumeSoundVolume: number | undefined) => void;
}

export function ConsumableUsePanel({
  hooks,
  inventoryCategory,
  stackable,
  cooldownMs,
  consumeSound,
  consumeSoundVolume,
  onChange,
  onMakeConsumable,
  onCooldownChange,
  onConsumeSoundChange,
  onConsumeSoundVolumeChange,
}: Props) {
  const isQuickSlotReady = inventoryCategory === "consumables" && stackable;
  const summaryParts = [
    hooks.length ? `${hooks.length} consume rule${hooks.length === 1 ? "" : "s"}` : "No consume effects",
    consumeSound ? "sound" : null,
  ].filter(Boolean);
  const summary = summaryParts.join(" + ");

  const updateHook = (index: number, patch: Partial<ItemEventHook>) => {
    onChange(
      hooks.map((hook, hookIndex) =>
        hookIndex === index ? { ...hook, ...patch, event: "on_use" } : hook
      )
    );
  };

  const addHook = () => {
    onChange([
      ...hooks,
      {
        id: nextConsumeHookId(),
        event: "on_use",
        actions: [],
      },
    ]);
  };

  const removeHook = (index: number) => {
    onChange(hooks.filter((_, hookIndex) => hookIndex !== index));
  };

  return (
    <CollapsibleEditorSection
      title="Consumable Use"
      summary={summary}
      defaultOpen={isQuickSlotReady || hooks.length > 0}
    >
      <p className="section-desc">
        Consumables are stackable items in the Consumables category. The player binds one to a
        quick slot, clicks it, consumes one item, then these On Use actions fire.
      </p>

      <div className="form-grid" style={{ marginBottom: 14 }}>
        <div className="form-field">
          <label className="field-label">Quick Slot Status</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span className={`status-badge ${isQuickSlotReady ? "status-badge--ready" : "status-badge--issue"}`}>
              {isQuickSlotReady ? "Ready" : "Needs setup"}
            </span>
            {!isQuickSlotReady ? (
              <button type="button" className="btn btn--sm" onClick={onMakeConsumable}>
                Make Quick-Slot Consumable
              </button>
            ) : null}
          </div>
          <p className="section-desc" style={{ marginTop: 6 }}>
            Requires category: Consumables and Stackable: Yes.
          </p>
        </div>

        <div className="form-field">
          <label className="field-label">Quick Slot Cooldown (ms)</label>
          <input
            className="input"
            type="number"
            min={0}
            step={100}
            value={cooldownMs ?? 0}
            onChange={(e) => {
              const value = Number(e.target.value);
              onCooldownChange(Number.isFinite(value) && value > 0 ? value : undefined);
            }}
            placeholder="0 for no cooldown"
          />
        </div>

        <FilePathInput
          label="Consume Sound"
          value={consumeSound || ""}
          onChange={(value) => onConsumeSoundChange(value || undefined)}
          placeholder="Sound Files/Consume.wav"
          accept="audio/*"
          pathPrefix="Sound Files"
        />

        <label className="field">
          <span className="field-label">Consume Volume</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={consumeSoundVolume ?? 1}
              disabled={!consumeSound}
              onChange={(e) => {
                const value = Number(e.target.value);
                onConsumeSoundVolumeChange(Number.isFinite(value) ? value : undefined);
              }}
              style={{ flex: 1 }}
            />
            <span style={{ minWidth: 36, textAlign: "right", fontSize: "0.85rem", color: "var(--text-soft)" }}>
              {Math.round((consumeSoundVolume ?? 1) * 100)}%
            </span>
          </div>
        </label>
      </div>

      {hooks.length === 0 ? (
        <p className="section-desc">No consume effects configured yet.</p>
      ) : (
        hooks.map((hook, index) => (
          <div key={hook.id} className="hook-card">
            <div className="hook-header">
              <strong>Consume Rule {index + 1}</strong>
              <span className="hook-event-desc">
                Optional condition gates the effects, not the item consumption.
              </span>
              <button
                type="button"
                className="btn btn--danger btn--sm"
                onClick={() => removeHook(index)}
              >
                Remove Rule
              </button>
            </div>

            <div className="hook-condition">
              <label className="field-label">Condition (optional)</label>
              <ConditionEditor
                value={hook.condition || ""}
                onChange={(value) => updateHook(index, { condition: value || undefined })}
                placeholder='e.g. NOT player.has_status("well_fed")'
              />
            </div>

            <div className="hook-actions">
              <label className="field-label">Consume Actions</label>
              <EventActionListEditor
                actions={hook.actions}
                onChange={(actions) => updateHook(index, { actions })}
                emptyText="No actions on this consume rule."
                presetIds={[...CONSUMABLE_PRESETS]}
              />
            </div>
          </div>
        ))
      )}

      <button type="button" className="btn btn--primary" onClick={addHook}>
        + Add Consume Rule
      </button>
    </CollapsibleEditorSection>
  );
}
