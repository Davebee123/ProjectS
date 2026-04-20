import { create } from "zustand";
import { useTagStore } from "./tagStore";
import { useStorageKeyStore } from "./storageKeyStore";
import { useItemStore } from "./itemStore";
import { useSkillStore } from "./skillStore";
import { useStatusEffectStore } from "./statusEffectStore";
import { useInteractableStore } from "./interactableStore";
import { useComboStore } from "./comboStore";
import { useDialogueStore } from "./dialogueStore";
import { useCutsceneStore } from "./cutsceneStore";
import { useWorldStore } from "./worldStore";
import { useProjectStore } from "./projectStore";
import { useRecipeStore } from "./recipeStore";
import { useQuestStore } from "./questStore";
import { useItemizationStore } from "./itemizationStore";

import type { ActivityTagDef, AbilityTagDef } from "../schema/types";
import type { StorageKeyDef } from "../schema/types";
import type { ItemTemplate } from "../schema/types";
import type { SkillTemplate } from "../schema/types";
import type { StatusEffectTemplate } from "../schema/types";
import type { InteractableTemplate } from "../schema/types";
import type { ComboRuleTemplate } from "../schema/types";
import type { DialogueTemplate } from "../schema/types";
import type { CutsceneTemplate } from "../schema/types";
import type { WorldTemplate } from "../schema/types";
import type { RecipeTemplate } from "../schema/types";
import type { QuestTemplate } from "../schema/types";
import type {
  AffixDefinition,
  AffixTableDef,
  ItemBase,
  ItemClassDef,
  ItemQualityRuleSet,
  ItemSetDefinition,
  ModifierStatDef,
  UniqueItem,
} from "../schema/types";

interface Snapshot {
  activityTags: ActivityTagDef[];
  abilityTags: AbilityTagDef[];
  storageKeys: StorageKeyDef[];
  items: ItemTemplate[];
  skills: SkillTemplate[];
  statusEffects: StatusEffectTemplate[];
  interactables: InteractableTemplate[];
  combos: ComboRuleTemplate[];
  dialogues: DialogueTemplate[];
  cutscenes: CutsceneTemplate[];
  quests: QuestTemplate[];
  recipes: RecipeTemplate[];
  itemClasses: ItemClassDef[];
  affixTables: AffixTableDef[];
  modifierStats: ModifierStatDef[];
  itemBases: ItemBase[];
  affixes: AffixDefinition[];
  itemQualityRules: ItemQualityRuleSet[];
  uniqueItems: UniqueItem[];
  itemSets: ItemSetDefinition[];
  world: WorldTemplate;
  projectName: string;
}

const MAX_HISTORY = 50;

interface HistoryState {
  past: Snapshot[];
  future: Snapshot[];
  undo: () => void;
  redo: () => void;
  capture: () => void;
}

let _isRestoring = false;

function takeSnapshot(): Snapshot {
  return {
    activityTags: structuredClone(useTagStore.getState().activityTags),
    abilityTags: structuredClone(useTagStore.getState().abilityTags),
    storageKeys: structuredClone(useStorageKeyStore.getState().storageKeys),
    items: structuredClone(useItemStore.getState().items),
    skills: structuredClone(useSkillStore.getState().skills),
    statusEffects: structuredClone(useStatusEffectStore.getState().statusEffects),
    interactables: structuredClone(useInteractableStore.getState().interactables),
    combos: structuredClone(useComboStore.getState().combos),
    dialogues: structuredClone(useDialogueStore.getState().dialogues),
    cutscenes: structuredClone(useCutsceneStore.getState().cutscenes),
    quests: structuredClone(useQuestStore.getState().quests),
    recipes: structuredClone(useRecipeStore.getState().recipes),
    itemClasses: structuredClone(useItemizationStore.getState().itemClasses),
    affixTables: structuredClone(useItemizationStore.getState().affixTables),
    modifierStats: structuredClone(useItemizationStore.getState().modifierStats),
    itemBases: structuredClone(useItemizationStore.getState().itemBases),
    affixes: structuredClone(useItemizationStore.getState().affixes),
    itemQualityRules: structuredClone(useItemizationStore.getState().itemQualityRules),
    uniqueItems: structuredClone(useItemizationStore.getState().uniqueItems),
    itemSets: structuredClone(useItemizationStore.getState().itemSets),
    world: structuredClone(useWorldStore.getState().world),
    projectName: useProjectStore.getState().projectName,
  };
}

function restoreSnapshot(snap: Snapshot) {
  _isRestoring = true;
  useTagStore.setState({ activityTags: snap.activityTags, abilityTags: snap.abilityTags });
  useStorageKeyStore.setState({ storageKeys: snap.storageKeys });
  useItemStore.setState({ items: snap.items });
  useSkillStore.setState({ skills: snap.skills });
  useStatusEffectStore.setState({ statusEffects: snap.statusEffects });
  useInteractableStore.setState({ interactables: snap.interactables });
  useComboStore.setState({ combos: snap.combos });
  useDialogueStore.setState({ dialogues: snap.dialogues });
  useCutsceneStore.setState({ cutscenes: snap.cutscenes });
  useQuestStore.setState({ quests: snap.quests });
  useRecipeStore.setState({ recipes: snap.recipes });
  useItemizationStore.setState({
    itemClasses: snap.itemClasses,
    affixTables: snap.affixTables,
    modifierStats: snap.modifierStats,
    itemBases: snap.itemBases,
    affixes: snap.affixes,
    itemQualityRules: snap.itemQualityRules,
    uniqueItems: snap.uniqueItems,
    itemSets: snap.itemSets,
  });
  useWorldStore.setState({ world: snap.world });
  useProjectStore.setState({ projectName: snap.projectName });
  _isRestoring = false;
}

export const useHistoryStore = create<HistoryState>()((set, get) => ({
  past: [],
  future: [],

  capture: () => {
    if (_isRestoring) return;
    const snap = takeSnapshot();
    set((s) => ({
      past: [...s.past.slice(-(MAX_HISTORY - 1)), snap],
      future: [],
    }));
  },

  undo: () => {
    const { past } = get();
    if (past.length === 0) return;
    const current = takeSnapshot();
    const prev = past[past.length - 1];
    set((s) => ({
      past: s.past.slice(0, -1),
      future: [current, ...s.future],
    }));
    restoreSnapshot(prev);
  },

  redo: () => {
    const { future } = get();
    if (future.length === 0) return;
    const current = takeSnapshot();
    const next = future[0];
    set((s) => ({
      past: [...s.past, current],
      future: s.future.slice(1),
    }));
    restoreSnapshot(next);
  },
}));

// Subscribe to all stores and auto-capture with debounce
let _debounceTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedCapture() {
  if (_isRestoring) return;
  if (_debounceTimer) clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(() => {
    useHistoryStore.getState().capture();
  }, 500);
}

// Set up subscriptions — each store fires debouncedCapture on data changes
const stores = [
  useTagStore,
  useStorageKeyStore,
  useItemStore,
  useSkillStore,
  useStatusEffectStore,
  useInteractableStore,
  useComboStore,
  useDialogueStore,
  useCutsceneStore,
  useQuestStore,
  useRecipeStore,
  useItemizationStore,
  useWorldStore,
  useProjectStore,
];

for (const store of stores) {
  store.subscribe(debouncedCapture);
}
