import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageShell } from "../layout/PageShell";
import { ConditionEditor } from "../shared/ConditionEditor";
import { EventActionListEditor } from "../shared/EventActionListEditor";
import { FormattedDialogueText } from "../shared/FormattedDialogueText";
import { useDialogueStore } from "../../stores/dialogueStore";
import type { DialogueNode, DialogueOption, DialogueResponseTag, EventAction } from "../../schema/types";
import { stripDialogueMarkup } from "../../../../shared/content/dialogueText";

const DIALOGUE_RESPONSE_TAGS: DialogueResponseTag[] = ["quest", "trade", "hostile", "exit"];
const NODE_TEMPLATE_KINDS = ["line", "branch", "exit", "trade", "hostile"] as const;
const DIALOGUE_ACTION_TARGETS = [
  { value: "player" as const, label: "Player" },
  { value: "bearer" as const, label: "Current Speaker" },
];

type DialogueNodeTemplateKind = (typeof NODE_TEMPLATE_KINDS)[number];
type OptionIssueTone = "linked" | "close" | "unresolved" | "missing";
type DialogueStructureView = "cards" | "graph";
type DialogueEditorMode = "author" | "graph" | "playtest" | "diagnostics";

interface PlaytestTranscriptEntry {
  speaker: "npc" | "player" | "system";
  text: string;
}

interface DialogueGraphColumn {
  key: string;
  title: string;
  nodes: DialogueNode[];
}

interface NodeTemplateMenuProps {
  label: string;
  onSelect: (template: DialogueNodeTemplateKind) => void;
  primary?: boolean;
}

interface DialogueNodeActionsMenuProps {
  onAddContinueNode: (template: DialogueNodeTemplateKind) => void;
  onAddResponseAndNode: (template: DialogueNodeTemplateKind) => void;
  onDuplicateNode: () => void;
  onDuplicateSubtree: () => void;
  onRemoveNode: () => void;
}

function createEventAction(): EventAction {
  return {
    type: "set_storage",
  };
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

function createNode(idPrefix: string, existingNodes: DialogueNode[]): DialogueNode {
  const existingIds = new Set(existingNodes.map((node) => node.id));
  const id = makeUniqueId(`${idPrefix}_node_${existingNodes.length + 1}`, existingIds);
  return {
    id,
    text: "New NPC line.",
    options: [],
  };
}

function createNodeFromTemplate(
  idPrefix: string,
  existingNodes: DialogueNode[],
  template: DialogueNodeTemplateKind
): DialogueNode {
  const baseNode = createNode(idPrefix, existingNodes);
  switch (template) {
    case "branch":
      return {
        ...baseNode,
        text: "How do you respond?",
        options: [
          {
            ...createOption(baseNode.id, []),
            text: "Tell me more.",
          },
          {
            ...createOption(baseNode.id, [{ id: `${baseNode.id}_option_1`, text: "" }]),
            text: "Not right now.",
            closeDialogue: true,
            tags: ["exit"],
          },
        ],
      };
    case "exit":
      return {
        ...baseNode,
        text: "That's all I've got for now.",
        options: [
          {
            ...createOption(baseNode.id, []),
            text: "Goodbye.",
            closeDialogue: true,
            tags: ["exit"],
          },
        ],
      };
    case "trade":
      return {
        ...baseNode,
        text: "Take a look at what I have.",
        options: [
          {
            ...createOption(baseNode.id, []),
            text: "Show me what you're selling.",
            tags: ["trade"],
          },
          {
            ...createOption(baseNode.id, [{ id: `${baseNode.id}_option_1`, text: "" }]),
            text: "Maybe later.",
            closeDialogue: true,
            tags: ["exit"],
          },
        ],
      };
    case "hostile":
      return {
        ...baseNode,
        text: "You've got a problem?",
        options: [
          {
            ...createOption(baseNode.id, []),
            text: "[Fight]",
            tags: ["hostile"],
          },
          {
            ...createOption(baseNode.id, [{ id: `${baseNode.id}_option_1`, text: "" }]),
            text: "Back off.",
            closeDialogue: true,
            tags: ["exit"],
          },
        ],
      };
    case "line":
    default:
      return baseNode;
  }
}

function createOption(nodeId: string, existingOptions: DialogueOption[]): DialogueOption {
  const existingIds = new Set(existingOptions.map((option) => option.id));
  const id = makeUniqueId(`${nodeId}_option_${existingOptions.length + 1}`, existingIds);
  return {
    id,
    text: "New player response.",
  };
}

function previewText(text: string, max = 56): string {
  const normalized = stripDialogueMarkup(text).replace(/\s+/g, " ").trim();
  if (!normalized) return "(empty)";
  return normalized.length > max ? `${normalized.slice(0, max - 1)}...` : normalized;
}

function nodeLabel(node: DialogueNode): string {
  return `${node.id} - ${previewText(node.text, 40)}`;
}

function formatResponseTag(tag: DialogueResponseTag): string {
  switch (tag) {
    case "quest":
      return "Quest";
    case "trade":
      return "Trade";
    case "hostile":
      return "Hostile";
    case "exit":
      return "Exit";
  }
}

function formatNodeTemplateLabel(template: DialogueNodeTemplateKind): string {
  switch (template) {
    case "line":
      return "Blank Node";
    case "branch":
      return "Choice Node";
    case "exit":
      return "Exit";
    case "trade":
      return "Trade";
    case "hostile":
      return "Hostile";
  }
}

function optionOutcomeLabel(
  option: Pick<DialogueOption, "nextNodeId" | "closeDialogue">,
  nodeLookup: Map<string, DialogueNode>
): { text: string; tone: "default" | "close" | "missing" } {
  if (option.closeDialogue) {
    return { text: "Close Dialogue", tone: "close" };
  }
  if (!option.nextNodeId) {
    return { text: "Unresolved", tone: "missing" };
  }
  const node = nodeLookup.get(option.nextNodeId);
  if (!node) {
    return { text: "Missing Node", tone: "missing" };
  }
  return { text: `${node.id} - ${previewText(node.text, 28)}`, tone: "default" };
}

function collectSubtreeNodeIds(rootId: string, nodeLookup: Map<string, DialogueNode>): string[] {
  const visited = new Set<string>();
  const ordered: string[] = [];
  const queue = [rootId];
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (visited.has(nodeId)) continue;
    const node = nodeLookup.get(nodeId);
    if (!node) continue;
    visited.add(nodeId);
    ordered.push(nodeId);
    if (node.nextNodeId) {
      queue.push(node.nextNodeId);
    }
    for (const option of node.options) {
      if (option.nextNodeId) {
        queue.push(option.nextNodeId);
      }
    }
  }
  return ordered;
}

function NodeTemplateMenu({ label, onSelect, primary = false }: NodeTemplateMenuProps) {
  return (
    <details className="dialogue-action-menu">
      <summary className={`btn${primary ? " btn--primary" : ""}`}>{label}</summary>
      <div className="dialogue-action-menu-list">
        {NODE_TEMPLATE_KINDS.map((template) => (
          <button
            key={`${label}_${template}`}
            type="button"
            className="btn btn--sm"
            onClick={(event) => {
              onSelect(template);
              const menu = event.currentTarget.closest("details") as HTMLDetailsElement | null;
              if (menu) {
                menu.open = false;
              }
            }}
          >
            {formatNodeTemplateLabel(template)}
          </button>
        ))}
      </div>
    </details>
  );
}

