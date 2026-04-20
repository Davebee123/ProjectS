import { useState } from "react";
import { PageShell } from "../layout/PageShell";
import { useProjectStore } from "../../stores/projectStore";
import { useStorageKeyStore } from "../../stores/storageKeyStore";
import { useItemStore } from "../../stores/itemStore";
import { useSkillStore } from "../../stores/skillStore";
import { useStatusEffectStore } from "../../stores/statusEffectStore";
import { useInteractableStore } from "../../stores/interactableStore";
import { useWorldStore } from "../../stores/worldStore";
import { useRecipeStore } from "../../stores/recipeStore";
import { useQuestStore } from "../../stores/questStore";
import { useDialogueStore } from "../../stores/dialogueStore";
import { useCutsceneStore } from "../../stores/cutsceneStore";
import { useItemizationStore } from "../../stores/itemizationStore";
import { saveBundleToContent, type RepoSyncResponse } from "../../api/repoSync";
import { createBlankBundle } from "../../utils/createBlankBundle";
import type { ValidationIssue } from "../../../../shared/content/validation";
import type { GameContentBundle } from "../../../../shared/content/types";
import { useBundleValidation } from "../../hooks/useBundleValidation";
import { getComparableBundleSignature } from "../../utils/bundleSignature";

export function ExportPage() {
  const {
    exportBundle,
    downloadJson,
    importBundle,
    resetAllStores,
    markRepoLoaded,
    markRepoSaved,
  } = useProjectStore();
  const [preview, setPreview] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [repoStatus, setRepoStatus] = useState<string | null>(null);
  const [repoBusy, setRepoBusy] = useState(false);
  const issues = useBundleValidation();

  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");

  // Counts for the summary
  const { items } = useItemStore();
  const { skills } = useSkillStore();
  const { statusEffects } = useStatusEffectStore();
  const { interactables } = useInteractableStore();
  const { dialogues } = useDialogueStore();
  const { cutscenes } = useCutsceneStore();
  const { quests } = useQuestStore();
  const { recipes } = useRecipeStore();
  const { world } = useWorldStore();
  const { storageKeys } = useStorageKeyStore();
  const {
    itemClasses,
    affixTables,
    modifierStats,
    itemBases,
    affixes,
    itemQualityRules,
    uniqueItems,
    itemSets,
  } = useItemizationStore();

  const handlePreview = () => {
    const bundle = exportBundle();
    setPreview(JSON.stringify(bundle, null, 2));
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const bundle = JSON.parse(text);
        importBundle(bundle);
        setImportStatus(`Imported successfully from ${file.name}`);
        setTimeout(() => setImportStatus(null), 3000);
      } catch (err) {
        setImportStatus(`Import failed: ${err}`);
      }
    };
    input.click();
  };

  const handleStartBlankProject = () => {
    const confirmed = window.confirm(
      "Start from a blank project? This will replace the current in-browser editor state."
    );
    if (!confirmed) {
      return;
    }
    importBundle(createBlankBundle());
    setImportStatus("Blank project loaded locally. Use Save to content/ when ready.");
    setTimeout(() => setImportStatus(null), 4000);
  };

  const handleLoadFromContent = async () => {
    setRepoBusy(true);
    setRepoStatus(null);
    try {
      const response = await fetch("/api/content/bundle");
      const payload = (await response.json()) as RepoSyncResponse;
      if (!response.ok || !payload.bundle) {
        setRepoStatus(payload.message ?? "Failed to load from content/");
        return;
      }
      const localBundle = exportBundle();
      if (
        getComparableBundleSignature(localBundle) !==
        getComparableBundleSignature(payload.bundle)
      ) {
        const confirmed = window.confirm(
          "Local editor state differs from content/. Loading will replace your current in-browser changes. Continue?"
        );
        if (!confirmed) {
          setRepoStatus("Load from content/ cancelled. Local editor state was kept.");
          return;
        }
      }
      importBundle(payload.bundle);
      markRepoLoaded(payload.bundle);
      const warningCount = payload.issues?.filter((issue) => issue.severity === "warning").length ?? 0;
      setRepoStatus(
        warningCount > 0
          ? `Loaded from content/ with ${warningCount} warning${warningCount === 1 ? "" : "s"}.`
          : "Loaded current repo content into the editor."
      );
    } catch (error) {
      setRepoStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setRepoBusy(false);
    }
  };

  const handleSaveToContent = async () => {
    setRepoBusy(true);
    setRepoStatus(null);
    try {
      const bundle = exportBundle();
      const payload = await saveBundleToContent(bundle);
      if (!payload.ok) {
        setRepoStatus(payload.message ?? "Failed to save to content/");
        return;
      }
      markRepoSaved(bundle);
      const warningCount = payload.issues?.filter((issue) => issue.severity === "warning").length ?? 0;
      setRepoStatus(
        warningCount > 0
          ? `Saved to content/ and regenerated game-content.json with ${warningCount} warning${warningCount === 1 ? "" : "s"}.`
          : "Saved to content/ and regenerated game-content.json."
      );
    } catch (error) {
      setRepoStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setRepoBusy(false);
    }
  };

  return (
    <PageShell title="Export / Import">
      <section className="editor-section">
        <h3 className="section-title">Repo Sync</h3>
        <p className="section-desc">
          Sync directly with the canonical content/ files in this repo. Loading replaces the current editor state. Saving rewrites content/ and regenerates public/data/game-content.json. This is available when running the editor through `npm run dev`.
        </p>
        <div className="button-row">
          <button className="btn btn--primary" onClick={handleLoadFromContent} disabled={repoBusy}>
            Load from content/
          </button>
          <button className="btn" onClick={handleSaveToContent} disabled={repoBusy}>
            Save to content/
          </button>
        </div>
        {repoStatus && <p className="status-msg">{repoStatus}</p>}
      </section>

      {/* Content Summary */}
      <section className="editor-section">
        <h3 className="section-title">Content Summary</h3>
        <div className="summary-grid">
          <div className="summary-item">
            <span className="summary-count">{items.length}</span>
            <span className="summary-label">Items</span>
          </div>
          <div className="summary-item">
            <span className="summary-count">{skills.length}</span>
            <span className="summary-label">Skills</span>
          </div>
          <div className="summary-item">
            <span className="summary-count">{statusEffects.length}</span>
            <span className="summary-label">Effects</span>
          </div>
          <div className="summary-item">
            <span className="summary-count">{interactables.length}</span>
            <span className="summary-label">Interactables</span>
          </div>
          <div className="summary-item">
            <span className="summary-count">{dialogues.length}</span>
            <span className="summary-label">Dialogues</span>
          </div>
          <div className="summary-item">
            <span className="summary-count">{cutscenes.length}</span>
            <span className="summary-label">Cutscenes</span>
          </div>
          <div className="summary-item">
            <span className="summary-count">{quests.length}</span>
            <span className="summary-label">Quests</span>
          </div>
          <div className="summary-item">
            <span className="summary-count">{recipes.length}</span>
            <span className="summary-label">Recipes</span>
          </div>
          <div className="summary-item">
            <span className="summary-count">{itemClasses.length}</span>
            <span className="summary-label">Item Classes</span>
          </div>
          <div className="summary-item">
            <span className="summary-count">{affixTables.length}</span>
            <span className="summary-label">Affix Tables</span>
          </div>
          <div className="summary-item">
            <span className="summary-count">{modifierStats.length}</span>
            <span className="summary-label">Modifier Stats</span>
          </div>
          <div className="summary-item">
            <span className="summary-count">{itemBases.length}</span>
            <span className="summary-label">Item Bases</span>
          </div>
          <div className="summary-item">
            <span className="summary-count">{affixes.length}</span>
            <span className="summary-label">Affixes</span>
          </div>
          <div className="summary-item">
            <span className="summary-count">{itemQualityRules.length}</span>
            <span className="summary-label">Quality Rules</span>
          </div>
          <div className="summary-item">
            <span className="summary-count">{uniqueItems.length}</span>
            <span className="summary-label">Unique Items</span>
          </div>
          <div className="summary-item">
            <span className="summary-count">{itemSets.length}</span>
            <span className="summary-label">Item Sets</span>
          </div>
          <div className="summary-item">
            <span className="summary-count">{world.rooms.length}</span>
            <span className="summary-label">Rooms</span>
          </div>
          <div className="summary-item">
            <span className="summary-count">{storageKeys.length}</span>
            <span className="summary-label">Storage Keys</span>
          </div>
        </div>
      </section>

      {/* Validation */}
      <section className="editor-section">
        <h3 className="section-title">
          Validation
          {errors.length === 0 && warnings.length === 0 && (
            <span className="kind-badge kind-badge--passive" style={{ marginLeft: 8 }}>
              All clear
            </span>
          )}
          {errors.length > 0 && (
            <span className="removal-badge removal-badge--timed" style={{ marginLeft: 8 }}>
              {errors.length} error{errors.length !== 1 ? "s" : ""}
            </span>
          )}
          {warnings.length > 0 && (
            <span className="removal-badge removal-badge--both" style={{ marginLeft: 8 }}>
              {warnings.length} warning{warnings.length !== 1 ? "s" : ""}
            </span>
          )}
        </h3>
        {issues.length === 0 ? (
          <p className="section-desc">No issues found. Ready to export!</p>
        ) : (
          <div className="validation-list">
            {errors.map((issue, i) => (
              <div key={`e${i}`} className="validation-item validation-item--error">
                {issue.message}
              </div>
            ))}
            {warnings.map((issue, i) => (
              <div key={`w${i}`} className="validation-item validation-item--warning">
                {issue.message}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Export */}
      <section className="editor-section">
        <h3 className="section-title">Export</h3>
        <p className="section-desc">
          Export a bundle snapshot for the game runtime or for backup/import. The canonical authored data now lives in the repo's content/ directory.
        </p>
        <div className="button-row">
          <button className="btn btn--primary" onClick={downloadJson}>
            Download game-content.json
          </button>
          <button className="btn" onClick={handlePreview}>
            {preview ? "Refresh Preview" : "Preview JSON"}
          </button>
        </div>
        {preview && <pre className="json-preview">{preview}</pre>}
      </section>

      {/* Import */}
      <section className="editor-section">
        <h3 className="section-title">Import</h3>
        <p className="section-desc">
          Load an existing bundle snapshot to continue editing locally. Import replaces the current in-browser editor state.
        </p>
        <div className="button-row">
          <button className="btn" onClick={handleImport}>
            Import JSON File
          </button>
          <button className="btn" onClick={handleStartBlankProject}>
            Start Blank Project
          </button>
        </div>
        {importStatus && <p className="status-msg">{importStatus}</p>}
      </section>

      {/* Reset */}
      <section className="editor-section">
        <h3 className="section-title">Reset</h3>
        <p className="section-desc">
          Clear all editor data and start fresh. This cannot be undone.
        </p>
        <button
          className="btn btn--danger"
          onClick={() => {
            if (window.confirm("Are you sure? All editor content will be permanently deleted.")) {
              resetAllStores();
            }
          }}
        >
          Reset to Defaults
        </button>
      </section>
    </PageShell>
  );
}
