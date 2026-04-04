# Quality Gates

All code must pass these gates before merging.

## Automated Gates (Pre-commit)

These run automatically via `.pre-commit-config.yaml`:

### 1. Type Safety

```bash
pnpm check
```

- Runs `svelte-check` with TypeScript validation
- Must pass with 0 errors
- Checks both `src/` and `packages/plugin-sdk/`

### 2. Linting

```bash
pnpm lint
```

- ESLint with TypeScript + Svelte rules
- No `console.log` in `src/` (use logger)
- No unused variables (except `_` prefix)
- Auto-fix available: `pnpm lint:fix`

### 3. Formatting

```bash
pnpm format:check
```

- Prettier with project config:
    - Tabs (not spaces)
    - Double quotes
    - 100 char line width
    - Trailing commas
- Auto-fix available: `pnpm format`

### 4. Commit Messages

- Conventional Commits format required
- Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`, `build`, `revert`
- Example: `feat(chat): add message editing`

## Manual Gates (Before PR)

### 5. IPC Regeneration

If you modified IPC services:

```bash
pnpm generate:ipc
```

Commit the generated files.

### 6. Testing

```bash
pnpm test              # Run all tests
pnpm test:unit         # Unit tests only
pnpm test:e2e          # E2E tests only
```

### 7. Quality Check

Run complete quality suite:

```bash
pnpm quality           # check + lint + format:check
```

## Quality Standards

### Code Coverage

- Services: 80%+ coverage target
- Utilities: 90%+ coverage target
- UI components: Test critical paths

### Code Review Checklist

- [ ] All quality gates pass
- [ ] Tests added for new features
- [ ] IPC bindings regenerated (if applicable)
- [ ] No console.log (use logger)
- [ ] Types are strict (no `any`)
- [ ] Error handling present
- [ ] i18n keys added (if UI changes)

## Enforcement

**Pre-commit**: Blocks commit if checks fail
**CI/CD**: Runs same checks on push
**PR Review**: Human review required

## Quick Fix

If pre-commit fails:

```bash
pnpm quality:fix       # Auto-fix lint + format
pnpm check             # Verify types
```

## See Also

- [Testing Standards](./testing-standards.md)
- [Code Review Checklist](./code-review-checklist.md)
