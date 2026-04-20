import { parse } from "../dsl/parser.js";
import type { GameContentBundle } from "./types.js";

const VALID_ITEM_RARITIES = new Set(["common", "uncommon", "rare", "epic"]);
const VALID_INVENTORY_CATEGORIES = new Set([
  "weapons",
  "armor",
  "consumables",
  "fey_runes",
  "materials",
  "quest_items",
  "misc",
]);
const VALID_COMBAT_SCHOOLS = new Set(["string", "entropy", "genesis", "chaos"]);
const MAX_ROOM_DESCRIPTION_CHARS = 500;

export interface ValidationIssue {
  severity: "error" | "warning";
  message: string;
}

function checkDupes(list: { id: string }[], label: string, issues: ValidationIssue[]): void {
  const ids = new Set<string>();
  for (const item of list) {
    if (ids.has(item.id)) {
      issues.push({ severity: "error", message: `Duplicate ${label} ID: "${item.id}"` });
    }
    ids.add(item.id);
  }
}

function validateCondition(source: unknown, label: string, issues: ValidationIssue[]): void {
  if (source === undefined || source === null || source === "") {
    return;
  }

  if (typeof source !== "string") {
    issues.push({
      severity: "error",
      message: `${label} has invalid condition: expected a string`,
    });
    return;
  }

  try {
    const result = parse(source);
    if (result.errors.length > 0) {
      issues.push({
        severity: "error",
        message: `${label} has invalid condition: ${result.errors[0].message}`,
      });
    }
  } catch (error) {
    issues.push({
      severity: "error",
      message: `${label} has invalid condition: ${error instanceof Error ? error.message : "parser failure"}`,
    });
  }
}

function validateEventAction(
  action: {
    condition?: string;
    statusEffectId?: string;
    targetSkillId?: string;
    storageKeyId?: string;
    itemId?: string;
    interactableId?: string;
    questId?: string;
    roomId?: string;
    cutsceneId?: string;
  },
  label: string,
  refs: {
      effectIds: Set<string>;
      skillIds: Set<string>;
      storageKeyIds: Set<string>;
      itemIds: Set<string>;
      interactableIds: Set<string>;
      questIds: Set<string>;
      roomIds: Set<string>;
      cutsceneIds: Set<string>;
  },
  issues: ValidationIssue[]
): void {
  validateCondition(action.condition, `${label} action`, issues);
  if (action.statusEffectId && !refs.effectIds.has(action.statusEffectId)) {
    issues.push({
      severity: "error",
      message: `${label} references unknown status effect "${action.statusEffectId}"`,
    });
  }
  if (action.targetSkillId && !refs.skillIds.has(action.targetSkillId)) {
    issues.push({
      severity: "error",
      message: `${label} references unknown skill "${action.targetSkillId}"`,
    });
  }
  if (action.storageKeyId && !refs.storageKeyIds.has(action.storageKeyId)) {
    issues.push({
      severity: "error",
      message: `${label} references unknown storage key "${action.storageKeyId}"`,
    });
  }
  if (action.itemId && !refs.itemIds.has(action.itemId)) {
    issues.push({
      severity: "error",
      message: `${label} references unknown item "${action.itemId}"`,
    });
  }
  if (action.interactableId && !refs.interactableIds.has(action.interactableId)) {
    issues.push({
      severity: "error",
      message: `${label} references unknown interactable "${action.interactableId}"`,
    });
  }
  if (action.questId && !refs.questIds.has(action.questId)) {
    issues.push({
      severity: "error",
      message: `${label} references unknown quest "${action.questId}"`,
    });
  }
  if (action.roomId && !refs.roomIds.has(action.roomId)) {
    issues.push({
      severity: "error",
      message: `${label} references unknown room "${action.roomId}"`,
    });
  }
  if (action.cutsceneId && !refs.cutsceneIds.has(action.cutsceneId)) {
    issues.push({
      severity: "error",
      message: `${label} references unknown cutscene "${action.cutsceneId}"`,
    });
  }
}

