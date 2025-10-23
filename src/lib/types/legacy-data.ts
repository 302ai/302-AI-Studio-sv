export interface LegacyProvider {
	id: string;
	name: string;
	apiType: "302ai" | "openai" | "anthropic" | "gemini";
	apiKey: string;
	baseUrl: string;
	enabled: boolean;
	custom?: boolean;
	order?: number;
	status?: string;
	avatar?: string;
	websites?: {
		official: string;
		apiKey: string;
		docs: string;
		models: string;
		defaultBaseUrl: string;
	};
}

export interface LegacyModel {
	id: string;
	name: string;
	remark: string;
	providerId: string;
	capabilities: string[];
	type: string;
	custom: boolean;
	enabled: boolean;
	collected: boolean;
}

export interface LegacyThread {
	id: string;
	title: string;
	modelId: string;
	providerId: string;
	createdAt: string;
	updatedAt: string;
	collected: boolean;
	isPrivate: boolean;
}

export interface LegacyThreadMcpServer {
	id: string;
	threadId: string;
	mcpServerId: string;
	enabled: boolean;
	order: number;
	createdAt: string;
	updatedAt: string;
}

export interface LegacyMessage {
	id: string;
	threadId: string;
	parentMessageId: string | null;
	role: "user" | "assistant" | "system";
	content: string;
	isThinkBlockCollapsed: boolean;
	createdAt: string;
	orderSeq: number;
	tokenCount: number;
	status: string;
	modelId: string;
	modelName: string;
	providerId: string;
	hasSequentialContent: boolean;
	contentBlocks?: string;
}

export interface LegacyAttachment {
	id: string;
	messageId: string;
	name: string;
	type: string;
	size: number;
	filePath: string;
	createdAt: string;
}

export interface LegacyMcpServer {
	id: string;
	name: string;
	description: string;
	type: "stdio" | "sse" | "streamableHTTP";
	url: string | null;
	command: string | null;
	icon: string;
	enabled: boolean;
	order: number;
	createdAt: string;
	updatedAt: string;
	advancedSettings?: {
		timeout?: number;
		customHeaders?: Record<string, unknown>;
		customEnvVars?: Record<string, unknown>;
		autoUseTool?: boolean;
		keepLongTaskConnection?: boolean;
	};
}

export interface LegacySettings {
	id: string;
	enableWebSearch: boolean;
	enableReason: boolean;
	searchService: string;
	theme: string;
	language: "zh" | "en";
	selectedModelId: string;
	autoUpdate: boolean;
	displayAppStore: boolean;
	defaultPrivacyMode: boolean;
	isPrivate: boolean;
	feedUrl: string;
	streamSmootherEnabled: boolean;
	streamSpeed: string;
	collapseCodeBlock: boolean;
	hideReason: boolean;
	collapseThinkBlock: boolean;
	disableMarkdown: boolean;
	newChatModelId: string;
	titleModelId: string;
	titleGenerationTiming: string;
	enableUrlParse: boolean;
	widescreenMode: boolean;
	layoutMode: string;
}

export interface LegacyShortcut {
	id: string;
	action: string;
	keys: string[];
	scope: string;
	order: number;
	createdAt: string;
	updatedAt: string;
}

export interface LegacyTab {
	id: string;
	title: string;
	type: string;
	path: string;
	order: number;
	isPrivate: boolean;
	inputValue?: string;
	threadId?: string;
	files?: string;
}

export interface LegacyDataFormat {
	data: {
		providers: LegacyProvider[];
		models: LegacyModel[];
		tabs: LegacyTab[];
		threads: LegacyThread[];
		threadMcpServers: LegacyThreadMcpServer[];
		messages: LegacyMessage[];
		attachments: LegacyAttachment[];
		mcpServers: LegacyMcpServer[];
		settings: LegacySettings[];
		shortcuts: LegacyShortcut[];
	};
}

export interface ImportStats {
	providers: { added: number; skipped: number; failed: number };
	models: { added: number; skipped: number; failed: number };
	mcpServers: { added: number; skipped: number; failed: number };
	threads: { added: number; skipped: number; failed: number };
	messages: { added: number; skipped: number; failed: number };
	settings: { updated: number; skipped: number };
	shortcuts: { added: number; skipped: number; failed: number };
	tabs: { added: number; skipped: number; failed: number };
}
