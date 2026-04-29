import { ConditionEditor } from "../shared/ConditionEditor";
import { EventActionListEditor } from "../shared/EventActionListEditor";
import type {
  EventAction,
  EventActionTarget,
  ItemEventType,
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
  { value: "on_use", label: "On Use", desc: "When consumable is used via a Quick Slot" },
];

type HookLike<E extends string> = {
  id: string;
  event: E;
  intervalMs?: number;
  condition?: string;
  actions: EventAction[];
};

interface Props<E extends string> {
  hooks: HookLike<E>[];
  onChange: (hooks: HookLike<E>[]) => void;
  eventTypes?: Array<{ value: E; label: string; desc: string }>;
  defaultEvent?: E;
  title?: string;
  description?: string;
  addLabel?: string;
  supportsInterval?: boolean;
  actionTargetOptions?: Array<{ value: EventActionTarget; label: string }>;
}

let _hookId = 0;
function nextHookId() {
  return `hook_${Date.now()}_${_hookId++}`;
}

export function EventHooksPanel<E extends string = ItemEventType>({
  hooks,
  onChange,
  eventTypes = EVENT_TYPES as Array<{ value: E; label: string; desc: string }>,
  defaultEvent = "on_hit" as E,
  title = "Event Hooks",
  description = `Define what happens when game events fire while this item is equipped or used. Each hook fires on a specific event, optionally filtered by a DSL condition, and executes a list of actions.`,
  addLabel = "+ Add Event Hook",
  supportsInterval = false,
  actionTargetOptions,
}: Props<E>) {
  const addHook = () => {
    onChange([
      ...hooks,
      { id: nextHookId(), event: defaultEvent, actions: [] },
    ]);
  };

  const updateHook = (idx: number, patch: Partial<HookLike<E>>) => {
    const updated = [...hooks];
    updated[idx] = { ...updated[idx], ...patch };
    onChange(updated);
  };

  const removeHook = (idx: number) => {
    onChange(hooks.filter((_, i) => i !== idx));
  };

  return (
    <section className="editor-section">
      <h3 className="section-title">{title}</h3>
      <p className="section-desc">
        {description}
      </p>

      {hooks.map((hook, hIdx) => (
        <div key={hook.id} className="hook-card">
          <div className="hook-header">
            <select
              className="input select"
              value={hook.event}
              onChange={(e) =>
                updateHook(hIdx, {
                  event: e.target.value as E,
                  intervalMs: e.target.value === "on_interval" ? hook.intervalMs : undefined,
                })
              }
            >
              {eventTypes.map((et) => (
                <option key={et.value} value={et.value}>
                  {et.label}
                </option>
              ))}
            </select>
            <span className="hook-event-desc">
              {eventTypes.find((t) => t.value === hook.event)?.desc}
            </span>
            <button
              className="btn btn--danger btn--sm"
              onClick={() => removeHook(hIdx)}
            >
              Remove Hook
            </button>
          </div>

          {supportsInterval && hook.event === ("on_interval" as E) ? (
            <div className="hook-condition">
              <label className="field-label">Interval (ms)</label>
              <input
                type="number"
                min={1}
                className="input input--sm"
                value={hook.intervalMs ?? ""}
                onChange={(e) =>
                  updateHook(hIdx, {
                    intervalMs: e.target.value ? Math.max(1, Number(e.target.value)) : undefined,
                  })
                }
                placeholder="e.g. 1000"
              />
            </div>
          ) : null}

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
            <EventActionListEditor
              actions={hook.actions}
              onChange={(actions) => updateHook(hIdx, { actions })}
              emptyText="No actions on this hook."
              actionTargetOptions={actionTargetOptions}
            />
          </div>
        </div>
      ))}

      <button className="btn btn--primary" onClick={addHook}>
        {addLabel}
      </button>
    </section>
  );
}
