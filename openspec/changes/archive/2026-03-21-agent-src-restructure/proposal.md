## Why

The `agent/` module has a flat directory structure where all source files (12 modules), configuration files, build config, and sub-packages (`mcp-server/`, `skills/`) coexist at the same level. This makes it hard to distinguish between source code, build artifacts, tests, and sub-packages at a glance. Introducing a `src/` directory will clearly separate source code from project-level concerns, align with Node.js/TypeScript package conventions, and make the codebase easier to navigate as it grows.

## What Changes

- Move all agent source files (`.ts`) from `agent/` root into `agent/src/`, preserving existing subdirectory groupings (`e2ee/`, `signer/`, `tools/`)
- Update `tsconfig.json` `rootDir` and `include` to point to `src/`
- Update `tsup.config.ts` entry point from `index.ts` to `src/index.ts`
- Fix all internal relative imports to reflect new paths
- Update `mcp-server/` dependency resolution (the `file:..` reference points to agent root, which uses `exports` — no change needed to the package reference itself, only ensuring `dist/` output remains correct)
- Update test import paths in `tests/` to reference `../src/` instead of `../`

## Capabilities

### New Capabilities

_(none — this is a pure structural refactoring with no new behavior)_

### Modified Capabilities

_(none — no spec-level behavior changes, only file layout)_

## Impact

- **Code**: All `.ts` source files under `agent/` root move into `agent/src/`. Subdirectories `e2ee/`, `signer/`, `tools/` move into `src/` as well.
- **Build Config**: `tsconfig.json`, `tsup.config.ts` need path updates. Output `dist/` structure may have slightly different nesting.
- **Tests**: Import paths in `agent/tests/` need updating to `../src/`.
- **Sub-packages**: `mcp-server/` depends on `claw-wallet` via `file:..` — the npm package interface (`exports` field in `package.json`) is unchanged, so no impact after rebuild.
- **No breaking changes to public API** — the published package entry points remain the same.
