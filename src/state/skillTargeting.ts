import type { SkillState, WorldObject } from "../data/bridge";

type PlayerTargetableSkill = Pick<
  SkillState,
  "system" | "usageProfile" | "tags" | "playerTargetTags" | "abilityTags"
>;

type PlayerTargetableObject = Pick<WorldObject, "tag" | "allowedAbilityTags">;

export function getPlayerTargetTags(
  skill: Pick<SkillState, "tags" | "playerTargetTags">
): string[] {
  return skill.playerTargetTags ?? skill.tags;
}

export function canPlayerUseSkillOnObject(
  skill: PlayerTargetableSkill,
  target: PlayerTargetableObject
): boolean {
  const isSelfTargetCombatSkill =
    skill.system === "combat" &&
    skill.usageProfile?.usageContext === "combat" &&
    skill.usageProfile?.targetPattern === "self";

  if (!isSelfTargetCombatSkill && !getPlayerTargetTags(skill).includes(target.tag)) {
    return false;
  }

  if (
    target.allowedAbilityTags.length > 0 &&
    !target.allowedAbilityTags.some((tag) => skill.abilityTags.includes(tag))
  ) {
    return false;
  }

  return true;
}
