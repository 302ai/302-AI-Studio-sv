# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**302-AI-Studio** (v25.53.2-beta.2) is a sophisticated Electron desktop application providing an AI chat interface with multi-provider support. Built with SvelteKit 5 and modern web technologies, it features Code Agent (Claude Code sandbox), MCP integration, plugin system, multi-tab shell windows, theme customization, and comprehensive internationalization.

**License**: AGPL-3.0
**Repository**: https://github.com/302ai/302-AI-Studio-sv

## Key Architecture

| Layer                | Technology                                                                    |
| -------------------- | ----------------------------------------------------------------------------- |
| **Frontend**         | SvelteKit 2.39.1 + Svelte 5.38.10 + TypeScript 5.9.2                          |
| **Desktop**          | Electron 38.1.0 + Electron Forge 7.9.0                                        |
| **Styling**          | TailwindCSS 4.1.13 with custom theme system                                   |
| **UI Components**    | Shadcn-Svelte (bits-ui 2.9.8) - 60+ base components                           |
| **State Management** | Svelte 5 runes (`$state`, `$derived`) - 20+ stores                            |
| **Backend Server**   | Hono 4.9.10 (localhost:8089) for AI streaming                                 |
| **AI SDKs**          | ai 6.0.1, @ai-sdk/anthropic 3.0.0, @ai-sdk/openai 3.0.0, @ai-sdk/google 3.0.0 |
| **MCP**              | @modelcontextprotocol/sdk 1.20.0, @ai-sdk/mcp 1.0.0                           |
| **i18n**             | Inlang Paraglide-js 2.3.2 (zh base, en supported)                             |
| **IPC**              | Custom type-safe IPC service generator (22+ services)                         |
| **Storage**          | @302ai/unstorage with migration support                                       |
| **Testing**          | Vitest 3.2.4 + Playwright 1.55.0                                              |

## Development Commands

```bash
# Install dependencies (REQUIRED: uses pnpm 10.18.3 with patches)
pnpm install

# Development
pnpm run dev           # Start Electron app with development server
pnpm run start         # Alias for dev

# Code Quality
pnpm run lint          # ESLint code checking
pnpm run lint:fix      # Auto-fix ESLint issues
pnpm run format        # Format code with Prettier
pnpm run format:check  # Check code formatting
pnpm run quality       # Complete quality check (check + lint + format:check)
pnpm run quality:fix   # Auto-fix all possible issues (lint:fix + format)

# Type checking
pnpm run check         # Svelte + plugin-sdk type checking
pnpm run check:watch   # Watch mode type checking

# Testing
pnpm run test:unit     # Vitest unit tests
pnpm run test:e2e      # Playwright e2e tests
pnpm run test          # Run all tests (unit + e2e)

# Build and Package
pnpm run build         # Build SvelteKit for production
pnpm run package       # Package Electron app (output in /out directory)
pnpm run make          # Create distributable installer
pnpm run publish       # Publish to configured targets

# Release
pnpm run release       # Interactive release
pnpm run release:patch # Patch version bump
pnpm run release:minor # Minor version bump
pnpm run release:major # Major version bump
pnpm run release:beta  # Beta release

# Utilities
pnpm run preview       # Preview built SvelteKit app
pnpm run generate:ipc  # Regenerate IPC bindings
```

## Project Structure

