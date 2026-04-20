export interface NavigationItem {
  to: string;
  label: string;
  keywords?: string[];
}

export interface NavigationSection {
  id: string;
  label: string;
  items: NavigationItem[];
}

export const NAV_SECTIONS: NavigationSection[] = [
  {
    id: "core",
    label: "Core Data",
    items: [
      { to: "/", label: "Tags", keywords: ["labels", "taxonomy"] },
      { to: "/storage", label: "Storage Keys", keywords: ["flags", "variables"] },
      { to: "/status-effects", label: "Status Effects", keywords: ["buffs", "debuffs"] },
    ],
  },
  {
    id: "narrative",
    label: "Narrative",
    items: [
      { to: "/dialogues", label: "Dialogues", keywords: ["conversations", "npc"] },
      { to: "/cutscenes", label: "Cutscenes", keywords: ["scenes", "story"] },
    ],
  },
  {
    id: "progression",
    label: "Progression",
    items: [
      { to: "/skills", label: "Skills", keywords: ["abilities", "passives"] },
      { to: "/interactables", label: "Interactables", keywords: ["enemies", "npcs", "objects"] },
      { to: "/quests", label: "Quests", keywords: ["tasks", "objectives"] },
      { to: "/recipes", label: "Recipes", keywords: ["crafting"] },
    ],
  },
  {
    id: "itemization",
    label: "Itemization",
    items: [
      { to: "/items", label: "General Items", keywords: ["inventory", "stackables", "materials", "consumables"] },
      { to: "/itemization/registries", label: "Item Registries", keywords: ["classes", "tables", "stats"] },
      { to: "/itemization/bases", label: "Item Bases", keywords: ["equipment"] },
      { to: "/itemization/affixes", label: "Affixes", keywords: ["prefixes", "suffixes"] },
      { to: "/itemization/uniques", label: "Unique Items", keywords: ["legendary"] },
      { to: "/itemization/sets", label: "Item Sets", keywords: ["set bonuses"] },
    ],
  },
  {
    id: "world",
    label: "World",
    items: [
      { to: "/world", label: "World Map", keywords: ["rooms", "layout"] },
      { to: "/weather", label: "Weather", keywords: ["climate", "rain", "storm", "ambient"] },
    ],
  },
  {
    id: "tools",
    label: "Tools",
    items: [
      { to: "/export", label: "Export / Import", keywords: ["save", "sync"] },
      { to: "/test", label: "Test Conditions", keywords: ["debug"] },
      { to: "/dsl", label: "DSL Reference", keywords: ["reference", "syntax"] },
    ],
  },
];

export const NAV_ITEMS = NAV_SECTIONS.flatMap((section) =>
  section.items.map((item) => ({
    ...item,
    sectionId: section.id,
    sectionLabel: section.label,
  }))
);
