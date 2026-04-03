# Architecture Overview

302-AI-Studio is an Electron desktop application with a multi-process architecture.

## System Layers

```
┌─────────────────────────────────────────┐
│  Renderer Process (SvelteKit)          │
│  - UI Components (Shadcn-Svelte)       │
│  - State Management (Svelte 5 runes)   │
│  - Routes & Pages                       │
└──────────────┬──────────────────────────┘
               │ IPC (type-safe)
┌──────────────┴──────────────────────────┐
│  Main Process (Electron)                │
│  - IPC Services (22+)                   │
│  - Hono Backend (localhost:8089)        │
│  - Plugin Manager                       │
│  - Window/Tab Management                │
└─────────────────────────────────────────┘
```

## Key Components

### Frontend (Renderer)

- **Framework**: SvelteKit 2.39 + Svelte 5.38
- **State**: 20+ Svelte 5 runes stores (`$state`, `$derived`)
- **UI**: 60+ Shadcn-Svelte components
- **Routing**: SvelteKit file-based routing
- **Location**: `src/`

### Backend (Main Process)

- **IPC Services**: 22+ services with auto-generated bindings
- **HTTP Server**: Hono 4.9 on localhost:8089 for AI streaming
- **Plugin System**: Sandboxed plugin execution
- **Storage**: @302ai/unstorage with migrations
- **Location**: `electron/main/`

### Communication

- **IPC**: Custom type-safe generator (`pnpm generate:ipc`)
- **Pattern**: Service classes → Auto-generated preload API
- **Location**: `electron/main/generated/`

## Deep Dive Documents

- [Main Process Architecture](./electron-main.md)
- [Renderer Architecture](./renderer.md)
- [IPC System](./ipc-system.md)
- [State Management](./state-management.md)
- [Plugin System](./plugin-system.md)

## Tech Stack Reference

See [docs/references/tech-stack.md](../references/tech-stack.md) for complete dependency list.
