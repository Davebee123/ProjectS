import { evaluateCondition } from "../data/evaluator";
import { getQuestDefs, getInteractableDefs, getDialogueDef } from "../data/loader";
import type { QuestCategory, QuestDef, QuestObjectiveDef, QuestProgressSourceDef } from "../data/loader";
import type { EventAction } from "../../shared/content/types";
import type { GameState } from "./types";
import { buildEvalContext } from "./utils";

export interface ResolvedObjective {
  objective: QuestObjectiveDef;
  complete: boolean;
  progressText: string;
  progressValue?: number;
  progressMax?: number;
  progressLabel?: string;
}

export interface ResolvedQuest {
  quest: QuestDef;
  activeObjective: ResolvedObjective | null;
}

export interface CompletedQuest {
  quest: QuestDef;
}

function meetsCondition(
  condition: string | undefined,
  ctx: ReturnType<typeof buildEvalContext>
): boolean {
  return !condition || evaluateCondition(condition, ctx);
}

function isQuestExplicitlyCompleted(state: GameState, questId: string): boolean {
  return state.playerStorage[`quest_completed:${questId}`] === true;
}

function getStructuredProgressValue(
  source: QuestProgressSourceDef,
  ctx: ReturnType<typeof buildEvalContext>
): number {
  switch (source.type) {
    case "item_count":
      return ctx.itemCount(source.itemId);
    case "storage_counter":
      return ctx.counter(source.storageKeyId);
    case "interactable_defeat_count":
      return ctx.counter(`interactable_defeated:${source.interactableId}`);
    default:
      return 0;
  }
}

function formatProgressLabel(label: string): string {
  const trimmed = label.trim() || "Progress";
  return trimmed.endsWith(":") ? trimmed : `${trimmed}:`;
}

export function getResolvedQuestsByCategory(
  state: GameState
): Record<QuestCategory, ResolvedQuest[]> {
  const ctx = buildEvalContext(state);
  return getQuestDefs()
    .filter((quest) => !isQuestExplicitlyCompleted(state, quest.id))
    .filter((quest) => ctx.hasQuest?.(quest.id))
    .reduce<Record<QuestCategory, ResolvedQuest[]>>(
      (acc, quest) => {
        const unlockedObjectives = quest.objectives.filter((objective) =>
          meetsCondition(objective.unlockCondition, ctx)
        );
        const resolvedObjectives = unlockedObjectives.map<ResolvedObjective>((objective) => {
          let currentValue = 0;
          if (objective.progress.kind === "structured") {
            currentValue = getStructuredProgressValue(objective.progress.source, ctx);
          }
          const isComplete = objective.completeCondition
            ? evaluateCondition(objective.completeCondition, ctx)
            : objective.progress.kind === "structured"
              ? currentValue >= objective.progress.requiredValue
              : false;
          const progressText = objective.progress.kind === "structured"
            ? `${formatProgressLabel(objective.progress.label)} ${Math.min(currentValue, objective.progress.requiredValue)}/${objective.progress.requiredValue}`
            : objective.progress.text;
          return {
            objective,
            complete: isComplete,
            progressText,
            progressValue: objective.progress.kind === "structured"
              ? Math.min(currentValue, objective.progress.requiredValue)
              : undefined,
            progressMax: objective.progress.kind === "structured"
              ? objective.progress.requiredValue
              : undefined,
            progressLabel: objective.progress.kind === "structured"
              ? objective.progress.label
              : undefined,
          };
        });

        const questComplete = quest.completeCondition
          ? evaluateCondition(quest.completeCondition, ctx)
          : resolvedObjectives.length > 0 && resolvedObjectives.every((objective) => objective.complete);

        if (questComplete) {
          return acc;
        }

        const activeObjective =
          resolvedObjectives.find((objective) => !objective.complete) ?? resolvedObjectives[0] ?? null;
        acc[quest.category].push({
          quest,
          activeObjective,
        });
        return acc;
      },
      {
        main_story: [],
        side_quest: [],
        task: [],
      }
    );
}

export function getVisibleQuestIds(state: GameState): string[] {
  return Object.values(getResolvedQuestsByCategory(state))
    .flat()
    .map(({ quest }) => quest.id);
}

export interface ActiveQuestTargets {
  interactableIds: Set<string>;
  roomIds: Set<string>;
  questIds: Set<string>;
}

