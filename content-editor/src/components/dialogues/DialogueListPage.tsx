import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "../layout/PageShell";
import { createDefaultDialogue, useDialogueStore } from "../../stores/dialogueStore";
import type { DialogueNode, DialogueTemplate } from "../../schema/types";

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

type DialogueStatusFilter = "all" | "attention" | "clean";

interface DialogueDiagnostics {
  hasMissingStartNode: boolean;
  unreachableNodes: number;
  deadEnds: number;
  unresolvedOptions: number;
  missingTargets: number;
  optionCount: number;
  totalIssues: number;
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

function analyzeDialogue(dialogue: DialogueTemplate): DialogueDiagnostics {
  const nodeLookup = new Map(dialogue.nodes.map((node) => [node.id, node]));
  const reachable = new Set<string>();
  const queue: string[] = dialogue.startNodeId && nodeLookup.has(dialogue.startNodeId) ? [dialogue.startNodeId] : [];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (reachable.has(currentId)) continue;
    const node = nodeLookup.get(currentId);
    if (!node) continue;
    reachable.add(currentId);
    if (node.nextNodeId && nodeLookup.has(node.nextNodeId)) {
      queue.push(node.nextNodeId);
    }
    for (const option of node.options) {
      if (option.nextNodeId && nodeLookup.has(option.nextNodeId)) {
        queue.push(option.nextNodeId);
      }
    }
  }

  let deadEnds = 0;
  let unresolvedOptions = 0;
  let missingTargets = 0;
  let optionCount = 0;

  for (const node of dialogue.nodes) {
    const hasMeaningfulOptions = node.options.some((option) => option.nextNodeId || option.closeDialogue);
    if (!node.nextNodeId && !hasMeaningfulOptions) {
      deadEnds += 1;
    }
    if (node.nextNodeId && !nodeLookup.has(node.nextNodeId)) {
      missingTargets += 1;
    }
    for (const option of node.options) {
      optionCount += 1;
      if (!option.nextNodeId && !option.closeDialogue) {
        unresolvedOptions += 1;
      } else if (option.nextNodeId && !nodeLookup.has(option.nextNodeId)) {
        missingTargets += 1;
      }
    }
  }

  const hasMissingStartNode = !dialogue.startNodeId || !nodeLookup.has(dialogue.startNodeId);
  const unreachableNodes = dialogue.nodes.filter((node) => !reachable.has(node.id)).length;
  const totalIssues =
    (hasMissingStartNode ? 1 : 0) + unreachableNodes + deadEnds + unresolvedOptions + missingTargets;

  return {
    hasMissingStartNode,
    unreachableNodes,
    deadEnds,
    unresolvedOptions,
    missingTargets,
    optionCount,
    totalIssues,
  };
}

function duplicateDialogue(source: DialogueTemplate, existingDialogues: DialogueTemplate[]): DialogueTemplate {
  const existingDialogueIds = new Set(existingDialogues.map((dialogue) => dialogue.id));
  const nextDialogueId = makeUniqueId(`${source.id}_copy`, existingDialogueIds);
  const nodeIdMap = new Map<string, string>();
  const existingNodeIds = new Set<string>();

  for (const node of source.nodes) {
    const nextNodeId = makeUniqueId(
      node.id.startsWith(source.id) ? node.id.replace(source.id, nextDialogueId) : `${nextDialogueId}_${node.id}`,
      existingNodeIds
    );
    existingNodeIds.add(nextNodeId);
    nodeIdMap.set(node.id, nextNodeId);
  }

  const clonedNodes: DialogueNode[] = source.nodes.map((node) => {
    const nextNodeId = nodeIdMap.get(node.id)!;
    const optionIds = new Set<string>();
    return {
      ...node,
      id: nextNodeId,
      nextNodeId: node.nextNodeId ? nodeIdMap.get(node.nextNodeId) ?? node.nextNodeId : undefined,
      options: node.options.map((option, index) => {
        const nextOptionId = makeUniqueId(`${nextNodeId}_option_${index + 1}`, optionIds);
        optionIds.add(nextOptionId);
        return {
          ...option,
          id: nextOptionId,
          nextNodeId: option.nextNodeId ? nodeIdMap.get(option.nextNodeId) ?? option.nextNodeId : undefined,
        };
      }),
    };
  });

  return {
    ...source,
    id: nextDialogueId,
    name: `${source.name} Copy`,
    startNodeId: nodeIdMap.get(source.startNodeId) ?? source.startNodeId,
    nodes: clonedNodes,
  };
}

