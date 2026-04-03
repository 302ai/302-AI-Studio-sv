# Development Workflows

Step-by-step guides for common development tasks.

## 🛩️ AI Agent Pre-flight Checklist

Before you start any workflow, you **MUST** follow this checklist to ensure you are aligned with the project's current architecture and technology stack:

1. **Activate Skills**:
    - `activate_skill sveltekit-svelte5-tailwind-skill` (for UI/State/Frontend)
    - `activate_skill electron` (for Electron/Main Process)
2. **Read Mandates**: Re-read the **Global Mandate** in `AGENTS.md`.
3. **Research-First**: Use the Skill's `Stage 0-4` methodology to search for existing patterns in `src/lib/` or `electron/main/services/`.
4. **Use Generators**: **DO NOT** manually write boilerplate. Use `pnpm gen:service` or `pnpm gen:state`.
5. **Verify Stack**: Confirm you are using **Svelte 5 Runes** and **Tailwind v4** (no `$store` and no `@tailwindcss/ui` plugins).

## Available Workflows

### Core Development

- [Adding an IPC Service](./adding-ipc-service.md) - Create type-safe Electron IPC services
- [Adding a Svelte Store](./adding-store.md) - Create reactive state with Svelte 5 runes
- [Adding a UI Component](./adding-component.md) - Build base or business components
- [Debugging Issues](./debugging.md) - Diagnose and fix problems by layer

### AI Automation

- [AI Code Review](./ai-review.md) - Automated AI-powered PR code review

### Coming Soon

- Adding a Route
- Adding an AI Provider
- Adding an MCP Server
- Plugin Development
- Theme Customization
- Internationalization

## Workflow Structure

Each workflow follows this pattern:

1. **Decision Point** - Determine the right approach
2. **Setup** - Create necessary files/directories
3. **Implementation** - Write the code
4. **Integration** - Connect to existing systems
5. **Testing** - Verify functionality
6. **Quality Check** - Run quality gates

## Quick Reference

| Task              | Workflow                                      | Generator                 |
| ----------------- | --------------------------------------------- | ------------------------- |
| IPC communication | [Adding IPC Service](./adding-ipc-service.md) | `pnpm gen:service <Name>` |
| State management  | [Adding Svelte Store](./adding-store.md)      | `pnpm gen:state <Name>`   |
| UI component      | [Adding Component](./adding-component.md)     | Manual                    |
| AI code review    | [AI Code Review](./ai-review.md)              | GitHub Actions + Claude   |
| Fix bug           | [Debugging](./debugging.md)                   | N/A                       |

## Before You Start

1. Read [Architecture Overview](../architecture/index.md) to understand system design
2. Check [Decision Trees](../decision-trees/code-location.md) for architectural choices
3. Review [Quality Gates](../quality/quality-gates.md) for standards

## After Completion

1. Run `pnpm quality` to verify code quality
2. Test your changes manually
3. Add tests for new functionality
4. Update documentation if needed
5. Commit with conventional commit message

## See Also

- [Code Patterns](../patterns/) - Copy-paste templates
- [Quality Standards](../quality/) - Testing and review guidelines
- [Reference Documentation](../references/) - Deep technical details
