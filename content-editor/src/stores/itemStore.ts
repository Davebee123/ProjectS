import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ItemTemplate } from "../schema/types";

interface ItemState {
  items: ItemTemplate[];
  addItem: (item: ItemTemplate) => void;
  updateItem: (id: string, patch: Partial<ItemTemplate>) => void;
  removeItem: (id: string) => void;
  loadItems: (items: ItemTemplate[]) => void;
}

export function createDefaultItem(id: string, name: string): ItemTemplate {
  return {
    id,
    name,
    description: "",
    rarity: "common",
    inventoryCategory: "misc",
    stackable: true,
    stats: {},
    eventHooks: [],
  };
}

const SEED_ITEMS: ItemTemplate[] = [
  {
    id: "rusty_hatchet",
    name: "Rusty Hatchet",
    description: "A basic hatchet. Better than nothing.",
    folder: "tools",
    rarity: "common",
    inventoryCategory: "weapons",
    slot: "mainHand",
    stackable: false,
    stats: { attack: 2, activityPowerMultiplier: 1.05, speedMultiplier: 0.94, energyCostMultiplier: 0.95 },
    eventHooks: [],
  },
  {
    id: "cloth_tunic",
    name: "Cloth Tunic",
    description: "A simple cloth tunic.",
    folder: "armor",
    rarity: "common",
    inventoryCategory: "armor",
    slot: "chest",
    stackable: false,
    stats: { defense: 3 },
    eventHooks: [],
  },
  {
    id: "log",
    name: "Logs",
    description: "Rough-cut logs from a felled tree.",
    folder: "resources",
    rarity: "common",
    inventoryCategory: "materials",
    stackable: true,
    stats: {},
    eventHooks: [],
  },
  {
    id: "sap",
    name: "Tree Sap",
    description: "Sticky sap harvested from tree bark.",
    folder: "resources",
    rarity: "common",
    inventoryCategory: "materials",
    stackable: true,
    stats: {},
    eventHooks: [],
  },
  {
    id: "backpack",
    name: "Agri-Farmer's Backpack",
    description: "A backpack used to store farming supplies and harvested goods.",
    folder: "equipment",
    rarity: "common",
    inventoryCategory: "misc",
    slot: "back",
    stackable: false,
    stats: { backpackSlots: 10 },
    eventHooks: [],
  },
  {
    id: "amber_band",
    name: "Amber Band",
    description: "A ring of hardened amber. Hums with faint energy.",
    folder: "accessories",
    rarity: "uncommon",
    inventoryCategory: "misc",
    slot: "offHand",
    stackable: false,
    stats: { energyRegen: 1, energyCostMultiplier: 0.95 },
    eventHooks: [],
  },
];

export const useItemStore = create<ItemState>()(
  persist(
    (set) => ({
      items: SEED_ITEMS,

      addItem: (item) =>
        set((s) => ({ items: [...s.items, item] })),

      updateItem: (id, patch) =>
        set((s) => ({
          items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
        })),

      removeItem: (id) =>
        set((s) => ({ items: s.items.filter((i) => i.id !== id) })),

      loadItems: (items) => set({ items }),
    }),
    {
      name: "editor-items",
      partialize: (state) => ({ items: state.items }),
    }
  )
);
