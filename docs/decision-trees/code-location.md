# Decision Tree: Where Should This Code Live?

Use this decision tree to determine the correct location for new code.

## Start Here

**What are you building?**

### 1. User Interface Component

**Is it reusable across features?**

- ✅ Yes → `src/lib/components/ui/[component-name]/`
    - Examples: Button, Dialog, Input, Select
    - Pattern: Shadcn-Svelte style with variants
- ❌ No → `src/lib/components/buss/[feature]/[component-name]/`
    - Examples: ChatInput, ModelSelector, PluginCard
    - Pattern: Feature-specific business logic

### 2. State Management

**Does it need persistence?**

- ✅ Yes → Use `pnpm gen:state <Name> --persist`
    - Location: `src/lib/stores/[name]-state.svelte.ts`
    - Type def: `src/shared/storage/[name]-state.ts`
- ❌ No → Use `pnpm gen:state <Name>`
    - Location: `src/lib/stores/[name]-state.svelte.ts`

**Is it per-tab/thread specific?**

- ✅ Yes → Add `--scoped` flag
- ❌ No → Global singleton

See [state-management.md](./state-management.md) for detailed decision tree.

### 3. Backend Logic

**Does renderer need to call it?**

- ✅ Yes → IPC Service
    - Use: `pnpm gen:service <Name>`
    - Location: `electron/main/services/[name]-service/`
- ❌ No → Utility or internal module
    - Location: `electron/main/utils/` or within service

### 4. API Integration

**Is it AI streaming?**

- ✅ Yes → Add to Hono router
    - Location: `electron/main/server/router.ts`
- ❌ No → HTTP client
    - Location: `electron/main/apis/[name]-ky.ts`

### 5. Types/Interfaces

**Shared between main and renderer?**

- ✅ Yes → `src/shared/types/`
- ❌ No, renderer only → `src/lib/types/`
- ❌ No, main only → `electron/main/types/`

### 6. Routes/Pages

**What layout does it need?**

- Sidebar layout → `src/routes/(with-sidebar)/[path]/`
- Settings layout → `src/routes/(settings-page)/settings/[path]/`
- Full custom → `src/routes/(root)/[path]/`

## Quick Reference

| Code Type               | Location                   | Command            |
| ----------------------- | -------------------------- | ------------------ |
| UI Component (reusable) | `src/lib/components/ui/`   | Manual             |
| Business Component      | `src/lib/components/buss/` | Manual             |
| Global State            | `src/lib/stores/`          | `pnpm gen:state`   |
| IPC Service             | `electron/main/services/`  | `pnpm gen:service` |
| Shared Types            | `src/shared/types/`        | Manual             |
| Route                   | `src/routes/(group)/`      | Manual             |

## Still Unsure?

Check existing similar code and follow the same pattern.
