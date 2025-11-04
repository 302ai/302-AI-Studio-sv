/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ImportResult } from "@shared/types";
import { dialog } from "electron";
import { readFile } from "fs/promises";
import { storageService } from "../storage-service";

/**
 * Format citations in legacy format to markdown list format
 * Converts lines like "[1] https://..." to "- [1] https://..."
 */
function formatCitations(text: string): string {
	const lines = text.split("\n");
	const formattedLines: string[] = [];
	let inCitationBlock = false;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		// Match citation pattern: [number] url
		const citationMatch = line.match(/^\[(\d+)\]\s+(https?:\/\/\S+)/);

		if (citationMatch) {
			// If this is the first citation, add a blank line before
			if (
				!inCitationBlock &&
				formattedLines.length > 0 &&
				formattedLines[formattedLines.length - 1] !== ""
			) {
				formattedLines.push("");
			}
			inCitationBlock = true;
			// Convert to markdown list format
			formattedLines.push(`- [${citationMatch[1]}] ${citationMatch[2]}`);
		} else {
			inCitationBlock = false;
			formattedLines.push(line);
		}
	}

	return formattedLines.join("\n");
}

/**
 * Parse content with <reason>, <think>, or <thinking> tags into parts array
 */
function parseContentToParts(content: string): any[] {
	const parts: any[] = [];

	// Match <reason>, <think>, or <thinking> tags
	const reasonRegex = /<reason>([\s\S]*?)<\/reason>/gi;
	const thinkRegex = /<think>([\s\S]*?)<\/think>/gi;
	const thinkingRegex = /<thinking>([\s\S]*?)<\/thinking>/gi;

	let lastIndex = 0;
	const matches: Array<{ start: number; end: number; text: string; type: "reasoning" }> = [];

	// Find all reasoning blocks
	let match;
	[reasonRegex, thinkRegex, thinkingRegex].forEach((regex) => {
		regex.lastIndex = 0;
		while ((match = regex.exec(content)) !== null) {
			matches.push({
				start: match.index,
				end: match.index + match[0].length,
				text: formatCitations(match[1].trim()),
				type: "reasoning",
			});
		}
	});

	// Sort matches by start position
	matches.sort((a, b) => a.start - b.start);

	// Build parts array
	matches.forEach((m) => {
		// Add text before this reasoning block
		if (lastIndex < m.start) {
			const textContent = content.substring(lastIndex, m.start).trim();
			if (textContent) {
				parts.push({ type: "text", text: formatCitations(textContent) });
			}
		}
		// Add reasoning block
		parts.push({ type: "reasoning", text: m.text });
		lastIndex = m.end;
	});

	// Add remaining text
	if (lastIndex < content.length) {
		const textContent = content.substring(lastIndex).trim();
		if (textContent) {
			parts.push({ type: "text", text: formatCitations(textContent) });
		}
	}

	// If no reasoning blocks found, return original content as text
	if (parts.length === 0) {
		return [{ type: "text", text: formatCitations(content) }];
	}

	return parts;
}

interface LegacyDataFormat {
	data: {
		providers: any[];
		models: any[];
		tabs: any[];
		threads: any[];
		threadMcpServers: any[];
		messages: any[];
		attachments: any[];
		mcpServers: any[];
		settings: any[];
		shortcuts: any[];
	};
}

interface ImportStats {
	providers: { added: number; skipped: number; failed: number };
	models: { added: number; skipped: number; failed: number };
	mcpServers: { added: number; skipped: number; failed: number };
	threads: { added: number; skipped: number; failed: number };
	messages: { added: number; skipped: number; failed: number };
	settings: { updated: number; skipped: number };
	shortcuts: { added: number; skipped: number; failed: number };
	tabs: { added: number; skipped: number; failed: number };
}