```
302-AI-Studio-sv/
├── src/
│   ├── lib/
│   │   ├── components/
│   │   │   ├── ui/              # Shadcn-Svelte base components (60+)
│   │   │   │   ├── button/      # Button variants
│   │   │   │   ├── dialog/      # Modal dialogs and sheets
│   │   │   │   ├── sidebar/     # Sidebar navigation
│   │   │   │   ├── data-table/  # Data tables
│   │   │   │   └── ...          # Full shadcn-svelte component set
│   │   │   └── buss/            # Business components (30+ categories)
│   │   │       ├── chat/        # Chat interface and messages
│   │   │       ├── code-agent/  # Code agent UI components
│   │   │       ├── model-*/     # Model selection and config
│   │   │       ├── provider-*/  # Provider management
│   │   │       ├── mcp-*/       # MCP server components
│   │   │       ├── theme-*/     # Theme editor and switcher
│   │   │       ├── plugin-*/    # Plugin marketplace UI
│   │   │       ├── prompt-*/    # Prompt editors
│   │   │       └── settings/    # Settings UI components
│   │   ├── stores/              # Svelte 5 runes state (20+ stores)
│   │   │   ├── chat-state.svelte.ts        # Chat messages, input, attachments
│   │   │   ├── provider-state.svelte.ts    # AI providers/models
│   │   │   ├── thread-state.svelte.ts      # Thread management
│   │   │   ├── mcp-state.svelte.ts         # MCP servers
│   │   │   ├── tab-bar-state.svelte.ts     # Multi-tab management
│   │   │   ├── marketplace-state.svelte.ts # Plugin marketplace
│   │   │   ├── session-state.svelte.ts     # User session
│   │   │   ├── theme.state.svelte.ts       # Theme state
│   │   │   ├── code-agent/                 # Code agent specific stores
│   │   │   │   ├── code-agent-state.svelte.ts
│   │   │   │   ├── claude-code-state.svelte.ts
│   │   │   │   └── claude-code-sandbox-state.svelte.ts
│   │   │   └── ...                         # More state stores
│   │   ├── api/                 # Frontend API layer
│   │   │   ├── models.ts        # Model fetching
│   │   │   ├── sandbox-*.ts     # Code agent sandbox APIs
│   │   │   ├── 302-mcp-servers.ts # Built-in MCP servers
│   │   │   └── ...
│   │   ├── transport/           # Chat transport layer
│   │   ├── types/               # TypeScript definitions
│   │   ├── utils/               # Utility functions
│   │   ├── theme/               # Theme system
│   │   │   ├── theme-types.ts   # Theme type definitions
│   │   │   ├── theme-config.ts  # Theme configuration
│   │   │   └── theme-parser.ts  # CSS variable parsing
│   │   ├── datas/               # Static provider/model data
│   │   ├── hooks/               # Custom Svelte hooks
│   │   ├── shortcut/            # Keyboard shortcut handling
│   │   ├── constants/           # App constants
│   │   └── paraglide/           # Generated i18n (auto-generated)
│   ├── routes/
│   │   ├── (with-sidebar)/      # Main application layout
│   │   │   ├── chat/[id]/       # Chat interface with agent panel
│   │   │   │   └── components/  # Agent preview, terminal, file tree
│   │   │   └── +layout.svelte
│   │   ├── (settings-page)/settings/
│   │   │   ├── (center)/        # Center-aligned settings
│   │   │   │   ├── general-settings/
│   │   │   │   ├── account-settings/
│   │   │   │   ├── shortcut-settings/
│   │   │   │   ├── mcp-settings/
│   │   │   │   ├── agent-settings/
│   │   │   │   ├── theme-settings/
│   │   │   │   ├── preferences-settings/
│   │   │   │   ├── data-settings/
│   │   │   │   └── about/
│   │   │   └── (full-width)/    # Full-width settings
│   │   │       ├── model-settings/
│   │   │       └── plugins/
│   │   ├── shell/[id]/          # Shell window wrapper (for tabs)
│   │   ├── html-preview/        # HTML preview route
│   │   └── (root)/              # Root routes
│   ├── shared/                  # Shared between renderer and electron
│   │   ├── types/               # Shared type definitions
│   │   ├── storage/             # Storage type definitions
│   │   ├── config/              # Shared configuration
│   │   ├── constants/           # Shared constants
│   │   └── utils/               # Shared utilities
│   └── app.html, app.css, app.d.ts
│
├── electron/
│   ├── main/
│   │   ├── index.ts             # Main process entry
│   │   ├── services/            # IPC services (22+)
│   │   │   ├── window-service/      # Window management
│   │   │   ├── app-service/         # App lifecycle
│   │   │   ├── thread-service/      # Thread/conversation management
│   │   │   ├── storage-service/     # Persistent data (@302ai/unstorage)
│   │   │   │   └── code-agent/      # Code agent storage
│   │   │   ├── provider-service/    # AI provider config
│   │   │   ├── code-agent-service/  # Claude Code sandbox management
│   │   │   ├── mcp-service/         # MCP server management
│   │   │   ├── tab-service/         # Multi-tab management
│   │   │   ├── tray-service/        # System tray
│   │   │   ├── updater-service/     # App updates
│   │   │   ├── sso-service/         # Single Sign-On (ai302studio://)
│   │   │   ├── shortcut-service/    # Keyboard shortcuts
│   │   │   ├── broadcast-service/   # Inter-window messaging
│   │   │   ├── plugin-service/      # Plugin system
│   │   │   ├── ghost-window-service/ # Tab drag preview
│   │   │   └── ...                  # More services
│   │   ├── generated/           # Auto-generated IPC bindings
│   │   │   ├── preload-services.ts
│   │   │   └── ipc-registration.ts
│   │   ├── apis/                # API clients
│   │   │   ├── code-agent-ky.ts     # Code agent HTTP client
│   │   │   ├── 302ai-ky.ts          # 302AI HTTP client
│   │   │   └── code-agent.ts        # Code agent operations
│   │   ├── server/              # Hono.js backend
│   │   │   └── router.ts        # AI streaming router (port 8089)
│   │   ├── plugin-manager/      # Plugin system
│   │   │   ├── plugin-loader.ts
│   │   │   ├── plugin-registry.ts
│   │   │   ├── hook-manager.ts
│   │   │   └── sandbox.ts
│   │   ├── factories/           # WebContents factories
│   │   ├── mixins/              # WebContents mixins
│   │   ├── constants/           # Electron constants
│   │   └── utils/               # Electron utilities
│   └── preload/
│       └── index.ts             # Preload script with API exposure
│
├── packages/                    # Workspace packages
│   ├── plugin-sdk/              # @302ai/studio-plugin-sdk
│   └── plugin-registry/         # Plugin registry
│
├── vite-plugins/
│   └── ipc-service-generator/   # Custom Vite plugin for IPC generation
│
├── scripts/
│   ├── generate-ipc.ts          # Standalone IPC generator
│   └── release.ts               # Release automation
│
├── messages/                    # i18n message files
│   ├── en.json                  # English translations
│   └── zh.json                  # Chinese translations (base)
│
├── e2e/                         # E2E tests
├── static/                      # Static assets (icons)
├── storage/                     # Runtime storage (gitignored)
└── docs/                        # Documentation
```

