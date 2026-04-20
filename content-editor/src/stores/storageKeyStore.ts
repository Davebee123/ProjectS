import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { StorageKeyDef } from "../schema/types";

interface StorageKeyState {
  storageKeys: StorageKeyDef[];
  addStorageKey: (key: StorageKeyDef) => void;
  updateStorageKey: (id: string, patch: Partial<StorageKeyDef>) => void;
  removeStorageKey: (id: string) => void;
  loadStorageKeys: (keys: StorageKeyDef[]) => void;
}

const SEED_STORAGE_KEYS: StorageKeyDef[] = [
  {
    id: "soil_samples_analyzed",
    label: "Soil Samples Analyzed",
    type: "counter",
    defaultValue: 0,
    description: "Tracks analyzed soil samples for the tutorial quest line.",
  },
  {
    id: "dirty_frank_intro_seen",
    label: "Dirty Frank Intro Seen",
    type: "flag",
    defaultValue: false,
    description: "Tracks whether the player has met Dirty Frank.",
  },
];

export const useStorageKeyStore = create<StorageKeyState>()(
  persist(
    (set) => ({
      storageKeys: SEED_STORAGE_KEYS,

      addStorageKey: (key) =>
        set((s) => ({ storageKeys: [...s.storageKeys, key] })),

      updateStorageKey: (id, patch) =>
        set((s) => ({
          storageKeys: s.storageKeys.map((k) => (k.id === id ? { ...k, ...patch } : k)),
        })),

      removeStorageKey: (id) =>
        set((s) => ({ storageKeys: s.storageKeys.filter((k) => k.id !== id) })),

      loadStorageKeys: (keys) => set({ storageKeys: keys }),
    }),
    {
      name: "editor-storage-keys",
      partialize: (state) => ({ storageKeys: state.storageKeys }),
    }
  )
);