export async function importLegacyJson(): Promise<ImportResult> {
	try {
		const { canceled, filePaths } = await dialog.showOpenDialog({
			title: "Import Legacy JSON Data",
			filters: [{ name: "JSON File", extensions: ["json"] }],
			properties: ["openFile"],
		});

		if (canceled || filePaths.length === 0) {
			return {
				success: false,
				message: "Import cancelled by user",
			};
		}

		const jsonPath = filePaths[0];
		const fileContent = await readFile(jsonPath, "utf-8");
		let legacyData: LegacyDataFormat;

		try {
			legacyData = JSON.parse(fileContent);
		} catch (_error) {
			return {
				success: false,
				message: "Invalid JSON format",
			};
		}

		if (!validateLegacyData(legacyData)) {
			return {
				success: false,
				message: "Invalid legacy data format",
			};
		}

		const stats: ImportStats = {
			providers: { added: 0, skipped: 0, failed: 0 },
			models: { added: 0, skipped: 0, failed: 0 },
			mcpServers: { added: 0, skipped: 0, failed: 0 },
			threads: { added: 0, skipped: 0, failed: 0 },
			messages: { added: 0, skipped: 0, failed: 0 },
			settings: { updated: 0, skipped: 0 },
			shortcuts: { added: 0, skipped: 0, failed: 0 },
			tabs: { added: 0, skipped: 0, failed: 0 },
		};

		const providerIdMap = await importProviders(legacyData.data.providers, stats);
		await importModels(legacyData.data.models, providerIdMap, stats);
		await importMcpServers(legacyData.data.mcpServers, stats);
		await importThreads(
			legacyData.data.threads,
			legacyData.data.threadMcpServers,
			legacyData.data.messages,
			legacyData.data.attachments,
			legacyData.data.models,
			stats,
		);
		await importSettings(legacyData.data.settings, legacyData.data.models, stats);
		await importShortcuts(legacyData.data.shortcuts, stats);

		const totalAdded =
			stats.providers.added +
			stats.models.added +
			stats.mcpServers.added +
			stats.threads.added +
			stats.messages.added;

		return {
			success: true,
			message: `Successfully imported ${totalAdded} items`,
			importedFiles: totalAdded,
		};
	} catch (error) {
		console.error("Failed to import legacy JSON:", error);
		return {
			success: false,
			message: error instanceof Error ? error.message : "Unknown error occurred",
		};
	}
}

function validateLegacyData(data: unknown): data is LegacyDataFormat {
	if (!data || typeof data !== "object") return false;
	const legacyData = data as Partial<LegacyDataFormat>;
	if (!legacyData.data || typeof legacyData.data !== "object") return false;

	const requiredArrays = ["providers", "models", "threads"];
	for (const key of requiredArrays) {
		if (!Array.isArray(legacyData.data[key as keyof typeof legacyData.data])) {
			return false;
		}
	}
	return true;
}

