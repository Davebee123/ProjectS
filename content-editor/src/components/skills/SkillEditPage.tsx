import { useParams, useNavigate } from "react-router-dom";
import { PageShell } from "../layout/PageShell";
import { useInteractableStore } from "../../stores/interactableStore";
import { useItemStore } from "../../stores/itemStore";
import { useSkillStore } from "../../stores/skillStore";
import { useTagStore } from "../../stores/tagStore";
import { createDefaultStatusEffect, useStatusEffectStore } from "../../stores/statusEffectStore";
import { TagPicker } from "../shared/TagPicker";
import { ColorPicker } from "../shared/ColorPicker";
import { EntitySelect } from "../shared/EntitySelect";
import { ConditionEditor } from "../shared/ConditionEditor";
import { EditorUsagePanel } from "../shared/EditorUsagePanel";
import { FilePathInput } from "../shared/FilePathInput";
import { ReferencePicker } from "../shared/ReferencePicker";
import { VolumeSlider } from "../shared/VolumeSlider";
import { createUniqueId } from "../../utils/ids";
import { CollapsibleEditorSection } from "../shared/CollapsibleEditorSection";
import type { PerkMilestoneEffect } from "../../schema/types";

const MILESTONE_EFFECT_TYPES = [
  { value: "apply_status", label: "Apply Status Effect" },
  { value: "power_bonus", label: "Power Bonus (flat)" },
  { value: "power_multiplier", label: "Power Multiplier" },
  { value: "duration_multiplier", label: "Duration Multiplier" },
  { value: "energy_cost_modifier", label: "Energy Cost Modifier" },
] as const;

const COMBAT_SCHOOL_OPTIONS = [
  { value: "string", label: "String Combat" },
  { value: "entropy", label: "Entropy Combat" },
  { value: "genesis", label: "Genesis Combat" },
  { value: "chaos", label: "Chaos Combat" },
] as const;

const CAST_MODE_OPTIONS = [
  { value: "instant", label: "Instant" },
  { value: "cast", label: "Cast" },
  { value: "channel", label: "Channel" },
  { value: "passive", label: "Passive" },
] as const;

const TARGET_PATTERN_OPTIONS = [
  { value: "single", label: "Single Target" },
  { value: "self", label: "Self" },
  { value: "ground", label: "Ground Target" },
  { value: "cone", label: "Cone" },
  { value: "line", label: "Line" },
  { value: "aoe", label: "Area of Effect" },
  { value: "cleave", label: "Cleave" },
  { value: "chain", label: "Chain" },
  { value: "random_secondary", label: "Random Secondary" },
  { value: "zone", label: "Whole Zone" },
] as const;

const USAGE_CONTEXT_OPTIONS = [
  { value: "combat", label: "Combat Only" },
  { value: "non_combat", label: "Non-Combat Only" },
  { value: "both", label: "Combat + Non-Combat" },
] as const;

const EFFECT_TRIGGER_OPTIONS = [
  { value: "on_cast_start", label: "On Cast Start" },
  { value: "on_cast_complete", label: "On Cast Complete" },
  { value: "on_hit", label: "On Hit" },
  { value: "on_tick", label: "On Tick" },
  { value: "on_expire", label: "On Expire" },
  { value: "on_receive_hit", label: "On Receive Hit" },
  { value: "on_recast", label: "On Recast" },
  { value: "passive", label: "Passive" },
] as const;

const EFFECT_TARGET_OPTIONS = [
  { value: "self", label: "Self" },
  { value: "target", label: "Target" },
  { value: "secondary_targets", label: "Secondary Targets" },
  { value: "random_enemy", label: "Random Enemy" },
  { value: "all_enemies", label: "All Enemies" },
  { value: "zone", label: "Zone" },
  { value: "summon", label: "Summon" },
] as const;

const EFFECT_TYPE_OPTIONS = [
  { value: "damage", label: "Damage" },
  { value: "heal", label: "Heal" },
  { value: "apply_status", label: "Apply Status" },
  { value: "remove_status", label: "Remove Status" },
  { value: "modify_stat", label: "Modify Stat" },
  { value: "interrupt", label: "Interrupt" },
  { value: "change_weather", label: "Change Weather" },
  { value: "spawn_summon", label: "Spawn Summon" },
  { value: "show_emote", label: "Show Emote" },
  { value: "consume_resource", label: "Consume Resource" },
  { value: "grant_resource", label: "Grant Resource" },
  { value: "teleport", label: "Teleport" },
  { value: "reveal_info", label: "Reveal Info" },
  { value: "custom", label: "Custom" },
] as const;