function DialogueNodeActionsMenu({
  onAddContinueNode,
  onAddResponseAndNode,
  onDuplicateNode,
  onDuplicateSubtree,
  onRemoveNode,
}: DialogueNodeActionsMenuProps) {
  return (
    <details className="dialogue-action-menu">
      <summary className="btn btn--sm">Node Actions</summary>
      <div className="dialogue-action-menu-list dialogue-action-menu-list--wide">
        <div className="dialogue-action-menu-group">
          <div className="dialogue-action-menu-label">Continue Node</div>
          {NODE_TEMPLATE_KINDS.map((template) => (
            <button
              key={`continue_${template}`}
              type="button"
              className="btn btn--sm"
              onClick={(event) => {
                onAddContinueNode(template);
                const menu = event.currentTarget.closest("details") as HTMLDetailsElement | null;
                if (menu) {
                  menu.open = false;
                }
              }}
            >
              {formatNodeTemplateLabel(template)}
            </button>
          ))}
        </div>
        <div className="dialogue-action-menu-group">
          <div className="dialogue-action-menu-label">Response + Node</div>
          {NODE_TEMPLATE_KINDS.map((template) => (
            <button
              key={`response_${template}`}
              type="button"
              className="btn btn--sm"
              onClick={(event) => {
                onAddResponseAndNode(template);
                const menu = event.currentTarget.closest("details") as HTMLDetailsElement | null;
                if (menu) {
                  menu.open = false;
                }
              }}
            >
              {formatNodeTemplateLabel(template)}
            </button>
          ))}
        </div>
        <div className="dialogue-action-menu-group">
          <div className="dialogue-action-menu-label">Node Operations</div>
          <button
            type="button"
            className="btn btn--sm"
            onClick={(event) => {
              onDuplicateNode();
              const menu = event.currentTarget.closest("details") as HTMLDetailsElement | null;
              if (menu) {
                menu.open = false;
              }
            }}
          >
            Duplicate Node
          </button>
          <button
            type="button"
            className="btn btn--sm"
            onClick={(event) => {
              onDuplicateSubtree();
              const menu = event.currentTarget.closest("details") as HTMLDetailsElement | null;
              if (menu) {
                menu.open = false;
              }
            }}
          >
            Duplicate Subtree
          </button>
          <button
            type="button"
            className="btn btn--danger btn--sm"
            onClick={(event) => {
              onRemoveNode();
              const menu = event.currentTarget.closest("details") as HTMLDetailsElement | null;
              if (menu) {
                menu.open = false;
              }
            }}
          >
            Remove Node
          </button>
        </div>
      </div>
    </details>
  );
}

function buildGraphColumns(
  nodes: DialogueNode[],
  nodeLookup: Map<string, DialogueNode>,
  rootNodeId: string
): DialogueGraphColumn[] {
  const allowedIds = new Set(nodes.map((node) => node.id));
  const depths = new Map<string, number>();
  const queue: Array<{ id: string; depth: number }> = [{ id: rootNodeId, depth: 0 }];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (!allowedIds.has(current.id)) continue;
    const knownDepth = depths.get(current.id);
    if (knownDepth !== undefined && knownDepth <= current.depth) continue;
    depths.set(current.id, current.depth);
    const node = nodeLookup.get(current.id);
    if (!node) continue;
    if (node.nextNodeId) {
      queue.push({ id: node.nextNodeId, depth: current.depth + 1 });
    }
    for (const option of node.options) {
      if (option.nextNodeId) {
        queue.push({ id: option.nextNodeId, depth: current.depth + 1 });
      }
    }
  }

  const reachableBuckets = new Map<number, DialogueNode[]>();
  let maxDepth = 0;
  for (const node of nodes) {
    const depth = depths.get(node.id);
    if (depth === undefined) continue;
    maxDepth = Math.max(maxDepth, depth);
    if (!reachableBuckets.has(depth)) {
      reachableBuckets.set(depth, []);
    }
    reachableBuckets.get(depth)!.push(node);
  }

  const columns: DialogueGraphColumn[] = [];
  for (let depth = 0; depth <= maxDepth; depth += 1) {
    const columnNodes = reachableBuckets.get(depth);
    if (!columnNodes || columnNodes.length === 0) continue;
    columns.push({
      key: `depth_${depth}`,
      title: depth === 0 ? "Root" : `Depth ${depth}`,
      nodes: columnNodes,
    });
  }

  const orphanNodes = nodes.filter((node) => !depths.has(node.id));
  if (orphanNodes.length > 0) {
    columns.push({
      key: "orphans",
      title: "Unreached",
      nodes: orphanNodes,
    });
  }

  return columns;
}

