# Repository Guidelines

## Project Structure & Module Organization

Renderer code lives in `src`; routes sit in `src/routes` and shared UI utilities in `src/lib`. Cross-process types stay in `shared`, with persisted storage helpers under `shared/storage`. Electron main-process logic is organized in `electron/main` (add services in `services/` and re-export via `index.ts`), while preload bridges live in `electron/preload`. Automation scripts reside in `scripts`, Playwright specs in `e2e`, static assets in `static`, and supporting docs in `docs/` plus `messages/`.

## Architecture Overview

The app boots through `electron/main/index.ts`, registering the custom `app://` scheme before delegating to `windowService.initShellWindows()`. `windowService` restores the saved window → tab mapping from `tabStorage`, creates BrowserWindow “shell” instances, and wires a dedicated shell `WebContentsView` for window-level chrome. Individual tabs are spawned as additional `WebContentsView`s via `WebContentsFactory.createTabView`, each staged with per-thread data snapshots from `TempStorage`. `tabService` manages those views—resizing, toggling visibility, and keeping active-tab state—and handles tab moves or splits across windows. IPC handlers in `generated/ipc-registration` surface this orchestration to the renderer.

## Build, Test, and Development Commands

Install dependencies with `pnpm install`; pnpm is canonical. `pnpm dev` runs the Electron Forge loop with hot reload. `pnpm build` compiles the Vite renderer only—pair it with `pnpm make` when testing packaged output. Run `pnpm quality` before reviews, or target `pnpm lint` / `pnpm format:check` individually. After changing shared IPC contracts, refresh auto-generated bindings through `pnpm generate:ipc`.

## Coding Style & Naming Conventions

Use TypeScript-first (`.ts`, `.svelte`). Prettier enforces tabs, double quotes, 100-character lines, and Svelte-aware formatting—run `pnpm format` before committing. ESLint (`eslint.config.js`) and `svelte-check` cover linting and type drift; address warnings promptly. Name Svelte components in PascalCase (`ComponentName.svelte`), stores/helpers in camelCase, and IPC channel constants in SCREAMING_SNAKE_CASE under `electron/main/constants`.

## Testing Guidelines

Vitest powers unit tests; colocate specs as `*.test.ts` or `*.spec.ts` and run `pnpm test:unit`. Playwright drives end-to-end coverage in `e2e/*.test.ts`; execute with `pnpm test:e2e` and attach artifacts when triaging. Favor deterministic fixtures over live network calls, and adjust `vitest-setup-client.ts` when shared globals shift.

## Commit & Pull Request Guidelines

Follow Conventional Commits (`feat`, `fix`, `chore`, etc.) as seen in `git log`; keep scopes meaningful and verbs imperative (e.g., `feat(ui): add thread filter`). Every PR needs a short summary, test notes (commands run), and linked issues. Provide before/after imagery for UI changes. Run `pnpm quality` plus any affected tests before requesting review.
