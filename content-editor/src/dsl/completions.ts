import type { CompletionContext, CompletionResult } from "@codemirror/autocomplete";

/**
 * Entity ID providers — these are set dynamically by the ConditionEditor
 * component so completions can reference actual data.
 */
export interface EntityProviders {
  itemIds: string[];
  skillIds: string[];
  storageKeyIds: string[];
  statusEffectIds: string[];
  roomIds: string[];
}

let providers: EntityProviders = {
  itemIds: [],
  skillIds: [],
  storageKeyIds: [],
  statusEffectIds: [],
  roomIds: [],
};

export function setEntityProviders(p: EntityProviders) {
  providers = p;
}

// Static completions for top-level identifiers and namespaces
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
  { label: "has_item", type: "function", detail: "(itemId) → boolean" },
  { label: "item_count", type: "function", detail: "(itemId) → number" },
  { label: "flag", type: "function", detail: "(keyId) → boolean" },
  { label: "counter", type: "function", detail: "(keyId) → number" },
  { label: "value", type: "function", detail: "(keyId) → string/number" },
  { label: "storage", type: "function", detail: "(keyId) → any" },
  { label: "has_effect", type: "function", detail: "(effectId) → boolean" },
  { label: "effect_stacks", type: "function", detail: "(effectId) → number" },
];

const SKILL_PROPS = [
  { label: "level", type: "property", detail: "→ number" },
  { label: "unlocked", type: "property", detail: "→ boolean" },
];

const ROOM_PROPS = [
  { label: "id", type: "property", detail: "→ string" },
  { label: "explore_count", type: "property", detail: "→ number" },
];

const TARGET_PROPS = [
  { label: "tag", type: "property", detail: "→ string" },
];

/**
 * Detect context and provide appropriate completions.
 */
export function conditionCompletions(
  context: CompletionContext
): CompletionResult | null {
  // Get text before cursor
  const line = context.state.doc.lineAt(context.pos);
  const textBefore = line.text.slice(0, context.pos - line.from);

  // After "player." — show player methods
  if (/player\.\w*$/.test(textBefore)) {
    const match = textBefore.match(/player\.(\w*)$/);
    const from = context.pos - (match?.[1]?.length ?? 0);
    return { from, options: PLAYER_METHODS };
  }

  // After "skill(...).""  — show skill properties
  if (/skill\([^)]*\)\.\w*$/.test(textBefore)) {
    const match = textBefore.match(/\.\w*$/);
    const from = context.pos - (match?.[0]?.length ?? 0) + 1;
    return { from, options: SKILL_PROPS };
  }

  // After "room." — show room properties
  if (/room\.\w*$/.test(textBefore)) {
    const match = textBefore.match(/room\.(\w*)$/);
    const from = context.pos - (match?.[1]?.length ?? 0);
    return { from, options: ROOM_PROPS };
  }

  // After "target." — show target properties
  if (/target\.\w*$/.test(textBefore)) {
    const match = textBefore.match(/target\.(\w*)$/);
    const from = context.pos - (match?.[1]?.length ?? 0);
    return { from, options: TARGET_PROPS };
  }

  // Inside string args for player methods — provide entity IDs
  // e.g. player.has_item(" or player.flag("
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

  const effectArgMatch = textBefore.match(
    /player\.(has_effect|effect_stacks)\(\s*"([^"]*)$/
  );
  if (effectArgMatch) {
    const from = context.pos - effectArgMatch[2].length;
    return {
      from,
      options: providers.statusEffectIds.map((id) => ({
        label: id,
        type: "text",
        detail: "Status Effect ID",
      })),
    };
  }

  // Inside skill("...") — provide skill IDs
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

  // Top-level word completion
  const wordMatch = textBefore.match(/[a-zA-Z_]\w*$/);
  if (wordMatch) {
    return {
      from: context.pos - wordMatch[0].length,
      options: TOP_LEVEL,
    };
  }

  // Explicit activation (Ctrl+Space) with no context
  if (context.explicit) {
    return { from: context.pos, options: TOP_LEVEL };
  }

  return null;
}
