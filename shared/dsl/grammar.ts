import type { Token, TokenType } from "./types.js";

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
    if (/\s/.test(input[i])) {
      i += 1;
      continue;
    }

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

    const ch = input[i];
    if (ch === ">") {
      tokens.push({ type: "GT", value: ">", start: i, end: i + 1 });
      i += 1;
      continue;
    }
    if (ch === "<") {
      tokens.push({ type: "LT", value: "<", start: i, end: i + 1 });
      i += 1;
      continue;
    }
    if (ch === "(") {
      tokens.push({ type: "LPAREN", value: "(", start: i, end: i + 1 });
      i += 1;
      continue;
    }
    if (ch === ")") {
      tokens.push({ type: "RPAREN", value: ")", start: i, end: i + 1 });
      i += 1;
      continue;
    }
    if (ch === ".") {
      tokens.push({ type: "DOT", value: ".", start: i, end: i + 1 });
      i += 1;
      continue;
    }
    if (ch === ",") {
      tokens.push({ type: "IDENT", value: ",", start: i, end: i + 1 });
      i += 1;
      continue;
    }

    if (ch === '"' || ch === "'") {
      const quote = ch;
      const start = i;
      i += 1;
      let str = "";
      while (i < input.length && input[i] !== quote) {
        if (input[i] === "\\" && i + 1 < input.length) {
          str += input[i + 1];
          i += 2;
        } else {
          str += input[i];
          i += 1;
        }
      }
      if (i < input.length) {
        i += 1;
      }
      tokens.push({ type: "STRING", value: str, start, end: i });
      continue;
    }

    if (/[0-9]/.test(ch) || (ch === "-" && i + 1 < input.length && /[0-9]/.test(input[i + 1]))) {
      const start = i;
      if (ch === "-") {
        i += 1;
      }
      while (i < input.length && /[0-9.]/.test(input[i])) {
        i += 1;
      }
      tokens.push({ type: "NUMBER", value: input.slice(start, i), start, end: i });
      continue;
    }

    if (/[a-zA-Z_]/.test(ch)) {
      const start = i;
      while (i < input.length && /[a-zA-Z0-9_]/.test(input[i])) {
        i += 1;
      }
      const word = input.slice(start, i);
      const kwType = KEYWORDS[word];
      tokens.push({
        type: kwType ?? "IDENT",
        value: word,
        start,
        end: i,
      });
      continue;
    }

    i += 1;
  }

  tokens.push({ type: "EOF", value: "", start: input.length, end: input.length });
  return tokens;
}
