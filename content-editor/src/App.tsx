import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
import { ComboListPage } from "./components/combos/ComboListPage";
import { ComboEditPage } from "./components/combos/ComboEditPage";
import { WorldMapPage } from "./components/world/WorldMapPage";
import { RoomEditPage } from "./components/world/RoomEditPage";
import { ExportPage } from "./components/project/ExportPage";
import { TestConditionPage } from "./components/testing/TestConditionPage";
import { DslDictionaryPage } from "./components/testing/DslDictionaryPage";
import { useHistoryStore } from "./stores/historyStore";
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

export default function App() {
  useUndoRedoKeys();

  return (
    <BrowserRouter>
      <div className="app-layout">
        <Sidebar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<TagManagerPage />} />
            <Route path="/storage" element={<StorageKeysPage />} />
            <Route path="/status-effects" element={<StatusEffectListPage />} />
            <Route path="/status-effects/:id" element={<StatusEffectEditPage />} />
            <Route path="/items" element={<ItemListPage />} />
            <Route path="/items/:id" element={<ItemEditPage />} />
            <Route path="/skills" element={<SkillListPage />} />
            <Route path="/skills/:id" element={<SkillEditPage />} />
            <Route path="/combos" element={<ComboListPage />} />
            <Route path="/combos/:id" element={<ComboEditPage />} />
            <Route path="/interactables" element={<InteractableListPage />} />
            <Route path="/interactables/:id" element={<InteractableEditPage />} />
            <Route path="/world" element={<WorldMapPage />} />
            <Route path="/world/rooms/:id" element={<RoomEditPage />} />
            <Route path="/export" element={<ExportPage />} />
            <Route path="/test" element={<TestConditionPage />} />
            <Route path="/dsl" element={<DslDictionaryPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
