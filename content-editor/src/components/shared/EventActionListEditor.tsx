import { useNavigate } from "react-router-dom";
import { createDefaultCutscene, useCutsceneStore } from "../../stores/cutsceneStore";
import { createDefaultInteractable, useInteractableStore } from "../../stores/interactableStore";
import { createDefaultItem, useItemStore } from "../../stores/itemStore";
import { createDefaultQuest, useQuestStore } from "../../stores/questStore";
import { useSkillStore } from "../../stores/skillStore";
import { createDefaultStatusEffect, useStatusEffectStore } from "../../stores/statusEffectStore";
import { useStorageKeyStore } from "../../stores/storageKeyStore";
import { createDefaultRoom, useWorldStore } from "../../stores/worldStore";
import type { EventAction, EventActionTarget, EventActionType } from "../../schema/types";
import { ConditionEditor } from "./ConditionEditor";
import { ReferencePicker } from "./ReferencePicker";
import { createUniqueId } from "../../utils/ids";

const ACTION_TYPES: { value: EventActionType; label: string }[] = [
  { value: "apply_status", label: "Apply Status Effect" },
  { value: "remove_status", label: "Remove Status Effect" },
  { value: "transform_interactable", label: "Transform Interactable" },
  { value: "spawn_interactable", label: "Spawn Interactable" },
  { value: "show_emote", label: "Show Emote" },
  { value: "complete_quest", label: "Complete Quest" },
  { value: "damage", label: "Damage" },
  { value: "heal", label: "Restore Health" },
  { value: "restore_mana", label: "Restore Mana" },
  { value: "restore_energy", label: "Restore Energy" },
  { value: "damage_mana", label: "Lose Mana" },
  { value: "damage_energy", label: "Lose Energy" },
  { value: "grant_xp", label: "Grant XP" },
  { value: "grant_item", label: "Grant Item" },
  { value: "grant_quest", label: "Grant Quest" },
  { value: "travel_to_room", label: "Travel To Room" },
  { value: "start_cutscene", label: "Start Cutscene" },
  { value: "set_storage", label: "Set Storage Key" },
  { value: "deal_bonus_damage", label: "Bonus Damage" },
  { value: "custom", label: "Custom Script" },
];

function createDefaultAction(): EventAction {
  return { type: "set_storage" };
}

type ActionPreset =
  | "accept_quest"
  | "complete_quest"
  | "give_item"
  | "give_xp"
  | "set_flag"
  | "apply_status"
  | "remove_status"
  | "restore_health"
  | "restore_energy"
  | "restore_mana"
  | "show_emote"
  | "spawn_interactable"
  | "travel_to_room"
  | "start_cutscene";

const ACTION_PRESET_DEFINITIONS: Record<ActionPreset, {
  id: ActionPreset;
  label: string;
  description: string;
}> = {
  restore_health: { id: "restore_health", label: "Restore Health", description: "Restore player health" },
  restore_energy: { id: "restore_energy", label: "Restore Energy", description: "Restore player energy" },
  restore_mana: { id: "restore_mana", label: "Restore Mana", description: "Restore player mana" },
  accept_quest: { id: "accept_quest", label: "Accept Quest", description: "Grant a quest directly" },
  complete_quest: { id: "complete_quest", label: "Complete Quest", description: "Mark a quest complete directly" },
  give_item: { id: "give_item", label: "Give Item", description: "Award an item to inventory" },
  give_xp: { id: "give_xp", label: "Give XP", description: "Award skill experience" },
  set_flag: { id: "set_flag", label: "Set Flag", description: "Turn on a storage flag" },
  apply_status: { id: "apply_status", label: "Apply Status", description: "Apply a status effect" },
  remove_status: { id: "remove_status", label: "Remove Status", description: "Remove a status effect" },
  show_emote: { id: "show_emote", label: "Show Emote", description: "Show a short text bubble over an interactable" },
  spawn_interactable: { id: "spawn_interactable", label: "Spawn Interactable", description: "Create a live interactable in the current room" },
  travel_to_room: { id: "travel_to_room", label: "Travel", description: "Move the player to another room" },
  start_cutscene: { id: "start_cutscene", label: "Start Cutscene", description: "Launch a narrative cutscene" },
};