## State Management Pattern

Uses Svelte 5 runes for reactive state management with singleton class instances:

```typescript
// Example: Chat State (/src/lib/stores/chat-state.svelte.ts)
class ChatState {
	// Reactive state
	messages = $state<ChatMessage[]>([]);
	inputValue = $state("");
	attachments = $state<AttachmentFile[]>([]);
	selectedModel = $state<Model | null>(null);

	// Chat parameters
	temperature = $state<number | null>(null);
	topP = $state<number | null>(null);
	maxTokens = $state<number | null>(null);

	// Derived state
	sendMessageEnabled = $derived(
		(this.inputValue.trim() !== "" || this.attachments.length > 0) && !!this.selectedModel,
	);
	providerType = $derived(this.selectedModel?.provider.name ?? null);

	// Actions
	sendMessage = () => {
		/* implementation */
	};
	clearMessages = () => {
		/* implementation */
	};
}

// Singleton instance exported
export const chatState = new ChatState();
```

**Key Stores** (20+):

- `chat-state.svelte.ts` - Messages, input, attachments, parameters
- `provider-state.svelte.ts` - AI providers and models
- `thread-state.svelte.ts` - Conversation threads
- `mcp-state.svelte.ts` - MCP servers (CRUD, enable/disable)
- `tab-bar-state.svelte.ts` - Multi-tab management
- `session-state.svelte.ts` - User session
- `marketplace-state.svelte.ts` - Plugin marketplace
- `code-agent/` - Code Agent specific stores

