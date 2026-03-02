# Incremental Fantasy RPG - Micro Prompts

Use these prompts to reduce token usage and keep output execution-focused.

## 1) Bugfix (small)
```text
Fix this bug with minimal context usage.

Task:
<describe bug>

Constraints:
- Read only directly relevant files.
- Max 6 files, max 500 lines before first fix.
- No architecture recap.

Output:
1. Scope (1 line)
2. Plan (max 4 steps)
3. Edits (file list)
4. Validation commands
5. Risks (max 2)
```

## 2) Feature slice (narrow)
```text
Implement one narrow feature slice.

Feature:
<feature>

In-scope files:
<explicit file list>

Rules:
- Do not edit files outside scope unless blocked.
- Keep backward compatibility with game-content.json.
- Smallest viable change only.

Return:
- Objective
- Data contract impact
- Step-by-step edits
- Done criteria
- Non-goals
```

## 3) Refactor (safe)
```text
Do a low-risk refactor for readability only.

Target:
<file/function>

Rules:
- No behavior changes.
- Keep public interfaces unchanged.
- Show verification.

Output:
- Refactor intent
- Exact edits
- Why behavior is unchanged
- Typecheck result
```

## 4) Review (risk-only)
```text
Review this area for correctness risks only.

Scope:
<commit/files>

Focus:
- Bugs
- Regressions
- Missing tests/validation

Skip:
- Style-only comments
- Broad redesign

Output:
- Findings ordered by severity
- File + line refs
- One-line fix direction per finding
```

## 5) Plan (ultra-compact)
```text
Produce a minimal implementation plan.

Goal:
<goal>

Constraints:
- Keep under 180 tokens.
- No architecture summary.

Include only:
- In-scope files
- 3-6 concrete steps
- Validation commands
- Done criteria
- Non-goals
```

## 6) Large task decomposition
```text
Break this task into shippable slices.

Task:
<large task>

Requirements:
- Each slice <= 1 PR
- Explicit acceptance criteria
- Dependencies called out

Output table:
Slice | Files | Risk | Validation | Ship value
```

## 7) Debug with stop-loss
```text
Debug with strict budget.

Issue:
<issue>

Budget:
- Max 3 hypotheses
- Max 5 commands
- Max 2 edit attempts before reassessment

Return:
- Evidence per hypothesis
- Chosen fix
- Why alternatives were rejected
```

## 8) Editor-runtime parity check
```text
Check editor-vs-runtime parity for this feature.

Target:
<feature/field>

Do:
- Trace schema -> editor UI -> export -> runtime consumer
- Identify missing links

Output:
- Status: implemented | stubbed | editor-only
- Missing runtime hooks
- Minimal patch plan
```

## 9) Runtime reducer change
```text
Implement this reducer change with minimal blast radius.

Behavior change:
<expected runtime behavior>

Files first:
- src/App.tsx
- src/data/bridge.ts (only if needed)

Rules:
- Touch only relevant action cases.
- Preserve existing save/content compatibility.

Return:
- Modified action flow
- Edge cases handled
- Validation commands and results
```

## 10) Export validation rule
```text
Add one export validation rule.

Rule:
<rule>

Files:
- content-editor/src/components/project/ExportPage.tsx
- optional: schema/store files only if required

Return:
- Validation logic
- Error/warning example
- How to test quickly
```

## Global add-on line (optional)
Append this to any prompt:

```text
Use the CLAUDE.md response contract. Keep answer concise. Avoid repeating discovered context.
```
