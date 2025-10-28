import { getAllModels } from "$lib/api/models.js";
import { DEFAULT_PROVIDERS } from "$lib/datas/providers.js";
import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import { m } from "$lib/paraglide/messages.js";
import type {
	Model,
	ModelCreateInput,
	ModelProvider,
	ModelUpdateInput,
	ProviderDefinition,
} from "@shared/types";
import { nanoid } from "nanoid";
import { toast } from "svelte-sonner";

const { pluginService } = window.electronAPI;

/**
 * Serialize ModelProvider for IPC transmission
 * Ensures all fields are plain objects (no complex types, no Proxy, no reactivity)
 */
function serializeProvider(provider: ModelProvider): ModelProvider {
	// Use JSON serialization to remove any Proxy/reactive wrappers
	return JSON.parse(
		JSON.stringify({
			id: provider.id,
			name: provider.name,
			apiType: provider.apiType,
			apiKey: provider.apiKey,
			baseUrl: provider.baseUrl,
			enabled: provider.enabled,
			custom: provider.custom,
			status: provider.status,
			websites: provider.websites,
			icon: provider.icon,
		}),
	) as ModelProvider;
}

/**
 * Convert ProviderDefinition from plugin to ModelProvider
 */
function providerDefinitionToModelProvider(definition: ProviderDefinition): ModelProvider {
	// Normalize apiType to match ModelProvider type
	let apiType: "openai" | "anthropic" | "gemini" | "302ai" = "openai";
	const lowerApiType = definition.apiType.toLowerCase();

	if (lowerApiType === "anthropic") {
		apiType = "anthropic";
	} else if (lowerApiType === "gemini" || lowerApiType === "google") {
		apiType = "gemini";
	} else if (lowerApiType === "302ai") {
		apiType = "302ai";
	}

	return {
		id: definition.id,
		name: definition.name,
		apiType,
		apiKey: "",
		baseUrl: definition.websites.defaultBaseUrl,
		enabled: true,
		custom: false,
		status: "pending",
		websites: definition.websites,
		icon: definition.icon,
	};
}

export const persistedProviderState = new PersistedState<ModelProvider[]>(
	"app-providers",
	DEFAULT_PROVIDERS,
	true,
	300,
);
export const persistedModelState = new PersistedState<Model[]>("app-models", [], true, 500);

const { aiApplicationService } = window.electronAPI;

$effect.root(() => {
	$effect(() => {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		persistedModelState.current;
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		persistedProviderState.current;
	});
});

let pendingDeleteIds: string[] = [];
let deleteFlushScheduled = false;

function flushPendingDeletes() {
	deleteFlushScheduled = false;
	if (pendingDeleteIds.length === 0) return;

	const idsToDelete = new Set(pendingDeleteIds);
	pendingDeleteIds = [];
	const current = persistedModelState.snapshot;
	const next = current.filter((m) => !idsToDelete.has(m.id));

	persistedModelState.current = next;
}

let cachedSortedModels: Model[] = [];
let lastModelArray: Model[] = [];

function getCachedSortedModels(): Model[] {
	const currentModels = persistedModelState.current;
	if (currentModels !== lastModelArray) {
		lastModelArray = currentModels;
		cachedSortedModels = [...currentModels].sort((a, b) => a.name.localeCompare(b.name));
	}
	return cachedSortedModels;
}

class ProviderState {
	/**
	 * Load providers from plugins and merge with existing providers
	 */
	async loadProvidersFromPlugins(): Promise<void> {
		try {
			// Get provider plugins from plugin system
			const providerPlugins = await pluginService.getProviderPlugins();

			// Convert ProviderDefinition to ModelProvider
			const pluginProviders = providerPlugins.map(providerDefinitionToModelProvider);

			// Get current providers
			const currentProviders = persistedProviderState.current;

			// Merge plugin providers with existing providers
			// Keep user's existing providers and their settings (apiKey, baseUrl, enabled, etc.)
			const mergedProviders = pluginProviders.map((pluginProvider) => {
				const existingProvider = currentProviders.find((p) => p.id === pluginProvider.id);
				if (existingProvider) {
					// Keep user's settings but update metadata from plugin
					return {
						...pluginProvider,
						apiKey: existingProvider.apiKey,
						baseUrl: existingProvider.baseUrl,
						enabled: existingProvider.enabled,
						status: existingProvider.status,
					};
				}
				return pluginProvider;
			});

			// Add custom providers that are not from plugins
			const customProviders = currentProviders.filter(
				(p) => p.custom || !pluginProviders.some((pp) => pp.id === p.id),
			);

			// Update provider state
			persistedProviderState.current = [...mergedProviders, ...customProviders];

			console.log(`[ProviderState] Loaded ${mergedProviders.length} providers from plugins`);
		} catch (error) {
			console.error("[ProviderState] Failed to load providers from plugins:", error);
		}
	}