export function validateBundle(bundle: GameContentBundle): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const quests = bundle.quests ?? [];
  const dialogues = bundle.dialogues ?? [];
  const cutscenes = bundle.cutscenes ?? [];

  checkDupes(bundle.tags.activityTags, "activity tag", issues);
  checkDupes(bundle.tags.abilityTags, "ability tag", issues);
  checkDupes(bundle.storageKeys, "storage key", issues);
  checkDupes(bundle.items, "item", issues);
  checkDupes(bundle.itemClasses ?? [], "item class", issues);
  checkDupes(bundle.affixTables ?? [], "affix table", issues);
  checkDupes(bundle.modifierStats ?? [], "modifier stat", issues);
  checkDupes(bundle.itemBases ?? [], "item base", issues);
  checkDupes(bundle.affixes ?? [], "affix", issues);
  checkDupes(bundle.itemQualityRules ?? [], "item quality rule set", issues);
  checkDupes(bundle.uniqueItems ?? [], "unique item", issues);
  checkDupes(bundle.itemSets ?? [], "item set", issues);
  checkDupes(bundle.skills, "skill", issues);
  checkDupes(bundle.statusEffects, "status effect", issues);
  checkDupes(bundle.interactables, "interactable", issues);
  checkDupes(dialogues, "dialogue", issues);
  checkDupes(cutscenes, "cutscene", issues);
  checkDupes(quests, "quest", issues);
  checkDupes(bundle.combos, "combo", issues);
  checkDupes(bundle.recipes, "recipe", issues);
  checkDupes(bundle.weathers ?? [], "weather", issues);
  checkDupes(bundle.world.rooms, "room", issues);

  const activityTagIds = new Set(bundle.tags.activityTags.map((tag) => tag.id));
  const abilityTagIds = new Set(bundle.tags.abilityTags.map((tag) => tag.id));
  const storageKeyIds = new Set(bundle.storageKeys.map((key) => key.id));
  const itemIds = new Set(bundle.items.map((item) => item.id));
  const itemClassIds = new Set((bundle.itemClasses ?? []).map((entry) => entry.id));
  const affixTableIds = new Set((bundle.affixTables ?? []).map((entry) => entry.id));
  const modifierStatIds = new Set((bundle.modifierStats ?? []).map((entry) => entry.id));
  const itemBaseIds = new Set((bundle.itemBases ?? []).map((entry) => entry.id));
  const uniqueItemIds = new Set((bundle.uniqueItems ?? []).map((entry) => entry.id));
  const skillIds = new Set(bundle.skills.map((skill) => skill.id));
  const effectIds = new Set(bundle.statusEffects.map((effect) => effect.id));
  const interactableIds = new Set(bundle.interactables.map((interactable) => interactable.id));
  const roomIds = new Set(bundle.world.rooms.map((room) => room.id));
  const dialogueIds = new Set(dialogues.map((dialogue) => dialogue.id));
  const cutsceneIds = new Set(cutscenes.map((cutscene) => cutscene.id));
  const questIds = new Set(quests.map((quest) => quest.id));
  const actionRefs = {
    effectIds,
    skillIds,
    storageKeyIds,
    itemIds,
    interactableIds,
    questIds,
    roomIds,
    cutsceneIds,
  };

  for (const itemBase of bundle.itemBases ?? []) {
    if (!itemClassIds.has(itemBase.itemClassId)) {
      issues.push({
        severity: "error",
        message: `Item base "${itemBase.name}" references unknown item class "${itemBase.itemClassId}"`,
      });
    }
    for (const tableId of itemBase.affixTableIds) {
      if (!affixTableIds.has(tableId)) {
        issues.push({
          severity: "error",
          message: `Item base "${itemBase.name}" references unknown affix table "${tableId}"`,
        });
      }
    }
    for (const modifier of itemBase.baseModifiers ?? []) {
      if (!modifierStatIds.has(modifier.statId)) {
        issues.push({
          severity: "error",
          message: `Item base "${itemBase.name}" references unknown modifier stat "${modifier.statId}"`,
        });
      }
    }
    for (const modifier of itemBase.implicit?.modifiers ?? []) {
      if (!modifierStatIds.has(modifier.statId)) {
        issues.push({
          severity: "error",
          message: `Item base "${itemBase.name}" implicit references unknown modifier stat "${modifier.statId}"`,
        });
      }
    }
    for (const requirement of itemBase.requirements?.skills ?? []) {
      if (!skillIds.has(requirement.skillId)) {
        issues.push({
          severity: "error",
          message: `Item base "${itemBase.name}" references unknown requirement skill "${requirement.skillId}"`,
        });
      }
    }
  }

  for (const affix of bundle.affixes ?? []) {
    if (!affixTableIds.has(affix.tableId)) {
      issues.push({
        severity: "error",
        message: `Affix "${affix.id}" references unknown affix table "${affix.tableId}"`,
      });
    }
    for (const itemClassId of affix.allowedItemClasses ?? []) {
      if (!itemClassIds.has(itemClassId)) {
        issues.push({
          severity: "error",
          message: `Affix "${affix.id}" references unknown item class "${itemClassId}"`,
        });
      }
    }
    for (const modifier of affix.modifiers ?? []) {
      if (!modifierStatIds.has(modifier.statId)) {
        issues.push({
          severity: "error",
          message: `Affix "${affix.id}" references unknown modifier stat "${modifier.statId}"`,
        });
      }
    }
  }

  for (const qualityRuleSet of bundle.itemQualityRules ?? []) {
    if ((qualityRuleSet.bands ?? []).length === 0) {
      issues.push({
        severity: "warning",
        message: `Item quality rule set "${qualityRuleSet.id}" has no bands`,
      });
    }
  }

  for (const uniqueItem of bundle.uniqueItems ?? []) {
    if (!itemBaseIds.has(uniqueItem.baseId)) {
      issues.push({
        severity: "error",
        message: `Unique item "${uniqueItem.name}" references unknown base "${uniqueItem.baseId}"`,
      });
    }
    for (const modifier of uniqueItem.modifiers ?? []) {
      if (!modifierStatIds.has(modifier.statId)) {
        issues.push({
          severity: "error",
          message: `Unique item "${uniqueItem.name}" references unknown modifier stat "${modifier.statId}"`,
        });
      }
    }
    for (const requirement of uniqueItem.requirementsOverride?.skills ?? []) {
      if (!skillIds.has(requirement.skillId)) {
        issues.push({
          severity: "error",
          message: `Unique item "${uniqueItem.name}" references unknown requirement skill "${requirement.skillId}"`,
        });
      }
    }
  }

  for (const itemSet of bundle.itemSets ?? []) {
    for (const itemId of itemSet.itemIds) {
      if (!uniqueItemIds.has(itemId)) {
        issues.push({
          severity: "error",
          message: `Item set "${itemSet.name}" references unknown unique item "${itemId}"`,
        });
      }
    }
    for (const bonus of itemSet.bonuses ?? []) {
      for (const modifier of bonus.modifiers ?? []) {
        if (!modifierStatIds.has(modifier.statId)) {
          issues.push({
            severity: "error",
            message: `Item set "${itemSet.name}" references unknown modifier stat "${modifier.statId}"`,
          });
        }
      }
    }
  }

  for (const skill of bundle.skills) {
    validateCondition(skill.unlockCondition, `Skill "${skill.name}"`, issues);
    if (skill.combatSchool && !VALID_COMBAT_SCHOOLS.has(skill.combatSchool)) {
      issues.push({
        severity: "error",
        message: `Skill "${skill.name}" has invalid combat school "${skill.combatSchool}"`,
      });
    }
    for (const tagId of skill.activityTags) {
      if (!activityTagIds.has(tagId)) {
        issues.push({
          severity: "warning",
          message: `Skill "${skill.name}" references unknown activity tag "${tagId}"`,
        });
      }
    }
    for (const tagId of skill.abilityTags) {
      if (!abilityTagIds.has(tagId)) {
        issues.push({
          severity: "warning",
          message: `Skill "${skill.name}" references unknown ability tag "${tagId}"`,
        });
      }
    }
    if (skill.kind === "active" && skill.system !== "combat" && !skill.linkedPassiveId) {
      issues.push({
        severity: "warning",
        message: `Active skill "${skill.name}" has no linked passive skill`,
      });
    }
    if (skill.usableByInteractables && skill.kind !== "active") {
      issues.push({
        severity: "warning",
        message: `Skill "${skill.name}" is marked usable by interactables but is not an active skill`,
      });
    }
    if (skill.linkedPassiveId && !skillIds.has(skill.linkedPassiveId)) {
      issues.push({
        severity: "error",
        message: `Skill "${skill.name}" references unknown linked passive "${skill.linkedPassiveId}"`,
      });
    }
    if (skill.usageProfile?.castTickIntervalMs !== undefined && skill.usageProfile.castTickIntervalMs <= 0) {
      issues.push({
        severity: "error",
        message: `Skill "${skill.name}" has invalid cast tick interval "${skill.usageProfile.castTickIntervalMs}"`,
      });
    }
    if (
      skill.usageProfile?.castTickIntervalMs !== undefined &&
      skill.usageProfile.castTickIntervalMs > skill.baseDurationMs
    ) {
      issues.push({
        severity: "warning",
        message: `Skill "${skill.name}" has a cast tick interval above its cast duration`,
      });
    }
    for (const interaction of skill.statusInteractions ?? []) {
      validateCondition(
        interaction.condition,
        `Skill "${skill.name}" status interaction "${interaction.id}"`,
        issues
      );
      if (interaction.consumeStatusEffectId && !effectIds.has(interaction.consumeStatusEffectId)) {
        issues.push({
          severity: "error",
          message: `Skill "${skill.name}" status interaction "${interaction.id}" references unknown consumed status effect "${interaction.consumeStatusEffectId}"`,
        });
      }
      if (interaction.applyStatusEffectId && !effectIds.has(interaction.applyStatusEffectId)) {
        issues.push({
          severity: "error",
          message: `Skill "${skill.name}" status interaction "${interaction.id}" references unknown applied status effect "${interaction.applyStatusEffectId}"`,
        });
      }
    }
    for (const effect of skill.effects ?? []) {
      validateCondition(
        effect.condition,
        `Skill "${skill.name}" effect "${effect.id}"`,
        issues
      );
      if (effect.statusEffectId && !effectIds.has(effect.statusEffectId)) {
        issues.push({
          severity: "error",
          message: `Skill "${skill.name}" effect "${effect.id}" references unknown status effect "${effect.statusEffectId}"`,
        });
      }
    }
    const perkLevels = new Set<number>();
    let previousPerkLevel = 0;
    for (const perk of skill.perkMilestones ?? []) {
      if (!Number.isInteger(perk.level) || perk.level <= 0) {
        issues.push({
          severity: "error",
          message: `Skill "${skill.name}" has an invalid perk milestone level "${perk.level}"`,
        });
      }
      if (!perk.description.trim()) {
        issues.push({
          severity: "error",
          message: `Skill "${skill.name}" has a perk milestone with an empty description`,
        });
      }
      if (perkLevels.has(perk.level)) {
        issues.push({
          severity: "error",
          message: `Skill "${skill.name}" has duplicate perk milestone level "${perk.level}"`,
        });
      }
      if (perk.level < previousPerkLevel) {
        issues.push({
          severity: "warning",
          message: `Skill "${skill.name}" perk milestones are not sorted by level`,
        });
      }
      perkLevels.add(perk.level);
      previousPerkLevel = perk.level;
    }
  }

  for (const item of bundle.items) {
    if (item.rarity && !VALID_ITEM_RARITIES.has(item.rarity)) {
      issues.push({
        severity: "error",
        message: `Item "${item.name}" has invalid rarity "${item.rarity}"`,
      });
    }
    if (item.inventoryCategory && !VALID_INVENTORY_CATEGORIES.has(item.inventoryCategory)) {
      issues.push({
        severity: "error",
        message: `Item "${item.name}" has invalid inventory category "${item.inventoryCategory}"`,
      });
    }
    for (const hook of item.eventHooks) {
      validateCondition(hook.condition, `Item "${item.name}" event "${hook.id}"`, issues);
      for (const action of hook.actions) {
        validateEventAction(action, `Item "${item.name}" event "${hook.id}"`, actionRefs, issues);
      }
    }
  }

  for (const effect of bundle.statusEffects) {
    validateCondition(effect.removeCondition, `Status effect "${effect.name}"`, issues);
    if (effect.eventHooks?.length) {
      checkDupes(effect.eventHooks, `status effect "${effect.name}" hook`, issues);
      for (const hook of effect.eventHooks) {
        if (hook.event === "on_interval" && (typeof hook.intervalMs !== "number" || hook.intervalMs <= 0)) {
          issues.push({
            severity: "error",
            message: `Status effect "${effect.name}" hook "${hook.id}" must define a positive intervalMs for on_interval.`,
          });
        }
        validateCondition(hook.condition, `Status effect "${effect.name}" hook "${hook.id}"`, issues);
        for (const action of hook.actions) {
          validateEventAction(action, `Status effect "${effect.name}" hook "${hook.id}"`, actionRefs, issues);
        }
      }
    }
  }

  for (const combo of bundle.combos) {
    if (!skillIds.has(combo.fromSkillId)) {
      issues.push({
        severity: "error",
        message: `Combo "${combo.label}" references unknown from-skill "${combo.fromSkillId}"`,
      });
    }
    if (!skillIds.has(combo.toSkillId)) {
      issues.push({
        severity: "error",
        message: `Combo "${combo.label}" references unknown to-skill "${combo.toSkillId}"`,
      });
    }
    if (combo.activityTag && !activityTagIds.has(combo.activityTag)) {
      issues.push({
        severity: "warning",
        message: `Combo "${combo.label}" references unknown activity tag "${combo.activityTag}"`,
      });
    }
  }

  for (const interactable of bundle.interactables) {
    validateCondition(interactable.spawnCondition, `Interactable "${interactable.name}"`, issues);
    if (interactable.abilityBehaviorMode && !["priority", "sequence"].includes(interactable.abilityBehaviorMode)) {
      issues.push({
        severity: "error",
        message: `Interactable "${interactable.name}" has invalid ability behavior mode "${interactable.abilityBehaviorMode}"`,
      });
    }
    if (
      interactable.initialAbilityDelayMs !== undefined &&
      (!Number.isFinite(interactable.initialAbilityDelayMs) || interactable.initialAbilityDelayMs < 0)
    ) {
      issues.push({
        severity: "error",
        message: `Interactable "${interactable.name}" has invalid initial ability delay "${interactable.initialAbilityDelayMs}"`,
      });
    }
    if (interactable.activityTag && !activityTagIds.has(interactable.activityTag)) {
      issues.push({
        severity: "warning",
        message: `Interactable "${interactable.name}" references unknown activity tag "${interactable.activityTag}"`,
      });
    }
    for (const [axis, value] of [
      ["X", interactable.imagePositionX],
      ["Y", interactable.imagePositionY],
    ] as const) {
      if (value !== undefined && (!Number.isFinite(value) || value < 0 || value > 100)) {
        issues.push({
          severity: "error",
          message: `Interactable "${interactable.name}" has invalid image position ${axis.toLowerCase()} "${value}". Expected 0-100.`,
        });
      }
    }
    for (const abilityTagId of interactable.allowedAbilityTags) {
      if (!abilityTagIds.has(abilityTagId)) {
        issues.push({
          severity: "warning",
          message: `Interactable "${interactable.name}" references unknown ability tag "${abilityTagId}"`,
        });
      }
    }
    for (const rule of interactable.formRules ?? []) {
      validateCondition(rule.condition, `Interactable "${interactable.name}" form rule "${rule.id}"`, issues);
      if (!rule.interactableId || !interactableIds.has(rule.interactableId)) {
        issues.push({
          severity: "error",
          message: `Interactable "${interactable.name}" form rule "${rule.id}" references unknown interactable "${rule.interactableId ?? ""}"`,
        });
      }
    }
    for (const reward of interactable.xpRewards) {
      if (!skillIds.has(reward.skillId)) {
        issues.push({
          severity: "error",
          message: `Interactable "${interactable.name}" grants XP to unknown skill "${reward.skillId}"`,
        });
      }
    }
    for (const ability of interactable.abilities) {
      if (
        ability.targetMode &&
        ![
          "player",
          "friendly_or_player",
          "selected_enemy",
          "random_enemy",
          "lowest_hp_enemy",
          "highest_hp_enemy",
          "random_friendly",
          "lowest_hp_friendly",
          "highest_hp_friendly",
          "specific_interactable",
        ].includes(ability.targetMode)
      ) {
        issues.push({
          severity: "error",
          message: `Interactable "${interactable.name}" ability "${ability.skillId ?? ability.name ?? "unnamed"}" has invalid target mode "${ability.targetMode}"`,
        });
      }
      if (ability.targetMode === "specific_interactable" && !ability.targetInteractableId) {
        issues.push({
          severity: "error",
          message: `Interactable "${interactable.name}" ability "${ability.skillId ?? ability.name ?? "unnamed"}" requires a target interactable`,
        });
      }
      if (
        ability.targetInteractableId &&
        !bundle.interactables.some((entry) => entry.id === ability.targetInteractableId)
      ) {
        issues.push({
          severity: "error",
          message: `Interactable "${interactable.name}" ability "${ability.skillId ?? ability.name ?? "unnamed"}" references unknown target interactable "${ability.targetInteractableId}"`,
        });
      }
      if (ability.skillId) {
        const linkedSkill = bundle.skills.find((skill) => skill.id === ability.skillId);
        if (!linkedSkill) {
          issues.push({
            severity: "error",
            message: `Interactable "${interactable.name}" references unknown ability skill "${ability.skillId}"`,
          });
        } else {
          if (linkedSkill.kind !== "active") {
            issues.push({
              severity: "error",
              message: `Interactable "${interactable.name}" ability skill "${linkedSkill.name}" is not active`,
            });
          }
          if (!linkedSkill.usableByInteractables) {
            issues.push({
              severity: "warning",
              message: `Interactable "${interactable.name}" ability skill "${linkedSkill.name}" is not marked usable by interactables`,
            });
          }
        }
      }
      if (ability.resistedByPassiveId && !skillIds.has(ability.resistedByPassiveId)) {
        issues.push({
          severity: "error",
          message: `Interactable "${interactable.name}" ability "${ability.skillId ?? ability.name ?? "unnamed"}" references unknown passive "${ability.resistedByPassiveId}"`,
        });
      }
      if (ability.skillId) {
        if (ability.castTimeMs !== undefined && ability.castTimeMs < 0) {
          issues.push({
            severity: "error",
            message: `Interactable "${interactable.name}" ability "${ability.skillId}" has invalid cast time override "${ability.castTimeMs}"`,
          });
        }
      } else if ((ability.castTimeMs ?? 0) < 0) {
        issues.push({
          severity: "error",
          message: `Interactable "${interactable.name}" ability "${ability.name ?? "unnamed"}" has invalid cast time "${ability.castTimeMs}"`,
        });
      }
      if (ability.cooldownMs < 0) {
        issues.push({
          severity: "error",
          message: `Interactable "${interactable.name}" ability "${ability.skillId ?? ability.name ?? "unnamed"}" has invalid cooldown "${ability.cooldownMs}"`,
        });
      }
      if ((ability.damage ?? 0) < 0) {
        issues.push({
          severity: "error",
          message: `Interactable "${interactable.name}" ability "${ability.skillId ?? ability.name ?? "unnamed"}" has invalid damage "${ability.damage}"`,
        });
      }
    }
    for (const entry of interactable.lootTable) {
      validateCondition(entry.condition, `Interactable "${interactable.name}" loot "${entry.id}"`, issues);
      if ((entry.dropType ?? "item") === "item") {
        if (!entry.itemId || !itemIds.has(entry.itemId)) {
          issues.push({
            severity: "error",
            message: `Interactable "${interactable.name}" loot references unknown item "${entry.itemId ?? ""}"`,
          });
        }
      } else {
        if (!entry.itemBaseId || !itemBaseIds.has(entry.itemBaseId)) {
          issues.push({
            severity: "error",
            message: `Interactable "${interactable.name}" loot references unknown item base "${entry.itemBaseId ?? ""}"`,
          });
        }
        if (entry.itemLevelMin !== undefined && entry.itemLevelMin <= 0) {
          issues.push({
            severity: "error",
            message: `Interactable "${interactable.name}" loot "${entry.id}" has invalid item level min "${entry.itemLevelMin}"`,
          });
        }
        if (entry.itemLevelMax !== undefined && entry.itemLevelMax <= 0) {
          issues.push({
            severity: "error",
            message: `Interactable "${interactable.name}" loot "${entry.id}" has invalid item level max "${entry.itemLevelMax}"`,
          });
        }
        if (
          entry.itemLevelMin !== undefined &&
          entry.itemLevelMax !== undefined &&
          entry.itemLevelMax < entry.itemLevelMin
        ) {
          issues.push({
            severity: "error",
            message: `Interactable "${interactable.name}" loot "${entry.id}" has itemLevelMax below itemLevelMin`,
          });
        }
        if (entry.qualityRuleSetId && !(bundle.itemQualityRules ?? []).some((rule) => rule.id === entry.qualityRuleSetId)) {
          issues.push({
            severity: "error",
            message: `Interactable "${interactable.name}" loot "${entry.id}" references unknown quality rule set "${entry.qualityRuleSetId}"`,
          });
        }
      }
    }
    for (const effect of [...interactable.onInteractEffects, ...interactable.onDestroyEffects]) {
      validateEventAction(effect, `Interactable "${interactable.name}" action`, actionRefs, issues);
    }
    if (interactable.npc) {
      const defaultDialogueId = interactable.npc.dialogueId?.trim();
      const dialogueRoutes = interactable.npc.dialogues ?? [];
      const hasDialogueData = Boolean(defaultDialogueId) || dialogueRoutes.length > 0;
      const shouldRequireDialogue = interactable.activityTag === "npc" || hasDialogueData;
      if (!shouldRequireDialogue) {
        continue;
      }
      if (!defaultDialogueId && dialogueRoutes.length === 0) {
        issues.push({
          severity: "error",
          message: `Interactable "${interactable.name}" has NPC data but no default or conditional dialogue`,
        });
      }
      if (defaultDialogueId && !dialogueIds.has(defaultDialogueId)) {
        issues.push({
          severity: "error",
          message: `Interactable "${interactable.name}" references unknown dialogue "${defaultDialogueId}"`,
        });
      }
      for (const route of dialogueRoutes) {
        validateCondition(route.condition, `Interactable "${interactable.name}" NPC dialogue route`, issues);
        if (!route.dialogueId || !dialogueIds.has(route.dialogueId)) {
          issues.push({
            severity: "error",
            message: `Interactable "${interactable.name}" references unknown conditional dialogue "${route.dialogueId ?? ""}"`,
          });
        }
      }
    }
  }

  for (const room of bundle.world.rooms) {
    if (room.description.length > MAX_ROOM_DESCRIPTION_CHARS) {
      issues.push({
        severity: "error",
        message: `Room "${room.name}" description exceeds ${MAX_ROOM_DESCRIPTION_CHARS} characters`,
      });
    }
    validateCondition(room.entryCondition, `Room "${room.name}"`, issues);
    for (const override of room.seedOverrides ?? []) {
      validateCondition(override.condition, `Room "${room.name}" seed override`, issues);
    }
    for (const connection of room.specialConnections ?? []) {
      validateCondition(connection.condition, `Room "${room.name}" connection "${connection.label}"`, issues);
      if (!roomIds.has(connection.targetRoomId)) {
        issues.push({
          severity: "error",
          message: `Room "${room.name}" references unknown connection target "${connection.targetRoomId}"`,
        });
      }
    }
    for (const fixed of room.fixedInteractables ?? []) {
      validateCondition(fixed.condition, `Room "${room.name}" fixed interactable`, issues);
      if (!interactableIds.has(fixed.interactableId)) {
        issues.push({
          severity: "error",
          message: `Room "${room.name}" references unknown fixed interactable "${fixed.interactableId}"`,
        });
      }
    }
    for (const spawn of room.spawnTable ?? []) {
      validateCondition(spawn.condition, `Room "${room.name}" spawn "${spawn.id}"`, issues);
      if (!interactableIds.has(spawn.interactableId)) {
        issues.push({
          severity: "error",
          message: `Room "${room.name}" spawn "${spawn.id}" references unknown interactable "${spawn.interactableId}"`,
        });
      }
    }
  }

  if (bundle.world.startingCutsceneId && !cutsceneIds.has(bundle.world.startingCutsceneId)) {
    issues.push({
      severity: "error",
      message: `Starting cutscene "${bundle.world.startingCutsceneId}" was not found`,
    });
  }

  for (const dialogue of dialogues) {
    const nodeIds = new Set(dialogue.nodes.map((node) => node.id));
    if (!nodeIds.has(dialogue.startNodeId)) {
      issues.push({
        severity: "error",
        message: `Dialogue "${dialogue.name}" start node "${dialogue.startNodeId}" was not found`,
      });
    }
    const localNodeIds = new Set<string>();
    for (const node of dialogue.nodes) {
      if (localNodeIds.has(node.id)) {
        issues.push({
          severity: "error",
          message: `Dialogue "${dialogue.name}" has duplicate node ID "${node.id}"`,
        });
      }
      localNodeIds.add(node.id);
      if (node.nextNodeId && !nodeIds.has(node.nextNodeId)) {
        issues.push({
          severity: "error",
          message: `Dialogue "${dialogue.name}" node "${node.id}" references unknown next node "${node.nextNodeId}"`,
        });
      }
      for (const effect of node.onEnterEffects ?? []) {
        validateEventAction(effect, `Dialogue "${dialogue.name}" node "${node.id}" action`, actionRefs, issues);
      }
      const optionIds = new Set<string>();
      for (const option of node.options) {
        if (optionIds.has(option.id)) {
          issues.push({
            severity: "error",
            message: `Dialogue "${dialogue.name}" node "${node.id}" has duplicate option ID "${option.id}"`,
          });
        }
        optionIds.add(option.id);
        const optionTags = option.tags ?? [];
        const uniqueTags = new Set(optionTags);
        if (uniqueTags.size !== optionTags.length) {
          issues.push({
            severity: "warning",
            message: `Dialogue "${dialogue.name}" option "${option.id}" has duplicate response tags`,
          });
        }
        validateCondition(option.condition, `Dialogue "${dialogue.name}" option "${option.text}"`, issues);
        if (option.nextNodeId && !nodeIds.has(option.nextNodeId)) {
          issues.push({
            severity: "error",
            message: `Dialogue "${dialogue.name}" option "${option.id}" references unknown next node "${option.nextNodeId}"`,
          });
        }
        for (const effect of option.effects ?? []) {
          validateEventAction(effect, `Dialogue "${dialogue.name}" option "${option.id}" action`, actionRefs, issues);
        }
      }
    }
  }

  for (const cutscene of cutscenes) {
    const stepIds = new Set(cutscene.steps.map((step) => step.id));
    if (!stepIds.has(cutscene.startStepId)) {
      issues.push({
        severity: "error",
        message: `Cutscene "${cutscene.name}" start step "${cutscene.startStepId}" was not found`,
      });
    }
    for (const effect of cutscene.onStartEffects ?? []) {
      validateEventAction(effect, `Cutscene "${cutscene.name}" start action`, actionRefs, issues);
    }
    for (const effect of cutscene.onCompleteEffects ?? []) {
      validateEventAction(effect, `Cutscene "${cutscene.name}" complete action`, actionRefs, issues);
    }

    const localStepIds = new Set<string>();
    for (const step of cutscene.steps) {
      if (localStepIds.has(step.id)) {
        issues.push({
          severity: "error",
          message: `Cutscene "${cutscene.name}" has duplicate step ID "${step.id}"`,
        });
      }
      localStepIds.add(step.id);
      if (step.nextStepId && !stepIds.has(step.nextStepId)) {
        issues.push({
          severity: "error",
          message: `Cutscene "${cutscene.name}" step "${step.id}" references unknown next step "${step.nextStepId}"`,
        });
      }
      if (step.kind === "text" && !step.text?.trim()) {
        issues.push({
          severity: "error",
          message: `Cutscene "${cutscene.name}" text step "${step.id}" is missing text`,
        });
      }
      if (step.kind === "dialogue" && (!step.dialogueId || !dialogueIds.has(step.dialogueId))) {
        issues.push({
          severity: "error",
          message: `Cutscene "${cutscene.name}" dialogue step "${step.id}" references unknown dialogue "${step.dialogueId ?? ""}"`,
        });
      }
      for (const effect of step.onEnterEffects ?? []) {
        validateEventAction(effect, `Cutscene "${cutscene.name}" step "${step.id}" enter action`, actionRefs, issues);
      }
      for (const effect of step.onContinueEffects ?? []) {
        validateEventAction(effect, `Cutscene "${cutscene.name}" step "${step.id}" continue action`, actionRefs, issues);
      }
    }
  }

  for (const recipe of bundle.recipes) {
    validateCondition(recipe.unlockCondition, `Recipe "${recipe.name}"`, issues);
    if (recipe.craftTimeMs !== undefined && recipe.craftTimeMs <= 0) {
      issues.push({
        severity: "error",
        message: `Recipe "${recipe.name}" has invalid craft time "${recipe.craftTimeMs}"`,
      });
    }
    if (recipe.stationTag && !activityTagIds.has(recipe.stationTag)) {
      issues.push({
        severity: "warning",
        message: `Recipe "${recipe.name}" references unknown station tag "${recipe.stationTag}"`,
      });
    }
    if (!itemIds.has(recipe.outputItemId)) {
      issues.push({
        severity: "error",
        message: `Recipe "${recipe.name}" references unknown output item "${recipe.outputItemId}"`,
      });
    }
    for (const ingredient of recipe.ingredients) {
      if (!itemIds.has(ingredient.itemId)) {
        issues.push({
          severity: "error",
          message: `Recipe "${recipe.name}" references unknown ingredient item "${ingredient.itemId}"`,
        });
      }
    }
  }

  for (const quest of quests) {
    validateCondition(quest.unlockCondition, `Quest "${quest.name}"`, issues);
    validateCondition(quest.completeCondition, `Quest "${quest.name}"`, issues);
    const objectiveIds = new Set<string>();
    for (const objective of quest.objectives) {
      if (objectiveIds.has(objective.id)) {
        issues.push({
          severity: "error",
          message: `Quest "${quest.name}" has duplicate objective ID "${objective.id}"`,
        });
      }
      objectiveIds.add(objective.id);
      validateCondition(objective.unlockCondition, `Quest "${quest.name}" objective "${objective.title}"`, issues);
      validateCondition(objective.completeCondition, `Quest "${quest.name}" objective "${objective.title}"`, issues);
      if (objective.progress.kind === "structured") {
        if (objective.progress.source.type === "storage_counter" && !storageKeyIds.has(objective.progress.source.storageKeyId)) {
          issues.push({
            severity: "error",
            message: `Quest "${quest.name}" objective "${objective.title}" references unknown storage key "${objective.progress.source.storageKeyId}"`,
          });
        }
        if (objective.progress.source.type === "item_count" && !itemIds.has(objective.progress.source.itemId)) {
          issues.push({
            severity: "error",
            message: `Quest "${quest.name}" objective "${objective.title}" references unknown item "${objective.progress.source.itemId}"`,
          });
        }
        if (
          objective.progress.source.type === "interactable_defeat_count" &&
          !interactableIds.has(objective.progress.source.interactableId)
        ) {
          issues.push({
            severity: "error",
            message: `Quest "${quest.name}" objective "${objective.title}" references unknown interactable "${objective.progress.source.interactableId}"`,
          });
        }
      }
    }
  }

  if (bundle.world.rooms.length > 0 && !bundle.world.startingRoomId) {
    issues.push({
      severity: "warning",
      message: "World has rooms but no starting room is set",
    });
  }
  if (bundle.world.startingRoomId && !roomIds.has(bundle.world.startingRoomId)) {
    issues.push({
      severity: "error",
      message: `Starting room "${bundle.world.startingRoomId}" not found`,
    });
  }
  for (const itemId of bundle.world.startingItemIds) {
    if (!itemIds.has(itemId)) {
      issues.push({
        severity: "error",
        message: `World starting inventory references unknown item "${itemId}"`,
      });
    }
  }
  for (const baseId of bundle.world.startingEquipmentBaseIds ?? []) {
    if (!itemBaseIds.has(baseId)) {
      issues.push({
        severity: "error",
        message: `World starting equipment references unknown item base "${baseId}"`,
      });
    }
  }

  for (const room of bundle.world.rooms) {
    validateCondition(room.entryCondition, `Room "${room.name}"`, issues);
    for (const entry of room.spawnTable) {
      validateCondition(entry.condition, `Room "${room.name}" spawn "${entry.id}"`, issues);
      if (!interactableIds.has(entry.interactableId)) {
        issues.push({
          severity: "error",
          message: `Room "${room.name}" spawn table references unknown interactable "${entry.interactableId}"`,
        });
      }
      if (entry.neverRespawnAfterDefeat && entry.maxCount > 1) {
        issues.push({
          severity: "warning",
          message: `Room "${room.name}" spawn "${entry.id}" is marked never-respawn-after-defeat but can spawn multiple instances`,
        });
      }
    }
    for (const fixed of room.fixedInteractables) {
      validateCondition(fixed.condition, `Room "${room.name}" fixed interactable`, issues);
      if (!interactableIds.has(fixed.interactableId)) {
        issues.push({
          severity: "error",
          message: `Room "${room.name}" references unknown fixed interactable "${fixed.interactableId}"`,
        });
      }
    }
    for (const connection of room.specialConnections) {
      validateCondition(connection.condition, `Room "${room.name}" connection "${connection.label}"`, issues);
      if (!roomIds.has(connection.targetRoomId)) {
        issues.push({
          severity: "error",
          message: `Room "${room.name}" connection references unknown room "${connection.targetRoomId}"`,
        });
      }
    }
    for (const override of room.seedOverrides) {
      validateCondition(override.condition, `Room "${room.name}" seed override`, issues);
    }
  }

  if (bundle.items.length === 0) {
    issues.push({ severity: "warning", message: "No items defined" });
  }
  if (bundle.skills.length === 0) {
    issues.push({ severity: "warning", message: "No skills defined" });
  }
  if (bundle.interactables.length === 0) {
    issues.push({ severity: "warning", message: "No interactables defined" });
  }

  return issues;
}
