# Tech Stack

Complete technology stack for 302-AI-Studio.

## Frontend

| Category   | Technology     | Version       | Purpose              |
| ---------- | -------------- | ------------- | -------------------- |
| Framework  | SvelteKit      | 2.39.1        | SSR/SSG framework    |
| UI Library | Svelte         | 5.38.10       | Reactive UI          |
| Language   | TypeScript     | 5.9.2         | Type safety          |
| Styling    | TailwindCSS    | 4.1.13        | Utility-first CSS    |
| Components | Shadcn-Svelte  | bits-ui 2.9.8 | 60+ UI components    |
| State      | Svelte 5 Runes | Built-in      | `$state`, `$derived` |
| i18n       | Paraglide-js   | 2.3.2         | Internationalization |

## Desktop

| Category | Technology       | Version | Purpose                |
| -------- | ---------------- | ------- | ---------------------- |
| Runtime  | Electron         | 38.1.0  | Desktop wrapper        |
| Build    | Electron Forge   | 7.9.0   | Packaging/distribution |
| IPC      | Custom Generator | -       | Type-safe IPC          |

## Backend

| Category    | Technology                | Version | Purpose                  |
| ----------- | ------------------------- | ------- | ------------------------ |
| HTTP Server | Hono                      | 4.9.10  | AI streaming (port 8089) |
| AI SDK      | Vercel AI SDK             | 6.0.1   | Unified AI interface     |
| Anthropic   | @ai-sdk/anthropic         | 3.0.0   | Claude integration       |
| OpenAI      | @ai-sdk/openai            | 3.0.0   | GPT integration          |
| Google      | @ai-sdk/google            | 3.0.0   | Gemini integration       |
| MCP         | @modelcontextprotocol/sdk | 1.20.0  | MCP servers              |
| Storage     | @302ai/unstorage          | -       | Persistent storage       |

## Development

| Category        | Technology   | Version | Purpose               |
| --------------- | ------------ | ------- | --------------------- |
| Package Manager | pnpm         | 10.18.3 | Dependency management |
| Linter          | ESLint       | 9.35.0  | Code linting          |
| Formatter       | Prettier     | 3.4.2   | Code formatting       |
| Type Checker    | svelte-check | -       | Svelte type checking  |
| Unit Tests      | Vitest       | 3.2.4   | Unit testing          |
| E2E Tests       | Playwright   | 1.55.0  | End-to-end testing    |
| Pre-commit      | pre-commit   | -       | Git hooks             |

## Build Tools

| Category | Technology               | Version | Purpose                |
| -------- | ------------------------ | ------- | ---------------------- |
| Bundler  | Vite                     | 6.0.11  | Fast builds            |
| Adapter  | @sveltejs/adapter-static | 4.0.1   | Static site generation |
| Makers   | Squirrel, DMG, Deb, RPM  | -       | Platform installers    |

## Key Dependencies

- **@302ai/unstorage**: Custom storage with migrations
- **@ai-sdk/mcp**: MCP integration for AI SDK
- **bits-ui**: Headless UI components for Svelte
- **mode-watcher**: Dark/light mode management
- **zod**: Runtime type validation

## Package Manager Note

**MUST use pnpm** - Project includes patches for:

- SvelteKit
- @electron/notarize

Using npm or yarn will break the build.

## Version Requirements

- Node.js: >=18.0.0
- pnpm: >=10.0.0
- Python: >=3.8 (for node-gyp)

## See Also

- [Architecture Overview](../architecture/index.md)
- [Development Commands](../../AGENTS.md#quick-start)
