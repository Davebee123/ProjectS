# Incremental Fantasy RPG — Project Guide

## Repo structure
```
/                   Game (React 18 + TS 5.6 + Vite, port 5173)
  src/
    App.tsx         Main game — all UI, state, reducer (~1600 lines)
    data/
      loader.ts     JSON bundle types + parser
      evaluator.ts  DSL condition evaluator (runtime)
      bridge.ts     Bundle → game runtime types
  public/data/
    game-content.json  Exported content bundle (source of truth for game)

content-editor/     Editor (React 18 + TS 5.6 + Vite, port 5174)
  src/
    App.tsx         Routes + Ctrl+Z/Y undo-redo hook
    stores/         9 Zustand stores (all persist to localStorage)
      historyStore.ts  Snapshot-based undo/redo (50-entry, debounced 500ms)
    dsl/            Condition DSL: grammar, parser, completions, testEvaluator
    schema/types.ts All editor schema types
    components/     Pages for each entity type + layout
```

## Dev servers
```bash
# Game
npm run dev               # port 5173

# Editor
cd content-editor && npm run dev   # port 5174
```
Use `preview_start` with `"game"` or `"content-editor"` from launch.json.

## Type-checking
```bash
npx tsc --noEmit                        # game
cd content-editor && npx tsc --noEmit   # editor
```
Both must pass with zero errors.

## Architecture

**Game data flow:** `game-content.json` → `loader.ts` (parse + validate) → `bridge.ts` (convert to runtime types) → `App.tsx` (GameApp)

**DSL conditions** (`evaluator.ts`): evaluated against `EvalContext` at runtime. Syntax: `skill("id").level >= 3`, `player.has_item("id")`, `room.id == "x"`, AND/OR/NOT.

**Editor stores** (Zustand + persist): tagStore, storageKeyStore, itemStore, skillStore, statusEffectStore, interactableStore, comboStore, worldStore, projectStore. All auto-save to `localStorage` with keys `editor-*`.

**History store**: subscribes to all 9 stores, debounce-captures snapshots on change. Undo/redo restores all stores atomically via `_isRestoring` flag.

## Key conventions
- Game state lives entirely in `useReducer` in `App.tsx`; no external state library
- `generateObjectsForRoom()` uses PCG seeded RNG — same seed = same objects
- `startingItemIds` on WorldDef controls starting inventory (not all slotted items)
- Storage effects (`onInteract`/`onDestroy`) mutate `playerStorage` (flags/counters/values)
- XP rewards are data-driven per interactable; fallback is 2 active + 3 passive XP
- Skill unlocks checked on every action via `checkSkillUnlocks()` using DSL eval

## Workflow
- After editing code, verify with `preview_*` tools — no manual checks
- Run typecheck before committing
- Don't commit `.claude/` directory
