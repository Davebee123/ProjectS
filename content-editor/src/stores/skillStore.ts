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
const TREE_ACCENT = "#678752";

const SEED_SKILLS: SkillTemplate[] = [
  {
    id: "treecutting",
    name: "Treecutting",
    folder: "passive",
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
    description: "Passive efficiency for tree actions.",
  },
  {
    id: "upward_chop",
    name: "Upward Chop",
    folder: "active",
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
    description: "Auto-cast opener for tree damage.",
  },
  {
    id: "downward_chop",
    name: "Downward Chop",
    folder: "active",
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
    description: "Unlocks at Treecutting Lv 3. Bonus arms after 3 successful Upward Chops.",
    unlockCondition: 'skill("treecutting").level >= 3',
  },
  {
    id: "side_chop",
    name: "Side Chop",
    folder: "active",
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
    description: "Unlocks at Treecutting Lv 5.",
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
