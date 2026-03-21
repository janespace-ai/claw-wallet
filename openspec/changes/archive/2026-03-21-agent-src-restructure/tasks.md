## 1. Create `src/` Directory and Move Source Files

- [x] 1.1 Create `agent/src/` directory
- [x] 1.2 Move root-level `.ts` source files into `src/`: `index.ts`, `chain.ts`, `config.ts`, `contacts.ts`, `history.ts`, `monitor.ts`, `policy.ts`, `tool-registry.ts`, `transfer.ts`, `types.ts`, `validation.ts`
- [x] 1.3 Move `e2ee/` directory into `src/e2ee/`
- [x] 1.4 Move `signer/` directory into `src/signer/`
- [x] 1.5 Move `tools/` directory into `src/tools/`

## 2. Update Build Configuration

- [x] 2.1 Update `tsconfig.json`: set `rootDir` to `"src"` and `include` to `["src"]`
- [x] 2.2 Update `tsup.config.ts`: change entry from `"index.ts"` to `"src/index.ts"`

## 3. Update Test Import Paths

- [x] 3.1 Update `tests/chain.test.ts`: `../chain.js` → `../src/chain.js`
- [x] 3.2 Update `tests/contacts.test.ts`: `../contacts.js` → `../src/contacts.js`
- [x] 3.3 Update `tests/history.test.ts`: `../history.js` and `../types.js` → `../src/...`
- [x] 3.4 Update `tests/policy.test.ts`: `../policy.js` → `../src/policy.js`
- [x] 3.5 Update `tests/e2e.test.ts`: `../index.js` → `../src/index.js`
- [x] 3.6 Update `tests/e2ee/crypto.test.ts`: `../../e2ee/crypto.js` → `../../src/e2ee/crypto.js`
- [x] 3.7 Update `tests/e2ee/integration.test.ts`: `../../e2ee/crypto.js` → `../../src/e2ee/crypto.js`
- [x] 3.8 Update `tests/signer/integration.test.ts`: `../../signer/ipc-client.js` → `../../src/signer/ipc-client.js`
- [x] 3.9 Update `tests/signer/protocol.test.ts`: `../../signer/ipc-protocol.js` → `../../src/signer/ipc-protocol.js`
- [x] 3.10 Update `tests/security/file-system.test.ts`: `../../validation.js`, `../../contacts.js`, `../../history.js`, `../../policy.js` → `../../src/...`
- [x] 3.11 Update `tests/security/input-validation.test.ts`: `../../validation.js` → `../../src/validation.js`
- [x] 3.12 Update `tests/security/policy-bypass.test.ts`: `../../policy.js` → `../../src/policy.js`
- [x] 3.13 Update `tests/security/rpc.test.ts`: `../../chain.js`, `../../types.js` → `../../src/...`

## 4. Verify Build and Tests

- [x] 4.1 Run `tsc --noEmit` to verify no TypeScript errors
- [x] 4.2 Run `npm run build` in `agent/` to verify build output
- [x] 4.3 Verify `dist/` output structure (entry points `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts` still exist)
- [x] 4.4 Run `npm test` in `agent/` to verify all tests pass
- [x] 4.5 Run `npm run build` in `agent/mcp-server/` to verify sub-package still builds
