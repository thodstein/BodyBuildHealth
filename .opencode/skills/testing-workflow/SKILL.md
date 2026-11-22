---
name: Testing Workflow
description: Run the right vitest suite, understand the jsdom/IndexedDB setup and avoid the known false failures
---

# Testing in this repo

## Commands

| Command              | Scope                       | Notes                             |
| -------------------- | --------------------------- | --------------------------------- |
| `npm test`           | everything                  | `vitest run`, slow (1000+ files)  |
| `npm run test:bb`    | `src/engines/bb/__tests__`  | 324 files, single fork, 8 GB heap |
| `npm run test:ui`    | `src/ui`                    | 746 test files, single fork       |
| `npm run test:core`  | `src/core`                  | 61 files, single fork             |
| `npm run type-check` | all `.ts/.tsx` except tests | ~`tsc --noEmit`                   |

Pick the suite by path: `src/engines/bb` → `test:bb`, `src/ui` → `test:ui`, `src/core` → `test:core`,
`src/engines/*` other than bb / `src/data` / `src/lib` / `src/utils` → plain `npm test <path>`.
`project_verify` (tool) does this mapping automatically for the changed files, and `/verify` runs the same thing.
**CI runs only `type-check` + `build`, not vitest** — the suites are your responsibility locally.

## Config facts (`vitest.config.ts`)

- `globals: true`, `environment: 'jsdom'`, `setupFiles: ['src/test/setup.ts']`,
  `testTimeout` / `hookTimeout` = **15 s**, coverage `v8`, alias `@` → `src` (also `~` → `public` in vite, `@/*` in tsconfig).
- `tsconfig.json` excludes `*.test.ts(x)` and `__tests__` from `tsc`, so **`npm run type-check` does not type-check
  tests**. A broken test import or type only shows up when vitest loads the file.

## `src/test/setup.ts` mocks

- `@testing-library/jest-dom/vitest` matchers.
- `URL.createObjectURL` / `revokeObjectURL` polyfills (jsdom has none — Blob/PDF code needs them).
- `localStorage`, `matchMedia`.
- A full in-memory **IndexedDB mock** (async `onsuccess`/`oncomplete` via microtasks, `keyOf = id ?? date ?? key`).
  Without it `db.init()` hangs over 8 stores × 3 retries, which looks like a timeout, not a missing mock.

## Pitfalls

- Heavy DOM screens (cardio hub, diary, taper) exceed the default 5 s under parallel load — that is why the timeout
  is 15 s and the suites force `--pool=forks --maxForks=1`. Don't "fix" a timeout by raising it before checking
  whether the test awaits an unmocked promise.
- Multiple `npm test` runs in parallel fight over memory; run one suite at a time.
- Snapshot/DOM assertions on inline styles are fragile — prefer `data-*` hooks (`data-tab`, `data-badge`,
  `data-lift`, `data-notes`) that the APK marker check also relies on.
- Catalog tests mutate global data: call `clearBBCatalogIndex()` (and reset `FOOD_DB` changes) between tests.

## Conventions

- Tests live in `__tests__` next to the source, named `<subject>.test.ts` / `.test.tsx`; helpers in
  `__tests__/*-helpers.ts` (BB: `bb-test-helpers.ts`).
- The only shared fixture file is `src/data/__tests__/nutrition-usda-top100.fixture.ts`.
- Test names and assertions in Russian are normal here; keep the `describe` subject matching the module.
- After edits: run the suite, then `npm run type-check`. For APK-facing UI also run `npm run verify:apk-design`.
