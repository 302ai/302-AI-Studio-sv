# Logging System Guide

This document explains the logging system architecture and usage in 302 AI Studio.

## Quick Start

Add logging to any file with just two lines:

```typescript
import { createLogger } from "@shared/logger";
const logger = createLogger("services");

logger.info("User data loaded");
logger.error("Request failed:", error);
```

**No need to worry about main vs renderer process** — `createLogger()` automatically detects the environment and routes to the correct backend.

## Directory Structure

```
logs/
├── main/                    # Main process logs
│   ├── 2026-04-02/
│   │   ├── 00/              # Hourly subdirectories
│   │   │   ├── main.log
│   │   │   ├── services.log
│   │   │   └── server.log
│   │   ├── 01/
│   │   │   └── ...
│   │   └── 23/
│   └── 2026-04-03/
└── renderer/                # Renderer process logs
    ├── 2026-04-02/
    │   ├── 00/
    │   │   ├── ui.log
    │   │   ├── state.log
    │   │   ├── chat.log
    │   │   └── marketplace.log
    │   └── ...
    └── ...
```

- Path pattern: `{logsPath}/{processType}/{yyyy-MM-dd}/{HH}/{category}.log`
- Development mode: Logs written to `{projectRoot}/logs/`
- Production mode: Logs written to `{userData}/logs/`
- Log directories older than 14 days are automatically cleaned on app startup and every 24 hours

## Category Classification

The `category` parameter in `createLogger(category)` is TypeScript-constrained and cannot accept arbitrary strings.

### Main Process Categories

| Category           | Scope               | Example Files                       |
| ------------------ | ------------------- | ----------------------------------- |
| `"main"`           | Entry point         | `electron/main/index.ts`            |
| `"services"`       | All IPC services    | `electron/main/services/*/index.ts` |
| `"server"`         | Hono backend        | `electron/main/server/*.ts`         |
| `"apis"`           | HTTP clients        | `electron/main/apis/*.ts`           |
| `"factories"`      | WebContents factory | `electron/main/factories/*.ts`      |
| `"utils"`          | Main process utils  | `electron/main/utils/*.ts`          |
| `"plugin-manager"` | Plugin system       | `electron/main/plugin-manager/*.ts` |
| `"preload"`        | Preload scripts     | `electron/preload/index.ts`         |

### Renderer Process Categories

| Category        | Scope                        | Example Files                                |
| --------------- | ---------------------------- | -------------------------------------------- |
| `"ui"`          | Components, utils, API calls | 60+ files                                    |
| `"state"`       | Svelte 5 state management    | `src/lib/stores/*.svelte.ts`                 |
| `"chat"`        | Chat state                   | `src/lib/stores/chat-state.svelte.ts`        |
| `"marketplace"` | Plugin marketplace           | `src/lib/stores/marketplace-state.svelte.ts` |
| `"provider"`    | Models/providers             | Reserved                                     |
| `"theme"`       | Theme system                 | Reserved                                     |
| `"session"`     | User session                 | Reserved                                     |

## Log Levels

```typescript
logger.debug("Debug info"); // Development only
logger.info("General info"); // Development + Production
logger.warn("Warning"); // Development only (filtered in production files)
logger.error("Error:", err); // Development + Production
logger.fatal("Fatal error"); // Development + Production (mapped to error)
```

### Level Strategy by Environment

| Environment | Console                      | File                                  |
| ----------- | ---------------------------- | ------------------------------------- |
| Development | `debug` level+, ANSI colored | `debug` level+, no filtering          |
| Production  | `info` level+                | `info` level+, filters `debug`/`warn` |

## Architecture

```
                    src/shared/logger/
                    ┌─────────────────┐
                    │  createLogger()  │  Unified API, business code only uses this
                    └────────┬────────┘
                             │ process.type === "browser" ?
                    ┌────────┴────────┐
              Yes   │                 │  No
         ┌─────────▼──┐       ┌──────▼──────────┐
         │ mainLogFn  │       │ rendererScopeFn │
         │ (DI inject)│       │  (DI inject)    │
         └─────┬──────┘       └──────┬──────────┘
               │                     │
               ▼                     ▼
        LoggerService          electron-log/renderer
        .logMain()             .scope(category)
               │                     │ (bridged via preload)
               ▼                     ▼
          electron-log ──────────► file + console
          scope("main/{category}")
```

### DI Injection Points

**Main Process**: `electron/main/services/index.ts`

```typescript
import { loggerService } from "./logger-service";
import { initMainProcessLogger } from "@shared/logger";

initMainProcessLogger((level, category, message, ...args) => {
	loggerService.logMain(level, category, message, ...args);
});
```

**Renderer Process**: `src/routes/+layout.svelte`

```typescript
import { initRendererLogger } from "@shared/logger";
import log from "electron-log/renderer";

initRendererLogger((category) => log.scope(category));
```

### Key Files

| File                                             | Responsibility                                                         |
| ------------------------------------------------ | ---------------------------------------------------------------------- |
| `src/shared/logger/types.ts`                     | Type definitions: `LogLevel`, `LogCategory`, `Logger` interface        |
| `src/shared/logger/index.ts`                     | `createLogger()` factory function + DI injection functions             |
| `electron/main/services/logger-service/index.ts` | Main process logger service (electron-log config, file paths, cleanup) |

## Adding New Categories

To add a new log category (e.g., `"network"`), extend the corresponding union type in `src/shared/logger/types.ts`:

```typescript
export type RendererProcessCategory =
	| "ui"
	| "chat"
	// ... existing categories
	| "network"; // new category
```

TypeScript will automatically validate all `createLogger("network")` calls.