## Key Features

### Core Chat

- **Multi-Provider AI Chat**: OpenAI, Anthropic, Google, 302AI, and OpenAI-compatible providers
- **Streaming Responses**: Hono.js backend router with smoothStream middleware
- **Advanced Parameters**: Temperature, top-p, max tokens, frequency/presence penalty
- **File Attachments**: Drag-and-drop uploads with image compression and preview

### Code Agent (Claude Code Sandbox)

- **Cloud Sandboxes**: Create and manage Claude Code sandbox environments
- **File Operations**: Browse, edit, and manage files in sandbox
- **Terminal Access**: Execute commands in sandbox terminal
- **Session Management**: Persistent sandbox sessions per thread
- **Auto-Deploy**: Deploy sandbox projects to hosting

### MCP Integration

- **Server Management**: Add, configure, and toggle MCP servers
- **Built-in Servers**: Pre-configured 302AI MCP servers
- **Tool Discovery**: Automatic tool listing from MCP servers
- **Stream Handling**: Real-time tool output streaming

### Plugin System

- **Plugin SDK**: `@302ai/studio-plugin-sdk` workspace package
- **Marketplace**: Browse and install plugins
- **Sandboxed Execution**: Plugin isolation for security
- **Hook System**: Plugin lifecycle hooks

### Multi-Tab Shell Windows

- **Tab Management**: Multiple chat sessions in tabs
- **Ghost Windows**: Tab drag-and-drop preview
- **Shell Wrapper**: `/shell/[id]` routes for window management

### Theme System

- **CSS Variables**: `--ui-*` prefixed variables
- **Visual Editor**: Real-time theme customization
- **Dark/Light Modes**: Mode-watcher integration
- **Categories**: Colors, layout, components, typography, geometry

### Desktop Integration

- **System Tray**: Minimize to tray, quick actions
- **Keyboard Shortcuts**: Configurable with scope system
- **Window State**: Persist window size/position
- **Deep Links**: SSO via `ai302studio://` protocol
- **Auto Updates**: Built-in update checking

### Internationalization

- **Framework**: Inlang Paraglide-js
- **Base Locale**: Chinese (zh)
- **Supported**: English (en), Chinese (zh)
- **Files**: `/messages/{locale}.json`

## IPC Service Architecture

Custom Vite plugin auto-generates type-safe IPC bindings from service classes:

```typescript
// 1. Define service (electron/main/services/window-service/index.ts)
export class WindowService {
	async maximize(_event: IpcMainInvokeEvent): Promise<void> {
		const win = BrowserWindow.fromWebContents(_event.sender);
		win?.maximize();
	}

	async getState(_event: IpcMainInvokeEvent): Promise<WindowState> {
		// Return window state
	}
}

// 2. Auto-generated preload API (electron/main/generated/preload-services.ts)
export const windowService = {
	maximize: () => ipcRenderer.invoke("windowService:maximize"),
	getState: () => ipcRenderer.invoke("windowService:getState"),
};

// 3. Auto-generated registration (electron/main/generated/ipc-registration.ts)
ipcMain.handle("windowService:maximize", (e) => windowServiceInstance.maximize(e));
ipcMain.handle("windowService:getState", (e) => windowServiceInstance.getState(e));

// 4. Use in renderer
const state = await window.electronAPI.windowService.getState();
```

**Available Services** (22+):

- `windowService` - Window controls (maximize, minimize, etc.)
- `appService` - App lifecycle and initialization
- `threadService` - Thread/conversation CRUD
- `storageService` - Persistent data operations
- `providerService` - AI provider configuration
- `codeAgentService` - Claude Code sandbox management
- `mcpService` - MCP server operations
- `tabService` - Multi-tab management
- `trayService` - System tray controls
- `updaterService` - App update operations
- `ssoService` - SSO/authentication
- `shortcutService` - Keyboard shortcuts
- `broadcastService` - Inter-window messaging
- `pluginService` - Plugin management
- `ghostWindowService` - Tab drag preview windows
- And more...

