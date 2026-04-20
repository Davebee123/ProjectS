import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { NAV_ITEMS } from "../../navigation";
import { useCutsceneStore } from "../../stores/cutsceneStore";
import { useDialogueStore } from "../../stores/dialogueStore";
import { useInteractableStore } from "../../stores/interactableStore";
import { useItemStore } from "../../stores/itemStore";
import { useItemizationStore } from "../../stores/itemizationStore";
import { useQuestStore } from "../../stores/questStore";
import { useRecipeStore } from "../../stores/recipeStore";
import { useSkillStore } from "../../stores/skillStore";
import { useStatusEffectStore } from "../../stores/statusEffectStore";
import { useWorldStore } from "../../stores/worldStore";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

interface CommandItem {
  id: string;
  label: string;
  to: string;
  meta: string;
  search: string;
  isRecent?: boolean;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const dialogues = useDialogueStore((s) => s.dialogues);
  const skills = useSkillStore((s) => s.skills);
  const interactables = useInteractableStore((s) => s.interactables);
  const items = useItemStore((s) => s.items);
  const statusEffects = useStatusEffectStore((s) => s.statusEffects);
  const quests = useQuestStore((s) => s.quests);
  const recipes = useRecipeStore((s) => s.recipes);
  const cutscenes = useCutsceneStore((s) => s.cutscenes);
  const rooms = useWorldStore((s) => s.world.rooms);
  const itemBases = useItemizationStore((s) => s.itemBases);
  const affixes = useItemizationStore((s) => s.affixes);
  const uniqueItems = useItemizationStore((s) => s.uniqueItems);
  const itemSets = useItemizationStore((s) => s.itemSets);

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const commands = useMemo<CommandItem[]>(() => {
    const itemsByPath = new Map<string, CommandItem>();

    const addItem = (item: CommandItem) => {
      const existing = itemsByPath.get(item.to);
      if (!existing) {
        itemsByPath.set(item.to, item);
      }
    };

    NAV_ITEMS.forEach((item) =>
      addItem({
        id: `page:${item.to}`,
        label: item.label,
        to: item.to,
        meta: item.sectionLabel,
        search: `${item.label} ${item.sectionLabel} ${(item.keywords ?? []).join(" ")} ${item.to}`.toLowerCase(),
      })
    );

    const pushEntities = (
      entityType: string,
      parentLabel: string,
      entries: Array<{ id: string; label: string; to: string; extra?: string }>
    ) => {
      entries.forEach((entry) =>
        addItem({
          id: `${entityType}:${entry.id}`,
          label: entry.label,
          to: entry.to,
          meta: `${parentLabel}${entry.extra ? ` • ${entry.extra}` : ""}`,
          search: `${entry.label} ${entry.id} ${parentLabel} ${entry.extra ?? ""}`.toLowerCase(),
        })
      );
    };

    pushEntities(
      "dialogue",
      "Dialogues",
      dialogues.map((dialogue) => ({
        id: dialogue.id,
        label: dialogue.name,
        to: `/dialogues/${dialogue.id}`,
        extra: dialogue.folder,
      }))
    );
    pushEntities(
      "skill",
      "Skills",
      skills.map((skill) => ({
        id: skill.id,
        label: skill.name,
        to: `/skills/${skill.id}`,
        extra: skill.folder,
      }))
    );
    pushEntities(
      "interactable",
      "Interactables",
      interactables.map((interactable) => ({
        id: interactable.id,
        label: interactable.name,
        to: `/interactables/${interactable.id}`,
        extra: interactable.folder,
      }))
    );
    pushEntities(
      "item",
      "Items",
      items.map((item) => ({
        id: item.id,
        label: item.name,
        to: `/items/${item.id}`,
        extra: item.folder,
      }))
    );
    pushEntities(
      "status",
      "Status Effects",
      statusEffects.map((effect) => ({
        id: effect.id,
        label: effect.name,
        to: `/status-effects/${effect.id}`,
        extra: effect.folder,
      }))
    );
    pushEntities(
      "quest",
      "Quests",
      quests.map((quest) => ({
        id: quest.id,
        label: quest.name,
        to: `/quests/${quest.id}`,
        extra: quest.folder,
      }))
    );
    pushEntities(
      "recipe",
      "Recipes",
      recipes.map((recipe) => ({
        id: recipe.id,
        label: recipe.name,
        to: `/recipes/${recipe.id}`,
        extra: recipe.folder,
      }))
    );
    pushEntities(
      "cutscene",
      "Cutscenes",
      cutscenes.map((cutscene) => ({
        id: cutscene.id,
        label: cutscene.name,
        to: `/cutscenes/${cutscene.id}`,
        extra: cutscene.folder,
      }))
    );
    pushEntities(
      "room",
      "World Rooms",
      rooms.map((room) => ({
        id: room.id,
        label: room.name,
        to: `/world/rooms/${room.id}`,
      }))
    );
    pushEntities(
      "item-base",
      "Item Bases",
      itemBases.map((itemBase) => ({
        id: itemBase.id,
        label: itemBase.name,
        to: `/itemization/bases/${itemBase.id}`,
      }))
    );
    pushEntities(
      "affix",
      "Affixes",
      affixes.map((affix) => ({
        id: affix.id,
        label: affix.nameTemplate,
        to: `/itemization/affixes/${affix.id}`,
      }))
    );
    pushEntities(
      "unique",
      "Unique Items",
      uniqueItems.map((item) => ({
        id: item.id,
        label: item.name,
        to: `/itemization/uniques/${item.id}`,
      }))
    );
    pushEntities(
      "set",
      "Item Sets",
      itemSets.map((itemSet) => ({
        id: itemSet.id,
        label: itemSet.name,
        to: `/itemization/sets/${itemSet.id}`,
      }))
    );

    return Array.from(itemsByPath.values()).sort((a, b) => {
      return a.label.localeCompare(b.label);
    });
  }, [
    affixes,
    cutscenes,
    dialogues,
    interactables,
    itemBases,
    itemSets,
    items,
    quests,
    recipes,
    rooms,
    skills,
    statusEffects,
    uniqueItems,
  ]);