const DEFAULT_ACTION_PRESET_IDS: ActionPreset[] = [
  "accept_quest",
  "complete_quest",
  "give_item",
  "give_xp",
  "set_flag",
  "apply_status",
  "show_emote",
  "spawn_interactable",
  "travel_to_room",
  "start_cutscene",
];

interface Props {
  actions: EventAction[];
  onChange: (actions: EventAction[]) => void;
  emptyText?: string;
  actionTargetOptions?: Array<{ value: EventActionTarget; label: string }>;
  presetIds?: ActionPreset[] | false;
}

const TARGETABLE_ACTIONS = new Set<EventActionType>([
  "apply_status",
  "remove_status",
  "transform_interactable",
  "show_emote",
  "damage",
  "heal",
]);

export function EventActionListEditor({
  actions,
  onChange,
  emptyText = "No actions configured.",
  actionTargetOptions,
  presetIds,
}: Props) {
  const navigate = useNavigate();
  const { statusEffects, addStatusEffect } = useStatusEffectStore();
  const { interactables, addInteractable } = useInteractableStore();
  const { skills } = useSkillStore();
  const { storageKeys } = useStorageKeyStore();
  const { items, addItem } = useItemStore();
  const { quests, addQuest } = useQuestStore();
  const { cutscenes, addCutscene } = useCutsceneStore();
  const { world, addRoom } = useWorldStore();

  const firstFlagKeyId = storageKeys.find((key) => key.type === "flag")?.id ?? storageKeys[0]?.id;
  const firstOtherRoomId = world.rooms.find((room) => room.id !== world.startingRoomId)?.id ?? world.rooms[0]?.id;
  const statusEffectOptions = statusEffects.map((effect) => ({
    id: effect.id,
    label: effect.name,
    meta: `${effect.folder || "status"} • ${effect.removalType}${effect.durationMs ? ` • ${(effect.durationMs / 1000).toFixed(1)}s` : ""}`,
    description: effect.description || undefined,
  }));
  const skillOptions = skills.map((skill) => ({
    id: skill.id,
    label: skill.name,
    meta: `${skill.kind} • ${skill.system || "gathering"}`,
  }));
  const itemOptions = items.map((item) => ({
    id: item.id,
    label: item.name,
    meta: `${item.inventoryCategory || "misc"} • ${item.rarity || "common"}${item.slot ? ` • ${item.slot}` : ""}`,
    description: item.description || undefined,
  }));
  const questOptions = quests.map((quest) => ({
    id: quest.id,
    label: quest.name,
    meta: `${quest.category} • Level ${quest.level}`,
    description: quest.description || undefined,
  }));
  const roomOptions = world.rooms.map((room) => ({
    id: room.id,
    label: room.name,
    meta: `(${room.gridX}, ${room.gridY})${room.level ? ` • Level ${room.level}` : ""}`,
  }));
  const interactableOptions = interactables.map((interactable) => ({
    id: interactable.id,
    label: interactable.name,
    meta: `${interactable.activityTag || "none"}${interactable.requiredLevel ? ` • Level ${interactable.requiredLevel}` : ""}`,
    description: interactable.description || undefined,
  }));
  const cutsceneOptions = cutscenes.map((cutscene) => ({
    id: cutscene.id,
    label: cutscene.name,
    meta: `${cutscene.folder || "cutscenes"} • ${cutscene.steps.length} step${cutscene.steps.length === 1 ? "" : "s"}`,
    description: cutscene.description || undefined,
  }));

  const createStatusEffect = (name: string) => {
    const id = createUniqueId(name, statusEffects.map((effect) => effect.id));
    addStatusEffect(createDefaultStatusEffect(id, name));
    return id;
  };

  const createItem = (name: string) => {
    const id = createUniqueId(name, items.map((item) => item.id));
    addItem(createDefaultItem(id, name));
    return id;
  };

  const createInteractable = (name: string) => {
    const id = createUniqueId(name, interactables.map((interactable) => interactable.id));
    addInteractable(createDefaultInteractable(id, name));
    return id;
  };

  const createQuest = (name: string) => {
    const id = createUniqueId(name, quests.map((quest) => quest.id));
    addQuest(createDefaultQuest(id, name));
    return id;
  };

  const createRoom = (name: string) => {
    const id = createUniqueId(name, world.rooms.map((room) => room.id));
    const occupied = new Set(world.rooms.map((room) => `${room.gridX},${room.gridY}`));
    let gridX = 0;
    let gridY = 0;

    outer: for (let y = 0; y < world.gridHeight; y += 1) {
      for (let x = 0; x < world.gridWidth; x += 1) {
        if (!occupied.has(`${x},${y}`)) {
          gridX = x;
          gridY = y;
          break outer;
        }
      }
    }

    addRoom(createDefaultRoom(id, name, gridX, gridY, world.defaultSlotCount));
    return id;
  };

  const createCutscene = (name: string) => {
    const id = createUniqueId(name, cutscenes.map((cutscene) => cutscene.id));
    addCutscene(createDefaultCutscene(id, name));
    return id;
  };

  const createPresetAction = (preset: ActionPreset): EventAction | null => {
    switch (preset) {
      case "restore_health":
        return { type: "heal", value: 25 };
      case "restore_energy":
        return { type: "restore_energy", value: 25 };
      case "restore_mana":
        return { type: "restore_mana", value: 25 };
      case "accept_quest":
        return quests[0] ? { type: "grant_quest", questId: quests[0].id } : null;
      case "complete_quest":
        return quests[0] ? { type: "complete_quest", questId: quests[0].id } : null;
      case "give_item":
        return items[0] ? { type: "grant_item", itemId: items[0].id, quantity: 1 } : null;
      case "give_xp":
        return skills[0] ? { type: "grant_xp", targetSkillId: skills[0].id, value: 10 } : null;
      case "set_flag":
        return firstFlagKeyId
          ? { type: "set_storage", storageKeyId: firstFlagKeyId, storageOperation: "set", value: true }
          : null;
      case "apply_status":
        return statusEffects[0] ? { type: "apply_status", statusEffectId: statusEffects[0].id } : null;
      case "remove_status":
        return statusEffects[0] ? { type: "remove_status", statusEffectId: statusEffects[0].id } : null;
      case "show_emote":
        return { type: "show_emote", target: "bearer", emoteText: "...", emoteChance: 100 };
      case "spawn_interactable":
        return interactables[0] ? { type: "spawn_interactable", interactableId: interactables[0].id } : null;
      case "travel_to_room":
        return firstOtherRoomId ? { type: "travel_to_room", roomId: firstOtherRoomId } : null;
      case "start_cutscene":
        return cutscenes[0] ? { type: "start_cutscene", cutsceneId: cutscenes[0].id } : null;
    }
  };

  const updateAction = (index: number, patch: Partial<EventAction>) => {
    const next = [...actions];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const removeAction = (index: number) => {
    onChange(actions.filter((_, actionIndex) => actionIndex !== index));
  };

  const addAction = () => {
    onChange([...actions, createDefaultAction()]);
  };

  const addPresetAction = (preset: ActionPreset) => {
    const action = createPresetAction(preset);
    if (!action) return;
    onChange([...actions, action]);
  };

  const visiblePresets =
    presetIds === false
      ? []
      : (presetIds ?? DEFAULT_ACTION_PRESET_IDS).map((id) => ACTION_PRESET_DEFINITIONS[id]);

  return (
    <div className="stack-lg">
      {visiblePresets.length > 0 ? (
        <div className="action-preset-block">
          <div className="field-label">Quick Add</div>
          <div className="action-preset-row">
            {visiblePresets.map((preset) => {
              const isDisabled = !createPresetAction(preset.id);
              return (
                <button
                  key={preset.id}
                  type="button"
                  className="action-preset-button"
                  title={preset.description}
                  disabled={isDisabled}
                  onClick={() => addPresetAction(preset.id)}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {actions.length === 0 ? (
        <p className="section-desc" style={{ marginBottom: 0 }}>
          {emptyText}
        </p>
      ) : (
        actions.map((action, actionIndex) => (
          <div key={`${action.type}_${actionIndex}`} className="action-editor-card">
            <div className="action-row">
              <select
                className="input select"
                value={action.type}
                onChange={(e) => {
                  const nextType = e.target.value as EventActionType;
                  updateAction(actionIndex, {
                    type: nextType,
                    target: nextType === "show_emote" ? "bearer" : action.target,
                  });
                }}
              >
                {ACTION_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>

              {actionTargetOptions && TARGETABLE_ACTIONS.has(action.type) ? (
                <select
                  className="input select"
                  value={action.target || "player"}
                  onChange={(e) =>
                    updateAction(actionIndex, {
                      target: (e.target.value as EventActionTarget) === "player"
                        ? undefined
                        : (e.target.value as EventActionTarget),
                    })
                  }
                >
                  {actionTargetOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : null}

              {(action.type === "apply_status" || action.type === "remove_status") ? (
                <ReferencePicker
                  value={action.statusEffectId || ""}
                  options={statusEffectOptions}
                  compact
                  showSelectedPreview={false}
                  placeholder="Select effect..."
                  onChange={(value) => updateAction(actionIndex, { statusEffectId: value || undefined })}
                  onOpenSelected={(value) => navigate(`/status-effects/${value}`)}
                  onCreate={createStatusEffect}
                  createPlaceholder="New status effect name..."
                />
              ) : null}

              {(action.type === "transform_interactable" || action.type === "spawn_interactable") ? (
                <ReferencePicker
                  value={action.interactableId || ""}
                  options={interactableOptions}
                  compact
                  showSelectedPreview={false}
                  placeholder="Select interactable..."
                  onChange={(value) => updateAction(actionIndex, { interactableId: value || undefined })}
                  onOpenSelected={(value) => navigate(`/interactables/${value}`)}
                  onCreate={createInteractable}
                  createPlaceholder="New interactable name..."
                />
              ) : null}

              {action.type === "spawn_interactable" ? (
                <input
                  type="number"
                  min={0}
                  className="input input--sm"
                  placeholder="Reveal ms"
                  title="Optional fade-in duration for the spawned interactable."
                  value={typeof action.durationMs === "number" ? action.durationMs : ""}
                  onChange={(e) =>
                    updateAction(actionIndex, {
                      durationMs: e.target.value === "" ? undefined : Math.max(0, Number(e.target.value)),
                    })
                  }
                />
              ) : null}

              {(action.type === "damage" ||
                action.type === "heal" ||
                action.type === "restore_mana" ||
                action.type === "restore_energy" ||
                action.type === "damage_mana" ||
                action.type === "damage_energy" ||
                action.type === "deal_bonus_damage") ? (
                <input
                  type="number"
                  className="input input--sm"
                  placeholder="Amount"
                  value={typeof action.value === "number" ? action.value : ""}
                  onChange={(e) => updateAction(actionIndex, { value: Number(e.target.value) })}
                />
              ) : null}

              {action.type === "show_emote" ? (
                <>
                  <input
                    className="input"
                    style={{ flex: 1 }}
                    placeholder="Emote text..."
                    value={action.emoteText || ""}
                    onChange={(e) => updateAction(actionIndex, { emoteText: e.target.value || undefined })}
                  />
                  <input
                    type="number"
                    min={600}
                    className="input input--sm"
                    placeholder="ms"
                    value={action.durationMs ?? ""}
                    onChange={(e) =>
                      updateAction(actionIndex, {
                        durationMs: e.target.value === "" ? undefined : Number(e.target.value),
                      })
                    }
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="input input--sm"
                    placeholder="%"
                    value={action.emoteChance ?? 100}
                    onChange={(e) =>
                      updateAction(actionIndex, {
                        emoteChance: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                      })
                    }
                  />
                </>
              ) : null}

              {action.type === "grant_xp" ? (
                <>
                  <ReferencePicker
                    value={action.targetSkillId || ""}
                    options={skillOptions}
                    compact
                    showSelectedPreview={false}
                    placeholder="Select skill..."
                    onChange={(value) => updateAction(actionIndex, { targetSkillId: value || undefined })}
                    onOpenSelected={(value) => navigate(`/skills/${value}`)}
                  />
                  <input
                    type="number"
                    className="input input--sm"
                    placeholder="XP"
                    value={typeof action.value === "number" ? action.value : ""}
                    onChange={(e) => updateAction(actionIndex, { value: Number(e.target.value) })}
                  />
                </>
              ) : null}

              {action.type === "grant_item" ? (
                <>
                  <ReferencePicker
                    value={action.itemId || ""}
                    options={itemOptions}
                    compact
                    showSelectedPreview={false}
                    placeholder="Select item..."
                    onChange={(value) => updateAction(actionIndex, { itemId: value || undefined })}
                    onOpenSelected={(value) => navigate(`/items/${value}`)}
                    onCreate={createItem}
                    createPlaceholder="New item name..."
                  />
                  <input
                    type="number"
                    min={1}
                    className="input input--sm"
                    placeholder="Qty"
                    value={action.quantity ?? 1}
                    onChange={(e) => updateAction(actionIndex, { quantity: Number(e.target.value) || 1 })}
                  />
                </>
              ) : null}

              {(action.type === "grant_quest" || action.type === "complete_quest") ? (
                <ReferencePicker
                  value={action.questId || ""}
                  options={questOptions}
                  compact
                  showSelectedPreview={false}
                  placeholder="Select quest..."
                  onChange={(value) => updateAction(actionIndex, { questId: value || undefined })}
                  onOpenSelected={(value) => navigate(`/quests/${value}`)}
                  onCreate={createQuest}
                  createPlaceholder="New quest name..."
                />
              ) : null}

              {action.type === "travel_to_room" ? (
                <ReferencePicker
                  value={action.roomId || ""}
                  options={roomOptions}
                  compact
                  showSelectedPreview={false}
                  placeholder="Select room..."
                  onChange={(value) => updateAction(actionIndex, { roomId: value || undefined })}
                  onOpenSelected={(value) => navigate(`/world/rooms/${value}`)}
                  onCreate={createRoom}
                  createPlaceholder="New room name..."
                />
              ) : null}

              {action.type === "start_cutscene" ? (
                <ReferencePicker
                  value={action.cutsceneId || ""}
                  options={cutsceneOptions}
                  compact
                  showSelectedPreview={false}
                  placeholder="Select cutscene..."
                  onChange={(value) => updateAction(actionIndex, { cutsceneId: value || undefined })}
                  onOpenSelected={(value) => navigate(`/cutscenes/${value}`)}
                  onCreate={createCutscene}
                  createPlaceholder="New cutscene name..."
                />
              ) : null}

              {action.type === "set_storage" ? (
                <>
                  <select
                    className="input select"
                    value={action.storageKeyId || ""}
                    onChange={(e) => updateAction(actionIndex, { storageKeyId: e.target.value || undefined })}
                  >
                    <option value="">-- Select key --</option>
                    {storageKeys.map((key) => (
                      <option key={key.id} value={key.id}>
                        {key.label || key.id}
                      </option>
                    ))}
                  </select>
                  <select
                    className="input select"
                    value={action.storageOperation || "set"}
                    onChange={(e) =>
                      updateAction(actionIndex, {
                        storageOperation: e.target.value as "set" | "increment" | "decrement" | "toggle",
                      })
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
                    onChange={(e) => updateAction(actionIndex, { value: e.target.value })}
                  />
                </>
              ) : null}

              {action.type === "custom" ? (
                <input
                  className="input input--code"
                  style={{ flex: 1 }}
                  value={action.customScript || ""}
                  onChange={(e) => updateAction(actionIndex, { customScript: e.target.value })}
                  placeholder="Freeform script or note..."
                />
              ) : null}

              <button className="btn btn--danger btn--sm" onClick={() => removeAction(actionIndex)}>
                Remove
              </button>
            </div>

            <div className="form-field">
              <label className="field-label">Action Condition</label>
              <ConditionEditor
                value={action.condition || ""}
                onChange={(value) => updateAction(actionIndex, { condition: value || undefined })}
                placeholder='Optional, e.g. player.has_quest("dirty_frank_intro")'
              />
            </div>
          </div>
        ))
      )}

      <button className="btn btn--sm" onClick={addAction}>
        + Add Action
      </button>
    </div>
  );
}
