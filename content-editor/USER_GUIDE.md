# Content Editor — User Guide

## Running the editor

```bash
cd content-editor
npm install      # first time only
npm run dev      # opens at http://localhost:5174
```

> **Windows / PowerShell note:** If you get a scripts disabled error, run this once:
> ```powershell
> Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
> ```

The game loads content from `public/data/game-content.json`. After editing, export from the **Export / Import** page and replace that file.

---

## Sidebar

**Undo / Redo** buttons (or Ctrl+Z / Ctrl+Y) step through your edit history. History is per-session only — it resets on page reload.

All data auto-saves to `localStorage`, so closing and reopening the tab preserves your work.

---

## Pages

### Tags
Foundational labels used throughout the editor.

- **Activity Tags** — categorize interactable types (e.g. `tree`, `mine`). Give each a color for visual distinction in the editor.
- **Ability Tags** — categorize player abilities (e.g. `chop`, `cast`). Used to filter which skills can interact with which objects.

Create tags here before referencing them elsewhere.

---

### Storage Keys
Defines named player state variables (flags, counters, or string values). Referenced in DSL conditions and storage effects.

| Type | Use |
|------|-----|
| `flag` | Boolean (true/false) — e.g. `has_opened_chest` |
| `counter` | Integer — e.g. `enemies_defeated` |
| `value` | String or number — e.g. `faction_name` |

Set a **default value** for each key.

---

### Status Effects
Timed buffs/debuffs applied to the player. Each effect has:
- **Modifiers** — stat multipliers (attack, defense, speed, energy cost, etc.)
- **Duration** (ms) and optional **stack** behavior

---

### Items
Define all collectible and equippable items.

- **Slot** — set to equip in head/chest/legs/hand/accessory. Leave blank for consumables/resources.
- **Stackable** — whether multiples stack in one inventory slot.
- **Stats** — only fill in stats that differ from baseline (blanks are ignored).
- **Event Hooks** — trigger storage effects when the item is equipped, unequipped, used, etc.

---

### Skills
Define passive and active skills.

- **Kind** — `passive` tracks XP and levels; `active` is cast by the player and requires a linked passive.
- **Linked Passive** — every active skill must link to a passive (they share a level pool).
- **Cast Duration / Energy Cost / Power** — only relevant for active skills.
- **XP Curve** — Base XP sets level-1 threshold; XP Scaling multiplies it each level.
- **Unlock Condition** — DSL expression evaluated against game state. Leave blank to start unlocked.
- **Tags** — Activity tags determine what objects this skill can target; ability tags describe the action type.

---

### Combos
Chain two active skills together for a timed bonus.

- **From / To Skill** — the skill sequence that triggers the combo.
- **Activity Tag** — limit the combo to a specific activity, or leave as "Any".
- **Window (ms)** — how long after using the first skill the second must be used.
- **Bonuses** — multipliers applied to time and energy cost. Values below `1.0` are reductions (e.g. `0.7` = 30% faster).

The editor warns you if another combo has an identical from→to→tag combination.

---

### Interactables
Define resources and objects the player can interact with (trees, rocks, chests, etc.).

- **Activity Tag** — what type of thing this is (must match skill activity tags).
- **Allowed Ability Tags** — which player abilities can target it.
- **Required Level** — minimum passive skill level to interact.
- **Health Range** — randomized effective HP (min/max).
- **Spawn Condition** — DSL expression; object only appears if this evaluates true.
- **Abilities** — the actions available on this object, each with damage range and timing.
- **Loot Table** — items dropped on destroy. Set `chance` (0–1) and quantity range per entry.
- **XP Rewards** — XP granted per skill on interact and on destroy.
- **Storage Effects** — `onInteract` / `onDestroy` effects modify player storage keys (set flag, increment counter, etc.).

---

### World Map

#### World Settings (top panel)
- Set world name, grid dimensions, and default slot count (slots = how many objects can occupy a room at once).
- **Starting Inventory** — toggle which equippable items the player starts with.
- **Starting Room** — select which room the player spawns in.

#### Grid
- **Click an empty cell** to create a room at that position.
- **Click a filled cell** to open that room's editor.
- The starting room is highlighted.

#### Room Editor
- **Slot Count** — overrides the world default for this room.
- **Entry Condition** — DSL expression; room is only accessible if this is true.
- **Spawn Table** — which interactables appear here and at what frequency (chance 0–1, count range).
- **Fixed Interactables** — always-present objects (not procedurally spawned).
- **Room Connections** — link to adjacent rooms (defines the map graph).
- **Seed Overrides** — force a specific RNG seed for a named spawn slot, for hand-crafted layouts.

---

### Export / Import

- **Content Summary** — counts of all defined entities.
- **Validation** — lists errors (must fix before export) and warnings.
- **Export** — downloads `game-content.json`. Copy it to `public/data/` in the game project to apply changes.
- **Import** — load a previously exported JSON to resume editing.
- **Reset to Defaults** — wipes all editor data and reloads with seed data. Irreversible.

---

### Test Conditions
Live DSL condition tester. Useful when writing unlock conditions or spawn conditions.

1. Type a condition expression in the input field.
2. Set mock values for skill levels, item counts, storage keys, and room state.
3. The result updates in real time — **TRUE** (green) or **FALSE** (red).

#### DSL reference

| Expression | Returns |
|---|---|
| `skill("id").level` | number |
| `skill("id").unlocked` | boolean |
| `player.has_item("id")` | boolean |
| `player.item_count("id")` | number |
| `player.flag("keyId")` | boolean |
| `player.counter("keyId")` | number |
| `player.value("keyId")` | string/number |
| `room.id` | string |
| `room.explore_count` | number |
| `target.tag` | string |

Operators: `AND`, `OR`, `NOT`, `==`, `!=`, `>=`, `<=`, `>`, `<`

Example: `skill("treecutting").level >= 3 AND NOT player.flag("tutorial_done")`
