import { tokenize } from "./grammar";
import type { Token, ASTNode, ParseResult, ParseError } from "./types";

/**
 * Recursive descent parser for the condition DSL.
 *
 * Grammar (precedence low → high):
 *   expr       = orExpr
 *   orExpr     = andExpr ( "OR" andExpr )*
 *   andExpr    = notExpr ( "AND" notExpr )*
 *   notExpr    = "NOT" notExpr | compareExpr
 *   compareExpr= accessExpr ( ( "==" | "!=" | ">=" | "<=" | ">" | "<" ) accessExpr )?
 *   accessExpr = primary ( "." IDENT | "(" argList ")" )*
 *   primary    = NUMBER | STRING | BOOLEAN | IDENT | "(" expr ")"
 *   argList    = expr ( "," expr )*
 */
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
    const t = tokens[pos];
    pos++;
    return t;
  }

  function expect(type: string): Token {
    const t = peek();
    if (t.type !== type) {
      errors.push({
        message: `Expected ${type} but got ${t.type}${t.value ? ` "${t.value}"` : ""}`,
        start: t.start,
        end: t.end,
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
    const t = peek();
    if (
      t.type === "EQ" ||
      t.type === "NEQ" ||
      t.type === "GTE" ||
      t.type === "LTE" ||
      t.type === "GT" ||
      t.type === "LT"
    ) {
      const opToken = advance();
      const right = parseAccess();
      return {
        type: "CompareExpr",
        op: opToken.value as "==" | "!=" | ">=" | "<=" | ">" | "<",
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
        const prop = expect("IDENT");
        node = {
          type: "PropertyAccess",
          object: node,
          property: prop.value,
          start: node.start,
          end: prop.end,
        };
      } else if (peek().type === "LPAREN") {
        advance();
        const args: ASTNode[] = [];
        if (peek().type !== "RPAREN") {
          args.push(parseExpr());
          while (peek().value === ",") {
            advance();
            args.push(parseExpr());
          }
        }
        const rp = expect("RPAREN");
        node = {
          type: "FunctionCall",
          callee: node,
          args,
          start: node.start,
          end: rp.end,
        };
      } else {
        break;
      }
    }

    return node;
  }

  function parsePrimary(): ASTNode {
    const t = peek();

    if (t.type === "NUMBER") {
      advance();
      return { type: "NumberLiteral", value: Number(t.value), start: t.start, end: t.end };
    }

    if (t.type === "STRING") {
      advance();
      return { type: "StringLiteral", value: t.value, start: t.start, end: t.end };
    }

    if (t.type === "BOOLEAN") {
      advance();
      return { type: "BooleanLiteral", value: t.value === "true", start: t.start, end: t.end };
    }

    if (t.type === "IDENT") {
      advance();
      return { type: "Identifier", name: t.value, start: t.start, end: t.end };
    }

    if (t.type === "LPAREN") {
      advance();
      const expr = parseExpr();
      expect("RPAREN");
      return expr;
    }

    // Error recovery — skip token and try again
    errors.push({
      message: `Unexpected token "${t.value || t.type}"`,
      start: t.start,
      end: t.end,
    });
    advance();

    // Return a placeholder to keep parsing
    return { type: "BooleanLiteral", value: false, start: t.start, end: t.end };
  }

  const ast = parseExpr();

  // Check for leftover tokens
  if (peek().type !== "EOF") {
    const t = peek();
    errors.push({
      message: `Unexpected token "${t.value || t.type}" after expression`,
      start: t.start,
      end: t.end,
    });
  }

  return { ast, errors };
}
