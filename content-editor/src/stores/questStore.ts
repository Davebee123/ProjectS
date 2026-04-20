import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { QuestTemplate } from "../schema/types";

interface QuestState {
  quests: QuestTemplate[];
  addQuest: (quest: QuestTemplate) => void;
  updateQuest: (id: string, patch: Partial<QuestTemplate>) => void;
  removeQuest: (id: string) => void;
  loadQuests: (quests: QuestTemplate[]) => void;
}

export function createDefaultQuest(id: string, name: string): QuestTemplate {
  return {
    id,
    name,
    description: "",
    category: "main_story",
    level: 1,
    objectives: [
      {
        id: `${id}_objective_1`,
        title: "New Objective",
        description: "",
        progress: {
          kind: "freeform",
          text: "Progress details go here.",
        },
      },
    ],
  };
}

const SEED_QUESTS: QuestTemplate[] = [
  {
    id: "so_no_samples",
    name: "So No Samples?",
    description: "Virleios needs you to go to his plant surveillance systems and scan the nearby plant matter for notable changes to the blight organism.",
    folder: "main_story",
    category: "main_story",
    level: 10,
    objectives: [
      {
        id: "analyze_soil_samples",
        title: "Analyze 5 Soil Samples",
        description: "Virleios needs you to go to his plant surveillance systems and scan the nearby plant matter for notable changes to the blight organism.",
        completeCondition: 'player.counter("soil_samples_analyzed") >= 5',
        progress: {
          kind: "structured",
          label: "Soil Samples Analyzed",
          source: {
            type: "storage_counter",
            storageKeyId: "soil_samples_analyzed",
          },
          requiredValue: 5,
        },
      },
    ],
  },
];

export const useQuestStore = create<QuestState>()(
  persist(
    (set) => ({
      quests: SEED_QUESTS,
      addQuest: (quest) => set((state) => ({ quests: [...state.quests, quest] })),
      updateQuest: (id, patch) =>
        set((state) => ({
          quests: state.quests.map((quest) => (quest.id === id ? { ...quest, ...patch } : quest)),
        })),
      removeQuest: (id) => set((state) => ({ quests: state.quests.filter((quest) => quest.id !== id) })),
      loadQuests: (quests) => set({ quests }),
    }),
    {
      name: "editor-quests",
      partialize: (state) => ({ quests: state.quests }),
    }
  )
);
