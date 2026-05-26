# AI Code Review Workflow

Automated AI-powered PR code review using Claude.

## How It Works

```
feat/xxx PR opened/updated
       ↓
GitHub Actions triggers ai-review workflow
       ↓
Claude reads AGENTS.md + docs/ for project standards
       ↓
Claude reviews PR diff against quality checklist
       ↓
Posts review comment on PR (🔴🟡🟢 severity)
       ↓
Developer addresses feedback
       ↓
Push new commit → re-triggers review
```

## Trigger Conditions

The workflow automatically triggers on:

- PR **opened** against `dev/*` branches
- PR **updated** (new commits pushed)
- Does NOT trigger for: release branches, dependabot PRs

## Configuration

### Required GitHub Secrets

Set these in **Settings → Secrets and variables → Actions**:

| Secret               | Description                    | Example                    |
| -------------------- | ------------------------------ | -------------------------- |
| `ANTHROPIC_API_KEY`  | API key for Claude             | `sk-ant-...`               |
| `ANTHROPIC_BASE_URL` | Custom API endpoint (optional) | `https://api.302ai.com/v1` |

### Using 302.AI as API Provider

If you want to use 302.AI or another proxy instead of direct Anthropic API:

1. Set `ANTHROPIC_BASE_URL` to your proxy endpoint
2. Set `ANTHROPIC_API_KEY` to your proxy API key

### Restricting to Specific Target Branches

By default, the workflow triggers on all PRs. To restrict to `dev/*` branches only:

```yaml
on:
    pull_request:
        types: [opened, synchronize]
        branches:
            - "dev/*"
```

### Changing AI Model

Edit the `--model` flag in the workflow:

```yaml
claude_args: |
    --model claude-sonnet-4-6    # Fast, cost-effective (recommended)
    # --model claude-opus-4-6    # More thorough, higher cost
```

## Review Checklist

The AI reviewer checks these categories based on the changed files' domain:

### 🔴 Blocker (Must Fix)

**Security:**

- Hardcoded secrets, API keys, tokens, passwords
- XSS, SQL injection, command injection
- Electron security violations:
    - `nodeIntegration: true` (must be `false`)
    - `contextIsolation: false` (must be `true`)
    - Direct `ipcRenderer` exposure to renderer (must use `contextBridge`)
    - Usage of `remote` module (deprecated, forbidden)
    - `webSecurity: false` (must not disable)

**Type Safety:**

- `any` types (use `unknown` or specific types)
- Missing return type annotations on functions
- `@ts-ignore` or `@ts-nocheck` (avoid unless justified)

**Architecture:**

- Wrong code location (see docs/decision-trees/code-location.md)
- Non-standard IPC service structure
- Store not using singleton pattern
- Cross-layer direct dependencies (e.g. renderer importing electron modules)

**Electron-specific:**

- BrowserWindow missing secure `webPreferences`
- `ipcMain.handle`/`ipcMain.on` callbacks without error handling
- Uncleaned event listeners (memory leaks):
    - `ipcRenderer.on` without corresponding `removeListener`
    - `BrowserWindow.on` without cleanup on `closed`
    - `app.on` global listeners without lifecycle management
- Blocking operations in main process (should use async APIs)
- `webContents.send` called on destroyed window (check `win.isDestroyed()` first)

**Quality Gates:**

- `console.log` (use `createLogger()`)
- Code that would fail `pnpm check` or `pnpm lint`

### 🟡 Major (Should Fix)

**Svelte 5:**

- Legacy `on:click` instead of `onclick`
- `slot` instead of `Snippet`
- Not using `$state()`/`$derived()`/`$props()` runes
- `$:` reactive statements (migrate to `$derived` or `$effect`)
- Direct prop mutation (use callbacks)

**Electron IPC:**

- Large data over IPC (should chunk or stream)
- Using send/on instead of `invoke` for request-response
- Preload script without channel allowlist validation

**Code Quality:**

- Missing path aliases (`$lib`/`@shared`)
- Relative imports beyond 2 levels (`../../..`)
- Unused imports
- async functions without try-catch
- Unhandled Promise rejections
- Silent catch (`catch {}`)

**Accessibility:**

- Missing ARIA labels on interactive elements
- Keyboard navigation broken
- Insufficient color contrast

### 🟢 Minor (Optional)

**Code Quality:**

- Functions over 50 lines (consider splitting)
- Duplicate code (3+ same patterns → extract utility)
- Deep nesting (3+ levels → extract sub-function)
- Magic numbers (extract to named constants)
- Unclear names (`data`, `temp`, `foo`)

**Conventions:**

- Variables/functions: camelCase
- Classes/interfaces/types: PascalCase
- Files: kebab-case
- Constants: UPPER_SNAKE_CASE

**Styling:**

- Not using CSS variables or Tailwind
- Hardcoded color values
- Inline styles (use classes)

**i18n:**

- User-facing text not using `$lib/paraglide/messages`
- New keys not added to both `messages/en.json` and `messages/zh.json`

**Testing:**

- Missing tests for new features
- Missing tests for critical paths (IPC, state management, data transforms)

## Review Output Format

The AI posts a structured comment on each PR:

```
## 🤖 AI Code Review

### 摘要
One-line summary of changes and quality assessment.

### 审查结果

#### 🔴 Blocker
- **file.ts:42** — Description
  > 修复建议：Specific fix

#### 🟡 Major
- **component.svelte:15** — Description
  > 修复建议：Specific fix

#### 🟢 Minor
- **utils.ts:8** — Description
  > 修复建议：Specific fix

### 总体评价
✅ 可以合并 / ⚠️ 修复后可合并 / ❌ 需要重大修改
```

## Security Model

The AI reviewer operates with **read-only** access:

- **Can read**: Repository code, PR diff, documentation
- **Can run**: `pnpm check`, `pnpm lint` (read-only quality checks)
- **Cannot**: Edit files, push commits, merge PRs, approve PRs
- **Cannot**: Access secrets, environment variables, or other workflows

## Cost Estimation

| Model             | Approx. Cost per Review | Speed |
| ----------------- | ----------------------- | ----- |
| claude-sonnet-4-6 | ~$0.01-0.05             | ~30s  |
| claude-opus-4-6   | ~$0.05-0.20             | ~60s  |

Cost varies with PR size. Most reviews use 2k-10k tokens.

## Troubleshooting

### Workflow doesn't trigger

- Check that the PR targets a matching branch
- Verify `ANTHROPIC_API_KEY` secret is set
- Check the Actions tab for error logs

### AI review is empty or low quality

- Large PRs (>500 lines changed) may lose context — consider splitting
- Ensure `AGENTS.md` and `docs/` are up to date
- Try switching to a more capable model (`claude-opus-4-6`)

### Rate limiting

- The workflow uses `--max-turns 3` to limit API calls
- Each PR update re-triggers the review
- Consider adding `paths-ignore` for documentation-only changes

## Future Enhancements

- [ ] Scheduled sweep of `dev/*` branches (Phase 2)
- [ ] Auto-fix for minor issues with separate PR (Phase 2)
- [ ] Integration review for `dev/* → develop` PRs (Phase 2)
- [ ] Custom skills via `.agents/skills/` directory
- [ ] PR size-based model selection (small → sonnet, large → opus)

## See Also

- [Quality Gates](../quality/quality-gates.md)
- [Code Location Decision Tree](../decision-trees/code-location.md)
- [Debugging Workflow](./debugging.md)
