export type TokenType =
  | "NUMBER"
  | "STRING"
  | "BOOLEAN"
  | "IDENT"
  | "DOT"
  | "LPAREN"
  | "RPAREN"
  | "AND"
  | "OR"
  | "NOT"
  | "EQ"
  | "NEQ"
  | "GTE"
  | "LTE"
  | "GT"
  | "LT"
  | "EOF";

export interface Token {
  type: TokenType;
  value: string;
  start: number;
  end: number;
}

export type ASTNode =
  | BinaryExpr
  | UnaryExpr
  | CompareExpr
  | FunctionCall
  | PropertyAccess
  | Identifier
  | NumberLiteral
  | StringLiteral
  | BooleanLiteral;

export interface BinaryExpr {
  type: "BinaryExpr";
  op: "AND" | "OR";
  left: ASTNode;
  right: ASTNode;
  start: number;
  end: number;
}

export interface UnaryExpr {
  type: "UnaryExpr";
  op: "NOT";
  operand: ASTNode;
  start: number;
  end: number;
}

export interface CompareExpr {
  type: "CompareExpr";
  op: "==" | "!=" | ">=" | "<=" | ">" | "<";
  left: ASTNode;
  right: ASTNode;
  start: number;
  end: number;
}

export interface FunctionCall {
  type: "FunctionCall";
  callee: ASTNode;
  args: ASTNode[];
  start: number;
  end: number;
}

export interface PropertyAccess {
  type: "PropertyAccess";
  object: ASTNode;
  property: string;
  start: number;
  end: number;
}

export interface Identifier {
  type: "Identifier";
  name: string;
  start: number;
  end: number;
}

export interface NumberLiteral {
  type: "NumberLiteral";
  value: number;
  start: number;
  end: number;
}

export interface StringLiteral {
  type: "StringLiteral";
  value: string;
  start: number;
  end: number;
}

export interface BooleanLiteral {
  type: "BooleanLiteral";
  value: boolean;
  start: number;
  end: number;
}

export interface ParseError {
  message: string;
  start: number;
  end: number;
}

export interface ParseResult {
  ast: ASTNode | null;
  errors: ParseError[];
}