async function importProviders(
	legacyProviders: any[],
	stats: ImportStats,
): Promise<Map<string, string>> {
	// Return a map of old provider ID -> new provider ID
	const providerIdMap = new Map<string, string>();

	try {
		const existingProviders =
			((await storageService.getItemInternal("app-providers")) as any[]) || [];
		const existingByName = new Map(existingProviders.map((p) => [p.name, p]));

		const updatedProviders = [...existingProviders];
		const newProviders = [];

		// Map legacy provider names to standard built-in provider IDs
		const STANDARD_PROVIDER_IDS: Record<string, string> = {
			"302.AI": "302AI",
			OpenAI: "openai",
			Anthropic: "anthropic",
			"Google AI": "google",
		};

		for (const legacy of legacyProviders) {
			// Determine the correct provider ID
			let newProviderId = legacy.id;

			// If it's a built-in provider (not custom), use standard ID
			if (!legacy.custom && STANDARD_PROVIDER_IDS[legacy.name]) {
				newProviderId = STANDARD_PROVIDER_IDS[legacy.name];
			}

			// Store the mapping from old ID to new ID
			providerIdMap.set(legacy.id, newProviderId);

			const newProvider = {
				id: newProviderId,
				name: legacy.name,
				apiType: legacy.apiType,
				apiKey: legacy.apiKey,
				baseUrl: legacy.baseUrl,
				enabled: legacy.enabled,
				custom: legacy.custom ?? false,
				status: legacy.status || "pending",
				websites: legacy.websites || {
					official: "",
					apiKey: "",
					docs: "",
					models: "",
					defaultBaseUrl: "",
				},
				icon: legacy.avatar,
			};

			// Check if a provider with the same name exists
			if (existingByName.has(legacy.name)) {
				// Replace the existing provider with the new one
				const existingIndex = updatedProviders.findIndex((p) => p.name === legacy.name);
				if (existingIndex !== -1) {
					updatedProviders[existingIndex] = newProvider;
					stats.providers.added++;
				}
			} else {
				// Add as new provider
				newProviders.push(newProvider);
				stats.providers.added++;
			}
		}

		if (newProviders.length > 0 || updatedProviders.length !== existingProviders.length) {
			await storageService.setItemInternal("app-providers", [...updatedProviders, ...newProviders]);
		}
	} catch (error) {
		console.error("Failed to import providers:", error);
		stats.providers.failed++;
	}

	return providerIdMap;
}

async function importModels(
	legacyModels: any[],
	providerIdMap: Map<string, string>,
	stats: ImportStats,
): Promise<void> {
	try {
		const existingModels = ((await storageService.getItemInternal("app-models")) as any[]) || [];
		const existingByNameAndProvider = new Map(
			existingModels.map((m) => [`${m.name}:${m.providerId}`, m]),
		);

		const updatedModels = [...existingModels];
		const newModels = [];

		for (const legacy of legacyModels) {
			// Map old providerId to new providerId
			const newProviderId = providerIdMap.get(legacy.providerId) || legacy.providerId;

			// Use model name as ID (new system uses name as ID)
			const newModel = {
				id: legacy.name,
				name: legacy.name,
				remark: legacy.remark || legacy.name,
				providerId: newProviderId,
				capabilities: new Set(legacy.capabilities || []),
				type: legacy.type || "language",
				custom: legacy.custom ?? false,
				enabled: legacy.enabled ?? true,
				collected: legacy.collected ?? false,
			};

			const key = `${legacy.name}:${newProviderId}`;
			// Check if a model with the same name and provider exists
			if (existingByNameAndProvider.has(key)) {
				// Replace the existing model with the new one
				const existingIndex = updatedModels.findIndex(
					(m) => m.name === legacy.name && m.providerId === newProviderId,
				);
				if (existingIndex !== -1) {
					updatedModels[existingIndex] = newModel;
					stats.models.added++;
				}
			} else {
				// Add as new model
				newModels.push(newModel);
				stats.models.added++;
			}
		}

		if (newModels.length > 0 || updatedModels.length !== existingModels.length) {
			await storageService.setItemInternal("app-models", [...updatedModels, ...newModels]);
		}
	} catch (error) {
		console.error("Failed to import models:", error);
		stats.models.failed++;
	}
}

