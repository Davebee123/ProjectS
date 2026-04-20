import type { CompletionContext, CompletionResult } from "@codemirror/autocomplete";

/**
 * Entity ID providers - these are set dynamically by the ConditionEditor
 * component so completions can reference actual data.
 */
export interface EntityProviders {
  itemIds: string[];
  skillIds: string[];
  storageKeyIds: string[];
  statusEffectIds: string[];
  questIds: string[];
  roomIds: string[];
}

let providers: EntityProviders = {
  itemIds: [],
  skillIds: [],
  storageKeyIds: [],
  statusEffectIds: [],
  questIds: [],
  roomIds: [],
};

export function setEntityProviders(p: EntityProviders) {
  providers = p;
}

const TOP_LEVEL = [
  { label: "player", type: "variable", detail: "Player state" },
  { label: "skill", type: "function", detail: "skill(id).level / .unlocked" },
  { label: "room", type: "variable", detail: "Current room" },
  { label: "target", type: "variable", detail: "Current target (in hooks)" },
  { label: "AND", type: "keyword" },
  { label: "OR", type: "keyword" },
  { label: "NOT", type: "keyword" },
  { label: "true", type: "keyword" },
  { label: "false", type: "keyword" },
];

const PLAYER_METHODS = [
  { label: "has_item", type: "function", detail: "(itemId) -> boolean" },
  { label: "item_count", type: "function", detail: "(itemId) -> number" },
  { label: "flag", type: "function", detail: "(keyId) -> boolean" },
  { label: "counter", type: "function", detail: "(keyId) -> number" },
  { label: "value", type: "function", detail: "(keyId) -> string/number" },
  { label: "storage", type: "function", detail: "(keyId) -> any" },
  { label: "has_quest", type: "function", detail: "(questId) -> boolean" },
  { label: "hasQuest", type: "function", detail: "(questId) -> boolean alias" },
  { label: "has_completed_quest", type: "function", detail: "(questId) -> boolean" },
  { label: "hasCompletedQuest", type: "function", detail: "(questId) -> boolean alias" },
  { label: "has_effect", type: "function", detail: "(effectId) -> boolean" },
  { label: "effect_stacks", type: "function", detail: "(effectId) -> number" },
];

const TARGET_METHODS = [
  { label: "tag", type: "property", detail: "-> string" },
  { label: "has_effect", type: "function", detail: "(effectId) -> boolean" },
  { label: "effect_stacks", type: "function", detail: "(effectId) -> number" },
];

const SKILL_PROPS = [
  { label: "level", type: "property", detail: "-> number" },
  { label: "unlocked", type: "property", detail: "-> boolean" },
];

const ROOM_PROPS = [
  { label: "id", type: "property", detail: "-> string" },
  { label: "explore_count", type: "property", detail: "-> number" },
];

export function conditionCompletions(
  context: CompletionContext
): CompletionResult | null {
  const line = context.state.doc.lineAt(context.pos);
  const textBefore = line.text.slice(0, context.pos - line.from);

  if (/player\.\w*$/.test(textBefore)) {
    const match = textBefore.match(/player\.(\w*)$/);
    const from = context.pos - (match?.[1]?.length ?? 0);
    return { from, options: PLAYER_METHODS };
  }

  if (/skill\([^)]*\)\.\w*$/.test(textBefore)) {
    const match = textBefore.match(/\.\w*$/);
    const from = context.pos - (match?.[0]?.length ?? 0) + 1;
    return { from, options: SKILL_PROPS };
  }

  if (/room\.\w*$/.test(textBefore)) {
    const match = textBefore.match(/room\.(\w*)$/);
    const from = context.pos - (match?.[1]?.length ?? 0);
    return { from, options: ROOM_PROPS };
  }

  if (/target\.\w*$/.test(textBefore)) {
    const match = textBefore.match(/target\.(\w*)$/);
    const from = context.pos - (match?.[1]?.length ?? 0);
    return { from, options: TARGET_METHODS };
  }

  const stringArgMatch = textBefore.match(
    /player\.(has_item|item_count)\(\s*"([^"]*)$/
  );
  if (stringArgMatch) {
    const from = context.pos - stringArgMatch[2].length;
    return {
      from,
      options: providers.itemIds.map((id) => ({
        label: id,
        type: "text",
        detail: "Item ID",
      })),
    };
  }

  const storageArgMatch = textBefore.match(
    /player\.(flag|counter|value|storage)\(\s*"([^"]*)$/
  );
  if (storageArgMatch) {
    const from = context.pos - storageArgMatch[2].length;
    return {
      from,
      options: providers.storageKeyIds.map((id) => ({
        label: id,
        type: "text",
        detail: "Storage Key",
      })),
    };
  }

  const questArgMatch = textBefore.match(
    /player\.(has_quest|has_completed_quest|hasQuest|hasCompletedQuest)\(\s*"([^"]*)$/
  );
  if (questArgMatch) {
    const from = context.pos - questArgMatch[2].length;
    return {
      from,
      options: providers.questIds.map((id) => ({
        label: id,
        type: "text",
        detail: "Quest ID",
      })),
    };
  }

  const effectArgMatch = textBefore.match(
    /(player|target)\.(has_effect|effect_stacks)\(\s*"([^"]*)$/
  );
  if (effectArgMatch) {
    const from = context.pos - effectArgMatch[3].length;
    return {
      from,
      options: providers.statusEffectIds.map((id) => ({
        label: id,
        type: "text",
        detail: "Status Effect ID",
      })),
    };
  }

  const skillArgMatch = textBefore.match(/skill\(\s*"([^"]*)$/);
  if (skillArgMatch) {
    const from = context.pos - skillArgMatch[1].length;
    return {
      from,
      options: providers.skillIds.map((id) => ({
        label: id,
        type: "text",
        detail: "Skill ID",
      })),
    };
  }

  const wordMatch = textBefore.match(/[a-zA-Z_]\w*$/);
  if (wordMatch) {
    return {
      from: context.pos - wordMatch[0].length,
      options: TOP_LEVEL,
    };
  }

  if (context.explicit) {
    return { from: context.pos, options: TOP_LEVEL };
  }

  return null;
}
