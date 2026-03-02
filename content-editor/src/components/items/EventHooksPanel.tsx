import { useStatusEffectStore } from "../../stores/statusEffectStore";
import { useSkillStore } from "../../stores/skillStore";
import { useStorageKeyStore } from "../../stores/storageKeyStore";
import { ConditionEditor } from "../shared/ConditionEditor";
import type {
  ItemEventHook,
  ItemEventType,
  EventAction,
  EventActionType,
} from "../../schema/types";

const EVENT_TYPES: { value: ItemEventType; label: string; desc: string }[] = [
  { value: "on_equip", label: "On Equip", desc: "When item is equipped" },
  { value: "on_unequip", label: "On Unequip", desc: "When item is unequipped" },
  { value: "on_hit", label: "On Hit", desc: "When player lands a hit with this equipped" },
  { value: "on_kill", label: "On Kill", desc: "When player destroys an interactable" },
  { value: "on_interact", label: "On Interact", desc: "When player interacts with anything" },
  { value: "on_explore", label: "On Explore", desc: "When player explores a room" },
  { value: "on_damage_taken", label: "On Damage Taken", desc: "When player takes damage" },
  { value: "on_tick", label: "On Tick", desc: "Every game tick while equipped" },
];

const ACTION_TYPES: { value: EventActionType; label: string }[] = [
  { value: "apply_status", label: "Apply Status Effect" },
  { value: "remove_status", label: "Remove Status Effect" },
  { value: "deal_bonus_damage", label: "Deal Bonus Damage" },
  { value: "heal", label: "Heal HP" },
  { value: "restore_energy", label: "Restore Energy" },
  { value: "grant_xp", label: "Grant XP" },
  { value: "set_storage", label: "Set Storage Key" },
  { value: "custom", label: "Custom Script" },
];

interface Props {
  hooks: ItemEventHook[];
  onChange: (hooks: ItemEventHook[]) => void;
}

let _hookId = 0;
function nextHookId() {
  return `hook_${Date.now()}_${_hookId++}`;
}

export function EventHooksPanel({ hooks, onChange }: Props) {
  const { statusEffects } = useStatusEffectStore();
  const { skills } = useSkillStore();
  const { storageKeys } = useStorageKeyStore();

  const addHook = () => {
    onChange([
      ...hooks,
      { id: nextHookId(), event: "on_hit", actions: [] },
    ]);
  };

  const updateHook = (idx: number, patch: Partial<ItemEventHook>) => {
    const updated = [...hooks];
    updated[idx] = { ...updated[idx], ...patch };
    onChange(updated);
  };

  const removeHook = (idx: number) => {
    onChange(hooks.filter((_, i) => i !== idx));
  };

  const addAction = (hookIdx: number) => {
    const hook = hooks[hookIdx];
    updateHook(hookIdx, {
      actions: [...hook.actions, { type: "apply_status" }],
    });
  };

  const updateAction = (hookIdx: number, actIdx: number, patch: Partial<EventAction>) => {
    const hook = hooks[hookIdx];
    const actions = [...hook.actions];
    actions[actIdx] = { ...actions[actIdx], ...patch };
    updateHook(hookIdx, { actions });
  };

  const removeAction = (hookIdx: number, actIdx: number) => {
    const hook = hooks[hookIdx];
    updateHook(hookIdx, {
      actions: hook.actions.filter((_, i) => i !== actIdx),
    });
  };

  return (
    <section className="editor-section">
      <h3 className="section-title">Event Hooks</h3>
      <p className="section-desc">
        Define what happens when game events fire while this item is equipped or
        used. Each hook fires on a specific event, optionally filtered by a DSL
        condition, and executes a list of actions.
      </p>

      {hooks.map((hook, hIdx) => (
        <div key={hook.id} className="hook-card">
          <div className="hook-header">
            <select
              className="input select"
              value={hook.event}
              onChange={(e) =>
                updateHook(hIdx, { event: e.target.value as ItemEventType })
              }
            >
              {EVENT_TYPES.map((et) => (
                <option key={et.value} value={et.value}>
                  {et.label}
                </option>
              ))}
            </select>
            <span className="hook-event-desc">
              {EVENT_TYPES.find((t) => t.value === hook.event)?.desc}
            </span>
            <button
              className="btn btn--danger btn--sm"
              onClick={() => removeHook(hIdx)}
            >
              Remove Hook
            </button>
          </div>

          <div className="hook-condition">
            <label className="field-label">Condition (optional)</label>
            <ConditionEditor
              value={hook.condition || ""}
              onChange={(v) =>
                updateHook(hIdx, { condition: v || undefined })
              }
              placeholder='e.g. target.tag == "tree" AND player.counter("hits") >= 5'
            />
          </div>

          <div className="hook-actions">
            <label className="field-label">Actions</label>
            {hook.actions.map((action, aIdx) => (
              <ActionRow
                key={aIdx}
                action={action}
                statusEffects={statusEffects}
                skills={skills}
                storageKeys={storageKeys}
                onUpdate={(patch) => updateAction(hIdx, aIdx, patch)}
                onRemove={() => removeAction(hIdx, aIdx)}
              />
            ))}
            <button className="btn btn--sm" onClick={() => addAction(hIdx)}>
              + Add Action
            </button>
          </div>
        </div>
      ))}

      <button className="btn btn--primary" onClick={addHook}>
        + Add Event Hook
      </button>
    </section>
  );
}

