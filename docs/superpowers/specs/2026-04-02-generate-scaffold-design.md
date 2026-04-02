# Scaffold Generator Design

## Commands

```bash
pnpm gen:service <ClassName>                        # Create main process service
pnpm gen:state <ClassName>                           # Create renderer state (no persistence)
pnpm gen:state <ClassName> --persist                 # Create renderer state (global persisted)
pnpm gen:state <ClassName> --persist --scoped        # Create renderer state (per-threadId persisted)
```

## Entry

Single file: `scripts/generate.ts`

package.json additions:

```json
{
	"gen:service": "tsx scripts/generate.ts service",
	"gen:state": "tsx scripts/generate.ts state"
}
```

## Naming Convention

Input is PascalCase. Automatic conversion:

| Input           | Directory/file                   | Class                       | Instance              | Storage key                  |
| --------------- | -------------------------------- | --------------------------- | --------------------- | ---------------------------- |
| `Notification`  | `notification-service/index.ts`  | `NotificationService`       | `notificationService` | -                            |
| `SidebarSearch` | `sidebar-search-state.svelte.ts` | `SidebarSearchStateManager` | `sidebarSearchState`  | `SidebarSearchStorage:state` |

Conversion: insert `-` at uppercase boundaries, lowercase all.

## Service Template

Output: `electron/main/services/{kebab-name}-service/index.ts`

```typescript
import { createLogger } from "@shared/logger";

const logger = createLogger("services");
import type { IpcMainInvokeEvent } from "electron";

/**
 * {ClassName} service
 */
export class {ClassName}Service {
	// TODO: Add dependencies as needed

	/**
	 * {Regular method example}
	 */
	someMethod(): void {
		// TODO: Implement
	}

	/**
	 * IPC: {description of ipc method}
	 */
	async handleSomething(_event: IpcMainInvokeEvent): Promise<void> {
		// TODO: Implement
	}
}

export const {instanceName} = new {ClassName}Service();
```

Update `electron/main/services/index.ts`:

- Insert import line in alphabetical order
- Insert class name in the class re-export block (alphabetical)
- Insert instance name in the instance re-export block (alphabetical)

No auto-trigger of `pnpm generate:ipc`. User runs it manually when ready.

## State Template

### Shared type file

Output: `src/shared/storage/{kebab-name}.ts`

```typescript
/**
 * {ClassName} state type definitions
 */
export interface {ClassName}State {
	// TODO: Define state shape
}
```

### Non-persisted

Output: `src/lib/stores/{kebab-name}-state.svelte.ts`

```typescript
import { createLogger } from "@shared/logger";

const logger = createLogger("state");
import type { {ClassName}State } from "@shared/storage/{kebab-name}";

class {ClassName}StateManager {
	// TODO: Implement state management
}

export const {instanceName} = new {ClassName}StateManager();
```

### Persisted (global)

```typescript
import { createLogger } from "@shared/logger";

const logger = createLogger("state");
import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import type { {ClassName}State } from "@shared/storage/{kebab-name}";

const getDefaults = (): {ClassName}State => ({
	// TODO: Define initial values
});

export const persisted{ClassName}State = new PersistedState<{ClassName}State>(
	"{ClassName}Storage:state",
	getDefaults(),
);

class {ClassName}StateManager {
	// TODO: Implement state management
}

export const {instanceName} = new {ClassName}StateManager();
```

### Persisted (per-threadId, `--scoped`)

```typescript
import { createLogger } from "@shared/logger";

const logger = createLogger("state");
import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import type { {ClassName}State } from "@shared/storage/{kebab-name}";

const tab = window.tab ?? null;
const threadId =
	tab && typeof tab === "object" && "threadId" in tab && typeof tab.threadId === "string" && tab.threadId
		? tab.threadId
		: "shell";

function getDefaults(): {ClassName}State {
	return {
		// TODO: Define initial values
	};
}

export const persisted{ClassName}State = new PersistedState<{ClassName}State>(
	`{ClassName}Storage:{kebab-name}-state-${threadId}`,
	getDefaults(),
);

class {ClassName}StateManager {
	// TODO: Implement state management
}

export const {instanceName} = new {ClassName}StateManager();
```

### Index update

Insert into `src/lib/stores/index.ts` in alphabetical order:

```typescript
import "./{kebab-name}-state.svelte";
```

## Implementation Notes

- Single `scripts/generate.ts` file, zero external dependencies
- Template string interpolation for code generation
- Regex-based alphabetical insertion into existing index files
- Prettier formatting via `spawn` after generation (same pattern as `generate-ipc.ts`)
