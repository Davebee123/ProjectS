import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface RecentNavigationEntry {
  key: string;
  path: string;
  label: string;
  kind: string;
  parentLabel?: string;
  touchedAt: number;
}

interface NavigationState {
  recentEntries: RecentNavigationEntry[];
  addRecentEntry: (entry: Omit<RecentNavigationEntry, "touchedAt">) => void;
  clearRecentEntries: () => void;
}

const MAX_RECENT_ENTRIES = 8;

export const useNavigationStore = create<NavigationState>()(
  persist(
    (set) => ({
      recentEntries: [],
      addRecentEntry: (entry) =>
        set((state) => {
          const nextEntry: RecentNavigationEntry = {
            ...entry,
            touchedAt: Date.now(),
          };
          return {
            recentEntries: [nextEntry, ...state.recentEntries.filter((item) => item.path !== entry.path)].slice(
              0,
              MAX_RECENT_ENTRIES
            ),
          };
        }),
      clearRecentEntries: () => set({ recentEntries: [] }),
    }),
    {
      name: "editor-navigation",
      partialize: (state) => ({ recentEntries: state.recentEntries }),
    }
  )
);
