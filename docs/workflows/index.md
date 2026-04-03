# Development Workflows

Step-by-step guides for common development tasks.

## Available Workflows

### Core Development

- [Adding an IPC Service](./adding-ipc-service.md) - Create type-safe Electron IPC services
- [Adding a Svelte Store](./adding-store.md) - Create reactive state with Svelte 5 runes
- [Adding a UI Component](./adding-component.md) - Build base or business components
- [Debugging Issues](./debugging.md) - Diagnose and fix problems by layer

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