	getProvider(id: string): ModelProvider | null {
		return persistedProviderState.current.find((p) => p.id === id) || null;
	}
	getProviderByNameOrId(nameOrId: string): ModelProvider | undefined {
		return persistedProviderState.current.find((p) => p.name === nameOrId || p.id === nameOrId);
	}
	addProvider(provider: ModelProvider) {
		persistedProviderState.current = [...persistedProviderState.current, provider];
	}
	async updateProvider(id: string, updates: Partial<ModelProvider>) {
		persistedProviderState.current = persistedProviderState.current.map((p) =>
			p.id === id ? { ...p, ...updates } : p,
		);

		if (updates.apiKey && updates.apiType === "302ai") {
			await aiApplicationService.handle302AIProviderChange(updates.apiKey);
		}
	}
	removeProvider(id: string) {
		persistedProviderState.current = persistedProviderState.current.filter((p) => p.id !== id);
	}
	reorderProviders(newOrder: ModelProvider[]) {
		persistedProviderState.current = [...newOrder];
	}
	createCustomProvider(name: string = "自定义提供商"): ModelProvider {
		const timestamp = Date.now();
		return {
			id: `custom-${timestamp}`,
			name,
			apiType: "openai",
			apiKey: "",
			baseUrl: "",
			enabled: true,
			custom: true,
			status: "pending",
			websites: {
				official: "",
				apiKey: "",
				docs: "",
				models: "",
				defaultBaseUrl: "",
			},
			icon: undefined,
		};
	}
	resetToDefaults() {
		persistedProviderState.current = [...DEFAULT_PROVIDERS];
	}
	searchModelsByName(name: string): Model[] {
		return persistedModelState.current.filter((m) =>
			m.name.toLowerCase().includes(name.toLowerCase()),
		);
	}
	getSortedModels(): Model[] {
		return getCachedSortedModels();
	}

