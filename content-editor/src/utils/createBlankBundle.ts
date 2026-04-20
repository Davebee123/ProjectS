import type { GameContentBundle } from "../schema/types";
import { createDefaultItemizationScaffold } from "./defaultItemizationScaffold";

export function createBlankBundle(): GameContentBundle {
  const itemization = createDefaultItemizationScaffold();

  return {
    version: "1.0.0",
    exportedAt: new Date().toISOString(),
    tags: {
      activityTags: [],
      abilityTags: [],
    },
    storageKeys: [],
    statusEffects: [],
    items: [],
    itemClasses: itemization.itemClasses,
    affixTables: itemization.affixTables,
    modifierStats: itemization.modifierStats,
    itemBases: itemization.itemBases,
    affixes: itemization.affixes,
    itemQualityRules: itemization.itemQualityRules,
    uniqueItems: itemization.uniqueItems,
    itemSets: itemization.itemSets,
    skills: [],
    combos: [],
    dialogues: [],
    cutscenes: [],
    quests: [],
    recipes: [],
    interactables: [],
    weathers: [],
    world: {
      id: "game_world",
      name: "New World",
      gridWidth: 5,
      gridHeight: 5,
      rooms: [],
      startingRoomId: "",
      defaultSlotCount: 4,
      startingItemIds: [],
      startingEquipmentBaseIds: [],
    },
  };
}
