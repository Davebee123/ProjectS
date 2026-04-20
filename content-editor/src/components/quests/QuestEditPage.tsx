import { useNavigate, useParams } from "react-router-dom";
import { PageShell } from "../layout/PageShell";
import { ConditionEditor } from "../shared/ConditionEditor";
import { CollapsibleEditorSection } from "../shared/CollapsibleEditorSection";
import { ReferencePicker } from "../shared/ReferencePicker";
import { useQuestStore } from "../../stores/questStore";
import { useItemStore } from "../../stores/itemStore";
import { useStorageKeyStore } from "../../stores/storageKeyStore";
import { useInteractableStore } from "../../stores/interactableStore";
import type { QuestObjective, QuestProgress } from "../../schema/types";

function createObjective(idPrefix: string, index: number): QuestObjective {
  return {
    id: `${idPrefix}_objective_${index + 1}`,
    title: "New Objective",
    description: "",
    progress: {
      kind: "freeform",
      text: "Progress details go here.",
    },
  };
}

export function QuestEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { quests, updateQuest } = useQuestStore();
  const { items } = useItemStore();
  const { storageKeys } = useStorageKeyStore();
  const { interactables } = useInteractableStore();

  const quest = quests.find((entry) => entry.id === id);
  const itemOptions = items.map((item) => ({
    id: item.id,
    label: item.name || item.id,
    meta: `${item.inventoryCategory || "misc"} • ${item.rarity || "common"}`,
    description: item.description || undefined,
  }));
  const storageKeyOptions = storageKeys.map((key) => ({
    id: key.id,
    label: key.label || key.id,
    meta: key.type,
    description: key.description || undefined,
  }));
  const interactableOptions = interactables.map((interactable) => ({
    id: interactable.id,
    label: interactable.name || interactable.id,
    meta: `${interactable.activityTag || "none"} - Level ${interactable.requiredLevel || 1}`,
    description: interactable.description || undefined,
  }));

  if (!quest) {
    return (
      <PageShell title="Quest Not Found">
        <p>No quest with id "{id}".</p>
        <button className="btn" onClick={() => navigate("/quests")}>
          Back to Quests
        </button>
      </PageShell>
    );
  }

  const update = (patch: Parameters<typeof updateQuest>[1]) => updateQuest(quest.id, patch);

  const updateObjective = (index: number, patch: Partial<QuestObjective>) => {
    update({
      objectives: quest.objectives.map((objective, objectiveIndex) =>
        objectiveIndex === index ? { ...objective, ...patch } : objective
      ),
    });
  };

  const replaceObjectiveProgress = (index: number, progress: QuestProgress) => {
    updateObjective(index, { progress });
  };

  const addObjective = () => {
    update({
      objectives: [...quest.objectives, createObjective(quest.id, quest.objectives.length)],
    });
  };

  const removeObjective = (index: number) => {
    update({
      objectives: quest.objectives.filter((_, objectiveIndex) => objectiveIndex !== index),
    });
  };

  const describeObjective = (objective: QuestObjective): string => {
    const progressSourceLabel =
      objective.progress.kind !== "structured"
        ? "freeform"
        : objective.progress.source.type === "item_count"
          ? "item count"
          : objective.progress.source.type === "interactable_defeat_count"
            ? "interactable defeats"
            : "counter";
    const progressSummary =
      objective.progress.kind === "structured"
        ? `${progressSourceLabel} - ${objective.progress.requiredValue}`
        : progressSourceLabel;
    return `${objective.title || objective.id} - ${progressSummary}`;
  };


  const describeQuestConditions = () => {
    const pieces = [];
    if (quest.unlockCondition) pieces.push("unlock");
    if (quest.completeCondition) pieces.push("complete");
    return pieces.length > 0 ? pieces.join(" • ") : "none";
  };

  return (
    <PageShell
      title={quest.name || quest.id}
      actions={
        <button className="btn" onClick={() => navigate("/quests")}>
          Back to Quests
        </button>
      }
    >
      <section className="editor-section">
        <h3 className="section-title">Basic Properties</h3>
        <div className="form-grid">
          <div className="form-field">
            <label className="field-label">ID</label>
            <input className="input" value={quest.id} disabled />
          </div>
          <div className="form-field">
            <label className="field-label">Name</label>
            <input className="input" value={quest.name} onChange={(e) => update({ name: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="field-label">Folder</label>
            <input
              className="input"
              value={quest.folder || ""}
              onChange={(e) => update({ folder: e.target.value || undefined })}
              placeholder="e.g. main_story"
            />
          </div>
          <div className="form-field">
            <label className="field-label">Category</label>
            <select
              className="input"
              value={quest.category}
              onChange={(e) => update({ category: e.target.value as typeof quest.category })}
            >
              <option value="main_story">Main Story</option>
              <option value="side_quest">Side Quest</option>
              <option value="task">Task</option>
            </select>
          </div>
          <div className="form-field">
            <label className="field-label">Level (display only)</label>
            <input
              type="number"
              className="input"
              min={1}
              value={quest.level}
              onChange={(e) => update({ level: Math.max(1, Number(e.target.value) || 1) })}
            />
          </div>
        </div>
        <div className="form-field" style={{ marginTop: 16 }}>
          <label className="field-label">Description</label>
          <textarea
            className="input"
            rows={4}
            value={quest.description}
            onChange={(e) => update({ description: e.target.value })}
          />
        </div>
        <div className="form-field" style={{ marginTop: 16 }}>
          <label className="field-label">Completion Description</label>
          <p className="section-desc" style={{ marginBottom: 6 }}>
            Shown in the player's "Completed" quest section after the quest is finished.
            Falls back to the main description if blank.
          </p>
          <textarea
            className="input"
            rows={3}
            value={quest.completedDescription ?? ""}
            onChange={(e) => update({ completedDescription: e.target.value || undefined })}
            placeholder="e.g. With Rylor's blessing, the bushes of Lyorin are yours to harvest…"
          />
        </div>
      </section>

      <CollapsibleEditorSection
        title="Quest Conditions"
        summary={describeQuestConditions()}
        defaultOpen={false}
      >
        <div className="form-grid">
          <div className="form-field">
            <label className="field-label">Unlock Condition</label>
            <ConditionEditor
              value={quest.unlockCondition || ""}
              onChange={(value) => update({ unlockCondition: value || undefined })}
              placeholder='e.g. skill("treecutting").level >= 2'
            />
          </div>
          <div className="form-field">
            <label className="field-label">Complete Condition (optional override)</label>
            <ConditionEditor
              value={quest.completeCondition || ""}
              onChange={(value) => update({ completeCondition: value || undefined })}
              placeholder='e.g. player.flag("reported_back_to_virleios")'
            />
          </div>
        </div>
      </CollapsibleEditorSection>

      <section className="editor-section">
        <h3 className="section-title">Objectives</h3>
        <p className="section-desc">
          Objectives are shown in order. The runtime displays the first unlocked, incomplete objective. Use item counts for collection goals, interactable defeats for kill/destroy goals, and storage counters for custom tracked progress.
        </p>
        {quest.objectives.map((objective, index) => {
          const structuredProgress = objective.progress.kind === "structured" ? objective.progress : null;
          const freeformProgress = objective.progress.kind === "freeform" ? objective.progress : null;

          return (
            <CollapsibleEditorSection
              key={objective.id}
              title={`Objective ${index + 1}`}
              summary={describeObjective(objective)}
              defaultOpen={index === 0}
            >
              <div className="editor-subsection-header">
                <h4 className="section-title" style={{ marginBottom: 0 }}>Objective {index + 1}</h4>
                <button className="btn btn--danger btn--sm" onClick={() => removeObjective(index)}>
                  Remove
                </button>
              </div>
              <div className="form-grid">
                <div className="form-field">
                  <label className="field-label">Objective ID</label>
                  <input
                    className="input"
                    value={objective.id}
                    onChange={(e) => updateObjective(index, { id: e.target.value })}
                  />
                </div>
                <div className="form-field">
                  <label className="field-label">Title</label>
                  <input
                    className="input"
                    value={objective.title}
                    onChange={(e) => updateObjective(index, { title: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-field" style={{ marginTop: 16 }}>
                <label className="field-label">Description</label>
                <textarea
                  className="input"
                  rows={3}
                  value={objective.description}
                  onChange={(e) => updateObjective(index, { description: e.target.value })}
                />
              </div>

              <CollapsibleEditorSection
                title="Objective Conditions"
                summary={`${objective.unlockCondition ? "unlock" : "no unlock"} • ${objective.completeCondition ? "complete" : "no complete"}`}
                defaultOpen={false}
              >
                <div className="form-grid">
                  <div className="form-field">
                    <label className="field-label">Unlock Condition</label>
                    <ConditionEditor
                      value={objective.unlockCondition || ""}
                      onChange={(value) => updateObjective(index, { unlockCondition: value || undefined })}
                      placeholder='e.g. player.flag("accepted_samples_quest")'
                    />
                  </div>
                  <div className="form-field">
                    <label className="field-label">Complete Condition</label>
                    <ConditionEditor
                      value={objective.completeCondition || ""}
                      onChange={(value) => updateObjective(index, { completeCondition: value || undefined })}
                      placeholder='e.g. player.item_count("soil_sample") >= 5'
                    />
                  </div>
                </div>
              </CollapsibleEditorSection>

              <div className="form-grid" style={{ marginTop: 16 }}>
                <div className="form-field">
                  <label className="field-label">Progress Type</label>
                  <select
                    className="input"
                    value={objective.progress.kind}
                    onChange={(e) => {
                      if (e.target.value === "structured") {
                        updateObjective(index, {
                          progress: {
                            kind: "structured",
                            label: "Progress",
                            source: {
                              type: "storage_counter",
                              storageKeyId: storageKeys[0]?.id ?? "",
                            },
                            requiredValue: 1,
                          },
                        });
                      } else {
                        updateObjective(index, {
                          progress: {
                            kind: "freeform",
                            text: "Return to the quest giver.",
                          },
                        });
                      }
                    }}
                  >
                    <option value="structured">Structured</option>
                    <option value="freeform">Freeform</option>
                  </select>
                </div>
              </div>

              {structuredProgress ? (
                <div className="form-grid" style={{ marginTop: 16 }}>
                  <div className="form-field">
                    <label className="field-label">Progress Label</label>
                    <input
                      className="input"
                      value={structuredProgress.label}
                      onChange={(e) =>
                        replaceObjectiveProgress(index, {
                          ...structuredProgress,
                          label: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="form-field">
                    <label className="field-label">Progress Source</label>
                    <select
                      className="input"
                      value={structuredProgress.source.type}
                      onChange={(e) => {
                        if (e.target.value === "item_count") {
                          replaceObjectiveProgress(index, {
                            ...structuredProgress,
                            source: {
                              type: "item_count",
                              itemId: items[0]?.id ?? "",
                            },
                          });
                        } else if (e.target.value === "interactable_defeat_count") {
                          replaceObjectiveProgress(index, {
                            ...structuredProgress,
                            source: {
                              type: "interactable_defeat_count",
                              interactableId: interactables[0]?.id ?? "",
                            },
                          });
                        } else {
                          replaceObjectiveProgress(index, {
                            ...structuredProgress,
                            source: {
                              type: "storage_counter",
                              storageKeyId: storageKeys[0]?.id ?? "",
                            },
                          });
                        }
                      }}
                    >
                      <option value="storage_counter">Storage Counter</option>
                      <option value="item_count">Item Count</option>
                      <option value="interactable_defeat_count">Interactable Defeats</option>
                    </select>
                  </div>
                  {structuredProgress.source.type === "storage_counter" ? (
                    <ReferencePicker
                      label="Storage Key"
                      value={structuredProgress.source.storageKeyId}
                      options={storageKeyOptions}
                      onChange={(value) =>
                        replaceObjectiveProgress(index, {
                          ...structuredProgress,
                          source: {
                            type: "storage_counter",
                            storageKeyId: value,
                          },
                        })
                      }
                      placeholder="Select storage key..."
                      showSelectedPreview={false}
                    />
                  ) : structuredProgress.source.type === "item_count" ? (
                    <ReferencePicker
                      label="Item"
                      value={structuredProgress.source.itemId}
                      options={itemOptions}
                      onChange={(value) =>
                        replaceObjectiveProgress(index, {
                          ...structuredProgress,
                          source: {
                            type: "item_count",
                            itemId: value,
                          },
                        })
                      }
                      placeholder="Select item..."
                      showSelectedPreview={false}
                    />
                  ) : (
                    <ReferencePicker
                      label="Interactable"
                      value={structuredProgress.source.interactableId}
                      options={interactableOptions}
                      onChange={(value) =>
                        replaceObjectiveProgress(index, {
                          ...structuredProgress,
                          source: {
                            type: "interactable_defeat_count",
                            interactableId: value,
                          },
                        })
                      }
                      placeholder="Select interactable..."
                      showSelectedPreview={false}
                    />
                  )}
                  <div className="form-field">
                    <label className="field-label">Required Value</label>
                    <input
                      type="number"
                      className="input"
                      min={1}
                      value={structuredProgress.requiredValue}
                      onChange={(e) =>
                        replaceObjectiveProgress(index, {
                          ...structuredProgress,
                          requiredValue: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                    />
                  </div>
                </div>
              ) : (
                <div className="form-field" style={{ marginTop: 16 }}>
                  <label className="field-label">Player-facing Progress Text</label>
                  <input
                    className="input"
                    value={freeformProgress?.text || ""}
                    onChange={(e) =>
                      replaceObjectiveProgress(index, {
                        ...(freeformProgress ?? { kind: "freeform" as const }),
                        text: e.target.value,
                      })
                    }
                  />
                </div>
              )}
            </CollapsibleEditorSection>
          );
        })}

        <button className="btn btn--sm" onClick={addObjective}>
          + Add Objective
        </button>
      </section>
    </PageShell>
  );
}
