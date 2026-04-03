# Code Generation Guide

This guide explains the automated code generation scripts for creating new services and state stores in 302-AI-Studio.

## Overview

The project includes two code generators to scaffold boilerplate code:

- **`pnpm gen:service`** - Generate Electron main process IPC services
- **`pnpm gen:state`** - Generate Svelte 5 reactive state stores

Both scripts automatically create files, update index exports, and format code with Prettier.

## Service Generation

### Command

```bash
pnpm gen:service <ClassName>
```

### What It Creates

1. **Service directory**: `electron/main/services/<class-name>-service/index.ts`
2. **Service class** with:
    - Logger instance
    - Example regular method
    - Example IPC handler method (async with `IpcMainInvokeEvent`)
    - Singleton instance export
3. **Auto-updates** `electron/main/services/index.ts` with alphabetically sorted imports and exports

### Example

```bash
pnpm gen:service Analytics
```

Creates `electron/main/services/analytics-service/index.ts`:

```typescript
import { createLogger } from "@shared/logger";
const logger = createLogger("services");
import type { IpcMainInvokeEvent } from "electron";

export class AnalyticsService {
	someMethod(): void {
		// TODO: Implement
	}

	async handleSomething(_event: IpcMainInvokeEvent): Promise<void> {
		// TODO: Implement
	}
}

export const analyticsService = new AnalyticsService();
```

### Next Steps After Generation

1. Implement your service methods
2. IPC methods will be auto-discovered by the IPC generator (`pnpm generate:ipc`)
3. Use the service instance in other services or main process code

## State Generation

### Command

```bash
pnpm gen:state <ClassName> [--persist] [--scoped]
```

### Flags

- `--persist` - Add persistent storage with `@302ai/unstorage` integration
- `--scoped` - Create scoped state (per-tab/per-thread) instead of global singleton

### What It Creates

1. **Type definitions**: `src/shared/storage/<class-name>-state.ts`
2. **State store**: `src/lib/stores/<class-name>-state.svelte.ts`
3. **Auto-updates** `src/lib/stores/index.ts` with alphabetically sorted import

### Example: Basic State

```bash
pnpm gen:state Notification
```

Creates a simple Svelte 5 runes-based state manager with `$state` and `$derived` examples.

### Example: Persistent State

```bash
pnpm gen:state UserPreferences --persist
```

Creates state with:

- Type definitions in `src/shared/storage/user-preferences-state.ts`
- Storage integration using `persistedState` hook
- Automatic save/load from disk

### Example: Scoped State

```bash
pnpm gen:state ChatInput --persist --scoped
```

Creates state that:

- Is scoped per tab/thread (not global)
- Persists to storage with scope key
- Uses `persistedStateBatcher` for efficient batch updates

### Generated State Structure

**Without `--persist`:**

```typescript
class NotificationStateManager {
	notifications = $state<Notification[]>([]);
	unreadCount = $derived(this.notifications.filter((n) => !n.read).length);
}

export const notificationState = new NotificationStateManager();
```

**With `--persist`:**

```typescript
const defaults = (): UserPreferencesState => ({
	theme: "system",
	language: "en",
});

const state = persistedState<UserPreferencesState>("user-preferences-state", defaults());

class UserPreferencesStateManager {
	get theme() {
		return state.value.theme;
	}
	set theme(v) {
		state.value = { ...state.value, theme: v };
	}
}

export const userPreferencesState = new UserPreferencesStateManager();
```

**With `--persist --scoped`:**

```typescript
export function createChatInputState(scope: string) {
	const state = persistedStateBatcher<ChatInputState>(`chat-input-state:${scope}`, defaults());

	class ChatInputStateManager {
		// Scoped state implementation
	}

	return new ChatInputStateManager();
}
```

## Naming Conventions

Both generators follow these conventions:

- **Input**: PascalCase class name (e.g., `UserPreferences`)
- **File names**: kebab-case (e.g., `user-preferences-service/`, `user-preferences-state.svelte.ts`)
- **Instance names**: camelCase with suffix (e.g., `userPreferencesService`, `userPreferencesState`)

## Auto-Formatting

All generated files are automatically formatted with Prettier using the project's configuration.

## Integration with IPC System

Services generated with `gen:service` integrate with the IPC service generator:

1. Methods with `IpcMainInvokeEvent` parameter are exposed to renderer
2. Run `pnpm generate:ipc` to regenerate IPC bindings
3. Access from renderer via `window.electronAPI.<serviceName>.<methodName>()`

See [CLAUDE.md](../CLAUDE.md#ipc-service-architecture) for full IPC architecture details.

## Tips

- Use descriptive PascalCase names that clearly indicate purpose
- For services: Add dependencies via constructor or class properties
- For states: Start simple, add `--persist` only when needed
- For scoped states: Use when state varies per tab/thread (e.g., chat input, scroll position)
- Review generated code and remove unused example methods
