import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CommandPalette } from "./components/layout/CommandPalette";
import { EditorTrustBar } from "./components/layout/EditorTrustBar";
import { Sidebar } from "./components/layout/Sidebar";
import { TagManagerPage } from "./components/tags/TagManagerPage";
import { StorageKeysPage } from "./components/storage/StorageKeysPage";
import { ItemListPage } from "./components/items/ItemListPage";
import { ItemEditPage } from "./components/items/ItemEditPage";
import { SkillListPage } from "./components/skills/SkillListPage";
import { SkillEditPage } from "./components/skills/SkillEditPage";
import { StatusEffectListPage } from "./components/statusEffects/StatusEffectListPage";
import { StatusEffectEditPage } from "./components/statusEffects/StatusEffectEditPage";
import { InteractableListPage } from "./components/interactables/InteractableListPage";
import { InteractableEditPage } from "./components/interactables/InteractableEditPage";
import { WorldMapPage } from "./components/world/WorldMapPage";
import { RoomEditPage } from "./components/world/RoomEditPage";
import { ExportPage } from "./components/project/ExportPage";
import { TestConditionPage } from "./components/testing/TestConditionPage";
import { DslDictionaryPage } from "./components/testing/DslDictionaryPage";
import { RecipeListPage } from "./components/recipes/RecipeListPage";
import { RecipeEditPage } from "./components/recipes/RecipeEditPage";
import { QuestListPage } from "./components/quests/QuestListPage";
import { QuestEditPage } from "./components/quests/QuestEditPage";
import { DialogueListPage } from "./components/dialogues/DialogueListPage";
import { DialogueEditPage } from "./components/dialogues/DialogueEditPage";
import { CutsceneListPage } from "./components/cutscenes/CutsceneListPage";
import { CutsceneEditPage } from "./components/cutscenes/CutsceneEditPage";
import { ItemizationRegistryPage } from "./components/itemization/ItemizationRegistryPage";
import { ItemBaseListPage } from "./components/itemization/ItemBaseListPage";
import { ItemBaseEditPage } from "./components/itemization/ItemBaseEditPage";
import { AffixListPage } from "./components/itemization/AffixListPage";
import { AffixEditPage } from "./components/itemization/AffixEditPage";
import { UniqueItemListPage } from "./components/itemization/UniqueItemListPage";
import { UniqueItemEditPage } from "./components/itemization/UniqueItemEditPage";
import { ItemSetListPage } from "./components/itemization/ItemSetListPage";
import { ItemSetEditPage } from "./components/itemization/ItemSetEditPage";
import { WeatherListPage } from "./components/weather/WeatherListPage";
import { WeatherEditPage } from "./components/weather/WeatherEditPage";
import { useUnsavedChangesWarning } from "./hooks/useUnsavedChangesWarning";
import { useHistoryStore } from "./stores/historyStore";
import { useProjectStore } from "./stores/projectStore";
import "./styles/editor.css";

function useUndoRedoKeys() {
  const undo = useHistoryStore((s) => s.undo);
  const redo = useHistoryStore((s) => s.redo);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (
        ((e.ctrlKey || e.metaKey) && e.key === "y") ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "z")
      ) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]);
}

/** On first mount, pull the content/ folder bundle and import it into editor stores.
 *  This ensures localStorage never drifts from the actual content files. */
function useAutoSyncFromContent() {
  const importBundle = useProjectStore((s) => s.importBundle);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/content/bundle")
      .then((res) => res.json())
      .then((payload) => {
        if (cancelled) return;
        if (payload.ok && payload.bundle) {
          importBundle(payload.bundle);
          console.log("[editor] Auto-synced from content/ folder");
        }
      })
      .catch((err) => {
        console.warn("[editor] Auto-sync from content/ failed:", err);
      })
      .finally(() => {
        if (!cancelled) setSynced(true);
      });
    return () => { cancelled = true; };
  }, [importBundle]);

  return synced;
}

function EditorShell() {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const synced = useAutoSyncFromContent();
  useUnsavedChangesWarning();

  useEffect(() => {
    const handlePaletteShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", handlePaletteShortcut);
    return () => window.removeEventListener("keydown", handlePaletteShortcut);
  }, []);

  return (
    <div className="app-layout">
      <Sidebar onOpenCommandPalette={() => setCommandPaletteOpen(true)} />
      <main className="main-content">
        <EditorTrustBar />
        <Routes>
          <Route path="/" element={<TagManagerPage />} />
          <Route path="/storage" element={<StorageKeysPage />} />
          <Route path="/status-effects" element={<StatusEffectListPage />} />
          <Route path="/status-effects/:id" element={<StatusEffectEditPage />} />
          <Route path="/items" element={<ItemListPage />} />
          <Route path="/items/:id" element={<ItemEditPage />} />
          <Route path="/skills" element={<SkillListPage />} />
          <Route path="/skills/:id" element={<SkillEditPage />} />
          <Route path="/interactables" element={<InteractableListPage />} />
          <Route path="/interactables/:id" element={<InteractableEditPage />} />
          <Route path="/world" element={<WorldMapPage />} />
          <Route path="/world/rooms/:id" element={<RoomEditPage />} />
          <Route path="/export" element={<ExportPage />} />
          <Route path="/recipes" element={<RecipeListPage />} />
          <Route path="/recipes/:id" element={<RecipeEditPage />} />
          <Route path="/quests" element={<QuestListPage />} />
          <Route path="/quests/:id" element={<QuestEditPage />} />
          <Route path="/dialogues" element={<DialogueListPage />} />
          <Route path="/dialogues/:id" element={<DialogueEditPage />} />
          <Route path="/cutscenes" element={<CutsceneListPage />} />
          <Route path="/cutscenes/:id" element={<CutsceneEditPage />} />
          <Route path="/itemization/registries" element={<ItemizationRegistryPage />} />
          <Route path="/itemization/bases" element={<ItemBaseListPage />} />
          <Route path="/itemization/bases/:id" element={<ItemBaseEditPage />} />
          <Route path="/itemization/affixes" element={<AffixListPage />} />
          <Route path="/itemization/affixes/:id" element={<AffixEditPage />} />
          <Route path="/itemization/uniques" element={<UniqueItemListPage />} />
          <Route path="/itemization/uniques/:id" element={<UniqueItemEditPage />} />
          <Route path="/itemization/sets" element={<ItemSetListPage />} />
          <Route path="/itemization/sets/:id" element={<ItemSetEditPage />} />
          <Route path="/weather" element={<WeatherListPage />} />
          <Route path="/weather/:id" element={<WeatherEditPage />} />
          <Route path="/test" element={<TestConditionPage />} />
          <Route path="/dsl" element={<DslDictionaryPage />} />
        </Routes>
      </main>
      <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
    </div>
  );
}

export default function App() {
  useUndoRedoKeys();

  return (
    <BrowserRouter>
      <EditorShell />
    </BrowserRouter>
  );
}
