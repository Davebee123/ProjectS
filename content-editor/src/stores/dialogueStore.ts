import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DialogueTemplate } from "../schema/types";

interface DialogueState {
  dialogues: DialogueTemplate[];
  addDialogue: (dialogue: DialogueTemplate) => void;
  updateDialogue: (id: string, patch: Partial<DialogueTemplate>) => void;
  removeDialogue: (id: string) => void;
  loadDialogues: (dialogues: DialogueTemplate[]) => void;
}

export function createDefaultDialogue(id: string, name: string): DialogueTemplate {
  return {
    id,
    name,
    description: "",
    startNodeId: `${id}_start`,
    nodes: [
      {
        id: `${id}_start`,
        text: "New dialogue node.",
        options: [],
      },
    ],
  };
}

const SEED_DIALOGUES: DialogueTemplate[] = [
  {
    id: "dirty_frank_intro",
    name: "Dirty Frank Intro",
    description: "Opening conversation with Dirty Frank.",
    folder: "npcs",
    startNodeId: "dirty_frank_intro_start",
    nodes: [
      {
        id: "dirty_frank_intro_start",
        text: "You look awful. Do yourself a favor and grab a beer and take a seat. The fire is warm and the company is... alright I guess.",
        onEnterEffects: [
          {
            type: "set_storage",
            storageKeyId: "dirty_frank_intro_seen",
            storageOperation: "set",
            value: true,
          },
        ],
        options: [
          {
            id: "ask_where_am_i",
            text: "I don't know where I am. Can you help me?",
            tags: ["quest"],
            effects: [
              {
                type: "grant_quest",
                questId: "so_no_samples",
              },
            ],
            nextNodeId: "dirty_frank_intro_help",
          },
          {
            id: "fight_dirty_frank",
            text: "You look awful, too, idiot. [Fight]",
            tags: ["hostile"],
            nextNodeId: "dirty_frank_intro_fight",
          },
          {
            id: "say_bongos",
            text: "Bongos",
            tags: ["exit"],
            closeDialogue: true,
          },
        ],
      },
      {
        id: "dirty_frank_intro_help",
        text: "Muddy Forest. Bad mud, worse people. Stay near the fire and keep your axe sharp.",
        continueLabel: "Continue",
        nextNodeId: "dirty_frank_intro_end",
        options: [],
      },
      {
        id: "dirty_frank_intro_fight",
        text: "Big words for someone who just crawled out of the swamp. Come back when you can stand straight.",
        options: [
          {
            id: "end_after_fight",
            text: "Fine. I'm leaving.",
            tags: ["exit"],
            closeDialogue: true,
          },
        ],
      },
      {
        id: "dirty_frank_intro_end",
        text: "If you bring me something worth trading, maybe I'll tell you more.",
        options: [
          {
            id: "end_after_help",
            text: "I'll be back.",
            tags: ["exit"],
            closeDialogue: true,
          },
        ],
      },
    ],
  },
];

export const useDialogueStore = create<DialogueState>()(
  persist(
    (set) => ({
      dialogues: SEED_DIALOGUES,
      addDialogue: (dialogue) => set((state) => ({ dialogues: [...state.dialogues, dialogue] })),
      updateDialogue: (id, patch) =>
        set((state) => ({
          dialogues: state.dialogues.map((dialogue) => (dialogue.id === id ? { ...dialogue, ...patch } : dialogue)),
        })),
      removeDialogue: (id) => set((state) => ({ dialogues: state.dialogues.filter((dialogue) => dialogue.id !== id) })),
      loadDialogues: (dialogues) => set({ dialogues }),
    }),
    {
      name: "editor-dialogues",
      partialize: (state) => ({ dialogues: state.dialogues }),
    }
  )
);
