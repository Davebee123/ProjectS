import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "../layout/PageShell";
import { createDefaultQuest, useQuestStore } from "../../stores/questStore";
import type { QuestTemplate } from "../../schema/types";

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

const CATEGORY_LABELS = {
  main_story: "Main Story",
  side_quest: "Side Quests",
  task: "Tasks",
} as const;

type QuestStatusFilter = "all" | "attention" | "ready";
type QuestSortMode = "issues" | "name" | "level";

interface QuestDiagnostics {
  missingDescription: boolean;
  noObjectives: boolean;
  invalidLevel: boolean;
  objectiveDescriptionIssues: number;
  objectiveProgressIssues: number;
  issueCount: number;
}

function analyzeQuest(quest: QuestTemplate): QuestDiagnostics {
  const missingDescription = !quest.description.trim();
  const noObjectives = quest.objectives.length === 0;
  const invalidLevel = quest.level <= 0;
  const objectiveDescriptionIssues = quest.objectives.filter((objective) => !objective.description.trim()).length;
  const objectiveProgressIssues = quest.objectives.filter((objective) => {
    if (objective.progress.kind === "freeform") {
      return !objective.progress.text.trim();
    }
    return !objective.progress.label.trim() || objective.progress.requiredValue <= 0;
  }).length;

  return {
    missingDescription,
    noObjectives,
    invalidLevel,
    objectiveDescriptionIssues,
    objectiveProgressIssues,
    issueCount:
      Number(missingDescription) +
      Number(noObjectives) +
      Number(invalidLevel) +
      objectiveDescriptionIssues +
      objectiveProgressIssues,
  };
}

function duplicateQuest(source: QuestTemplate, quests: QuestTemplate[]): QuestTemplate {
  const existingIds = new Set(quests.map((quest) => quest.id));
  const nextId = makeUniqueId(`${source.id}_copy`, existingIds);
  return {
    ...source,
    id: nextId,
    name: `${source.name} Copy`,
    objectives: source.objectives.map((objective, index) => ({
      ...objective,
      id: `${nextId}_objective_${index + 1}`,
    })),
  };
}

