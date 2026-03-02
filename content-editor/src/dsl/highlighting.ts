import {
  StreamLanguage,
  type StreamParser,
} from "@codemirror/language";

/**
 * A simple stream-based tokenizer for CodeMirror syntax highlighting.
 * This avoids needing a full Lezer grammar while giving us coloring.
 */
const conditionDSL: StreamParser<Record<string, never>> = {
  token(stream) {
    // Skip whitespace
    if (stream.eatSpace()) return null;

    // String literal
    if (stream.match(/^"[^"]*"/) || stream.match(/^'[^']*'/)) {
      return "string";
    }

    // Number literal
    if (stream.match(/^-?\d+(\.\d+)?/)) {
      return "number";
    }

    // Two-char operators
    if (stream.match(/^(==|!=|>=|<=)/)) {
      return "operator";
    }

    // Single-char operators
    if (stream.match(/^[><]/)) {
      return "operator";
    }

    // Parens / dot
    if (stream.match(/^[().]/)) {
      return "punctuation";
    }

    // Keywords and identifiers
    if (stream.match(/^[a-zA-Z_][a-zA-Z0-9_]*/)) {
      const word = stream.current();
      if (word === "AND" || word === "OR" || word === "NOT") {
        return "keyword";
      }
      if (word === "true" || word === "false") {
        return "bool";
      }
      // Built-in namespaces
      if (word === "player" || word === "skill" || word === "room" || word === "target") {
        return "variableName.special";
      }
      // Known property/method names
      if (
        word === "has_item" || word === "item_count" ||
        word === "flag" || word === "counter" || word === "value" ||
        word === "storage" || word === "has_effect" || word === "effect_stacks" ||
        word === "level" || word === "unlocked" ||
        word === "id" || word === "explore_count" || word === "tag"
      ) {
        return "function";
      }
      return "variableName";
    }

    // Skip unknown chars
    stream.next();
    return null;
  },
};

export const conditionLanguage = StreamLanguage.define(conditionDSL);
