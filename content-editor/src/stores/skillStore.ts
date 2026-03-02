import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SkillTemplate } from "../schema/types";

interface SkillState {
  skills: SkillTemplate[];
  addSkill: (skill: SkillTemplate) => void;
  updateSkill: (id: string, patch: Partial<SkillTemplate>) => void;
  removeSkill: (id: string) => void;
  loadSkills: (skills: SkillTemplate[]) => void;
}

export function createDefaultSkill(id: string, name: string): SkillTemplate {
  return {
    id,
    name,
    kind: "active",
    activityTags: [],
    abilityTags: [],
    baseDurationMs: 2000,
    baseEnergyCost: 10,
    basePower: 5,
    powerPerLevel: 1,
    baseXpToNext: 25,
    xpScaling: 1.18,
    barColor: "#555555",
    accentColor: "#777777",
    description: "",
  };
}

const TREE_COLOR = "#415236";
const TREE_ACCENT = "#5a7a4a";

const SEED_SKILLS: SkillTemplate[] = [
  {
    id: "treecutting",
    name: "Treecutting",
    kind: "passive",
    activityTags: ["tree"],
    abilityTags: [],
    baseDurationMs: 0,
    baseEnergyCost: 0,
    basePower: 0,
    powerPerLevel: 0,
    baseXpToNext: 30,
    xpScaling: 1.18,
    barColor: TREE_COLOR,
    accentColor: TREE_ACCENT,
    description: "Passive efficiency for tree activities.",
  },
  {
    id: "upward_chop",
    name: "Upward Chop",
    kind: "active",
    activityTags: ["tree"],
    abilityTags: ["chop"],
    linkedPassiveId: "treecutting",
    baseDurationMs: 2000,
    baseEnergyCost: 12,
    basePower: 5,
    powerPerLevel: 1,
    baseXpToNext: 25,
    xpScaling: 1.18,
    barColor: TREE_COLOR,
    accentColor: TREE_ACCENT,
    description: "A quick upward strike. Builds combo for Downward Chop.",
  },
  {
    id: "downward_chop",
    name: "Downward Chop",
    kind: "active",
    activityTags: ["tree"],
    abilityTags: ["chop"],
    linkedPassiveId: "treecutting",
    baseDurationMs: 4000,
    baseEnergyCost: 15,
    basePower: 10,
    powerPerLevel: 2,
    baseXpToNext: 25,
    xpScaling: 1.18,
    barColor: TREE_COLOR,
    accentColor: TREE_ACCENT,
    description: "A powerful downward strike. Bonus when combo-armed.",
    unlockCondition: 'skill("treecutting").level >= 3',
  },
  {
    id: "side_chop",
    name: "Side Chop",
    kind: "active",
    activityTags: ["tree"],
    abilityTags: ["chop"],
    linkedPassiveId: "treecutting",
    baseDurationMs: 1000,
    baseEnergyCost: 11,
    basePower: 7,
    powerPerLevel: 1,
    baseXpToNext: 25,
    xpScaling: 1.18,
    barColor: TREE_COLOR,
    accentColor: TREE_ACCENT,
    description: "A swift lateral strike. Activates Chop +2 buff.",
    unlockCondition: 'skill("treecutting").level >= 5',
  },
];

export const useSkillStore = create<SkillState>()(
  persist(
    (set) => ({
      skills: SEED_SKILLS,

      addSkill: (skill) =>
        set((s) => ({ skills: [...s.skills, skill] })),

      updateSkill: (id, patch) =>
        set((s) => ({
          skills: s.skills.map((sk) => (sk.id === id ? { ...sk, ...patch } : sk)),
        })),

      removeSkill: (id) =>
        set((s) => ({ skills: s.skills.filter((sk) => sk.id !== id) })),

      loadSkills: (skills) => set({ skills }),
    }),
    {
      name: "editor-skills",
      partialize: (state) => ({ skills: state.skills }),
    }
  )
);
