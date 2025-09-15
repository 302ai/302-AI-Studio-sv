# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Electron desktop application built with SvelteKit called "302-AI-Studio-sv". It's an AI chat interface that supports multiple providers and models, with features like file attachments, theme customization, and MCP server integration.

## Key Architecture

- **Frontend**: SvelteKit 5 with TypeScript and TailwindCSS
- **Desktop**: Electron with Electron Forge for packaging
- **UI Components**: Shadcn-Svelte component library (bits-ui)
- **State Management**: Svelte 5 runes (reactive state with $state, $derived)
- **Internationalization**: Paraglide-js with project.inlang configuration
- **Router**: SvelteKit hash router (all routes prefixed with `#/`)

## Development Commands

```bash
# Install dependencies (required: uses pnpm with patches)
pnpm install

# Development
pnpm run dev           # Start development server with HMR
pnpm run start         # Alias for dev

# Code Quality
pnpm run lint          # ESLint code checking
pnpm run lint:fix      # Auto-fix ESLint issues
pnpm run format        # Format code with Prettier
pnpm run format:check  # Check code formatting
pnpm run type-check    # TypeScript type checking
pnpm run quality       # Complete quality check (type + lint + format)
pnpm run quality:fix   # Auto-fix all possible issues

# Type checking
pnpm run check         # Svelte type checking
pnpm run check:watch   # Watch mode type checking

# Testing
pnpm run test:unit     # Vitest unit tests
pnpm run test:e2e      # Playwright e2e tests
pnpm run test          # Run all tests

# Build and package
pnpm run build         # Build for production
pnpm run package       # Build app (output in /out directory)
pnpm run make          # Create distributable installer

# CI/CD
pnpm run ci            # Complete CI check (quality + tests)
```

## Project Structure

```
src/
├── lib/
│   ├── components/
│   │   ├── ui/           # Shadcn-Svelte base components
│   │   └── buss/         # Business components (chat, models, providers)
│   ├── stores/           # Svelte 5 runes state management
│   │   ├── chat-state.svelte.ts     # Chat messages and input state
│   │   └── provider-state.svelte.ts # AI provider/model selection
│   ├── types/            # TypeScript definitions
│   ├── theme/            # Theme system with custom editor
│   ├── datas/            # Static data (models, providers)
│   └── utils/            # Utility functions
├── routes/
│   └── (with-sidebar)/   # Main layout with sidebar navigation
└── paraglide/            # Generated i18n files
```

## State Management Pattern

Uses Svelte 5 runes for reactive state:

```typescript
class ChatState {
	messages = $state<ChatMessage[]>([]);
	selectedModel = $state<Model | null>(null);
	sendMessageEnabled = $derived(/* logic */);
}
export const chatState = new ChatState();
```

## Key Features

- **Multi-provider AI Chat**: Supports different AI providers and models
- **File Attachments**: Drag-and-drop file uploads with preview
- **Theme System**: Custom theme editor with live preview
- **MCP Integration**: Model Context Protocol server support
- **Internationalization**: Multi-language support via Paraglide
- **Desktop Integration**: Native Electron features

## Important Notes

- Uses pnpm with patches for SvelteKit compatibility
- Hash router requires `#/` prefix for all navigation links
- Components follow Shadcn-Svelte patterns with variant-based styling
- State is managed through singleton class instances with Svelte 5 runes
