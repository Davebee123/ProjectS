import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "../layout/PageShell";
import {
  createInteractableFromTemplate,
  type InteractableTemplatePreset,
  useInteractableStore,
} from "../../stores/interactableStore";
import { useTagStore } from "../../stores/tagStore";
import type { InteractableTemplate } from "../../schema/types";
import { normalizeNpcDialogueRoutes } from "../../utils/interactables";

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function makeUniqueId(base: string, existing: Set<string>): string {
  if (!existing.has(base)) {
    return base;
  }
  let index = 2;
  while (existing.has(`${base}_${index}`)) {
    index += 1;
  }
  return `${base}_${index}`;
}

type InteractableStatusFilter = "all" | "attention" | "ready";
type InteractableSortMode = "issues" | "name" | "level" | "activity";

const INTERACTABLE_TEMPLATE_OPTIONS: Array<{
  id: InteractableTemplatePreset;
  label: string;
}> = [
  { id: "blank", label: "Blank" },
  { id: "enemy", label: "Enemy" },
  { id: "friendly", label: "Friendly" },
  { id: "npc", label: "NPC" },
  { id: "gathering_node", label: "Gathering Node" },
];

interface InteractableDiagnostics {
  conditionalDialogueCount: number;
  missingDescription: boolean;
  missingActivityTag: boolean;
  missingEnemyAbilities: boolean;
  missingNpcDialogue: boolean;
  missingImage: boolean;
  issueCount: number;
}

function analyzeInteractable(interactable: InteractableTemplate): InteractableDiagnostics {
  const validConditionalDialogueCount = normalizeNpcDialogueRoutes(interactable.npc?.dialogues).filter((route) =>
    Boolean(route.dialogueId?.trim())
  ).length;
  const hasNpcDialogue =
    Boolean(interactable.npc?.dialogueId?.trim()) ||
    validConditionalDialogueCount > 0;
  const missingDescription = !interactable.description.trim();
  const missingActivityTag = !interactable.activityTag.trim();
  const missingEnemyAbilities = interactable.activityTag === "enemy" && interactable.abilities.length === 0;
  const missingNpcDialogue = interactable.activityTag === "npc" && !hasNpcDialogue;
  const missingImage = !interactable.image?.trim();
  const issueCount = [
    missingDescription,
    missingActivityTag,
    missingEnemyAbilities,
    missingNpcDialogue,
    missingImage,
  ].filter(Boolean).length;
  return {
    conditionalDialogueCount: validConditionalDialogueCount,
    missingDescription,
    missingActivityTag,
    missingEnemyAbilities,
    missingNpcDialogue,
    missingImage,
    issueCount,
  };
}

function duplicateInteractable(source: InteractableTemplate, interactables: InteractableTemplate[]): InteractableTemplate {
  const existingIds = new Set(interactables.map((interactable) => interactable.id));
  const nextId = makeUniqueId(`${source.id}_copy`, existingIds);
  return {
    ...source,
    id: nextId,
    name: `${source.name} Copy`,
  };
}

