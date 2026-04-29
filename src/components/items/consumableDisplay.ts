import type { GameContentBundle, ItemTemplate } from "../../../shared/content/types";

export interface ConsumableDisplayLine {
  label: string;
  value: string;
}

function formatMs(ms: number): string {
  if (ms >= 1000) {
    const seconds = ms / 1000;
    return `${Number.isInteger(seconds) ? seconds.toFixed(0) : seconds.toFixed(1)}s`;
  }
  return `${ms}ms`;
}

function formatActionLine(
  action: NonNullable<ItemTemplate["eventHooks"]>[number]["actions"][number],
  bundle: GameContentBundle | null | undefined
): ConsumableDisplayLine | null {
  switch (action.type) {
    case "heal":
      return typeof action.value === "number" ? { label: "Restores Health", value: String(action.value) } : null;
    case "restore_energy":
      return typeof action.value === "number" ? { label: "Restores Energy", value: String(action.value) } : null;
    case "restore_mana":
      return typeof action.value === "number" ? { label: "Restores Mana", value: String(action.value) } : null;
    case "damage_energy":
      return typeof action.value === "number" ? { label: "Removes Energy", value: String(action.value) } : null;
    case "damage_mana":
      return typeof action.value === "number" ? { label: "Removes Mana", value: String(action.value) } : null;
    case "apply_status": {
      const effectName =
        bundle?.statusEffects.find((effect) => effect.id === action.statusEffectId)?.name ??
        action.statusEffectId;
      return effectName ? { label: "Applies Status", value: effectName } : null;
    }
    case "remove_status": {
      const effectName =
        bundle?.statusEffects.find((effect) => effect.id === action.statusEffectId)?.name ??
        action.statusEffectId;
      return effectName ? { label: "Removes Status", value: effectName } : null;
    }
    case "grant_item": {
      const itemName = bundle?.items.find((item) => item.id === action.itemId)?.name ?? action.itemId;
      return itemName ? { label: "Grants Item", value: `${action.quantity ?? 1}x ${itemName}` } : null;
    }
    case "grant_quest": {
      const questName = bundle?.quests.find((quest) => quest.id === action.questId)?.name ?? action.questId;
      return questName ? { label: "Grants Quest", value: questName } : null;
    }
    default:
      return null;
  }
}

export function buildConsumableDisplayLines(
  item: ItemTemplate | null | undefined,
  bundle: GameContentBundle | null | undefined
): ConsumableDisplayLine[] {
  if (!item) return [];

  const lines: ConsumableDisplayLine[] = [];
  for (const hook of item.eventHooks ?? []) {
    if (hook.event !== "on_use") continue;
    for (const action of hook.actions) {
      const line = formatActionLine(action, bundle);
      if (line) lines.push(line);
    }
  }

  if (item.quickSlotCooldownMs && item.quickSlotCooldownMs > 0) {
    lines.push({ label: "Cooldown", value: formatMs(item.quickSlotCooldownMs) });
  }

  return lines;
}