export function DialogueListPage() {
  const { dialogues, addDialogue, removeDialogue } = useDialogueStore();
  const navigate = useNavigate();
  const [newName, setNewName] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<DialogueStatusFilter>("all");
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());

  const dialogueRows = useMemo(
    () =>
      dialogues.map((dialogue) => ({
        dialogue,
        diagnostics: analyzeDialogue(dialogue),
      })),
    [dialogues]
  );

  const filtered = useMemo(() => {
    return dialogueRows.filter(({ dialogue, diagnostics }) => {
      const query = search.trim().toLowerCase();
      const matchesSearch =
        !query ||
        dialogue.name.toLowerCase().includes(query) ||
        dialogue.id.toLowerCase().includes(query);

      if (!matchesSearch) {
        return false;
      }
      if (statusFilter === "attention") {
        return diagnostics.totalIssues > 0;
      }
      if (statusFilter === "clean") {
        return diagnostics.totalIssues === 0;
      }
      return true;
    });
  }, [dialogueRows, search, statusFilter]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const row of filtered) {
      const key = row.dialogue.folder?.trim() || "(Ungrouped)";
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
    if (dialogues.some((dialogue) => dialogue.id === id)) return;
    addDialogue(createDefaultDialogue(id, name));
    setNewName("");
    navigate(`/dialogues/${id}`);
  };

  const handleDuplicate = (dialogue: DialogueTemplate) => {
    const duplicate = duplicateDialogue(dialogue, dialogues);
    addDialogue(duplicate);
    navigate(`/dialogues/${duplicate.id}`);
  };

  return (
    <PageShell title="Dialogues">
      <section className="editor-section">
        <p className="section-desc">
          Author NPC conversation trees. Each dialogue has authored NPC text nodes and conditional player response options that can branch, close, or set storage state.
        </p>
        <div className="filter-bar">
          <input
            className="input"
            placeholder="Search name or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="input select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as DialogueStatusFilter)}
          >
            <option value="all">All Dialogues</option>
            <option value="attention">Needs Attention</option>
            <option value="clean">Clean Only</option>
          </select>
        </div>
        <table className="editor-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Start Node</th>
              <th>Coverage</th>
              <th>Issues</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {groups.map(([folderName, groupRows]) => {
              const collapsed = collapsedFolders.has(folderName);
              return (
                <React.Fragment key={folderName}>
                  <tr>
                    <td colSpan={6} style={{ padding: 0 }}>
                      <div className="folder-header" onClick={() => toggleFolder(folderName)}>
                        <span className={`folder-chevron${collapsed ? "" : " folder-chevron--open"}`}>{">"}</span>
                        {folderName}
                        <span className="folder-count">({groupRows.length})</span>
                      </div>
                    </td>
                  </tr>
                  {!collapsed &&
                    groupRows
                      .sort((a, b) => {
                        if (b.diagnostics.totalIssues !== a.diagnostics.totalIssues) {
                          return b.diagnostics.totalIssues - a.diagnostics.totalIssues;
                        }
                        return a.dialogue.name.localeCompare(b.dialogue.name);
                      })
                      .map(({ dialogue, diagnostics }) => (
                        <tr key={dialogue.id}>
                          <td className="cell-id">{dialogue.id}</td>
                          <td>
                            <div className="dialogue-list-name">
                              <button className="link-btn" onClick={() => navigate(`/dialogues/${dialogue.id}`)}>
                                {dialogue.name}
                              </button>
                              <div className="dialogue-node-list-badges">
                                {diagnostics.totalIssues === 0 ? (
                                  <span className="dialogue-badge is-start">Clean</span>
                                ) : (
                                  <span className="dialogue-badge is-error">{diagnostics.totalIssues} issues</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="cell-id">{dialogue.startNodeId}</td>
                          <td>
                            <div className="dialogue-list-summary">
                              <span>{dialogue.nodes.length} nodes</span>
                              <span>{diagnostics.optionCount} responses</span>
                            </div>
                          </td>
                          <td>
                            <div className="dialogue-node-list-badges">
                              {diagnostics.hasMissingStartNode ? <span className="dialogue-badge is-error">Start Missing</span> : null}
                              {diagnostics.missingTargets > 0 ? <span className="dialogue-badge is-error">{diagnostics.missingTargets} missing</span> : null}
                              {diagnostics.unresolvedOptions > 0 ? <span className="dialogue-badge is-warn">{diagnostics.unresolvedOptions} unresolved</span> : null}
                              {diagnostics.unreachableNodes > 0 ? <span className="dialogue-badge is-warn">{diagnostics.unreachableNodes} unreachable</span> : null}
                              {diagnostics.deadEnds > 0 ? <span className="dialogue-badge is-warn">{diagnostics.deadEnds} dead end</span> : null}
                            </div>
                          </td>
                          <td>
                            <div className="dialogue-row-actions">
                              <button className="btn btn--sm" onClick={() => handleDuplicate(dialogue)}>
                                Duplicate
                              </button>
                              <button className="btn btn--danger btn--sm" onClick={() => removeDialogue(dialogue.id)}>
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
            placeholder="New dialogue name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="input"
          />
          <button className="btn btn--primary" onClick={handleAdd}>
            Add Dialogue
          </button>
        </div>
      </section>
    </PageShell>
  );
}
