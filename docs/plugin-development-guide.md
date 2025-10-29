# 302-AI-Studio 插件开发指南

本指南将帮助你创建自己的 302-AI-Studio 插件，扩展应用功能。

## 目录

- [快速开始](#快速开始)
- [插件系统架构](#插件系统架构)
- [创建 Provider 插件](#创建-provider-插件)
- [Plugin API 参考](#plugin-api-参考)
- [Hook 系统](#hook-系统)
- [权限系统](#权限系统)
- [最佳实践](#最佳实践)
- [发布插件](#发布插件)

---

## 快速开始

### 1. 插件结构

一个标准的插件目录结构如下：

```
my-provider-plugin/
├── plugin.json          # 插件元数据（必需）
├── README.md           # 插件说明文档
├── icon.png            # 插件图标
├── main/               # 主进程代码
│   └── index.ts        # 插件入口
├── renderer/           # 渲染进程代码（可选）
│   └── components/     # Svelte 组件
└── locales/            # 国际化资源（可选）
    ├── en.json
    └── zh.json
```

### 2. plugin.json 配置

```json
{
	"id": "com.example.myprovider",
	"name": "My Provider",
	"version": "1.0.0",
	"type": "provider",
	"description": "My custom AI provider plugin",
	"author": "Your Name",
	"homepage": "https://example.com",
	"icon": "icon.png",
	"permissions": ["network", "storage"],
	"compatibleVersion": ">=0.1.0",
	"main": "main/index.js",
	"builtin": false,
	"tags": ["provider", "ai"],
	"defaultConfig": {
		"apiKey": "",
		"baseUrl": "https://api.example.com"
	}
}
```

### 3. 最简单的 Provider 插件

```typescript
// main/index.ts
import { BaseProviderPlugin } from "$lib/plugin-system/base-provider-plugin";
import type { Model, ModelProvider } from "@shared/types";

export class MyProviderPlugin extends BaseProviderPlugin {
	protected providerId = "my-provider";
	protected providerName = "My Provider";
	protected apiType = "openai"; // 使用 OpenAI 兼容 API
	protected defaultBaseUrl = "https://api.example.com/v1";

	protected websites = {
		official: "https://example.com",
		apiKey: "https://example.com/api-keys",
		docs: "https://docs.example.com",
		models: "https://docs.example.com/models",
	};

	async onFetchModels(provider: ModelProvider): Promise<Model[]> {
		const url = this.buildApiUrl(provider, "models");
		const response = await this.httpRequest<{ data: Array<{ id: string }> }>(url, {
			method: "GET",
			provider,
		});

		return response.data.map((model) => ({
			id: model.id,
			name: model.id,
			remark: "",
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

---

## 插件系统架构

### 核心组件

```
┌─────────────────────────────────────────────────────────────┐
│                     Plugin Manager                           │
│  • Plugin Loader      • Plugin Registry                     │
│  • Hook Manager       • Permission Manager                  │
└─────────────────────────────────────────────────────────────┘
                            ↓ ↑
┌─────────────────────────────────────────────────────────────┐
│                    Plugin API (Sandbox)                      │
│  • Storage API        • HTTP API                            │
│  • Hook API           • UI API                              │
│  • Logger API         • I18n API                            │
└─────────────────────────────────────────────────────────────┘
                            ↓ ↑
┌─────────────────────────────────────────────────────────────┐
│                    Your Plugin                               │
│  • Provider Implementation                                   │
│  • Hook Handlers                                            │
│  • UI Components                                            │
└─────────────────────────────────────────────────────────────┘
```

### 插件生命周期

```typescript
1. 加载 (Load)
   ├─ 扫描插件目录
   ├─ 读取 plugin.json
   ├─ 验证插件签名和权限
   └─ 加载插件模块

2. 初始化 (Initialize)
   ├─ 创建 Plugin API 实例
   ├─ 调用 initialize(api)
   ├─ 注册 Hook 处理器
   └─ 注册 UI 组件

3. 运行 (Active)
   ├─ 响应 Hook 调用
   ├─ 处理用户交互
   └─ 访问 Plugin API

4. 卸载 (Unload)
   ├─ 调用 cleanup()
   ├─ 取消注册 Hook
   ├─ 清理资源
   └─ 从注册表移除
```

---

## 创建 Provider 插件

### BaseProviderPlugin 基类

`BaseProviderPlugin` 提供了创建 Provider 插件的基础功能：

#### 必须实现的方法

```typescript
abstract class BaseProviderPlugin {
  // 必须设置的属性
  protected abstract providerId: string;
  protected abstract providerName: string;
  protected abstract apiType: string;
  protected abstract defaultBaseUrl: string;
  protected abstract websites: {...};

  // 必须实现的方法
  abstract onFetchModels(provider: ModelProvider): Promise<Model[]>;
}
```

#### 可选重写的方法

```typescript
class BaseProviderPlugin {
	// 初始化
	async initialize(api: PluginAPI): Promise<void>;

	// 清理
	async cleanup(): Promise<void>;

	// 认证
	async onAuthenticate(context: AuthContext): Promise<AuthResult>;

	// Hook 方法
	async onBeforeSendMessage(context: MessageContext): Promise<MessageContext>;
	async onAfterSendMessage(context: MessageContext, response: AIResponse): Promise<void>;
	async onStreamChunk(chunk: StreamChunk): Promise<StreamChunk>;
	async onError(context: ErrorContext): Promise<ErrorHandleResult>;

	// UI 组件注册
	onRegisterComponents(): ComponentRegistry | undefined;
}
```

#### 实用工具方法

```typescript
// HTTP 请求
protected async httpRequest<T>(url: string, options: {...}): Promise<T>

// 构建 API URL
protected buildApiUrl(provider: ModelProvider, endpoint: string): string

// 获取认证头
protected getAuthHeaders(provider: ModelProvider): Record<string, string>

// 解析模型能力
protected parseModelCapabilities(modelId: string): Set<string>

// 解析模型类型
protected parseModelType(modelId: string): ModelType

// 日志
protected log(level: "debug" | "info" | "warn" | "error", message: string, ...args: unknown[]): void

// 通知
protected notify(message: string, type?: "info" | "success" | "warning" | "error"): void
```

### 完整示例：自定义 Provider

```typescript
import { BaseProviderPlugin } from "$lib/plugin-system/base-provider-plugin";
import type { Model, ModelProvider, MessageContext, StreamChunk } from "@shared/types";

export class CustomProviderPlugin extends BaseProviderPlugin {
	protected providerId = "custom-provider";
	protected providerName = "Custom Provider";
	protected apiType = "custom";
	protected defaultBaseUrl = "https://api.custom.com/v1";

	protected websites = {
		official: "https://custom.com",
		apiKey: "https://custom.com/api-keys",
		docs: "https://docs.custom.com",
		models: "https://docs.custom.com/models",
	};

	// 1. 初始化插件
	async initialize(api: PluginAPI): Promise<void> {
		await super.initialize(api);

		// 加载自定义配置
		const customSetting = await this.api!.storage.getConfig("customSetting");
		this.log("info", "Custom setting loaded:", customSetting);
	}

	// 2. 自定义认证（如 OAuth）
	async onAuthenticate(context: AuthContext): Promise<AuthResult> {
		const { provider, method } = context;

		if (method === "oauth") {
			// 实现 OAuth 流程
			const authCode = await this.openOAuthDialog();
			const tokens = await this.exchangeAuthCode(authCode, provider);

			return {
				success: true,
				apiKey: tokens.accessToken,
				refreshToken: tokens.refreshToken,
				expiresAt: tokens.expiresAt,
			};
		}

		// 默认 API Key 认证
		return super.onAuthenticate(context);
	}

	// 3. 获取模型列表
	async onFetchModels(provider: ModelProvider): Promise<Model[]> {
		this.log("info", "Fetching models...");

		const url = this.buildApiUrl(provider, "models");
		const response = await this.httpRequest<{ models: Array<{ id: string; name: string }> }>(url, {
			method: "GET",
			provider,
		});

		return response.models.map((model) => ({
			id: model.id,
			name: model.name,
			remark: `Custom model: ${model.name}`,
			providerId: this.providerId,
			capabilities: this.parseModelCapabilities(model.id),
			type: this.parseModelType(model.id),
			custom: false,
			enabled: true,
			collected: false,
		}));
	}

	// 4. 消息发送前处理
	async onBeforeSendMessage(context: MessageContext): Promise<MessageContext> {
		// 添加自定义元数据
		context.metadata = {
			...context.metadata,
			customField: "value",
			timestamp: Date.now(),
		};

		this.log("debug", "Message context modified:", context);
		return context;
	}

	// 5. 流式响应处理
	async onStreamChunk(chunk: StreamChunk): Promise<StreamChunk> {
		// 过滤或修改流式响应
		if (chunk.type === "text" && chunk.text) {
			// 例如：替换特定文本
			chunk.text = chunk.text.replace(/\[REDACTED\]/g, "***");
		}

		return chunk;
	}

	// 6. 错误处理
	async onError(context: ErrorContext): Promise<ErrorHandleResult> {
		const { error, source } = context;

		// 自定义错误处理
		if (error.message.includes("CUSTOM_ERROR_CODE")) {
			return {
				handled: true,
				message: "Custom error occurred. Please check your settings.",
			};
		}

		// 使用默认错误处理
		return super.onError(context);
	}

	// 7. 自定义认证头
	protected getAuthHeaders(provider: ModelProvider): Record<string, string> {
		return {
			"X-API-Key": provider.apiKey,
			"X-Custom-Header": "value",
		};
	}

	// 辅助方法
	private async openOAuthDialog(): Promise<string> {
		// 实现 OAuth 对话框逻辑
		return "auth-code";
	}

	private async exchangeAuthCode(
		code: string,
		provider: ModelProvider,
	): Promise<{
		accessToken: string;
		refreshToken: string;
		expiresAt: Date;
	}> {
		// 交换授权码获取 token
		const response = await this.httpRequest<{
			access_token: string;
			refresh_token: string;
			expires_in: number;
		}>(this.buildApiUrl(provider, "oauth/token"), {
			method: "POST",
			provider,
			body: {
				grant_type: "authorization_code",
				code,
			},
		});

		return {
			accessToken: response.access_token,
			refreshToken: response.refresh_token,
			expiresAt: new Date(Date.now() + response.expires_in * 1000),
		};
	}
}

export default CustomProviderPlugin;
```

---

## Plugin API 参考

插件通过 `PluginAPI` 接口与应用交互。

### Storage API

```typescript
// 插件配置（用户可见）
await api.storage.getConfig<T>(key: string): Promise<T | null>
await api.storage.setConfig<T>(key: string, value: T): Promise<void>
await api.storage.removeConfig(key: string): Promise<void>
await api.storage.getAllConfig(): Promise<Record<string, unknown>>

// 插件私有数据（用户不可见）
await api.storage.getData<T>(key: string): Promise<T | null>
await api.storage.setData<T>(key: string, value: T): Promise<void>
await api.storage.removeData(key: string): Promise<void>
```

### HTTP API

```typescript
// GET 请求
const data = await api.http.get<T>(url, options);

// POST 请求
const data = await api.http.post<T>(url, body, options);

// PUT 请求
const data = await api.http.put<T>(url, body, options);

// DELETE 请求
const data = await api.http.delete<T>(url, options);

// 通用请求
const data = await api.http.request<T>({
	url: "https://api.example.com/endpoint",
	method: "POST",
	headers: { "Custom-Header": "value" },
	body: { key: "value" },
	timeout: 30000,
});
```

### Logger API

```typescript
api.logger.debug("Debug message", data);
api.logger.info("Info message", data);
api.logger.warn("Warning message", data);
api.logger.error("Error message", error);
```

### UI API

```typescript
// 显示通知
api.ui.showNotification("Operation successful", "success");

// 显示对话框
const result = await api.ui.showDialog({
	title: "Confirm",
	message: "Are you sure?",
	type: "question",
	buttons: ["Yes", "No"],
});

// 打开自定义窗口
await api.ui.openWindow({
	url: "https://example.com/settings",
	title: "Settings",
	width: 800,
	height: 600,
});

// 注册组件
api.ui.registerComponent("my-component", MyComponent);
```

### Hook API

```typescript
// 注册 Hook
api.hooks.register("custom:event", async (context) => {
	// 处理逻辑
	return context;
});

// 取消注册 Hook
api.hooks.unregister("custom:event", handler);

// 触发自定义 Hook（仅限非系统 Hook）
const result = await api.hooks.trigger("custom:event", context);
```

### I18n API

```typescript
// 翻译文本
const text = api.i18n.t("key", { param: "value" });

// 获取当前语言
const locale = api.i18n.getLocale();

// 添加翻译资源
api.i18n.addMessages("en", {
	greeting: "Hello, {name}!",
});
```

---

## Hook 系统

插件可以通过 Hook 系统拦截和修改应用行为。

### 可用的 Hook

#### Provider Hooks

```typescript
// 认证前
"provider:before-authenticate"

// 消息发送前
"provider:before-send-message"
async onBeforeSendMessage(context: MessageContext): Promise<MessageContext>

// 消息发送中（自定义 API 调用）
"provider:send-message"
async onSendMessage(context: MessageContext): AsyncIterable<StreamChunk>

// 消息发送后
"provider:after-send-message"
async onAfterSendMessage(context: MessageContext, response: AIResponse): Promise<void>

// 流式响应处理
"provider:stream-chunk"
async onStreamChunk(chunk: StreamChunk): Promise<StreamChunk>

// 错误处理
"provider:error"
async onError(context: ErrorContext): Promise<ErrorHandleResult>
```

### Hook 优先级

```typescript
// 注册带优先级的 Hook（数值越大优先级越高）
api.hooks.register("provider:before-send-message", handler, {
	priority: 100, // 默认为 0
});
```

### Hook 超时控制

```typescript
// Hook 执行超时（默认 30 秒）
api.hooks.register("provider:send-message", handler, {
	timeout: 60000, // 60 秒
});
```

---

## 权限系统

插件必须在 `plugin.json` 中声明所需权限。

### 可用权限

```typescript
type PluginPermission =
	| "network" // 网络访问
	| "filesystem" // 文件系统访问（限制在插件目录）
	| "storage" // 本地存储访问
	| "ui" // UI 组件注册
	| "hooks" // Hook 注册
	| "ipc" // IPC 通信
	| "clipboard" // 剪贴板访问
	| "notifications"; // 通知显示
```

### 示例

```json
{
	"permissions": ["network", "storage", "ui"]
}
```

---

## 最佳实践

### 1. 错误处理

```typescript
async onFetchModels(provider: ModelProvider): Promise<Model[]> {
  try {
    const models = await this.fetchModelsFromAPI(provider);
    return models;
  } catch (error) {
    this.log("error", "Failed to fetch models:", error);

    // 提供友好的错误消息
    if (error instanceof Error) {
      if (error.message.includes("401")) {
        throw new Error("Invalid API key. Please check your credentials.");
      }
      if (error.message.includes("429")) {
        throw new Error("Rate limit exceeded. Please try again later.");
      }
    }

    throw new Error(`Failed to fetch models: ${error}`);
  }
}
```

### 2. 配置验证

```typescript
async initialize(api: PluginAPI): Promise<void> {
  await super.initialize(api);

  // 验证必需配置
  const apiKey = await api.storage.getConfig<string>("apiKey");
  if (!apiKey) {
    this.log("warn", "API key not configured");
    this.notify("Please configure your API key in settings", "warning");
  }
}
```

### 3. 资源清理

```typescript
async cleanup(): Promise<void> {
  // 清理定时器
  if (this.refreshTimer) {
    clearInterval(this.refreshTimer);
  }

  // 关闭连接
  if (this.connection) {
    await this.connection.close();
  }

  // 调用父类清理
  await super.cleanup();
}
```

### 4. 性能优化

```typescript
// 缓存模型列表
private modelCache: Model[] | null = null;
private cacheExpiry: number = 0;

async onFetchModels(provider: ModelProvider): Promise<Model[]> {
  const now = Date.now();

  // 使用缓存（5 分钟有效期）
  if (this.modelCache && now < this.cacheExpiry) {
    this.log("debug", "Returning cached models");
    return this.modelCache;
  }

  // 获取新数据
  const models = await this.fetchModelsFromAPI(provider);

  // 更新缓存
  this.modelCache = models;
  this.cacheExpiry = now + 5 * 60 * 1000;

  return models;
}
```

### 5. 日志记录

```typescript
// 使用适当的日志级别
this.log("debug", "Detailed debugging information");
this.log("info", "Normal operation information");
this.log("warn", "Warning: potential issue");
this.log("error", "Error occurred:", error);

// 包含上下文信息
this.log("info", "Fetching models for provider:", provider.id);
```

---

## 发布插件

### 1. 准备发布

- ✅ 完整测试所有功能
- ✅ 编写清晰的 README
- ✅ 添加截图和示例
- ✅ 更新版本号（遵循语义化版本）
- ✅ 编写 CHANGELOG

### 2. 插件包结构

```
my-plugin-v1.0.0.zip
├── plugin.json
├── README.md
├── CHANGELOG.md
├── LICENSE
├── icon.png
├── main/
│   └── index.js
└── locales/
    ├── en.json
    └── zh.json
```

### 3. 提交到插件市场

```bash
# 打包插件
npm run build

# 创建发布包
zip -r my-plugin-v1.0.0.zip dist/ plugin.json README.md icon.png

# 提交到插件市场
# （具体流程待插件市场上线后提供）
```

---

## 示例插件

查看 `plugins/builtin/openai-plugin/` 获取完整的 OpenAI Provider 插件示例。

## 更多资源

- [Plugin API 类型定义](../../src/lib/plugin-system/types.ts)
- [BaseProviderPlugin 源码](../../src/lib/plugin-system/base-provider-plugin.ts)
- [插件管理器源码](../../electron/main/plugin-manager/)
- [GitHub Issues](https://github.com/302ai/302-AI-Studio-SV/issues)

---

## 支持

如需帮助，请访问：

- [GitHub Discussions](https://github.com/302ai/302-AI-Studio-SV/discussions)
- [Discord 社区](#)
- [官方文档](https://docs.302.ai)

祝你开发愉快！🚀
