import { tokenize } from "./grammar.js";
import type { ASTNode, ParseError, ParseResult, Token } from "./types.js";

export function parse(input: string): ParseResult {
  if (!input.trim()) {
    return { ast: null, errors: [] };
  }

  const tokens = tokenize(input);
  const errors: ParseError[] = [];
  let pos = 0;

  function peek(): Token {
    return tokens[pos];
  }

  function advance(): Token {
    const token = tokens[pos];
    pos += 1;
    return token;
  }

  function expect(type: string): Token {
    const token = peek();
    if (token.type !== type) {
      errors.push({
        message: `Expected ${type} but got ${token.type}${token.value ? ` "${token.value}"` : ""}`,
        start: token.start,
        end: token.end,
      });
    }
    return advance();
  }

  function parseExpr(): ASTNode {
    return parseOr();
  }

  function parseOr(): ASTNode {
    let left = parseAnd();
    while (peek().type === "OR") {
      advance();
      const right = parseAnd();
      left = {
        type: "BinaryExpr",
        op: "OR",
        left,
        right,
        start: left.start,
        end: right.end,
      };
    }
    return left;
  }

  function parseAnd(): ASTNode {
    let left = parseNot();
    while (peek().type === "AND") {
      advance();
      const right = parseNot();
      left = {
        type: "BinaryExpr",
        op: "AND",
        left,
        right,
        start: left.start,
        end: right.end,
      };
    }
    return left;
  }

  function parseNot(): ASTNode {
    if (peek().type === "NOT") {
      const op = advance();
      const operand = parseNot();
      return {
        type: "UnaryExpr",
        op: "NOT",
        operand,
        start: op.start,
        end: operand.end,
      };
    }
    return parseCompare();
  }

  function parseCompare(): ASTNode {
    const left = parseAccess();
    const token = peek();
    if (
      token.type === "EQ" ||
      token.type === "NEQ" ||
      token.type === "GTE" ||
      token.type === "LTE" ||
      token.type === "GT" ||
      token.type === "LT"
    ) {
      const operator = advance();
      const right = parseAccess();
      return {
        type: "CompareExpr",
        op: operator.value as "==" | "!=" | ">=" | "<=" | ">" | "<",
        left,
        right,
        start: left.start,
        end: right.end,
      };
    }
    return left;
  }

  function parseAccess(): ASTNode {
    let node = parsePrimary();

    while (true) {
      if (peek().type === "DOT") {
        advance();
        const property = expect("IDENT");
        node = {
          type: "PropertyAccess",
          object: node,
          property: property.value,
          start: node.start,
          end: property.end,
        };
        continue;
      }

      if (peek().type === "LPAREN") {
        advance();
        const args: ASTNode[] = [];
        if (peek().type !== "RPAREN") {
          args.push(parseExpr());
          while (peek().value === ",") {
            advance();
            args.push(parseExpr());
          }
        }
        const endParen = expect("RPAREN");
        node = {
          type: "FunctionCall",
          callee: node,
          args,
          start: node.start,
          end: endParen.end,
        };
        continue;
      }

      break;
    }

    return node;
  }

  function parsePrimary(): ASTNode {
    const token = peek();

    if (token.type === "NUMBER") {
      advance();
      return { type: "NumberLiteral", value: Number(token.value), start: token.start, end: token.end };
    }
    if (token.type === "STRING") {
      advance();
      return { type: "StringLiteral", value: token.value, start: token.start, end: token.end };
    }
    if (token.type === "BOOLEAN") {
      advance();
      return { type: "BooleanLiteral", value: token.value === "true", start: token.start, end: token.end };
    }
    if (token.type === "IDENT") {
      advance();
      return { type: "Identifier", name: token.value, start: token.start, end: token.end };
    }
    if (token.type === "LPAREN") {
      advance();
      const expr = parseExpr();
      expect("RPAREN");
      return expr;
    }

    errors.push({
      message: `Unexpected token "${token.value || token.type}"`,
      start: token.start,
      end: token.end,
    });
    advance();
    return { type: "BooleanLiteral", value: false, start: token.start, end: token.end };
  }

  const ast = parseExpr();
  if (peek().type !== "EOF") {
    const token = peek();
    errors.push({
      message: `Unexpected token "${token.value || token.type}" after expression`,
      start: token.start,
      end: token.end,
    });
  }

  return { ast, errors };
}