export function InteractableListPage() {
  const { interactables, addInteractable, removeInteractable } = useInteractableStore();
  const { activityTags } = useTagStore();
  const navigate = useNavigate();
  const [newName, setNewName] = useState("");
  const [search, setSearch] = useState("");
  const [activityFilter, setActivityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<InteractableStatusFilter>("all");
  const [sortMode, setSortMode] = useState<InteractableSortMode>("issues");
  const [templatePreset, setTemplatePreset] = useState<InteractableTemplatePreset>("blank");
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [showContent, setShowContent] = useState(false);

  const interactableRows = useMemo(
    () =>
      interactables.map((interactable) => ({
        interactable,
        diagnostics: analyzeInteractable(interactable),
      })),
    [interactables]
  );

  const filtered = useMemo(() => {
    return interactableRows.filter(({ interactable, diagnostics }) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        interactable.name.toLowerCase().includes(q) ||
        interactable.id.toLowerCase().includes(q) ||
        (interactable.folder ?? "").toLowerCase().includes(q);
      if (!matchesSearch) {
        return false;
      }
      if (activityFilter !== "all" && interactable.activityTag !== activityFilter) {
        return false;
      }
      if (statusFilter === "attention") {
        return diagnostics.issueCount > 0;
      }
      if (statusFilter === "ready") {
        return diagnostics.issueCount === 0;
      }
      return true;
    });
  }, [activityFilter, interactableRows, search, statusFilter]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const row of filtered) {
      const key = row.interactable.folder?.trim() || "(Ungrouped)";
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(row);
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === "(Ungrouped)") return 1;
      if (b === "(Ungrouped)") return -1;
      return a.localeCompare(b);
    });
  }, [filtered]);

  const summary = useMemo(() => {
    const attention = interactableRows.filter((row) => row.diagnostics.issueCount > 0).length;
    const enemies = interactables.filter((interactable) => interactable.activityTag === "enemy").length;
    const npcs = interactables.filter((interactable) => interactable.activityTag === "npc").length;
    return { total: interactables.length, enemies, npcs, attention };
  }, [interactableRows, interactables]);

  const toggleFolder = (name: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    const id = slugify(name);
    if (interactables.some((interactable) => interactable.id === id)) return;
    addInteractable(createInteractableFromTemplate(id, name, templatePreset));
    setNewName("");
    navigate(`/interactables/${id}`);
  };

  const handleDuplicate = (interactable: InteractableTemplate) => {
    const duplicate = duplicateInteractable(interactable, interactables);
    addInteractable(duplicate);
    navigate(`/interactables/${duplicate.id}`);
  };

  return (
    <PageShell title="Interactables">
      <section className="editor-section">
        <p className="section-desc">
          Define world objects, NPCs, and enemies. Each interactable controls presentation, abilities, drops, and authored hooks.
        </p>
        <div className="index-summary-grid">
          <div className="index-summary-card">
            <span className="index-summary-label">Total Interactables</span>
            <strong className="index-summary-value">{summary.total}</strong>
          </div>
          <div className="index-summary-card">
            <span className="index-summary-label">Enemies</span>
            <strong className="index-summary-value">{summary.enemies}</strong>
          </div>
          <div className="index-summary-card">
            <span className="index-summary-label">NPCs</span>
            <strong className="index-summary-value">{summary.npcs}</strong>
          </div>
          <div className="index-summary-card">
            <span className="index-summary-label">Needs Attention</span>
            <strong className="index-summary-value">{summary.attention}</strong>
          </div>
        </div>
        <div className="filter-bar">
          <input
            className="input"
            placeholder="Search name, ID, or folder..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="input select"
            value={activityFilter}
            onChange={(e) => setActivityFilter(e.target.value)}
          >
            <option value="all">Activity: All</option>
            {activityTags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.label || tag.id}
              </option>
            ))}
          </select>
          <select
            className="input select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as InteractableStatusFilter)}
          >
            <option value="all">Status: All</option>
            <option value="attention">Needs Attention</option>
            <option value="ready">Ready</option>
          </select>
          <select
            className="input select"
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as InteractableSortMode)}
          >
            <option value="issues">Sort: Issues</option>
            <option value="name">Sort: Name</option>
            <option value="level">Sort: Level</option>
            <option value="activity">Sort: Activity</option>
          </select>
          <button
            type="button"
            className={`btn btn--sm${showContent ? "" : " btn--ghost"}`}
            onClick={() => setShowContent((prev) => !prev)}
          >
            {showContent ? "Hide Content" : "Show Content"}
          </button>
        </div>
        <div className={`interactable-index${showContent ? " interactable-index--with-content" : ""}`}>
          <div className="interactable-index-grid interactable-index-header">
            <div>ID</div>
            <div>Name</div>
            <div>Status</div>
            {showContent ? <div>Content</div> : null}
            <div>Issues</div>
            <div></div>
          </div>
          {groups.map(([folderName, groupItems]) => {
            const collapsed = collapsedFolders.has(folderName);
            const sortedItems = groupItems
              .slice()
              .sort((a, b) => {
                if (sortMode === "issues" && b.diagnostics.issueCount !== a.diagnostics.issueCount) {
                  return b.diagnostics.issueCount - a.diagnostics.issueCount;
                }
                if (sortMode === "level" && a.interactable.requiredLevel !== b.interactable.requiredLevel) {
                  return a.interactable.requiredLevel - b.interactable.requiredLevel;
                }
                if (sortMode === "activity" && a.interactable.activityTag !== b.interactable.activityTag) {
                  return a.interactable.activityTag.localeCompare(b.interactable.activityTag);
                }
                return a.interactable.name.localeCompare(b.interactable.name);
              });

            return (
              <section key={folderName} className="interactable-index-group">
                <div className="folder-header" onClick={() => toggleFolder(folderName)}>
                  <span className={`folder-chevron${collapsed ? "" : " folder-chevron--open"}`}>{">"}</span>
                  {folderName}
                  <span className="folder-count">({groupItems.length})</span>
                </div>
                {!collapsed
                  ? sortedItems.map(({ interactable, diagnostics }) => (
                      <div key={interactable.id} className="interactable-index-grid interactable-index-row">
                        <div className="cell-id">{interactable.id}</div>
                        <div className="cell-name">
                          <div className="entity-list-name entity-list-name--compact">
                            <button className="link-btn" onClick={() => navigate(`/interactables/${interactable.id}`)}>
                              {interactable.name}
                            </button>
                          </div>
                        </div>
                        <div className="cell-status">
                          {diagnostics.issueCount === 0 ? (
                            <span className="editor-badge editor-badge--ok">Ready</span>
                          ) : (
                            <span className="editor-badge editor-badge--error">
                              {diagnostics.issueCount} issue{diagnostics.issueCount === 1 ? "" : "s"}
                            </span>
                          )}
                        </div>
                        {showContent ? (
                          <div className="cell-content">
                            <div className="entity-badges">
                              <span className="editor-badge editor-badge--neutral">
                                {interactable.activityTag || "No activity tag"}
                              </span>
                              <span className="editor-badge editor-badge--neutral">
                                Level {interactable.requiredLevel}
                              </span>
                              <span className="editor-badge editor-badge--neutral">
                                {interactable.abilityBehaviorMode || "priority"} behavior
                              </span>
                              <span className="editor-badge editor-badge--neutral">
                                {interactable.abilities.length} abilit{interactable.abilities.length === 1 ? "y" : "ies"}
                              </span>
                              <span className="editor-badge editor-badge--neutral">
                                {interactable.lootTable.length} loot
                              </span>
                              <span className="editor-badge editor-badge--neutral">
                                {interactable.xpRewards.length} XP reward{interactable.xpRewards.length === 1 ? "" : "s"}
                              </span>
                              {Boolean(interactable.npc?.dialogueId?.trim()) || diagnostics.conditionalDialogueCount > 0 ? (
                                <span className="editor-badge editor-badge--neutral">
                                  {diagnostics.conditionalDialogueCount > 0
                                    ? `${diagnostics.conditionalDialogueCount} conditional dialogue${diagnostics.conditionalDialogueCount === 1 ? "" : "s"}`
                                    : "Dialogue linked"}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                        <div className="cell-issues">
                          <div className="entity-badges">
                            {diagnostics.missingDescription ? (
                              <span className="editor-badge editor-badge--warn">No description</span>
                            ) : null}
                            {diagnostics.missingActivityTag ? (
                              <span className="editor-badge editor-badge--warn">No activity tag</span>
                            ) : null}
                            {diagnostics.missingImage ? (
                              <span className="editor-badge editor-badge--warn">No image</span>
                            ) : null}
                            {diagnostics.missingEnemyAbilities ? (
                              <span className="editor-badge editor-badge--error">Enemy has no abilities</span>
                            ) : null}
                            {diagnostics.missingNpcDialogue ? (
                              <span className="editor-badge editor-badge--error">NPC has no dialogue</span>
                            ) : null}
                            {diagnostics.issueCount === 0 ? <span className="entity-quiet-text">No issues</span> : null}
                          </div>
                        </div>
                        <div className="cell-actions">
                          <div className="entity-row-actions">
                            <button className="btn btn--sm" onClick={() => handleDuplicate(interactable)}>
                              Duplicate
                            </button>
                            <button className="btn btn--danger btn--sm" onClick={() => removeInteractable(interactable.id)}>
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  : null}
              </section>
            );
          })}
        </div>
        <div className="add-row">
          <input
            type="text"
            placeholder="New interactable name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="input"
          />
          <select
            className="input select"
            value={templatePreset}
            onChange={(e) => setTemplatePreset(e.target.value as InteractableTemplatePreset)}
          >
            {INTERACTABLE_TEMPLATE_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <button className="btn btn--primary" onClick={handleAdd}>
            New from Template
          </button>
        </div>
      </section>
    </PageShell>
  );
}
