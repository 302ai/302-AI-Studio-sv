import { DEFAULT_PROVIDERS } from "$lib/datas/providers.js";
import type { ModelProvider } from "$lib/types/provider.js";
import type { Model, ModelCreateInput, ModelUpdateInput } from "$lib/types/model.js";
import { nanoid } from "nanoid";
import { getModelsByProvider, getAllModels } from "$lib/api/models.js";
import { toast } from "svelte-sonner";
import { m } from "$lib/paraglide/messages.js";
import { asyncStorage } from "$lib/utils/storage-polyfill";

class ProviderState {
	providers = $state<ModelProvider[]>([]);
	models = $state<Model[]>([]);
	initialized = $state(false);

	constructor() {
		// Don't auto-load in constructor, wait for explicit initialization
		this.providers = [...DEFAULT_PROVIDERS];
		this.models = [];
	}

	async initialize() {
		if (!this.initialized) {
			await this.loadFromStorage();
		}
	}
	private async loadFromStorage() {
		try {
			const storedProviders = await asyncStorage.getItem("ai-studio-providers");
			if (storedProviders) {
				try {
					this.providers = JSON.parse(storedProviders);
				} catch {
					this.providers = [...DEFAULT_PROVIDERS];
				}
			} else {
				this.providers = [...DEFAULT_PROVIDERS];
			}

			const storedModels = await asyncStorage.getItem("ai-studio-models");
			if (storedModels) {
				try {
					const parsedModels = JSON.parse(storedModels);

					this.models = parsedModels.map((model: { capabilities: string[] }) => ({
						...model,
						capabilities: new Set(model.capabilities || []),
					}));
				} catch {
					this.models = [];
				}
			} else {
				this.models = [];
			}
		} catch (error) {
			console.warn("Failed to load from storage, using defaults:", error);
			this.providers = [...DEFAULT_PROVIDERS];
			this.models = [];
		} finally {
			this.initialized = true;
		}
	}
	private async saveToStorage() {
		try {
			await asyncStorage.setItem("ai-studio-providers", JSON.stringify(this.providers));
			const modelsForStorage = this.models.map((model) => ({
				...model,
				capabilities: Array.from(model.capabilities),
			}));
			await asyncStorage.setItem("ai-studio-models", JSON.stringify(modelsForStorage));
		} catch (error) {
			console.warn("Failed to save to storage:", error);
		}
	}
	getProvider(id: string): ModelProvider | undefined {
		return this.providers.find((p) => p.id === id);
	}
	getProviderByNameOrId(nameOrId: string): ModelProvider | undefined {
		return this.providers.find((p) => p.name === nameOrId || p.id === nameOrId);
	}
	async addProvider(provider: ModelProvider) {
		this.providers = [...this.providers, provider];
		await this.saveToStorage();
	}
	async updateProvider(id: string, updates: Partial<ModelProvider>) {
		this.providers = this.providers.map((p) => (p.id === id ? { ...p, ...updates } : p));
		await this.saveToStorage();
	}
	async removeProvider(id: string) {
		this.providers = this.providers.filter((p) => p.id !== id);
		await this.saveToStorage();
	}
	async reorderProviders(newOrder: ModelProvider[]) {
		this.providers = [...newOrder];
		await this.saveToStorage();
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
	async resetToDefaults() {
		this.providers = [...DEFAULT_PROVIDERS];
		await this.saveToStorage();
	}
	searchModelsByName(name: string): Model[] {
		return this.models.filter((m) => m.name.toLowerCase().includes(name.toLowerCase()));
	}
	getSortedModels(): Model[] {
		return [...this.models].sort((a, b) => a.name.localeCompare(b.name));
	}
	getSortedModelsByProvider(providerId: string): Model[] {
		return this.models
			.filter((m) => m.providerId === providerId)
			.sort((a, b) => a.name.localeCompare(b.name));
	}
	async addModel(input: ModelCreateInput): Promise<Model> {
		if (!input.id || !input.id.trim()) {
			throw new Error("Model ID is required and cannot be empty");
		}

		const existingModel = this.models.find((m) => m.id === input.id);
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
		this.models = [...this.models, model];
		await this.saveToStorage();
		return model;
	}
	async updateModel(id: string, updates: ModelUpdateInput): Promise<boolean> {
		const modelIndex = this.models.findIndex((m) => m.id === id);
		if (modelIndex === -1) return false;

		if (updates.id && updates.id !== id) {
			const existingModel = this.models.find((m) => m.id === updates.id);
			if (existingModel) {
				console.warn(`Model with ID "${updates.id}" already exists`);
				return false;
			}
		}

		this.models = this.models.map((m) => (m.id === id ? { ...m, ...updates } : m));
		await this.saveToStorage();
		return true;
	}
	async removeModel(id: string): Promise<boolean> {
		const originalLength = this.models.length;
		this.models = this.models.filter((m) => m.id !== id);
		if (this.models.length !== originalLength) {
			await this.saveToStorage();
			return true;
		}
		return false;
	}
	async addModels(models: ModelCreateInput[]): Promise<Model[]> {
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
		this.models = [...this.models, ...newModels];
		await this.saveToStorage();
		return newModels;
	}
	async toggleModelCollected(id: string): Promise<boolean> {
		const model = this.models.find((m) => m.id === id);
		if (!model) return false;

		this.models = this.models.map((m) => (m.id === id ? { ...m, collected: !m.collected } : m));
		await this.saveToStorage();
		return true;
	}
	async toggleModelEnabled(id: string): Promise<boolean> {
		const model = this.models.find((m) => m.id === id);
		if (!model) return false;

		this.models = this.models.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m));
		await this.saveToStorage();
		return true;
	}
	async removeModelsByProvider(providerId: string): Promise<number> {
		const originalLength = this.models.length;
		this.models = this.models.filter((m) => m.providerId !== providerId);
		const removedCount = originalLength - this.models.length;
		if (removedCount > 0) {
			await this.saveToStorage();
		}
		return removedCount;
	}
	async clearModelsByProvider(providerId: string): Promise<number> {
		return await this.removeModelsByProvider(providerId);
	}
	async fetchModelsForProvider(provider: ModelProvider): Promise<boolean> {
		try {
			const result = await getModelsByProvider(provider);
			if (result.success && result.data) {
				await this.updateProvider(provider.id, { status: "connected" });
				await this.removeModelsByProvider(provider.id);
				this.models = [...this.models, ...result.data.models];
				await this.saveToStorage();
				toast.success(
					m.text_fetch_models_success({
						count: result.data.models.length.toString(),
						provider: provider.name,
					}),
				);
				return true;
			} else {
				await this.updateProvider(provider.id, { status: "error" });
				toast.error(m.text_fetch_models_error({ provider: provider.name }), {
					description: result.error || m.text_fetch_models_unknown_error(),
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
			const result = await getAllModels(this.providers);
			if (result.success && result.data) {
				this.models = result.data.models;
				await this.saveToStorage();
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
