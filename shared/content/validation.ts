import { parse } from "../dsl/parser.js";
import type { GameContentBundle } from "./types.js";

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

function validateCondition(source: string | undefined, label: string, issues: ValidationIssue[]): void {
  if (!source) {
    return;
  }
  const result = parse(source);
  if (result.errors.length > 0) {
    issues.push({
      severity: "error",
      message: `${label} has invalid condition: ${result.errors[0].message}`,
    });
  }
}

export function validateBundle(bundle: GameContentBundle): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  checkDupes(bundle.tags.activityTags, "activity tag", issues);
  checkDupes(bundle.tags.abilityTags, "ability tag", issues);
  checkDupes(bundle.storageKeys, "storage key", issues);
  checkDupes(bundle.items, "item", issues);
  checkDupes(bundle.skills, "skill", issues);
  checkDupes(bundle.statusEffects, "status effect", issues);
  checkDupes(bundle.interactables, "interactable", issues);
  checkDupes(bundle.combos, "combo", issues);
  checkDupes(bundle.recipes, "recipe", issues);
  checkDupes(bundle.world.rooms, "room", issues);

  const activityTagIds = new Set(bundle.tags.activityTags.map((tag) => tag.id));
  const abilityTagIds = new Set(bundle.tags.abilityTags.map((tag) => tag.id));
  const storageKeyIds = new Set(bundle.storageKeys.map((key) => key.id));
  const itemIds = new Set(bundle.items.map((item) => item.id));
  const skillIds = new Set(bundle.skills.map((skill) => skill.id));
  const effectIds = new Set(bundle.statusEffects.map((effect) => effect.id));
  const interactableIds = new Set(bundle.interactables.map((interactable) => interactable.id));
  const roomIds = new Set(bundle.world.rooms.map((room) => room.id));

  for (const skill of bundle.skills) {
    validateCondition(skill.unlockCondition, `Skill "${skill.name}"`, issues);
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
    if (skill.kind === "active" && !skill.linkedPassiveId) {
      issues.push({
        severity: "warning",
        message: `Active skill "${skill.name}" has no linked passive skill`,
      });
    }
    if (skill.linkedPassiveId && !skillIds.has(skill.linkedPassiveId)) {
      issues.push({
        severity: "error",
        message: `Skill "${skill.name}" references unknown linked passive "${skill.linkedPassiveId}"`,
      });
    }
  }

  for (const item of bundle.items) {
    for (const hook of item.eventHooks) {
      validateCondition(hook.condition, `Item "${item.name}" event "${hook.id}"`, issues);
      for (const action of hook.actions) {
        if (action.statusEffectId && !effectIds.has(action.statusEffectId)) {
          issues.push({
            severity: "error",
            message: `Item "${item.name}" event "${hook.id}" references unknown status effect "${action.statusEffectId}"`,
          });
        }
        if (action.targetSkillId && !skillIds.has(action.targetSkillId)) {
          issues.push({
            severity: "error",
            message: `Item "${item.name}" event "${hook.id}" references unknown skill "${action.targetSkillId}"`,
          });
        }
        if (action.storageKeyId && !storageKeyIds.has(action.storageKeyId)) {
          issues.push({
            severity: "error",
            message: `Item "${item.name}" event "${hook.id}" references unknown storage key "${action.storageKeyId}"`,
          });
        }
      }
    }
  }

  for (const effect of bundle.statusEffects) {
    validateCondition(effect.removeCondition, `Status effect "${effect.name}"`, issues);
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
    if (interactable.activityTag && !activityTagIds.has(interactable.activityTag)) {
      issues.push({
        severity: "warning",
        message: `Interactable "${interactable.name}" references unknown activity tag "${interactable.activityTag}"`,
      });
    }
    for (const abilityTagId of interactable.allowedAbilityTags) {
      if (!abilityTagIds.has(abilityTagId)) {
        issues.push({
          severity: "warning",
          message: `Interactable "${interactable.name}" references unknown ability tag "${abilityTagId}"`,
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
      if (ability.resistedByPassiveId && !skillIds.has(ability.resistedByPassiveId)) {
        issues.push({
          severity: "error",
          message: `Interactable "${interactable.name}" ability "${ability.name}" references unknown passive "${ability.resistedByPassiveId}"`,
        });
      }
    }
    for (const entry of interactable.lootTable) {
      validateCondition(entry.condition, `Interactable "${interactable.name}" loot "${entry.id}"`, issues);
      if (!itemIds.has(entry.itemId)) {
        issues.push({
          severity: "error",
          message: `Interactable "${interactable.name}" loot references unknown item "${entry.itemId}"`,
        });
      }
    }
    for (const effect of [...interactable.onInteractEffects, ...interactable.onDestroyEffects]) {
      validateCondition(effect.condition, `Interactable "${interactable.name}" storage effect`, issues);
      if (!storageKeyIds.has(effect.storageKeyId)) {
        issues.push({
          severity: "error",
          message: `Interactable "${interactable.name}" references unknown storage key "${effect.storageKeyId}"`,
        });
      }
    }
  }

  for (const recipe of bundle.recipes) {
    validateCondition(recipe.unlockCondition, `Recipe "${recipe.name}"`, issues);
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
