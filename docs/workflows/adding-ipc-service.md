# Adding an IPC Service

**Time**: 5-10 minutes | **Difficulty**: Easy

## Use Code Generator (Recommended)

```bash
pnpm gen:service <ClassName>
```

Example:

```bash
pnpm gen:service Analytics
```

This creates:

- `electron/main/services/analytics-service/index.ts`
- Updates `electron/main/services/index.ts` with exports
- Auto-formats with Prettier

## What Gets Generated

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

## Next Steps

1. **Implement your methods** in the generated service class
2. **Regenerate IPC bindings**:
    ```bash
    pnpm generate:ipc
    ```
3. **Use from renderer**:
    ```typescript
    const result = await window.electronAPI.analyticsService.handleSomething();
    ```

## Manual Creation (If Needed)

If you need more control, see [../patterns/ipc-service-template.md](../patterns/ipc-service-template.md).

## Key Rules

- Methods with `IpcMainInvokeEvent` parameter are auto-exposed to renderer
- Use `createLogger("services")` for logging
- Export singleton instance: `export const serviceName = new ServiceName()`
- Always run `pnpm generate:ipc` after changes

## See Also

- [IPC System Architecture](../architecture/ipc-system.md)
- [IPC Service Template](../patterns/ipc-service-template.md)