  const filteredCommands = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return commands.slice(0, 24);
    }
    return commands.filter((item) => item.search.includes(normalized)).slice(0, 40);
  }, [commands, query]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setSelectedIndex(0);
      return;
    }
    setSelectedIndex(0);
  }, [open]);

  useEffect(() => {
    if (selectedIndex >= filteredCommands.length) {
      setSelectedIndex(0);
    }
  }, [filteredCommands.length, selectedIndex]);

  if (!open) {
    return null;
  }

  const selectedItem = filteredCommands[selectedIndex];

  const handleSelect = (item: CommandItem) => {
    navigate(item.to);
    onClose();
  };

  return (
    <div className="command-palette-backdrop" onClick={onClose}>
      <div
        className="command-palette"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
            return;
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setSelectedIndex((current) => Math.min(current + 1, filteredCommands.length - 1));
            return;
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setSelectedIndex((current) => Math.max(current - 1, 0));
            return;
          }
          if (event.key === "Enter" && selectedItem) {
            event.preventDefault();
            handleSelect(selectedItem);
          }
        }}
      >
        <div className="command-palette-header">
          <div>
            <h2 className="command-palette-title">Jump To</h2>
            <p className="command-palette-desc">Search pages, recent work, and authored content.</p>
          </div>
          <span className="command-palette-shortcut">Esc</span>
        </div>
        <input
          autoFocus
          className="input command-palette-input"
          placeholder="Search pages, entities, or ids..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="command-palette-results">
          {filteredCommands.length === 0 ? (
            <div className="command-palette-empty">No matches.</div>
          ) : (
            filteredCommands.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={`command-palette-item${index === selectedIndex ? " command-palette-item--active" : ""}`}
                onMouseEnter={() => setSelectedIndex(index)}
                onClick={() => handleSelect(item)}
              >
                <div className="command-palette-item-main">
                  <span className="command-palette-item-label">{item.label}</span>
                </div>
                <span className="command-palette-item-meta">{item.meta}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
