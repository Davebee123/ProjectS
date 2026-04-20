/**
 * Condition DSL evaluator for the game runtime.
 * Evaluates DSL condition strings against current game state.
 *
 * Supported expressions:
 *   player.has_item("itemId")        → boolean
 *   player.item_count("itemId")      → number
 *   player.flag("keyId")             → boolean
 *   player.counter("keyId")          → number
 *   player.value("keyId")            → string/number
 *   player.has_quest("questId") / player.hasQuest("questId") → boolean
 *   player.has_completed_quest("questId") / player.hasCompletedQuest("questId") → boolean
 *   player.has_effect("effectId")    → boolean
 *   player.effect_stacks("effectId") → number
 *   target.has_effect("effectId")    → boolean
 *   target.effect_stacks("effectId") → number
 *   skill("skillId").level           → number
 *   skill("skillId").unlocked        → boolean
 *   room.id                          → string
 *   room.explore_count               → number
 *   target.tag                       → string
 *   AND, OR, NOT, ==, !=, >=, <=, >, <
 */

// ── Token types ──
type TType =
  | "NUM" | "STR" | "BOOL" | "ID"
  | "DOT" | "LP" | "RP"
  | "AND" | "OR" | "NOT"
  | "EQ" | "NEQ" | "GTE" | "LTE" | "GT" | "LT"
  | "EOF";

interface Tk { t: TType; v: string; }

// ── Tokenizer ──
function tokenize(s: string): Tk[] {
  const out: Tk[] = [];
  let i = 0;
  while (i < s.length) {
    if (/\s/.test(s[i])) { i++; continue; }
    const two = s.slice(i, i + 2);
    if (two === "==") { out.push({ t: "EQ", v: two }); i += 2; continue; }
    if (two === "!=") { out.push({ t: "NEQ", v: two }); i += 2; continue; }
    if (two === ">=") { out.push({ t: "GTE", v: two }); i += 2; continue; }
    if (two === "<=") { out.push({ t: "LTE", v: two }); i += 2; continue; }
    if (s[i] === ">") { out.push({ t: "GT", v: ">" }); i++; continue; }
    if (s[i] === "<") { out.push({ t: "LT", v: "<" }); i++; continue; }
    if (s[i] === "(") { out.push({ t: "LP", v: "(" }); i++; continue; }
    if (s[i] === ")") { out.push({ t: "RP", v: ")" }); i++; continue; }
    if (s[i] === ".") { out.push({ t: "DOT", v: "." }); i++; continue; }
    if (s[i] === '"' || s[i] === "'") {
      const q = s[i]; i++;
      let str = "";
      while (i < s.length && s[i] !== q) {
        if (s[i] === "\\" && i + 1 < s.length) { str += s[i + 1]; i += 2; }
        else { str += s[i]; i++; }
      }
      if (i < s.length) i++;
      out.push({ t: "STR", v: str });
      continue;
    }
    if (/[0-9]/.test(s[i]) || (s[i] === "-" && i + 1 < s.length && /[0-9]/.test(s[i + 1]))) {
      const start = i;
      if (s[i] === "-") i++;
      while (i < s.length && /[0-9.]/.test(s[i])) i++;
      out.push({ t: "NUM", v: s.slice(start, i) });
      continue;
    }
    if (/[a-zA-Z_]/.test(s[i])) {
      const start = i;
      while (i < s.length && /[a-zA-Z0-9_]/.test(s[i])) i++;
      const w = s.slice(start, i);
      if (w === "AND") out.push({ t: "AND", v: w });
      else if (w === "OR") out.push({ t: "OR", v: w });
      else if (w === "NOT") out.push({ t: "NOT", v: w });
      else if (w === "true" || w === "false") out.push({ t: "BOOL", v: w });
      else out.push({ t: "ID", v: w });
      continue;
    }
    i++; // skip unknown
  }
  out.push({ t: "EOF", v: "" });
  return out;
}

// ── Game state context for evaluation ──
export interface EvalContext {
  /** Check if player has an item */
  hasItem: (id: string) => boolean;
  /** Get item count */
  itemCount: (id: string) => number;
  /** Get storage flag */
  flag: (id: string) => boolean;
  /** Get storage counter */
  counter: (id: string) => number;
  /** Get storage value */
  value: (id: string) => string | number;
  /** Get skill level */
  skillLevel: (id: string) => number;
  /** Is skill unlocked? */
  skillUnlocked: (id: string) => boolean;
  /** Has the player been granted a quest? */
  hasQuest?: (id: string) => boolean;
  /** Has the player completed a quest? */
  hasCompletedQuest?: (id: string) => boolean;
  /** Check if player has an active status effect */
  hasEffect?: (id: string) => boolean;
  /** Get stack count of an active status effect (0 if not active) */
  effectStacks?: (id: string) => number;
  /** Current room ID */
  roomId: string;
  /** Room explore count */
  exploreCount: number;
  /** Target tag (for event hooks) */
  targetTag?: string;
  /** Check if target has an active status effect */
  targetHasEffect?: (id: string) => boolean;
  /** Get target effect stack count */
  targetEffectStacks?: (id: string) => number;
}

