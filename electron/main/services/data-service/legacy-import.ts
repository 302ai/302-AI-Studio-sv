/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ImportResult } from "@shared/types";
import { dialog } from "electron";
import { readFile } from "fs/promises";
import { storageService } from "../storage-service";

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

		await importProviders(legacyData.data.providers, stats);
		await importModels(legacyData.data.models, stats);
		await importMcpServers(legacyData.data.mcpServers, stats);
		await importThreads(
			legacyData.data.threads,
			legacyData.data.threadMcpServers,
			legacyData.data.messages,
			stats,
		);
		await importSettings(legacyData.data.settings, stats);
		// await importShortcuts(legacyData.data.shortcuts, stats);

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

async function importProviders(legacyProviders: any[], stats: ImportStats): Promise<void> {
	try {
		const existingProviders =
			((await storageService.getItemInternal("app-providers")) as any[]) || [];
		const existingByName = new Map(existingProviders.map((p) => [p.name, p]));

		const updatedProviders = [...existingProviders];
		const newProviders = [];

		for (const legacy of legacyProviders) {
			const newProvider = {
				id: legacy.id,
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
}

async function importModels(legacyModels: any[], stats: ImportStats): Promise<void> {
	try {
		const existingModels = ((await storageService.getItemInternal("app-models")) as any[]) || [];
		const existingByNameAndProvider = new Map(
			existingModels.map((m) => [`${m.name}:${m.providerId}`, m]),
		);

		const updatedModels = [...existingModels];
		const newModels = [];

		for (const legacy of legacyModels) {
			const newModel = {
				id: legacy.id,
				name: legacy.name,
				remark: legacy.remark,
				providerId: legacy.providerId,
				capabilities: legacy.capabilities || [],
				type: legacy.type || "language",
				custom: legacy.custom,
				enabled: legacy.enabled,
				collected: legacy.collected,
			};

			const key = `${legacy.name}:${legacy.providerId}`;
			// Check if a model with the same name and provider exists
			if (existingByNameAndProvider.has(key)) {
				// Replace the existing model with the new one
				const existingIndex = updatedModels.findIndex(
					(m) => m.name === legacy.name && m.providerId === legacy.providerId,
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

		const newThreadIds = [];
		const newFavorites = [];

		for (const legacy of legacyThreads) {
			if (existingThreadIds.has(legacy.id)) {
				stats.threads.skipped++;
				continue;
			}

			const mcpServerIds = threadMcpServers
				.filter((tms) => tms.threadId === legacy.id && tms.enabled)
				.sort((a, b) => a.order - b.order)
				.map((tms) => tms.mcpServerId);

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
				selectedModel: null,
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

					return {
						...msg,
						parts: msg.parts || [{ type: "text", text: msg.content || "" }],
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

async function importSettings(legacySettings: any[], stats: ImportStats): Promise<void> {
	if (!legacySettings || legacySettings.length === 0) return;

	try {
		const legacy = legacySettings[0];
		const existingSettings =
			((await storageService.getItemInternal("GeneralSettingsStorage:state")) as any) || {};

		const layoutMode = legacy.widescreenMode
			? "wide"
			: legacy.layoutMode === "ultra-wide"
				? "ultra-wide"
				: "default";

		await storageService.setItemInternal("GeneralSettingsStorage:state", {
			...existingSettings,
			language: legacy.language || existingSettings.language || "zh",
			autoUpdate: legacy.autoUpdate ?? existingSettings.autoUpdate ?? false,
			layoutMode: layoutMode,
			privacyAutoInherit: legacy.defaultPrivacyMode ?? existingSettings.privacyAutoInherit ?? false,
		});
		stats.settings.updated++;
	} catch (error) {
		console.error("Failed to import settings:", error);
	}
}

// async function importShortcuts(legacyShortcuts: any[], stats: ImportStats): Promise<void> {
// 	try {
// 		const existingState =
// 			((await storageService.getItemInternal("ShortcutSettingsStorage:state")) as any) || {};
// 		const existingShortcuts = existingState.shortcuts || [];
// 		const existingIds = new Set(existingShortcuts.map((s: any) => s.id));

// 		const newShortcuts = [];
// 		for (const legacy of legacyShortcuts) {
// 			if (existingIds.has(legacy.id)) {
// 				stats.shortcuts.skipped++;
// 				continue;
// 			}

// 			newShortcuts.push({
// 				id: legacy.id,
// 				action: legacy.action,
// 				keys: legacy.keys,
// 				scope: legacy.scope,
// 				order: legacy.order,
// 			});
// 			stats.shortcuts.added++;
// 		}

// 		if (newShortcuts.length > 0) {
// 			await storageService.setItemInternal("ShortcutSettingsStorage:state", {
// 				shortcuts: [...existingShortcuts, ...newShortcuts],
// 			});
// 		}
// 	} catch (error) {
// 		console.error("Failed to import shortcuts:", error);
// 		stats.shortcuts.failed++;
// 	}
// }
