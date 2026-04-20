import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageShell } from "../layout/PageShell";
import { EventActionListEditor } from "../shared/EventActionListEditor";
import { CollapsibleEditorSection } from "../shared/CollapsibleEditorSection";
import { FilePathInput } from "../shared/FilePathInput";
import { ReferencePicker } from "../shared/ReferencePicker";
import { useCutsceneStore } from "../../stores/cutsceneStore";
import { useDialogueStore } from "../../stores/dialogueStore";
import type { CutsceneStep, EventAction } from "../../schema/types";

function createEventAction(): EventAction {
  return { type: "set_storage" };
}

function previewText(text: string, max = 56): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "(empty)";
  return normalized.length > max ? `${normalized.slice(0, max - 1)}...` : normalized;
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

function createStep(idPrefix: string, existingSteps: CutsceneStep[]): CutsceneStep {
  const existingIds = new Set(existingSteps.map((step) => step.id));
  const id = makeUniqueId(`${idPrefix}_step_${existingSteps.length + 1}`, existingIds);
  return {
    id,
    kind: "text",
    text: "New cutscene text.",
  };
}

function describeStepMedia(step: CutsceneStep): string {
  const parts: string[] = [];
  if (step.backgroundImage) parts.push("background");
  if (step.portraitImage) parts.push("portrait");
  if (step.ambientSound) parts.push("ambient");
  if (step.soundEffect) parts.push("sfx");
  return parts.length > 0 ? parts.join(" • ") : "none";
}