// ── Recursive descent evaluator ──
type Val = number | string | boolean;

export function evaluateCondition(expr: string, ctx: EvalContext): boolean {
  if (!expr || !expr.trim()) return true; // empty = always true

  const tokens = tokenize(expr);
  let pos = 0;

  function peek(): Tk { return tokens[pos]; }
  function advance(): Tk { return tokens[pos++]; }
  function expect(t: TType): Tk {
    const tk = advance();
    if (tk.t !== t) throw new Error(`Expected ${t}, got ${tk.t}`);
    return tk;
  }

  function parseExpr(): Val { return parseOr(); }

  function parseOr(): Val {
    let left = parseAnd();
    while (peek().t === "OR") { advance(); const r = parseAnd(); left = toBool(left) || toBool(r); }
    return left;
  }

  function parseAnd(): Val {
    let left = parseNot();
    while (peek().t === "AND") { advance(); const r = parseNot(); left = toBool(left) && toBool(r); }
    return left;
  }

  function parseNot(): Val {
    if (peek().t === "NOT") { advance(); return !toBool(parseNot()); }
    return parseCompare();
  }

  function parseCompare(): Val {
    const left = parseAccess();
    const t = peek().t;
    if (t === "EQ") { advance(); return left === parseAccess(); }
    if (t === "NEQ") { advance(); return left !== parseAccess(); }
    if (t === "GTE") { advance(); return toNum(left) >= toNum(parseAccess()); }
    if (t === "LTE") { advance(); return toNum(left) <= toNum(parseAccess()); }
    if (t === "GT") { advance(); return toNum(left) > toNum(parseAccess()); }
    if (t === "LT") { advance(); return toNum(left) < toNum(parseAccess()); }
    return left;
  }

  function parseAccess(): Val {
    let node = parsePrimary();
    while (true) {
      if (peek().t === "DOT") {
        advance();
        const prop = expect("ID").v;
        node = resolveProp(node, prop);
      } else if (peek().t === "LP") {
        advance();
        const args: Val[] = [];
        if (peek().t !== "RP") {
          args.push(parseExpr());
        }
        expect("RP");
        node = resolveCall(node, args);
      } else break;
    }
    return node;
  }

  function parsePrimary(): Val {
    const tk = peek();
    if (tk.t === "NUM") { advance(); return Number(tk.v); }
    if (tk.t === "STR") { advance(); return tk.v; }
    if (tk.t === "BOOL") { advance(); return tk.v === "true"; }
    if (tk.t === "ID") { advance(); return tk.v; } // return identifier name as string
    if (tk.t === "LP") {
      advance();
      const v = parseExpr();
      expect("RP");
      return v;
    }
    throw new Error(`Unexpected token: ${tk.v || tk.t}`);
  }

  // Resolve property access on a value
  function resolveProp(obj: Val, prop: string): Val {
    if (obj === "player") {
      // player.has_item, player.flag, etc are handled as calls
      return `player.${prop}`;
    }
    if (obj === "room") {
      if (prop === "id") return ctx.roomId;
      if (prop === "explore_count") return ctx.exploreCount;
    }
    if (obj === "target") {
      if (prop === "tag") return ctx.targetTag ?? "";
      return `target.${prop}`;
    }
    // skill("id").level / .unlocked — obj will be a skillRef
    if (typeof obj === "string" && obj.startsWith("__skill:")) {
      const skillId = obj.slice(8);
      if (prop === "level") return ctx.skillLevel(skillId);
      if (prop === "unlocked") return ctx.skillUnlocked(skillId);
    }
    return `${obj}.${prop}`;
  }

  // Resolve function call
  function resolveCall(callee: Val, args: Val[]): Val {
    const fn = String(callee);
    if (fn === "skill") return `__skill:${args[0]}`;
    if (fn === "player.has_item") return ctx.hasItem(String(args[0]));
    if (fn === "player.item_count") return ctx.itemCount(String(args[0]));
    if (fn === "player.flag") return ctx.flag(String(args[0]));
    if (fn === "player.counter") return ctx.counter(String(args[0]));
    if (fn === "player.value") return ctx.value(String(args[0]));
    if (fn === "player.storage") return ctx.value(String(args[0]));
    if (fn === "player.has_quest" || fn === "player.hasQuest") return ctx.hasQuest?.(String(args[0])) ?? false;
    if (fn === "player.has_completed_quest" || fn === "player.hasCompletedQuest") {
      return ctx.hasCompletedQuest?.(String(args[0])) ?? false;
    }
    if (fn === "player.has_effect") return ctx.hasEffect?.(String(args[0])) ?? false;
    if (fn === "player.effect_stacks") return ctx.effectStacks?.(String(args[0])) ?? 0;
    if (fn === "target.has_effect") return ctx.targetHasEffect?.(String(args[0])) ?? false;
    if (fn === "target.effect_stacks") return ctx.targetEffectStacks?.(String(args[0])) ?? 0;
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

  try {
    return toBool(parseExpr());
  } catch {
    // If evaluation fails, treat as false (safe default)
    return false;
  }
}
