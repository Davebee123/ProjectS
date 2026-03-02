import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { WorldTemplate, RoomTemplate } from "../schema/types";

interface WorldState {
  world: WorldTemplate;
  updateWorld: (patch: Partial<WorldTemplate>) => void;
  addRoom: (room: RoomTemplate) => void;
  updateRoom: (id: string, patch: Partial<RoomTemplate>) => void;
  removeRoom: (id: string) => void;
  loadWorld: (world: WorldTemplate) => void;
}

function createDefaultWorld(): WorldTemplate {
  return {
    id: "default_world",
    name: "Overworld",
    gridWidth: 20,
    gridHeight: 20,
    rooms: [],
    startingRoomId: "",
    defaultSlotCount: 3,
    startingItemIds: [],
  };
}

export function createDefaultRoom(
  id: string,
  name: string,
  gridX: number,
  gridY: number,
  defaultSlotCount: number
): RoomTemplate {
  return {
    id,
    name,
    description: "",
    gridX,
    gridY,
    slotCount: defaultSlotCount,
    spawnTable: [],
    fixedInteractables: [],
    specialConnections: [],
    seedOverrides: [],
  };
}

export const useWorldStore = create<WorldState>()(
  persist(
    (set) => ({
      world: createDefaultWorld(),

      updateWorld: (patch) =>
        set((s) => ({ world: { ...s.world, ...patch } })),

      addRoom: (room) =>
        set((s) => ({
          world: { ...s.world, rooms: [...s.world.rooms, room] },
        })),

      updateRoom: (id, patch) =>
        set((s) => ({
          world: {
            ...s.world,
            rooms: s.world.rooms.map((r) =>
              r.id === id ? { ...r, ...patch } : r
            ),
          },
        })),

      removeRoom: (id) =>
        set((s) => ({
          world: {
            ...s.world,
            rooms: s.world.rooms.filter((r) => r.id !== id),
            startingRoomId:
              s.world.startingRoomId === id ? "" : s.world.startingRoomId,
          },
        })),

      loadWorld: (world) => set({ world }),
    }),
    {
      name: "editor-world",
      partialize: (state) => ({ world: state.world }),
    }
  )
);