export function QuestListPage() {
  const { quests, addQuest, removeQuest } = useQuestStore();
  const navigate = useNavigate();
  const [newName, setNewName] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<QuestStatusFilter>("all");
  const [sortMode, setSortMode] = useState<QuestSortMode>("issues");
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set(["side_quest", "task"]));

  const questRows = useMemo(
    () =>
      quests.map((quest) => ({
        quest,
        diagnostics: analyzeQuest(quest),
      })),
    [quests]
  );

  const filtered = useMemo(() => {
    return questRows.filter(({ quest, diagnostics }) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        quest.name.toLowerCase().includes(q) ||
        quest.id.toLowerCase().includes(q) ||
        (quest.folder ?? "").toLowerCase().includes(q);
      if (!matchesSearch) {
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
  }, [questRows, search, statusFilter]);

  const grouped = useMemo(
    () =>
      (Object.keys(CATEGORY_LABELS) as Array<keyof typeof CATEGORY_LABELS>).map((category) => [
        category,
        filtered.filter((row) => row.quest.category === category),
      ] as const),
    [filtered]
  );

  const summary = useMemo(() => {
    const attention = questRows.filter((row) => row.diagnostics.issueCount > 0).length;
    return {
      total: quests.length,
      main: quests.filter((quest) => quest.category === "main_story").length,
      side: quests.filter((quest) => quest.category === "side_quest").length,
      attention,
    };
  }, [questRows, quests]);

  const toggleCategory = (name: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    const id = slugify(name);
    if (quests.some((quest) => quest.id === id)) return;
    addQuest(createDefaultQuest(id, name));
    setNewName("");
    navigate(`/quests/${id}`);
  };

  const handleDuplicate = (quest: QuestTemplate) => {
    const duplicate = duplicateQuest(quest, quests);
    addQuest(duplicate);
    navigate(`/quests/${duplicate.id}`);
  };

  return (
    <PageShell title="Quests">
      <section className="editor-section">
        <p className="section-desc">
          Define quest lines, structured objectives, and progression requirements.
        </p>
        <div className="index-summary-grid">
          <div className="index-summary-card">
            <span className="index-summary-label">Total Quests</span>
            <strong className="index-summary-value">{summary.total}</strong>
          </div>
          <div className="index-summary-card">
            <span className="index-summary-label">Main Story</span>
            <strong className="index-summary-value">{summary.main}</strong>
          </div>
          <div className="index-summary-card">
            <span className="index-summary-label">Side Quests</span>
            <strong className="index-summary-value">{summary.side}</strong>
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
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as QuestStatusFilter)}
          >
            <option value="all">Status: All</option>
            <option value="attention">Needs Attention</option>
            <option value="ready">Ready</option>
          </select>
          <select
            className="input select"
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as QuestSortMode)}
          >
            <option value="issues">Sort: Issues</option>
            <option value="name">Sort: Name</option>
            <option value="level">Sort: Level</option>
          </select>
        </div>
        <table className="editor-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Profile</th>
              <th>Content</th>
              <th>Issues</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {grouped.map(([category, categoryRows]) => {
              const collapsed = collapsedCategories.has(category);
              return (
                <React.Fragment key={category}>
                  <tr>
                    <td colSpan={6} style={{ padding: 0 }}>
                      <div className="folder-header" onClick={() => toggleCategory(category)}>
                        <span className={`folder-chevron${collapsed ? "" : " folder-chevron--open"}`}>{">"}</span>
                        {CATEGORY_LABELS[category]}
                        <span className="folder-count">({categoryRows.length})</span>
                      </div>
                    </td>
                  </tr>
                  {!collapsed &&
                    categoryRows
                      .slice()
                      .sort((a, b) => {
                        if (sortMode === "issues" && b.diagnostics.issueCount !== a.diagnostics.issueCount) {
                          return b.diagnostics.issueCount - a.diagnostics.issueCount;
                        }
                        if (sortMode === "level" && a.quest.level !== b.quest.level) {
                          return a.quest.level - b.quest.level;
                        }
                        return a.quest.name.localeCompare(b.quest.name);
                      })
                      .map(({ quest, diagnostics }) => (
                        <tr key={quest.id}>
                          <td className="cell-id">{quest.id}</td>
                          <td>
                            <div className="entity-list-name entity-list-name--inline">
                              <button className="link-btn" onClick={() => navigate(`/quests/${quest.id}`)}>
                                {quest.name || quest.id}
                              </button>
                              <div className="entity-badges">
                                {diagnostics.issueCount === 0 ? (
                                  <span className="editor-badge editor-badge--ok">Ready</span>
                                ) : (
                                  <span className="editor-badge editor-badge--error">{diagnostics.issueCount} issue{diagnostics.issueCount === 1 ? "" : "s"}</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="entity-list-summary">
                              <span>Level {quest.level}</span>
                              <span>{CATEGORY_LABELS[quest.category]}</span>
                              {quest.unlockCondition ? <span>Unlock Rule</span> : null}
                            </div>
                          </td>
                          <td>
                            <div className="entity-badges">
                              <span className="editor-badge editor-badge--neutral">
                                {quest.objectives.length} objective{quest.objectives.length === 1 ? "" : "s"}
                              </span>
                              {quest.completeCondition ? (
                                <span className="editor-badge editor-badge--neutral">Quest completion rule</span>
                              ) : null}
                            </div>
                          </td>
                          <td>
                            <div className="entity-badges">
                              {diagnostics.missingDescription ? (
                                <span className="editor-badge editor-badge--warn">No description</span>
                              ) : null}
                              {diagnostics.noObjectives ? (
                                <span className="editor-badge editor-badge--error">No objectives</span>
                              ) : null}
                              {diagnostics.invalidLevel ? (
                                <span className="editor-badge editor-badge--warn">Invalid level</span>
                              ) : null}
                              {diagnostics.objectiveDescriptionIssues > 0 ? (
                                <span className="editor-badge editor-badge--warn">{diagnostics.objectiveDescriptionIssues} objective text issue{diagnostics.objectiveDescriptionIssues === 1 ? "" : "s"}</span>
                              ) : null}
                              {diagnostics.objectiveProgressIssues > 0 ? (
                                <span className="editor-badge editor-badge--warn">{diagnostics.objectiveProgressIssues} progress issue{diagnostics.objectiveProgressIssues === 1 ? "" : "s"}</span>
                              ) : null}
                              {diagnostics.issueCount === 0 ? <span className="entity-quiet-text">No issues</span> : null}
                            </div>
                          </td>
                          <td>
                            <div className="entity-row-actions">
                              <button className="btn btn--sm" onClick={() => handleDuplicate(quest)}>
                                Duplicate
                              </button>
                              <button className="btn btn--danger btn--sm" onClick={() => removeQuest(quest.id)}>
                                Remove
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        <div className="add-row">
          <input
            type="text"
            placeholder="New quest name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="input"
          />
          <button className="btn btn--primary" onClick={handleAdd}>
            Add Quest
          </button>
        </div>
      </section>
    </PageShell>
  );
}
