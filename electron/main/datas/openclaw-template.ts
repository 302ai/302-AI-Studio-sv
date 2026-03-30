/**
 * OpenClaw Default Configuration Template
 *
 * This object serves as the foundational template for generating `openclaw.json`
 * within the local sandbox environment. The `LocalVibeService` manages the
 * lifecycle of this configuration file through the following steps:
 *
 * 1. Initialization:
 *    When `prepareRuntimeCompose` is called, this template is cloned. The `_version`
 *    field is used for migration tracking and then removed from the final file.
 *
 * 2. API Key Injection:
 *    The system automatically injects the active 302.AI API key into:
 *    - All providers under `models.providers`
 *    - The `302ai-search` skill under `skills.entries`
 *
 * 3. Model Synchronization (`_mergeModelsConfig`):
 *    The `agents.defaults.models` section is dynamically rebuilt by fetching
 *    `app-models` from storage. It classifies models into:
 *    - Normal: Featured and OpenAI-compatible models.
 *    - Coding: `cc-*` or `*-for-coding` models that are featured and compatible.
 *    Non-ai302 models already in the config are preserved.
 *
 * 4. Merging & Overrides (`_mergeTemplateConfig`):
 *    If an `openclaw.json` already exists:
 *    - User-defined values are generally preserved.
 *    - API keys are ALWAYS force-overridden from the template to ensure they
 *      stay in sync with the app's provider settings.
 *    - Version-based migrations trigger forced overrides for specific paths
 *      to ensure new features or required structural changes are applied.
 *
 * 5. Version History:
 *    - v1: Initial stable template.
 *    - v2: Added support for DingTalk, QQBot, and WeCom channels;
 *          Updated default plugins and skill loading paths.
 */
export const OPENCLAW_DEFAULT_CONFIG = {
	/**
	 * Internal version used by LocalVibeService for migration logic.
	 * Incremented when structural changes to the template require force-overriding
	 * existing user configurations.
	 */
	_version: 2,
	update: {
		checkOnStart: false,
	},
	browser: {
		executablePath: "/usr/bin/chromium",
		headless: true,
		noSandbox: true,
		defaultProfile: "openclaw",
	},
	acp: {
		enabled: true,
		dispatch: {
			enabled: true,
		},
		backend: "acpx",
		defaultAgent: "claude",
	},
	models: {
		mode: "merge",
		providers: {
			ai302: {
				baseUrl: "https://api.302.ai/v1",
				apiKey: "",
				api: "openai-completions",
				models: [
					{
						id: "glm-5",
						name: "glm-5",
						reasoning: false,
						input: ["text", "image"],
						cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
						contextWindow: 202752,
						maxTokens: 16384,
					},
				],
			},
			"ai302-coding": {
				baseUrl: "https://api.302.ai/v1",
				apiKey: "",
				api: "anthropic-messages",
				models: [
					{
						id: "kimi-for-coding",
						name: "kimi-for-coding",
						reasoning: false,
						input: ["text", "image"],
						cost: {
							input: 0,
							output: 0,
							cacheRead: 0,
							cacheWrite: 0,
						},
						contextWindow: 262144,
						maxTokens: 32768,
					},
				],
			},
		},
	},
	agents: {
		defaults: {
			model: { primary: "ai302/glm-5" },
			models: {},
			imageModel: { primary: "ai302/kimi-k2.5" },
			workspace: "/home/user/.openclaw/workspace",
			compaction: { mode: "safeguard" },
			elevatedDefault: "full",
			maxConcurrent: 4,
			subagents: { maxConcurrent: 8 },
		},
	},
	messages: {
		ackReactionScope: "group-mentions",
	},
	commands: {
		native: "auto",
		nativeSkills: "auto",
		restart: true,
		ownerDisplay: "raw",
	},
	channels: {
		feishu: {
			enabled: true,
			appId: "",
			appSecret: "",
			domain: "feishu",
			dmPolicy: "open",
			allowFrom: ["*"],
			groupPolicy: "open",
		},
		telegram: {
			enabled: true,
			dmPolicy: "open",
			botToken: "",
			allowFrom: ["*"],
			groupPolicy: "open",
		},
		dingtalk: {
			clientId: "",
			clientSecret: "",
			enableAICard: true,
			enabled: true,
		},
		qqbot: {
			enabled: true,
			appId: "",
			clientSecret: "",
		},
		wecom: {
			enabled: true,
			botId: "",
			secret: "",
		},
	},
	gateway: {
		port: 18789,
		mode: "local",
		bind: "loopback",
		controlUi: {
			dangerouslyAllowHostHeaderOriginFallback: true,
			allowInsecureAuth: true,
			dangerouslyDisableDeviceAuth: true,
		},
		auth: { mode: "token", token: "" },
		tailscale: { mode: "off", resetOnExit: false },
		http: {
			endpoints: { chatCompletions: { enabled: true } },
		},
	},
	plugins: {
		enabled: true,
		allow: ["feishu", "channels", "telegram", "acpx"],
		entries: {
			feishu: {
				enabled: true,
			},
			channels: {
				enabled: true,
			},
			acpx: {
				enabled: true,
				config: {
					permissionMode: "approve-all",
				},
			},
		},
		installs: {
			feishu: {
				source: "npm",
				spec: "@openclaw/feishu",
				installPath: "/home/user/.openclaw/extensions/feishu",
			},
			channels: {
				source: "npm",
				spec: "@openclaw-china/channels",
				installPath: "/home/user/.openclaw/extensions/channels",
			},
		},
	},
	skills: {
		load: {
			extraDirs: ["/home/user/.claude/skills"],
			watch: true,
			watchDebounceMs: 250,
		},
		entries: {
			"302ai-search": {
				enabled: true,
				apiKey: "",
			},
		},
	},
};