export function DialogueEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { dialogues, updateDialogue } = useDialogueStore();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [playtestNodeId, setPlaytestNodeId] = useState<string | null>(null);
  const [playtestHistory, setPlaytestHistory] = useState<PlaytestTranscriptEntry[]>([]);
  const [playtestEnded, setPlaytestEnded] = useState(false);
  const [structureView, setStructureView] = useState<DialogueStructureView>("graph");
  const [focusSelectedBranch, setFocusSelectedBranch] = useState(false);
  const [editorMode, setEditorMode] = useState<DialogueEditorMode>("author");
  const [showOnEnterActions, setShowOnEnterActions] = useState(false);
  const [expandedResponseIds, setExpandedResponseIds] = useState<Set<string>>(new Set());
  const [openConditionResponseIds, setOpenConditionResponseIds] = useState<Set<string>>(new Set());
  const [openActionResponseIds, setOpenActionResponseIds] = useState<Set<string>>(new Set());

  const dialogue = dialogues.find((entry) => entry.id === id);
  const nodes = dialogue?.nodes ?? [];

  useEffect(() => {
    if (!dialogue) {
      return;
    }
    if (!selectedNodeId || !dialogue.nodes.some((node) => node.id === selectedNodeId)) {
      setSelectedNodeId(dialogue.startNodeId || dialogue.nodes[0]?.id || null);
    }
  }, [dialogue, selectedNodeId]);

  const nodeOptions = useMemo(
    () => nodes.map((node) => ({ id: node.id, label: nodeLabel(node) })),
    [nodes]
  );
  const nodeLookup = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const focusedBranchNodeIds = useMemo(
    () => (focusSelectedBranch && selectedNodeId ? collectSubtreeNodeIds(selectedNodeId, nodeLookup) : []),
    [focusSelectedBranch, selectedNodeId, nodeLookup]
  );
  const structureNodes = useMemo(() => {
    if (!focusSelectedBranch || !selectedNodeId) {
      return dialogue?.nodes ?? [];
    }
    const allowed = new Set(focusedBranchNodeIds);
    return (dialogue?.nodes ?? []).filter((node) => allowed.has(node.id));
  }, [dialogue?.nodes, focusSelectedBranch, focusedBranchNodeIds, selectedNodeId]);

  const flowMeta = useMemo(() => {
    const reachable = new Set<string>();
    const issues: string[] = [];
    const queue: string[] = dialogue?.startNodeId ? [dialogue.startNodeId] : [];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (reachable.has(currentId)) continue;
      reachable.add(currentId);
      const node = nodeLookup.get(currentId);
      if (!node) continue;
      if (node.nextNodeId && nodeLookup.has(node.nextNodeId)) {
        queue.push(node.nextNodeId);
      }
      for (const option of node.options) {
        if (option.nextNodeId && nodeLookup.has(option.nextNodeId)) {
          queue.push(option.nextNodeId);
        }
      }
    }

    const deadEnds = new Set<string>();
    const nodeIssueMap = new Map<
      string,
      {
        isUnreachable: boolean;
        isDeadEnd: boolean;
        hasMissingContinueTarget: boolean;
        optionIssues: Map<string, OptionIssueTone>;
      }
    >();
    for (const node of nodes) {
      const hasContinue = Boolean(node.nextNodeId);
      const hasMeaningfulOptions = node.options.some((option) => option.nextNodeId || option.closeDialogue);
      if (!hasContinue && !hasMeaningfulOptions) {
        deadEnds.add(node.id);
      }
      const optionIssues = new Map<string, OptionIssueTone>();
      for (const option of node.options) {
        if (option.closeDialogue) {
          optionIssues.set(option.id, "close");
        } else if (!option.nextNodeId) {
          optionIssues.set(option.id, "unresolved");
          issues.push(`Option "${previewText(option.text, 28)}" on ${node.id} has no next node and does not close dialogue.`);
        } else if (!nodeLookup.has(option.nextNodeId)) {
          optionIssues.set(option.id, "missing");
          issues.push(`Option "${previewText(option.text, 28)}" on ${node.id} points to missing node "${option.nextNodeId}".`);
        } else {
          optionIssues.set(option.id, "linked");
        }
      }

      const hasMissingContinueTarget = Boolean(node.nextNodeId && !nodeLookup.has(node.nextNodeId));
      if (hasMissingContinueTarget) {
        issues.push(`Continue link on ${node.id} points to missing node "${node.nextNodeId}".`);
      }

      const isUnreachable = !reachable.has(node.id);
      if (isUnreachable) {
        issues.push(`Node ${node.id} is unreachable from the start node.`);
      }

      nodeIssueMap.set(node.id, {
        isUnreachable,
        isDeadEnd: deadEnds.has(node.id),
        hasMissingContinueTarget,
        optionIssues,
      });
    }

    return {
      reachable,
      deadEnds,
      issues,
      nodeIssueMap,
    };
  }, [dialogue?.startNodeId, nodeLookup, nodes]);

  useEffect(() => {
    if (!dialogue?.startNodeId) {
      setPlaytestNodeId(null);
      setPlaytestHistory([]);
      setPlaytestEnded(false);
      return;
    }
    const startNode = nodeLookup.get(dialogue.startNodeId);
    setPlaytestNodeId(dialogue.startNodeId);
    setPlaytestHistory(startNode ? [{ speaker: "npc", text: startNode.text }] : []);
    setPlaytestEnded(false);
  }, [dialogue?.id, dialogue?.startNodeId, nodeLookup]);

  useEffect(() => {
    setExpandedResponseIds(new Set());
    setShowOnEnterActions(false);
    setOpenConditionResponseIds(new Set());
    setOpenActionResponseIds(new Set());
  }, [selectedNodeId]);

  if (!dialogue) {
    return (
      <PageShell title="Dialogue Not Found">
        <p>No dialogue with id "{id}".</p>
        <button className="btn" onClick={() => navigate("/dialogues")}>
          Back to Dialogues
        </button>
      </PageShell>
    );
  }

  const selectedNode = dialogue.nodes.find((node) => node.id === selectedNodeId) ?? dialogue.nodes[0] ?? null;
  const selectedNodeMeta = selectedNode ? flowMeta.nodeIssueMap.get(selectedNode.id) : null;
  const playtestNode = playtestNodeId ? nodeLookup.get(playtestNodeId) ?? null : null;
  const graphRootNodeId =
    focusSelectedBranch && selectedNode ? selectedNode.id : dialogue.startNodeId || dialogue.nodes[0]?.id || "";
  const graphColumns = useMemo(
    () => (graphRootNodeId ? buildGraphColumns(structureNodes, nodeLookup, graphRootNodeId) : []),
    [graphRootNodeId, nodeLookup, structureNodes]
  );
  const diagnosticsSummary = useMemo(() => {
    const missingContinueTargets = nodes.filter((node) => flowMeta.nodeIssueMap.get(node.id)?.hasMissingContinueTarget).length;
    const unresolvedResponses = nodes.reduce(
      (count, node) =>
        count +
        node.options.filter((option) => flowMeta.nodeIssueMap.get(node.id)?.optionIssues.get(option.id) === "unresolved").length,
      0
    );
    const missingTargets = nodes.reduce(
      (count, node) =>
        count +
        node.options.filter((option) => flowMeta.nodeIssueMap.get(node.id)?.optionIssues.get(option.id) === "missing").length,
      0,
    );
    return {
      nodes: nodes.length,
      reachable: flowMeta.reachable.size,
      unreachable: nodes.filter((node) => flowMeta.nodeIssueMap.get(node.id)?.isUnreachable).length,
      deadEnds: nodes.filter((node) => flowMeta.nodeIssueMap.get(node.id)?.isDeadEnd).length,
      missingContinueTargets,
      unresolvedResponses,
      missingTargets,
      totalIssues: flowMeta.issues.length,
    };
  }, [flowMeta, nodes]);

  const update = (patch: Partial<typeof dialogue>) => updateDialogue(dialogue.id, patch);

  const updateNode = (nodeId: string, patch: Partial<DialogueNode>) => {
    update({
      nodes: dialogue.nodes.map((node) => (node.id === nodeId ? { ...node, ...patch } : node)),
    });
  };

  const updateOption = (nodeId: string, optionId: string, patch: Partial<DialogueOption>) => {
    updateNode(nodeId, {
      options: (dialogue.nodes.find((node) => node.id === nodeId)?.options ?? []).map((option) =>
        option.id === optionId ? { ...option, ...patch } : option
      ),
    });
  };

  const handleAddNode = (template: DialogueNodeTemplateKind = "line") => {
    const nextNode = createNodeFromTemplate(dialogue.id, dialogue.nodes, template);
    update({ nodes: [...dialogue.nodes, nextNode] });
    setSelectedNodeId(nextNode.id);
  };

  const handleRemoveNode = (nodeId: string) => {
    const remainingNodes = dialogue.nodes.filter((node) => node.id !== nodeId);
    update({
      startNodeId: dialogue.startNodeId === nodeId ? remainingNodes[0]?.id ?? "" : dialogue.startNodeId,
      nodes: remainingNodes.map((node) => ({
        ...node,
        nextNodeId: node.nextNodeId === nodeId ? undefined : node.nextNodeId,
        options: node.options.map((option) => ({
          ...option,
          nextNodeId: option.nextNodeId === nodeId ? undefined : option.nextNodeId,
        })),
      })),
    });
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(remainingNodes[0]?.id ?? null);
    }
  };

  const handleAddContinueNode = (template: DialogueNodeTemplateKind = "line") => {
    if (!selectedNode) return;
    const nextNode = createNodeFromTemplate(dialogue.id, dialogue.nodes, template);
    update({
      nodes: [
        ...dialogue.nodes.map((node) =>
          node.id === selectedNode.id ? { ...node, nextNodeId: nextNode.id } : node
        ),
        nextNode,
      ],
    });
    setSelectedNodeId(nextNode.id);
  };

  const handleAddResponseAndNode = (template: DialogueNodeTemplateKind = "line") => {
    if (!selectedNode) return;
    const nextNode = createNodeFromTemplate(dialogue.id, dialogue.nodes, template);
    const nextOption = {
      ...createOption(selectedNode.id, selectedNode.options),
      nextNodeId: nextNode.id,
    };
    update({
      nodes: [
        ...dialogue.nodes.map((node) =>
          node.id === selectedNode.id
            ? { ...node, options: [...node.options, nextOption] }
            : node
        ),
        nextNode,
      ],
    });
  };

  const handleDuplicateNode = () => {
    if (!selectedNode) return;
    const duplicateNodeId = makeUniqueId(
      `${selectedNode.id}_copy`,
      new Set(dialogue.nodes.map((node) => node.id))
    );
    const optionIds = new Set<string>();
    const duplicate = {
      ...selectedNode,
      id: duplicateNodeId,
      options: selectedNode.options.map((option, index) => {
        const nextId = makeUniqueId(`${duplicateNodeId}_option_${index + 1}`, optionIds);
        optionIds.add(nextId);
        return {
          ...option,
          id: nextId,
        };
      }),
    };
    update({ nodes: [...dialogue.nodes, duplicate] });
    setSelectedNodeId(duplicate.id);
  };

  const handleDuplicateSubtree = () => {
    if (!selectedNode) return;
    const subtreeIds = collectSubtreeNodeIds(selectedNode.id, nodeLookup);
    const subtreeNodes = subtreeIds
      .map((nodeId) => nodeLookup.get(nodeId))
      .filter((node): node is DialogueNode => Boolean(node));
    if (subtreeNodes.length === 0) return;

    const existingNodeIds = new Set(dialogue.nodes.map((node) => node.id));
    const nodeIdMap = new Map<string, string>();
    for (const node of subtreeNodes) {
      const duplicateNodeId = makeUniqueId(`${node.id}_copy`, existingNodeIds);
      existingNodeIds.add(duplicateNodeId);
      nodeIdMap.set(node.id, duplicateNodeId);
    }

    const duplicatedNodes = subtreeNodes.map((node) => {
      const duplicateNodeId = nodeIdMap.get(node.id)!;
      const optionIds = new Set<string>();
      return {
        ...node,
        id: duplicateNodeId,
        nextNodeId:
          node.nextNodeId && nodeIdMap.has(node.nextNodeId)
            ? nodeIdMap.get(node.nextNodeId)
            : node.nextNodeId,
        options: node.options.map((option, index) => {
          const duplicateOptionId = makeUniqueId(`${duplicateNodeId}_option_${index + 1}`, optionIds);
          optionIds.add(duplicateOptionId);
          return {
            ...option,
            id: duplicateOptionId,
            nextNodeId:
              option.nextNodeId && nodeIdMap.has(option.nextNodeId)
                ? nodeIdMap.get(option.nextNodeId)
                : option.nextNodeId,
          };
        }),
      };
    });

    update({ nodes: [...dialogue.nodes, ...duplicatedNodes] });
    setSelectedNodeId(nodeIdMap.get(selectedNode.id) ?? null);
  };

  const handleJumpToNode = (nodeId?: string) => {
    if (!nodeId || !nodeLookup.has(nodeId)) return;
    setSelectedNodeId(nodeId);
  };

  const handleCreateLinkedOptionNode = (
    optionId: string,
    template: DialogueNodeTemplateKind = "line"
  ) => {
    if (!selectedNode) return;
    const nextNode = createNodeFromTemplate(dialogue.id, dialogue.nodes, template);
    update({
      nodes: [
        ...dialogue.nodes.map((node) =>
          node.id === selectedNode.id
            ? {
                ...node,
                options: node.options.map((option) =>
                  option.id === optionId ? { ...option, nextNodeId: nextNode.id, closeDialogue: undefined } : option
                ),
              }
            : node
        ),
        nextNode,
      ],
    });
    setSelectedNodeId(nextNode.id);
  };

  const restartPlaytest = () => {
    const startNode = nodeLookup.get(dialogue.startNodeId);
    setPlaytestNodeId(dialogue.startNodeId);
    setPlaytestHistory(startNode ? [{ speaker: "npc", text: startNode.text }] : []);
    setPlaytestEnded(false);
  };

  const handlePlaytestContinue = () => {
    if (!playtestNode) return;
    if (!playtestNode.nextNodeId) {
      setPlaytestNodeId(null);
      setPlaytestEnded(true);
      setPlaytestHistory([...playtestHistory, { speaker: "system", text: "This branch stops here." }]);
      return;
    }
    const nextNode = nodeLookup.get(playtestNode.nextNodeId);
    if (!nextNode) {
      setPlaytestNodeId(null);
      setPlaytestEnded(true);
      setPlaytestHistory([
        ...playtestHistory,
        { speaker: "system", text: `Missing node: ${playtestNode.nextNodeId}` },
      ]);
      return;
    }
    setPlaytestNodeId(nextNode.id);
    setPlaytestEnded(false);
    setPlaytestHistory([...playtestHistory, { speaker: "npc", text: nextNode.text }]);
  };

  const handlePlaytestOption = (option: DialogueOption) => {
    const nextHistory = [...playtestHistory, { speaker: "player" as const, text: option.text }];
    if (option.closeDialogue) {
      setPlaytestNodeId(null);
      setPlaytestEnded(true);
      setPlaytestHistory([...nextHistory, { speaker: "system", text: "Dialogue closed." }]);
      return;
    }
    if (!option.nextNodeId) {
      setPlaytestNodeId(null);
      setPlaytestEnded(true);
      setPlaytestHistory([...nextHistory, { speaker: "system", text: "This response is unresolved." }]);
      return;
    }
    const nextNode = nodeLookup.get(option.nextNodeId);
    if (!nextNode) {
      setPlaytestNodeId(null);
      setPlaytestEnded(true);
      setPlaytestHistory([...nextHistory, { speaker: "system", text: `Missing node: ${option.nextNodeId}` }]);
      return;
    }
    setPlaytestNodeId(nextNode.id);
    setPlaytestEnded(false);
    setPlaytestHistory([...nextHistory, { speaker: "npc", text: nextNode.text }]);
  };

  const toggleResponseExpanded = (optionId: string) => {
    setExpandedResponseIds((prev) => {
      const next = new Set(prev);
      if (next.has(optionId)) {
        next.delete(optionId);
      } else {
        next.add(optionId);
      }
      return next;
    });
  };

  const toggleResponseConditionDrawer = (optionId: string) => {
    setOpenConditionResponseIds((prev) => {
      const next = new Set(prev);
      if (next.has(optionId)) {
        next.delete(optionId);
      } else {
        next.add(optionId);
      }
      return next;
    });
  };

  const toggleResponseActionDrawer = (optionId: string) => {
    setOpenActionResponseIds((prev) => {
      const next = new Set(prev);
      if (next.has(optionId)) {
        next.delete(optionId);
      } else {
        next.add(optionId);
      }
      return next;
    });
  };

  return (
    <PageShell
      title={dialogue.name || dialogue.id}
      actions={
        <button className="btn" onClick={() => navigate("/dialogues")}>
          Back to Dialogues
        </button>
      }
    >
      <section className="editor-section">
        <h3 className="section-title">Basic Properties</h3>
        <div className="form-grid">
          <div className="form-field">
            <label className="field-label">ID</label>
            <input className="input" value={dialogue.id} disabled />
          </div>
          <div className="form-field">
            <label className="field-label">Name</label>
            <input className="input" value={dialogue.name} onChange={(e) => update({ name: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="field-label">Folder</label>
            <input
              className="input"
              value={dialogue.folder || ""}
              onChange={(e) => update({ folder: e.target.value || undefined })}
              placeholder="e.g. npcs"
            />
          </div>
          <div className="form-field">
            <label className="field-label">Start Node ID</label>
            <select
              className="input"
              value={dialogue.startNodeId}
              onChange={(e) => {
                update({ startNodeId: e.target.value });
                setSelectedNodeId(e.target.value);
              }}
            >
              {nodeOptions.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-field" style={{ marginTop: 16 }}>
          <label className="field-label">Description</label>
          <textarea
            className="input"
            rows={3}
            value={dialogue.description || ""}
            onChange={(e) => update({ description: e.target.value || undefined })}
          />
        </div>
      </section>

      <section className="editor-section">
        <div className="section-header-row">
          <div>
            <h3 className="section-title">Dialogue Workbench</h3>
            <p className="section-desc" style={{ marginBottom: 0 }}>
              Select one node at a time, wire branches quickly, and keep the overall flow visible in the outline.
            </p>
          </div>
          <NodeTemplateMenu label="Add Node" onSelect={handleAddNode} primary />
        </div>

        <div className="dialogue-mode-tabs">
          {(["author", "graph", "playtest", "diagnostics"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`btn btn--sm${editorMode === mode ? " btn--primary" : ""}`}
              onClick={() => setEditorMode(mode)}
            >
              {mode === "author"
                ? "Author"
                : mode === "graph"
                  ? "Graph"
                  : mode === "playtest"
                    ? "Playtest"
                    : "Diagnostics"}
            </button>
          ))}
        </div>

        {editorMode === "author" ? (
        <>
        <div className="dialogue-mode-toolbar">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={focusSelectedBranch}
              onChange={(e) => setFocusSelectedBranch(e.target.checked)}
            />
            Focus Selected Branch
          </label>
        </div>

        <div className="dialogue-editor-layout">
          <aside className="dialogue-node-outline">
            <div className="dialogue-outline-header">Nodes</div>
            <div className="dialogue-node-list">
              {structureNodes.map((node) => {
                const isSelected = node.id === selectedNode?.id;
                const isStart = node.id === dialogue.startNodeId;
                const issueMeta = flowMeta.nodeIssueMap.get(node.id);
                const isUnreachable = issueMeta?.isUnreachable ?? false;
                const isDeadEnd = issueMeta?.isDeadEnd ?? false;
                const responseCount = node.options.length;
                const branchCount = (node.nextNodeId ? 1 : 0) + node.options.filter((option) => option.nextNodeId).length;

                return (
                  <button
                    key={node.id}
                    type="button"
                    className={`dialogue-node-list-item${isSelected ? " is-selected" : ""}`}
                    onClick={() => setSelectedNodeId(node.id)}
                  >
                    <div className="dialogue-node-list-top">
                      <span className="dialogue-node-list-id">{node.id}</span>
                      <span className="dialogue-node-list-count">{responseCount} resp</span>
                    </div>
                    <div className="dialogue-node-list-preview">{previewText(node.text)}</div>
                    <div className="dialogue-node-list-badges">
                      {isStart ? <span className="dialogue-badge is-start">Start</span> : null}
                      {branchCount > 0 ? <span className="dialogue-badge">{branchCount} link</span> : null}
                      {(node.onEnterEffects?.length ?? 0) > 0 ? <span className="dialogue-badge">Actions</span> : null}
                      {issueMeta?.hasMissingContinueTarget ? <span className="dialogue-badge is-error">Missing Continue</span> : null}
                      {node.options.some((option) => issueMeta?.optionIssues.get(option.id) === "unresolved") ? (
                        <span className="dialogue-badge is-warn">Unresolved Response</span>
                      ) : null}
                      {node.options.some((option) => issueMeta?.optionIssues.get(option.id) === "missing") ? (
                        <span className="dialogue-badge is-error">Missing Target</span>
                      ) : null}
                      {isDeadEnd ? <span className="dialogue-badge is-warn">Dead End</span> : null}
                      {isUnreachable ? <span className="dialogue-badge is-error">Unreachable</span> : null}
                    </div>
                  </button>
                );
              })}
            </div>

            {flowMeta.issues.length > 0 ? (
              <div className="dialogue-outline-issues">
                <div className="dialogue-outline-header">Flow Warnings</div>
                <ul className="dialogue-issue-list">
                  {flowMeta.issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </aside>

          <div className="dialogue-node-editor">
            {selectedNode ? (
              <>
                <div className="editor-subsection">
                  <div className="section-header-row">
                    <div>
                      <h4 className="section-title" style={{ marginBottom: 0 }}>
                        {selectedNode.id}
                      </h4>
                      <p className="section-desc" style={{ marginBottom: 0 }}>
                        {previewText(selectedNode.text, 100)}
                      </p>
                    </div>
                    <DialogueNodeActionsMenu
                      onAddContinueNode={handleAddContinueNode}
                      onAddResponseAndNode={handleAddResponseAndNode}
                      onDuplicateNode={handleDuplicateNode}
                      onDuplicateSubtree={handleDuplicateSubtree}
                      onRemoveNode={() => handleRemoveNode(selectedNode.id)}
                    />
                  </div>

                  {selectedNodeMeta ? (
                    <div className="dialogue-template-row" style={{ marginBottom: 16 }}>
                      <span className="dialogue-badge">Selected Node</span>
                      {selectedNode.id === dialogue.startNodeId ? <span className="dialogue-badge is-start">Start</span> : null}
                      {selectedNodeMeta.hasMissingContinueTarget ? (
                        <span className="dialogue-badge is-error">Missing Continue Target</span>
                      ) : null}
                      {selectedNodeMeta.isDeadEnd ? <span className="dialogue-badge is-warn">Dead End</span> : null}
                      {selectedNodeMeta.isUnreachable ? <span className="dialogue-badge is-error">Unreachable</span> : null}
                    </div>
                  ) : null}

                  <div className="form-grid">
                    <div className="form-field">
                      <label className="field-label">Node ID</label>
                      <input
                        className="input"
                        value={selectedNode.id}
                        onChange={(e) => {
                          updateNode(selectedNode.id, { id: e.target.value });
                          setSelectedNodeId(e.target.value);
                        }}
                      />
                    </div>
                    <div className="form-field">
                      <label className="field-label">Continue Label</label>
                      <input
                        className="input"
                        value={selectedNode.continueLabel || ""}
                        onChange={(e) => updateNode(selectedNode.id, { continueLabel: e.target.value || undefined })}
                        placeholder="Optional label for next button"
                      />
                    </div>
                    <div className="form-field form-field--wide">
                      <label className="field-label">Next Node</label>
                      <div className="dialogue-link-row">
                        <select
                          className="input"
                          value={selectedNode.nextNodeId || ""}
                          onChange={(e) => updateNode(selectedNode.id, { nextNodeId: e.target.value || undefined })}
                        >
                          <option value="">(none)</option>
                          {nodeOptions
                            .filter((node) => node.id !== selectedNode.id)
                            .map((node) => (
                              <option key={node.id} value={node.id}>
                                {node.label}
                              </option>
                            ))}
                        </select>
                        <button
                          type="button"
                          className="btn btn--sm"
                          disabled={!selectedNode.nextNodeId || !nodeLookup.has(selectedNode.nextNodeId)}
                          onClick={() => handleJumpToNode(selectedNode.nextNodeId)}
                        >
                          Jump
                        </button>
                        <NodeTemplateMenu label="Create + Link" onSelect={handleAddContinueNode} />
                      </div>
                    </div>
                  </div>

                    <div className="form-field" style={{ marginTop: 16 }}>
                      <label className="field-label">NPC Text</label>
                      <textarea
                        className="input"
                        rows={5}
                        value={selectedNode.text}
                        onChange={(e) => updateNode(selectedNode.id, { text: e.target.value })}
                      />
                      <p className="section-desc" style={{ marginTop: 8, marginBottom: 0 }}>
                        Supports <code>[narration]...[/narration]</code> and <code>[color=#8FA8FF]...[/color]</code>.
                      </p>
                    </div>
                </div>

                <div className="editor-subsection" style={{ marginTop: 16 }}>
                  <div className="section-header-row">
                    <div>
                      <h4 className="section-title" style={{ marginBottom: 0 }}>On Enter Actions</h4>
                      <p className="section-desc" style={{ marginBottom: 0 }}>
                        {showOnEnterActions
                          ? "State changes that fire when this node becomes active."
                          : `${selectedNode.onEnterEffects?.length ?? 0} action(s) hidden.`}
                      </p>
                    </div>
                    <div className="button-row" style={{ marginBottom: 0 }}>
                      <button
                        className="btn btn--sm"
                        onClick={() => setShowOnEnterActions((value) => !value)}
                      >
                        {showOnEnterActions ? "Hide" : "Show"}
                      </button>
                      <button
                        className="btn btn--sm"
                        onClick={() => {
                          setShowOnEnterActions(true);
                          updateNode(selectedNode.id, { onEnterEffects: [...(selectedNode.onEnterEffects ?? []), createEventAction()] });
                        }}
                      >
                        Add Action
                      </button>
                    </div>
                  </div>
                  {showOnEnterActions ? (
                    <EventActionListEditor
                      actions={selectedNode.onEnterEffects ?? []}
                      onChange={(onEnterEffects) => updateNode(selectedNode.id, { onEnterEffects })}
                      emptyText="No on-enter actions."
                      actionTargetOptions={DIALOGUE_ACTION_TARGETS}
                    />
                  ) : null}
                </div>

                <div className="editor-subsection" style={{ marginTop: 16 }}>
                  <div className="section-header-row">
                    <div>
                      <h4 className="section-title" style={{ marginBottom: 0 }}>Player Responses</h4>
                      <p className="section-desc" style={{ marginBottom: 0 }}>Only this node's responses are expanded, so branching stays manageable.</p>
                    </div>
                    <button
                      className="btn btn--sm"
                      onClick={() => {
                        const nextOption = createOption(selectedNode.id, selectedNode.options);
                        updateNode(selectedNode.id, {
                          options: [...selectedNode.options, nextOption],
                        });
                        setExpandedResponseIds((prev) => new Set(prev).add(nextOption.id));
                      }}
                    >
                      Add Response
                    </button>
                  </div>

                  {selectedNode.options.length === 0 ? (
                    <p className="section-desc">No player responses on this node.</p>
                  ) : (
                    selectedNode.options.map((option, optionIndex) => {
                      const isExpanded = expandedResponseIds.has(option.id);
                      const isConditionDrawerOpen = openConditionResponseIds.has(option.id);
                      const isActionDrawerOpen = openActionResponseIds.has(option.id);
                      return (
                      <div key={option.id} className="dialogue-option-card">
                      <div className="editor-subsection-header">
                        <div>
                          <h5 className="section-title" style={{ marginBottom: 0 }}>Option {optionIndex + 1}</h5>
                          <p className="section-desc" style={{ marginBottom: 0 }}>{previewText(option.text, 72)}</p>
                          {(option.tags?.length ?? 0) > 0 ? (
                            <div className="dialogue-option-tags">
                              {option.tags!.map((tag) => (
                                <span key={`${option.id}_${tag}`} className={`dialogue-badge dialogue-badge--tag is-${tag}`}>
                                  {formatResponseTag(tag)}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <div className="button-row" style={{ marginBottom: 0 }}>
                        <button
                          className="btn btn--sm"
                          onClick={() => toggleResponseExpanded(option.id)}
                        >
                          {isExpanded ? "Collapse" : "Expand"}
                        </button>
                        <button
                          className="btn btn--danger btn--sm"
                            onClick={() =>
                              updateNode(selectedNode.id, {
                                options: selectedNode.options.filter((entry) => entry.id !== option.id),
                              })
                            }
                          >
                            Remove
                          </button>
                        </div>
                        </div>

                        {isExpanded ? (
                        <>
                        <div className="form-grid">
                          <div className="form-field">
                            <label className="field-label">Option ID</label>
                            <input
                              className="input"
                              value={option.id}
                              onChange={(e) => updateOption(selectedNode.id, option.id, { id: e.target.value })}
                            />
                          </div>
                          <div className="form-field">
                            <label className="field-label">Next Node</label>
                            <div className="dialogue-link-row">
                              <select
                                className="input"
                                value={option.nextNodeId || ""}
                                onChange={(e) => updateOption(selectedNode.id, option.id, { nextNodeId: e.target.value || undefined })}
                              >
                                <option value="">(none)</option>
                                {nodeOptions
                                  .filter((node) => node.id !== selectedNode.id)
                                  .map((node) => (
                                    <option key={node.id} value={node.id}>
                                      {node.label}
                                    </option>
                                  ))}
                              </select>
                              <button
                                type="button"
                                className="btn btn--sm"
                                disabled={!option.nextNodeId || !nodeLookup.has(option.nextNodeId)}
                                onClick={() => handleJumpToNode(option.nextNodeId)}
                              >
                                Jump
                              </button>
                              <NodeTemplateMenu
                                label="Create + Link"
                                onSelect={(template) => handleCreateLinkedOptionNode(option.id, template)}
                              />
                            </div>
                          </div>
                          <div className="form-field form-field--wide">
                            <label className="field-label">Player Text</label>
                            <input
                              className="input"
                              value={option.text}
                              onChange={(e) => updateOption(selectedNode.id, option.id, { text: e.target.value })}
                            />
                          </div>
                        <div className="form-field">
                          <label className="checkbox-label">
                            <input
                              type="checkbox"
                              checked={Boolean(option.closeDialogue)}
                              onChange={(e) => updateOption(selectedNode.id, option.id, { closeDialogue: e.target.checked || undefined })}
                            />
                              Close Dialogue
                          </label>
                        </div>
                        <div className="form-field form-field--wide">
                          <label className="field-label">Response Tags</label>
                          <div className="tag-chips">
                            {DIALOGUE_RESPONSE_TAGS.map((tag) => {
                              const isActive = option.tags?.includes(tag) ?? false;
                              const nextTags = isActive
                                ? (option.tags ?? []).filter((entry) => entry !== tag)
                                : [...(option.tags ?? []), tag];
                              return (
                                <button
                                  key={`${option.id}_${tag}_toggle`}
                                  type="button"
                                  className={`tag-chip${isActive ? " tag-chip--active" : ""}`}
                                  onClick={() =>
                                    updateOption(selectedNode.id, option.id, {
                                      tags: nextTags.length > 0 ? nextTags : undefined,
                                    })
                                  }
                                >
                                  {formatResponseTag(tag)}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                        <div className="dialogue-template-row" style={{ marginTop: 12 }}>
                          {(() => {
                            const tone = selectedNodeMeta?.optionIssues.get(option.id) ?? "unresolved";
                            if (tone === "close") {
                              return <span className="dialogue-badge">Closes Dialogue</span>;
                            }
                            if (tone === "missing") {
                              return <span className="dialogue-badge is-error">Missing Target</span>;
                            }
                            if (tone === "unresolved") {
                              return <span className="dialogue-badge is-warn">Unresolved Response</span>;
                            }
                            return <span className="dialogue-badge">Linked</span>;
                          })()}
                          {(option.effects?.length ?? 0) > 0 ? <span className="dialogue-badge">Actions</span> : null}
                          {option.condition ? <span className="dialogue-badge">Condition</span> : null}
                        </div>

                        <div className="dialogue-response-drawers">
                          <div className="dialogue-response-drawer">
                            <button
                              type="button"
                              className="dialogue-response-drawer-toggle"
                              onClick={() => toggleResponseConditionDrawer(option.id)}
                            >
                              <span className="field-label" style={{ marginBottom: 0 }}>Condition</span>
                              <span className="dialogue-response-drawer-meta">
                                {option.condition ? "Present" : "None"}
                              </span>
                              <span className="dialogue-response-drawer-chevron">
                                {isConditionDrawerOpen ? "−" : "+"}
                              </span>
                            </button>
                            {isConditionDrawerOpen ? (
                              <div className="dialogue-response-drawer-body">
                                <ConditionEditor
                                  value={option.condition || ""}
                                  onChange={(value) => updateOption(selectedNode.id, option.id, { condition: value || undefined })}
                                  placeholder='e.g. player.flag("dirty_frank_intro_seen")'
                                />
                                {option.condition ? (
                                  <div className="button-row" style={{ marginBottom: 0, marginTop: 10 }}>
                                    <button
                                      className="btn btn--sm"
                                      onClick={() => updateOption(selectedNode.id, option.id, { condition: undefined })}
                                    >
                                      Clear Condition
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                          </div>

                          <div className="dialogue-response-drawer">
                            <button
                              type="button"
                              className="dialogue-response-drawer-toggle"
                              onClick={() => toggleResponseActionDrawer(option.id)}
                            >
                              <span className="field-label" style={{ marginBottom: 0 }}>Response Actions</span>
                              <span className="dialogue-response-drawer-meta">
                                {(option.effects?.length ?? 0) === 0 ? "None" : `${option.effects?.length ?? 0} action(s)`}
                              </span>
                              <span className="dialogue-response-drawer-chevron">
                                {isActionDrawerOpen ? "−" : "+"}
                              </span>
                            </button>
                            {isActionDrawerOpen ? (
                              <div className="dialogue-response-drawer-body">
                                <div className="section-header-row">
                                  <label className="field-label" style={{ marginBottom: 0 }}>Response Actions</label>
                                  <button
                                    className="btn btn--sm"
                                    onClick={() =>
                                      updateOption(selectedNode.id, option.id, {
                                        effects: [...(option.effects ?? []), createEventAction()],
                                      })
                                    }
                                  >
                                    Add Action
                                  </button>
                                </div>
                                <EventActionListEditor
                                  actions={option.effects ?? []}
                                  onChange={(effects) => updateOption(selectedNode.id, option.id, { effects })}
                                  emptyText="No response actions."
                                  actionTargetOptions={DIALOGUE_ACTION_TARGETS}
                                />
                              </div>
                            ) : null}
                          </div>
                        </div>
                        </>
                        ) : null}
                      </div>
                    )})
                  )}
                </div>
              </>
            ) : (
              <p className="section-desc">Add a node to start authoring dialogue.</p>
            )}
          </div>
        </div>
        </>
        ) : null}

        {editorMode === "graph" ? (
        <div className="dialogue-flow-preview">
          <div className="section-header-row">
            <div>
              <h4 className="section-title" style={{ marginBottom: 0 }}>
                Flow Preview
              </h4>
              <p className="section-desc" style={{ marginBottom: 0 }}>
                Read-only node map for fast branch scanning. Click any card to jump to that node in the editor.
              </p>
            </div>
            <div className="dialogue-structure-controls">
              <div className="dialogue-view-toggle">
                <button
                  type="button"
                  className={`btn btn--sm${structureView === "graph" ? " btn--primary" : ""}`}
                  onClick={() => setStructureView("graph")}
                >
                  Graph
                </button>
                <button
                  type="button"
                  className={`btn btn--sm${structureView === "cards" ? " btn--primary" : ""}`}
                  onClick={() => setStructureView("cards")}
                >
                  Cards
                </button>
              </div>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={focusSelectedBranch}
                  onChange={(e) => setFocusSelectedBranch(e.target.checked)}
                />
                Focus Selected Branch
              </label>
            </div>
          </div>

          {structureView === "graph" ? (
            <div className="dialogue-graph-board">
              {graphColumns.map((column) => (
                <div key={column.key} className="dialogue-graph-column">
                  <div className="dialogue-graph-column-header">
                    <span>{column.title}</span>
                    <span className="dialogue-graph-column-count">{column.nodes.length}</span>
                  </div>
                  <div className="dialogue-graph-column-body">
                    {column.nodes.map((node) => {
                      const isSelected = node.id === selectedNode?.id;
                      const isStart = node.id === dialogue.startNodeId;
                      const issueMeta = flowMeta.nodeIssueMap.get(node.id);
                      const isUnreachable = issueMeta?.isUnreachable ?? false;
                      const isDeadEnd = issueMeta?.isDeadEnd ?? false;
                      return (
                        <button
                          key={`${node.id}_graph`}
                          type="button"
                          className={[
                            "dialogue-graph-node",
                            isSelected ? "is-selected" : "",
                            isStart ? "is-start" : "",
                            isUnreachable ? "is-error" : "",
                            isDeadEnd ? "is-warn" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          onClick={() => setSelectedNodeId(node.id)}
                        >
                          <div className="dialogue-flow-id">{node.id}</div>
                          <div className="dialogue-flow-preview-text">{previewText(node.text, 80)}</div>
                          <div className="dialogue-node-list-badges">
                            {isStart ? <span className="dialogue-badge is-start">Start</span> : null}
                            {issueMeta?.hasMissingContinueTarget ? <span className="dialogue-badge is-error">Missing Continue</span> : null}
                            {isDeadEnd ? <span className="dialogue-badge is-warn">Dead End</span> : null}
                            {isUnreachable ? <span className="dialogue-badge is-error">Unreachable</span> : null}
                          </div>
                          <div className="dialogue-graph-links">
                            {node.nextNodeId ? (
                              <button
                                type="button"
                                className="dialogue-graph-link-chip"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleJumpToNode(node.nextNodeId);
                                }}
                              >
                                Continue {"->"} {node.nextNodeId}
                              </button>
                            ) : null}
                            {node.options.map((option, optionIndex) => (
                              <button
                                key={`${node.id}_graph_link_${option.id}`}
                                type="button"
                                className={`dialogue-graph-link-chip${
                                  option.closeDialogue
                                    ? " is-close"
                                    : !option.nextNodeId || !nodeLookup.has(option.nextNodeId)
                                      ? " is-missing"
                                      : ""
                                }`}
                                disabled={!option.nextNodeId || !nodeLookup.has(option.nextNodeId)}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleJumpToNode(option.nextNodeId);
                                }}
                              >
                                Opt {optionIndex + 1}: {option.closeDialogue ? "Close" : option.nextNodeId || "Unresolved"}
                              </button>
                            ))}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="dialogue-flow-grid">
              {structureNodes.map((node) => {
                const isSelected = node.id === selectedNode?.id;
                const isStart = node.id === dialogue.startNodeId;
                const issueMeta = flowMeta.nodeIssueMap.get(node.id);
                const isUnreachable = issueMeta?.isUnreachable ?? false;
                const isDeadEnd = issueMeta?.isDeadEnd ?? false;
                const continueTarget = node.nextNodeId
                  ? {
                      text: `${node.nextNodeId} - ${previewText(nodeLookup.get(node.nextNodeId)?.text ?? node.nextNodeId, 28)}`,
                      tone: "default" as const,
                    }
                  : node.continueLabel
                    ? { text: "Unresolved", tone: "missing" as const }
                    : null;

                return (
                  <button
                    key={`${node.id}_flow`}
                    type="button"
                    className={[
                      "dialogue-flow-card",
                      isSelected ? "is-selected" : "",
                      isStart ? "is-start" : "",
                      isUnreachable ? "is-error" : "",
                      isDeadEnd ? "is-warn" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => setSelectedNodeId(node.id)}
                  >
                    <div className="dialogue-flow-header">
                      <div>
                        <div className="dialogue-flow-id">{node.id}</div>
                        <div className="dialogue-flow-preview-text">{previewText(node.text, 80)}</div>
                      </div>
                      <div className="dialogue-node-list-badges">
                        {isStart ? <span className="dialogue-badge is-start">Start</span> : null}
                        {issueMeta?.hasMissingContinueTarget ? <span className="dialogue-badge is-error">Missing Continue</span> : null}
                        {isDeadEnd ? <span className="dialogue-badge is-warn">Dead End</span> : null}
                        {isUnreachable ? <span className="dialogue-badge is-error">Unreachable</span> : null}
                      </div>
                    </div>

                    <div className="dialogue-flow-links">
                      {continueTarget ? (
                        <div className="dialogue-flow-link">
                          <span className="dialogue-flow-link-kind">Continue</span>
                          <span className="dialogue-flow-link-label">{node.continueLabel || "Continue"}</span>
                          <span className={`dialogue-flow-link-target is-${continueTarget.tone}`}>
                            {continueTarget.text}
                          </span>
                        </div>
                      ) : null}

                      {node.options.length > 0 ? (
                        node.options.map((option, optionIndex) => {
                          const outcome = optionOutcomeLabel(option, nodeLookup);
                          return (
                            <div key={option.id} className="dialogue-flow-link">
                              <span className="dialogue-flow-link-kind">Opt {optionIndex + 1}</span>
                              <span className="dialogue-flow-link-main">
                                <span className="dialogue-flow-link-label">{previewText(option.text, 42)}</span>
                                {(option.tags?.length ?? 0) > 0 ? (
                                  <span className="dialogue-flow-link-tags">
                                    {option.tags!.map((tag) => (
                                      <span key={`${option.id}_${tag}_flow`} className={`dialogue-badge dialogue-badge--tag is-${tag}`}>
                                        {formatResponseTag(tag)}
                                      </span>
                                    ))}
                                  </span>
                                ) : null}
                              </span>
                              <span className={`dialogue-flow-link-target is-${outcome.tone}`}>
                                {outcome.text}
                              </span>
                            </div>
                          );
                        })
                      ) : !continueTarget ? (
                        <div className="dialogue-flow-link">
                          <span className="dialogue-flow-link-kind">State</span>
                          <span className="dialogue-flow-link-label">No outgoing links</span>
                          <span className="dialogue-flow-link-target is-missing">Stops Here</span>
                        </div>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        ) : null}

        {editorMode === "playtest" ? (
        <div className="dialogue-flow-preview">
          <div className="section-header-row">
            <div>
              <h4 className="section-title" style={{ marginBottom: 0 }}>
                Playtest
              </h4>
              <p className="section-desc" style={{ marginBottom: 0 }}>
                Click through the current dialogue locally without leaving the editor. This previews branch flow only; it does not execute gameplay effects.
              </p>
            </div>
            <div className="button-row" style={{ marginBottom: 0 }}>
              <button className="btn btn--sm" onClick={restartPlaytest}>
                Restart
              </button>
              <button
                className="btn btn--sm"
                disabled={!playtestNode}
                onClick={() => handleJumpToNode(playtestNode?.id)}
              >
                Jump to Current Node
              </button>
            </div>
          </div>

          <div className="dialogue-playtest-panel">
            <div className="dialogue-playtest-history">
              {playtestHistory.length === 0 ? (
                <p className="section-desc" style={{ marginBottom: 0 }}>
                  No playtest transcript yet.
                </p>
              ) : (
                playtestHistory.map((entry, index) => (
                  <div key={`${entry.speaker}_${index}`} className={`dialogue-playtest-entry is-${entry.speaker}`}>
                    <div className="dialogue-playtest-speaker">
                      {entry.speaker === "npc" ? "NPC" : entry.speaker === "player" ? "Player" : "System"}
                    </div>
                    <div className="dialogue-playtest-text">
                      <FormattedDialogueText text={entry.text} />
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="dialogue-playtest-actions">
              {playtestNode ? (
                <>
                  {playtestNode.nextNodeId || playtestNode.continueLabel ? (
                    <button className="btn btn--primary" onClick={handlePlaytestContinue}>
                      {playtestNode.continueLabel || "Continue"}
                    </button>
                  ) : null}
                  {playtestNode.options.map((option) => (
                    <button
                      key={`${playtestNode.id}_playtest_${option.id}`}
                      className="btn"
                      onClick={() => handlePlaytestOption(option)}
                    >
                      <FormattedDialogueText text={option.text} />
                    </button>
                  ))}
                  {!playtestNode.nextNodeId && playtestNode.options.length === 0 ? (
                    <p className="section-desc" style={{ marginBottom: 0 }}>
                      This node has no outgoing links.
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="section-desc" style={{ marginBottom: 0 }}>
                  {playtestEnded ? "Dialogue ended." : "Select Restart to begin playtesting."}
                </p>
              )}
            </div>
          </div>
        </div>
        ) : null}

        {editorMode === "diagnostics" ? (
          <div className="dialogue-flow-preview">
            <div className="section-header-row">
              <div>
                <h4 className="section-title" style={{ marginBottom: 0 }}>
                  Diagnostics
                </h4>
                <p className="section-desc" style={{ marginBottom: 0 }}>
                  Review flow health before editing. This isolates broken structure instead of mixing it into the authoring surface.
                </p>
              </div>
            </div>

            <div className="dialogue-diagnostics-grid">
              <div className="summary-item">
                <span className="summary-count">{diagnosticsSummary.nodes}</span>
                <span className="summary-label">Nodes</span>
              </div>
              <div className="summary-item">
                <span className="summary-count">{diagnosticsSummary.reachable}</span>
                <span className="summary-label">Reachable</span>
              </div>
              <div className="summary-item">
                <span className="summary-count">{diagnosticsSummary.unreachable}</span>
                <span className="summary-label">Unreachable</span>
              </div>
              <div className="summary-item">
                <span className="summary-count">{diagnosticsSummary.deadEnds}</span>
                <span className="summary-label">Dead Ends</span>
              </div>
              <div className="summary-item">
                <span className="summary-count">{diagnosticsSummary.unresolvedResponses}</span>
                <span className="summary-label">Unresolved</span>
              </div>
              <div className="summary-item">
                <span className="summary-count">{diagnosticsSummary.missingTargets + diagnosticsSummary.missingContinueTargets}</span>
                <span className="summary-label">Missing Links</span>
              </div>
            </div>

            {flowMeta.issues.length > 0 ? (
              <div className="validation-list" style={{ marginTop: 16 }}>
                {flowMeta.issues.map((issue) => (
                  <div key={issue} className="validation-item validation-item--warning">
                    {issue}
                  </div>
                ))}
              </div>
            ) : (
              <p className="section-desc" style={{ marginTop: 16, marginBottom: 0 }}>
                No dialogue flow issues found.
              </p>
            )}
          </div>
        ) : null}
      </section>
    </PageShell>
  );
}
