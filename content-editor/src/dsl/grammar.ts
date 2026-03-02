import type { Token, TokenType } from "./types";

const KEYWORDS: Record<string, TokenType> = {
  AND: "AND",
  OR: "OR",
  NOT: "NOT",
  true: "BOOLEAN",
  false: "BOOLEAN",
};

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    // Skip whitespace
    if (/\s/.test(input[i])) {
      i++;
      continue;
    }

    // Two-char operators
    const two = input.slice(i, i + 2);
    if (two === "==" || two === "!=" || two === ">=" || two === "<=") {
      const typeMap: Record<string, TokenType> = {
        "==": "EQ",
        "!=": "NEQ",
        ">=": "GTE",
        "<=": "LTE",
      };
      tokens.push({ type: typeMap[two], value: two, start: i, end: i + 2 });
      i += 2;
      continue;
    }

    // Single-char operators
    const ch = input[i];
    if (ch === ">") {
      tokens.push({ type: "GT", value: ">", start: i, end: i + 1 });
      i++;
      continue;
    }
    if (ch === "<") {
      tokens.push({ type: "LT", value: "<", start: i, end: i + 1 });
      i++;
      continue;
    }
    if (ch === "(") {
      tokens.push({ type: "LPAREN", value: "(", start: i, end: i + 1 });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ type: "RPAREN", value: ")", start: i, end: i + 1 });
      i++;
      continue;
    }
    if (ch === ".") {
      tokens.push({ type: "DOT", value: ".", start: i, end: i + 1 });
      i++;
      continue;
    }

    // String literal
    if (ch === '"' || ch === "'") {
      const quote = ch;
      const start = i;
      i++;
      let str = "";
      while (i < input.length && input[i] !== quote) {
        if (input[i] === "\\" && i + 1 < input.length) {
          str += input[i + 1];
          i += 2;
        } else {
          str += input[i];
          i++;
        }
      }
      if (i < input.length) i++; // skip closing quote
      tokens.push({ type: "STRING", value: str, start, end: i });
      continue;
    }

    // Number literal
    if (/[0-9]/.test(ch) || (ch === "-" && i + 1 < input.length && /[0-9]/.test(input[i + 1]))) {
      const start = i;
      if (ch === "-") i++;
      while (i < input.length && /[0-9.]/.test(input[i])) i++;
      tokens.push({ type: "NUMBER", value: input.slice(start, i), start, end: i });
      continue;
    }

    // Identifier / keyword
    if (/[a-zA-Z_]/.test(ch)) {
      const start = i;
      while (i < input.length && /[a-zA-Z0-9_]/.test(input[i])) i++;
      const word = input.slice(start, i);
      const kwType = KEYWORDS[word];
      if (kwType) {
        tokens.push({ type: kwType, value: word, start, end: i });
      } else {
        tokens.push({ type: "IDENT", value: word, start, end: i });
      }
      continue;
    }

    // Unknown character — skip it (parser will handle errors)
    i++;
  }

  tokens.push({ type: "EOF", value: "", start: input.length, end: input.length });
  return tokens;
}
