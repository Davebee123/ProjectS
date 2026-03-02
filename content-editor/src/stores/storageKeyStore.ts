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

export const useStorageKeyStore = create<StorageKeyState>()(
  persist(
    (set) => ({
      storageKeys: [],

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
