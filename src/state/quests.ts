import { evaluateCondition } from "../data/evaluator";
import { getQuestDefs } from "../data/loader";
import type { QuestCategory, QuestDef, QuestObjectiveDef, QuestProgressSourceDef } from "../data/loader";
import type { GameState } from "./types";
import { buildEvalContext } from "./utils";

export interface ResolvedObjective {
  objective: QuestObjectiveDef;
  complete: boolean;
  progressText: string;
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
            ? `${objective.progress.label}: ${Math.min(currentValue, objective.progress.requiredValue)}/${objective.progress.requiredValue}`
            : objective.progress.text;
          return {
            objective,
            complete: isComplete,
            progressText,
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