async function importMcpServers(legacyServers: any[], stats: ImportStats): Promise<void> {
	try {
		const existingServers =
			((await storageService.getItemInternal("app-mcp-servers")) as any[]) || [];
		const existingByName = new Map(existingServers.map((s) => [s.name, s]));

		const updatedServers = [...existingServers];
		const newServers = [];

		for (const legacy of legacyServers) {
			const newServer = {
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

			// Check if a server with the same name exists
			if (existingByName.has(legacy.name)) {
				// Replace the existing server with the new one
				const existingIndex = updatedServers.findIndex((s) => s.name === legacy.name);
				if (existingIndex !== -1) {
					updatedServers[existingIndex] = newServer;
					stats.mcpServers.added++;
				}
			} else {
				// Add as new server
				newServers.push(newServer);
				stats.mcpServers.added++;
			}
		}

		if (newServers.length > 0 || updatedServers.length !== existingServers.length) {
			await storageService.setItemInternal("app-mcp-servers", [...updatedServers, ...newServers]);
		}
	} catch (error) {
		console.error("Failed to import MCP servers:", error);
		stats.mcpServers.failed++;
	}
}

async function importThreads(
	legacyThreads: any[],
	threadMcpServers: any[],
	legacyMessages: any[],
	legacyAttachments: any[],
	legacyModels: any[],
	stats: ImportStats,
): Promise<void> {
	try {
		const existingMetadata = ((await storageService.getItemInternal(
			"ThreadStorage:thread-metadata",
		)) as any) || {
			threadIds: [],
			favorites: [],
		};
		const existingThreadIds = new Set(existingMetadata.threadIds);

		// Load the imported models from storage
		const importedModels = ((await storageService.getItemInternal("app-models")) as any[]) || [];

		// Create a map from legacy model ID to model name
		const legacyModelIdToName = new Map<string, string>();
		for (const legacyModel of legacyModels) {
			legacyModelIdToName.set(legacyModel.id, legacyModel.name);
		}

		const newThreadIds = [];
		const newFavorites = [];

		// Create a map of messageId -> attachments for quick lookup
		const attachmentsByMessageId = new Map<string, any[]>();
		for (const attachment of legacyAttachments) {
			if (!attachmentsByMessageId.has(attachment.messageId)) {
				attachmentsByMessageId.set(attachment.messageId, []);
			}
			attachmentsByMessageId.get(attachment.messageId)!.push(attachment);
		}

		for (const legacy of legacyThreads) {
			if (existingThreadIds.has(legacy.id)) {
				stats.threads.skipped++;
				continue;
			}

			const mcpServerIds = threadMcpServers
				.filter((tms) => tms.threadId === legacy.id && tms.enabled)
				.sort((a, b) => a.order - b.order)
				.map((tms) => tms.mcpServerId);

			// Find the selected model by converting legacy modelId to model name
			let selectedModel = null;
			if (legacy.modelId && legacyModelIdToName.has(legacy.modelId)) {
				const modelName = legacyModelIdToName.get(legacy.modelId);
				// Find the model in imported models by name (new system uses name as ID)
				selectedModel = importedModels.find((m) => m.name === modelName) || null;
			}

			const threadData = {
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

			await storageService.setItemInternal(`app-thread:${legacy.id}`, threadData);

			const threadMessages = legacyMessages.filter((m) => m.threadId === legacy.id);
			if (threadMessages.length > 0) {
				threadMessages.sort((a, b) => a.orderSeq - b.orderSeq);

				const convertedMessages = threadMessages.map((msg) => {
					const metadata = msg.metadata || {};
					if (msg.createdAt && !metadata.createdAt) {
						metadata.createdAt = new Date(msg.createdAt);
					} else if (metadata.createdAt && typeof metadata.createdAt === "string") {
						metadata.createdAt = new Date(metadata.createdAt);
					}

					// Import model name
					if (msg.modelName && !metadata.model) {
						metadata.model = msg.modelName;
					}

					// Import attachments for this message
					const messageAttachments = attachmentsByMessageId.get(msg.id) || [];
					if (messageAttachments.length > 0) {
						metadata.attachments = messageAttachments.map((att) => ({
							id: att.id,
							name: att.name,
							type: att.type,
							size: att.size,
							filePath: att.filePath,
							preview: att.preview || undefined,
							textContent: att.fileContent || att.textContent || undefined,
						}));
					}

					// Parse content to extract reasoning blocks
					const parts = msg.parts || parseContentToParts(msg.content || "");

					return {
						...msg,
						parts: parts,
						metadata: metadata,
						createdAt: msg.createdAt ? new Date(msg.createdAt) : new Date(),
					};
				});

				await storageService.setItemInternal(`app-chat-messages:${legacy.id}`, convertedMessages);
				stats.messages.added += threadMessages.length;
			}

			newThreadIds.push(legacy.id);
			if (legacy.collected) {
				newFavorites.push(legacy.id);
			}
			stats.threads.added++;
		}

		if (newThreadIds.length > 0) {
			await storageService.setItemInternal("ThreadStorage:thread-metadata", {
				threadIds: [...existingMetadata.threadIds, ...newThreadIds],
				favorites: [...existingMetadata.favorites, ...newFavorites],
			});
		}
	} catch (error) {
		console.error("Failed to import threads:", error);
		stats.threads.failed++;
	}
}

async function importSettings(
	legacySettings: any[],
	legacyModels: any[],
	stats: ImportStats,
): Promise<void> {
	if (!legacySettings || legacySettings.length === 0) return;

	try {
		const legacy = legacySettings[0];

		// Import General Settings
		const existingGeneralSettings =
			((await storageService.getItemInternal("GeneralSettingsStorage:state")) as any) || {};

		const layoutMode = legacy.widescreenMode
			? "wide"
			: legacy.layoutMode === "ultra-wide"
				? "ultra-wide"
				: "default";

		await storageService.setItemInternal("GeneralSettingsStorage:state", {
			...existingGeneralSettings,
			language: legacy.language || existingGeneralSettings.language || "zh",
			autoUpdate: legacy.autoUpdate ?? existingGeneralSettings.autoUpdate ?? false,
			layoutMode: layoutMode,
			privacyAutoInherit:
				legacy.defaultPrivacyMode ?? existingGeneralSettings.privacyAutoInherit ?? false,
		});

		// Import Preferences Settings
		const existingPreferencesSettings =
			((await storageService.getItemInternal("PreferencesSettingsStorage:state")) as any) || {};

		// Load the imported models from storage to match model IDs
		const importedModels = ((await storageService.getItemInternal("app-models")) as any[]) || [];

		// Create a map from legacy model ID to model name
		const legacyModelIdToName = new Map<string, string>();
		for (const legacyModel of legacyModels) {
			legacyModelIdToName.set(legacyModel.id, legacyModel.name);
		}

		// Find new session model
		let newSessionModel = null;
		if (legacy.newChatModelId && legacy.newChatModelId !== "use-last-model") {
			const modelName = legacyModelIdToName.get(legacy.newChatModelId);
			if (modelName) {
				newSessionModel = importedModels.find((m) => m.name === modelName) || null;
			}
		}

		// Find title generation model
		let titleGenerationModel = null;
		if (legacy.titleModelId && legacy.titleModelId !== "use-current-chat-model") {
			const modelName = legacyModelIdToName.get(legacy.titleModelId);
			if (modelName) {
				titleGenerationModel = importedModels.find((m) => m.name === modelName) || null;
			}
		}

		// Map title generation timing
		let titleGenerationTiming: "firstTime" | "everyTime" | "off" = "firstTime";
		if (legacy.titleGenerationTiming === "first-round") {
			titleGenerationTiming = "firstTime";
		} else if (legacy.titleGenerationTiming === "every-round") {
			titleGenerationTiming = "everyTime";
		} else if (legacy.titleGenerationTiming === "off") {
			titleGenerationTiming = "off";
		}

		await storageService.setItemInternal("PreferencesSettingsStorage:state", {
			...existingPreferencesSettings,
			autoHideCode: legacy.collapseCodeBlock ?? existingPreferencesSettings.autoHideCode ?? false,
			autoHideReason: legacy.hideReason ?? existingPreferencesSettings.autoHideReason ?? false,
			autoCollapseThink:
				legacy.collapseThinkBlock ?? existingPreferencesSettings.autoCollapseThink ?? false,
			autoDisableMarkdown:
				legacy.disableMarkdown ?? existingPreferencesSettings.autoDisableMarkdown ?? false,
			enableSupermarket:
				legacy.displayAppStore ?? existingPreferencesSettings.enableSupermarket ?? true,
			newSessionModel: newSessionModel,
			autoParseUrl: legacy.enableUrlParse ?? existingPreferencesSettings.autoParseUrl ?? false,
			searchProvider:
				legacy.searchService || existingPreferencesSettings.searchProvider || "search1api",
			streamOutputEnabled:
				legacy.streamSmootherEnabled ?? existingPreferencesSettings.streamOutputEnabled ?? false,
			streamSpeed: legacy.streamSpeed || existingPreferencesSettings.streamSpeed || "normal",
			titleGenerationModel: titleGenerationModel,
			titleGenerationTiming: titleGenerationTiming,
		});

		stats.settings.updated++;
	} catch (error) {
		console.error("Failed to import settings:", error);
	}
}

/**
 * Convert kebab-case action name to camelCase
 * e.g., "clear-messages" -> "clearMessages"
 *       "switch-to-tab-1" -> "switchToTab1"
 */
function convertActionName(kebabAction: string): string {
	return kebabAction.replace(/-([a-z0-9])/g, (_, letter) => letter.toUpperCase());
}

async function importShortcuts(legacyShortcuts: any[], stats: ImportStats): Promise<void> {
	if (!legacyShortcuts || legacyShortcuts.length === 0) return;

	try {
		const existingState =
			((await storageService.getItemInternal("ShortcutSettingsStorage:state")) as any) || {};
		const existingShortcuts = existingState.shortcuts || [];

		// Valid actions in the new system (camelCase)
		const validActions = new Set([
			"newChat",
			"clearMessages",
			"closeCurrentTab",
			"closeOtherTabs",
			"deleteCurrentThread",
			"openSettings",
			"toggleSidebar",
			"stopGeneration",
			"newTab",
			"regenerateResponse",
			"search",
			"createBranch",
			"restoreLastTab",
			"screenshot",
			"nextTab",
			"previousTab",
			"toggleModelPanel",
			"toggleIncognitoMode",
			"branchAndSend",
			"switchToTab1",
			"switchToTab2",
			"switchToTab3",
			"switchToTab4",
			"switchToTab5",
			"switchToTab6",
			"switchToTab7",
			"switchToTab8",
			"switchToTab9",
		]);

		// Create a map of action -> existing shortcut for merging
		const actionToShortcut = new Map<string, any>();
		for (const shortcut of existingShortcuts) {
			actionToShortcut.set(shortcut.action, shortcut);
		}

		// Update shortcuts with legacy data
		for (const legacy of legacyShortcuts) {
			// Convert kebab-case to camelCase
			const camelAction = convertActionName(legacy.action);

			// Only import valid actions
			if (!validActions.has(camelAction)) {
				stats.shortcuts.skipped++;
				continue;
			}

			if (actionToShortcut.has(camelAction)) {
				// Update the existing shortcut with legacy keys
				const existing = actionToShortcut.get(camelAction);
				existing.keys = legacy.keys;
				stats.shortcuts.added++;
			} else {
				// Add new shortcut (shouldn't happen as we start with defaults)
				actionToShortcut.set(camelAction, {
					id: legacy.id,
					action: camelAction,
					keys: legacy.keys,
					scope: legacy.scope,
					order: legacy.order,
				});
				stats.shortcuts.added++;
			}
		}

		// Convert map back to array
		const updatedShortcuts = Array.from(actionToShortcut.values()).sort(
			(a, b) => a.order - b.order,
		);

		await storageService.setItemInternal("ShortcutSettingsStorage:state", {
			shortcuts: updatedShortcuts,
		});
	} catch (error) {
		console.error("Failed to import shortcuts:", error);
		stats.shortcuts.failed++;
	}
}
