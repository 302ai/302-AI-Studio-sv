# AGENTS.md - AI Agent Development Guide

## Essential Commands
- **Dev**: `pnpm run dev` - Start Electron app with hot reload
- **Build**: `pnpm run build` - Build SvelteKit for production
- **Typecheck**: `pnpm run check` - Run Svelte type checking (run after changes)
- **Lint**: `pnpm run lint` - ESLint checking | `pnpm run lint:fix` - Auto-fix
- **Format**: `pnpm run format` - Format with Prettier | `pnpm run format:check` - Check only
- **Quality check**: `pnpm run quality` - Run check + lint + format:check (run before commits)
- **Tests**: `pnpm run test:unit` - Vitest unit tests | `pnpm run test:e2e` - Playwright e2e tests
- **Single test**: `pnpm run test:unit -- <file>` or `pnpm run test:e2e -- <file>`

## Architecture
- **Stack**: SvelteKit 5 + Electron 38 + TypeScript + TailwindCSS 4.x
- **State**: Svelte 5 runes (`$state`, `$derived`) in singleton classes (e.g., `src/lib/stores/chat-state.svelte.ts`)
- **UI**: Shadcn-Svelte (bits-ui) in `src/lib/components/ui/`, business components in `src/lib/components/buss/`
- **IPC**: Type-safe auto-generated bindings via custom Vite plugin (services in `electron/main/services/`)
- **i18n**: Inlang Paraglide-js (base: zh, supports en) - messages in `/messages/`, API in `$lib/paraglide/`
- **Routes**: `src/routes/(with-sidebar)/` for main app, `src/routes/(settings-page)/settings/` for settings

## Code Style & Conventions
- **Package Manager**: MUST use `pnpm` (includes critical patches)
- **State Management**: Singleton class instances with Svelte 5 runes (not stores), use `$state()` and `$derived()` properties
- **Imports**: Use `$lib` alias for `src/lib`, check existing imports before adding new libraries
- **Components**: Follow Shadcn-Svelte patterns, use `tailwind-variants` for styling variants
- **Types**: Define in `src/lib/types/`, shared types in `shared/types/`
- **Naming**: camelCase for vars/functions, PascalCase for components/classes, kebab-case for files
- **Error Handling**: Use ChatErrorHandler pattern from `$lib/utils/error-handler`
- **No comments**: Avoid code comments unless explicitly requested or code is highly complex
