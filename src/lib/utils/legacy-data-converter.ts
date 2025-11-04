import type { ShortcutBinding } from "$lib/stores/shortcut-settings.state.svelte";
import type {
	ImportStats,
	LegacyDataFormat,
	LegacyMcpServer,
	LegacyMessage,
	LegacyModel,
	LegacyProvider,
	LegacySettings,
	LegacyShortcut,
	LegacyTab,
	LegacyThread,
	LegacyThreadMcpServer,
} from "$lib/types/legacy-data";
import type { GeneralSettingsState } from "@shared/storage/general-settings";
import type { McpServer } from "@shared/storage/mcp";
import type { ModelProvider } from "@shared/storage/provider";
import type { Model, ThreadParmas } from "@shared/types";

export function convertProviders(legacyProviders: LegacyProvider[]): ModelProvider[] {
	return legacyProviders.map((legacy) => {
		const provider: ModelProvider = {
			id: legacy.id,
			name: legacy.name,
			apiType: legacy.apiType,
			apiKey: legacy.apiKey,
			baseUrl: legacy.baseUrl,
			enabled: legacy.enabled,
			custom: legacy.custom ?? false,
			status: (legacy.status as ModelProvider["status"]) || "pending",
			websites: legacy.websites || {
				official: "",
				apiKey: "",
				docs: "",
				models: "",
				defaultBaseUrl: "",
			},
			icon: legacy.avatar,
		};
		return provider;
	});
}

export function convertModels(legacyModels: LegacyModel[]): Model[] {
	return legacyModels.map((legacy) => {
		const model: Model = {
			id: legacy.id,
			name: legacy.name,
			remark: legacy.remark,
			providerId: legacy.providerId,
			capabilities: new Set(legacy.capabilities || []),
			type: (legacy.type as Model["type"]) || "language",
			custom: legacy.custom,
			enabled: legacy.enabled,
			collected: legacy.collected,
		};
		return model;
	});
}

export function convertMcpServers(legacyServers: LegacyMcpServer[]): McpServer[] {
	return legacyServers.map((legacy) => {
		const server: McpServer = {
			id: legacy.id,
			name: legacy.name,
			description: legacy.description,
			type: legacy.type,
			url: legacy.url,
			command: legacy.command,
			icon: legacy.icon,
			enabled: legacy.enabled,
			order: legacy.order,
			createdAt: new Date(legacy.createdAt),
			updatedAt: new Date(legacy.updatedAt),
			advancedSettings: legacy.advancedSettings || {
				timeout: 0,
				customHeaders: {},
				customEnvVars: {},
				autoUseTool: true,
				keepLongTaskConnection: false,
			},
		};
		return server;
	});
}

export function convertThreads(
	legacyThreads: LegacyThread[],
	threadMcpServers: LegacyThreadMcpServer[],
	models: Model[],
	legacyModels: LegacyModel[],
): {
	threads: Array<{ id: string; data: ThreadParmas }>;
	metadata: { threadIds: string[]; favorites: string[] };
} {
	const threads: Array<{ id: string; data: ThreadParmas }> = [];
	const threadIds: string[] = [];
	const favorites: string[] = [];

	// Create a map from legacy model ID to model name
	const legacyModelIdToName = new Map<string, string>();
	for (const legacyModel of legacyModels) {
		legacyModelIdToName.set(legacyModel.id, legacyModel.name);
	}

	for (const legacy of legacyThreads) {
		const mcpServerIds = threadMcpServers
			.filter((tms) => tms.threadId === legacy.id && tms.enabled)
			.sort((a, b) => a.order - b.order)
			.map((tms) => tms.mcpServerId);

		// Find the selected model by converting legacy modelId to model name
		let selectedModel: Model | null = null;
		if (legacy.modelId && legacyModelIdToName.has(legacy.modelId)) {
			const modelName = legacyModelIdToName.get(legacy.modelId);
			// Find the model by name (new system uses name as ID)
			selectedModel = models.find((m) => m.name === modelName) || null;
		}

		const threadData: ThreadParmas = {
			id: legacy.id,
			title: legacy.title,
			temperature: null,
			topP: null,
			frequencyPenalty: null,
			presencePenalty: null,
			maxTokens: null,
			inputValue: "",
			attachments: [],
			mcpServers: [],
			mcpServerIds: mcpServerIds,
			isThinkingActive: false,
			isOnlineSearchActive: false,
			isMCPActive: mcpServerIds.length > 0,
			selectedModel: selectedModel,
			isPrivateChatActive: legacy.isPrivate,
			updatedAt: new Date(legacy.updatedAt),
		};

		threads.push({ id: legacy.id, data: threadData });
		threadIds.push(legacy.id);

		if (legacy.collected) {
			favorites.push(legacy.id);
		}
	}

	return {
		threads,
		metadata: { threadIds, favorites },
	};
}

