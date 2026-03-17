export const OPENCLAW_DEFAULT_CONFIG = {
	update: {
		checkOnStart: false,
	},
	browser: {
		executablePath: "/usr/bin/chromium",
		headless: true,
		noSandbox: true,
		defaultProfile: "openclaw",
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
			imageModel: { primary: "ai302/gemini-3.1-flash-image-preview" },
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
			groupAllowFrom: [],
			groupPolicy: "open",
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
		allow: ["feishu"],
		entries: { feishu: { enabled: true } },
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
			extraDirs: ["/home/user/skills"],
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
