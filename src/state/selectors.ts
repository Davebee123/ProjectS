/**
 * Pure selector functions for deriving display data from GameState.
 * These correspond to the useMemo hooks in GameApp.
 */
import { getBundle } from "../data/loader";
import type { RecipeDef } from "../data/loader";
import { evaluateCondition } from "../data/evaluator";
import {
  getAvailableRecipes,
  type InventoryItem,
} from "../data/bridge";
import type { GameState } from "./types";
import { buildEvalContext } from "./utils";
import { getEquipmentStats, getRelevantPassiveLevel, getSuccessChance } from "./reducer";

export { getEquipmentStats, getRelevantPassiveLevel, getSuccessChance };

export function selectRoomName(state: GameState): string {
  const bundle = getBundle();
  return bundle?.world.rooms.find((r) => r.id === state.currentRoomId)?.name ?? "Unknown Location";
}

export function selectRoomExits(state: GameState) {
  const bundle = getBundle();
  const room = bundle?.world.rooms.find((r) => r.id === state.currentRoomId);
  if (!room?.specialConnections?.length) return [];
  const ctx = buildEvalContext(state);
  return room.specialConnections.filter((c) => !c.condition || evaluateCondition(c.condition, ctx));
}

export function selectAvailableRecipes(state: GameState): RecipeDef[] {
  const bundle = getBundle();
  if (!bundle) return [];
  const ctx = buildEvalContext(state);
  return getAvailableRecipes(bundle.recipes ?? [], state.inventory, ctx, undefined);
}

export function selectPlaceableItems(state: GameState): InventoryItem[] {
  const bundle = getBundle();
  if (!bundle) return [];
  return state.inventory.filter((item) => bundle.items.find((d) => d.id === item.id)?.placeable);
}

export function selectSkillFloatMap(state: GameState): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const entry of state.floatTexts) {
    if (entry.zone !== "skills" || !entry.skillId) continue;
    const existing = map.get(entry.skillId) ?? [];
    existing.push(entry.text);
    map.set(entry.skillId, existing);
  }
  return map;
}

export function selectObjectFloatMap(state: GameState): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const entry of state.floatTexts) {
    if (entry.zone !== "objects" || !entry.objectId) continue;
    const existing = map.get(entry.objectId) ?? [];
    existing.push(entry.text);
    map.set(entry.objectId, existing);
  }
  return map;
}

export function selectSkillAreaFloatTexts(state: GameState): string[] {
  return state.floatTexts.filter((entry) => entry.zone === "skills" && !entry.skillId).map((entry) => entry.text);
}

export function selectObjectAreaFloatTexts(state: GameState): string[] {
  return state.floatTexts.filter((entry) => entry.zone === "objects" && !entry.objectId).map((entry) => entry.text);
}

export function selectTimedStatusBadges(state: GameState): Array<{
  id: string;
  type: "buff" | "debuff";
  label: string;
  seconds: number;
}> {
  const badges: Array<{
    id: string;
    type: "buff" | "debuff";
    label: string;
    seconds: number;
  }> = [];

  const chopBuffRemainingMs = state.chopBuffUntil - state.now;
  if (chopBuffRemainingMs > 0) {
    badges.push({
      id: "chop_buff",
      type: "buff",
      label: "Chop +2",
      seconds: Math.ceil(chopBuffRemainingMs / 1000),
    });
  }

  return badges;
}