export function groupMessagesByThread(
	legacyMessages: LegacyMessage[],
): Map<string, LegacyMessage[]> {
	const messagesByThread = new Map<string, LegacyMessage[]>();

	for (const message of legacyMessages) {
		const threadMessages = messagesByThread.get(message.threadId) || [];
		threadMessages.push(message);
		messagesByThread.set(message.threadId, threadMessages);
	}

	messagesByThread.forEach((messages) => {
		messages.sort((a, b) => a.orderSeq - b.orderSeq);
	});

	return messagesByThread;
}

export function convertSettings(legacySettings: LegacySettings): Partial<GeneralSettingsState> {
	const layoutMode = legacySettings.widescreenMode
		? "wide"
		: legacySettings.layoutMode === "ultra-wide"
			? "ultra-wide"
			: "default";

	return {
		language: legacySettings.language,
		autoUpdate: legacySettings.autoUpdate,
		layoutMode: layoutMode as GeneralSettingsState["layoutMode"],
		privacyAutoInherit: legacySettings.defaultPrivacyMode,
	};
}

export function convertShortcuts(legacyShortcuts: LegacyShortcut[]): ShortcutBinding[] {
	return legacyShortcuts.map((legacy) => ({
		id: legacy.id,
		action: legacy.action as ShortcutBinding["action"],
		keys: legacy.keys,
		scope: legacy.scope as ShortcutBinding["scope"],
		order: legacy.order,
	}));
}

export function convertTabs(legacyTabs: LegacyTab[]): Array<{
	id: string;
	title: string;
	href: string;
	incognitoMode: boolean;
	type: "chat" | "settings" | "aiApplications";
	active: boolean;
	threadId: string;
}> {
	return legacyTabs
		.sort((a, b) => a.order - b.order)
		.map((legacy, index) => {
			let type: "chat" | "settings" | "aiApplications" = "chat";
			if (legacy.type === "setting") {
				type = "settings";
			} else if (legacy.type === "thread") {
				type = "chat";
			}

			return {
				id: legacy.id,
				title: legacy.title,
				href: legacy.path || "/",
				incognitoMode: legacy.isPrivate,
				type,
				active: index === 0,
				threadId: legacy.threadId || "",
			};
		});
}

export function validateLegacyData(data: unknown): data is LegacyDataFormat {
	if (!data || typeof data !== "object") {
		return false;
	}

	const legacyData = data as Partial<LegacyDataFormat>;

	if (!legacyData.data || typeof legacyData.data !== "object") {
		return false;
	}

	const requiredArrays = ["providers", "models", "threads"];
	for (const key of requiredArrays) {
		if (!Array.isArray(legacyData.data[key as keyof typeof legacyData.data])) {
			return false;
		}
	}

	return true;
}

export function createEmptyStats(): ImportStats {
	return {
		providers: { added: 0, skipped: 0, failed: 0 },
		models: { added: 0, skipped: 0, failed: 0 },
		mcpServers: { added: 0, skipped: 0, failed: 0 },
		threads: { added: 0, skipped: 0, failed: 0 },
		messages: { added: 0, skipped: 0, failed: 0 },
		settings: { updated: 0, skipped: 0 },
		shortcuts: { added: 0, skipped: 0, failed: 0 },
		tabs: { added: 0, skipped: 0, failed: 0 },
	};
}
