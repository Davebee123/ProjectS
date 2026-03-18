# Content Source

`content/` is the canonical authored data for the game.

Rules:
- one JSON file per entity
- filename must match entity `id`
- world metadata lives at `content/worlds/<worldId>/world.json`
- room data lives at `content/worlds/<worldId>/rooms/<roomId>.json`
- `public/data/game-content.json` is generated, not hand-edited

Commands:

```bash
npm run content:validate
npm run content:build
npm run changelog:snapshot -- <version>
```

Migration helper:

```bash
npm run content:split
```

## Changelog workflow

Player-facing changelog data is generated to `public/data/changelog.json`.

Inputs:
- `changelog/config.json`
- `changelog/snapshots/*.json`
- `changelog/fragments/<version>/*.json`

Rules:
- content additions and balance changes are auto-derived from bundle diffs
- UI and bug-fix notes should be added as manual fragments

Release flow:
1. run `npm run changelog:snapshot -- <version>` when you cut a release baseline
2. keep a top `CURRENT` entry in `changelog/config.json` for unreleased work
3. add/update the matching snapshot entry in `changelog/config.json`
4. add manual fragments for UI/fix notes under `changelog/fragments/CURRENT/` or the released version folder
5. when you ship, copy the `CURRENT` notes into the released version folder as needed and create a new snapshot
6. run `npm run content:build`

Notes:
- `CURRENT` automatically diffs against the latest snapshot release in `changelog/config.json`
- empty releases are omitted from the generated `public/data/changelog.json`