function ActionRow({
  action,
  statusEffects,
  skills,
  storageKeys,
  onUpdate,
  onRemove,
}: {
  action: EventAction;
  statusEffects: { id: string; name: string }[];
  skills: { id: string; name: string }[];
  storageKeys: { id: string; label: string }[];
  onUpdate: (patch: Partial<EventAction>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="action-row">
      <select
        className="input select"
        value={action.type}
        onChange={(e) => onUpdate({ type: e.target.value as EventActionType })}
      >
        {ACTION_TYPES.map((at) => (
          <option key={at.value} value={at.value}>
            {at.label}
          </option>
        ))}
      </select>

      {(action.type === "apply_status" || action.type === "remove_status") && (
        <select
          className="input select"
          value={action.statusEffectId || ""}
          onChange={(e) => onUpdate({ statusEffectId: e.target.value })}
        >
          <option value="">-- Select effect --</option>
          {statusEffects.map((fx) => (
            <option key={fx.id} value={fx.id}>
              {fx.name}
            </option>
          ))}
        </select>
      )}

      {(action.type === "deal_bonus_damage" ||
        action.type === "heal" ||
        action.type === "restore_energy") && (
        <input
          type="number"
          className="input input--sm"
          placeholder="Amount"
          value={action.value as number ?? ""}
          onChange={(e) => onUpdate({ value: Number(e.target.value) })}
        />
      )}

      {action.type === "grant_xp" && (
        <>
          <select
            className="input select"
            value={action.targetSkillId || ""}
            onChange={(e) => onUpdate({ targetSkillId: e.target.value })}
          >
            <option value="">-- Select skill --</option>
            {skills.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            className="input input--sm"
            placeholder="XP"
            value={action.value as number ?? ""}
            onChange={(e) => onUpdate({ value: Number(e.target.value) })}
          />
        </>
      )}

      {action.type === "set_storage" && (
        <>
          <select
            className="input select"
            value={action.storageKeyId || ""}
            onChange={(e) => onUpdate({ storageKeyId: e.target.value })}
          >
            <option value="">-- Select key --</option>
            {storageKeys.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
          <select
            className="input select"
            value={action.storageOperation || "set"}
            onChange={(e) =>
              onUpdate({ storageOperation: e.target.value as "set" | "increment" | "decrement" | "toggle" })
            }
          >
            <option value="set">Set</option>
            <option value="increment">Increment</option>
            <option value="decrement">Decrement</option>
            <option value="toggle">Toggle</option>
          </select>
          <input
            className="input input--sm"
            placeholder="Value"
            value={String(action.value ?? "")}
            onChange={(e) => onUpdate({ value: e.target.value })}
          />
        </>
      )}

      {action.type === "custom" && (
        <input
          className="input input--code"
          style={{ flex: 1 }}
          value={action.customScript || ""}
          onChange={(e) => onUpdate({ customScript: e.target.value })}
          placeholder="Freeform DSL script..."
        />
      )}

      <button className="btn btn--danger btn--sm" onClick={onRemove}>
        X
      </button>
    </div>
  );
}
