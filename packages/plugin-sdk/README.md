# @302ai/studio-plugin-sdk

Plugin SDK for 302.AI Studio - Build powerful AI provider plugins with ease.

[![npm version](https://badge.fury.io/js/@302ai%2Fstudio-plugin-sdk.svg)](https://www.npmjs.com/package/@302ai/studio-plugin-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

The 302.AI Studio Plugin SDK allows developers to create custom AI provider plugins that integrate seamlessly with the 302.AI Studio desktop application. Build plugins to add support for new AI providers, customize message processing, or extend functionality with hooks.

## Features

- 🎯 **Type-Safe API** - Full TypeScript support with comprehensive type definitions
- 🧩 **BaseProviderPlugin** - Abstract base class with common utilities
- 🪝 **Hook System** - Intercept and modify messages, responses, and errors
- 💾 **Storage API** - Persist plugin configuration and data
- 🌐 **HTTP Client** - Built-in authenticated HTTP requests
- 🎨 **UI Integration** - Show notifications, dialogs, and custom components
- 📝 **Logging** - Structured logging with plugin context
- 🌍 **i18n Support** - Built-in internationalization capabilities

## Installation

```bash
# Using npm
npm install @302ai/studio-plugin-sdk

# Using pnpm
pnpm add @302ai/studio-plugin-sdk

# Using yarn
yarn add @302ai/studio-plugin-sdk
```

## Quick Start

### Creating a Basic Provider Plugin

```typescript
import { BaseProviderPlugin, type Model, type ModelProvider } from "@302ai/studio-plugin-sdk";

export class MyProviderPlugin extends BaseProviderPlugin {
	protected providerId = "my-provider";
	protected providerName = "My AI Provider";
	protected apiType = "openai";
	protected defaultBaseUrl = "https://api.example.com/v1";

	protected websites = {
		official: "https://example.com",
		apiKey: "https://example.com/api-keys",
		docs: "https://docs.example.com",
		models: "https://docs.example.com/models",
	};

	async onFetchModels(provider: ModelProvider): Promise<Model[]> {
		const url = this.buildApiUrl(provider, "models");
		const response = await this.httpRequest<{ data: any[] }>(url, {
			method: "GET",
			provider,
		});

		return response.data.map((model) => ({
			id: model.id,
			name: model.name,
			remark: `${this.providerName} ${model.id}`,
			providerId: this.providerId,
			capabilities: this.parseModelCapabilities(model.id),
			type: "language",
			custom: false,
			enabled: true,
			collected: false,
		}));
	}
}

export default MyProviderPlugin;
```

### Plugin Configuration

Create a `plugin.json` file in your plugin directory:

```json
{
	"id": "com.example.my-provider",
	"name": "My AI Provider",
	"version": "1.0.0",
	"type": "provider",
	"description": "Integration with My AI Provider API",
	"author": "Your Name",
	"permissions": ["network", "storage"],
	"compatibleVersion": ">=1.0.0",
	"main": "main/index.js",
	"builtin": false,
	"configSchema": {
		"type": "object",
		"properties": {
			"apiKey": {
				"type": "string",
				"title": "API Key",
				"description": "Your API key for authentication"
			}
		},
		"required": ["apiKey"]
	}
}
```

## Core Concepts

### BaseProviderPlugin

The `BaseProviderPlugin` abstract class provides:

- **Authentication** - Default API key validation
- **HTTP Utilities** - Authenticated requests with proper headers
- **Model Parsing** - Capability and type detection
- **Error Handling** - Common error scenarios (401, 429, timeout)
- **Logging & Notifications** - Built-in logging and user notifications

**Required Methods:**

- `onFetchModels(provider: ModelProvider): Promise<Model[]>` - Fetch available models

**Optional Overrides:**

- `getIconUrl()` - Custom provider icon
- `getConfigSchema()` - Custom configuration schema
- `testConnection(provider)` - Connection validation
- `getAuthHeaders(provider)` - Custom authentication headers

### Hook System

Plugins can implement hooks to customize behavior:

#### onBeforeSendMessage

Modify messages before sending to the AI:

```typescript
async onBeforeSendMessage(context: MessageContext): Promise<MessageContext> {
  // Add system prompt
  context.messages.unshift({
    role: "system",
    content: "You are a helpful assistant.",
  });
  return context;
}
```

#### onAfterSendMessage

Process responses after receiving:

```typescript
async onAfterSendMessage(context: MessageContext, response: AIResponse): Promise<void> {
  this.log("info", `Used ${response.usage?.totalTokens} tokens`);
}
```

#### onStreamChunk

Modify streaming response chunks:

```typescript
async onStreamChunk(chunk: StreamChunk): Promise<StreamChunk> {
  if (chunk.type === "text" && chunk.text) {
    chunk.text = chunk.text.toUpperCase(); // Example modification
  }
  return chunk;
}
```

#### onError

Handle errors with retry logic:

```typescript
async onError(context: ErrorContext): Promise<ErrorHandleResult> {
  if (context.error.message.includes("429")) {
    return {
      handled: true,
      retry: true,
      retryDelay: 5000,
      message: "Rate limit exceeded. Retrying in 5 seconds...",
    };
  }
  return { handled: false };
}
```

### Plugin API

The `PluginAPI` is injected during initialization:

#### Storage

```typescript
// Configuration (visible in UI)
await this.api.storage.setConfig("apiKey", "sk-...");
const apiKey = await this.api.storage.getConfig<string>("apiKey");

// Private data (not visible in UI)
await this.api.storage.setData("cache", { timestamp: Date.now() });
const cache = await this.api.storage.getData("cache");
```

#### HTTP Client

```typescript
// GET request
const models = await this.api.http.get<ModelList>("https://api.example.com/models");

// POST request with body
const result = await this.api.http.post("https://api.example.com/chat", {
  messages: [...],
});
```

#### UI Integration

```typescript
// Show notification
this.api.ui.showNotification("Model loaded successfully", "success");

// Show dialog
const result = await this.api.ui.showDialog({
	title: "Confirm Action",
	message: "Are you sure?",
	type: "question",
	buttons: ["Yes", "No"],
});
```

#### Logging

```typescript
this.api.logger.debug("Debug information");
this.api.logger.info("Informational message");
this.api.logger.warn("Warning message");
this.api.logger.error("Error message");
```

## Advanced Usage

### Custom Authentication

Override `getAuthHeaders` for custom auth:

```typescript
protected getAuthHeaders(provider: ModelProvider): Record<string, string> {
  return {
    "X-API-Key": provider.apiKey,
    "X-Custom-Header": "value",
  };
}
```

### Capability Detection

Customize model capability parsing:

```typescript
protected parseModelCapabilities(modelId: string): Set<string> {
  const capabilities = new Set<string>();

  if (modelId.includes("vision")) {
    capabilities.add("vision");
  }

  if (modelId.includes("function")) {
    capabilities.add("function_call");
  }

  return capabilities;
}
```

### Direct ProviderPlugin Implementation

For full control, implement `ProviderPlugin` directly:

```typescript
import type { ProviderPlugin, PluginAPI } from "@302ai/studio-plugin-sdk";

export class CustomPlugin implements ProviderPlugin {
	api?: PluginAPI;

	async initialize(api: PluginAPI): Promise<void> {
		this.api = api;
	}

	getProviderDefinition() {
		return {
			id: "custom",
			name: "Custom Provider",
			// ... other properties
		};
	}

	async onAuthenticate(context) {
		// Custom auth logic
	}

	async onFetchModels(provider) {
		// Custom model fetching
	}
}
```

## Type Reference

### Core Types

- `Model` - AI model definition
- `ModelProvider` - Provider configuration
- `ChatMessage` - Chat message structure
- `PluginMetadata` - Plugin metadata from plugin.json

### Hook Types

- `MessageContext` - Message hook context
- `StreamChunk` - Streaming response chunk
- `AIResponse` - Complete AI response
- `ErrorContext` - Error hook context
- `AuthContext` - Authentication hook context

### API Types

- `PluginAPI` - Main plugin API
- `PluginStorageAPI` - Storage operations
- `PluginHttpAPI` - HTTP client
- `PluginUIAPI` - UI operations
- `PluginLoggerAPI` - Logging utilities

## Examples

Check the `plugins/builtin/` directory in the main repository for complete examples:

- **OpenAI Plugin** - Standard OpenAI API integration
- **Anthropic Plugin** - Claude models with custom headers
- **Google Plugin** - Gemini models with custom parsing
- **Debug Plugin** - Full hook implementation example

## Publishing Your Plugin

### Package Structure

```
my-plugin/
├── plugin.json          # Plugin metadata
├── main/
│   └── index.ts        # Main plugin code
├── package.json        # npm package config
└── README.md           # Plugin documentation
```

### Build Script

```json
{
	"scripts": {
		"build": "tsc && cp plugin.json dist/"
	}
}
```

### Publishing to npm

```bash
npm publish --access public
```

Users can then install your plugin via URL in 302.AI Studio.

## Development Tips

1. **Use TypeScript** - Full type safety and autocomplete
2. **Test Thoroughly** - Test authentication, model fetching, and message sending
3. **Handle Errors** - Implement proper error handling and retry logic
4. **Log Appropriately** - Use appropriate log levels for debugging
5. **Document Config** - Provide clear configuration schema and defaults
6. **Version Compatibility** - Specify compatible app versions in plugin.json

## API Compatibility

This SDK follows semantic versioning. The API is stable for v1.x releases.

## License

MIT License - see LICENSE file for details

## Support

- 📖 [Documentation](https://github.com/302ai/302-AI-Studio-SV)
- 🐛 [Issue Tracker](https://github.com/302ai/302-AI-Studio-SV/issues)
- 💬 [Discussions](https://github.com/302ai/302-AI-Studio-SV/discussions)

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

---

Built with ❤️ by [302.AI](https://302.ai)