## Backend Server (Hono.js)

AI streaming requests go through a local Hono.js server:

```typescript
// electron/main/server/router.ts
// Runs on localhost:8089 (configurable via get-port)

interface RouterRequestBody {
	model: string;
	messages: Message[];
	temperature?: number;
	topP?: number;
	maxTokens?: number;
	tools?: Tool[];
	mcpServers?: MCPServer[];
	// ... more options
}

// Supports multiple providers with unified streaming interface
// Includes smoothStream middleware for speed options
// MCP tool integration
// Code Agent sandbox integration
```

## Build Configuration

**Vite Configs:**

- `vite.config.ts` - Renderer (SvelteKit + TailwindCSS + Paraglide + IPC generator)
- `vite.main.config.ts` - Main process (output: `.vite/build/main/index.js`)
- `vite.preload.config.ts` - Preload scripts (output: `.vite/build/preload/index.cjs`)

**Electron Forge** (`forge.config.ts`):

- **Makers**: Squirrel (Windows), DMG (macOS), Deb/RPM (Linux), ZIP (all)
- **NSIS**: Windows installer via @electron-addons/electron-forge-maker-nsis
- **Signing**: macOS notarization, Windows certificate support
- **Publishers**: GitHub releases

**SvelteKit** (`svelte.config.js`):

- Adapter: `@sveltejs/adapter-static`
- Output: `.vite/renderer/main_window`
- Fallback: `index.html`

## Code Quality & Standards

**Pre-commit Hooks** (`.pre-commit-config.yaml`):

- ESLint with TypeScript + Svelte
- Prettier formatting
- Svelte-check type validation
- Conventional commit validation

**ESLint** (`eslint.config.js`):

- JavaScript + TypeScript + Svelte support
- Prettier integration
- `_` prefix ignores for unused vars

**Prettier** (`.prettierrc`):

- `useTabs: true`
- `singleQuote: false`
- `trailingComma: all`
- `printWidth: 100`

**TypeScript** (`tsconfig.json`):

- Strict mode enabled
- ESNext module/target
- Path mappings: `@shared`, `@electron`

## Important Development Notes

1. **Package Manager**: MUST use pnpm (includes patches for SvelteKit and @electron/notarize)

2. **Workspace Packages**: Plugin SDK is a workspace dependency (`packages/plugin-sdk/`)

3. **IPC Services**: Always use the IPC service generator for new electron-renderer communication

4. **State Management**: Use singleton class instances with Svelte 5 runes, never raw stores

5. **Component Library**: Follow Shadcn-Svelte patterns with variant-based styling (bits-ui)

6. **Theme Variables**: All theme CSS variables use `--ui-` prefix

7. **Shared Code**: Use `/src/shared/` for types/utils shared between renderer and electron

8. **Storage**: Use `@302ai/unstorage` with proper migration support for persistence

9. **Security**: Electron Fuses enabled for production builds

10. **Code Agent**: Sandbox operations require proper session management via `codeAgentService`

## File Naming Conventions

- **Components**: `kebab-case.svelte` (e.g., `chat-input.svelte`)
- **Stores**: `kebab-case.svelte.ts` (e.g., `chat-state.svelte.ts`)
- **Types**: `kebab-case.ts` (e.g., `chat-types.ts`)
- **Services**: `kebab-case/index.ts` directories (e.g., `window-service/index.ts`)
- **Routes**: `+page.svelte`, `+layout.svelte`, `+page.ts` (SvelteKit convention)

## Debugging

- **Renderer DevTools**: Cmd/Ctrl+Shift+I in app
- **Main Process**: Debug via VS Code launch config or `--inspect` flag
- **IPC Debugging**: Check generated files in `electron/main/generated/`
- **Storage**: Runtime data in `/storage/` directory (gitignored)
