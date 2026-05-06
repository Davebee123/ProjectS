import { useParams, useNavigate } from "react-router-dom";
import { PageShell } from "../layout/PageShell";
import type { InteractableFormRule, InteractableTemplate, NpcDialogueRoute } from "../../schema/types";
import { useInteractableStore } from "../../stores/interactableStore";
import { useTagStore } from "../../stores/tagStore";
import { SingleTagPicker, TagPicker } from "../shared/TagPicker";
import { ColorPicker } from "../shared/ColorPicker";
import { NumberRange } from "../shared/NumberRange";
import { AbilitiesPanel } from "./AbilitiesPanel";
import { LootTablePanel } from "./LootTablePanel";
import { XpRewardsPanel } from "./XpRewardsPanel";
import { CollapsibleEditorSection } from "../shared/CollapsibleEditorSection";
import { ConditionEditor } from "../shared/ConditionEditor";
import { FilePathInput } from "../shared/FilePathInput";
import { ReferencePicker } from "../shared/ReferencePicker";
import { VolumeSlider } from "../shared/VolumeSlider";
import { createDefaultDialogue, useDialogueStore } from "../../stores/dialogueStore";
import { EventActionListEditor } from "../shared/EventActionListEditor";
import { toPublicAssetPath } from "../../utils/assets";
import { createUniqueId } from "../../utils/ids";
import { normalizeNpcTemplate } from "../../utils/interactables";
import { useSkillStore } from "../../stores/skillStore";
import { useQuestStore } from "../../stores/questStore";

const INTERACTABLE_ACTION_TARGETS = [
  { value: "player" as const, label: "Player" },
  { value: "bearer" as const, label: "This Interactable" },
];