export function SkillEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { interactables } = useInteractableStore();
  const { items } = useItemStore();
  const { skills, updateSkill } = useSkillStore();
  const { activityTags, abilityTags } = useTagStore();
  const { statusEffects, addStatusEffect } = useStatusEffectStore();
  const skill = skills.find((s) => s.id === id);

  if (!skill) {
    return (
      <PageShell title="Skill Not Found">
        <p>No skill with id "{id}".</p>
        <button className="btn" onClick={() => navigate("/skills")}>
          Back to Skills
        </button>
      </PageShell>
    );
  }

  const passiveSkills = skills.filter((s) => s.kind === "passive");
  const usageProfile = skill.usageProfile ?? {};
  const effects = skill.effects ?? [];
  const statusInteractions = skill.statusInteractions ?? [];
  const perkMilestones = skill.perkMilestones ?? [];
  const visibleActivityTagCount = skill.activityTags.filter((tagId) =>
    activityTags.some((tag) => tag.id === tagId)
  ).length;
  const hasPlayerTargetOverride = skill.playerTargetTags !== undefined;
  const visiblePlayerTargetTagCount = (skill.playerTargetTags ?? []).filter((tagId) =>
    activityTags.some((tag) => tag.id === tagId)
  ).length;
  const visibleAbilityTagCount = skill.abilityTags.filter((tagId) =>
    abilityTags.some((tag) => tag.id === tagId)
  ).length;
  const statusEffectOptions = statusEffects.map((effect) => ({
    id: effect.id,
    label: effect.name,
    meta: `${effect.folder || "status"} • ${effect.removalType}${effect.durationMs ? ` • ${(effect.durationMs / 1000).toFixed(1)}s` : ""}`,
    description: effect.description || undefined,
  }));

  const createAndLinkStatusEffect = (name: string) => {
    const id = createUniqueId(name, statusEffects.map((effect) => effect.id));
    addStatusEffect(createDefaultStatusEffect(id, name));
    return id;
  };

  const linkedActiveSkills = skills
    .filter((candidate) => candidate.id !== skill.id && candidate.linkedPassiveId === skill.id)
    .map((candidate) => ({
      id: candidate.id,
      label: candidate.name,
      to: `/skills/${candidate.id}`,
      meta: `${candidate.kind} / ${candidate.system || "gathering"}`,
    }));
  const xpRewardSources = interactables
    .filter((interactable) =>
      interactable.xpRewards.some((reward) => reward.skillId === skill.id)
    )
    .map((interactable) => ({
      id: interactable.id,
      label: interactable.name,
      to: `/interactables/${interactable.id}`,
      meta: "xp reward",
    }));
  const hostileAbilitySources = interactables
    .filter((interactable) =>
      interactable.abilities.some((ability) => ability.skillId === skill.id)
    )
    .map((interactable) => ({
      id: interactable.id,
      label: interactable.name,
      to: `/interactables/${interactable.id}`,
      meta: "ability user",
    }));
  const itemHookSources = items
    .filter((item) =>
      item.eventHooks.some((hook) =>
        hook.actions.some((action) => action.targetSkillId === skill.id)
      )
    )
    .map((item) => ({
      id: item.id,
      label: item.name,
      to: `/items/${item.id}`,
      meta: `${item.inventoryCategory || "misc"} / ${item.rarity || "common"}`,
    }));
  const statusHookSources = statusEffects
    .filter((effect) =>
      (effect.eventHooks ?? []).some((hook) =>
        hook.actions.some((action) => action.targetSkillId === skill.id)
      )
    )
    .map((effect) => ({
      id: effect.id,
      label: effect.name,
      to: `/status-effects/${effect.id}`,
      meta: effect.removalType,
    }));

  const updateUsageProfile = (patch: Partial<typeof usageProfile>) => {
    updateSkill(skill.id, {
      usageProfile: {
        ...usageProfile,
        ...patch,
      },
    });
  };

  const updateEffect = (
    effectId: string,
    patch: Partial<(typeof effects)[number]>
  ) => {
    updateSkill(skill.id, {
      effects: effects.map((effect) =>
        effect.id === effectId ? { ...effect, ...patch } : effect
      ),
    });
  };

  const addEffect = () => {
    updateSkill(skill.id, {
      effects: [
        ...effects,
        {
          id: `effect_${effects.length + 1}`,
          trigger: "on_cast_complete",
          target: "target",
          type: "custom",
        },
      ],
    });
  };

  const removeEffect = (effectId: string) => {
    updateSkill(skill.id, {
      effects: effects.filter((effect) => effect.id !== effectId),
    });
  };

  const updateStatusInteraction = (
    interactionId: string,
    patch: Partial<(typeof statusInteractions)[number]>
  ) => {
    updateSkill(skill.id, {
      statusInteractions: statusInteractions.map((interaction) =>
        interaction.id === interactionId ? { ...interaction, ...patch } : interaction
      ),
    });
  };

  const addStatusInteraction = () => {
    updateSkill(skill.id, {
      statusInteractions: [
        ...statusInteractions,
        {
          id: `interaction_${statusInteractions.length + 1}`,
          applyStatusTarget: "target",
          consumeStatusTarget: "target",
        },
      ],
    });
  };

  const removeStatusInteraction = (interactionId: string) => {
    updateSkill(skill.id, {
      statusInteractions: statusInteractions.filter((interaction) => interaction.id !== interactionId),
    });
  };

  const writePerkMilestones = (nextMilestones: typeof perkMilestones) => {
    updateSkill(skill.id, {
      perkMilestones: [...nextMilestones].sort((a, b) => a.level - b.level),
    });
  };

  const updatePerkMilestone = (
    index: number,
    patch: Partial<(typeof perkMilestones)[number]>
  ) => {
    writePerkMilestones(
      perkMilestones.map((milestone, milestoneIndex) =>
        milestoneIndex === index ? { ...milestone, ...patch } : milestone
      )
    );
  };

  const addPerkMilestone = () => {
    const nextLevel =
      perkMilestones.length > 0
        ? Math.max(...perkMilestones.map((milestone) => milestone.level)) + 5
        : 10;
    writePerkMilestones([
      ...perkMilestones,
      {
        level: nextLevel,
        description: "",
      },
    ]);
  };

  const removePerkMilestone = (index: number) => {
    writePerkMilestones(perkMilestones.filter((_, milestoneIndex) => milestoneIndex !== index));
  };

  return (
    <PageShell
      title={skill.name}
      actions={
        <button className="btn" onClick={() => navigate("/skills")}>
          Back to Skills
        </button>
      }
    >
      <EditorUsagePanel
        groups={[
          { label: "Interactable Abilities", items: hostileAbilitySources },
          { label: "Linked Active Skills", items: linkedActiveSkills },
          { label: "Interactable XP Rewards", items: xpRewardSources },
          { label: "Item Hooks", items: itemHookSources },
          { label: "Status Hooks", items: statusHookSources },
        ]}
      />

      <section className="editor-section">
        <h3 className="section-title">Basic Properties</h3>
        <div className="form-grid">
          <div className="form-field">
            <label className="field-label">ID</label>
            <input className="input" value={skill.id} disabled />
          </div>
          <div className="form-field">
            <label className="field-label">Name</label>
            <input
              className="input"
              value={skill.name}
              onChange={(e) => updateSkill(skill.id, { name: e.target.value })}
            />
          </div>
          <div className="form-field">
            <label className="field-label">Kind</label>
            <select
              className="input select"
              value={skill.kind}
              onChange={(e) =>
                updateSkill(skill.id, { kind: e.target.value as "passive" | "active" })
              }
            >
              <option value="passive">Passive</option>
              <option value="active">Active</option>
            </select>
          </div>
          <div className="form-field">
            <label className="field-label">System</label>
            <select
              className="input select"
              value={skill.system || "gathering"}
              onChange={(e) =>
                updateSkill(skill.id, {
                  system: e.target.value as "gathering" | "combat",
                })
              }
            >
              <option value="gathering">Gathering</option>
              <option value="combat">Combat</option>
            </select>
          </div>
          {skill.kind === "active" ? (
            <div className="form-field">
              <label className="field-label">Interactable Use</label>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  minHeight: 40,
                  color: "var(--text-primary)",
                  fontSize: 13,
                }}
              >
                <input
                  type="checkbox"
                  checked={Boolean(skill.usableByInteractables)}
                  onChange={(e) =>
                    updateSkill(skill.id, { usableByInteractables: e.target.checked || undefined })
                  }
                />
                Usable by interactables
              </label>
            </div>
          ) : null}
          <div className="form-field form-field--wide">
            <label className="field-label">Description</label>
            <input
              className="input"
              value={skill.description}
              onChange={(e) => updateSkill(skill.id, { description: e.target.value })}
              placeholder="Skill description..."
            />
          </div>
          <div className="form-field">
            <label className="field-label">Folder</label>
            <input
              className="input"
              value={skill.folder || ""}
              onChange={(e) => updateSkill(skill.id, { folder: e.target.value || undefined })}
              placeholder="e.g. Combat, Gathering..."
            />
          </div>
        </div>
      </section>

      <CollapsibleEditorSection
        title="Tags"
        summary={`${visibleActivityTagCount} activity • ${visibleAbilityTagCount} ability • player ${hasPlayerTargetOverride ? visiblePlayerTargetTagCount : "default"}`}
        defaultOpen={false}
      >
        <TagPicker
          label="Activity Tags"
          tags={activityTags}
          selected={skill.activityTags}
          onChange={(tags) => updateSkill(skill.id, { activityTags: tags })}
        />
        <div style={{ height: 12 }} />
        <TagPicker
          label="Ability Tags"
          tags={abilityTags}
          selected={skill.abilityTags}
          onChange={(tags) => updateSkill(skill.id, { abilityTags: tags })}
        />
        {skill.kind === "active" ? (
          <>
            <div style={{ height: 12 }} />
            <label className="checkbox" style={{ marginBottom: 8 }}>
              <input
                type="checkbox"
                checked={hasPlayerTargetOverride}
                onChange={(e) =>
                  updateSkill(skill.id, {
                    playerTargetTags: e.target.checked ? [] : undefined,
                  })
                }
              />
              Override player-selected target tags
            </label>
            <p className="section-desc" style={{ marginBottom: hasPlayerTargetOverride ? 12 : 0 }}>
              When disabled, player targeting uses Activity Tags. Interactable AI always uses Activity Tags.
            </p>
            {hasPlayerTargetOverride ? (
              <TagPicker
                label="Player Target Tags"
                tags={activityTags}
                selected={skill.playerTargetTags ?? []}
                onChange={(tags) => updateSkill(skill.id, { playerTargetTags: tags })}
              />
            ) : null}
          </>
        ) : null}
      </CollapsibleEditorSection>

      {skill.kind === "active" && (
        <CollapsibleEditorSection
          title="Active Skill Settings"
          summary={`${Math.round(skill.baseDurationMs / 100) / 10}s • ${skill.baseEnergyCost} energy${skill.system === "combat" ? ` • ${skill.baseManaCost ?? 0} mana` : ""}`}
          defaultOpen
        >
          <div className="form-grid">
            {skill.system !== "combat" ? (
              <div className="form-field">
                <EntitySelect
                  label="Linked Passive"
                  entities={passiveSkills.map((s) => ({ id: s.id, name: s.name }))}
                  value={skill.linkedPassiveId || ""}
                  onChange={(v) => updateSkill(skill.id, { linkedPassiveId: v || undefined })}
                  placeholder="No linked passive"
                />
              </div>
            ) : null}
            <div className="form-field">
              <label className="field-label">Cast Duration (ms)</label>
              <input
                type="number"
                className="input"
                value={skill.baseDurationMs}
                onChange={(e) =>
                  updateSkill(skill.id, { baseDurationMs: Number(e.target.value) })
                }
              />
            </div>
            <div className="form-field">
              <label className="field-label">Energy Cost</label>
              <input
                type="number"
                className="input"
                value={skill.baseEnergyCost}
                onChange={(e) =>
                  updateSkill(skill.id, { baseEnergyCost: Number(e.target.value) })
                }
              />
            </div>
            {skill.system === "combat" ? (
              <div className="form-field">
                <label className="field-label">Mana Cost</label>
                <input
                  type="number"
                  className="input"
                  value={skill.baseManaCost ?? 0}
                  onChange={(e) =>
                    updateSkill(skill.id, { baseManaCost: Number(e.target.value) || 0 })
                  }
                />
              </div>
            ) : null}
            <div className="form-field">
              <label className="field-label">Base Power (Min)</label>
              <input
                type="number"
                className="input"
                value={skill.basePower}
                onChange={(e) =>
                  updateSkill(skill.id, { basePower: Number(e.target.value) })
                }
              />
            </div>
            <div className="form-field">
              <label className="field-label">Base Power (Max)</label>
              <input
                type="number"
                className="input"
                value={skill.basePowerMax ?? skill.basePower}
                onChange={(e) =>
                  updateSkill(skill.id, { basePowerMax: Number(e.target.value) })
                }
              />
            </div>
            <div className="form-field">
              <label className="field-label">Power per Level (Min)</label>
              <input
                type="number"
                className="input"
                value={skill.powerPerLevel}
                onChange={(e) =>
                  updateSkill(skill.id, { powerPerLevel: Number(e.target.value) })
                }
              />
            </div>
            <div className="form-field">
              <label className="field-label">Power per Level (Max)</label>
              <input
                type="number"
                className="input"
                value={skill.powerPerLevelMax ?? skill.powerPerLevel}
                onChange={(e) =>
                  updateSkill(skill.id, { powerPerLevelMax: Number(e.target.value) })
                }
              />
            </div>
          </div>
        </CollapsibleEditorSection>
      )}

      {skill.kind === "active" && skill.system === "combat" ? (
        <CollapsibleEditorSection
          title="Bioboard Display"
          summary={`${skill.combatSchool || "no school"}${skill.bioboardSubcategory ? ` • ${skill.bioboardSubcategory}` : ""}`}
          defaultOpen={false}
        >
          <div className="form-grid">
            <div className="form-field">
              <label className="field-label">Combat School</label>
              <select
                className="input select"
                value={skill.combatSchool || ""}
                onChange={(e) =>
                  updateSkill(skill.id, {
                    combatSchool: (e.target.value || undefined) as typeof skill.combatSchool,
                  })
                }
              >
                <option value="">(select school)</option>
                {COMBAT_SCHOOL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field form-field--wide">
              <FilePathInput
                label="Image"
                value={skill.image || ""}
                onChange={(value) => updateSkill(skill.id, { image: value || undefined })}
                placeholder="icons/abilities/telekinetic-slam.png"
                accept="image/*"
                pathPrefix="icons"
              />
            </div>
            <div className="form-field form-field--wide">
              <label className="field-label">Subcategory</label>
              <input
                className="input"
                value={skill.bioboardSubcategory || ""}
                onChange={(e) => updateSkill(skill.id, { bioboardSubcategory: e.target.value || undefined })}
                placeholder="e.g. Gravity Manipulation"
              />
            </div>
            <div className="form-field form-field--wide">
              <label className="field-label">Primary Text</label>
              <input
                className="input"
                value={skill.bioboardPrimaryText || ""}
                onChange={(e) => updateSkill(skill.id, { bioboardPrimaryText: e.target.value || undefined })}
                placeholder="Deals 30-50 String Damage"
              />
            </div>
            <div className="form-field form-field--wide">
              <label className="field-label">Secondary Text</label>
              <input
                className="input"
                value={skill.bioboardSecondaryText || ""}
                onChange={(e) => updateSkill(skill.id, { bioboardSecondaryText: e.target.value || undefined })}
                placeholder="If the target is suspended, it deals 200% more damage."
              />
            </div>
          </div>
        </CollapsibleEditorSection>
      ) : null}

      {skill.kind === "active" ? (
        <CollapsibleEditorSection
          title="Ability Profile"
          summary={`${usageProfile.castMode || "default cast"}${usageProfile.targetPattern ? ` • ${usageProfile.targetPattern}` : ""}${usageProfile.hitCount ? ` • ${usageProfile.hitCount} hit(s)` : ""}`}
          defaultOpen={false}
        >
          <p className="section-desc">
            Design-time authoring fields for cast style, targeting, hit count, and weapon or summon requirements.
          </p>
          <div className="form-grid">
            <div className="form-field">
              <label className="field-label">Cast Mode</label>
              <select
                className="input select"
                value={usageProfile.castMode || ""}
                onChange={(e) =>
                  updateUsageProfile({
                    castMode: (e.target.value || undefined) as typeof usageProfile.castMode,
                  })
                }
              >
                <option value="">(none)</option>
                {CAST_MODE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label className="field-label">Target Pattern</label>
              <select
                className="input select"
                value={usageProfile.targetPattern || ""}
                onChange={(e) =>
                  updateUsageProfile({
                    targetPattern: (e.target.value || undefined) as typeof usageProfile.targetPattern,
                  })
                }
              >
                <option value="">(none)</option>
                {TARGET_PATTERN_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label className="field-label">Usage Context</label>
              <select
                className="input select"
                value={usageProfile.usageContext || ""}
                onChange={(e) =>
                  updateUsageProfile({
                    usageContext: (e.target.value || undefined) as typeof usageProfile.usageContext,
                  })
                }
              >
                <option value="">(none)</option>
                {USAGE_CONTEXT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label className="field-label">Weapon Requirement</label>
              <input
                className="input"
                value={usageProfile.weaponRequirement || ""}
                onChange={(e) => updateUsageProfile({ weaponRequirement: e.target.value || undefined })}
                placeholder="e.g. Mace, Long Rifle, Shield"
              />
            </div>
            <div className="form-field">
              <label className="field-label">Hit Count</label>
              <input
                type="number"
                className="input"
                value={usageProfile.hitCount ?? ""}
                onChange={(e) =>
                  updateUsageProfile({
                    hitCount: e.target.value === "" ? undefined : Number(e.target.value),
                  })
                }
              />
            </div>
            <div className="form-field">
              <label className="field-label">Cast Tick Interval (ms)</label>
              <input
                type="number"
                className="input"
                value={usageProfile.castTickIntervalMs ?? ""}
                onChange={(e) =>
                  updateUsageProfile({
                    castTickIntervalMs: e.target.value === "" ? undefined : Number(e.target.value),
                  })
                }
              />
            </div>
            <div className="form-field">
              <label className="field-label">Max Targets</label>
              <input
                type="number"
                className="input"
                value={usageProfile.maxTargets ?? ""}
                onChange={(e) =>
                  updateUsageProfile({
                    maxTargets: e.target.value === "" ? undefined : Number(e.target.value),
                  })
                }
              />
            </div>
            <div className="form-field">
              <label className="field-label">Summon Slot Cost</label>
              <input
                type="number"
                className="input"
                value={usageProfile.summonSlotCost ?? ""}
                onChange={(e) =>
                  updateUsageProfile({
                    summonSlotCost: e.target.value === "" ? undefined : Number(e.target.value),
                  })
                }
              />
            </div>
            <div className="form-field">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={usageProfile.interruptible ?? false}
                  onChange={(e) => updateUsageProfile({ interruptible: e.target.checked || undefined })}
                />
                Interruptible
              </label>
            </div>
            <div className="form-field form-field--wide">
              <label className="field-label">Range / Positioning Notes</label>
              <input
                className="input"
                value={usageProfile.rangeNotes || ""}
                onChange={(e) => updateUsageProfile({ rangeNotes: e.target.value || undefined })}
                placeholder="e.g. Teleport to selected area in a non-cardinal direction"
              />
            </div>
            <div className="form-field form-field--wide">
              <p className="section-desc" style={{ marginBottom: 0 }}>
                Use a cast tick interval to fire pulses during the cast. If this is empty, the runtime can still fall
                back to evenly spaced ticks from <code>On Tick</code> effects that define a hit count.
              </p>
            </div>
          </div>
        </CollapsibleEditorSection>
      ) : null}

      {skill.kind === "active" ? (
        <CollapsibleEditorSection
          title="Ability Effects"
          summary={`${effects.length} effect${effects.length === 1 ? "" : "s"}`}
          defaultOpen={effects.length === 0}
        >
          <div className="section-header-row">
            <h3 className="section-title">Ability Effects</h3>
            <button className="btn btn--sm" onClick={addEffect}>
              Add Effect
            </button>
          </div>
          <p className="section-desc">
            Author trigger-based design effects like damage packets, weather changes, summons, interrupts, ammo use, and freeform ability text.
          </p>
          {effects.length === 0 ? (
            <p className="section-desc">No ability effects configured.</p>
          ) : (
            <div className="stack-lg">
              {effects.map((effect, index) => (
                <div key={effect.id} className="editor-section" style={{ marginBottom: 12 }}>
                  <div className="section-header-row">
                    <h4 className="section-title" style={{ marginBottom: 0 }}>
                      Effect {index + 1}
                    </h4>
                    <button
                      className="btn btn--danger btn--sm"
                      onClick={() => removeEffect(effect.id)}
                    >
                      Remove
                    </button>
                  </div>
                  <div className="form-grid">
                    <div className="form-field">
                      <label className="field-label">ID</label>
                      <input
                        className="input"
                        value={effect.id}
                        onChange={(e) => updateEffect(effect.id, { id: e.target.value })}
                      />
                    </div>
                    <div className="form-field">
                      <label className="field-label">Trigger</label>
                      <select
                        className="input select"
                        value={effect.trigger}
                        onChange={(e) =>
                          updateEffect(effect.id, {
                            trigger: e.target.value as typeof effect.trigger,
                          })
                        }
                      >
                        {EFFECT_TRIGGER_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-field">
                      <label className="field-label">Target</label>
                      <select
                        className="input select"
                        value={effect.target}
                        onChange={(e) =>
                          updateEffect(effect.id, {
                            target: e.target.value as typeof effect.target,
                          })
                        }
                      >
                        {EFFECT_TARGET_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-field">
                      <label className="field-label">Effect Type</label>
                      <select
                        className="input select"
                        value={effect.type}
                        onChange={(e) =>
                          updateEffect(effect.id, {
                            type: e.target.value as typeof effect.type,
                          })
                        }
                      >
                        {EFFECT_TYPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-field">
                      <label className="field-label">Value</label>
                      <input
                        type="number"
                        className="input"
                        value={effect.value ?? ""}
                        onChange={(e) =>
                          updateEffect(effect.id, {
                            value: e.target.value === "" ? undefined : Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="form-field">
                      <label className="field-label">Duration (ms)</label>
                      <input
                        type="number"
                        className="input"
                        value={effect.durationMs ?? ""}
                        onChange={(e) =>
                          updateEffect(effect.id, {
                            durationMs: e.target.value === "" ? undefined : Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    {effect.type === "show_emote" ? (
                      <div className="form-field">
                        <label className="field-label">Emote Chance %</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          className="input"
                          value={effect.emoteChance ?? 100}
                          onChange={(e) =>
                            updateEffect(effect.id, {
                              emoteChance: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                            })
                          }
                        />
                      </div>
                    ) : null}
                    <div className="form-field">
                      <label className="field-label">Hit Count</label>
                      <input
                        type="number"
                        className="input"
                        value={effect.hitCount ?? ""}
                        onChange={(e) =>
                          updateEffect(effect.id, {
                            hitCount: e.target.value === "" ? undefined : Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="form-field">
                      <label className="field-label">Max Targets</label>
                      <input
                        type="number"
                        className="input"
                        value={effect.maxTargets ?? ""}
                        onChange={(e) =>
                          updateEffect(effect.id, {
                            maxTargets: e.target.value === "" ? undefined : Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="form-field">
                      <ReferencePicker
                        label="Status Effect"
                        value={effect.statusEffectId || ""}
                        options={statusEffectOptions}
                        onChange={(value) => updateEffect(effect.id, { statusEffectId: value || undefined })}
                        placeholder="None"
                        showSelectedPreview={false}
                        onOpenSelected={(value) => navigate(`/status-effects/${value}`)}
                        onCreate={createAndLinkStatusEffect}
                        createPlaceholder="New status effect name..."
                      />
                    </div>
                    <div className="form-field">
                      <label className="field-label">Weather ID</label>
                      <input
                        className="input"
                        value={effect.weatherId || ""}
                        onChange={(e) => updateEffect(effect.id, { weatherId: e.target.value || undefined })}
                        placeholder="e.g. Thundercloud, Sandstorm"
                      />
                    </div>
                    <div className="form-field">
                      <label className="field-label">Resource Label</label>
                      <input
                        className="input"
                        value={effect.resourceLabel || ""}
                        onChange={(e) => updateEffect(effect.id, { resourceLabel: e.target.value || undefined })}
                        placeholder="e.g. Ammo, Favor, Charges"
                      />
                    </div>
                    <div className="form-field">
                      <label className="field-label">Resource Amount</label>
                      <input
                        type="number"
                        className="input"
                        value={effect.resourceAmount ?? ""}
                        onChange={(e) =>
                          updateEffect(effect.id, {
                            resourceAmount: e.target.value === "" ? undefined : Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="form-field">
                      <label className="field-label">Stat Name</label>
                      <input
                        className="input"
                        value={effect.statName || ""}
                        onChange={(e) => updateEffect(effect.id, { statName: e.target.value || undefined })}
                        placeholder="e.g. cast_speed, damage_taken"
                      />
                    </div>
                    <div className="form-field form-field--wide">
                      <label className="field-label">Custom / Freeform Text</label>
                      <input
                        className="input"
                        value={effect.customText || ""}
                        onChange={(e) => updateEffect(effect.id, { customText: e.target.value || undefined })}
                        placeholder={effect.type === "show_emote" ? "Text to show in the emote bubble..." : "Describe the effect if it does not fit a strict numeric model"}
                      />
                    </div>
                  </div>
                  <ConditionEditor
                    value={effect.condition || ""}
                    onChange={(value) => updateEffect(effect.id, { condition: value || undefined })}
                    placeholder='e.g. target.has_effect("suspended")'
                  />
                </div>
              ))}
            </div>
          )}
        </CollapsibleEditorSection>
      ) : null}

      {skill.kind === "active" ? (
        <CollapsibleEditorSection
          title="Status Interactions"
          summary={`${statusInteractions.length} interaction${statusInteractions.length === 1 ? "" : "s"}`}
          defaultOpen={false}
        >
          <div className="section-header-row">
            <h3 className="section-title">Status Interactions</h3>
            <button className="btn btn--sm" onClick={addStatusInteraction}>
              Add Interaction
            </button>
          </div>
          <p className="section-desc">
            Configure rules like <code>target.has_effect("suspended")</code> to modify this ability,
            consume target effects, or apply new status effects.
          </p>
          {statusInteractions.length === 0 ? (
            <p className="section-desc">No status interactions configured.</p>
          ) : (
            <div className="stack-lg">
              {statusInteractions.map((interaction, index) => (
                <div key={interaction.id} className="editor-section" style={{ marginBottom: 12 }}>
                  <div className="section-header-row">
                    <h4 className="section-title" style={{ marginBottom: 0 }}>
                      Interaction {index + 1}
                    </h4>
                    <button
                      className="btn btn--danger btn--sm"
                      onClick={() => removeStatusInteraction(interaction.id)}
                    >
                      Remove
                    </button>
                  </div>
                  <div className="form-grid">
                    <div className="form-field">
                      <label className="field-label">ID</label>
                      <input
                        className="input"
                        value={interaction.id}
                        onChange={(e) => updateStatusInteraction(interaction.id, { id: e.target.value })}
                      />
                    </div>
                    <div className="form-field form-field--wide">
                      <label className="field-label">Note</label>
                      <input
                        className="input"
                        value={interaction.note || ""}
                        onChange={(e) => updateStatusInteraction(interaction.id, { note: e.target.value || undefined })}
                        placeholder="Optional author note for the effect rule"
                      />
                    </div>
                  </div>
                  <ConditionEditor
                    value={interaction.condition || ""}
                    onChange={(value) => updateStatusInteraction(interaction.id, { condition: value || undefined })}
                    placeholder='e.g. target.has_effect("suspended")'
                  />
                  <div style={{ height: 12 }} />
                  <div className="form-grid">
                    <div className="form-field">
                      <ReferencePicker
                        label="Consume Status"
                        value={interaction.consumeStatusEffectId || ""}
                        options={statusEffectOptions}
                        onChange={(value) =>
                          updateStatusInteraction(interaction.id, { consumeStatusEffectId: value || undefined })
                        }
                        placeholder="None"
                        showSelectedPreview={false}
                        onOpenSelected={(value) => navigate(`/status-effects/${value}`)}
                        onCreate={createAndLinkStatusEffect}
                        createPlaceholder="New status effect name..."
                      />
                    </div>
                    <div className="form-field">
                      <label className="field-label">Consume From</label>
                      <select
                        className="input select"
                        value={interaction.consumeStatusTarget || "target"}
                        onChange={(e) =>
                          updateStatusInteraction(interaction.id, {
                            consumeStatusTarget: e.target.value as "self" | "target",
                          })
                        }
                      >
                        <option value="target">Target</option>
                        <option value="self">Self</option>
                      </select>
                    </div>
                    <div className="form-field">
                      <ReferencePicker
                        label="Apply Status"
                        value={interaction.applyStatusEffectId || ""}
                        options={statusEffectOptions}
                        onChange={(value) =>
                          updateStatusInteraction(interaction.id, { applyStatusEffectId: value || undefined })
                        }
                        placeholder="None"
                        showSelectedPreview={false}
                        onOpenSelected={(value) => navigate(`/status-effects/${value}`)}
                        onCreate={createAndLinkStatusEffect}
                        createPlaceholder="New status effect name..."
                      />
                    </div>
                    <div className="form-field">
                      <label className="field-label">Apply To</label>
                      <select
                        className="input select"
                        value={interaction.applyStatusTarget || "target"}
                        onChange={(e) =>
                          updateStatusInteraction(interaction.id, {
                            applyStatusTarget: e.target.value as "self" | "target",
                          })
                        }
                      >
                        <option value="target">Target</option>
                        <option value="self">Self</option>
                      </select>
                    </div>
                    <div className="form-field">
                      <label className="field-label">Power Multiplier</label>
                      <input
                        type="number"
                        step="0.1"
                        className="input"
                        value={interaction.powerMultiplier ?? ""}
                        onChange={(e) =>
                          updateStatusInteraction(interaction.id, {
                            powerMultiplier: e.target.value === "" ? undefined : Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="form-field">
                      <label className="field-label">Power Bonus</label>
                      <input
                        type="number"
                        className="input"
                        value={interaction.powerBonus ?? ""}
                        onChange={(e) =>
                          updateStatusInteraction(interaction.id, {
                            powerBonus: e.target.value === "" ? undefined : Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="form-field">
                      <label className="field-label">Cast Time Multiplier</label>
                      <input
                        type="number"
                        step="0.1"
                        className="input"
                        value={interaction.durationMultiplier ?? ""}
                        onChange={(e) =>
                          updateStatusInteraction(interaction.id, {
                            durationMultiplier: e.target.value === "" ? undefined : Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="form-field">
                      <label className="field-label">Cast Time Bonus (ms)</label>
                      <input
                        type="number"
                        className="input"
                        value={interaction.durationBonusMs ?? ""}
                        onChange={(e) =>
                          updateStatusInteraction(interaction.id, {
                            durationBonusMs: e.target.value === "" ? undefined : Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="form-field">
                      <label className="field-label">Energy Multiplier</label>
                      <input
                        type="number"
                        step="0.1"
                        className="input"
                        value={interaction.energyMultiplier ?? ""}
                        onChange={(e) =>
                          updateStatusInteraction(interaction.id, {
                            energyMultiplier: e.target.value === "" ? undefined : Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="form-field">
                      <label className="field-label">Energy Bonus</label>
                      <input
                        type="number"
                        className="input"
                        value={interaction.energyBonus ?? ""}
                        onChange={(e) =>
                          updateStatusInteraction(interaction.id, {
                            energyBonus: e.target.value === "" ? undefined : Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CollapsibleEditorSection>
      ) : null}

      <CollapsibleEditorSection
        title="XP Curve"
        summary={`${skill.baseXpToNext} base • ${skill.xpScaling} scaling`}
        defaultOpen={false}
      >
        <div className="form-grid">
          <div className="form-field">
            <label className="field-label">Base XP to Next Level</label>
            <input
              type="number"
              className="input"
              value={skill.baseXpToNext}
              onChange={(e) =>
                updateSkill(skill.id, { baseXpToNext: Number(e.target.value) })
              }
            />
          </div>
          <div className="form-field">
            <label className="field-label">XP Scaling (per level)</label>
            <input
              type="number"
              className="input"
              step="0.01"
              value={skill.xpScaling}
              onChange={(e) =>
                updateSkill(skill.id, { xpScaling: Number(e.target.value) })
              }
            />
          </div>
        </div>
      </CollapsibleEditorSection>

      <CollapsibleEditorSection
        title="Perk Milestones"
        summary={`${perkMilestones.length} milestone${perkMilestones.length === 1 ? "" : "s"}`}
        defaultOpen={perkMilestones.length > 0}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <h3 className="section-title" style={{ marginBottom: 6 }}>Perk Milestones</h3>
            <p className="section-desc">
              Milestones unlock when the skill reaches the authored level and show in the level-hover tooltip on the skill bar.
            </p>
          </div>
          <button type="button" className="btn" onClick={addPerkMilestone}>
            Add Milestone
          </button>
        </div>

        {perkMilestones.length === 0 ? (
          <p className="empty-text">No perk milestones authored.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {perkMilestones.map((milestone, index) => {
              const effects = milestone.effects ?? [];
              const updateEffects = (nextEffects: PerkMilestoneEffect[]) => {
                updatePerkMilestone(index, { effects: nextEffects });
              };
              const addEffect = (type: PerkMilestoneEffect["type"]) => {
                const newEffect: PerkMilestoneEffect =
                  type === "apply_status"
                    ? { type: "apply_status", statusEffectId: "", chance: 100 }
                    : type === "power_bonus"
                      ? { type: "power_bonus", value: 0 }
                      : type === "power_multiplier"
                        ? { type: "power_multiplier", value: 1.0 }
                        : type === "duration_multiplier"
                          ? { type: "duration_multiplier", value: 1.0 }
                          : { type: "energy_cost_modifier", value: 0 };
                updateEffects([...effects, newEffect]);
              };
              const updateEffect = (ei: number, patch: Partial<PerkMilestoneEffect>) => {
                updateEffects(effects.map((eff, i) => (i === ei ? { ...eff, ...patch } as PerkMilestoneEffect : eff)));
              };
              const removeEffect = (ei: number) => {
                updateEffects(effects.filter((_, i) => i !== ei));
              };

              return (
                <div key={`${skill.id}_perk_${index}`} className="action-editor-card">
                  <div className="form-grid">
                    <div className="form-field">
                      <label className="field-label">Level</label>
                      <input
                        type="number"
                        min={1}
                        className="input"
                        value={milestone.level}
                        onChange={(e) =>
                          updatePerkMilestone(index, {
                            level: Math.max(1, Number(e.target.value) || 1),
                          })
                        }
                      />
                    </div>
                    <div className="form-field form-field--wide">
                      <label className="field-label">Description</label>
                      <textarea
                        className="input"
                        rows={2}
                        value={milestone.description}
                        onChange={(e) =>
                          updatePerkMilestone(index, { description: e.target.value })
                        }
                        placeholder="Describe what this skill gains at this milestone..."
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <label className="field-label" style={{ margin: 0 }}>Effects</label>
                      <select
                        className="input"
                        style={{ width: "auto" }}
                        value=""
                        onChange={(e) => {
                          if (e.target.value) addEffect(e.target.value as PerkMilestoneEffect["type"]);
                        }}
                      >
                        <option value="">+ Add Effect...</option>
                        {MILESTONE_EFFECT_TYPES.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>

                    {effects.length === 0 ? (
                      <p className="empty-text" style={{ fontSize: 12 }}>No effects — this milestone is cosmetic only.</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {effects.map((eff, ei) => (
                          <div key={`${index}_eff_${ei}`} style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 8px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", minWidth: 100 }}>
                              {MILESTONE_EFFECT_TYPES.find((t) => t.value === eff.type)?.label}
                            </span>

                            {eff.type === "apply_status" ? (
                              <>
                                <select
                                  className="input"
                                  style={{ flex: 1 }}
                                  value={eff.statusEffectId}
                                  onChange={(e) => updateEffect(ei, { statusEffectId: e.target.value })}
                                >
                                  <option value="">Select status effect...</option>
                                  {statusEffects.map((se) => (
                                    <option key={se.id} value={se.id}>{se.name}</option>
                                  ))}
                                </select>
                                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                  <label style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Chance%</label>
                                  <input
                                    type="number"
                                    className="input"
                                    style={{ width: 60 }}
                                    min={1}
                                    max={100}
                                    value={eff.chance ?? 100}
                                    onChange={(e) => updateEffect(ei, { chance: Math.max(1, Math.min(100, Number(e.target.value) || 100)) })}
                                  />
                                </div>
                              </>
                            ) : (
                              <input
                                type="number"
                                className="input"
                                style={{ width: 80 }}
                                step={eff.type === "power_multiplier" || eff.type === "duration_multiplier" ? 0.05 : 1}
                                value={eff.value}
                                onChange={(e) => updateEffect(ei, { value: Number(e.target.value) })}
                              />
                            )}

                            <button
                              type="button"
                              className="btn"
                              style={{ padding: "2px 8px", fontSize: 11 }}
                              onClick={() => removeEffect(ei)}
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => removePerkMilestone(index)}
                    >
                      Remove Milestone
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CollapsibleEditorSection>

      <CollapsibleEditorSection
        title="Appearance"
        summary="Colors"
        defaultOpen={false}
      >
        <div className="form-grid">
          <div className="form-field">
            <ColorPicker
              label="Bar Color"
              value={skill.barColor}
              onChange={(v) => updateSkill(skill.id, { barColor: v })}
            />
          </div>
          <div className="form-field">
            <ColorPicker
              label="Accent Color"
              value={skill.accentColor}
              onChange={(v) => updateSkill(skill.id, { accentColor: v })}
            />
          </div>
        </div>
      </CollapsibleEditorSection>

      <CollapsibleEditorSection
        title="Sound Effects"
        summary={`${[
          skill.castSound ? "cast" : "",
          skill.tickSound ? "tick" : "",
          skill.hitSound ? "hit" : "",
        ].filter(Boolean).join(" • ") || "none"}`}
        defaultOpen={false}
      >
        <p className="section-desc">
          Paths to audio files (relative to <code>public/</code>). Leave blank to play no sound.
        </p>
        <div className="form-row">
            <FilePathInput
              label="Cast Sound"
              value={skill.castSound || ""}
              onChange={(v) => updateSkill(skill.id, { castSound: v || undefined })}
              placeholder="Sound Files/RustlingSkill.mp3"
              accept="audio/*"
              pathPrefix="Sound Files"
            />
            <VolumeSlider
              label="Cast Volume"
              value={skill.castSoundVolume ?? 1}
              disabled={!skill.castSound}
              onChange={(value) => updateSkill(skill.id, { castSoundVolume: value })}
            />
        </div>
        <div className="form-row">
            <FilePathInput
              label="Tick Sound"
              value={skill.tickSound || ""}
              onChange={(v) => updateSkill(skill.id, { tickSound: v || undefined })}
              placeholder="Sound Files/tick.ogg"
              accept="audio/*"
              pathPrefix="Sound Files"
            />
            <VolumeSlider
              label="Tick Volume"
              value={skill.tickSoundVolume ?? 1}
              disabled={!skill.tickSound}
              onChange={(value) => updateSkill(skill.id, { tickSoundVolume: value })}
            />
        </div>
        <div className="form-row">
            <FilePathInput
              label="Hit Sound"
              value={skill.hitSound || ""}
              onChange={(v) => updateSkill(skill.id, { hitSound: v || undefined })}
              placeholder="Sound Files/hit.ogg"
              accept="audio/*"
              pathPrefix="Sound Files"
            />
            <VolumeSlider
              label="Hit Volume"
              value={skill.hitSoundVolume ?? 1}
              disabled={!skill.hitSound}
              onChange={(value) => updateSkill(skill.id, { hitSoundVolume: value })}
            />
        </div>
        <div className="form-row">
          <label className="field">
            <span className="field-label">Play Cast Sound on Complete</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={!!skill.castSoundOnComplete}
                onChange={(e) =>
                  updateSkill(skill.id, { castSoundOnComplete: e.target.checked || undefined })
                }
              />
              <span style={{ fontSize: "0.85rem", color: "var(--text-soft)" }}>
                If checked, cast sound plays when the cast finishes (useful for self-buffs).
              </span>
            </div>
          </label>
          <label className="field">
            <span className="field-label">Disable Auto-cast</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={!!skill.disableAutoCast}
                onChange={(e) =>
                  updateSkill(skill.id, { disableAutoCast: e.target.checked || undefined })
                }
              />
              <span style={{ fontSize: "0.85rem", color: "var(--text-soft)" }}>
                Skill fires single casts only; never toggles into auto-cast loop.
              </span>
            </div>
          </label>
        </div>
      </CollapsibleEditorSection>

      <CollapsibleEditorSection
        title="Unlock Condition"
        summary={skill.unlockCondition ? "configured" : "always unlocked"}
        defaultOpen={false}
      >
        <p className="section-desc">
          DSL expression that must be true for this skill to unlock. Leave empty for always
          unlocked.
        </p>
        <ConditionEditor
          value={skill.unlockCondition || ""}
          onChange={(v) =>
            updateSkill(skill.id, { unlockCondition: v || undefined })
          }
          placeholder='e.g. skill("treecutting").level >= 3'
        />
      </CollapsibleEditorSection>
    </PageShell>
  );
}
