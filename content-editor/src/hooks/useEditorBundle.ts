import { useMemo } from "react";
import { useCutsceneStore } from "../stores/cutsceneStore";
import { useDialogueStore } from "../stores/dialogueStore";
import { useInteractableStore } from "../stores/interactableStore";
import { useItemStore } from "../stores/itemStore";
import { useItemizationStore } from "../stores/itemizationStore";
import { useProjectStore } from "../stores/projectStore";
import { useQuestStore } from "../stores/questStore";
import { useRecipeStore } from "../stores/recipeStore";
import { useSkillStore } from "../stores/skillStore";
import { useStatusEffectStore } from "../stores/statusEffectStore";
import { useStorageKeyStore } from "../stores/storageKeyStore";
import { useTagStore } from "../stores/tagStore";
import { useWorldStore } from "../stores/worldStore";

export function useEditorBundle() {
  const activityTags = useTagStore((state) => state.activityTags);
  const abilityTags = useTagStore((state) => state.abilityTags);
  const storageKeys = useStorageKeyStore((state) => state.storageKeys);
  const items = useItemStore((state) => state.items);
  const skills = useSkillStore((state) => state.skills);
  const statusEffects = useStatusEffectStore((state) => state.statusEffects);
  const interactables = useInteractableStore((state) => state.interactables);
  const dialogues = useDialogueStore((state) => state.dialogues);
  const cutscenes = useCutsceneStore((state) => state.cutscenes);
  const quests = useQuestStore((state) => state.quests);
  const recipes = useRecipeStore((state) => state.recipes);
  const world = useWorldStore((state) => state.world);
  const itemClasses = useItemizationStore((state) => state.itemClasses);
  const affixTables = useItemizationStore((state) => state.affixTables);
  const modifierStats = useItemizationStore((state) => state.modifierStats);
  const itemBases = useItemizationStore((state) => state.itemBases);
  const affixes = useItemizationStore((state) => state.affixes);
  const itemQualityRules = useItemizationStore((state) => state.itemQualityRules);
  const uniqueItems = useItemizationStore((state) => state.uniqueItems);
  const itemSets = useItemizationStore((state) => state.itemSets);
  const exportBundle = useProjectStore((state) => state.exportBundle);

  return useMemo(
    () => exportBundle(),
    [
      activityTags,
      abilityTags,
      storageKeys,
      items,
      skills,
      statusEffects,
      interactables,
      dialogues,
      cutscenes,
      quests,
      recipes,
      world,
      itemClasses,
      affixTables,
      modifierStats,
      itemBases,
      affixes,
      itemQualityRules,
      uniqueItems,
      itemSets,
      exportBundle,
    ]
  );
}