export function CutsceneEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { cutscenes, updateCutscene } = useCutsceneStore();
  const { dialogues } = useDialogueStore();
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  const cutscene = cutscenes.find((entry) => entry.id === id);
  const steps = cutscene?.steps ?? [];

  useEffect(() => {
    if (!cutscene) {
      return;
    }
    if (!selectedStepId || !cutscene.steps.some((step) => step.id === selectedStepId)) {
      setSelectedStepId(cutscene.startStepId || cutscene.steps[0]?.id || null);
    }
  }, [cutscene, selectedStepId]);

  const stepOptions = useMemo(
    () =>
      steps.map((step) => ({
        id: step.id,
        label: `${step.id} - ${step.kind === "dialogue" ? `Dialogue: ${step.dialogueId || "(unset)"}` : previewText(step.text || "", 42)}`,
      })),
    [steps]
  );
  const dialogueOptions = useMemo(
    () =>
      dialogues.map((dialogue) => ({
        id: dialogue.id,
        label: dialogue.name || dialogue.id,
        meta: `${dialogue.nodes.length} node${dialogue.nodes.length === 1 ? "" : "s"}`,
        description: dialogue.description || undefined,
      })),
    [dialogues]
  );

  if (!cutscene) {
    return (
      <PageShell title="Cutscene Not Found">
        <p>No cutscene with id "{id}".</p>
        <button className="btn" onClick={() => navigate("/cutscenes")}>
          Back to Cutscenes
        </button>
      </PageShell>
    );
  }

  const selectedStep = cutscene.steps.find((step) => step.id === selectedStepId) ?? cutscene.steps[0] ?? null;

  const update = (patch: Partial<typeof cutscene>) => updateCutscene(cutscene.id, patch);

  const updateStep = (stepId: string, patch: Partial<CutsceneStep>) => {
    update({
      steps: cutscene.steps.map((step) => (step.id === stepId ? { ...step, ...patch } : step)),
    });
  };

  const handleAddStep = () => {
    const nextStep = createStep(cutscene.id, cutscene.steps);
    update({ steps: [...cutscene.steps, nextStep] });
    setSelectedStepId(nextStep.id);
  };

  const handleRemoveStep = (stepId: string) => {
    const remainingSteps = cutscene.steps.filter((step) => step.id !== stepId);
    update({
      startStepId: cutscene.startStepId === stepId ? remainingSteps[0]?.id ?? "" : cutscene.startStepId,
      steps: remainingSteps.map((step) => ({
        ...step,
        nextStepId: step.nextStepId === stepId ? undefined : step.nextStepId,
      })),
    });
    if (selectedStepId === stepId) {
      setSelectedStepId(remainingSteps[0]?.id ?? null);
    }
  };

  const handleDuplicateStep = () => {
    if (!selectedStep) return;
    const duplicateId = makeUniqueId(
      `${selectedStep.id}_copy`,
      new Set(cutscene.steps.map((step) => step.id))
    );
    const duplicate: CutsceneStep = {
      ...selectedStep,
      id: duplicateId,
    };
    update({ steps: [...cutscene.steps, duplicate] });
    setSelectedStepId(duplicate.id);
  };

  return (
    <PageShell
      title={cutscene.name || cutscene.id}
      actions={
        <button className="btn" onClick={() => navigate("/cutscenes")}>
          Back to Cutscenes
        </button>
      }
    >
      <section className="editor-section">
        <h3 className="section-title">Basic Properties</h3>
        <div className="form-grid">
          <div className="form-field">
            <label className="field-label">ID</label>
            <input className="input" value={cutscene.id} disabled />
          </div>
          <div className="form-field">
            <label className="field-label">Name</label>
            <input className="input" value={cutscene.name} onChange={(e) => update({ name: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="field-label">Folder</label>
            <input
              className="input"
              value={cutscene.folder || ""}
              onChange={(e) => update({ folder: e.target.value || undefined })}
              placeholder="e.g. intro"
            />
          </div>
          <div className="form-field">
            <label className="field-label">Start Step ID</label>
            <select
              className="input"
              value={cutscene.startStepId}
              onChange={(e) => {
                update({ startStepId: e.target.value });
                setSelectedStepId(e.target.value);
              }}
            >
              {stepOptions.map((step) => (
                <option key={step.id} value={step.id}>
                  {step.label}
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
            value={cutscene.description || ""}
            onChange={(e) => update({ description: e.target.value || undefined })}
          />
        </div>
      </section>

      <CollapsibleEditorSection
        title="Scene Actions"
        summary={`${(cutscene.onStartEffects?.length ?? 0)} start • ${(cutscene.onCompleteEffects?.length ?? 0)} complete`}
        defaultOpen={false}
      >
        <p className="section-desc" style={{ marginBottom: 16 }}>
          Start actions fire when the cutscene begins. Complete actions fire after the final step exits.
        </p>

        <div className="editor-subsection">
          <div className="section-header-row">
            <h4 className="section-title" style={{ marginBottom: 0 }}>On Start Actions</h4>
            <button
              className="btn btn--sm"
              onClick={() => update({ onStartEffects: [...(cutscene.onStartEffects ?? []), createEventAction()] })}
            >
              Add Action
            </button>
          </div>
          <EventActionListEditor
            actions={cutscene.onStartEffects ?? []}
            onChange={(onStartEffects) => update({ onStartEffects })}
            emptyText="No start actions."
          />
        </div>

        <div className="editor-subsection" style={{ marginTop: 16 }}>
          <div className="section-header-row">
            <h4 className="section-title" style={{ marginBottom: 0 }}>On Complete Actions</h4>
            <button
              className="btn btn--sm"
              onClick={() => update({ onCompleteEffects: [...(cutscene.onCompleteEffects ?? []), createEventAction()] })}
            >
              Add Action
            </button>
          </div>
          <EventActionListEditor
            actions={cutscene.onCompleteEffects ?? []}
            onChange={(onCompleteEffects) => update({ onCompleteEffects })}
            emptyText="No complete actions."
          />
        </div>
      </CollapsibleEditorSection>

      <section className="editor-section">
        <div className="section-header-row">
          <div>
            <h3 className="section-title">Step Workbench</h3>
            <p className="section-desc" style={{ marginBottom: 0 }}>
              Compose a sequence of full-screen text steps and dialogue handoffs. Dialogue steps automatically resume the cutscene when the dialogue closes.
            </p>
          </div>
          <button className="btn btn--primary" onClick={handleAddStep}>
            Add Step
          </button>
        </div>

        <div className="dialogue-editor-layout">
          <aside className="dialogue-node-outline">
            <div className="dialogue-outline-header">Steps</div>
            <div className="dialogue-node-list">
              {cutscene.steps.map((step) => {
                const isSelected = step.id === selectedStep?.id;
                const isStart = step.id === cutscene.startStepId;
                return (
                  <button
                    key={step.id}
                    type="button"
                    className={`dialogue-node-list-item${isSelected ? " is-selected" : ""}`}
                    onClick={() => setSelectedStepId(step.id)}
                  >
                    <div className="dialogue-node-list-top">
                      <span className="dialogue-node-list-id">{step.id}</span>
                      <span className="dialogue-node-list-count">{step.kind}</span>
                    </div>
                    <div className="dialogue-node-list-preview">
                      {step.kind === "dialogue"
                        ? `Dialogue: ${step.dialogueId || "(unset)"}`
                        : previewText(step.text || "")}
                    </div>
                    <div className="dialogue-node-list-badges">
                      {isStart ? <span className="dialogue-badge is-start">Start</span> : null}
                      {step.nextStepId ? <span className="dialogue-badge">Links</span> : null}
                      {(step.onEnterEffects?.length ?? 0) > 0 ? <span className="dialogue-badge">Enter</span> : null}
                      {(step.onContinueEffects?.length ?? 0) > 0 ? <span className="dialogue-badge">Continue</span> : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="dialogue-node-editor">
            {selectedStep ? (
              <>
                <div className="editor-subsection">
                  <div className="section-header-row">
                    <div>
                      <h4 className="section-title" style={{ marginBottom: 0 }}>
                        {selectedStep.id}
                      </h4>
                      <p className="section-desc" style={{ marginBottom: 0 }}>
                        {selectedStep.kind === "dialogue"
                          ? `Dialogue handoff: ${selectedStep.dialogueId || "(unset)"}`
                          : previewText(selectedStep.text || "", 120)}
                      </p>
                    </div>
                    <div className="button-row" style={{ marginBottom: 0 }}>
                      <button className="btn btn--sm" onClick={handleDuplicateStep}>
                        Duplicate
                      </button>
                      <button className="btn btn--danger btn--sm" onClick={() => handleRemoveStep(selectedStep.id)}>
                        Remove
                      </button>
                    </div>
                  </div>

                  <div className="form-grid">
                    <div className="form-field">
                      <label className="field-label">Step ID</label>
                      <input
                        className="input"
                        value={selectedStep.id}
                        onChange={(e) => {
                          updateStep(selectedStep.id, { id: e.target.value });
                          setSelectedStepId(e.target.value);
                        }}
                      />
                    </div>
                    <div className="form-field">
                      <label className="field-label">Kind</label>
                      <select
                        className="input"
                        value={selectedStep.kind}
                        onChange={(e) => updateStep(selectedStep.id, { kind: e.target.value as CutsceneStep["kind"] })}
                      >
                        <option value="text">Text</option>
                        <option value="dialogue">Dialogue</option>
                      </select>
                    </div>
                    <div className="form-field">
                      <label className="field-label">Next Step</label>
                      <select
                        className="input"
                        value={selectedStep.nextStepId || ""}
                        onChange={(e) => updateStep(selectedStep.id, { nextStepId: e.target.value || undefined })}
                      >
                        <option value="">(end cutscene)</option>
                        {stepOptions
                          .filter((step) => step.id !== selectedStep.id)
                          .map((step) => (
                            <option key={step.id} value={step.id}>
                              {step.label}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="form-field">
                      <label className="field-label">Continue Label</label>
                      <input
                        className="input"
                        value={selectedStep.continueLabel || ""}
                        onChange={(e) => updateStep(selectedStep.id, { continueLabel: e.target.value || undefined })}
                        placeholder={selectedStep.kind === "dialogue" ? "Unused for dialogue steps" : "Continue"}
                      />
                    </div>
                  </div>

                  {selectedStep.kind === "text" ? (
                    <div className="form-field" style={{ marginTop: 16 }}>
                      <label className="field-label">Cutscene Text</label>
                      <textarea
                        className="input"
                        rows={7}
                        value={selectedStep.text || ""}
                        onChange={(e) => updateStep(selectedStep.id, { text: e.target.value })}
                      />
                    </div>
                  ) : (
                    <>
                      <div className="form-grid" style={{ marginTop: 16 }}>
                        <div className="form-field">
                          <ReferencePicker
                            label="Dialogue"
                            value={selectedStep.dialogueId || ""}
                            options={dialogueOptions}
                            onChange={(value) => updateStep(selectedStep.id, { dialogueId: value || undefined })}
                            placeholder="Select dialogue..."
                            showSelectedPreview={false}
                            onOpenSelected={(value) => navigate(`/dialogues/${value}`)}
                          />
                        </div>
                        <div className="form-field">
                          <label className="field-label">Speaker Name</label>
                          <input
                            className="input"
                            value={selectedStep.speakerName || ""}
                            onChange={(e) => updateStep(selectedStep.id, { speakerName: e.target.value || undefined })}
                            placeholder="Optional override"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <CollapsibleEditorSection
                    title="Step Media"
                    summary={describeStepMedia(selectedStep)}
                    defaultOpen={false}
                  >
                    <div className="form-grid">
                      {selectedStep.kind === "dialogue" ? (
                        <div className="form-field">
                          <FilePathInput
                            label="Portrait Image"
                            value={selectedStep.portraitImage || ""}
                            onChange={(value) => updateStep(selectedStep.id, { portraitImage: value || undefined })}
                            placeholder="images/portrait.png"
                            accept="image/*"
                            pathPrefix="images"
                          />
                        </div>
                      ) : null}
                      <div className="form-field">
                        <FilePathInput
                          label="Background Image"
                          value={selectedStep.backgroundImage || ""}
                          onChange={(value) => updateStep(selectedStep.id, { backgroundImage: value || undefined })}
                          placeholder="images/cutscenes/scene.png"
                          accept="image/*"
                          pathPrefix="images"
                        />
                      </div>
                      <div className="form-field">
                        <FilePathInput
                          label="Ambient Sound"
                          value={selectedStep.ambientSound || ""}
                          onChange={(value) => updateStep(selectedStep.id, { ambientSound: value || undefined })}
                          placeholder="audio/ambient/scene.ogg"
                          accept="audio/*"
                          pathPrefix="audio"
                        />
                      </div>
                      <div className="form-field">
                        <FilePathInput
                          label="One-shot Sound"
                          value={selectedStep.soundEffect || ""}
                          onChange={(value) => updateStep(selectedStep.id, { soundEffect: value || undefined })}
                          placeholder="audio/sfx/sting.ogg"
                          accept="audio/*"
                          pathPrefix="audio"
                        />
                      </div>
                    </div>
                  </CollapsibleEditorSection>
                </div>

                <CollapsibleEditorSection
                  title="On Enter Actions"
                  summary={`${selectedStep.onEnterEffects?.length ?? 0} action${(selectedStep.onEnterEffects?.length ?? 0) === 1 ? "" : "s"}`}
                  defaultOpen={false}
                >
                  <div className="section-header-row">
                    <h4 className="section-title" style={{ marginBottom: 0 }}>On Enter Actions</h4>
                    <button
                      className="btn btn--sm"
                      onClick={() => updateStep(selectedStep.id, { onEnterEffects: [...(selectedStep.onEnterEffects ?? []), createEventAction()] })}
                    >
                      Add Action
                    </button>
                  </div>
                  <EventActionListEditor
                    actions={selectedStep.onEnterEffects ?? []}
                    onChange={(onEnterEffects) => updateStep(selectedStep.id, { onEnterEffects })}
                    emptyText="No enter actions."
                  />
                </CollapsibleEditorSection>

                <CollapsibleEditorSection
                  title="On Continue Actions"
                  summary={`${selectedStep.onContinueEffects?.length ?? 0} action${(selectedStep.onContinueEffects?.length ?? 0) === 1 ? "" : "s"}`}
                  defaultOpen={false}
                >
                  <div className="section-header-row">
                    <h4 className="section-title" style={{ marginBottom: 0 }}>On Continue Actions</h4>
                    <button
                      className="btn btn--sm"
                      onClick={() => updateStep(selectedStep.id, { onContinueEffects: [...(selectedStep.onContinueEffects ?? []), createEventAction()] })}
                      disabled={selectedStep.kind !== "text"}
                    >
                      Add Action
                    </button>
                  </div>
                  <EventActionListEditor
                    actions={selectedStep.onContinueEffects ?? []}
                    onChange={(onContinueEffects) => updateStep(selectedStep.id, { onContinueEffects })}
                    emptyText={selectedStep.kind === "text" ? "No continue actions." : "Dialogue steps resume automatically; continue actions are unused."}
                  />
                </CollapsibleEditorSection>
              </>
            ) : (
              <p className="section-desc">Add a step to start authoring the cutscene.</p>
            )}
          </div>
        </div>
      </section>
    </PageShell>
  );
}
