# External Integrations

**Analysis Date:** 2026-02-02

## APIs & External Services

**AI Providers:**
- Anthropic Claude - AI chat and code generation
  - SDK/Client: @ai-sdk/anthropic 3.0.0
  - Auth: API key (user-provided)
  - Endpoint: Anthropic API (via SDK)

- OpenAI - AI chat and completions
  - SDK/Client: @ai-sdk/openai 3.0.0
  - Auth: API key (user-provided)
  - Endpoint: OpenAI API (via SDK)

- Google Gemini - AI chat
  - SDK/Client: @ai-sdk/google 3.0.0
  - Auth: API key (user-provided)
  - Endpoint: Google Generative AI API (via SDK)

- 302.AI Platform - Unified AI provider and services
  - SDK/Client: @302ai/ai-sdk 0.2.14
  - Auth: API key (via SSO or manual entry)
  - Endpoints:
    - `https://api.302ai.com/v1` - AI model API
    - `https://api.302ai.com/302/claude-code/sandbox/*` - Claude Code sandbox management
    - `https://api.302ai.com/user/info` - User information
    - `https://api.302ai.com/gpt/api/tool/list` - AI application/tool list
    - `https://api.302ai.com/gpt/api/v1/code` - Application codes
  - Implementation: `electron/main/apis/core/_302ai-ky.ts`
  - HTTP-Referer: `https://studio.302.ai/`

- OpenAI-Compatible Providers - Generic OpenAI API compatible services
  - SDK/Client: @ai-sdk/openai-compatible 2.0.0
  - Auth: API key (user-provided)
  - Endpoint: User-configurable base URL

**Claude Code Sandbox:**
- 302.AI Claude Code Sandbox Service
  - Purpose: Cloud-based code execution environments
  - Endpoints:
    - Create: `302/claude-code/sandbox/create`
    - Reset: `302/claude-code/sandbox/reset`
    - List: `https://api.302ai.com/302/claude-code/sandbox/list`
    - MCP Add: `302/claude-code/sandbox/mcp/add`
  - Implementation: `electron/main/apis/code-agent.ts`
  - Features: Session management, file operations, terminal access

**Model Context Protocol (MCP):**
- MCP Server Integration - Tool and context providers
  - SDK/Client: @modelcontextprotocol/sdk 1.20.0, @ai-sdk/mcp 1.0.0
  - Transport types: stdio, SSE, streamableHTTP
  - Implementation: `electron/main/services/mcp-service/index.ts`
  - Configuration: User-managed MCP servers with custom commands/URLs

## Data Storage

**Databases:**
- None - No external database services

**File Storage:**
- Local filesystem only
  - Driver: @302ai/unstorage with fsDriver
  - Development path: `{project-root}/storage/`
  - Production path: `{userData}/storage/`
  - Implementation: `electron/main/services/storage-service/index.ts`
  - Format: JSON files with .json extension
  - Features: Migration support, versioning, watch capabilities

**Caching:**
- In-memory only (no external cache service)

## Authentication & Identity

**Auth Provider:**
- 302.AI SSO (Single Sign-On)
  - Implementation: Custom SSO flow via external browser
  - Protocol: `ai302studio://` deep link handler
  - Flow:
    1. Open SSO URL in external browser: `https://302.ai/sso`
    2. User authenticates on 302.ai
    3. Redirect to local server: `http://localhost:{port}/sso/callback/{lang}`
    4. API key returned via query parameter
  - Implementation: `electron/main/services/sso-service/index.ts`
  - Timeout: 300 seconds (5 minutes)
  - Callback handler: `electron/main/server/router.ts` (lines 1777-1797)

**Session Management:**
- Local session storage via @302ai/unstorage
  - User info stored in `electron/main/services/storage-service/session-storage.ts`
  - No external session service

## Monitoring & Observability

**Error Tracking:**
- None - No external error tracking service (Sentry, Bugsnag, etc.)

**Logs:**
- Console logging only
  - Development: stdout/stderr
  - Production: Electron log files (OS-specific)

**Analytics:**
- None detected

## CI/CD & Deployment

**Hosting:**
- Self-hosted desktop application (Electron)
- No web hosting required

**Update Server:**
- 302.AI Update Server
  - Base URL: `https://updater.302.ai`
  - Path pattern: `/update/{appId}/{channel}/{platform}/{arch}/{version}`
  - Channels: stable, beta
  - Implementation: `electron/main/services/updater-service/index.ts`
  - Protocol: Squirrel (Windows and macOS)
  - Check interval: 60 minutes

**CI Pipeline:**
- GitHub Actions (inferred from @electron-forge/publisher-github)
  - Publisher: @electron-forge/publisher-github 7.9.0
  - Release artifacts published to GitHub Releases

**Code Signing:**
- macOS: @electron/osx-sign 2.2.0, @electron/notarize 3.1.0 (patched)
- Windows: Certificate support via Electron Forge

## Environment Configuration

**Required env vars:**
- None required for basic operation
- Optional: Custom MCP server environment variables (user-configured)

**Secrets location:**
- API keys stored in local storage (encrypted by OS)
- Storage path: `{userData}/storage/` (OS-managed secure location)
- No .env files used

**Configuration files:**
- `storage/` directory - All persistent configuration
- User data managed by `electron/main/services/app-service/user-data-manager.ts`

## Webhooks & Callbacks

**Incoming:**
- SSO Callback - `http://localhost:{port}/sso/callback/{lang}`
  - Purpose: Receive API key from 302.AI SSO
  - Method: GET with query parameter `?apikey=...`
  - Handler: `electron/main/server/router.ts`
  - Port: Dynamic (allocated via get-port)

**Outgoing:**
- None - No webhooks sent to external services

## Plugin System

**Plugin Marketplace:**
- Custom plugin system with SDK
  - SDK: @302ai/studio-plugin-sdk (workspace package)
  - Registry: `packages/plugin-registry/`
  - Loader: `electron/main/plugin-manager/plugin-loader.ts`
  - Sandbox: `electron/main/plugin-manager/sandbox.ts`
  - API: `electron/main/plugin-manager/plugin-api.ts`
  - Storage: Isolated per-plugin storage via plugin API

**Plugin Types:**
- Provider plugins - Custom AI provider integrations
- Hook plugins - Lifecycle and event hooks

## Network Configuration

**Interceptors:**
- Custom request header injection
  - Implementation: `electron/main/utils/network-interceptor.ts`
  - Purpose: Add custom headers to outgoing requests
  - Scope: Electron session.defaultSession.webRequest

**Proxy:**
- System proxy support (Electron default behavior)

**Firewall Requirements:**
- Outbound HTTPS to:
  - api.302ai.com (port 443)
  - updater.302.ai (port 443)
  - Anthropic API endpoints
  - OpenAI API endpoints
  - Google AI API endpoints
  - User-configured MCP servers
- Inbound: localhost only (dynamic port for local Hono server)

---

*Integration audit: 2026-02-02*
