# Incremental Fantasy RPG - CLAUDE.md (Efficiency First)

## Goal
Ship correct features with minimal token usage.
Default behavior: small context, precise edits, short outputs, fast verification.

## Repo map (load only what you need)
- Game app: `src/`
  - `App.tsx`: reducer loop, gameplay, UI (main runtime behavior)
  - `data/loader.ts`: bundle types and accessors
  - `data/bridge.ts`: bundle -> runtime conversion
  - `data/evaluator.ts`: runtime DSL evaluator
- Editor app: `content-editor/src/`
  - `App.tsx`: routes + undo/redo key hook
  - `schema/types.ts`: source-of-truth authoring schema
  - `stores/*.ts`: persisted editor state (`editor-*` localStorage)
  - `components/**`: CRUD pages and panels
  - `dsl/*`: parser, grammar, completions, test evaluator
- Runtime content payload: `public/data/game-content.json`

## Model usage policy (cost control)
- Use lightweight model/workflow for discovery and simple refactors.
- Use Opus only for one of these:
  - cross-file architecture changes
  - ambiguous logic with multiple valid designs
  - complex debugging after deterministic checks fail
- Never spend Opus tokens on:
  - listing files, grep results, formatting-only edits, or obvious mechanical changes

## Context budget policy
- Start with `rg` and targeted reads. Do not load full large files by default.
- Read windows, not whole files:
  - first pass: <= 120 lines per relevant file
  - deep pass only for files being edited
- Hard cap before first plan: <= 8 files or <= 700 total lines read.
- Summarize discovered facts in <= 12 bullets before implementation.
- Re-open files only when line references are needed for edits/tests.

## Response contract (for any LLM)
Default output should be short and structured:
1. `Scope` (1-2 lines)
2. `Plan` (3-6 numbered steps)
3. `Edits` (file list only)
4. `Validation` (commands + pass/fail)
5. `Risks/Next` (max 3 bullets)

Do not include long prose unless explicitly requested.
Do not restate large code blocks unless asked.

## Project-specific implementation priorities
When planning work, prefer this order:
1. Data contract parity (editor authored fields vs runtime behavior)
2. Gameplay correctness (reducer and action resolution)
3. Export/import validation quality
4. Editor UX polish

### Known parity gaps (track explicitly)
- `allowedAbilityTags` authored in editor, not enforced in runtime targeting.
- `fixedInteractables` and `specialConnections` authored, not integrated into runtime room flow.
- Item `eventHooks` and status-effect templates are authored but largely not executed in runtime loop.
- DSL docs/completions have small mismatches with parser/runtime behavior.

## Implementation plan template (token-efficient)
Use this exact template for feature plans:

1. Objective
- Single sentence with player-visible outcome.

2. In-scope files
- Explicit file list only.

3. Data contract impact
- Which schema fields are read/written/ignored after change.

4. Steps
- 3-7 concrete actions, each tied to file(s).

5. Validation
- Exact commands and expected outcome.

6. Done criteria
- Observable behavior + typecheck/test conditions.

7. Non-goals
- What is intentionally not changed.

## Execution rules
- Edit smallest viable surface area.
- Avoid broad refactors during feature delivery.
- Keep runtime and editor compatibility unless task explicitly includes migration.
- If adding a new authored field, either:
  - implement runtime consumption now, or
  - add export warning marking it non-runtime.

## Validation commands
```bash
# game
npm run typecheck

# editor
cd content-editor && npm run typecheck
```
Add targeted test commands when present. Do not run large suites unless needed.

## Practical anti-patterns to avoid
- Loading entire `src/App.tsx` when only one reducer case is relevant.
- Re-explaining architecture every turn.
- Proposing multi-phase rewrites for single bug fixes.
- Editing editor schema without checking runtime consumers.
- Using LLM reasoning for tasks solvable by `rg`, typecheck, or direct inspection.

## Fast task routing
- Bug in cast/explore/combat flow: `src/App.tsx`, then `src/data/bridge.ts`.
- DSL parse/eval issue: `content-editor/src/dsl/*` and `src/data/evaluator.ts`.
- Missing content behavior: start at `content-editor/src/schema/types.ts`, then trace runtime usage.
- Import/export issue: `content-editor/src/stores/projectStore.ts` + `components/project/ExportPage.tsx`.

## Micro Prompts
- See MICRO_PROMPTS.md for copy-paste prompt templates.
- Default to those templates before writing custom long prompts.
- Prefer the smallest template that fits the task.
## Optional prompt stub for efficient planning
Use when asking any LLM for implementation plans:

"Produce a minimal implementation plan for this repo. Follow CLAUDE.md response contract. Keep under 220 tokens. Include only in-scope files, concrete steps, validation commands, and done criteria. Avoid architecture recap unless required for this task."

