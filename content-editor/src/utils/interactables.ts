import type { InteractableFormRule, InteractableTemplate, NpcDialogueRoute } from "../schema/types";

type NormalizedNpcTemplate = NonNullable<InteractableTemplate["npc"]>;

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asPercent(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.max(0, Math.min(100, value));
}

export function normalizeNpcDialogueRoutes(value: unknown): NpcDialogueRoute[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const routes: NpcDialogueRoute[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const route = entry as Record<string, unknown>;
    const condition = asString(route.condition);
    routes.push({
      dialogueId: asString(route.dialogueId) ?? "",
      ...(condition ? { condition } : {}),
    });
  }

  return routes;
}

export function normalizeNpcTemplate(value: unknown): NormalizedNpcTemplate | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const npc = value as Record<string, unknown>;
  const dialogueId = asString(npc.dialogueId);
  const portraitImage = asString(npc.portraitImage);
  const dialogues = normalizeNpcDialogueRoutes(npc.dialogues);

  if (!dialogueId && !portraitImage && dialogues.length === 0) {
    return {};
  }

  return {
    dialogueId,
    portraitImage,
    dialogues,
  };
}

function normalizeFormRules(value: unknown): InteractableFormRule[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const rules: InteractableFormRule[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const rule = entry as Record<string, unknown>;
    rules.push({
      id: asString(rule.id) ?? "",
      condition: asString(rule.condition) ?? "",
      interactableId: asString(rule.interactableId) ?? "",
    });
  }
  return rules;
}

export function normalizeInteractableTemplate(template: InteractableTemplate): InteractableTemplate {
  return {
    ...template,
    description: asString(template.description) ?? "",
    activityTag: asString(template.activityTag) ?? "",
    meterLabel: asString(template.meterLabel) ?? "HP",
    folder: asString(template.folder),
    image: asString(template.image),
    imagePositionX: asPercent(template.imagePositionX),
    imagePositionY: asPercent(template.imagePositionY),
    initialAbilityDelayMs: typeof template.initialAbilityDelayMs === "number" && Number.isFinite(template.initialAbilityDelayMs)
      ? Math.max(0, template.initialAbilityDelayMs)
      : undefined,
    spawnCondition: asString(template.spawnCondition),
    formRules: normalizeFormRules(template.formRules),
    allowedAbilityTags: Array.isArray(template.allowedAbilityTags) ? template.allowedAbilityTags : [],
    lootTable: Array.isArray(template.lootTable) ? template.lootTable : [],
    xpRewards: Array.isArray(template.xpRewards) ? template.xpRewards : [],
    abilities: Array.isArray(template.abilities) ? template.abilities : [],
    onInteractEffects: Array.isArray(template.onInteractEffects) ? template.onInteractEffects : [],
    onDestroyEffects: Array.isArray(template.onDestroyEffects) ? template.onDestroyEffects : [],
    npc: normalizeNpcTemplate(template.npc),
  };
}
