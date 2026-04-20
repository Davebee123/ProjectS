import { getBundle } from "../data/loader";
import { evaluateCondition } from "../data/evaluator";
import type { GameState } from "./types";
import { buildEvalContext } from "./utils";

export interface ReachableRoom {
  targetRoomId: string;
  label: string;
  gridX: number;
  gridY: number;
  source: "special";
}

export function getReachableRooms(state: GameState): ReachableRoom[] {
  const bundle = getBundle();
  const world = bundle?.world;
  if (!world) return [];

  const currentRoom = world.rooms.find((room) => room.id === state.currentRoomId);
  if (!currentRoom) return [];

  const ctx = buildEvalContext(state);
  const reachable = new Map<string, ReachableRoom>();

  for (const connection of currentRoom.specialConnections ?? []) {
    if (connection.condition && !evaluateCondition(connection.condition, ctx)) continue;
    const room = world.rooms.find((entry) => entry.id === connection.targetRoomId);
    if (!room) continue;
    if (room.entryCondition && !evaluateCondition(room.entryCondition, ctx)) continue;
    reachable.set(room.id, {
      targetRoomId: room.id,
      label: connection.label || room.name,
      gridX: room.gridX,
      gridY: room.gridY,
      source: "special",
    });
  }

  return [...reachable.values()];
}

export function isRoomReachable(state: GameState, roomId: string): boolean {
  return getReachableRooms(state).some((room) => room.targetRoomId === roomId);
}