export function InteractableEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { interactables, updateInteractable } = useInteractableStore();
  const { activityTags, abilityTags } = useTagStore();
  const { dialogues, addDialogue } = useDialogueStore();
  const { skills } = useSkillStore();
  const { quests } = useQuestStore();
  const item = interactables.find((t) => t.id === id);

  if (!item) {
    return (
      <PageShell title="Not Found">
        <p>No interactable with id "{id}".</p>
        <button className="btn" onClick={() => navigate("/interactables")}>
          Back to Interactables
        </button>
      </PageShell>
    );
  }

  const update = (patch: Partial<typeof item>) =>
    updateInteractable(item.id, patch);

  const dialogueOptions = dialogues.map((dialogue) => ({
    id: dialogue.id,
    label: dialogue.name || dialogue.id,
    meta: `${dialogue.folder || "Dialogues"} • ${dialogue.nodes.length} node${dialogue.nodes.length === 1 ? "" : "s"}`,
    description: dialogue.description || undefined,
  }));
  const npc: NonNullable<InteractableTemplate["npc"]> = normalizeNpcTemplate(item.npc) ?? {};
  const interactableImageSrc = toPublicAssetPath(item.image);
  const portraitImageSrc = toPublicAssetPath(npc.portraitImage);
  const previewImageSrc = interactableImageSrc || portraitImageSrc;
  const npcDialogues: NpcDialogueRoute[] = npc.dialogues ?? [];
  const formRules: InteractableFormRule[] = item.formRules ?? [];
  const visibleAllowedAbilityTagCount = item.allowedAbilityTags.filter((tagId) =>
    abilityTags.some((tag) => tag.id === tagId)
  ).length;
  const validNpcDialogueCount = npcDialogues.filter((route) => Boolean(route.dialogueId?.trim())).length;
  const defaultDialogueLabel = npc.dialogueId
    ? dialogues.find((dialogue) => dialogue.id === npc.dialogueId)?.name || npc.dialogueId
    : "No default dialogue";
  const isNpcActivity = item.activityTag === "npc";

  const updateNpc = (patch: Partial<NonNullable<typeof npc>>) =>
    update({
      npc: normalizeNpcTemplate({
        dialogues: npcDialogues,
        ...npc,
        ...patch,
      }),
    });

  const addNpcDialogueRoute = () => {
    updateNpc({
      dialogues: [...npcDialogues, { dialogueId: "" }],
    });
  };

  const updateNpcDialogueRoute = (
    index: number,
    patch: Partial<NpcDialogueRoute>
  ) => {
    updateNpc({
      dialogues: npcDialogues.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, ...patch } : entry
      ),
    });
  };

  const removeNpcDialogueRoute = (index: number) => {
    updateNpc({
      dialogues: npcDialogues.filter((_, entryIndex) => entryIndex !== index),
    });
  };
  const formTargetOptions = interactables.map((interactable) => ({
    id: interactable.id,
    label: interactable.name,
    meta: `${interactable.activityTag || "no activity"} • Level ${interactable.requiredLevel}`,
  }));
  const updateFormRule = (index: number, patch: Partial<InteractableFormRule>) => {
    update({
      formRules: formRules.map((rule, ruleIndex) =>
        ruleIndex === index ? { ...rule, ...patch } : rule
      ),
    });
  };
  const addFormRule = () => {
    update({
      formRules: [
        ...formRules,
        {
          id: createUniqueId("form rule", formRules.map((rule) => rule.id)),
          condition: "",
          interactableId: "",
        },
      ],
    });
  };
  const removeFormRule = (index: number) => {
    update({ formRules: formRules.filter((_, ruleIndex) => ruleIndex !== index) });
  };

  return (
    <PageShell
      title={item.name}
      actions={
        <button className="btn" onClick={() => navigate("/interactables")}>
          Back to Interactables
        </button>
      }
    >
      {/* â”€â”€ Basic Properties â”€â”€ */}
      <section className="editor-section">
        <h3 className="section-title">Basic Properties</h3>
        <div className="form-grid">
          <div className="form-field">
            <label className="field-label">ID</label>
            <input className="input" value={item.id} disabled />
          </div>
          <div className="form-field">
            <label className="field-label">Name</label>
            <input
              className="input"
              value={item.name}
              onChange={(e) => update({ name: e.target.value })}
            />
          </div>
          <div className="form-field form-field--wide">
            <label className="field-label">Description</label>
            <input
              className="input"
              value={item.description}
              onChange={(e) => update({ description: e.target.value })}
              placeholder="What this interactable does..."
            />
          </div>
          <div className="form-field">
            <SingleTagPicker
              label="Activity Tag"
              tags={activityTags}
              selected={item.activityTag}
              onChange={(activityTag) =>
                update({
                  activityTag,
                  npc: activityTag === "npc" ? (item.npc ?? { dialogues: [] }) : undefined,
                })
              }
            />
          </div>
          <div className="form-field">
            <label className="field-label">Required Level</label>
            <input
              type="number"
              className="input"
              value={item.requiredLevel}
              onChange={(e) =>
                update({ requiredLevel: Number(e.target.value) })
              }
            />
          </div>
          <div className="form-field">
            <label className="field-label">Folder</label>
            <input
              className="input"
              value={item.folder || ""}
              onChange={(e) => update({ folder: e.target.value || undefined })}
              placeholder="e.g. Trees, Enemies..."
            />
          </div>
        </div>

      </section>

      <CollapsibleEditorSection
        title="Ability Rules"
        summary={
          item.activityTag === "enemy" || visibleAllowedAbilityTagCount > 0
            ? `${item.abilityBehaviorMode || "priority"} / ${visibleAllowedAbilityTagCount} tag filter${visibleAllowedAbilityTagCount === 1 ? "" : "s"}`
            : "No advanced ability rules"
        }
        defaultOpen={item.activityTag === "enemy" || visibleAllowedAbilityTagCount > 0}
      >
        <section className="editor-section">
          <div className="form-grid">
            <div className="form-field">
              <label className="field-label">Ability Behavior</label>
              <select
                className="input select"
                value={item.abilityBehaviorMode || "priority"}
                onChange={(e) =>
                  update({
                    abilityBehaviorMode: e.target.value as "priority" | "sequence",
                  })
                }
              >
                <option value="priority">Priority</option>
                <option value="sequence">Sequence</option>
              </select>
            </div>
            <div className="form-field">
              <label className="field-label">Initial Ability Delay (ms)</label>
              <input
                type="number"
                min={0}
                className="input"
                value={item.initialAbilityDelayMs ?? 3000}
                onChange={(e) =>
                  update({
                    initialAbilityDelayMs: Math.max(0, Number(e.target.value) || 0),
                  })
                }
              />
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <TagPicker
              label="Allowed Ability Tags"
              tags={abilityTags}
              selected={item.allowedAbilityTags}
              onChange={(allowedAbilityTags) => update({ allowedAbilityTags })}
            />
          </div>
        </section>
      </CollapsibleEditorSection>

      {/* â”€â”€ Image â”€â”€ */}
      <section className="editor-section">
        <h3 className="section-title">Image</h3>
        <p className="section-desc">
          Path to the main interactable image (relative to <code>public/</code>). This same image is used on the world card and NPC dialogue portrait.
        </p>
        <div className="form-grid">
          <div className="form-field form-field--wide">
            <FilePathInput
              label="Image Path"
              value={item.image || ""}
              onChange={(v) => update({ image: v || undefined })}
              placeholder="Interactable Images/rylor.png"
              accept="image/*"
              pathPrefix="Interactable Images"
            />
          </div>
          <div className="form-field">
            <label className="field-label">Image Focus X (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              className="input"
              value={item.imagePositionX ?? 50}
              onChange={(e) => update({ imagePositionX: Number(e.target.value) })}
            />
          </div>
          <div className="form-field">
            <label className="field-label">Image Focus Y (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              className="input"
              value={item.imagePositionY ?? 50}
              onChange={(e) => update({ imagePositionY: Number(e.target.value) })}
            />
          </div>
        </div>
        {item.image && (
          <div style={{ marginTop: 8, borderRadius: 6, overflow: "hidden", maxWidth: 320 }}>
            <img
              src={interactableImageSrc}
              alt={item.name}
              style={{
                width: "100%",
                display: "block",
                objectFit: "cover",
                objectPosition: `${item.imagePositionX ?? 50}% ${item.imagePositionY ?? 50}%`,
              }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>
        )}
      </section>

      <section className="editor-section">
        <h3 className="section-title">Preview</h3>
        <p className="section-desc">
          Compact runtime-style interactable card preview. This is presentation only.
        </p>
        <div className="interactable-preview-card" style={{ borderColor: item.accentColor }}>
          <div className="interactable-preview-header" style={{ background: item.barColor }}>
            <strong>{item.name || item.id}</strong>
            <span>
              {item.effectiveHealth.max} {item.meterLabel.toUpperCase()}
            </span>
          </div>
          <div className="interactable-preview-body">
            {previewImageSrc ? (
              <img
                src={previewImageSrc}
                alt={item.name}
                className="interactable-preview-image"
                style={{ objectPosition: `${item.imagePositionX ?? 50}% ${item.imagePositionY ?? 50}%` }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <div className="interactable-preview-empty">NO IMAGE</div>
            )}
            {(item.activityTag === "enemy" || item.activityTag === "friendly") && item.abilities[0] ? (
              <div className="interactable-preview-castbar">
                <div className="interactable-preview-castfill" style={{ background: item.barColor, width: "58%" }} />
                <span className="interactable-preview-castname">
                  {item.abilities[0].skillId
                    ? skills.find((skill) => skill.id === item.abilities[0].skillId)?.name ?? "Linked Skill"
                    : item.abilities[0].name || "Ability"}
                </span>
                <span className="interactable-preview-casttime">
                  {(
                    ((item.abilities[0].skillId
                      ? skills.find((skill) => skill.id === item.abilities[0].skillId)?.baseDurationMs
                      : item.abilities[0].castTimeMs) ?? 0) / 1000
                  ).toFixed(1)}s
                </span>
              </div>
            ) : null}
          </div>
        </div>
        {isNpcActivity && item.npc ? (
          <div className="interactable-preview-npc">
            <div className="interactable-preview-portrait">
              {previewImageSrc ? (
                <img
                  src={previewImageSrc}
                  alt={`${item.name} portrait`}
                  className="interactable-preview-portrait-image"
                  style={{ objectPosition: `${item.imagePositionX ?? 50}% ${item.imagePositionY ?? 50}%` }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <div className="interactable-preview-empty interactable-preview-empty--portrait">PORTRAIT</div>
              )}
            </div>
            <div className="interactable-preview-dialogue-meta">
              <strong>NPC Dialogue Linked</strong>
              <span>
                {defaultDialogueLabel}
                {validNpcDialogueCount > 0 ? ` • ${validNpcDialogueCount} conditional route${validNpcDialogueCount === 1 ? "" : "s"}` : ""}
              </span>
            </div>
          </div>
        ) : null}
      </section>

      {isNpcActivity ? (
        <section className="editor-section">
          <h3 className="section-title">NPC Dialogue</h3>
          <p className="section-desc">
            Assign a default dialogue and any number of ordered conditional dialogue routes. The first matching route activates; otherwise the default dialogue is used.
          </p>
          <div className="form-grid">
            <div className="form-field">
              <ReferencePicker
                label="Default Dialogue"
                value={npc.dialogueId || ""}
                options={dialogueOptions}
                onChange={(value) =>
                  updateNpc({
                    dialogueId: value || undefined,
                  })
                }
                placeholder="Select dialogue..."
                onOpenSelected={(value) => navigate(`/dialogues/${value}`)}
                onCreate={(name) => {
                  const id = createUniqueId(name, dialogues.map((dialogue) => dialogue.id));
                  addDialogue({
                    ...createDefaultDialogue(id, name),
                    folder: "npcs",
                  });
                  return id;
                }}
                createPlaceholder="New dialogue name..."
              />
            </div>
          </div>
          <div className="stack-md" style={{ marginTop: 16 }}>
            <div className="field-label">Conditional Dialogue Routes</div>
            <p className="section-desc" style={{ marginTop: 0 }}>
              Checked top to bottom. Use conditions like <code>player.has_completed_quest("quest_id")</code>.
            </p>
            {npcDialogues.length === 0 ? (
              <p className="section-desc" style={{ marginBottom: 0 }}>
                No conditional routes. The default dialogue will always be used.
              </p>
            ) : (
              npcDialogues.map((route, index) => (
                <div key={`npc_dialogue_route_${index}`} className="action-editor-card">
                  <div className="action-row">
                    <ReferencePicker
                      value={route.dialogueId || ""}
                      options={dialogueOptions}
                      compact
                      showSelectedPreview={false}
                      placeholder="Select dialogue..."
                      onChange={(value) =>
                        updateNpcDialogueRoute(index, { dialogueId: value || "" })
                      }
                      onOpenSelected={(value) => navigate(`/dialogues/${value}`)}
                      onCreate={(name) => {
                        const id = createUniqueId(name, dialogues.map((dialogue) => dialogue.id));
                        addDialogue({
                          ...createDefaultDialogue(id, name),
                          folder: "npcs",
                        });
                        return id;
                      }}
                      createPlaceholder="New dialogue name..."
                    />
                    <button
                      type="button"
                      className="btn btn--danger btn--sm"
                      onClick={() => removeNpcDialogueRoute(index)}
                    >
                      Remove
                    </button>
                  </div>
                  <div className="form-field">
                    <label className="field-label">Condition</label>
                    <ConditionEditor
                      value={route.condition || ""}
                      onChange={(value) =>
                        updateNpcDialogueRoute(index, { condition: value || undefined })
                      }
                      placeholder='Optional, e.g. player.has_completed_quest("dirty_frank_intro")'
                    />
                  </div>
                </div>
              ))
            )}
            <button type="button" className="btn btn--sm" onClick={addNpcDialogueRoute}>
              + Add Conditional Dialogue
            </button>
          </div>
        </section>
      ) : null}

      {/* â”€â”€ Health + Appearance â”€â”€ */}
      <section className="editor-section">
        <h3 className="section-title">Health &amp; Appearance</h3>
        <div className="form-grid">
          <div className="form-field">
            <NumberRange
              label="Effective Health Range"
              min={item.effectiveHealth.min}
              max={item.effectiveHealth.max}
              onMinChange={(min) =>
                update({ effectiveHealth: { ...item.effectiveHealth, min } })
              }
              onMaxChange={(max) =>
                update({ effectiveHealth: { ...item.effectiveHealth, max } })
              }
            />
          </div>
          <div className="form-field">
            <label className="field-label">Meter Label</label>
            <input
              className="input"
              value={item.meterLabel}
              onChange={(e) => update({ meterLabel: e.target.value })}
              placeholder='e.g. "Integrity", "HP"'
            />
          </div>
          <div className="form-field">
            <ColorPicker
              label="Bar Color"
              value={item.barColor}
              onChange={(barColor) => update({ barColor })}
            />
          </div>
          <div className="form-field">
            <ColorPicker
              label="Accent Color"
              value={item.accentColor}
              onChange={(accentColor) => update({ accentColor })}
            />
          </div>
        </div>
      </section>

      {/* â”€â”€ Spawn Condition â”€â”€ */}
      <CollapsibleEditorSection
        title="Spawn Condition"
        summary={item.spawnCondition ? "Conditional spawn configured" : "Always available"}
        defaultOpen={Boolean(item.spawnCondition)}
      >
        <section className="editor-section">
          <p className="section-desc">
            Optional DSL condition that must be true for this interactable to appear
            in spawn tables.
          </p>
          <ConditionEditor
            value={item.spawnCondition || ""}
            onChange={(v) =>
              update({ spawnCondition: v || undefined })
            }
            placeholder='e.g. skill("mining").level >= 5'
          />
        </section>
      </CollapsibleEditorSection>

      <CollapsibleEditorSection
        title="Form Rules"
        summary={formRules.length === 0 ? "No automatic form changes" : `${formRules.length} rule${formRules.length === 1 ? "" : "s"}`}
        defaultOpen={formRules.length > 0}
      >
        <section className="editor-section">
          <p className="section-desc">
            Automatically swap this interactable to another template when a condition becomes true. Use this for NPC-to-companion or companion-to-NPC phases.
          </p>
          <div className="stack-md">
            {formRules.map((rule, index) => (
              <div key={rule.id || `form_rule_${index}`} className="action-editor-card">
                <div className="action-row">
                  <ReferencePicker
                    value={rule.interactableId}
                    options={formTargetOptions}
                    compact
                    showSelectedPreview={false}
                    placeholder="Become interactable..."
                    onChange={(value) => updateFormRule(index, { interactableId: value })}
                  />
                  <button
                    type="button"
                    className="btn btn--danger btn--sm"
                    onClick={() => removeFormRule(index)}
                  >
                    Remove
                  </button>
                </div>
                <div className="form-field">
                  <label className="field-label">When Condition Is True</label>
                  <ConditionEditor
                    value={rule.condition}
                    onChange={(condition) => updateFormRule(index, { condition })}
                    placeholder='e.g. player.counter("interactable_defeated:threadhorn_staglet") >= 5'
                  />
                </div>
              </div>
            ))}
            <button type="button" className="btn btn--sm" onClick={addFormRule}>
              + Add Form Rule
            </button>
          </div>
        </section>
      </CollapsibleEditorSection>

      <CollapsibleEditorSection
        title="Abilities"
        summary={item.abilities.length === 0 ? "No abilities configured" : `${item.abilities.length} abilit${item.abilities.length === 1 ? "y" : "ies"} configured`}
        defaultOpen={item.activityTag === "enemy" || item.abilities.length > 0}
      >
        <AbilitiesPanel
          activityTag={item.activityTag}
          abilityBehaviorMode={item.abilityBehaviorMode}
          abilities={item.abilities}
          onChange={(abilities) => update({ abilities })}
        />
      </CollapsibleEditorSection>

      <CollapsibleEditorSection
        title="Loot Table"
        summary={item.lootTable.length === 0 ? "No loot configured" : `${item.lootTable.length} loot entr${item.lootTable.length === 1 ? "y" : "ies"}`}
        defaultOpen={item.lootTable.length > 0}
      >
        <LootTablePanel
          entries={item.lootTable}
          onChange={(lootTable) => update({ lootTable })}
        />
      </CollapsibleEditorSection>

      <CollapsibleEditorSection
        title="XP Rewards"
        summary={item.xpRewards.length === 0 ? "No XP rewards configured" : `${item.xpRewards.length} reward entr${item.xpRewards.length === 1 ? "y" : "ies"}`}
        defaultOpen={item.xpRewards.length > 0}
      >
        <XpRewardsPanel
          rewards={item.xpRewards}
          onChange={(xpRewards) => update({ xpRewards })}
        />
      </CollapsibleEditorSection>

      <CollapsibleEditorSection
        title="Offers Quests"
        summary={
          (item.offersQuestIds?.length ?? 0) === 0
            ? "No quests offered"
            : `${item.offersQuestIds!.length} quest${item.offersQuestIds!.length === 1 ? "" : "s"} offered`
        }
        defaultOpen={(item.offersQuestIds?.length ?? 0) > 0}
      >
        <section className="editor-section">
          <p className="section-desc">
            Quests this interactable can offer to the player. Shows a "!" badge
            in-game whenever any listed quest has not been granted and has not
            been completed. Useful for quest-giver NPCs so players know who to
            talk to next. (This does NOT grant the quest — use a dialogue
            effect for that.)
          </p>
          <OffersQuestPicker
            value={item.offersQuestIds ?? []}
            options={quests.map((q) => ({
              id: q.id,
              label: q.name || q.id,
              meta: q.category,
            }))}
            onChange={(offersQuestIds) =>
              update({ offersQuestIds: offersQuestIds.length === 0 ? undefined : offersQuestIds })
            }
          />
        </section>
      </CollapsibleEditorSection>

      <CollapsibleEditorSection
        title="On Interact Actions"
        summary={item.onInteractEffects.length === 0 ? "No interact actions" : `${item.onInteractEffects.length} action${item.onInteractEffects.length === 1 ? "" : "s"}`}
        defaultOpen={item.onInteractEffects.length > 0}
      >
        <section className="editor-section">
          <p className="section-desc">
            Actions triggered each time the player successfully interacts with this object.
          </p>
          <EventActionListEditor
            actions={item.onInteractEffects}
            onChange={(onInteractEffects) => update({ onInteractEffects })}
            emptyText="No interact actions."
            actionTargetOptions={INTERACTABLE_ACTION_TARGETS}
          />
        </section>
      </CollapsibleEditorSection>

      <CollapsibleEditorSection
        title="On Destroy Actions"
        summary={item.onDestroyEffects.length === 0 ? "No destroy actions" : `${item.onDestroyEffects.length} action${item.onDestroyEffects.length === 1 ? "" : "s"}`}
        defaultOpen={item.onDestroyEffects.length > 0}
      >
        <section className="editor-section">
          <p className="section-desc">
            Actions triggered when this interactable reaches zero integrity.
          </p>
          <EventActionListEditor
            actions={item.onDestroyEffects}
            onChange={(onDestroyEffects) => update({ onDestroyEffects })}
            emptyText="No destroy actions."
            actionTargetOptions={INTERACTABLE_ACTION_TARGETS}
          />
        </section>
      </CollapsibleEditorSection>

      <CollapsibleEditorSection
        title="Sound Effects"
        summary={
          [item.sounds?.onHit, item.sounds?.onDestroy, item.sounds?.onAbilityCast].filter(Boolean).length === 0
            ? "No sounds linked"
            : `${[item.sounds?.onHit, item.sounds?.onDestroy, item.sounds?.onAbilityCast].filter(Boolean).length} sound${[item.sounds?.onHit, item.sounds?.onDestroy, item.sounds?.onAbilityCast].filter(Boolean).length === 1 ? "" : "s"} linked`
        }
        defaultOpen={Boolean(item.sounds?.onHit || item.sounds?.onDestroy || item.sounds?.onAbilityCast)}
      >
        <section className="editor-section">
          <p className="section-desc">
            Paths to audio files (relative to <code>public/</code>). Leave blank to play no sound.
          </p>
          <div className="form-row">
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              <FilePathInput
                label="On Hit Sound"
                value={item.sounds?.onHit || ""}
                onChange={(v) =>
                  update({ sounds: { ...item.sounds, onHit: v || undefined } })
                }
                placeholder="audio/hit.ogg"
                accept="audio/*"
                pathPrefix="audio"
              />
              <VolumeSlider
                label="Volume"
                value={item.sounds?.onHitVolume ?? 1}
                onChange={(v) =>
                  update({ sounds: { ...item.sounds, onHitVolume: v } })
                }
                disabled={!item.sounds?.onHit}
              />
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              <FilePathInput
                label="On Destroy Sound"
                value={item.sounds?.onDestroy || ""}
                onChange={(v) =>
                  update({ sounds: { ...item.sounds, onDestroy: v || undefined } })
                }
                placeholder="audio/destroy.ogg"
                accept="audio/*"
                pathPrefix="audio"
              />
              <VolumeSlider
                label="Volume"
                value={item.sounds?.onDestroyVolume ?? 1}
                onChange={(v) =>
                  update({ sounds: { ...item.sounds, onDestroyVolume: v } })
                }
                disabled={!item.sounds?.onDestroy}
              />
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              <FilePathInput
                label="On Ability Cast Sound"
                value={item.sounds?.onAbilityCast || ""}
                onChange={(v) =>
                  update({ sounds: { ...item.sounds, onAbilityCast: v || undefined } })
                }
                placeholder="audio/cast.ogg"
                accept="audio/*"
                pathPrefix="audio"
              />
              <VolumeSlider
                label="Volume"
                value={item.sounds?.onAbilityCastVolume ?? 1}
                onChange={(v) =>
                  update({ sounds: { ...item.sounds, onAbilityCastVolume: v } })
                }
                disabled={!item.sounds?.onAbilityCast}
              />
            </div>
          </div>
        </section>
      </CollapsibleEditorSection>
    </PageShell>
  );
}

interface OffersQuestPickerOption {
  id: string;
  label: string;
  meta?: string;
}

function OffersQuestPicker({
  value,
  options,
  onChange,
}: {
  value: string[];
  options: OffersQuestPickerOption[];
  onChange: (ids: string[]) => void;
}) {
  const available = options.filter((o) => !value.includes(o.id));
  return (
    <div className="form-field" style={{ marginTop: 4 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
        {value.length === 0 ? (
          <span style={{ opacity: 0.6, fontSize: 12 }}>(none)</span>
        ) : (
          value.map((id) => {
            const opt = options.find((o) => o.id === id);
            return (
              <span
                key={id}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "2px 8px",
                  background: "rgba(120, 140, 170, 0.22)",
                  border: "1px solid rgba(140, 160, 190, 0.4)",
                  borderRadius: 3,
                  fontSize: 12,
                }}
              >
                {opt?.label ?? id}
                <button
                  type="button"
                  onClick={() => onChange(value.filter((v) => v !== id))}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "inherit",
                    cursor: "pointer",
                    padding: 0,
                    fontSize: 14,
                    lineHeight: 1,
                  }}
                  aria-label={`Remove ${opt?.label ?? id}`}
                >
                  ×
                </button>
              </span>
            );
          })
        )}
      </div>
      <select
        className="input"
        value=""
        onChange={(e) => {
          if (e.target.value) onChange([...value, e.target.value]);
        }}
      >
        <option value="">Add quest offered...</option>
        {available.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
            {o.meta ? ` — ${o.meta}` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
