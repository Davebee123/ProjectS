import type { ASTNode } from "../../../shared/dsl/types";

export interface MockContext {
  skills: Record<string, { level: number; unlocked: boolean }>;
  items: Record<string, number>;
  flags: Record<string, boolean>;
  counters: Record<string, number>;
  values: Record<string, string | number>;
  quests: Record<string, boolean>;
  completedQuests: Record<string, boolean>;
  effects: Record<string, number>;
  targetEffects: Record<string, number>;
  roomId: string;
  exploreCount: number;
  targetTag: string;
}

export function createEmptyContext(): MockContext {
  return {
    skills: {},
    items: {},
    flags: {},
    counters: {},
    values: {},
    quests: {},
    completedQuests: {},
    effects: {},
    targetEffects: {},
    roomId: "",
    exploreCount: 0,
    targetTag: "",
  };
}

type Val = number | string | boolean;

export function testEvaluate(
  ast: ASTNode | null,
  ctx: MockContext
): { result: boolean; error?: undefined } | { result?: undefined; error: string } {
  if (!ast) return { result: true };

  try {
    const val = evalNode(ast, ctx);
    return { result: toBool(val) };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

function evalNode(node: ASTNode, ctx: MockContext): Val {
  switch (node.type) {
    case "NumberLiteral":
      return node.value;
    case "StringLiteral":
      return node.value;
    case "BooleanLiteral":
      return node.value;
    case "Identifier":
      return node.name;
    case "BinaryExpr": {
      const left = evalNode(node.left, ctx);
      const right = evalNode(node.right, ctx);
      if (node.op === "AND") return toBool(left) && toBool(right);
      if (node.op === "OR") return toBool(left) || toBool(right);
      return false;
    }
    case "UnaryExpr":
      return !toBool(evalNode(node.operand, ctx));
    case "CompareExpr": {
      const left = evalNode(node.left, ctx);
      const right = evalNode(node.right, ctx);
      switch (node.op) {
        case "==": return left === right;
        case "!=": return left !== right;
        case ">=": return toNum(left) >= toNum(right);
        case "<=": return toNum(left) <= toNum(right);
        case ">": return toNum(left) > toNum(right);
        case "<": return toNum(left) < toNum(right);
      }
      return false;
    }
    case "PropertyAccess": {
      const obj = evalNode(node.object, ctx);
      return resolveProp(obj, node.property, ctx);
    }
    case "FunctionCall": {
      const callee = evalNode(node.callee, ctx);
      const args = node.args.map((a) => evalNode(a, ctx));
      return resolveCall(callee, args, ctx);
    }
  }
}

function resolveProp(obj: Val, prop: string, ctx: MockContext): Val {
  if (obj === "player") return `player.${prop}`;
  if (obj === "room") {
    if (prop === "id") return ctx.roomId;
    if (prop === "explore_count") return ctx.exploreCount;
  }
  if (obj === "target") {
    if (prop === "tag") return ctx.targetTag;
    return `target.${prop}`;
  }
  if (typeof obj === "string" && obj.startsWith("__skill:")) {
    const skillId = obj.slice(8);
    const sk = ctx.skills[skillId];
    if (prop === "level") return sk?.level ?? 0;
    if (prop === "unlocked") return sk?.unlocked ?? false;
  }
  return `${obj}.${prop}`;
}

function resolveCall(callee: Val, args: Val[], ctx: MockContext): Val {
  const fn = String(callee);
  if (fn === "skill") return `__skill:${args[0]}`;
  if (fn === "player.has_item") return (ctx.items[String(args[0])] ?? 0) > 0;
  if (fn === "player.item_count") return ctx.items[String(args[0])] ?? 0;
  if (fn === "player.flag") return ctx.flags[String(args[0])] ?? false;
  if (fn === "player.counter") return ctx.counters[String(args[0])] ?? 0;
  if (fn === "player.value") return ctx.values[String(args[0])] ?? "";
  if (fn === "player.storage") return ctx.values[String(args[0])] ?? "";
  if (fn === "player.has_quest" || fn === "player.hasQuest") return ctx.quests[String(args[0])] ?? false;
  if (fn === "player.has_completed_quest" || fn === "player.hasCompletedQuest") {
    return ctx.completedQuests[String(args[0])] ?? false;
  }
  if (fn === "player.has_effect") return (ctx.effects[String(args[0])] ?? 0) > 0;
  if (fn === "player.effect_stacks") return ctx.effects[String(args[0])] ?? 0;
  if (fn === "target.has_effect") return (ctx.targetEffects[String(args[0])] ?? 0) > 0;
  if (fn === "target.effect_stacks") return ctx.targetEffects[String(args[0])] ?? 0;
  throw new Error(`Unknown function: ${fn}`);
}

function toBool(v: Val): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  return v !== "" && v !== "false";
}

function toNum(v: Val): number {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  return Number(v) || 0;
}