	addModel(input: ModelCreateInput): Model {
		if (!input.id || !input.id.trim()) {
			throw new Error("Model ID is required and cannot be empty");
		}

		const existingModel = persistedModelState.current.find((m) => m.id === input.id);
		if (existingModel) {
			throw new Error(`Model with ID "${input.id}" already exists`);
		}

		const model: Model = {
			id: input.id,
			name: input.name,
			remark: input.remark || "",
			providerId: input.providerId,
			capabilities: input.capabilities || new Set(),
			type: input.type || "language",
			custom: input.custom || false,
			enabled: input.enabled ?? true,
			collected: input.collected || false,
		};
		persistedModelState.current = [...persistedModelState.current, model];

		return model;
	}
	updateModel(id: string, updates: ModelUpdateInput): boolean {
		const modelIndex = persistedModelState.current.findIndex((m) => m.id === id);
		if (modelIndex === -1) return false;

		if (updates.id && updates.id !== id) {
			const existingModel = persistedModelState.current.find((m) => m.id === updates.id);
			if (existingModel) {
				console.warn(`Model with ID "${updates.id}" already exists`);
				return false;
			}
		}

		persistedModelState.current = persistedModelState.current.map((m) =>
			m.id === id ? { ...m, ...updates } : m,
		);

		return true;
	}
	removeModel(id: string): boolean {
		const originalLength = persistedModelState.current.length;
		persistedModelState.current = persistedModelState.current.filter((m) => m.id !== id);
		if (persistedModelState.current.length !== originalLength) {
			return true;
		}
		return false;
	}
	scheduleRemoveModel(id: string): void {
		pendingDeleteIds.push(id);
		if (!deleteFlushScheduled) {
			deleteFlushScheduled = true;
			requestAnimationFrame(flushPendingDeletes);
		}
	}
	addModels(models: ModelCreateInput[]): Model[] {
		const newModels: Model[] = models.map((input) => ({
			id: nanoid(),
			name: input.name,
			remark: input.remark || "",
			providerId: input.providerId,
			capabilities: input.capabilities || new Set(),
			type: input.type || "language",
			custom: input.custom || false,
			enabled: input.enabled ?? true,
			collected: input.collected || false,
		}));
		persistedModelState.current = [...persistedModelState.current, ...newModels];

		return newModels;
	}
	toggleModelCollected(id: string): boolean {
		const model = persistedModelState.current.find((m) => m.id === id);
		if (!model) return false;

		persistedModelState.current = persistedModelState.current.map((m) =>
			m.id === id ? { ...m, collected: !m.collected } : m,
		);

		return true;
	}
	toggleModelEnabled(id: string): boolean {
		const model = persistedModelState.current.find((m) => m.id === id);
		if (!model) return false;

		persistedModelState.current = persistedModelState.current.map((m) =>
			m.id === id ? { ...m, enabled: !m.enabled } : m,
		);

		return true;
	}
	removeModelsByProvider(providerId: string): number {
		const originalLength = persistedModelState.current.length;
		persistedModelState.current = persistedModelState.current.filter(
			(m) => m.providerId !== providerId,
		);
		const removedCount = originalLength - persistedModelState.current.length;
		return removedCount;
	}
	clearModelsByProvider(providerId: string): number {
		return this.removeModelsByProvider(providerId);
	}
	async fetchModelsForProvider(provider: ModelProvider): Promise<boolean> {
		try {
			// Use plugin system for all providers
			// Deep clone to remove any reactive proxies
			const serializedProvider = serializeProvider(provider);

			console.log("[ProviderState] Fetching models for provider:", serializedProvider.id);
			console.log("[ProviderState] Serialized provider:", serializedProvider);

			const pluginModels = await pluginService.fetchModelsFromProvider(serializedProvider);

			if (pluginModels && pluginModels.length > 0) {
				await this.updateProvider(provider.id, { status: "connected" });

				// Ensure capabilities is a Set (in case it came as Array from IPC)
				const modelsWithSet = pluginModels.map((model) => ({
					...model,
					capabilities:
						model.capabilities instanceof Set
							? model.capabilities
							: new Set(model.capabilities as unknown as string[]),
				}));

				persistedModelState.current = persistedModelState.current
					.filter((models) => models.providerId !== provider.id)
					.concat(modelsWithSet);

				toast.success(
					m.text_fetch_models_success({
						count: pluginModels.length.toString(),
						provider: provider.name,
					}),
				);
				return true;
			} else {
				// No models returned from plugin
				await this.updateProvider(provider.id, { status: "error" });
				toast.error(m.text_fetch_models_error({ provider: provider.name }), {
					description: m.text_fetch_models_unknown_error(),
				});
				return false;
			}
		} catch (error) {
			console.error(`Failed to fetch models for provider ${provider.id}:`, error);
			await this.updateProvider(provider.id, { status: "error" });
			toast.error(m.text_fetch_models_error({ provider: provider.name }), {
				description: error instanceof Error ? error.message : m.text_fetch_models_network_error(),
			});
			return false;
		}
	}
	async fetchAllModels(): Promise<boolean> {
		try {
			const result = await getAllModels(persistedProviderState.current);
			if (result.success && result.data) {
				persistedModelState.current = result.data.models;

				return true;
			}
			return false;
		} catch (error) {
			console.error("Failed to fetch all models:", error);
			return false;
		}
	}
	async refreshProviderModels(providerId: string): Promise<boolean> {
		const provider = this.getProvider(providerId);
		if (!provider) return false;

		return await this.fetchModelsForProvider(provider);
	}
}

export const providerState = new ProviderState();

// Initialize providers from plugins on startup
$effect.root(() => {
	$effect(() => {
		// Load providers from plugins when the store is initialized
		providerState.loadProvidersFromPlugins().catch((error) => {
			console.error("[ProviderState] Failed to initialize providers from plugins:", error);
		});
	});
});
