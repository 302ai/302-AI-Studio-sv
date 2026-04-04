# Gemini Context: 302 AI Studio

This document provides a comprehensive overview of the 302 AI Studio project, its structure, and development conventions to be used as a context for Gemini.

## Project Overview

302 AI Studio is a cross-platform desktop application for Windows, Mac, and Linux that serves as a client for various Large Language Model (LLM) service providers like OpenAI, Anthropic, and Google. It is built using a modern web technology stack.

- **Core Functionality:** The application provides a multi-tab chat interface, allowing users to interact with different AI models. It supports advanced features like parameter control, document and image analysis, code syntax highlighting, and an "Agent Mode" for intelligent task automation.
    - **Architecture:** The project is a monorepo-like structure with a clear separation between the Electron main process and the SvelteKit renderer process.
        - **Electron Main Process (`/electron`):** Handles window management, native OS integration, and backend services exposed to the renderer via IPC.
        - **SvelteKit Renderer Process (`/src`):** Contains the entire user interface, built as a SvelteKit application. It communicates with the Electron main process for native functionalities.

    ### Multi-Window & Multi-WebContents Architecture

    The application employs a sophisticated hybrid architecture to manage its windows and tabs, leveraging modern Electron features for efficiency.
    - **`BrowserWindow` for Top-Level Windows:** The application creates distinct `BrowserWindow` instances for different types of top-level windows:
        - **Shell Windows:** These are the main application windows that house the tabbed user interface. Multiple shell windows can exist.
        - **Settings Window:** A single, separate `BrowserWindow` is used to display the settings page, which has a standard OS-level title bar.
        - **Plugin Windows:** Plugins have the capability to create their own `BrowserWindow` instances.

    - **`WebContentsView` for Tabs:** Instead of creating a new `BrowserWindow` for each tab (which is resource-intensive), the application uses `WebContentsView`. A single "Shell Window" (`BrowserWindow`) acts as a host for multiple `WebContentsView` instances.
        - One `WebContentsView` is used for the window's main UI (the "shell," including the tab bar), loaded from the `/shell/:windowId` route.
        - Each individual tab (e.g., a chat session) is rendered in its own separate `WebContentsView`. The `TabService` manages showing and hiding these views as the user navigates between tabs.

    - **Core Management Services:**
        - **`WindowService` (`electron/main/services/window-service/index.ts`):** The central controller for all `BrowserWindow` instances. It handles creating, tracking, and destroying windows. It also orchestrates complex interactions like splitting a tab into a new window or merging tabs between existing windows.
        - **`TabService` (`electron/main/services/tab-service/index.ts`):** Manages the entire lifecycle of tabs within each Shell Window. It keeps track of which `WebContentsView` belongs to which tab and which window, and orchestrates switching between them.
        - **`WebContentsFactory` (`electron/main/factories/web-contents-factory.ts`):** A factory that centralizes the creation and configuration of all `WebContentsView`s (for shells, tabs, and AI applications). This ensures consistent settings, preload scripts, and context for each view.

    ### State Management & Persistence

    The application handles state persistence and synchronization across windows/tabs using a custom reactive solution.
    - **`PersistedState` Class (`src/lib/hooks/persisted-state.svelte.ts`):** This is the core utility for managing persistent state.
        - **Reactivity:** Built on Svelte 5 Runes (`$state`), it provides a reactive `current` property. Changes to this property automatically trigger UI updates in Svelte components.
        - **Persistence:** It communicates with the Electron main process via `window.electronAPI.storageService` to save state to disk (using `unstorage` in the backend).
        - **Synchronization:** It listens for `onPersistedStateSync` IPC events. This ensures that if a state changes in one window (e.g., settings update), it is automatically reflected in all other open windows or tabs that use the same state key.
        - **Debouncing:** Writes to storage are debounced by default to prevent performance bottlenecks during rapid state changes.

    - **Global Stores:** Most application-wide state is defined in `src/lib/stores` using `PersistedState`. Examples include:
        - `persistedThemeState`: Manages the application theme.
        - `persistedUserState`: Stores user session and profile info.
        - `persistedChatParametersState`: Saves chat configuration preferences.

- **Key Technologies:**
    - **Framework:** SvelteKit 5 - **Desktop:** Electron 38
    - **Language:** TypeScript
    - **UI:** Svelte 5 Runes, Shadcn-Svelte, TailwindCSS 4.x
    - **State Management:** Svelte 5 Runes (`$state`, `$derived`)
    - **Build Tool:** Vite with Electron Forge
    - **Testing:** Playwright for E2E tests and Vitest for unit tests.
    - **Package Manager:** pnpm (mandatory)

## Building and Running

The project uses `pnpm` for package management. All commands should be run from the root of the project.

### Development

To start the application in development mode with hot-reloading:

```bash
pnpm dev
```

### Production Build

To build and package the application for production:

```bash
# 1. Build the SvelteKit app and Electron main process
pnpm build

# 2. Package the application for the current OS (output to /out)
pnpm package

# 3. Create a distributable installer
pnpm make
```

### Testing

The project has both unit and end-to-end tests.

```bash
# Run unit tests
pnpm test:unit

# Run end-to-end tests
pnpm test:e2e

# Run all tests
pnpm test
```

## Development Conventions

- **Package Manager:** `pnpm` must be used. This is enforced partly due to patches applied to dependencies (e.g., `@sveltejs/kit`).
- **Code Style:** The project uses Prettier for code formatting and ESLint for linting.
    - To format all files: `pnpm format`
    - To lint all files: `pnpm lint`
- **Type Checking:** TypeScript is used throughout the project. To run the type checker: `pnpm check`
- **IPC Services:** The project uses a custom script to generate IPC service bindings between the Electron main process and the renderer. This ensures type safety across the IPC boundary. The generation script is `scripts/generate-ipc.ts`.
- **Commits:** The project uses conventional commits. A `pre-commit` hook is installed via `postinstall` to enforce this.
- **Directory Structure:**
    - `electron/`: Contains all code for the Electron main and preload processes.
        - `electron/main/services/`: Defines IPC services that can be called from the renderer process.
    - `src/`: Contains all code for the SvelteKit renderer process (the UI).
        - `src/lib/components/`: Reusable Svelte components.
        - `src/routes/`: Application pages and layouts.
        - `src/shared/`: Code shared between the main and renderer processes.
    - `packages/`: Contains local packages, like the `plugin-sdk`.
