# Debugging Workflow

Step-by-step guide for debugging issues in 302-AI-Studio.

## AI Agent Guidance (CRITICAL)

If you are an AI agent, you **MUST** activate and use the following project-level skills before attempting to diagnose or fix any bugs:

```bash
# For UI, State, Rendering, and Styling issues:
activate_skill sveltekit-svelte5-tailwind-skill

# For IPC, Main Process, and Native OS issues:
activate_skill electron
```

These skills provide:

- **Common Issues & Quick Fixes**: Specialized troubleshooting for Svelte 5 Runes and Tailwind v4.
- **Systematic Debugging Methodology**: Step-by-step guides for tracing issues across the dual-process architecture.
- **Performance Optimization**: Guidance on memory leaks and slow rendering specific to this stack.

## Quick Diagnosis

### 1. Identify the Layer

**Symptoms → Layer:**

- UI not updating → Renderer (Svelte state)
- IPC call fails → IPC layer or Main process
- AI streaming broken → Hono server or AI SDK
- Plugin not loading → Plugin system
- MCP tool missing → MCP service

### 2. Check Logs

```bash
# Renderer logs (DevTools Console)
Cmd/Ctrl+Shift+I

# Main process logs (terminal)
# Look for logger output in terminal where you ran `pnpm dev`

# Storage inspection
ls -la storage/
```

## Debugging by Layer

### Renderer Issues

**State not updating:**

```typescript
// Check if state is reactive
class MyState {
	value = $state(0); // ✅ Reactive
	// vs
	value = 0; // ❌ Not reactive
}

// Check if derived is used correctly
computed = $derived(this.value * 2); // ✅
// vs
computed = this.value * 2; // ❌ Stale
```

**Component not rendering:**

1. Check route structure in `src/routes/`
2. Verify layout hierarchy
3. Check conditional rendering logic
4. Inspect props passed to component

**DevTools:**

- Elements tab: Inspect DOM
- Console: Check for errors
- Network: Verify API calls
- Sources: Set breakpoints

### IPC Issues

**Call not reaching main process:**

```bash
# 1. Verify service exists
ls electron/main/services/my-service/

# 2. Check generated bindings
cat electron/main/generated/preload-services.ts | grep myService
cat electron/main/generated/ipc-registration.ts | grep myService

# 3. Regenerate if missing
pnpm generate:ipc
```

**Type mismatch:**

```typescript
// Check service signature matches usage
// Service:
async getData(): Promise<MyData> { }

// Renderer:
const data = await window.electronAPI.myService.getData();
// Type should be MyData
```

**Error in handler:**

- Check main process terminal output
- Add try-catch in service method
- Use logger to trace execution

### Hono Server Issues

**Streaming not working:**

```typescript
// Check server is running
// Should see: "Server running on http://localhost:8089"

// Verify route exists
// electron/main/server/router.ts

// Check request body matches RouterRequestBody interface
```

**AI SDK errors:**

- Verify provider credentials
- Check model availability
- Inspect network tab for 401/403/429 errors

### Plugin System Issues

**Plugin not loading:**

```bash
# Check plugin directory
ls -la storage/plugins/

# Verify plugin manifest
cat storage/plugins/my-plugin/package.json

# Check plugin service logs
# Look for "Plugin loaded" or error messages
```

**Hook not firing:**

- Verify hook is registered in plugin manifest
- Check hook-manager.ts for hook execution
- Add logging in hook handler

### MCP Issues

**Server not connecting:**

```typescript
// Check MCP state
import { mcpState } from "$lib/stores/mcp-state.svelte";
console.log(mcpState.servers);

// Verify server config
// Settings → MCP Settings

// Check server process
// Should see stdio/sse connection established
```

**Tool not available:**

- Verify server is enabled
- Check tool discovery completed
- Inspect MCP SDK logs

## Common Issues

### Issue: "Cannot find module"

**Cause:** Import path incorrect or file doesn't exist

**Fix:**

```bash
# Check file exists
ls -la path/to/file.ts

# Verify tsconfig path mappings
cat tsconfig.json | grep paths

# Check import statement
# Use @shared for shared code
import { MyType } from '@shared/types/my-type';
```

### Issue: "IPC handler not found"

**Cause:** Service not registered or bindings not regenerated

**Fix:**

```bash
pnpm generate:ipc
# Restart dev server
```

### Issue: State not persisting

**Cause:** Storage service not configured or migration failed

**Fix:**

```typescript
// Check storage service usage
await window.electronAPI.storageService.setItem('key', value);

// Verify storage directory
ls -la storage/

// Check migration logs
```

### Issue: Build fails

**Cause:** Type errors, linting errors, or missing dependencies

**Fix:**

```bash
# Run quality checks
pnpm quality

# Check specific issues
pnpm check        # Type errors
pnpm lint         # Linting errors
pnpm format:check # Formatting errors

# Auto-fix where possible
pnpm quality:fix
```

## Debugging Tools

### VS Code Launch Config

```json
{
	"type": "node",
	"request": "launch",
	"name": "Debug Main Process",
	"runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron",
	"args": ["."],
	"outputCapture": "std"
}
```

### Chrome DevTools

```bash
# Main process debugging
electron --inspect=5858 .

# Then open chrome://inspect in Chrome
```

### Logger Usage

```typescript
import { createLogger } from "@shared/logger";

const logger = createLogger("MyComponent");

logger.debug("Debug info", { data });
logger.info("Info message");
logger.warn("Warning");
logger.error("Error occurred", error);
```

## Performance Debugging

### Slow Rendering

1. Check for unnecessary re-renders
2. Use `$derived` for computed values
3. Avoid inline function creation in templates
4. Profile with Chrome DevTools Performance tab

### Memory Leaks

1. Check for unsubscribed event listeners
2. Verify cleanup in component `onDestroy`
3. Use Chrome DevTools Memory profiler
4. Look for growing heap snapshots

### Slow IPC

1. Reduce data transferred
2. Use streaming for large data
3. Batch multiple calls
4. Profile with Chrome DevTools Network tab

## Getting Help

If stuck after following this guide:

1. Check existing issues: https://github.com/302ai/302-AI-Studio-sv/issues
2. Review recent commits for similar changes
3. Ask in team chat with:
    - What you're trying to do
    - What you've tried
    - Error messages and logs
    - Minimal reproduction steps

## See Also

- [Architecture Overview](../architecture/index.md)
- [Quality Gates](../quality/quality-gates.md)
- [Testing Standards](../quality/testing-standards.md)
