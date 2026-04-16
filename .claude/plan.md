# Plan: Add API Key Change Listener to Cloud Mode Service

## Context

The `CloudModeService` currently starts polling for instance status and health checks on initialization, but it doesn't respond to API key changes. When a user changes their 302.AI API key, the cloud mode service continues using the old key (cached in `_302AIKy`'s `beforeRequest` hook), which can lead to:

1. **Stale instance data**: The service polls instances associated with the old API key
2. **Authentication failures**: Health checks and instance syncs may fail with the new key
3. **Inconsistent state**: The UI shows outdated instance information

The `ai-application-service` already implements this pattern correctly by listening to the `provider:302ai-provider-changed` event and re-fetching application URLs with the new key.

**Goal**: Make `CloudModeService` listen to API key changes and reset polling to sync the latest instance state associated with the new key.

## Implementation Plan

### 1. Add Event Listener in Constructor

**File**: `electron/main/services/cloud-mode-sevice/index.ts`

In the `CloudModeService` constructor, add an event listener similar to `ai-application-service`:

```typescript
constructor() {
    // Existing initialization code...
    this.syncCloudInstanceToLocal()
        .then(() => this.maybeStartPolling())
        .catch((err) => {
            logger.warn("[CloudModeService] Initial sync failed, using cached data", err);
        });

    // NEW: Listen to API key changes
    emitter.on("provider:302ai-provider-changed", ({ apiKey }) => {
        this.handle302AIProviderChange(apiKey);
    });
}
```

### 2. Implement Handler Method

Add a private method `handle302AIProviderChange` that:

1. Stops existing polling tasks (to prevent race conditions)
2. Clears the health cache (old key's data is invalid)
3. Re-syncs instance list from cloud (with new key via `_302AIKy`)
4. Restarts polling if a valid instance exists

```typescript
/**
 * Handle 302.AI provider API key change
 * Reset polling to sync latest instance state with new key
 */
private async handle302AIProviderChange(updatedApiKey: string): Promise<void> {
    logger.info("[CloudModeService] API key changed, resetting cloud mode polling");

    // Stop existing polling to prevent race conditions
    this.stopPolling();

    // Clear health cache (old key's data is invalid)
    this.#healthCache = null;

    // Re-sync instance list with new key
    const [error] = await attemptAsync(() => this.syncCloudInstanceToLocal());

    if (error) {
        logger.error("[CloudModeService] Failed to sync instances after API key change:", error);
        // Broadcast null to clear stale UI state
        broadcastService.broadcastChannelToAll("cloud-mode:timed", null);
        return;
    }

    // Restart polling if instance exists
    await this.maybeStartPolling();
    logger.info("[CloudModeService] Cloud mode polling restarted with new API key");
}
```

### 3. Import Required Dependencies

Ensure `emitter` is imported at the top of the file:

```typescript
import { broadcastService, emitter } from "../broadcast-service";
```

(Already imported `broadcastService`, just need to add `emitter`)

## Key Design Decisions

1. **Stop polling first**: Prevents race conditions where old polling tasks might overwrite newly synced data
2. **Clear health cache**: Old health data is associated with the old key's instance, must be invalidated
3. **Broadcast null on error**: If sync fails with new key, clear UI state to avoid showing stale data
4. **Reuse existing methods**: `stopPolling()`, `syncCloudInstanceToLocal()`, and `maybeStartPolling()` already handle the logic correctly

## Files to Modify

- `electron/main/services/cloud-mode-sevice/index.ts` (add listener and handler)

## Verification Steps

1. **Build and run the app**:
   ```bash
   pnpm dev
   ```

2. **Test API key change scenario**:
   - Open the app with a valid 302.AI API key
   - Verify cloud mode instance is loaded and polling is active (check logs)
   - Change the API key in settings
   - Verify logs show:
     - "API key changed, resetting cloud mode polling"
     - "Polling stopped"
     - "Starting instance sync"
     - "Polling started for instance: [name]" (if new key has instances)
   - Verify UI updates with new instance data

3. **Test edge cases**:
   - Change to an invalid key → polling should stop, UI should clear
   - Change to a key with no instances → polling should stop gracefully
   - Change back to original key → polling should restart with correct data

4. **Run quality checks**:
   ```bash
   npm run quality
   ```

## Expected Behavior

**Before**: API key changes don't affect cloud mode service, leading to stale data and potential auth errors

**After**: API key changes trigger immediate re-sync and polling restart, ensuring UI always shows data for the current key
