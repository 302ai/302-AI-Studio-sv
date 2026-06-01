# 302 AI Studio - Architecture Blueprint

> **Generated**: 2026-06-01  
> **Project**: 302 AI Studio v26.22.0  
> **Repository**: https://github.com/302ai/302-AI-Studio-sv

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure](#3-project-structure)
4. [Electron Main Process Architecture](#4-electron-main-process-architecture)
5. [SvelteKit Renderer Architecture](#5-sveltekit-renderer-architecture)
6. [IPC Communication Pattern](#6-ipc-communication-pattern)
7. [State Management](#7-state-management)
8. [Storage Architecture](#8-storage-architecture)
9. [Plugin System](#9-plugin-system)
10. [Service Layer Architecture](#10-service-layer-architecture)
11. [Data Flow Patterns](#11-data-flow-patterns)
12. [Build and Development Pipeline](#12-build-and-development-pipeline)
13. [Testing Strategy](#13-testing-strategy)
14. [Extension Points](#14-extension-points)

---

## 1. Architecture Overview

302 AI Studio is a **desktop AI application** built with a modern hybrid architecture combining Electron for native desktop capabilities with SvelteKit for the user interface.

### Architectural Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Shell                            │
│  ┌─────────────────┐    ┌──────────────────────────────────┐│
│  │   Main Process   │    │        Renderer Process          ││
│  │                  │    │                                  ││
│  │  ┌────────────┐  │    │  ┌────────────────────────────┐  ││
│  │  │  Services   │  │◄──►│  │      SvelteKit App         │  ││
│  │  │  (Node.js) │  │ IPC│  │                            │  ││
│  │  └────────────┘  │    │  │  ┌────────┐  ┌──────────┐  │  ││
│  │                  │    │  │  │ Routes │  │  Stores  │  │  ││
│  │  ┌────────────┐  │    │  │  └────────┘  └──────────┘  │  ││
│  │  │  Storage    │  │    │  └────────────────────────────┘  ││
│  │  └────────────┘  │    │                                  ││
│  └─────────────────┘    └──────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Key Architectural Principles

1. **Separation of Concerns**: Clear boundary between main process (Node.js) and renderer (SvelteKit)
2. **Service-Oriented Design**: Business logic encapsulated in singleton service classes
3. **Auto-Generated IPC**: Type-safe communication via code generation
4. **Reactive State**: Svelte 5 runes for fine-grained reactivity
5. **File-Based Storage**: JSON file storage with unstorage driver
6. **Plugin Extensibility**: Dynamic plugin loading and API exposure

---

## 2. Technology Stack

### Core Technologies

| Layer         | Technology     | Version | Purpose                        |
| ------------- | -------------- | ------- | ------------------------------ |
| **Runtime**   | Electron       | v38.x   | Desktop shell, native APIs     |
| **Frontend**  | SvelteKit      | v2.x    | UI framework with routing      |
| **UI Engine** | Svelte         | v5.x    | Reactive components with runes |
| **Styling**   | Tailwind CSS   | v4.x    | Utility-first CSS              |
| **Language**  | TypeScript     | v5.x    | Type-safe development          |
| **Build**     | Vite           | v7.x    | Fast bundler and dev server    |
| **Packaging** | Electron Forge | v7.x    | Build, package, publish        |

### Key Libraries

- **AI Integration**: `@ai-sdk/*`, `ai` (Vercel AI SDK)
- **State Management**: Svelte 5 runes (`$state`, `$derived`, `$effect`)
- **Storage**: `@302ai/unstorage` (file-based key-value storage)
- **UI Components**: `bits-ui`, `layerchart`, `paneforge`
- **Rich Text**: `lexical`, `svelte-lexical`
- **Code Editor**: `codemirror`
- **Internationalization**: `@inlang/paraglide-js`
- **Validation**: `zod`, `arktype`

---

## 3. Project Structure

```
302-AI-Studio/
├── electron/                    # Electron main process
│   ├── main/                    # Main process code
│   │   ├── constants/           # App constants and configuration
│   │   ├── factories/           # Factory patterns (WebContents, etc.)
│   │   ├── generated/           # Auto-generated IPC code
│   │   ├── mixins/              # Shared behavior mixins
│   │   ├── plugin-manager/      # Plugin loading and API
│   │   ├── server/              # Internal HTTP server (Hono)
│   │   ├── services/            # Business logic services
│   │   │   ├── app-service/     # App lifecycle, theme
│   │   │   ├── storage-service/ # Data persistence
│   │   │   ├── chat-messages-service/
│   │   │   ├── provider-service/
│   │   │   └── ...             # 30+ service modules
│   │   └── utils/               # Utility functions
│   └── preload/                 # Preload scripts (IPC bridge)
│
├── src/                         # SvelteKit renderer
│   ├── lib/                     # Shared library code
│   │   ├── api/                 # API client wrappers
│   │   ├── components/          # Reusable UI components
│   │   ├── hooks/               # Custom Svelte hooks
│   │   ├── stores/              # State management (Svelte 5 runes)
│   │   │   ├── chat-state.svelte.ts
│   │   │   ├── provider-state.svelte.ts
│   │   │   └── ...             # 30+ state modules
│   │   ├── settings/            # Settings UI components
│   │   └── types/               # TypeScript type definitions
│   │
│   ├── routes/                  # SvelteKit routes
│   │   ├── (settings-page)/     # Settings layout group
│   │   ├── (with-sidebar)/      # Main app layout with sidebar
│   │   ├── shell/               # Shell window route
│   │   └── +layout.svelte       # Root layout
│   │
│   ├── shared/                  # Shared between main & renderer
│   │   ├── config/              # Configuration constants
│   │   ├── logger/              # Logging utilities
│   │   ├── storage/             # Storage type definitions
│   │   ├── types/               # Shared TypeScript types
│   │   └── utils/               # Shared utility functions
│   │
│   └── paraglide/               # i18n translations
│
├── packages/                    # Monorepo packages
│   ├── plugin-sdk/              # Plugin development SDK
│   └── plugin-registry/         # Plugin registry
│
├── vite-plugins/                # Custom Vite plugins
│   └── ipc-service-generator/   # IPC code generation
│
├── scripts/                     # Build and utility scripts
│   ├── generate-ipc.ts          # IPC generation script
│   └── generate.ts              # Code generation (services, states)
│
└── static/                      # Static assets
```

### Path Aliases

```typescript
// Defined in svelte.config.js
$lib      → src/lib
@shared   → src/shared
@electron → electron
```

---

## 4. Electron Main Process Architecture

### Entry Point

**File**: `electron/main/index.ts`

The main process orchestrates:

1. **App Lifecycle**: Single instance lock, window management
2. **Service Initialization**: All services initialized at startup
3. **IPC Registration**: Auto-generated handlers registered
4. **Protocol Handling**: Custom `app://` protocol for renderer
5. **Deep Link Handling**: `ai302studio://` URL scheme

### Service Registry Pattern

```typescript
// electron/main/services/index.ts
export const appService = new AppService();
export const windowService = new WindowService();
export const tabService = new TabService();
export const threadService = new ThreadService();
// ... 30+ singleton services
```

### Service Base Pattern

Every service follows this pattern:

```typescript
export class SomeService {
	// Methods decorated with @ipc will be exposed to renderer
	async someMethod(_event: IpcMainInvokeEvent, param: string): Promise<Result> {
		// Implementation
	}
}
```

### Key Services

| Service               | Responsibility                    |
| --------------------- | --------------------------------- |
| `AppService`          | Theme, user agent, app metadata   |
| `WindowService`       | Window creation, lifecycle, focus |
| `TabService`          | Tab management, navigation        |
| `StorageService`      | Base class for all storage        |
| `ProviderService`     | AI provider configuration         |
| `ChatMessagesService` | Chat history persistence          |
| `ThreadService`       | Conversation thread management    |
| `ShortcutService`     | Keyboard shortcuts                |
| `PluginService`       | Plugin loading and API            |
| `UpdaterService`      | Auto-updates                      |

---

## 5. SvelteKit Renderer Architecture

### Routing Strategy

SvelteKit uses **grouped layouts** for different app sections:

```
routes/
├── (with-sidebar)/           # Main app with sidebar
│   ├── +layout.svelte        # Sidebar layout
│   └── [threadId]/           # Dynamic thread routes
│
├── (settings-page)/          # Settings pages
│   ├── +layout.svelte        # Settings layout
│   ├── general/
│   ├── providers/
│   └── ...
│
└── shell/                    # Shell window (minimal chrome)
```

### Component Architecture

Components follow a hierarchical pattern:

```
src/lib/components/
├── ui/                        # Base UI primitives (bits-ui based)
│   ├── button/
│   ├── dialog/
│   ├── input/
│   └── ...
├── chat/                      # Chat-specific components
├── sidebar/                   # Sidebar components
├── settings/                  # Settings components
└── shared/                    # Cross-feature shared components
```

### Component Pattern

```svelte
<script lang="ts">
	// Props using Svelte 5 syntax
	let { prop1, prop2 = "default" }: Props = $props();

	// Local state
	let localState = $state(initialValue);

	// Derived state
	let derived = $derived(expression);

	// Effects
	$effect(() => {
		// Side effects
	});
</script>

<div class="tailwind-classes">
	<!-- Template -->
</div>
```

---

## 6. IPC Communication Pattern

### Auto-Generated IPC

The project uses a **code generation** approach for type-safe IPC:

```
┌─────────────────────────────────────────────────────────────┐
│                    IPC Generation Flow                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  electron/main/services/*.ts                                │
│         │                                                   │
│         ▼                                                   │
│  vite-plugins/ipc-service-generator                         │
│         │                                                   │
│         ├──► electron/main/generated/ipc-registration.ts    │
│         │    (Main process handler registration)            │
│         │                                                   │
│         └──► electron/main/generated/preload-services.ts    │
│              (Preload script bridge)                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### IPC Convention

Service methods with `_event: IpcMainInvokeEvent` as first parameter are automatically exposed:

```typescript
// electron/main/services/app-service/index.ts
export class AppService {
	// ✅ Will be exposed via IPC
	async getTheme(_event: IpcMainInvokeEvent): Promise<Theme> {
		return themeStorage.getThemeState();
	}

	// ❌ Private method, not exposed
	private internalMethod() {
		// ...
	}
}
```

### Renderer Access Pattern

```typescript
// In SvelteKit components
const theme = await window.electronAPI.appService.getTheme();
```

### IPC Channel Naming

Channels follow the pattern: `{serviceName}:{methodName}`

Example: `appService:getTheme`, `threadService:createThread`

---

## 7. State Management

### Svelte 5 Runes Pattern

State is managed using **Svelte 5 runes** in singleton classes:

```typescript
// src/lib/stores/theme.state.svelte.ts
export class ThemeState {
	// Private state
	#isLoading = $state(false);

	// Public derived state
	theme = $derived(persistedThemeState.current);
	isDark = $derived(this.theme.theme === "dark");

	// Actions
	toggleTheme() {
		setTheme(this.isDark ? "light" : "dark");
	}
}

// Singleton export
export const themeState = new ThemeState();
```

### State Categories

| Category            | Location                     | Pattern                     |
| ------------------- | ---------------------------- | --------------------------- |
| **UI State**        | `src/lib/stores/*.svelte.ts` | Ephemeral, component-scoped |
| **Persisted State** | `PersistedState` hook        | Synced to localStorage      |
| **Server State**    | IPC calls                    | Fetched from main process   |

### PersistedState Hook

```typescript
// src/lib/hooks/persisted-state.svelte.ts
class PersistedState<T> {
	current = $state<T>(defaultValue);
	isHydrated = $state(false);

	constructor(key: string, defaultValue: T) {
		// Hydrate from localStorage
		// Sync changes back
	}
}
```

### State Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     State Flow Diagram                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Main Process (Storage)                                     │
│         │                                                   │
│         ▼ IPC                                               │
│  Renderer State (Svelte 5 runes)                            │
│         │                                                   │
│         ▼ $derived                                           │
│  Component Props                                            │
│         │                                                   │
│         ▼ Template                                          │
│  DOM                                                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Storage Architecture

### Storage Service Hierarchy

```
StorageService<T>                    # Base class
    │
    ├── ThemeStorage                 # Theme preferences
    ├── ProviderStorage              # AI provider configs
    ├── ThreadStorage                # Conversation threads
    ├── ChatMessagesStorage          # Chat history
    ├── TabStorage                   # Tab state
    ├── GeneralSettingsStorage       # App settings
    └── ...                          # 10+ storage modules
```

### Storage Implementation

**Base Class**: `electron/main/services/storage-service/index.ts`

```typescript
export class StorageService<T extends StorageValue> {
	protected storage; // unstorage instance

	constructor(migrationConfig?: MigrationConfig<T>) {
		this.storage = createStorage<T>({
			driver: fsDriver({
				base: StorageService.storagePath, // User data directory
			}),
		});
	}

	async setItem(event: IpcMainInvokeEvent, key: string, value: T): Promise<void> {
		await this.storage.setItem(key, value);
	}

	async getItem(_event: IpcMainInvokeEvent, key: string): Promise<T | null> {
		return await this.storage.getItem<T>(key);
	}
}
```

### Storage Features

1. **File-Based**: JSON files in user data directory
2. **Migration Support**: Versioned data with migration configs
3. **Global Watcher**: File system watcher for cross-window sync
4. **Type Safety**: Generic type parameter for stored values

### Storage Location

```
Development: ./storage/
Production:  {userData}/storage/
```

---

## 9. Plugin System

### Plugin Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Plugin System                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  packages/plugin-sdk/           # Plugin development SDK    │
│         │                                                   │
│         ▼                                                   │
│  Plugin Manifest (package.json)                             │
│         │                                                   │
│         ▼                                                   │
│  electron/main/plugin-manager/  # Plugin loader             │
│         │                                                   │
│         ├──► plugin-loader.ts   # File system scanning      │
│         ├──► plugin-api.ts      # API exposure              │
│         └──► plugin-registry/   # Plugin registry           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Plugin API

Plugins receive access to:

- **Storage API**: Key-value persistence
- **UI API**: Register custom UI components
- **Event API**: Subscribe to app events
- **Provider API**: Custom AI provider integration

### Plugin Types

1. **AI Providers**: Custom model integrations
2. **UI Extensions**: Custom panels, views
3. **Tools**: Function calling tools
4. **Themes**: Custom visual themes

---

## 10. Service Layer Architecture

### Service Design Pattern

Each service follows a consistent pattern:

```typescript
// electron/main/services/some-service/index.ts
import { createLogger } from "@shared/logger";

const logger = createLogger("some-service");

export class SomeService {
	// Public IPC methods (exposed to renderer)
	async publicMethod(_event: IpcMainInvokeEvent, param: string): Promise<Result> {
		logger.info("publicMethod called", param);
		// Implementation
	}

	// Private helper methods
	private helperMethod(): void {
		// Not exposed via IPC
	}
}

// Singleton export
export const someService = new SomeService();
```

### Service Categories

| Category    | Services                                 | Responsibility |
| ----------- | ---------------------------------------- | -------------- |
| **Core**    | AppService, WindowService                | App lifecycle  |
| **Data**    | StorageService, DataService              | Persistence    |
| **AI**      | ProviderService, ChatMessagesService     | AI integration |
| **UI**      | TabService, TrayService, ShortcutService | User interface |
| **Plugin**  | PluginService, PluginRegistry            | Extensibility  |
| **Network** | ProxyForwardService, SSOService          | Networking     |
| **Update**  | UpdaterService                           | Auto-updates   |

### Service Communication

```
Service A ──► StorageService ──► File System
    │
    └──► EventEmitter ──► Other Services (pub/sub)
```

---

## 11. Data Flow Patterns

### Request Flow (User Action → UI Update)

```
1. User clicks button
2. Svelte component calls store action
3. Store calls window.electronAPI.service.method()
4. IPC invokes main process service
5. Service performs business logic
6. Service updates storage
7. Storage watcher notifies renderer
8. Store updates reactive state
9. Svelte reactivity updates DOM
```

### Chat Message Flow

```
User Input
    │
    ▼
ChatState.sendMessage()
    │
    ▼
IPC → ChatMessagesService
    │
    ▼
AI Provider (streaming)
    │
    ▼
IPC ← Stream chunks
    │
    ▼
ChatState updates
    │
    ▼
UI re-renders
```

### Storage Sync Flow

```
Window A writes to storage
    │
    ▼
GlobalStorageWatcher detects change
    │
    ▼
Notifies all subscribed windows
    │
    ▼
Window B updates local state
    │
    ▼
UI reflects changes
```

---

## 12. Build and Development Pipeline

### Development Mode

```bash
pnpm dev  # Starts Electron Forge dev server
```

**Process**:

1. Vite compiles SvelteKit to static files
2. Electron Forge starts Electron with Vite plugin
3. Main process loads from `.vite/build/main/`
4. Renderer loads from Vite dev server (HMR enabled)

### Production Build

```bash
pnpm build      # Compile SvelteKit + bundle main process
pnpm package    # Package with Electron Forge
pnpm make       # Create installers
```

### Build Pipeline

```
Source Code
    │
    ▼
TypeScript Compilation
    │
    ▼
Vite Bundling
    ├── Main process → .vite/build/main/
    ├── Preload scripts → .vite/build/preload/
    └── Renderer → .vite/renderer/main_window/
    │
    ▼
Electron Forge Packaging
    │
    ▼
Platform Installers (DMG, NSIS, DEB)
```

### Code Generation Scripts

```bash
pnpm generate:ipc    # Generate IPC bindings
pnpm gen:service     # Scaffold new service
pnpm gen:state       # Scaffold new state module
```

---

## 13. Testing Strategy

### Test Structure

```
src/
├── **/*.test.ts           # Unit tests (co-located)
└── **/*.spec.ts           # Integration tests

electron/
└── **/*.test.ts           # Main process tests
```

### Testing Tools

- **Framework**: Vitest
- **Component Testing**: @testing-library/svelte
- **Assertions**: @testing-library/jest-dom
- **Environment**: jsdom

### Test Commands

```bash
pnpm test:unit    # Run unit tests
pnpm test         # Run all tests (CI mode)
```

### Testing Patterns

```typescript
// Component test example
import { render, screen } from "@testing-library/svelte";
import Component from "./Component.svelte";

test("renders correctly", () => {
	render(Component, { props: { value: "test" } });
	expect(screen.getByText("test")).toBeInTheDocument();
});
```

---

## 14. Extension Points

### Adding a New Service

1. **Generate scaffold**:

    ```bash
    pnpm gen:service my-feature
    ```

2. **Implement service**:

    ```typescript
    // electron/main/services/my-feature-service/index.ts
    export class MyFeatureService {
    	async doSomething(_event: IpcMainInvokeEvent): Promise<void> {
    		// Implementation
    	}
    }
    export const myFeatureService = new MyFeatureService();
    ```

3. **IPC auto-generated**: Run `pnpm generate:ipc`

4. **Use in renderer**:
    ```typescript
    await window.electronAPI.myFeatureService.doSomething();
    ```

### Adding a New State Module

1. **Generate scaffold**:

    ```bash
    pnpm gen:state my-feature
    ```

2. **Implement state**:

    ```typescript
    // src/lib/stores/my-feature-state.svelte.ts
    class MyFeatureState {
    	data = $state<DataType[]>([]);
    	isLoading = $state(false);

    	async loadData() {
    		this.isLoading = true;
    		this.data = await window.electronAPI.myFeatureService.getData();
    		this.isLoading = false;
    	}
    }
    export const myFeatureState = new MyFeatureState();
    ```

### Adding a New Route

1. Create route directory in `src/routes/`
2. Add `+page.svelte` for the page
3. Optionally add `+layout.svelte` for nested layout

### Creating a Plugin

See `packages/plugin-sdk/README.md` for plugin development guide.

---

## Architecture Governance

### Code Quality Gates

1. **TypeScript**: Strict mode enabled
2. **Linting**: ESLint with Svelte plugin
3. **Formatting**: Prettier with Svelte plugin
4. **Pre-commit**: Automated checks via husky

### Conventional Commits

```
feat: Add new feature
fix: Fix bug
chore: Maintenance task
docs: Documentation update
refactor: Code refactoring
test: Add or update tests
```

### Package Manager

**pnpm** is required (project uses patched dependencies).

---

## Quick Reference

### Common Commands

```bash
pnpm dev              # Start development
pnpm build            # Build for production
pnpm quality          # Run all quality checks
pnpm generate:ipc     # Regenerate IPC bindings
pnpm gen:service      # Generate new service
pnpm gen:state        # Generate new state module
```

### Key File Locations

| What               | Where                                 |
| ------------------ | ------------------------------------- |
| Main process entry | `electron/main/index.ts`              |
| Services           | `electron/main/services/`             |
| State modules      | `src/lib/stores/`                     |
| Shared types       | `src/shared/types/`                   |
| IPC generator      | `vite-plugins/ipc-service-generator/` |
| Routes             | `src/routes/`                         |

### Architecture Principles

1. **Services are singletons**: One instance per service
2. **IPC is auto-generated**: Never manually write IPC code
3. **State uses runes**: `$state`, `$derived`, `$effect`
4. **Storage is file-based**: JSON files via unstorage
5. **Components are reactive**: Svelte 5 syntax only

---

_This document should be updated as the architecture evolves. Last updated: 2026-06-01_
