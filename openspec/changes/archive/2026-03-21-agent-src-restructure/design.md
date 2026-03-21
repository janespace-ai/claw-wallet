## Context

The `agent/` module is the core npm package (`claw-wallet`) that exposes the wallet's capabilities as TypeScript APIs and tool definitions. Currently, all 12 source modules sit directly in `agent/` alongside config files (`package.json`, `tsconfig.json`, `tsup.config.ts`), test directories (`tests/`), and sub-packages (`mcp-server/`, `skills/`). This flat layout makes it difficult to distinguish source code from project infrastructure at a glance.

Current structure (source files only):

```
agent/
├── chain.ts
├── config.ts
├── contacts.ts
├── history.ts
├── index.ts
├── monitor.ts
├── policy.ts
├── tool-registry.ts
├── transfer.ts
├── types.ts
├── validation.ts
├── e2ee/          (4 files)
├── signer/        (5 files)
└── tools/         (9 files)
```

Target structure:

```
agent/
├── src/
│   ├── index.ts
│   ├── chain.ts
│   ├── config.ts
│   ├── contacts.ts
│   ├── history.ts
│   ├── monitor.ts
│   ├── policy.ts
│   ├── tool-registry.ts
│   ├── transfer.ts
│   ├── types.ts
│   ├── validation.ts
│   ├── e2ee/
│   ├── signer/
│   └── tools/
├── tests/
├── mcp-server/
├── skills/
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

## Goals / Non-Goals

**Goals:**
- Separate source code into `src/` to clearly distinguish from project config, tests, and sub-packages
- Maintain all existing public exports and npm package interface
- Keep existing subdirectory groupings (`e2ee/`, `signer/`, `tools/`) intact inside `src/`
- Ensure `mcp-server/` and `tests/` continue to work after the move

**Non-Goals:**
- Renaming or reorganizing modules (e.g., merging/splitting files) — that's a separate effort
- Changing the public API surface
- Modifying sub-packages (`mcp-server/`, `skills/`) beyond fixing import paths

## Decisions

### 1. Wrap all source in `src/` without further nesting

**Decision**: Move all `.ts` source files into `agent/src/`, preserving the existing flat + subdirectory layout.

**Alternatives considered**:
- **(A) `src/core/`, `src/domain/`, `src/tools/`**: Adds a layered architecture. Rejected because the module only has ~12 files and the overhead of multi-layer directories isn't justified yet.
- **(B) `src/` with deep restructuring**: Would rename/merge modules. Rejected because it mixes two separate concerns (reorganize + rename) and increases risk.

**Rationale**: Scheme C (simple `src/` wrapper) gives the biggest clarity improvement with the smallest diff. Future restructuring can happen inside `src/` later if the module grows.

### 2. Update `tsconfig.json` rootDir to `src/`

**Decision**: Set `"rootDir": "src"` and `"include": ["src"]` so TypeScript only compiles source code. Tests remain excluded.

**Rationale**: Keeps `dist/` output clean (no `src/` prefix in output paths when rootDir matches the source root).

### 3. Update `tsup.config.ts` entry to `src/index.ts`

**Decision**: Change the entry point from `index.ts` to `src/index.ts`.

**Rationale**: tsup needs to know where the entry file is. The output paths (`dist/index.js`, `dist/index.cjs`) remain the same since tsup flattens by default.

### 4. Internal imports stay relative (no path aliases)

**Decision**: All internal imports use relative paths (`./chain.js`, `../signer/ipc-client.js`). Since all source moves together into `src/`, internal relative imports between source files **do not change**.

**Rationale**: Path aliases add complexity (`tsconfig` paths + bundler config). Relative imports are simpler and already work.

### 5. Test imports update to `../src/`

**Decision**: Tests in `agent/tests/` currently import from `../chain.js` etc. These will change to `../src/chain.js`.

**Rationale**: Tests are outside `src/`, so their relative paths to source files change by one directory level.

## Risks / Trade-offs

- **[Risk] `dist/` output path changes** → Mitigation: tsup uses entry-relative output, so `dist/index.js` stays the same. Verify with a test build before committing.
- **[Risk] `mcp-server/` build breaks** → Mitigation: `mcp-server` depends on the npm package interface (`claw-wallet` via `file:..`), which is defined by `package.json` `exports` field pointing to `dist/`. As long as `dist/` is correct, no change needed. Rebuild both packages to verify.
- **[Risk] Forgotten import path** → Mitigation: Run `tsc --noEmit` and `npm test` after the move to catch any missed paths.
