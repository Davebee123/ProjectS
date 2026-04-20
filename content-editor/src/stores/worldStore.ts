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
    id: "verdant_world",
    name: "Verdant Outskirts",
    gridWidth: 5,
    gridHeight: 5,
    rooms: [
      {
        id: "verdant_outskirts",
        name: "Verdant Outskirts",
        description: "A sun-dappled clearing at the edge of the forest. Trees of all sizes grow here.",
        gridX: 2,
        gridY: 2,
        slotCount: 4,
        spawnTable: [
          {
            id: "sp_oak",
            interactableId: "oak_tree",
            spawnChance: 100,
            minCount: 1,
            maxCount: 3,
          },
          {
            id: "sp_birch",
            interactableId: "birch_tree",
            spawnChance: 30,
            minCount: 1,
            maxCount: 1,
          },
        ],
        fixedInteractables: [
          {
            interactableId: "dirty_frank",
          },
          {
            interactableId: "loyal_sprite",
          },
          {
            interactableId: "desperate_rat",
          },
        ],
        specialConnections: [],
        seedOverrides: [],
      },
      {
        id: "whispering_thicket",
        name: "Whispering Thicket",
        description: "A narrower stretch of woodland where the wind carries through denser brush and younger birch growth.",
        level: 2,
        gridX: 3,
        gridY: 2,
        slotCount: 4,
        spawnTable: [
          {
            id: "sp_thicket_birch",
            interactableId: "birch_tree",
            spawnChance: 100,
            minCount: 1,
            maxCount: 2,
          },
          {
            id: "sp_thicket_oak",
            interactableId: "oak_tree",
            spawnChance: 45,
            minCount: 1,
            maxCount: 1,
          },
        ],
        fixedInteractables: [],
        specialConnections: [],
        seedOverrides: [],
      },
    ],
    startingRoomId: "verdant_outskirts",
    startingCutsceneId: "waking_up_confused",
    defaultSlotCount: 4,
    startingItemIds: [],
    startingEquipmentBaseIds: ["starter_dagger"],
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
