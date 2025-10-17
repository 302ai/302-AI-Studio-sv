import { getAllModels, getModelsByProvider } from "$lib/api/models.js";
import { DEFAULT_PROVIDERS } from "$lib/datas/providers.js";
import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import { m } from "$lib/paraglide/messages.js";
import type { Model, ModelCreateInput, ModelProvider, ModelUpdateInput } from "@shared/types";
import { nanoid } from "nanoid";
import { toast } from "svelte-sonner";

export const persistedProviderState = new PersistedState<ModelProvider[]>(
	"app-providers",
	DEFAULT_PROVIDERS,
);
export const persistedModelState = new PersistedState<Model[]>("app-models", []);

const { aiApplicationService } = window.electronAPI;

$effect.root(() => {
	$effect(() => {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		persistedModelState.current;
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		persistedProviderState.current;
	});
});

class ProviderState {
	getProvider(id: string): ModelProvider | null {
		return persistedProviderState.current.find((p) => p.id === id) || null;
	}
	getProviderByNameOrId(nameOrId: string): ModelProvider | undefined {
		return persistedProviderState.current.find((p) => p.name === nameOrId || p.id === nameOrId);
	}
	addProvider(provider: ModelProvider) {
		persistedProviderState.current = [...persistedProviderState.current, provider];
	}
	updateProvider(id: string, updates: Partial<ModelProvider>) {
		persistedProviderState.current = persistedProviderState.current.map((p) =>
			p.id === id ? { ...p, ...updates } : p,
		);

		if (updates.apiType === "302ai") {
			aiApplicationService.handle302AIProviderChange();
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
		return [...persistedModelState.current].sort((a, b) => a.name.localeCompare(b.name));
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
			const result = await getModelsByProvider(provider);
			if (result.success && result.data) {
				this.updateProvider(provider.id, { status: "connected" });
				persistedModelState.current = persistedModelState.current
					.filter((models) => {
						return models.providerId !== provider.id;
					})
					.concat(result.data.models);

				toast.success(
					m.text_fetch_models_success({
						count: result.data.models.length.toString(),
						provider: provider.name,
					}),
				);
				return true;
			} else {
				this.updateProvider(provider.id, { status: "error" });
				toast.error(m.text_fetch_models_error({ provider: provider.name }), {
					description: result.error || m.text_fetch_models_unknown_error(),
				});
				return false;
			}
		} catch (error) {
			console.error(`Failed to fetch models for provider ${provider.id}:`, error);
			this.updateProvider(provider.id, { status: "error" });
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
