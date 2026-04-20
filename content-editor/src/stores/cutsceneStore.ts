import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CutsceneTemplate } from "../schema/types";

interface CutsceneState {
  cutscenes: CutsceneTemplate[];
  addCutscene: (cutscene: CutsceneTemplate) => void;
  updateCutscene: (id: string, patch: Partial<CutsceneTemplate>) => void;
  removeCutscene: (id: string) => void;
  loadCutscenes: (cutscenes: CutsceneTemplate[]) => void;
}

export function createDefaultCutscene(id: string, name: string): CutsceneTemplate {
  return {
    id,
    name,
    description: "",
    startStepId: `${id}_intro`,
    steps: [
      {
        id: `${id}_intro`,
        kind: "text",
        text: "New cutscene text.",
      },
    ],
  };
}

const SEED_CUTSCENES: CutsceneTemplate[] = [
  {
    id: "waking_up_confused",
    name: "Waking Up Confused",
    description: "Sample cutscene showing text, dialogue, and exit actions.",
    folder: "intro",
    startStepId: "waking_up_confused_intro",
    onCompleteEffects: [
      {
        type: "set_storage",
        storageKeyId: "dirty_frank_intro_seen",
        storageOperation: "set",
        value: true,
      },
    ],
    steps: [
      {
        id: "waking_up_confused_intro",
        kind: "text",
        text: "You wake up, dazed and confused. What day is it? Where am I?\n\nWhat did I do last night?",
        continueLabel: "Continue",
        backgroundImage: "/oak-tree.png",
        nextStepId: "waking_up_confused_frank",
      },
      {
        id: "waking_up_confused_frank",
        kind: "dialogue",
        dialogueId: "dirty_frank_intro",
        speakerName: "Dirty Frank",
        nextStepId: "waking_up_confused_outro",
      },
      {
        id: "waking_up_confused_outro",
        kind: "text",
        text: "The air is damp, the fire is warm, and at least one person in this swamp knows your name.",
        backgroundImage: "/oak-tree.png",
        continueLabel: "Finish",
      },
    ],
  },
];

export const useCutsceneStore = create<CutsceneState>()(
  persist(
    (set) => ({
      cutscenes: SEED_CUTSCENES,
      addCutscene: (cutscene) => set((state) => ({ cutscenes: [...state.cutscenes, cutscene] })),
      updateCutscene: (id, patch) =>
        set((state) => ({
          cutscenes: state.cutscenes.map((cutscene) => (cutscene.id === id ? { ...cutscene, ...patch } : cutscene)),
        })),
      removeCutscene: (id) => set((state) => ({ cutscenes: state.cutscenes.filter((cutscene) => cutscene.id !== id) })),
      loadCutscenes: (cutscenes) => set({ cutscenes }),
    }),
    {
      name: "editor-cutscenes",
      partialize: (state) => ({ cutscenes: state.cutscenes }),
    }
  )
);

