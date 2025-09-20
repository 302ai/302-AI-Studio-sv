# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**302-AI-Studio-sv** is a sophisticated Electron desktop application providing an AI chat interface. Built with SvelteKit 5 and modern web technologies, it supports multiple AI providers, models, file attachments, theme customization, MCP server integration, and comprehensive internationalization.

## Key Architecture

- **Frontend**: SvelteKit 5 with TypeScript and TailwindCSS 4.x
- **Desktop**: Electron 38+ with Electron Forge for packaging and distribution
- **UI Components**: Shadcn-Svelte (bits-ui) component library with custom business components
- **State Management**: Svelte 5 runes (reactive state with `$state`, `$derived`)
- **Internationalization**: Inlang Paraglide-js (base locale: zh, supports en/zh)
- **IPC Communication**: Custom type-safe IPC service generator with auto-generated bindings
- **Styling**: TailwindCSS 4.x with custom theme system and dark/light mode support
- **Code Quality**: Pre-commit hooks with ESLint, Prettier, conventional commits

## Development Commands

```bash
# Install dependencies (REQUIRED: uses pnpm with patches)
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
pnpm run check         # Svelte type checking
pnpm run check:watch   # Watch mode type checking

# Testing
pnpm run test:unit     # Vitest unit tests with jsdom
pnpm run test:e2e      # Playwright e2e tests
pnpm run test          # Run all tests (unit + e2e)

# Build and package
pnpm run build         # Build SvelteKit for production
pnpm run package       # Package Electron app (output in /out directory)
pnpm run make          # Create distributable installer
pnpm run publish       # Publish to configured targets

# Development utilities
pnpm run preview       # Preview built SvelteKit app
```

## Project Structure

```
src/
├── lib/
│   ├── components/
│   │   ├── ui/           # Shadcn-Svelte base components (40+ components)
│   │   │   ├── button/   # Button variants and compositions
│   │   │   ├── dialog/   # Modal dialogs and sheets
│   │   │   ├── form/     # Form controls and validation
│   │   │   └── ...       # Complete shadcn-svelte component set
│   │   └── buss/         # Business components
│   │       ├── chat/     # Chat interface and message components
│   │       ├── model-*/  # AI model selection and configuration
│   │       ├── provider-*/ # AI provider management
│   │       ├── theme-*/  # Theme system and editor
│   │       └── settings/ # Application settings UI
│   ├── stores/           # Svelte 5 runes state management
│   │   ├── chat-state.svelte.ts     # Chat messages, input, and parameters
│   │   └── provider-state.svelte.ts # AI provider/model selection and storage
│   ├── types/            # TypeScript definitions
│   │   ├── chat.ts       # Chat-related types
│   │   ├── model.ts      # AI model types
│   │   └── provider.ts   # Provider configuration types
│   ├── api/              # API integration layer
│   ├── utils/            # Utility functions and helpers
│   ├── theme/            # Custom theme system
│   ├── datas/            # Static data (default providers, models)
│   ├── hooks/            # Custom Svelte hooks
│   ├── shortcut/         # Keyboard shortcut handling
│   └── paraglide/        # Generated i18n files (auto-generated)
├── routes/
│   ├── (with-sidebar)/   # Main application layout
│   │   ├── chat/         # Chat interface routes
│   │   └── dashboard/    # Dashboard view
│   ├── (settings-page)/  # Settings pages layout
│   │   └── settings/     # Settings route groups
│   │       ├── (center)/ # Center-aligned settings pages
│   │       └── (full-width)/ # Full-width settings pages
│   └── demo/             # Demo and testing routes
├── app.html              # Main HTML template
├── app.css               # Global styles and TailwindCSS imports
└── app.d.ts              # Global type definitions

electron/
├── main/
│   ├── index.ts          # Main process entry point
│   ├── services/         # IPC service classes
│   ├── generated/        # Auto-generated IPC bindings
│   └── constants/        # Electron constants
└── preload/
    └── index.ts          # Preload script with API exposure

vite-plugins/
└── ipc-service-generator/ # Custom plugin for type-safe IPC generation
```

## State Management Pattern

Uses Svelte 5 runes for reactive state management:

```typescript
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
}

// Singleton instance
export const chatState = new ChatState();
```

## Key Features

- **Multi-provider AI Chat**: OpenAI, Anthropic, and other provider support
- **File Attachments**: Drag-and-drop file uploads with preview and validation
- **Advanced Chat Parameters**: Temperature, top-p, frequency/presence penalty controls
- **Theme System**: Custom theme editor with live preview and dark/light modes
- **MCP Integration**: Model Context Protocol server support for extended capabilities
- **Internationalization**: Full i18n support with Paraglide-js (Chinese base, English support)
- **Desktop Integration**: Native Electron features, window management, and system integration
- **Type-safe IPC**: Auto-generated type-safe communication between processes

## IPC Service Architecture

The project uses a custom Vite plugin for automatic IPC service generation:

```typescript
// Service definition (electron/main/services/)
export class WindowService {
	async maximize(_event: IpcMainInvokeEvent): Promise<void> {
		// Implementation
	}
}

// Auto-generated preload API
window.electronAPI = {
	windowService: {
		maximize: () => ipcRenderer.invoke("windowService:maximize"),
	},
};

// Auto-generated main process registration
ipcMain.handle("windowService:maximize", (event) => windowServiceInstance.maximize(event));
```

## Build Configuration

- **Vite**: Multiple configuration files for different targets
  - `vite.config.ts` - Renderer process (SvelteKit)
  - `vite.main.config.ts` - Main process
  - `vite.preload.config.ts` - Preload scripts
- **Electron Forge**: Complete packaging and distribution setup
- **SvelteKit**: Static adapter for Electron renderer
- **TailwindCSS**: v4.x with @tailwindcss/vite plugin

## Code Quality & Standards

- **Pre-commit hooks**: Automated code quality enforcement
  - ESLint with TypeScript and Svelte support
  - Prettier formatting
  - Svelte-check type checking
  - Conventional commit message validation
- **Testing**: Vitest (unit) + Playwright (e2e) with testing-library
- **TypeScript**: Strict configuration with path mapping

## Internationalization

- **Framework**: Inlang Paraglide-js
- **Base locale**: Chinese (zh)
- **Supported locales**: English (en), Chinese (zh)
- **Message files**: `/messages/{locale}.json`
- **Generated API**: `$lib/paraglide/messages.js`

## Important Notes

- **Package Manager**: MUST use pnpm (includes patches for SvelteKit compatibility)
- **Electron Security**: Fuses enabled for production security
- **Component Library**: Follow Shadcn-Svelte patterns with variant-based styling
- **State Management**: Singleton class instances with Svelte 5 runes throughout
- **IPC Communication**: Use the service generator for all new IPC endpoints
- **Theme System**: Custom CSS-in-JS theme editor with real-time preview