/**
 * Returns the union of highlightTargets across all visible quests' active
 * objectives. Used to render "!" badges on elements representing the player's
 * current next step.
 */
export function getActiveQuestTargets(state: GameState): ActiveQuestTargets {
  const result: ActiveQuestTargets = {
    interactableIds: new Set(),
    roomIds: new Set(),
    questIds: new Set(),
  };
  const resolved = getResolvedQuestsByCategory(state);
  for (const bucket of Object.values(resolved)) {
    for (const { quest, activeObjective } of bucket) {
      if (!activeObjective || activeObjective.complete) continue;
      const targets = activeObjective.objective.highlightTargets;
      if (!targets) continue;
      result.questIds.add(quest.id);
      for (const id of targets.interactableIds ?? []) result.interactableIds.add(id);
      for (const id of targets.roomIds ?? []) result.roomIds.add(id);
    }
  }

  // Quest-giver hint: badge an interactable only when it has a dialogue route
  // that (a) currently passes its condition and (b) leads to a dialogue whose
  // effects grant one of the declared offersQuestIds — and that quest is not
  // already granted or completed.
  const ctx = buildEvalContext(state);
  for (const def of getInteractableDefs()) {
    const offers = def.offersQuestIds;
    if (!offers || offers.length === 0) continue;
    if (interactableOffersAnAvailableQuest(def, offers, ctx)) {
      result.interactableIds.add(def.id);
    }
  }

  return result;
}

function actionsGrantQuest(actions: EventAction[] | undefined, questId: string): boolean {
  if (!actions) return false;
  return actions.some((a) => a.type === "grant_quest" && a.questId === questId);
}

function dialogueGrantsQuest(dialogueId: string | undefined, questId: string): boolean {
  if (!dialogueId) return false;
  const dialogue = getDialogueDef(dialogueId);
  if (!dialogue) return false;
  for (const node of dialogue.nodes) {
    if (actionsGrantQuest(node.onEnterEffects, questId)) return true;
    for (const option of node.options) {
      if (actionsGrantQuest(option.effects, questId)) return true;
    }
  }
  return false;
}

function interactableOffersAnAvailableQuest(
  def: ReturnType<typeof getInteractableDefs>[number],
  offers: string[],
  ctx: ReturnType<typeof buildEvalContext>
): boolean {
  for (const questId of offers) {
    if (ctx.hasQuest?.(questId)) continue;
    if (ctx.hasCompletedQuest?.(questId)) continue;

    // Collect NPC dialogue routes plus the single default dialogueId.
    const routes: Array<{ dialogueId?: string; condition?: string }> = [];
    if (def.npc?.dialogueId) routes.push({ dialogueId: def.npc.dialogueId });
    if (def.npc?.dialogues) routes.push(...def.npc.dialogues);

    // Non-NPC interactables: fall back to onInteractEffects granting the quest.
    if (routes.length === 0) {
      if (actionsGrantQuest(def.onInteractEffects, questId)) return true;
      continue;
    }

    for (const route of routes) {
      if (route.condition && !evaluateCondition(route.condition, ctx)) continue;
      if (dialogueGrantsQuest(route.dialogueId, questId)) return true;
    }
  }
  return false;
}

export function getCompletedQuests(state: GameState): CompletedQuest[] {
  const ctx = buildEvalContext(state);
  return getQuestDefs()
    .filter((quest) => {
      // Explicitly completed via storage flag
      if (isQuestExplicitlyCompleted(state, quest.id)) return true;
      // OR all-objectives-complete style completion (only if quest was actually granted)
      if (!ctx.hasQuest?.(quest.id)) return false;
      if (quest.completeCondition) {
        return evaluateCondition(quest.completeCondition, ctx);
      }
      const unlockedObjectives = quest.objectives.filter((objective) =>
        meetsCondition(objective.unlockCondition, ctx)
      );
      if (unlockedObjectives.length === 0) return false;
      return unlockedObjectives.every((objective) => {
        if (objective.completeCondition) {
          return evaluateCondition(objective.completeCondition, ctx);
        }
        if (objective.progress.kind === "structured") {
          const currentValue = getStructuredProgressValue(objective.progress.source, ctx);
          return currentValue >= objective.progress.requiredValue;
        }
        return false;
      });
    })
    .map((quest) => ({ quest }));
}
